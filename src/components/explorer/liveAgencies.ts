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

import { Agency, IMG, NAIRA } from './data';
import type { ApiAgency, PublicVisaPrice } from '@/hooks/useAgencies';

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

// ─────────────────────────────────────────────────────────────────────────────
// Agency visas — "Visas they handle" (japa#106).
//
// `visaPrices[]` (see `PublicVisaPrice` in useAgencies.ts) → display rows for
// the agency screen. Rules from the #106 design spec:
//   • price is WHOLE NAIRA: NAIRA(price), never /100; null → "Contact for
//     pricing" with no caption;
//   • sub line "{country name} · {processingTime}" (just the country when
//     there's no processing time);
//   • agency-only visas (visibility "agency") get the "Only with this
//     agency" chip and are NOT tappable: the single-visa endpoints 404 for
//     anyone without a case at that agency (#102). Global ones (including an
//     agency's own visa made global) push /visa/[id].
// Order is kept as the backend returns it (own visas first).
// ─────────────────────────────────────────────────────────────────────────────

/** Chip copy on agency-only visas. */
export const AGENCY_ONLY_CHIP = 'Only with this agency';

/** One row of the agency screen's visas list. */
export interface AgencyVisaRow {
  key: string;
  visaTypeId: string;
  /** Upper-case ISO2 code (route param for /visa/[id]). */
  countryCode: string;
  /** Lower-case ISO2 for `Flag`. */
  flag: string;
  name: string;
  /** "United Kingdom · 3 to 8 weeks" or "United Kingdom". */
  subLine: string;
  /** "₦12,500" or "Contact for pricing". */
  priceLabel: string;
  /** "Service fee" under a price; null when there's no price. */
  priceCaption: string | null;
  /** Shows the AGENCY_ONLY_CHIP. */
  isAgencyOnly: boolean;
  /** Global visas open the visa breakdown; agency-only rows don't. */
  tappable: boolean;
}

/**
 * Defensive read of `visaPrices`: a missing / non-array field is [], rows
 * without a visa id or country are dropped, a non-number (or negative /
 * non-finite) price is null, and an unknown visibility counts as global
 * (the backend treats a missing visibility as global).
 */
export function normalizeVisaPrices(raw: unknown): PublicVisaPrice[] {
  if (!Array.isArray(raw)) return [];
  const out: PublicVisaPrice[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const v = item as Record<string, unknown>;
    if (typeof v.visaTypeId !== 'string' || !v.visaTypeId) continue;
    if (typeof v.countryCode !== 'string' || !v.countryCode) continue;
    const price =
      typeof v.price === 'number' && Number.isFinite(v.price) && v.price >= 0
        ? v.price
        : null;
    out.push({
      ...(v as unknown as PublicVisaPrice),
      visaName: typeof v.visaName === 'string' ? v.visaName : '',
      category: typeof v.category === 'string' ? v.category : '',
      price,
      isAgencyVisa: v.isAgencyVisa === true,
      visibility: v.visibility === 'agency' ? 'agency' : 'global',
      processingTime:
        typeof v.processingTime === 'string' ? v.processingTime : null,
    });
  }
  return out;
}

/**
 * Country name for an ISO2 code: the app's countries list first, then the
 * runtime's `Intl.DisplayNames` (may be missing on Hermes), else the code.
 */
export function countryNameFor(
  code: string,
  countries?: { code: string; name: string }[] | null,
): string {
  const cc = code.toUpperCase();
  const hit = countries?.find((c) => c.code.toUpperCase() === cc)?.name;
  if (hit) return hit;
  try {
    const DisplayNames = (
      Intl as unknown as {
        DisplayNames?: new (
          l: string[],
          o: { type: string },
        ) => { of: (c: string) => string | undefined };
      }
    ).DisplayNames;
    if (DisplayNames) {
      const name = new DisplayNames(['en'], { type: 'region' }).of(cc);
      if (name && name !== cc) return name;
    }
  } catch {
    // Unknown code or no Intl support: fall through to the code.
  }
  return cc;
}

/** `visaPrices[]` → the agency screen's rows (order kept). */
export function mapAgencyVisaRows(
  visaPrices: PublicVisaPrice[],
  countries?: { code: string; name: string }[] | null,
): AgencyVisaRow[] {
  return visaPrices.map((v) => {
    const cc = v.countryCode.toUpperCase();
    const country = countryNameFor(cc, countries);
    const processing = v.processingTime?.trim();
    const hasPrice = typeof v.price === 'number';
    const isAgencyOnly = v.visibility === 'agency';
    return {
      key: `${cc}__${v.visaTypeId}`,
      visaTypeId: v.visaTypeId,
      countryCode: cc,
      flag: cc.toLowerCase(),
      name: v.visaName,
      subLine: processing ? `${country} · ${processing}` : country,
      // Whole naira as-is: NAIRA(12500) → "₦12,500".
      priceLabel: hasPrice ? NAIRA(v.price as number) : 'Contact for pricing',
      priceCaption: hasPrice ? 'Service fee' : null,
      isAgencyOnly,
      tappable: !isAgencyOnly,
    };
  });
}
