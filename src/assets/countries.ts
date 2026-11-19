// ─────────────────────────────────────────────────────────────────────────────
// Country & location imagery — reusable assets module (japa#145).
//
// The backend carries no hero photography, so every live screen that draws a
// country (Explore tiles, the destination hero, tracker rows, the application
// hero, agency covers, flags) dresses it from this one module, keyed by the
// LOWER-CASE ISO2 country code ("gb", "us", …).
//
// This used to be split between `explorer/data.ts` (`IMG`, `flagUrl`, the
// demo `DESTS` art) and `liveExplore.ts` (`COUNTRY_META`). It is presentation
// content, not demo data, so it lives here on its own:
//
//   • countryImage(code, w?)  hero photo URL (default skyline when unknown)
//   • countryFlag(code, w?)   round flag image URL (flagcdn)
//   • countryCity(code)       display city ("London"), '' when unknown
//   • countryTone(code)       dark tonal backdrop shown while a photo loads
//
// Plus the two low-level URL helpers (`IMG`, `flagUrl`) and the agency cover
// pool (`agencyCover`), which is a location image without a country.
//
// Pure module (no React / RN imports) so it is unit-tested directly.
// ─────────────────────────────────────────────────────────────────────────────

// ── Low-level URL helpers ────────────────────────────────────────────────────

/** Unsplash CDN helper: photo id → sized, cropped JPEG URL. */
export const IMG = (id: string, w = 900): string =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

/** flagcdn helper: ISO2 code (any case) → flag PNG URL at width `w`. */
export const flagUrl = (code: string, w = 160): string =>
  `https://flagcdn.com/w${w}/${(code ?? '').toLowerCase()}.png`;

// ── Per-country art ──────────────────────────────────────────────────────────

/** One country's presentation art. */
export interface CountryArt {
  /** Display city used under the country name ("London"). */
  city: string;
  /** Unsplash photo id (see `IMG`). */
  imgId: string;
  /** Dark backdrop tone shown behind / before the photo. */
  tone: string;
}

/**
 * Art per lower-case ISO2 code. These are the exact photos the Explorer
 * showed before this module existed (the old `COUNTRY_META` in
 * liveExplore.ts, which matched the demo `DESTS` art 1:1), so moving them here
 * changes no pixels.
 */
export const COUNTRY_ART: Readonly<Record<string, CountryArt>> = {
  us: {
    city: 'New York',
    imgId: '1496442226666-8d4d0e62e6e9',
    tone: '#2A3A52',
  },
  gb: { city: 'London', imgId: '1513635269975-59663e0ac1ad', tone: '#3A2E38' },
  ca: { city: 'Toronto', imgId: '1517935706615-2717063c2225', tone: '#1F3A44' },
  au: { city: 'Sydney', imgId: '1506973035872-a4ec16b8e8d9', tone: '#244A55' },
  jp: { city: 'Tokyo', imgId: '1540959733332-eab4deabeeaf', tone: '#3A2733' },
  de: { city: 'Berlin', imgId: '1560969184-10fe8719e047', tone: '#2C3540' },
  fr: { city: 'Paris', imgId: '1502602898657-3e91760cbb34', tone: '#34303E' },
  ae: { city: 'Dubai', imgId: '1512453979798-5ea266f8880c', tone: '#403225' },
  ie: { city: 'Dublin', imgId: '1549918864-48ac978761a4', tone: '#1F3A2E' },
  nl: {
    city: 'Amsterdam',
    imgId: '1534351590666-13e3e96b5017',
    tone: '#2C3540',
  },
};

/** Generic skyline for any code not in COUNTRY_ART (e.g. "ng"). */
export const DEFAULT_COUNTRY_IMG_ID = '1500835556837-99ac94a94552';
/** Backdrop tone for any unknown code. */
export const DEFAULT_COUNTRY_TONE = '#2A2740';

/** Normalise any incoming code ("GB", " gb ", undefined) to the lookup key. */
function key(code: string | null | undefined): string {
  return (code ?? '').trim().toLowerCase();
}

/** The art entry for a code, or undefined when the module has none. */
function artFor(code: string | null | undefined): CountryArt | undefined {
  const k = key(code);
  // `hasOwnProperty` so a code like "constructor" can't hit Object.prototype.
  return Object.prototype.hasOwnProperty.call(COUNTRY_ART, k)
    ? COUNTRY_ART[k]
    : undefined;
}

/** Hero photo URL for a country; the default skyline when unknown. */
export function countryImage(code: string | null | undefined, w = 900): string {
  return IMG(artFor(code)?.imgId ?? DEFAULT_COUNTRY_IMG_ID, w);
}

/** Round flag URL for a country (flagcdn has every ISO2 code). */
export function countryFlag(code: string | null | undefined, w = 160): string {
  return flagUrl(key(code), w);
}

/** Display city for a country; '' when the module has none. */
export function countryCity(code: string | null | undefined): string {
  return artFor(code)?.city ?? '';
}

/** Dark backdrop tone for a country; the default tone when unknown. */
export function countryTone(code: string | null | undefined): string {
  return artFor(code)?.tone ?? DEFAULT_COUNTRY_TONE;
}

// ── Agency covers ────────────────────────────────────────────────────────────
// Agencies carry no country or photo, so their hero is picked from a small
// pool of office / city images, deterministically by agency id (the same
// agency always gets the same cover). Moved here from liveAgencies.ts.

const AGENCY_COVER_IDS = [
  '1568515387631-8b650bbcdb90', // modern office lobby
  '1542315192-1f61a1792f33', // city skyline
  '1497366216548-37526070297c', // open-plan office
  '1524758631624-e2822e304c36', // meeting room
] as const;

/** Dark backdrop tones paired with the agency covers. */
const AGENCY_TONES = ['#1F3A44', '#2C3540', '#2A3A52', '#3A2E38'] as const;

/** Stable string → non-negative 32-bit hash (drives cover/tone selection). */
export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Cover photo URL for an agency id (stable per id). */
export function agencyCover(id: string, w = 900): string {
  return IMG(AGENCY_COVER_IDS[hashString(id) % AGENCY_COVER_IDS.length], w);
}

/** Backdrop tone for an agency id (stable per id). */
export function agencyTone(id: string): string {
  return AGENCY_TONES[hashString(id) % AGENCY_TONES.length];
}
