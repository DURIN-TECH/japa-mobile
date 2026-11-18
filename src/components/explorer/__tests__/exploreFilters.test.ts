// ─────────────────────────────────────────────────────────────────────────────
// Unit tests: Explore filters (japa#347).
//   • category OR within the group, AND across groups (country)
//   • filters applied to search results
//   • "Clear filters" empties both groups
//   • the chips and the sheet share ONE category state
//   • what a filtered grid fetches, country rows, copy
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from '@jest/globals';
import {
  ALL_CHIP,
  EMPTY_FILTERS,
  applyFilters,
  chipCategories,
  chosenLabel,
  clearFilters,
  filterA11yLabel,
  filterChipLabel,
  filterCount,
  filterFetchPlan,
  isChipSelected,
  labelToCategory,
  matchesFilters,
  orderSheetCountries,
  resultsLine,
  searchSheetCountries,
  ALL_CATEGORY_LABELS,
  OTHER_LABEL,
  headerControls,
  summaryLine,
  tapCategoryChip,
  toggleCategory,
  toggleCountry,
  visaCountLabel,
  type ExploreFilters,
} from '../exploreFilters';
import { visaTypeToDest } from '../liveExplore';
import type { Dest } from '@/types/explorer.type';
import type { VisaType } from '@/types/visas.type';

/** A tile as the screen holds it (only the fields filters read matter). */
const dest = (id: string, cat: string, flag: string): Dest =>
  ({ id, cat, flag, country: flag }) as Dest;

const tiles: Dest[] = [
  dest('ca-work', 'Work', 'ca'),
  dest('ca-study', 'Study', 'ca'),
  dest('ca-family', 'Family', 'ca'),
  dest('ie-work', 'Work', 'ie'),
  dest('ie-study', 'Study', 'ie'),
  dest('gb-work', 'Work', 'gb'),
  dest('gb-tourist', 'Tourist', 'gb'),
];
const ids = (l: Dest[]) => l.map((d) => d.id);
const f = (categories: string[], countries: string[] = []): ExploreFilters => ({
  categories,
  countries,
});

describe('matching: OR within a group, AND across groups', () => {
  it('no filters keeps every tile, in order (Explore as after #341)', () => {
    expect(applyFilters(tiles, EMPTY_FILTERS)).toBe(tiles);
  });

  it('one category keeps only that category', () => {
    expect(ids(applyFilters(tiles, f(['Work'])))).toEqual([
      'ca-work',
      'ie-work',
      'gb-work',
    ]);
  });

  it('two categories widen: Work OR Study', () => {
    expect(ids(applyFilters(tiles, f(['Work', 'Study'])))).toEqual([
      'ca-work',
      'ca-study',
      'ie-work',
      'ie-study',
      'gb-work',
    ]);
  });

  it('two countries widen: Canada OR Ireland', () => {
    expect(ids(applyFilters(tiles, f([], ['CA', 'IE'])))).toEqual([
      'ca-work',
      'ca-study',
      'ca-family',
      'ie-work',
      'ie-study',
    ]);
  });

  it('across groups they narrow: (Work OR Study) AND in Canada', () => {
    expect(ids(applyFilters(tiles, f(['Work', 'Study'], ['CA'])))).toEqual([
      'ca-work',
      'ca-study',
    ]);
  });

  it('a combination nothing matches gives an empty list', () => {
    expect(applyFilters(tiles, f(['Tourist'], ['IE']))).toEqual([]);
  });

  it('country codes match case-insensitively against the tile flag', () => {
    expect(matchesFilters(dest('x', 'Work', 'ca'), f([], ['CA']))).toBe(true);
    expect(matchesFilters(dest('x', 'Work', 'CA'), f([], ['CA']))).toBe(true);
  });
});

describe('filters applied to search results', () => {
  // Search results are mapped from GET /visas/search + matched countries'
  // visas with the same visaTypeToDest, then narrowed by the same rule.
  const visa = (id: string, category: string, countryCode: string) =>
    ({ id, category, countryCode, name: id, description: '' }) as VisaType;
  const results = [
    visa('skilled', 'work', 'GB'),
    visa('student', 'student', 'GB'),
    visa('critical-skills', 'work', 'IE'),
  ].map((v) => visaTypeToDest(v));

  it('keeps only matching search results, so the count is filtered too', () => {
    const filtered = applyFilters(results, f(['Work'], ['GB']));
    expect(ids(filtered)).toEqual(['skilled']);
    expect(resultsLine(filtered.length, 'skill')).toBe('1 result for “skill”');
  });

  it('Study chip label matches the backend "student" category', () => {
    expect(ids(applyFilters(results, f(['Study'])))).toEqual(['student']);
  });
});

