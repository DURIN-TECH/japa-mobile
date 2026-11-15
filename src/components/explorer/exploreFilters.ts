// ─────────────────────────────────────────────────────────────────────────────
// Explore filters — the pure rules behind the filter sheet (japa#347).
//
// ONE piece of state drives everything filter-related on Explore:
//
//   filters = { categories: string[], countries: string[] }
//
//   • categories: display labels ("Work", "Study", … from CATEGORY_LABEL in
//     liveExplore.ts), the same strings the category chips show. The chips and
//     the sheet both read and write this list, so they can never disagree:
//     chip "All" is selected exactly when `categories` is empty.
//   • countries: uppercase ISO2 codes ("CA", "IE").
//
// Matching: choices WITHIN a group widen the results (Work OR Study), and the
// two groups narrow each other (… AND in Canada). An empty group means "any".
//
// The state lives in memory on the Explore screen only (not saved), so it
// resets when the app restarts. Everything here is free of React and the
// network so it is unit tested in `__tests__/exploreFilters.test.ts`.
// ─────────────────────────────────────────────────────────────────────────────

import { CATEGORY_LABEL } from './liveExplore';
import { COUNTRY_ALIASES, normalizeQuery } from '@/utils/countrySearch';
import type { Country } from '@/types/country.type';
import type { Dest } from '@/types/explorer.type';
import type { VisaCategory } from '@/types/visas.type';
// Type only (no runtime import): the plan shape the fetch hook takes.
import type { FilteredVisasPlan } from '@/hooks/useVisaTypes';

// ── State ────────────────────────────────────────────────────────────────────

export interface ExploreFilters {
  /** Category display labels, e.g. ["Work", "Study"]. Empty = any. */
  categories: string[];
  /** Uppercase ISO2 country codes, e.g. ["CA"]. Empty = any. */
  countries: string[];
}

/** No filters on: Explore behaves exactly as the plain paged grid (#341). */
export const EMPTY_FILTERS: ExploreFilters = { categories: [], countries: [] };

/** The label of the chip that clears the categories. */
export const ALL_CHIP = 'All';

/** "Filter count": drives the dot, the "Filters · N" chip and a11y labels. */
export function filterCount(f: ExploreFilters): number {
  return f.categories.length + f.countries.length;
}

export function hasFilters(f: ExploreFilters): boolean {
  return filterCount(f) > 0;
}

/** "Clear filters" / "Clear all": empties BOTH groups. */
export function clearFilters(): ExploreFilters {
  return { categories: [], countries: [] };
}

