// ─────────────────────────────────────────────────────────────────────────────
// Notifications — live backend adapter.
//
// Maps the backend's ApiNotification onto the Explorer's `Notif` shape. The
// backend `type` enum collapses into the Explorer's eight visual `kind`s (which
// drive the IconChip color). Timestamps are ISO strings → a compact relative
// label (we strip date-fns' "about "/"less than " prefixes so it reads like the
// design's terse "2h"/"1d"). For routing we only surface `agentId` on message
// notifications; `destId` is left
// undefined (notifications.tsx routes by the related entity type).
// ─────────────────────────────────────────────────────────────────────────────

import { agoFrom } from './liveDate';
import { Notif } from '@/types/explorer.type';
import { ApiNotification } from '@/hooks/useNotifications';

// Backend `type` → Explorer visual `kind` (drives the IconChip icon + colour).
// One meaning per kind: what happened and whether the applicant must act.
// Unknown types and `system` default to `status`.
export function toKind(type: ApiNotification['type']): Notif['kind'] {
  switch (type) {
    case 'message_received':
      return 'message';
    // A document to upload or fix.
    case 'document_status':
    case 'document_rejected':
    case 'document_check_problems':
    case 'document_check_could_not_check':
      return 'action';
    // Something passed or was approved.
    case 'document_approved':
    case 'document_check_passed':
    case 'identity_verified':
      return 'verified';
    // Money.
    case 'payment_request':
    case 'payment_request_rejected':
    case 'payment_received':
      return 'payment';
    // Changed or failed, needs attention but not a document.
    case 'rule_change_alert':
    case 'identity_verification_failed':
      return 'alert';
    case 'visa_news':
      return 'news';
    default:
      // consultation* (any variant), else status.
      return typeof type === 'string' && type.startsWith('consultation')
        ? 'consult'
        : 'status';
  }
}

// Compact relative time — drop date-fns' verbose qualifiers so "about 2 hours"
// reads closer to the design's "2 hours". The screen appends its own " ago".
function toAgo(iso: unknown): string {
  return agoFrom(iso)
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
    // message entity id; `destId` stays unset (the screen routes by entity type).
    agentId: n.relatedEntityType === 'message' ? n.relatedEntityId : undefined,
  };
}
