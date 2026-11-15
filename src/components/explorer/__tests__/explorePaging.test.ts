// ─────────────────────────────────────────────────────────────────────────────
// Unit tests: Explore paging — turning loaded pages into tiles (japa#341).
//   • duplicates across pages are dropped (country code + visa id)
//   • the featured tile is chosen from page one and stays put
//   • category chips can come from later pages
//   • when to fetch the next page, per trigger (scroll / content size /
//     layout / effect): the review's no-scroll cases never load page two
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from '@jest/globals';
import {
  dedupeVisaPages,
  destKey,
  isNearEnd,
  type LoadTrigger,
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

  it('is false while unmeasured (zero viewport or content height)', () => {
    expect(
      isNearEnd({ offsetY: 0, viewportHeight: 800, contentHeight: 0 }),
    ).toBe(false);
    expect(
      isNearEnd({ offsetY: 0, viewportHeight: 0, contentHeight: 500 }),
    ).toBe(false);
  });
});

describe('shouldLoadNextPage', () => {
  // A long, measured grid scrolled to the top: NOT near the end.
  const top = { offsetY: 0, viewportHeight: 800, contentHeight: 6000 };
  // The same grid scrolled to the bottom.
  const bottom = { offsetY: 5200, viewportHeight: 800, contentHeight: 6000 };
  // Content height left over from the first-load spinner / search results:
  // shorter than the viewport, so it reads as "at the end".
  const stale = { offsetY: 0, viewportHeight: 800, contentHeight: 300 };
  const base = {
    trigger: 'scroll' as LoadTrigger,
    searchMode: false,
    hasNextPage: true,
    isFetching: false,
    nextPageFailed: false,
    category: 'All',
    metrics: bottom,
  };

  it('loads near the end of the "All" grid on scroll / content size', () => {
    expect(shouldLoadNextPage(base)).toBe(true);
    expect(shouldLoadNextPage({ ...base, trigger: 'contentSize' })).toBe(true);
    expect(shouldLoadNextPage({ ...base, metrics: top })).toBe(false);
  });

  it('"All": a grid that really is too short to scroll loads on', () => {
    // The content-size event carries the CURRENT content's height.
    expect(
      shouldLoadNextPage({ ...base, trigger: 'contentSize', metrics: stale }),
    ).toBe(true);
  });

  // The three review cases (japa#341): page two must NOT load with "All" and
  // no scrolling.
  it('"All", first load: the effect ignores the spinner-era height', () => {
    expect(
      shouldLoadNextPage({ ...base, trigger: 'effect', metrics: stale }),
    ).toBe(false);
  });

  it('"All", clearing a search: the effect ignores the results height', () => {
    // Search mode just ended; metrics still hold the short results list.
    expect(
      shouldLoadNextPage({
        ...base,
        trigger: 'effect',
        searchMode: false,
        metrics: stale,
      }),
    ).toBe(false);
  });

  it('"All", mount with a cached page: layout with no content height', () => {
    const unmeasured = { offsetY: 0, viewportHeight: 800, contentHeight: 0 };
    expect(
      shouldLoadNextPage({ ...base, trigger: 'layout', metrics: unmeasured }),
    ).toBe(false);
    expect(
      shouldLoadNextPage({ ...base, trigger: 'effect', metrics: unmeasured }),
    ).toBe(false);
    // Even a content-size event without a viewport yet does not load.
    expect(
      shouldLoadNextPage({
        ...base,
        trigger: 'contentSize',
        metrics: { offsetY: 0, viewportHeight: 0, contentHeight: 3000 },
      }),
    ).toBe(false);
  });

  it('"All": layout / effect never load, even at the bottom', () => {
    expect(shouldLoadNextPage({ ...base, trigger: 'layout' })).toBe(false);
    expect(shouldLoadNextPage({ ...base, trigger: 'effect' })).toBe(false);
  });

  it('a category chip keeps loading from the effect, without scrolling', () => {
    (['effect', 'layout', 'scroll', 'contentSize'] as LoadTrigger[]).forEach(
      (trigger) =>
        expect(
          shouldLoadNextPage({
            ...base,
            trigger,
            category: 'Study',
            metrics: top,
          }),
        ).toBe(true),
    );
  });

  it('sends nothing once everything is loaded', () => {
    expect(shouldLoadNextPage({ ...base, hasNextPage: false })).toBe(false);
    expect(
      shouldLoadNextPage({
        ...base,
        trigger: 'effect',
        hasNextPage: false,
        category: 'Work',
      }),
    ).toBe(false);
  });

  it('never loads browse pages while searching', () => {
    expect(shouldLoadNextPage({ ...base, searchMode: true })).toBe(false);
    expect(
      shouldLoadNextPage({
        ...base,
        trigger: 'effect',
        searchMode: true,
        category: 'Work',
      }),
    ).toBe(false);
  });

  it('waits while a fetch is in flight, and after a failure', () => {
    expect(shouldLoadNextPage({ ...base, isFetching: true })).toBe(false);
    // After a failed page only "Try again" retries, so it never loops.
    expect(shouldLoadNextPage({ ...base, nextPageFailed: true })).toBe(false);
    expect(
      shouldLoadNextPage({
        ...base,
        trigger: 'effect',
        nextPageFailed: true,
        category: 'Work',
      }),
    ).toBe(false);
  });
});
