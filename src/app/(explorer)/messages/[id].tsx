// ─────────────────────────────────────────────────────────────────────────────
// Chat thread (prototype messaging.jsx ChatView).
// Glass header (back · agent avatar+presence · name+Verified · status · phone)
// over a scrolling message list, with a rounded input row + circular send button
// pinned to the bottom. Own bubbles are coral with a bottom-right tail; agent
// bubbles are white/bordered with a bottom-left tail. Uses KeyboardAvoidingView
// so the composer lifts above the keyboard, and auto-scrolls on send.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
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

  const convo = convoById(id);
  const agent = agentById(convo?.agentId);
  const online = convo?.online ?? false;

  // Local message state so sends append in-session (demo — not persisted).
  const [msgs, setMsgs] = useState<Msg[]>(() => THREAD[id ?? ''] ?? []);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  // Keep the newest message in view on mount, on new content, and after a send.
  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() =>
      scrollRef.current?.scrollToEnd({ animated: true }),
    );
  }, []);

  const send = () => {
    const t = draft.trim();
    if (!t) return;
    setMsgs((prev) => [...prev, { from: 'me', t, at: '9:52' }]);
    setDraft('');
    scrollToEnd();
  };

  const hasText = draft.trim().length > 0;
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
          <Portrait seed={agent?.seed ?? 0} size={40} name={agent?.n ?? 'A'} />
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
          onPress={() => agent && router.push(`/(explorer)/agent/${agent.id}`)}
          style={{ flex: 1, minWidth: 0 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text
              style={{ fontSize: 15, fontWeight: '700', color: EX.color.ink }}
              numberOfLines={1}
            >
              {agent?.n ?? 'Agent'}
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
