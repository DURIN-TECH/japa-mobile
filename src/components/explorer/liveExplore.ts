// ─────────────────────────────────────────────────────────────────────────────
// Explore — live backend adapter.
//
// Maps the backend's VisaType (+ Country) records onto the Explorer's `Dest`
// shape so the coral/cream Explore grid can render real data from GET /visas and
// GET /countries. The backend has no hero imagery, so the per-country photo +
// tonal fallback come from the assets module `@/assets/countries`.
// ─────────────────────────────────────────────────────────────────────────────

import { Dest, Req } from '@/types/explorer.type';
import { countryCity, countryImage, countryTone } from '@/assets/countries';
import { Country } from '@/types/country.type';
import { VisaType, VisaCategory, VisaRequirement } from '@/types/visas.type';

// Per-country art (city, hero photo, tone) lives in the reusable assets
// module `@/assets/countries` (japa#145); this adapter only looks it up.

// Backend visa category → the Explorer's short display label.
const CATEGORY_LABEL: Record<VisaCategory, string> = {
  work: 'Work',
  student: 'Study',
  tourist: 'Tourist',
  business: 'Business',
  family: 'Family',
  investor: 'Investor',
  transit: 'Transit',
  other: 'Other',
};

// One backend visa → the Explorer's Dest (country name resolved by the caller).
export function visaTypeToDest(v: VisaType, countryName?: string): Dest {
  const code = (v.countryCode ?? '').toLowerCase();
  return {
    id: v.id,
    country: countryName ?? v.countryCode ?? '—',
    city: countryCity(code),
    flag: code,
    visa: v.name,
    cat: CATEGORY_LABEL[v.category] ?? 'Other',
    blurb: v.description,
    img: countryImage(code),
    tone: countryTone(code),
    processing: v.processingTime,
    price: Math.round(v.baseCostUsd ?? 0),
    approval: v.successRate != null ? `${v.successRate}%` : '—',
    applied: v.totalApplications ?? 0,
  };
}

function mapVisaToDest(v: VisaType, countryByCode: Map<string, Country>): Dest {
  const country =
    countryByCode.get(v.countryCode ?? '') ??
    countryByCode.get((v.countryCode ?? '').toLowerCase());
  return visaTypeToDest(v, country?.name);
}

// Backend visa requirements → the detail screen's numbered "What you'll need" list.
export function mapRequirements(reqs: VisaRequirement[]): Req[] {
  return reqs
    .slice()
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
    .map((r) => ({
      t: r.title,
      d: r.description,
      e: r.estimatedTime || 'See details',
    }));
}

// Per-country presentation (city + hero image + tone) for building a Dest from
// records that aren't a VisaType (e.g. an Application row).
export function countryArt(code: string): {
  city: string;
  img: string;
  tone: string;
} {
  // Thin wrapper over the assets module, kept for the existing call sites.
  return {
    city: countryCity(code),
    img: countryImage(code),
    tone: countryTone(code),
  };
}

function countryLookup(countries: Country[]): Map<string, Country> {
  const byCode = new Map<string, Country>();
  countries.forEach((c) => {
    byCode.set(c.code, c);
    byCode.set(c.code.toLowerCase(), c);
  });
  return byCode;
}

/**
 * Index of the lead (featured) visa in `visas`, or -1 for an empty list.
 * Feature the most-applied route so the grid has a lead tile. Prefer real
 * (scraped) visas: candidates are the scraped ones, or the whole list when
 * none are scraped. Strict `>` keeps the earlier (server-order) one on ties.
 */
export function pickLeadIndex(visas: VisaType[]): number {
  if (!visas.length) return -1;
  const scraped = visas
    .map((v, i) => (v.source === 'scraped' ? i : -1))
    .filter((i) => i >= 0);
  const candidates = scraped.length ? scraped : visas.map((_, i) => i);
  const applied = (i: number) => visas[i].totalApplications ?? 0;
  let leadIdx = candidates[0];
  candidates.forEach((i) => {
    if (applied(i) > applied(leadIdx)) leadIdx = i;
  });
  return leadIdx;
}

export function mapVisasToDests(
  visas: VisaType[],
  countries: Country[],
): Dest[] {
  const byCode = countryLookup(countries);
  const dests = visas.map((v) => mapVisaToDest(v, byCode));
  if (dests.length && !dests.some((d) => d.featured)) {
    const leadIdx = pickLeadIndex(visas);
    dests[leadIdx] = { ...dests[leadIdx], featured: true };
  }
  return dests;
}

// ── Paged Explore list (japa#341) ────────────────────────────────────────────
//
// The Explore grid now loads GET /visas in pages of 60 (see
// `src/hooks/visaPaging.ts`). Three rules turn those pages into tiles:
//   1. a visa is identified by country code + visa id (ids are only unique
//      within a country's subcollection);
//   2. a visa shows once, even if two pages overlap because the data changed
//      between requests (the first sighting wins, keeping server order);
//   3. the featured (big) tile is chosen from page ONE only, so it never jumps
//      to another visa when a later page arrives.

