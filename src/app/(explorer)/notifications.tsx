// ─────────────────────────────────────────────────────────────────────────────
// Notifications (prototype messaging.jsx NotificationsView).
// Back header with a "Mark all read" action, then a list of notification rows.
// Each row has a kind-colored IconChip, a title + 2-line body, a relative time,
// and a coral unread dot; unread rows sit on a faint coral tint. Tapping a row
// marks it read (local state) and routes to the related application/destination
// or agent chat.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import { NOTIFS, APPS, CONVOS, type Notif } from '@/components/explorer/data';
import { Ic } from '@/components/explorer/icons';
import { IconChip } from '@/components/explorer/primitives';

// Lucide-style icon component signature (size/color/strokeWidth props).
type IconType = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

// Kind → icon + tinted IconChip colors.
const KIND: Record<Notif['kind'], { icon: IconType; fg: string; bg: string }> =
  {
    status: { icon: Ic.gauge, fg: '#2F62A0', bg: '#DCEBF7' }, // blue
    message: { icon: Ic.msg, fg: EX.color.primary, bg: EX.color.primaryTint10 }, // coral — source rgba(244,81,108,0.1)
    action: { icon: Ic.upload, fg: EX.color.amber, bg: '#FCEAC8' }, // amber — source #FCEAC8
    consult: { icon: Ic.cal, fg: EX.color.success, bg: '#D6F2E2' }, // green
  };

export default function NotificationsView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Local unread state (demo — not persisted). Seeded from the static data.
  const [read, setRead] = useState<Record<string, boolean>>({});
  const isUnread = (n: Notif) => n.unread && !read[n.id];

  const markAllRead = () => {
    const all: Record<string, boolean> = {};
    NOTIFS.forEach((n) => {
      all[n.id] = true;
    });
    setRead(all);
  };

  // Mark read, then route by related entity.
  const openNotif = (n: Notif) => {
    setRead((prev) => ({ ...prev, [n.id]: true }));
    if (n.destId) {
      const app = APPS.find((a) => a.destId === n.destId);
      if (app) router.push(`/(explorer)/application/${app.id}`);
      else router.push(`/(explorer)/destination/${n.destId}`);
    } else if (n.agentId) {
      const convo = CONVOS.find((c) => c.agentId === n.agentId);
      if (convo) router.push(`/(explorer)/messages/${convo.id}`);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      {/* ── Back header + Mark all read ───────────────────────────────────── */}
      <View
        style={{
          // Source header: padding '60px 18px 10px', back+title left, Mark-all right.
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
            width: 40, // source: 40px back button
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
        <Text style={[displayText(24, 'semibold'), { flex: 1 }]}>
          Notifications
        </Text>
        <Pressable onPress={markAllRead} hitSlop={8}>
          <Text
            style={{
              color: EX.color.primary,
              fontSize: 13, // source: 13 / 600
              fontWeight: '600',
            }}
          >
            Mark all read
          </Text>
        </Pressable>
      </View>

      {/* ── Notification list ─────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          // Source list: padding '6px 16px 40px', column gap 4.
          paddingHorizontal: 16,
          paddingTop: 6,
          paddingBottom: 40,
          gap: 4,
        }}
      >
        {NOTIFS.map((n) => {
          const k = KIND[n.kind];
          const unread = isUnread(n);
          return (
            <Pressable
              key={n.id}
              onPress={() => openNotif(n)}
              style={{
                // Source row: padding '13px 12px', gap 13, radius 16, unread tint (no separators).
                flexDirection: 'row',
                gap: 13,
                alignItems: 'flex-start',
                paddingHorizontal: 12,
                paddingVertical: 13,
                borderRadius: 16,
                backgroundColor: unread
                  ? EX.color.primaryTint05
                  : 'transparent',
              }}
            >
              <IconChip
                icon={k.icon}
                size={42}
                radius={13}
                bg={k.bg}
                color={k.fg}
                iconSize={20}
              />

              {/* Source: text column reserves paddingRight 14 when the unread dot shows. */}
              <View
                style={{ flex: 1, minWidth: 0, paddingRight: unread ? 14 : 0 }}
              >
                <Text
                  style={{
                    fontSize: 14.5,
                    fontWeight: '700',
                    color: EX.color.ink,
                    lineHeight: 19, // 14.5 × 1.3
                  }}
                  numberOfLines={2}
                >
                  {n.title}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: EX.color.inkMuted, // #5B5468
                    marginTop: 2,
                    lineHeight: 18,
                  }}
                  numberOfLines={1}
                >
                  {n.body}
                </Text>
                <Text
                  style={{
                    fontSize: 11.5,
                    color: EX.color.muted,
                    marginTop: 4,
                    fontWeight: '500',
                  }}
                >
                  {n.ago} ago
                </Text>
              </View>

              {/* Unread dot — source: absolute, top 16 / right 12 */}
              {unread ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 16,
                    right: 12,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: EX.color.primary,
                  }}
                />
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
