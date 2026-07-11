// ─────────────────────────────────────────────────────────────────────────────
// Agents — live backend adapter.
//
// Maps the backend's ApiAgent onto the Explorer's `Agent` shape. The backend has
// no avatar art, so we derive a stable `seed`/`tone` from the id (feeds the
// procedural Portrait + the agent-detail tonal header). Consultation fees are
// stored in kobo/cents → divide by 100 for the ₦ display value.
// ─────────────────────────────────────────────────────────────────────────────

import { ApiAgent } from '@/hooks/useAgents';
import { Agent } from './data';

// Tonal header palette (dark) — chosen deterministically by seed.
const TONES = ['#2A3A52', '#3A2E38', '#244A55', '#3A2733', '#2C3540', '#34303E'];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function mapAgent(a: ApiAgent): Agent {
  const seed = hash(a.id) % 6;
  const role = a.agencyRole === 'owner' ? 'Founder' : a.agencyRole ? 'Agent' : 'Independent';
  return {
    id: a.id,
    n: a.displayName,
    spec: a.specializations?.[0] ?? 'Visa specialist',
    agencyId: a.agencyId ?? '',
    role,
    r: a.rating ?? 0,
    rev: a.totalReviews ?? 0,
    succ: a.successRate ?? 0,
    apps: a.totalApplications ?? 0,
    years: a.yearsOfExperience ?? 0,
    fee: Math.round((a.consultationFee ?? 0) / 100),
    resp: a.responseTime ?? '—',
    seed,
    tone: TONES[seed],
    avail: !!a.isAvailable,
    langs: a.languages ?? [],
    specs: a.specializations ?? [],
    bio: a.bio ?? '',
  };
}
