// ─────────────────────────────────────────────────────────────────────────────
// Conversations (prototype messaging.jsx ConversationsView).
// Simple back-header ("Messages") over a list of conversation rows. Each row is a
// 54px Portrait (with a teal "online" dot), the agent's name + relative time
// (coral when unread), the last message (bold when unread) and a coral unread
// count badge. Tapping a row opens the chat thread.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import { CONVOS, agentById } from '@/components/explorer/data';
import { Ic } from '@/components/explorer/icons';
import { Portrait } from '@/components/explorer/primitives';
import { useConversations } from '@/hooks/useMessaging';
import { mapConvo } from '@/components/explorer/liveMessaging';

// ── Portrait + teal presence dot ─────────────────────────────────────────────
// The prototype overlays a small teal circle (white-ringed) on the avatar's
// bottom-right when the agent is online.
function AvatarWithDot({
  seed,
  name,
  size = 54,
  online,
}: {
  seed: number;
  name: string;
  size?: number;
  online: boolean;
}) {
  const dot = Math.round(size * 0.26); // ≈14 for a 54px avatar
  return (
    <View style={{ width: size, height: size }}>
      <Portrait seed={seed} size={size} name={name} />
      {online ? (
        <View
          style={{
            position: 'absolute',
            right: 1, // source: right 1, bottom 1
            bottom: 1,
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: EX.color.teal,
            borderWidth: 2.5,
            borderColor: EX.color.bg,
          }}
        />
      ) : null}
    </View>
  );
}

export default function ConversationsView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── Live conversations with demo fallback ────────────────────────────────
  // Map backend conversations onto the demo Convo shape; render live rows when
  // the query returns any, otherwise fall back to the demo CONVOS so the list
  // is never empty when the backend is empty/unreachable.
  const { data } = useConversations();
  const live = useMemo(() => (data ?? []).map(mapConvo), [data]);
  const convos = live.length ? live : CONVOS;

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      {/* ── Back header ───────────────────────────────────────────────────── */}
      <View
        style={{
          // Source header: padding '60px 18px 10px' → insets.top offset + 18px sides.
          paddingTop: insets.top + 8,
          paddingHorizontal: 18,
          paddingBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={{
            width: 40, // source: 40px circular back button
            height: 40,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: EX.color.line10,
            backgroundColor: '#fff',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ic.chevL size={21} color={EX.color.ink} strokeWidth={1.8} />
        </Pressable>
        <Text style={displayText(24, 'semibold')}>Messages</Text>
      </View>

      {/* ── Conversation list ─────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          // Source list: padding '8px 16px 40px', column gap 4.
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 40,
          gap: 4,
        }}
      >
        {convos.map((c) => {
          // Resolve the agent's name + portrait seed from the demo roster when
          // available (richer art), else fall back to the backend-enriched
          // agentName and a neutral seed for live conversations.
          const a = agentById(c.agentId);
          const name = a?.n ?? c.agentName ?? 'Agent';
          const seed = a?.seed ?? 0;
          const unread = c.unread > 0;
          return (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/(explorer)/messages/${c.id}`)}
              style={{
                // Source row: padding '12px 10px', gap 13, radius 16 (no separators).
                flexDirection: 'row',
                alignItems: 'center',
                gap: 13,
                paddingVertical: 12,
                paddingHorizontal: 10,
                borderRadius: 16,
              }}
            >
              <AvatarWithDot seed={seed} name={name} online={c.online} />

              <View style={{ flex: 1, minWidth: 0 }}>
                {/* name + time */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 3,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15.5, // source: name 15.5 / 700
                      fontWeight: '700',
                      color: EX.color.ink,
                    }}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      // Source: unread weight 700 / else 500; coral when unread.
                      fontWeight: unread ? '700' : '500',
                      color: unread ? EX.color.primary : EX.color.muted,
                      marginLeft: 8,
                    }}
                  >
                    {c.ago}
                  </Text>
                </View>

                {/* last message + unread badge */}
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 13.5,
                      lineHeight: 18,
                      color: unread ? EX.color.ink2 : EX.color.muted,
                      fontWeight: unread ? '600' : '400',
                    }}
                    numberOfLines={1}
                  >
                    {c.last}
                  </Text>
                  {unread ? (
                    <View
                      style={{
                        minWidth: 20,
                        height: 20,
                        borderRadius: 10,
                        paddingHorizontal: 6,
                        backgroundColor: EX.color.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          color: '#fff',
                          fontSize: 11.5, // source: badge text 11.5 / 700
                          fontWeight: '700',
                        }}
                      >
                        {c.unread}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
