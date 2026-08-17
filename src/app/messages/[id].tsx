// ─────────────────────────────────────────────────────────────────────────────
// Chat thread (prototype messaging.jsx ChatView).
// Glass header (back · agent avatar+presence · name+Verified · status · phone)
// over a scrolling message list, with a rounded input row + circular send button
// pinned to the bottom. Own bubbles are coral with a bottom-right tail; agent
// bubbles are white/bordered with a bottom-left tail. Uses KeyboardAvoidingView
// so the composer lifts above the keyboard, and auto-scrolls on send.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX } from '@/components/explorer/theme';
import {
  THREAD,
  agentById,
  convoById,
  type Msg,
} from '@/components/explorer/data';
import { Ic } from '@/components/explorer/icons';
import { Portrait, Verified } from '@/components/explorer/primitives';
import {
  useConversations,
  useMessages,
  useSendMessage,
} from '@/hooks/useMessaging';
import { mapConvo, mapMessage } from '@/components/explorer/liveMessaging';

// ── Single message row (bubble + timestamp) ──────────────────────────────────
function Bubble({ m }: { m: Msg }) {
  const mine = m.from === 'me';
  return (
    <View
      style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: 5 }}
    >
      <View
        style={{
          maxWidth: '80%',
          // Source bubble padding '11px 15px'.
          paddingVertical: 11,
          paddingHorizontal: 15,
          // Coral filled bubble for me (radius 20/20/6/20 — tail bottom-right);
          // white bordered bubble for the agent (radius 20/20/20/6 — tail bottom-left).
          backgroundColor: mine ? EX.color.primary : '#fff',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderBottomRightRadius: mine ? 6 : 20,
          borderBottomLeftRadius: mine ? 20 : 6,
          borderWidth: mine ? 0 : 1,
          borderColor: 'rgba(23,19,38,0.07)', // source agent bubble hairline
          // Soft coral glow under own bubbles.
          shadowColor: mine ? EX.color.primary : '#171326',
          shadowOpacity: mine ? 0.22 : 0.04,
          shadowRadius: mine ? 12 : 2,
          shadowOffset: { width: 0, height: mine ? 6 : 1 },
          elevation: mine ? 4 : 1,
        }}
      >
        <Text
          style={{
            fontSize: 14.5,
            lineHeight: 20, // 14.5 × 1.4
            color: mine ? '#fff' : EX.color.ink, // source: agent text #171326
          }}
        >
          {m.t}
        </Text>

        {/* Documents shared on this message. Rendered inline as well as in the
            thread's Files sheet, so a file keeps the context it arrived in. */}
        {m.files?.length ? (
          <View style={{ marginTop: 8, gap: 6 }}>
            {m.files.map((f) => (
              <Pressable
                key={f.url}
                onPress={() => void Linking.openURL(f.url)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  borderRadius: 10,
                  paddingHorizontal: 9,
                  paddingVertical: 7,
                  // Tinted panel inside the bubble: translucent white on the
                  // coral own-bubble, faint ink on the white agent bubble.
                  backgroundColor: mine
                    ? 'rgba(255,255,255,0.18)'
                    : 'rgba(23,19,38,0.04)',
                }}
              >
                <Ic.docs
                  size={14}
                  color={mine ? '#fff' : EX.color.primary}
                  strokeWidth={1.8}
                />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 12.5,
                    fontWeight: '600',
                    color: mine ? '#fff' : EX.color.ink,
                  }}
                  numberOfLines={1}
                >
                  {f.name}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      <Text
        style={{
          fontSize: 11,
          color: EX.color.faint,
          marginTop: 3, // source: timestamp marginTop 3
          marginHorizontal: 4,
        }}
      >
        {m.at}
      </Text>
    </View>
  );
}

