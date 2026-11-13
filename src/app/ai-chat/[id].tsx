// ─────────────────────────────────────────────────────────────────────────────
// Ask about your review — chat screen (issue #45).
//
// Route: /ai-chat/<applicationId>?demo=0 (pushed from the self-service screen).
//
// The assistant answers ONLY from the stored review on the server. This screen
// is a thin renderer:
//   • answer text is rendered as plain text (React Native <Text> — no markdown,
//     no HTML, nothing is executed);
//   • links come only from `citations[].sourceUrl` and open externally;
//   • the UI adds no outcome/likelihood wording of its own and nothing
//     country-specific — `declined` / `withheld` replies show the server's
//     fixed text as-is;
//   • non-streaming: a pending bubble shows until the POST returns;
//   • on failure the typed message stays in the input.
// Demo mode (a demo destination id) makes NO request at all.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { BackHeader, InlineError } from '@/components/explorer/AccountForm';
import {
  describeChatError,
  useAiChatHistory,
  useClearAiChat,
  useSendAiChat,
} from '@/hooks/useAiChat';
import { UpgradeLink } from '@/components/explorer/UpgradePrompt';
import { OutlineButton } from '@/components/explorer/review/ReviewParts';
import { useStartReview } from '@/hooks/useCaseOfficer';
import type { ChatCitation, ChatReplyKind } from '@/types/ai-chat.type';

// Mirrors the backend limit (CHAT_MAX_MESSAGE_CHARS).
const MAX_CHARS = 1000;

// A message as the screen renders it (stored turn or the live reply).
interface Bubble {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  kind: ChatReplyKind | null;
  citations: ChatCitation[];
}

// Only ever open http(s) links, and only ones that came from a citation.
function openSource(url: string) {
  if (/^https?:\/\//i.test(url)) void Linking.openURL(url);
}

// ── One citation: rule title, ruleRef, verbatim quote, source link ───────────
function CitationCard({ c }: { c: ChatCitation }) {
  return (
    <View
      style={{
        marginTop: 8,
        backgroundColor: EX.color.cream,
        borderRadius: 12,
        padding: 10,
        gap: 3,
      }}
    >
      <Text style={{ fontSize: 12.5, fontWeight: '700', color: EX.color.ink }}>
        {c.title}
      </Text>
      {c.ruleRef ? (
        <Text style={{ fontSize: 11.5, color: EX.color.muted }}>
          {c.ruleRef}
        </Text>
      ) : null}
      {/* Verbatim quote from the published guidance — shown exactly as stored. */}
      <Text
        style={{ fontSize: 12.5, lineHeight: 17, color: EX.color.inkMuted }}
      >
        “{c.sourceQuote}”
      </Text>
      <Pressable onPress={() => openSource(c.sourceUrl)} hitSlop={6}>
        <Text
          style={{ fontSize: 12, fontWeight: '700', color: EX.color.primary }}
        >
          View source
        </Text>
      </Pressable>
    </View>
  );
}

export default function AiChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  // japa#145/#174: there is no demo data; the id is always a real application.
  const appId = id ?? '';

  const historyQ = useAiChatHistory(appId, !!appId);
  const send = useSendAiChat(appId);
  const clear = useClearAiChat(appId);
  // "Run your review" (the server's `offerAssessment`): the same start the
  // application's sticky button uses, from the review hook (#43).
  const { start: startReview, isStarting } = useStartReview(appId);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  // The message currently in flight (shown as a pending user bubble).
  const [pendingText, setPendingText] = useState<string | null>(null);
  // The latest reply, kept for its `offerAssessment` / `outdated` flags.
  const [lastFlags, setLastFlags] = useState<{
    offerAssessment: boolean;
    outdated: boolean;
  } | null>(null);
  const [error, setError] = useState<{ upgrade: boolean; text: string } | null>(
    null,
  );
  const scrollRef = useRef<ScrollView>(null);

  const bubbles: Bubble[] = useMemo(
    () =>
      (historyQ.data ?? []).map((m) => ({
        id: m.id,
        role: m.role,
        text: m.content,
        kind: m.kind,
        citations: m.citations ?? [],
      })),
    [historyQ.data],
  );

  // Keep the newest message in view.
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [bubbles.length, pendingText]);

  const trimmed = draft.trim();
  const canSend =
    !send.isPending && trimmed.length > 0 && trimmed.length <= MAX_CHARS;

  const onSend = async () => {
    if (!canSend) return;
    setError(null);
    setPendingText(trimmed);
    try {
      const reply = await send.mutateAsync(trimmed);
      // Only clear the input once the server accepted the turn.
      setDraft('');
      setLastFlags({
        offerAssessment: reply.offerAssessment,
        outdated: reply.outdated,
      });
    } catch (e) {
      // Keep the typed message so the user can retry.
      setError(describeChatError(e));
    } finally {
      setPendingText(null);
    }
  };

  // Start a review, then open it. 402 (free plan, changed inputs) goes to the
  // plans screen's prompt in the line below; nothing is sent to anyone.
  const onRunReview = async () => {
    setReviewMsg(null);
    const out = await startReview('cta');
    if (out === 'started') router.push(`/self-service/${appId}/review`);
    else if (out === 'upgrade')
      setError({ upgrade: true, text: 'A new review is part of a paid plan.' });
    else if (out === 'no_rubric')
      setReviewMsg('There is nothing to review this application against yet.');
    else if (out === 'offline')
      setReviewMsg(
        'You’re offline, so we couldn’t start your review. Reconnect and try again.',
      );
    else setReviewMsg('We couldn’t start your review. Try again in a moment.');
  };

  const onClear = async () => {
    setError(null);
    try {
      await clear.mutateAsync();
      setLastFlags(null);
    } catch (e) {
      setError(describeChatError(e));
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: EX.color.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <BackHeader
        title="Ask about your review"
        subtitle="Answers come from your saved review"
        insets={insets}
        onBack={() => router.back()}
      />

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 18, gap: 10 }}
        keyboardShouldPersistTaps="handled"
      >
        {historyQ.isLoading ? (
          <ActivityIndicator color={EX.color.primary} />
        ) : historyQ.isError ? (
          // History failure: same mapping as a send failure (402 → upgrade).
          <ErrorBlock e={describeChatError(historyQ.error)} />
        ) : bubbles.length === 0 && !pendingText ? (
          <EmptyLine text="Ask a question about your review." />
        ) : null}

        {bubbles.map((b) => (
          <MessageBubble key={b.id} b={b} />
        ))}

        {/* Pending: the user's message plus a spinner bubble until the reply lands. */}
        {pendingText ? (
          <>
            <MessageBubble
              b={{
                id: 'pending-user',
                role: 'user',
                text: pendingText,
                kind: null,
                citations: [],
              }}
            />
            <View style={bubbleStyle(false)}>
              <ActivityIndicator color={EX.color.primary} />
            </View>
          </>
        ) : null}

        {/* The server asked us to offer a review: start it (review hook, #43) and
            open the review screen. Ask again once it has finished. */}
        {lastFlags?.offerAssessment ? (
          <View style={{ gap: 8 }}>
            <Text style={noteStyle}>Run your review, then ask again.</Text>
            <OutlineButton
              label="Run your review"
              onPress={onRunReview}
              disabled={isStarting}
            />
            {reviewMsg ? <InlineError message={reviewMsg} /> : null}
          </View>
        ) : null}

        {/* The stored review is older than the application's current state. */}
        {lastFlags?.outdated ? (
          <Text style={noteStyle}>This review is out of date.</Text>
        ) : null}

        {error ? <ErrorBlock e={error} /> : null}
      </ScrollView>

      {/* Composer */}
      <View
        style={{
          paddingHorizontal: 14,
          paddingTop: 8,
          paddingBottom: insets.bottom + 8,
          borderTopWidth: 1,
          borderTopColor: EX.color.line06,
          gap: 6,
        }}
      >
        {bubbles.length > 0 ? (
          <Pressable onPress={onClear} disabled={clear.isPending} hitSlop={6}>
            <Text style={{ fontSize: 12, color: EX.color.muted }}>
              Clear conversation
            </Text>
          </Pressable>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask about your review"
            placeholderTextColor={EX.color.muted}
            multiline
            maxLength={MAX_CHARS}
            style={{
              flex: 1,
              maxHeight: 110,
              backgroundColor: '#fff',
              borderRadius: 18,
              borderWidth: 1,
              borderColor: EX.color.line06,
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 14.5,
              color: EX.color.ink,
            }}
          />
          <Pressable
            onPress={onSend}
            disabled={!canSend}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: canSend ? EX.color.primary : EX.color.faint,
            }}
          >
            <Ic.send size={18} color="#fff" strokeWidth={2} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