/** Add the item when absent, remove it when present (order kept). */
function toggle(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

/** A category chip in the sheet: add or remove that category. */
export function toggleCategory(
  f: ExploreFilters,
  label: string,
): ExploreFilters {
  return { ...f, categories: toggle(f.categories, label) };
}

/**
 * A tap on one of Explore's category chips (orchestrator decision 1):
 *   • "All" clears the categories (countries are untouched);
 *   • any other chip adds itself, or removes itself when already chosen.
 * So Work then Study leaves both on, the same multi-select the sheet makes.
 */
export function tapCategoryChip(
  f: ExploreFilters,
  chip: string,
): ExploreFilters {
  if (chip === ALL_CHIP) return { ...f, categories: [] };
  return toggleCategory(f, chip);
}

/** Is this chip drawn selected? "All" only when no category is chosen. */
export function isChipSelected(f: ExploreFilters, chip: string): boolean {
  return chip === ALL_CHIP
    ? f.categories.length === 0
    : f.categories.includes(chip);
}

/** A country row in the sheet: add or remove that country (stored uppercase). */
export function toggleCountry(f: ExploreFilters, code: string): ExploreFilters {
  return { ...f, countries: toggle(f.countries, code.toUpperCase()) };
}

// ── Matching ─────────────────────────────────────────────────────────────────

/**
 * Does one tile match? OR inside a group, AND across groups; an empty group
 * matches everything. `Dest.flag` is the lowercase country code.
 */
export function matchesFilters(d: Dest, f: ExploreFilters): boolean {
  const catOk = f.categories.length === 0 || f.categories.includes(d.cat);
  const countryOk =
    f.countries.length === 0 ||
    f.countries.includes((d.flag ?? '').toUpperCase());
  return catOk && countryOk;
}

/** Narrow a list of tiles (browse or search results) to the filters. */
export function applyFilters<T extends Dest>(
  list: T[],
  f: ExploreFilters,
): T[] {
  if (!hasFilters(f)) return list;
  return list.filter((d) => matchesFilters(d, f));
}

// ── Category options ─────────────────────────────────────────────────────────

/**
 * Explore's chip row: "All", then every category seen in the loaded data (in
 * data order), then any CHOSEN category not seen yet (so a chosen chip never
 * disappears, e.g. a category picked from the sheet that is not on page one).
 */
export function chipCategories(seen: string[], chosen: string[]): string[] {
  const out: string[] = [];
  for (const c of [...seen, ...chosen]) if (!out.includes(c)) out.push(c);
  return [ALL_CHIP, ...out.filter((c) => c !== ALL_CHIP)];
}

/** The sheet's "Visa type" options: the chip list without "All". */
export function sheetCategories(seen: string[], chosen: string[]): string[] {
  return chipCategories(seen, chosen).slice(1);
}

/**
 * Every category label the app knows, in CATEGORY_LABEL order. The sheet
 * falls back to this before any visa has loaded, so it is never empty.
 */
export const ALL_CATEGORY_LABELS: string[] = Object.values(CATEGORY_LABEL);

/** Display label → backend category ("Study" → "student"); unknown → null. */
export function labelToCategory(label: string): VisaCategory | null {
  const hit = (Object.keys(CATEGORY_LABEL) as VisaCategory[]).find(
    (k) => CATEGORY_LABEL[k] === label,
  );
  return hit ?? null;
}

// ── What to fetch for a filtered browse grid ─────────────────────────────────

/**
 * The browse list is paged (#341), so filtering only the loaded pages would
 * hide matches that sit on later pages. A filtered grid instead fetches the
 * COMPLETE set of candidates from endpoints that already narrow on the server
 * (no backend change), then `applyFilters` does the exact match:
 *
 *   • any country chosen → `GET /countries/:code/visas` per country: every
 *     visible visa of that country, unpaged. The category group (if any) is
 *     applied on the client. Cheaper than the category route: one country
 *     read each, where `GET /visas` reads every country per request.
 *   • only categories chosen → `GET /visas?category=…` per category, every
 *     page of 60 until `total`.
 *   • nothing chosen → 'none': the plain paged grid, exactly as after #341.
 */
export type FilterFetchPlan = FilteredVisasPlan;

export function filterFetchPlan(f: ExploreFilters): FilterFetchPlan {
  if (f.countries.length) {
    return { kind: 'countries', codes: [...f.countries].sort() };
  }
  if (f.categories.length) {
    const categories = f.categories
      .map(labelToCategory)
      .filter((c): c is VisaCategory => c !== null);
    // Sorted so the same choice in another order shares the cache entries.
    return { kind: 'categories', categories: [...new Set(categories)].sort() };
  }
  return { kind: 'none' };
}

// ── Country list in the sheet ────────────────────────────────────────────────

/** One country row in the sheet. */
export interface SheetCountry {
  /** Uppercase ISO2. */
  code: string;
  name: string;
  visaTypesCount: number;
}

/**
 * The sheet's country rows: countries with at least one visa, A–Z by name,
 * with the ones chosen WHEN THE SHEET OPENED listed first (A–Z among
 * themselves). The caller computes this once per opening, so a tap only
 * changes a row's look and rows never jump under the finger.
 */
export function orderSheetCountries(
  countries: Pick<Country, 'code' | 'name' | 'visaTypesCount'>[],
  chosenAtOpen: string[],
): SheetCountry[] {
  const chosen = new Set(chosenAtOpen.map((c) => c.toUpperCase()));
  const rows = countries
    .filter((c) => (c.visaTypesCount ?? 0) > 0)
    .map((c) => ({
      code: c.code.toUpperCase(),
      name: c.name,
      visaTypesCount: c.visaTypesCount,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [
    ...rows.filter((r) => chosen.has(r.code)),
    ...rows.filter((r) => !chosen.has(r.code)),
  ];
}

/**
 * The sheet's "Search countries" box: case-insensitive name match (as
 * `CountryPickerList`), plus the ISO code ("ie") and the app's aliases
 * ("UK", "USA"). Keeps the given order. Empty query → every row.
 */
export function searchSheetCountries(
  rows: SheetCountry[],
  query: string,
): SheetCountry[] {
  const q = normalizeQuery(query);
  if (!q) return rows;
  const alias = COUNTRY_ALIASES[q];
  return rows.filter(
    (r) =>
      normalizeQuery(r.name).includes(q) ||
      r.code.toLowerCase() === q ||
      (!!alias && r.code === alias),
  );
}

// ── Copy ─────────────────────────────────────────────────────────────────────

/** Strings from the design spec's copy table (curly quotes as written). */
export const FILTER_COPY = {
  filters: 'Filters',
  clearSearch: 'Clear search',
  closeFilters: 'Close filters',
  visaType: 'Visa type',
  country: 'Country',
  searchCountries: 'Search countries',
  clearAll: 'Clear all',
  showVisas: 'Show visas',
  clearFilters: 'Clear filters',
  noCountries: (q: string) => `No countries match “${q}”`,
  emptyBrowseTitle: 'No visas match these filters',
  emptyBrowseBody: 'Try fewer filters, or clear them to see every destination.',
  emptySearchTitle: (q: string) => `No visas match “${q}” with these filters`,
  emptySearchBody: 'Try fewer filters, or clear them to see every match.',
} as const;

/** Filter button / chip a11y: "Filters" or "Filters, 3 on". */
export function filterA11yLabel(n: number): string {
  return n > 0 ? `Filters, ${n} on` : 'Filters';
}

/** Search-mode chip label: "Filters" or "Filters · 3". */
export function filterChipLabel(n: number): string {
  return n > 0 ? `Filters · ${n}` : 'Filters';
}

/** Group count next to "Visa type" / "Country": "2 chosen", or '' for 0. */
export function chosenLabel(n: number): string {
  return n > 0 ? `${n} chosen` : '';
}

/** Country row sub-line: "1 visa" / "8 visas". */
export function visaCountLabel(n: number): string {
  return n === 1 ? '1 visa' : `${n} visas`;
}

/** Search results line: "1 result for “uk”" / "12 results for “uk”". */
export function resultsLine(n: number, query: string): string {
  return `${n} result${n === 1 ? '' : 's'} for “${query}”`;
}

/** "a" · "a and b" · "a, b and c". */
function joinAnd(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * The browse summary line, e.g. "Showing Work and Study visas in 3 countries".
 *   category part: none → "visas"; 1+ → "Work visas" / "Work and Study
 *   visas" / "Work, Study and Family visas";
 *   country part: none → ""; 1 → " in Canada"; 2 → " in Canada and
 *   Ireland"; 3+ → " in 3 countries".
 * `nameOf` turns a code into a country name; an unknown code (countries not
 * loaded yet) falls back to the code itself rather than dropping it.
 */
export function summaryLine(
  f: ExploreFilters,
  nameOf: (code: string) => string | undefined,
): string {
  const cats = f.categories.length ? `${joinAnd(f.categories)} visas` : 'visas';
  let where = '';
  if (f.countries.length >= 3) {
    where = ` in ${f.countries.length} countries`;
  } else if (f.countries.length) {
    where = ` in ${joinAnd(f.countries.map((c) => nameOf(c) ?? c))}`;
  }
  return `Showing ${cats}${where}`;
}
