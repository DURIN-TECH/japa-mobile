// ─────────────────────────────────────────────────────────────────────────────
// Agent reviews — live backend adapter.
//
// Maps the backend's ApiReview (GET /agents/:id/reviews) onto the Explorer's
// `Review` shape used by the agent-detail "Recent reviews" cards. The backend
// stores no reviewer display name and no avatar art, so we fall back to a
// generic name and derive a stable `seed` from the review id (feeds the
// procedural Portrait). `createdAt` is an ISO string → rendered as a compact
// relative time with date-fns.
// ─────────────────────────────────────────────────────────────────────────────

import { agoFrom } from './liveDate';
import { Review } from './data';
import { ApiReview } from '@/hooks/useAgents';

// Stable string → non-negative 32-bit hash (matches liveAgents.ts). Used to
// pick a deterministic Portrait seed (0–5) from the review id.
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Convert an ApiReview to the Explorer `Review` display shape.
 *
 * - `n`   reviewer display name — backend sends none today, so fall back through
 *         userName → reviewerName → 'Applicant'.
 * - `r`   the numeric 1–5 rating (passthrough).
 * - `ago` compact relative time, e.g. "2 months ago", from the ISO createdAt.
 * - `t`   the review body text (comment).
 * - `seed` deterministic Portrait seed (0–5) hashed from the review id.
 */
export function mapReview(r: ApiReview): Review {
  return {
    id: r.id,
    agentId: r.agentId,
    n: r.userName ?? r.reviewerName ?? 'Applicant',
    seed: hash(r.id) % 6,
    r: r.rating,
    ago: agoFrom(r.createdAt, { addSuffix: true }),
    t: r.comment,
  };
}