describe('"Clear filters" empties both groups', () => {
  it('returns no categories and no countries', () => {
    expect(clearFilters()).toEqual({ categories: [], countries: [] });
    expect(filterCount(clearFilters())).toBe(0);
  });

  it('returns a fresh object (never the shared constant)', () => {
    expect(clearFilters()).not.toBe(EMPTY_FILTERS);
  });
});

describe('chips and sheet share one category state', () => {
  it('choosing Work in the sheet selects the Work chip, not "All"', () => {
    const s = toggleCategory(EMPTY_FILTERS, 'Work');
    expect(isChipSelected(s, 'Work')).toBe(true);
    expect(isChipSelected(s, ALL_CHIP)).toBe(false);
  });

  it('a chip tap is what the sheet sees: same list', () => {
    const s = tapCategoryChip(EMPTY_FILTERS, 'Study');
    expect(s.categories).toEqual(['Study']);
    // The sheet opens on a copy of this; its chip shows selected.
    expect(s.categories.includes('Study')).toBe(true);
  });

  it('chip taps add and remove (Work then Study keeps both)', () => {
    let s = tapCategoryChip(EMPTY_FILTERS, 'Work');
    s = tapCategoryChip(s, 'Study');
    expect(s.categories).toEqual(['Work', 'Study']);
    expect(isChipSelected(s, 'Work')).toBe(true);
    expect(isChipSelected(s, 'Study')).toBe(true);
    s = tapCategoryChip(s, 'Work');
    expect(s.categories).toEqual(['Study']);
  });

  it('removing the last category selects "All" again', () => {
    const s = tapCategoryChip(f(['Work']), 'Work');
    expect(s.categories).toEqual([]);
    expect(isChipSelected(s, ALL_CHIP)).toBe(true);
  });

  it('"All" clears the categories and leaves countries alone', () => {
    const s = tapCategoryChip(f(['Work', 'Study'], ['CA']), ALL_CHIP);
    expect(s).toEqual({ categories: [], countries: ['CA'] });
    expect(isChipSelected(s, ALL_CHIP)).toBe(true);
  });

  it('a chosen category not in the loaded data still gets its chip', () => {
    expect(chipCategories(['Work', 'Study'], ['Investor'])).toEqual([
      ALL_CHIP,
      'Work',
      'Study',
      'Investor',
    ]);
    expect(chipCategories(['Work', 'Work'], ['Work'])).toEqual([
      ALL_CHIP,
      'Work',
    ]);
  });

  it('countries toggle in their own group, stored uppercase', () => {
    let s = toggleCountry(EMPTY_FILTERS, 'ca');
    s = toggleCountry(s, 'IE');
    expect(s.countries).toEqual(['CA', 'IE']);
    expect(toggleCountry(s, 'Ca').countries).toEqual(['IE']);
    expect(filterCount(f(['Work'], ['CA', 'IE']))).toBe(3);
  });
});

describe('what a filtered grid fetches (every match, not loaded pages)', () => {
  it('no filters: nothing extra (the plain paged grid)', () => {
    expect(filterFetchPlan(EMPTY_FILTERS)).toEqual({ kind: 'none' });
  });

  it('any country: that country’s full list, category matched locally', () => {
    expect(filterFetchPlan(f(['Work'], ['IE', 'CA']))).toEqual({
      kind: 'countries',
      codes: ['CA', 'IE'],
    });
  });

  it('only categories: the backend categories, de-duplicated and sorted', () => {
    expect(filterFetchPlan(f(['Work', 'Study', 'Work']))).toEqual({
      kind: 'categories',
      categories: ['student', 'work'],
    });
  });

  it('"Other" fetches the whole list, so missing / unknown categories match', () => {
    expect(OTHER_LABEL).toBe('Other');
    expect(filterFetchPlan(f(['Work', 'Other']))).toEqual({ kind: 'all' });
    // With a country chosen, the country list already holds them all.
    expect(filterFetchPlan(f(['Other'], ['CA']))).toEqual({
      kind: 'countries',
      codes: ['CA'],
    });
    // The grid's own label for a missing / unknown category is "Other", and
    // the client match keeps it.
    const odd = visaTypeToDest({
      id: 'x',
      countryCode: 'CA',
      category: 'unknown-kind',
      name: 'x',
      description: '',
    } as unknown as VisaType);
    const none = visaTypeToDest({
      id: 'y',
      countryCode: 'CA',
      name: 'y',
      description: '',
    } as unknown as VisaType);
    expect(ids(applyFilters([odd, none], f(['Other'])))).toEqual(['x', 'y']);
  });

  it('maps labels back to backend categories', () => {
    expect(labelToCategory('Study')).toBe('student');
    expect(labelToCategory('Tourist')).toBe('tourist');
    expect(labelToCategory('Nope')).toBeNull();
  });
});

