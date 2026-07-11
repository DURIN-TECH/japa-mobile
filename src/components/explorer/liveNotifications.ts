// ─────────────────────────────────────────────────────────────────────────────
// Notifications — live backend adapter.
//
// Maps the backend's ApiNotification onto the Explorer's `Notif` shape. The
// backend `type` enum collapses into the Explorer's four visual `kind`s (which
// drive the IconChip color). Timestamps are ISO strings → a compact relative
// label (we strip date-fns' "about "/"less than " prefixes so it reads like the
// demo's terse "2h"/"1d"). For routing we only surface `agentId` on message
// notifications; live entity ids won't match the demo DESTS, so `destId` is left
// undefined (see notifications.tsx for the live routing fallback).
// ─────────────────────────────────────────────────────────────────────────────

import { formatDistanceToNow, parseISO } from 'date-fns';
import { Notif } from './data';
import { ApiNotification } from '@/hooks/useNotifications';

// Backend `type` → Explorer visual `kind`.
function toKind(type: ApiNotification['type']): Notif['kind'] {
  switch (type) {
    case 'application_update':
    case 'document_status':
      return 'status';
    case 'message_received':
      return 'message';
    case 'payment_request':
    case 'payment_request_rejected':
    case 'payment_received':
      return 'action';
    case 'consultation_reminder':
      return 'consult';
    case 'system':
    default:
      return 'status';
  }
}

// Compact relative time — drop date-fns' verbose qualifiers so "about 2 hours"
// reads closer to the demo's "2 hours". The screen appends its own " ago".
function toAgo(iso: string): string {
  return formatDistanceToNow(parseISO(iso))
    .replace(/^about /, '')
    .replace(/^less than /, '');
}

export function mapNotif(n: ApiNotification): Notif {
  return {
    id: n.id,
    unread: !n.isRead,
    ago: toAgo(n.createdAt),
    title: n.title,
    body: n.body ?? n.message ?? '',
    kind: toKind(n.type),
    // Only message notifications get a routing target; the id is the related
    // message entity id. Live ids won't match demo DESTS, so `destId` stays unset.
    agentId: n.relatedEntityType === 'message' ? n.relatedEntityId : undefined,
  };
}