const noteStyle = {
  fontSize: 12.5,
  lineHeight: 18,
  color: EX.color.inkMuted,
  textAlign: 'center' as const,
};

function bubbleStyle(mine: boolean) {
  return {
    alignSelf: mine ? ('flex-end' as const) : ('flex-start' as const),
    maxWidth: '88%' as const,
    backgroundColor: mine ? EX.color.primary : '#fff',
    borderRadius: 18,
    borderWidth: mine ? 0 : 1,
    borderColor: EX.color.line06,
    paddingHorizontal: 13,
    paddingVertical: 10,
  };
}

// Empty state: icon + one line.
function EmptyLine({ text }: { text: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingVertical: 40 }}>
      <Ic.msg size={28} color={EX.color.faint} strokeWidth={1.6} />
      <Text style={{ fontSize: 13.5, color: EX.color.muted }}>{text}</Text>
    </View>
  );
}

// Error line; a 402 adds the shared "See plans" link (same plans screen as
// every other upgrade prompt).
function ErrorBlock({ e }: { e: { upgrade: boolean; text: string } }) {
  return (
    <View style={{ gap: 8 }}>
      <InlineError message={e.text} />
      {e.upgrade ? <UpgradeLink /> : null}
    </View>
  );
}

// One message. Text is plain; assistant answers may carry citations.
function MessageBubble({ b }: { b: Bubble }) {
  const mine = b.role === 'user';
  return (
    <View style={bubbleStyle(mine)}>
      <Text
        selectable
        style={{
          fontSize: 14.5,
          lineHeight: 20,
          color: mine ? '#fff' : EX.color.ink,
        }}
      >
        {b.text}
      </Text>
      {b.citations.map((c) => (
        <CitationCard key={`${c.criterionId}:${c.sourceUrl}`} c={c} />
      ))}
    </View>
  );
}