export default function ChatView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const convId = id ?? '';

  // ── Resolve the conversation (demo first, then live) ─────────────────────
  // Prefer the demo roster (richer portrait art); otherwise resolve the row
  // from the live conversations list by id. Hooks run unconditionally.
  const demoConvo = convoById(convId);
  const { data: liveConvos } = useConversations();
  const liveConvo = useMemo(
    () =>
      demoConvo
        ? undefined
        : (liveConvos ?? []).map(mapConvo).find((c) => c.id === convId),
    [demoConvo, liveConvos, convId],
  );
  const convo = demoConvo ?? liveConvo;

  const agent = agentById(convo?.agentId);
  const agentName = agent?.n ?? convo?.agentName ?? 'Agent';
  const agentSeed = agent?.seed ?? 0;
  const online = convo?.online ?? false;

  // ── Messages: demo THREAD fallback, else live from the backend ───────────
  // When a demo thread exists we disable the live query (empty id); otherwise
  // fetch messages for this conversation and map them onto the bubble shape.
  const demoThread = THREAD[convId];
  const isLive = !demoThread;
  const liveMsgs = useMessages(isLive ? convId : '');
  const base = useMemo<Msg[]>(
    () => demoThread ?? (liveMsgs.data ?? []).map(mapMessage),
    [demoThread, liveMsgs.data],
  );

  // Locally-appended optimistic sends (kept in-session on top of `base`).
  const [sent, setSent] = useState<Msg[]>([]);
  const msgs = useMemo<Msg[]>(() => [...base, ...sent], [base, sent]);

  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const sendMessage = useSendMessage();

  // ── Files shared in this thread ───────────────────────────────────────────
  // Flattened out of the messages (newest first) so a client can find a document
  // without scrolling back through the whole conversation. Costs no extra
  // request — the messages are already loaded.
  const [filesOpen, setFilesOpen] = useState(false);
  const files = useMemo(
    () =>
      msgs
        .flatMap((m) =>
          (m.files ?? []).map((f) => ({ ...f, mine: m.from === 'me' })),
        )
        .reverse(),
    [msgs],
  );

  // Keep the newest message in view on mount, on new content, and after a send.
  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() =>
      scrollRef.current?.scrollToEnd({ animated: true }),
    );
  }, []);

  const send = () => {
    const t = draft.trim();
    if (!t) return;
    // Optimistically append locally for both demo and live conversations.
    setSent((prev) => [
      ...prev,
      { from: 'me', t, at: format(new Date(), 'h:mm a') },
    ]);
    setDraft('');
    scrollToEnd();
    // For a live conversation, also persist the message to the backend.
    if (isLive && convId)
      sendMessage.mutate({ conversationId: convId, content: t });
  };

  const hasText = draft.trim().length > 0;
  // Show a spinner only when a live thread is still loading its first page.
  const showLoading = isLive && liveMsgs.isLoading && msgs.length === 0;
  const headerH = insets.top + 62; // approx header height for keyboard offset

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      {/* ── Glass header ──────────────────────────────────────────────────── */}
      <BlurView
        intensity={30}
        tint="light"
        style={{
          // Source header: paddingTop 54 → insets.top + 6; inner padding '6px 16px 10px', gap 11.
          paddingTop: insets.top + 6,
          paddingBottom: 10,
          paddingHorizontal: 16,
          backgroundColor: 'rgba(251,247,240,0.86)', // source glass tint (0.86, not the 0.82 token)
          borderBottomWidth: 1,
          borderBottomColor: EX.color.line06,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 11,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={{
            width: 38, // source: borderless 38px back button
            height: 38,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ic.chevL size={22} color={EX.color.ink} strokeWidth={1.8} />
        </Pressable>

        {/* Avatar + presence dot (source: 40px avatar, 11px dot bottom-right, 2px cream ring) */}
        <View style={{ width: 40, height: 40 }}>
          <Portrait seed={agentSeed} size={40} name={agentName} />
          {online ? (
            <View
              style={{
                position: 'absolute',
                right: 0,
                bottom: 0,
                width: 11,
                height: 11,
                borderRadius: 5.5,
                backgroundColor: EX.color.teal,
                borderWidth: 2,
                borderColor: '#FBF7F0',
              }}
            />
          ) : null}
        </View>

        {/* Name + status — name taps through to the agent profile */}
        <Pressable
          onPress={() => agent && router.push(`/agent/${agent.id}`)}
          style={{ flex: 1, minWidth: 0 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text
              style={{ fontSize: 15, fontWeight: '700', color: EX.color.ink }}
              numberOfLines={1}
            >
              {agentName}
            </Text>
            <Verified size={13} />
          </View>
          <Text
            style={{
              fontSize: 11.5, // source: status 11.5 / 600, green (#1E8E55) when online
              color: online ? EX.color.success : EX.color.muted,
              marginTop: 1,
              fontWeight: '600',
            }}
          >
            {online ? 'Online now' : 'Active recently'}
          </Text>
        </Pressable>

        {/* Files button — same 38px chip as the call button, shown only when
            documents have actually been shared in this thread. */}
        {files.length > 0 ? (
          <Pressable
            onPress={() => setFilesOpen(true)}
            hitSlop={6}
            accessibilityLabel={`${files.length} shared files`}
            style={{
              height: 38,
              paddingHorizontal: 11,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              borderRadius: 19,
              backgroundColor: EX.color.primaryTint10,
            }}
          >
            <Ic.docs size={17} color={EX.color.primary} strokeWidth={1.8} />
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: EX.color.primary,
              }}
            >
              {files.length}
            </Text>
          </Pressable>
        ) : null}

        {/* Phone / call button — source: 38px coral-tint chip (no border) */}
        <Pressable
          hitSlop={6}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: EX.color.primaryTint10,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ic.phone size={18} color={EX.color.primary} strokeWidth={1.8} />
        </Pressable>
      </BlurView>

      {/* ── Shared files sheet ────────────────────────────────────────────── */}
      <Modal
        visible={filesOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setFilesOpen(false)}
      >
        <Pressable
          onPress={() => setFilesOpen(false)}
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(23,19,38,0.35)',
          }}
        >
          {/* Stop taps inside the sheet from closing it. */}
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: EX.color.bg,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 16,
              paddingHorizontal: 22,
              paddingBottom: Math.max(insets.bottom, 22),
              maxHeight: '70%',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <Text
                style={{ fontSize: 17, fontWeight: '700', color: EX.color.ink }}
              >
                Shared files ({files.length})
              </Text>
              <Pressable onPress={() => setFilesOpen(false)} hitSlop={8}>
                <Ic.x size={20} color={EX.color.muted} strokeWidth={1.8} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ gap: 8 }}>
                {files.map((f, i) => (
                  <Pressable
                    key={`${f.url}-${i}`}
                    onPress={() => void Linking.openURL(f.url)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 11,
                      backgroundColor: '#fff',
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: EX.color.line06,
                      paddingHorizontal: 13,
                      paddingVertical: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: EX.color.primaryTint10,
                      }}
                    >
                      <Ic.docs
                        size={16}
                        color={EX.color.primary}
                        strokeWidth={1.8}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: '600',
                          color: EX.color.ink,
                        }}
                        numberOfLines={1}
                      >
                        {f.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: EX.color.muted,
                          marginTop: 2,
                        }}
                      >
                        {f.mine ? 'Shared by you' : `Shared by ${agentName}`}
                      </Text>
                    </View>
                    <Ic.chevR
                      size={16}
                      color={EX.color.faint}
                      strokeWidth={1.8}
                    />
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Messages + composer (lifts above keyboard) ────────────────────── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={headerH}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToEnd}
          contentContainerStyle={{
            // Source messages area: padding '18px 16px'.
            paddingHorizontal: 16,
            paddingTop: 18,
            paddingBottom: 12,
          }}
        >
          {/* "Today" divider chip (source: rgba(23,19,38,0.05) fill, padding '4px 12px', no border) */}
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <View
              style={{
                backgroundColor: 'rgba(23,19,38,0.05)',
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: '600',
                  color: EX.color.muted,
                }}
              >
                Today
              </Text>
            </View>
          </View>

          {showLoading ? (
            <ActivityIndicator
              color={EX.color.primary}
              style={{ marginTop: 24 }}
            />
          ) : null}

          {msgs.map((m, i) => (
            <Bubble key={i} m={m} />
          ))}
        </ScrollView>

        {/* ── Input row ───────────────────────────────────────────────────── */}
        <View
          style={{
            // Source input row: padding '12px 16px 26px', gap 10, white bg, top hairline.
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 26),
            borderTopWidth: 1,
            borderTopColor: EX.color.line06,
            backgroundColor: '#fff',
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Type a message…"
            placeholderTextColor={EX.color.muted}
            multiline
            style={{
              // Source input: cream bg (#FFFBF5), border rgba(23,19,38,0.1), radius 999, padding '12px 18px'.
              flex: 1,
              minHeight: 44,
              maxHeight: 120,
              borderRadius: 999,
              backgroundColor: EX.color.bg,
              borderWidth: 1,
              borderColor: EX.color.line10,
              paddingHorizontal: 18,
              paddingTop: 12,
              paddingBottom: 12,
              fontSize: 14.5,
              color: EX.color.ink,
            }}
            onSubmitEditing={send}
          />
          <Pressable
            onPress={send}
            disabled={!hasText}
            style={{
              // Source send button: 46px circle, coral when there is text.
              width: 46,
              height: 46,
              borderRadius: 23,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: hasText ? EX.color.primary : EX.color.line10,
              shadowColor: EX.color.primary,
              shadowOpacity: hasText ? 0.4 : 0,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: hasText ? 4 : 0,
            }}
          >
            <Ic.send
              size={19}
              color={hasText ? '#fff' : EX.color.muted}
              strokeWidth={1.8}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
