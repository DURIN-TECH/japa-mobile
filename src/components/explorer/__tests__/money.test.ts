// ─────────────────────────────────────────────────────────────────────────────
// The one money formatter set (japa#183, content.ts).
//
// Pins: each currency's own decimals (NGN kobo, USD cents, a zero-decimal
// currency), the "about $X" dollar line, and that an unavailable quote falls
// back to the dollar price only (never ₦0, never a crash). None of these
// helpers takes a rate.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from '@jest/globals';
import {
  aboutUsd,
  formatLocalQuote,
  formatMoney,
  minorUnitFactor,
  priceInline,
  priceParts,
  usdCents,
} from '../content';
import type { LocalPriceQuote } from '@/types/money.type';

/** A read quote as GET /agents returns it. */
const quote = (
  amountMinor: number | null,
  currency = 'NGN',
): LocalPriceQuote =>
  amountMinor === null
    ? { amountMinor: null, currency, rate: null, asOf: null, available: false }
    : {
        amountMinor,
        currency,
        rate: 1353.97,
        asOf: '2026-11-13T00:00:00Z',
        available: true,
      };

describe('formatMoney', () => {
  it('NGN: kobo → naira with 2 decimals and thousands separators', () => {
    expect(formatMoney({ amountMinor: 5_000_000, currency: 'NGN' })).toBe(
      '₦50,000.00',
    );
    expect(formatMoney({ amountMinor: 4_738_940, currency: 'NGN' })).toBe(
      '₦47,389.40',
    );
  });

  it('USD: cents → dollars', () => {
    expect(formatMoney({ amountMinor: 3500, currency: 'USD' })).toBe('$35.00');
    expect(formatMoney({ amountMinor: 5, currency: 'USD' })).toBe('$0.05');
    // A 5,000,000-cent case cost is $50,000, not $5,000,000.
    expect(formatMoney({ amountMinor: 5_000_000, currency: 'USD' })).toBe(
      '$50,000.00',
    );
  });

  it('a zero-decimal currency prints its minor unit as the major unit', () => {
    expect(formatMoney({ amountMinor: 50000, currency: 'UGX' })).toBe(
      'USh50,000',
    );
    expect(minorUnitFactor('UGX')).toBe(1);
    expect(minorUnitFactor('NGN')).toBe(100);
  });

  it('whole: rounds half up to major units for indicative prices', () => {
    expect(
      formatMoney({ amountMinor: 4_738_950, currency: 'NGN' }, { whole: true }),
    ).toBe('₦47,390');
    expect(
      formatMoney({ amountMinor: 4_738_940, currency: 'NGN' }, { whole: true }),
    ).toBe('₦47,389');
  });

  it('an unknown code uses its ISO code, never ₦', () => {
    expect(formatMoney({ amountMinor: 1250, currency: 'abc' })).toBe(
      'ABC 12.50',
    );
  });

  it('null / malformed gives an empty string', () => {
    expect(formatMoney(null)).toBe('');
    expect(formatMoney(undefined)).toBe('');
    expect(formatMoney({ amountMinor: NaN, currency: 'NGN' } as never)).toBe(
      '',
    );
  });
});

describe('aboutUsd / usdCents', () => {
  it('formats the dollar side as whole "about $X"', () => {
    expect(aboutUsd({ amountMinor: 3500, currency: 'USD' })).toBe('about $35');
    expect(aboutUsd(usdCents(3550))).toBe('about $36');
    expect(aboutUsd(null)).toBeNull();
    expect(usdCents(undefined)).toBeNull();
  });
});

describe('formatLocalQuote', () => {
  it('formats an available quote', () => {
    expect(formatLocalQuote(quote(5_000_000))).toBe('₦50,000.00');
  });
  it('is null for available:false or a null quote', () => {
    expect(formatLocalQuote(quote(null))).toBeNull();
    expect(formatLocalQuote(null)).toBeNull();
  });
});

describe('priceParts', () => {
  const usd = { amountMinor: 3500, currency: 'USD' };

  it('local primary, "about $" secondary on a read', () => {
    const p = priceParts(quote(4_738_940), usd);
    expect(p.primary).toBe('₦47,389');
    expect(p.secondary).toBe('about $35');
    expect(priceInline(p)).toBe('₦47,389 · about $35');
  });

  it('locked: exact local + exact dollars, no "about"', () => {
    const p = priceParts({ amountMinor: 4_738_940, currency: 'NGN' }, usd, {
      locked: true,
    });
    expect(priceInline(p)).toBe('₦47,389.40 · $35.00');
  });

  it('available:false → dollar price only, flagged, no error', () => {
    const p = priceParts(quote(null), usd);
    expect(p.primary).toBe('$35.00');
    expect(p.secondary).toBeNull();
    expect(p.localUnavailable).toBe(true);
  });

  it('a null quote with a dollar price → dollar price only', () => {
    const p = priceParts(null, usd);
    expect(p.primary).toBe('$35.00');
    expect(p.localUnavailable).toBe(false);
  });

  it('a USD viewer sees "$35.00" with no second line', () => {
    const p = priceParts(quote(3500, 'USD'), usd);
    expect(priceInline(p)).toBe('$35.00');
  });

  it('$0 reads Free; a null price is Free only when asked', () => {
    expect(
      priceParts(quote(0), { amountMinor: 0, currency: 'USD' }).primary,
    ).toBe('Free');
    expect(priceParts(null, null, { freeWhenNoUsd: true }).free).toBe(true);
    expect(priceParts(null, null).primary).toBe('');
  });

  it('another local currency formats with its own symbol', () => {
    expect(priceInline(priceParts(quote(470_000, 'UGX'), usd))).toBe(
      'USh470,000 · about $35',
    );
  });
});
