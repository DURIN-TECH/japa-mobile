// ─────────────────────────────────────────────────────────────────────────────
// Unit tests: Explore paging — the next-offset / stop rule (japa#341).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from '@jest/globals';
import { EXPLORE_PAGE_SIZE, nextVisaOffset } from '../visaPaging';

/** A page of `n` placeholder visas with the server's reported `total`. */
const page = (n: number, total: number) => ({
  visaTypes: Array.from({ length: n }, (_, i) => ({ id: `v${i}` })),
  total,
});

describe('nextVisaOffset', () => {
  it('never asks for more than 60 per request', () => {
    expect(EXPLORE_PAGE_SIZE).toBe(60);
  });

  it('starts at offset 0 before any page is loaded', () => {
    expect(nextVisaOffset([])).toBe(0);
  });

  it('asks for the next page from the number already loaded', () => {
    // Dev today: total 68 → page one is 60, page two starts at 60.
    expect(nextVisaOffset([page(60, 68)])).toBe(60);
    expect(nextVisaOffset([page(60, 200), page(60, 200)])).toBe(120);
  });

  it('stops once the loaded count reaches total', () => {
    expect(nextVisaOffset([page(60, 68), page(8, 68)])).toBeUndefined();
    expect(nextVisaOffset([page(60, 60)])).toBeUndefined();
    expect(nextVisaOffset([page(0, 0)])).toBeUndefined();
  });

  it('stops on an empty page even if total says there is more', () => {
    expect(nextVisaOffset([page(60, 90), page(0, 90)])).toBeUndefined();
  });

  it('uses the newest total when it changes between pages', () => {
    // A visa was added after page one: keep going to the new total.
    expect(nextVisaOffset([page(60, 68), page(8, 69)])).toBe(68);
    // Visas were removed: the new total is already reached.
    expect(nextVisaOffset([page(60, 68), page(5, 65)])).toBeUndefined();
  });

  it('counts raw rows, not de-duplicated ones, so overlap never loops', () => {
    // Page two overlaps page one (same ids); offset still moves on to 120.
    expect(nextVisaOffset([page(60, 200), page(60, 200)])).toBe(120);
  });

  it('treats a page without visaTypes as empty instead of throwing', () => {
    expect(nextVisaOffset([{ total: 68 } as never])).toBeUndefined();
    expect(
      nextVisaOffset([page(60, 68), { total: 68 } as never]),
    ).toBeUndefined();
  });
});
