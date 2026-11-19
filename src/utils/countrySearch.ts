// ─────────────────────────────────────────────────────────────────────────────
// Country search (japa#254).
//
// Pure helpers that let the Explore search box resolve what the user typed to
// one or more countries — by name, common alias, or ISO code — so the screen can
// show that country's visas next to the visas matched by name.
//
// Kept free of React / network so it is trivially unit-testable. The alias list
// lives in ONE place (COUNTRY_ALIASES) below.
// ─────────────────────────────────────────────────────────────────────────────

import type { Country } from '@/types/country.type';
import type { VisaType } from '@/types/visas.type';

/**
 * Common aliases → ISO 3166-1 alpha-2 code. Keys are already normalised
 * (see `normalizeQuery`): lower-case, no dots, single spaces.
 * Add new aliases here only.
 */
export const COUNTRY_ALIASES: Record<string, string> = {
  uk: 'GB',
  britain: 'GB',
  'great britain': 'GB',
  england: 'GB',
  us: 'US',
  usa: 'US',
  america: 'US',
};

/**
 * Max countries a single query may resolve to. Each matched country costs one
 * `GET /countries/:code/visas` call, so a very short prefix ("un") can't fan
 * out into dozens of requests.
 */
export const MAX_COUNTRY_MATCHES = 5;

/** Lower-case, strip dots ("U.K." → "uk"), collapse whitespace. */
export function normalizeQuery(q: string): string {
  return q.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Resolve a search query to matching countries (from the already-loaded list).
 * A country matches when:
 *  - the query is an alias for its code ("UK", "Britain", "USA" …), or
 *  - the query equals its ISO code, case-insensitive ("gb", "IE"), or
 *  - its name, or any word in its name, starts with the query ("ire", "kingdom").
 * Needs ≥ 2 characters, like the visa-name search. Returns [] otherwise.
 *
 * Word-prefix (not plain "contains") is deliberate: "us" must not match
 * Austria / Russia / Australia.
 */
export function matchCountries(query: string, countries: Country[]): Country[] {
  const q = normalizeQuery(query);
  if (q.length < 2) return [];

  const aliasCode = COUNTRY_ALIASES[q];

  const matches = countries.filter((c) => {
    const code = c.code.toLowerCase();
    if (aliasCode && code === aliasCode.toLowerCase()) return true;
    if (code === q) return true;
    const name = normalizeQuery(c.name);
    return name.startsWith(q) || name.split(' ').some((w) => w.startsWith(q));
  });

  return matches.slice(0, MAX_COUNTRY_MATCHES);
}

/**
 * Merge visas matched by name with the visas of the matched countries, never
 * listing a visa twice (de-duplicated by id). Name matches come first.
 */
export function mergeSearchVisas(
  nameMatches: VisaType[],
  countryVisas: VisaType[],
): VisaType[] {
  const seen = new Set<string>();
  const out: VisaType[] = [];
  for (const v of [...nameMatches, ...countryVisas]) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    out.push(v);
  }
  return out;
}
