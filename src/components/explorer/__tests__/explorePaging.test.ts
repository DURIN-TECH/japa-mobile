// ─────────────────────────────────────────────────────────────────────────────
// Unit tests: Explore paging — turning loaded pages into tiles (japa#341).
//   • duplicates across pages are dropped (country code + visa id)
//   • the featured tile is chosen from page one and stays put
//   • category chips can come from later pages
//   • when to fetch the next page (near the end, category, search, failure)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from '@jest/globals';
import {
  dedupeVisaPages,
  destKey,
  isNearEnd,
  mapVisaPagesToDests,
  shouldLoadNextPage,
  visaKey,
} from '../liveExplore';
import type { VisaType } from '@/types/visas.type';

const visa = (over: Partial<VisaType> = {}): VisaType =>
  ({
    id: 'skilled-worker',
    countryCode: 'GB',
    name: 'Skilled Worker',
    category: 'work',
    description: 'Work in the UK',
    processingTime: '3 weeks',
    baseCostUsd: 700,
    totalApplications: 10,
    isActive: true,
    ...over,
  }) as VisaType;

const countries = [
  { code: 'GB', name: 'United Kingdom' },
  { code: 'IT', name: 'Italy' },
  { code: 'AT', name: 'Austria' },
] as never[];

describe('visa identity', () => {
  it('is country code + visa id, case-insensitive on the code', () => {
    expect(visaKey(visa())).toBe('GB:skilled-worker');
    expect(visaKey(visa({ countryCode: 'gb' }))).toBe('GB:skilled-worker');
    expect(destKey({ flag: 'gb', id: 'skilled-worker' })).toBe(
      'GB:skilled-worker',
    );
  });
});

describe('dedupeVisaPages', () => {
  it('drops a visa already seen on an earlier page, keeping order', () => {
    const p1 = [visa({ id: 'a' }), visa({ id: 'b' })];
    // Data shifted: page two repeats "b" before the new rows.
    const p2 = [visa({ id: 'b' }), visa({ id: 'c' })];
    expect(dedupeVisaPages([p1, p2]).map((v) => v.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps the same visa id in two different countries', () => {
    const out = dedupeVisaPages([
      [visa({ id: 'student', countryCode: 'IT' })],
      [visa({ id: 'student', countryCode: 'AT' })],
    ]);
    expect(out.map(visaKey)).toEqual(['IT:student', 'AT:student']);
  });
});

describe('mapVisaPagesToDests', () => {
  it('maps every loaded page into one list, once each', () => {
    const dests = mapVisaPagesToDests(
      [
        [visa({ id: 'a' }), visa({ id: 'b' })],
        [visa({ id: 'b' }), visa({ id: 'it-1', countryCode: 'IT' })],
      ],
      countries,
    );
    expect(dests.map(destKey)).toEqual(['GB:a', 'GB:b', 'IT:it-1']);
    expect(dests[2].country).toBe('Italy');
  });

  it('keeps the featured tile from page one when page two arrives', () => {
    const p1 = [
      visa({ id: 'a', totalApplications: 5 }),
      visa({ id: 'b', totalApplications: 50 }),
    ];
    // Page two holds a far more applied visa; it must NOT take the lead.
    const p2 = [
      visa({ id: 'big', countryCode: 'AT', totalApplications: 9999 }),
    ];
    const lead = (pages: VisaType[][]) =>
      mapVisaPagesToDests(pages, countries)
        .filter((d) => d.featured)
        .map(destKey);
    expect(lead([p1])).toEqual(['GB:b']);
    expect(lead([p1, p2])).toEqual(['GB:b']);
  });

  it('features nothing when there are no visas', () => {
    expect(mapVisaPagesToDests([], countries)).toEqual([]);
    expect(mapVisaPagesToDests([[]], countries)).toEqual([]);
  });

  it('exposes categories that appear only on a later page', () => {
    const dests = mapVisaPagesToDests(
      [
        [visa({ id: 'a' })],
        [visa({ id: 'it-s', countryCode: 'IT', category: 'student' })],
      ],
      countries,
    );
    expect(new Set(dests.map((d) => d.cat))).toEqual(
      new Set(['Work', 'Study']),
    );
  });
});

describe('isNearEnd', () => {
  it('is true within the threshold of the bottom', () => {
    expect(
      isNearEnd({
        offsetY: 1500,
        viewportHeight: 800,
        contentHeight: 2800,
        threshold: 600,
      }),
    ).toBe(true);
    expect(
      isNearEnd({
        offsetY: 0,
        viewportHeight: 800,
        contentHeight: 2800,
        threshold: 600,
      }),
    ).toBe(false);
  });

  it('is true when the content is too short to scroll', () => {
    expect(
      isNearEnd({ offsetY: 0, viewportHeight: 800, contentHeight: 500 }),
    ).toBe(true);
  });
});

describe('shouldLoadNextPage', () => {
  const base = {
    searchMode: false,
    hasNextPage: true,
    isFetching: false,
    nextPageFailed: false,
    category: 'All',
    nearEnd: true,
  };

  it('loads near the end of the "All" grid', () => {
    expect(shouldLoadNextPage(base)).toBe(true);
    expect(shouldLoadNextPage({ ...base, nearEnd: false })).toBe(false);
  });

  it('sends nothing once everything is loaded', () => {
    expect(shouldLoadNextPage({ ...base, hasNextPage: false })).toBe(false);
    expect(
      shouldLoadNextPage({ ...base, hasNextPage: false, category: 'Work' }),
    ).toBe(false);
  });

  it('keeps loading with a category chip, without scrolling', () => {
    expect(
      shouldLoadNextPage({ ...base, category: 'Study', nearEnd: false }),
    ).toBe(true);
  });

  it('never loads browse pages while searching', () => {
    expect(shouldLoadNextPage({ ...base, searchMode: true })).toBe(false);
    expect(
      shouldLoadNextPage({ ...base, searchMode: true, category: 'Work' }),
    ).toBe(false);
  });

  it('waits while a fetch is in flight, and after a failure', () => {
    expect(shouldLoadNextPage({ ...base, isFetching: true })).toBe(false);
    // After a failed page only "Try again" retries, so it never loops.
    expect(shouldLoadNextPage({ ...base, nextPageFailed: true })).toBe(false);
    expect(
      shouldLoadNextPage({ ...base, nextPageFailed: true, category: 'Work' }),
    ).toBe(false);
  });
});
