// ─────────────────────────────────────────────────────────────────────────────
// Agencies — live backend adapter.
//
// Maps the backend's `PublicAgency` (ApiAgency) onto the Explorer's richer
// `Agency` shape. The backend model is deliberately lean — it has NO
// city/cover/rating/reviewCount/successRate/badges/flag — so we synthesise the
// visual fields here:
//   • `cover`  → a deterministic Unsplash office/city photo chosen by an id hash
//   • `tone`   → a deterministic dark backdrop tone chosen by the same hash
//   • `flag`   → always 'ng' (the model carries no country; Nigeria market)
// Agency-level rating/reviews/success are NOT on the model (all 0 here); the
// detail screen computes them live from the agency's agents instead.
//
// Consultation fees are in kobo/cents on the backend (not needed by `Agency`).
// ─────────────────────────────────────────────────────────────────────────────

import { Agency, IMG } from './data';
import type { ApiAgency } from '@/hooks/useAgencies';

// Deterministic FNV-ish string hash → stable per-agency art selection.
export function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Small pool of office / city cover images (Unsplash ids via `IMG`).
const COVERS = [
  IMG('1568515387631-8b650bbcdb90'), // modern office lobby
  IMG('1542315192-1f61a1792f33'), // city skyline
  IMG('1497366216548-37526070297c'), // open-plan office
  IMG('1524758631624-e2822e304c36'), // meeting room
];

// Small pool of dark backdrop tones (matches the demo agencies' palette).
const TONES = ['#1F3A44', '#2C3540', '#2A3A52', '#3A2E38'];

/**
 * Extract the founding year from a `PublicAgency.createdAt`, which may be an
 * ISO string OR a Firestore Timestamp serialized to `{ _seconds }`. Returns 0
 * when the value is missing/epoch so the caller can decide how to render.
 */
function estYear(createdAt: ApiAgency['createdAt']): number {
  if (typeof createdAt === 'string') {
    const y = new Date(createdAt).getFullYear();
    return Number.isNaN(y) ? 0 : y;
  }
  const seconds = createdAt?._seconds ?? 0;
  if (!seconds) return 0;
  return new Date(seconds * 1000).getFullYear();
}

export function mapAgency(p: ApiAgency): Agency {
  const h = hash(p.id);
  return {
    id: p.id,
    name: p.name,
    city: p.state ?? '',
    flag: 'ng', // no country on the model — default to the Nigeria market
    est: estYear(p.createdAt),
    agents: p.agentCount ?? 0,
    r: 0, // no agency-level rating — detail screen derives from agents
    rev: 0, // no agency-level review count
    succ: 0, // no agency-level success rate
    verified: !!p.verified,
    cover: COVERS[h % COVERS.length],
    tone: TONES[h % TONES.length],
    blurb: p.description ?? '',
    badges: p.verified ? ['Compliance verified'] : [],
  };
}
