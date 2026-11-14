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

export function mapVisasToDests(
  visas: VisaType[],
  countries: Country[],
): Dest[] {
  const byCode = new Map<string, Country>();
  countries.forEach((c) => {
    byCode.set(c.code, c);
    byCode.set(c.code.toLowerCase(), c);
  });
  const dests = visas.map((v) => mapVisaToDest(v, byCode));
  // Feature the most-applied route so the grid has a lead tile. Prefer real
  // (scraped) visas: candidates are the scraped ones, or the whole list when
  // none are scraped. Strict `>` keeps the earlier (server-order) one on ties.
  if (dests.length && !dests.some((d) => d.featured)) {
    const scraped = visas
      .map((v, i) => (v.source === 'scraped' ? i : -1))
      .filter((i) => i >= 0);
    const candidates = scraped.length ? scraped : dests.map((_, i) => i);
    let leadIdx = candidates[0];
    candidates.forEach((i) => {
      if (dests[i].applied > dests[leadIdx].applied) leadIdx = i;
    });
    dests[leadIdx] = { ...dests[leadIdx], featured: true };
  }
  return dests;
}