describe('sheet "Visa type" options', () => {
  it('are every category, whatever the browse pages hold', () => {
    expect(ALL_CATEGORY_LABELS).toEqual([
      'Work',
      'Study',
      'Tourist',
      'Business',
      'Family',
      'Investor',
      'Transit',
      'Other',
    ]);
  });
});

describe('header controls follow the "x", not search mode', () => {
  it('empty field: filter button + category chips', () => {
    expect(headerControls('')).toEqual({
      clearButton: false,
      filterButton: true,
      filtersChip: false,
      categoryChips: true,
    });
  });

  it('one character (not yet search mode): "x" AND the Filters chip', () => {
    const c = headerControls('c');
    expect(c.clearButton).toBe(true);
    expect(c.filterButton).toBe(false);
    expect(c.filtersChip).toBe(true);
    expect(c.categoryChips).toBe(false);
  });

  it('search mode: same as typing', () => {
    expect(headerControls('can')).toEqual(headerControls('c'));
    // Spaces still show the "x", so the chip shows too.
    expect(headerControls(' ').filtersChip).toBe(true);
  });
});

describe('sheet country rows', () => {
  const countries = [
    { code: 'ie', name: 'Ireland', visaTypesCount: 3 },
    { code: 'CA', name: 'Canada', visaTypesCount: 8 },
    { code: 'GB', name: 'United Kingdom', visaTypesCount: 1 },
    { code: 'ZZ', name: 'Nowhere', visaTypesCount: 0 },
    { code: 'AT', name: 'Austria', visaTypesCount: 2 },
  ];

  it('drops countries without visas, sorts A–Z, chosen first', () => {
    const rows = orderSheetCountries(countries, ['ie', 'CA']);
    expect(rows.map((r) => r.code)).toEqual(['CA', 'IE', 'AT', 'GB']);
  });

  it('searches by name, code and alias, keeping the order', () => {
    const rows = orderSheetCountries(countries, []);
    expect(searchSheetCountries(rows, 'AN').map((r) => r.code)).toEqual([
      'CA',
      'IE',
    ]);
    expect(searchSheetCountries(rows, 'uk').map((r) => r.code)).toEqual(['GB']);
    expect(searchSheetCountries(rows, 'at').map((r) => r.code)).toEqual(['AT']);
    expect(searchSheetCountries(rows, '  ')).toBe(rows);
    expect(searchSheetCountries(rows, 'xyzzy')).toEqual([]);
  });
});

describe('copy', () => {
  const names: Record<string, string> = {
    CA: 'Canada',
    IE: 'Ireland',
    GB: 'United Kingdom',
  };
  const nameOf = (c: string) => names[c];

  it('summary line follows the spec rules', () => {
    expect(summaryLine(f(['Work']), nameOf)).toBe('Showing Work visas');
    expect(summaryLine(f([], ['CA']), nameOf)).toBe('Showing visas in Canada');
    expect(summaryLine(f(['Work', 'Study'], ['CA', 'IE']), nameOf)).toBe(
      'Showing Work and Study visas in Canada and Ireland',
    );
    expect(
      summaryLine(f(['Work', 'Study', 'Family'], ['CA', 'IE', 'GB']), nameOf),
    ).toBe('Showing Work, Study and Family visas in 3 countries');
    // Unknown name (countries not loaded yet): the code, never dropped.
    expect(summaryLine(f([], ['XX']), nameOf)).toBe('Showing visas in XX');
  });

  it('button, chip, counts and results lines', () => {
    expect(filterA11yLabel(0)).toBe('Filters');
    expect(filterA11yLabel(3)).toBe('Filters, 3 on');
    expect(filterChipLabel(0)).toBe('Filters');
    expect(filterChipLabel(3)).toBe('Filters · 3');
    expect(chosenLabel(0)).toBe('');
    expect(chosenLabel(2)).toBe('2 chosen');
    expect(visaCountLabel(1)).toBe('1 visa');
    expect(visaCountLabel(8)).toBe('8 visas');
    expect(resultsLine(12, 'uk')).toBe('12 results for “uk”');
  });
});
