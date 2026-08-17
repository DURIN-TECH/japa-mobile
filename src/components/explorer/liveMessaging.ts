// ─────────────────────────────────────────────────────────────────────────────
// Messaging — live backend adapter.
//
// Maps the backend's Conversation/Message records onto the Explorer's demo
// `Convo`/`Msg` shapes so the coral/cream conversations list + chat thread can
// render real data from GET /conversations and GET /conversations/:id/messages.
//
// The backend has no presence signal, so `online` is always false. Relative
// times are rendered compactly (e.g. "3h", "2d") to match the demo's `ago`
// strings; message timestamps use a "h:mm a" clock format.
// ─────────────────────────────────────────────────────────────────────────────

import { agoShort, fmtDate } from './liveDate';
import { Convo, Msg } from './data';
import { Conversation, Message } from '@/types/messaging.type';

// Compact relative time ("3h", "2d"). Kept as a named export for compatibility;
// delegates to the shared, Timestamp-safe `agoShort`.
export function formatDistanceToNowShort(v: unknown): string {
  return agoShort(v);
}

// One backend conversation → the Explorer's Convo row.
export function mapConvo(c: Conversation): Convo {
  return {
    id: c.id,
    agentId: c.agentId,
    agentName: c.agentName,
    last: c.lastMessage ?? '',
    ago: formatDistanceToNowShort(c.lastMessageAt),
    unread: c.unreadCountUser,
    online: false, // backend has no presence signal
  };
}

/**
 * Best-effort display name for an attachment.
 *
 * Attachments are stored as bare URLs, so the filename has to be recovered from
 * the path: drop the query string (signed URLs carry a long one), take the last
 * segment, and percent-decode it. Falls back to a generic label — showing the
 * raw URL in a chat bubble would be unreadable.
 */
export function attachmentFileName(url: string): string {
  try {
    const last = url.split('?')[0].split('/').filter(Boolean).pop();
    return last ? decodeURIComponent(last) : 'Attachment';
  } catch {
    return 'Attachment';
  }
}

// One backend message → the Explorer's chat bubble Msg.
export function mapMessage(m: Message): Msg {
  return {
    from: m.senderType === 'user' ? 'me' : 'agent',
    t: m.content,
    at: fmtDate(m.createdAt, 'h:mm a'),
    // Documents shared on this message. Omitted entirely when there are none so
    // the bubble renders exactly as before.
    files: m.attachmentUrls?.length
      ? m.attachmentUrls.map((url) => ({ url, name: attachmentFileName(url) }))
      : undefined,
  };
}