/** Stable identity of a visa across pages: `GB:skilled-worker`. */
export function visaKey(v: Pick<VisaType, 'countryCode' | 'id'>): string {
  return `${(v.countryCode ?? '').toUpperCase()}:${v.id}`;
}

/** Same identity for a mapped tile (`Dest.flag` is the lowercase code). */
export function destKey(d: Pick<Dest, 'flag' | 'id'>): string {
  return `${(d.flag ?? '').toUpperCase()}:${d.id}`;
}

/** Flatten pages in order, dropping any visa already seen on an earlier page. */
export function dedupeVisaPages(pages: VisaType[][]): VisaType[] {
  const seen = new Set<string>();
  const out: VisaType[] = [];
  pages.forEach((page) =>
    page.forEach((v) => {
      const k = visaKey(v);
      if (seen.has(k)) return;
      seen.add(k);
      out.push(v);
    }),
  );
  return out;
}

/**
 * All loaded pages → the grid's tiles: de-duplicated, in server order, with
 * the featured flag on the lead visa of page one (rule 3 above). If that visa
 * somehow is not in the list (it cannot be, as page one is always first) no
 * tile is featured and the screen falls back to the first tile, as before.
 */
export function mapVisaPagesToDests(
  pages: VisaType[][],
  countries: Country[],
): Dest[] {
  const byCode = countryLookup(countries);
  const visas = dedupeVisaPages(pages);
  const first = pages[0] ?? [];
  const leadIdx = pickLeadIndex(first);
  const leadKey = leadIdx >= 0 ? visaKey(first[leadIdx]) : null;
  return visas.map((v) => {
    const d = mapVisaToDest(v, byCode);
    return leadKey && visaKey(v) === leadKey ? { ...d, featured: true } : d;
  });
}

/**
 * Pixels from the bottom at which the next page is requested. A grid tile is
 * about 214px tall plus a 13px row gap, so 600px is roughly two and a half
 * rows: the next page is usually in before the user reaches the end.
 */
export const LOAD_MORE_THRESHOLD = 600;

/** The ScrollView measurements the near-end check needs. */
export interface ScrollMetrics {
  offsetY: number;
  viewportHeight: number;
  contentHeight: number;
}

/**
 * Is the scroll position "near the end" of the content? Also true when the
 * content is shorter than the viewport (nothing to scroll), so a short list
 * still pulls the next page without the user scrolling.
 *
 * Unmeasured counts as NOT near the end (review of japa#341): a zero viewport
 * or zero content height means no layout has been reported yet, and
 * `0 + viewport >= 0 - threshold` would otherwise read as "at the bottom".
 */
export function isNearEnd(m: ScrollMetrics & { threshold?: number }): boolean {
  if (m.viewportHeight <= 0 || m.contentHeight <= 0) return false;
  const threshold = m.threshold ?? LOAD_MORE_THRESHOLD;
  return m.offsetY + m.viewportHeight >= m.contentHeight - threshold;
}

/**
 * What asked the screen to consider loading the next page:
 *   • 'effect'      — paging state / chip / search changed (a React effect);
 *   • 'scroll'      — the user scrolled (fresh offset + sizes in the event);
 *   • 'contentSize' — the content was re-laid out (fresh content height);
 *   • 'layout'      — the viewport itself was laid out.
 */
export type LoadTrigger = 'effect' | 'scroll' | 'contentSize' | 'layout';

/**
 * Should Explore fetch the next page right now? (japa#341)
 *
 *   • never while searching (search has its own endpoints), when nothing is
 *     left (`hasNextPage` false, i.e. loaded >= total or an empty page), while
 *     any fetch is in flight (a later page or a pull-to-refresh), or after the
 *     next page failed: then the footer's "Try again" is the only way to
 *     retry, so a failure never loops;
 *   • with a category chip selected: on ANY trigger, until `total` is
 *     reached. The server has no category order, so the only way to know we
 *     have EVERY visa of that category is to load every page; and a short
 *     filtered list may not scroll at all, so the effect (which runs again
 *     each time a page lands) keeps it going without the user scrolling;
 *   • with "All": only from a 'scroll' or 'contentSize' event, and only near
 *     the end of MEASURED content. Never from the 'effect' or 'layout'
 *     triggers. Those run with the content height from the PREVIOUS content
 *     (the first-load spinner, the search results, or 0 on a mount with a
 *     cached first page), which would read as "near the end" and load page
 *     two with no scrolling. A content-size event always carries the height
 *     of the content now on screen, so a grid that really is too short to
 *     scroll still loads on.
 */
export function shouldLoadNextPage(s: {
  trigger: LoadTrigger;
  searchMode: boolean;
  hasNextPage: boolean;
  isFetching: boolean;
  nextPageFailed: boolean;
  category: string;
  metrics: ScrollMetrics;
}): boolean {
  if (s.searchMode || !s.hasNextPage) return false;
  if (s.isFetching || s.nextPageFailed) return false;
  if (s.category !== 'All') return true;
  if (s.trigger !== 'scroll' && s.trigger !== 'contentSize') return false;
  return isNearEnd(s.metrics);
}
