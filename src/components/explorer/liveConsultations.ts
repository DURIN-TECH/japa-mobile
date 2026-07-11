// ─────────────────────────────────────────────────────────────────────────────
// Consultations — live backend adapter.
//
// Maps the backend's ApiConsultation onto the Explorer's `Consult` shape. The
// backend has 7 granular statuses (the UI groups them into upcoming/completed/
// cancelled), stores the date + time as separate ISO/HH:mm strings, and has no
// "mode" concept (we default to Video call). Fees are in kobo but unused by the
// Consult card. We also carry the denormalized `agentName` through so live
// agents that aren't in the demo AGENTS list still render a name.
// ─────────────────────────────────────────────────────────────────────────────

import { format } from 'date-fns';
import { fmtDate } from './liveDate';
import { Consult } from './data';
import { ApiConsultation } from '@/hooks/useConsultations';

// Backend status (7 values) → the Explorer's 3-bucket display status.
function mapStatus(s: ApiConsultation['status']): Consult['status'] {
  switch (s) {
    case 'scheduled':
    case 'confirmed':
    case 'pending_payment':
    case 'in_progress':
      return 'upcoming';
    case 'completed':
      return 'completed';
    case 'cancelled':
    case 'no_show':
      return 'cancelled';
    default:
      return 'upcoming';
  }
}

// Backend consultation type → human-readable topic label.
const TYPE_LABEL: Record<ApiConsultation['type'], string> = {
  initial: 'Initial consultation',
  document_review: 'Document review',
  interview_prep: 'Interview prep',
  follow_up: 'Follow-up',
  general: 'General consultation',
};

// Format an "HH:mm" 24-hour string into "h:mm a" (e.g. "10:30" → "10:30 AM").
// Builds a throwaway Date and lets date-fns handle the AM/PM formatting.
function formatTime(hhmm: string): string {
  const [h, m] = (hhmm ?? '').split(':').map((n) => parseInt(n, 10));
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return format(d, 'h:mm a');
}

// One backend consultation → the Explorer's Consult.
export function mapConsult(c: ApiConsultation): Consult {
  return {
    id: c.id,
    agentId: c.agentId,
    agentName: c.agentName,
    status: mapStatus(c.status),
    date: fmtDate(c.scheduledDate, 'EEE, MMM d'),
    time: formatTime(c.scheduledTime),
    // Backend has no meeting-mode concept → default to Video call.
    mode: 'Video call',
    topic: TYPE_LABEL[c.type] ?? 'General consultation',
    dur: `${c.durationMinutes} min`,
    notes: c.notes,
    summary: c.summary,
  };
}
