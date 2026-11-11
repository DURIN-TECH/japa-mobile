// ─────────────────────────────────────────────────────────────────────────────
// Conversations (prototype messaging.jsx ConversationsView).
// Simple back-header ("Messages") over a list of conversation rows. Each row is a
// 54px Portrait (with a teal "online" dot), the agent's name + relative time
// (coral when unread), the last message (bold when unread) and a coral unread
// count badge. Tapping a row opens the chat thread.
//
// japa#145: live only (GET /conversations). No demo rows: loading shows the
// coral spinner, a failed load shows InlineError + "Try again", and a user
// with no conversations sees the "No messages yet" empty state.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { Portrait } from '@/components/explorer/primitives';
import { useConversations } from '@/hooks/useMessaging';
import { mapConvo } from '@/components/explorer/liveMessaging';
import {
  StateEmpty,
  StateError,
  StateLoading,
  loadErrorCopy,
  queryState,
} from '@/components/explorer/states';
import { hashString } from '@/assets/countries';

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

  // ── Live conversations (GET /conversations) ──────────────────────────────
  // Backend conversations → the Explorer Convo row shape. `state` follows the
  // shared rule: spinner only on a first load with nothing cached, error only
  // when nothing is cached, otherwise the (possibly empty) rows.
  const convosQ = useConversations();
  const convos = useMemo(
    () => (convosQ.data ?? []).map(mapConvo),
    [convosQ.data],
  );
  const state = queryState(convosQ);

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

      {/* ── Conversation list (or its loading / error / empty state) ───────── */}
      {state === 'loading' ? (
        <StateLoading />
      ) : state === 'error' ? (
        <StateError
          message={loadErrorCopy('your messages')}
          onRetry={() => convosQ.refetch()}
          retrying={convosQ.isRefetching}
        />
      ) : convos.length === 0 ? (
        // First-run empty: the one coral action sends them to the Agents tab.
        <StateEmpty
          icon={Ic.msg}
          title="No messages yet"
          body="When you message an agent, your conversation shows up here."
          action={{
            label: 'Find an agent',
            variant: 'coral',
            onPress: () => router.push('/(tabs)/agents'),
          }}
        />
      ) : (
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
            // Name from the backend-enriched `agentName`; the Portrait seed is
            // derived from the agent id so each agent keeps a stable gradient.
            const name = c.agentName ?? 'Agent';
            const seed = hashString(c.agentId ?? '') % 6;
            const unread = c.unread > 0;
            return (
              <Pressable
                key={c.id}
                onPress={() => router.push(`/messages/${c.id}`)}
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
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
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
      )}
    </View>
  );
}
