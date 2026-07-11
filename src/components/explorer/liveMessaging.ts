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

import { formatDistanceToNow, format, parseISO } from 'date-fns';
import { Convo, Msg } from './data';
import { Conversation, Message } from '@/types/messaging.type';

// ── Compact relative time ────────────────────────────────────────────────────
// date-fns `formatDistanceToNow` yields verbose strings ("about 3 hours ago").
// The demo `ago` field is terse ("3h", "2d"), so we compress the common units
// to a single-letter suffix and fall back to the raw distance for anything else.
export function formatDistanceToNowShort(iso: string): string {
  if (!iso) return '';
  let base: string;
  try {
    base = formatDistanceToNow(parseISO(iso)); // e.g. "about 3 hours", "2 days"
  } catch {
    return '';
  }
  const m = base.match(/(\d+)\s+(second|minute|hour|day|week|month|year)/);
  if (!m) return base.includes('less than a minute') ? 'now' : base;
  const n = m[1];
  const unit = m[2];
  const suffix: Record<string, string> = {
    second: 's',
    minute: 'm',
    hour: 'h',
    day: 'd',
    week: 'w',
    month: 'mo',
    year: 'y',
  };
  return `${n}${suffix[unit] ?? ''}`;
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

// One backend message → the Explorer's chat bubble Msg.
export function mapMessage(m: Message): Msg {
  return {
    from: m.senderType === 'user' ? 'me' : 'agent',
    t: m.content,
    at: format(parseISO(m.createdAt), 'h:mm a'),
  };
}
