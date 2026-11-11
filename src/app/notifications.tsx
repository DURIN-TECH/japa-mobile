// ─────────────────────────────────────────────────────────────────────────────
// Notifications (prototype messaging.jsx NotificationsView).
// Back header with a "Mark all read" action, then a list of notification rows.
// Each row has a kind-colored IconChip, a title + 2-line body, a relative time,
// and a coral unread dot; unread rows sit on a faint coral tint.
//
// japa#145: live only (GET /notifications), no demo NOTIFS and no local-only
// unread state. Tapping a row marks it read on the backend (PUT
// /notifications/:id/read) and routes to the related entity; a long press
// deletes it (DELETE /notifications/:id). While a write is in flight the row
// shows its new state; if it fails the row goes back to what the server has
// and an InlineError shows at the top. Loading → coral spinner; failed load →
// InlineError + "Try again"; none → "You’re all caught up" (no "Mark all
// read").
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import type { Notif } from '@/types/explorer.type';
import { InlineError } from '@/components/explorer/AccountForm';
import {
  StateEmpty,
  StateError,
  StateLoading,
  loadErrorCopy,
  queryState,
} from '@/components/explorer/states';
import { Ic } from '@/components/explorer/icons';
import { IconChip } from '@/components/explorer/primitives';
// ── Live data (backend) ───────────────────────────────────────────────────────
import {
  useDeleteNotification,
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/hooks/useNotifications';
import { mapNotif } from '@/components/explorer/liveNotifications';

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

  // ── Live notifications → Notif[] ──────────────────────────────────────────
  const notifsQ = useNotifications();
  const state = queryState(notifsQ);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const del = useDeleteNotification();
  const raw = useMemo(() => notifsQ.data ?? [], [notifsQ.data]);
  const items = useMemo(() => raw.map(mapNotif), [raw]);

  // In-flight writes only (never a persisted local state): ids being marked
  // read / deleted show their new state until the refetch lands, and are
  // dropped again on failure so the row returns to the server's state.
  const [pendingRead, setPendingRead] = useState<Record<string, true>>({});
  const [pendingDelete, setPendingDelete] = useState<Record<string, true>>({});
  const [writeError, setWriteError] = useState<string | null>(null);
  const WRITE_ERROR = 'We couldn’t update that notification. Try again.';
  const isUnread = (n: Notif) => n.unread && !pendingRead[n.id];
  const visible = items.filter((n) => !pendingDelete[n.id]);

  const drop = (
    set: React.Dispatch<React.SetStateAction<Record<string, true>>>,
    ids: string[],
  ) =>
    set((prev) => {
      const next = { ...prev };
      ids.forEach((id) => delete next[id]);
      return next;
    });

  const markAllRead = () => {
    const ids = items.filter((n) => n.unread).map((n) => n.id);
    setWriteError(null);
    setPendingRead((prev) => {
      const next = { ...prev };
      ids.forEach((id) => (next[id] = true));
      return next;
    });
    markAll.mutate(undefined, {
      onError: () => {
        drop(setPendingRead, ids);
        setWriteError(WRITE_ERROR);
      },
    });
  };

  // Route by the related entity on the raw backend record.
  const routeFor = (id: string) => {
    const r = raw.find((x) => x.id === id);
    const target = r?.relatedEntityId ?? r?.referenceId;
    switch (r?.relatedEntityType) {
      case 'application':
        return target ? `/application/${target}` : null;
      case 'consultation':
        return target ? `/consultation/${target}` : '/consultations';
      case 'document':
        return '/documents';
      case 'payment_request':
        return '/payments';
      case 'message':
        return '/messages';
      default:
        return null;
    }
  };

  // Mark read on the backend (if unread), then route.
  const openNotif = (n: Notif) => {
    if (isUnread(n)) {
      setWriteError(null);
      setPendingRead((prev) => ({ ...prev, [n.id]: true }));
      markRead.mutate(n.id, {
        onError: () => {
          drop(setPendingRead, [n.id]);
          setWriteError(WRITE_ERROR);
        },
      });
    }
    const to = routeFor(n.id);
    if (to) router.push(to as never);
  };

  // Long press → confirm → delete on the backend.
  const deleteNotif = (n: Notif) => {
    Alert.alert('Delete notification?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setWriteError(null);
          setPendingDelete((prev) => ({ ...prev, [n.id]: true }));
          del.mutate(n.id, {
            onError: () => {
              drop(setPendingDelete, [n.id]);
              setWriteError(WRITE_ERROR);
            },
          });
        },
      },
    ]);
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
        {/* Hidden when there is nothing to mark (empty / loading / error). */}
        {visible.length > 0 ? (
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
        ) : null}
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
        {/* A failed read / delete: row is back as it was, say so. */}
        {writeError ? (
          <View style={{ marginBottom: 8 }}>
            <InlineError message={writeError} />
          </View>
        ) : null}
        {state === 'loading' ? <StateLoading /> : null}
        {state === 'error' ? (
          <StateError
            style={{ paddingHorizontal: 6 }}
            message={loadErrorCopy('your notifications')}
            onRetry={() => notifsQ.refetch()}
            retrying={notifsQ.isRefetching}
          />
        ) : null}
        {state === 'ready' && visible.length === 0 ? (
          <StateEmpty
            icon={Ic.bell}
            title="You’re all caught up"
            body="Updates on your applications, documents and consultations land here."
          />
        ) : null}
        {visible.map((n) => {
          const k = KIND[n.kind];
          const unread = isUnread(n);
          return (
            <Pressable
              key={n.id}
              onPress={() => openNotif(n)}
              onLongPress={() => deleteNotif(n)}
              accessibilityHint="Long press to delete"
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
