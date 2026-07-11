// ─────────────────────────────────────────────────────────────────────────────
// Explore — live backend adapter.
//
// Maps the backend's VisaType (+ Country) records onto the Explorer's `Dest`
// shape so the coral/cream Explore grid can render real data from GET /visas and
// GET /countries. The backend has no hero imagery, so we supply a per-country
// photo + tonal fallback (reusing the demo art where the country matches).
// ─────────────────────────────────────────────────────────────────────────────

import { Country } from '@/types/country.type';
import { VisaType, VisaCategory, VisaRequirement } from '@/types/visas.type';
import { Dest, IMG, Req } from './data';

// Per-country presentation metadata: display city, Unsplash hero id, tonal
// fallback colour. Mirrors the demo DESTS art for known countries.
const COUNTRY_META: Record<string, { city: string; imgId: string; tone: string }> = {
  us: { city: 'New York', imgId: '1496442226666-8d4d0e62e6e9', tone: '#2A3A52' },
  gb: { city: 'London', imgId: '1513635269975-59663e0ac1ad', tone: '#3A2E38' },
  ca: { city: 'Toronto', imgId: '1517935706615-2717063c2225', tone: '#1F3A44' },
  au: { city: 'Sydney', imgId: '1506973035872-a4ec16b8e8d9', tone: '#244A55' },
  jp: { city: 'Tokyo', imgId: '1540959733332-eab4deabeeaf', tone: '#3A2733' },
  de: { city: 'Berlin', imgId: '1560969184-10fe8719e047', tone: '#2C3540' },
  fr: { city: 'Paris', imgId: '1502602898657-3e91760cbb34', tone: '#34303E' },
  ae: { city: 'Dubai', imgId: '1512453979798-5ea266f8880c', tone: '#403225' },
  ie: { city: 'Dublin', imgId: '1549918864-48ac978761a4', tone: '#1F3A2E' },
  nl: { city: 'Amsterdam', imgId: '1534351590666-13e3e96b5017', tone: '#2C3540' },
};
const DEFAULT_IMG = '1500835556837-99ac94a94552'; // generic skyline
const DEFAULT_TONE = '#2A2740';

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
  const meta = COUNTRY_META[code];
  return {
    id: v.id,
    country: countryName ?? v.countryCode ?? '—',
    city: meta?.city ?? '',
    flag: code,
    visa: v.name,
    cat: CATEGORY_LABEL[v.category] ?? 'Other',
    blurb: v.description,
    img: IMG(meta?.imgId ?? DEFAULT_IMG),
    tone: meta?.tone ?? DEFAULT_TONE,
    processing: v.processingTime,
    price: Math.round(v.baseCostUsd ?? 0),
    approval: v.successRate != null ? `${v.successRate}%` : '—',
    applied: v.totalApplications ?? 0,
  };
}

function mapVisaToDest(v: VisaType, countryByCode: Map<string, Country>): Dest {
  const country = countryByCode.get(v.countryCode ?? '') ?? countryByCode.get((v.countryCode ?? '').toLowerCase());
  return visaTypeToDest(v, country?.name);
}

// Backend visa requirements → the detail screen's numbered "What you'll need" list.
export function mapRequirements(reqs: VisaRequirement[]): Req[] {
  return reqs
    .slice()
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
    .map((r) => ({ t: r.title, d: r.description, e: r.estimatedTime || 'See details' }));
}

export function mapVisasToDests(visas: VisaType[], countries: Country[]): Dest[] {
  const byCode = new Map<string, Country>();
  countries.forEach((c) => {
    byCode.set(c.code, c);
    byCode.set(c.code.toLowerCase(), c);
  });
  const dests = visas.map((v) => mapVisaToDest(v, byCode));
  // Feature the most-applied route so the grid has a lead tile.
  if (dests.length && !dests.some((d) => d.featured)) {
    let leadIdx = 0;
    dests.forEach((d, i) => { if (d.applied > dests[leadIdx].applied) leadIdx = i; });
    dests[leadIdx] = { ...dests[leadIdx], featured: true };
  }
  return dests;
}
