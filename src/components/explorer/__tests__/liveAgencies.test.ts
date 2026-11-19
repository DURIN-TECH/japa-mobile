// ─────────────────────────────────────────────────────────────────────────────
// Unit tests: agency "Visas they handle" mappers (japa#106).
// Prices (japa#183) are the server's `priceLocal` + `priceUsd` (no mobile
// conversion, "Contact for pricing" without a dollar price); agency-only visas are chipped and not
// tappable; a missing / malformed `visaPrices` never throws.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from '@jest/globals';
import {
  AGENCY_ONLY_CHIP,
  countryNameFor,
  mapAgencyVisaRows,
  normalizeVisaPrices,
} from '../liveAgencies';
import type { PublicVisaPrice } from '@/hooks/useAgencies';

/** $9.00 service price, and the server's ₦12,500.00 local figure for it. */
const USD_9 = { amountMinor: 900, currency: 'USD' };
const NGN_12500 = {
  amountMinor: 1_250_000,
  currency: 'NGN',
  rate: 1388.89,
  asOf: '2026-11-13T00:00:00Z',
  available: true,
};

/** One `visaPrices[]` entry as the backend sends it. */
const entry = (over: Partial<PublicVisaPrice> = {}): PublicVisaPrice => ({
  visaTypeId: 'uk-sw',
  countryCode: 'GB',
  visaName: 'Skilled Worker visa',
  category: 'work',
  priceUsd: USD_9,
  priceLocal: NGN_12500,
  isAgencyVisa: false,
  visibility: 'global',
  processingTime: '3 to 8 weeks',
  ...over,
});

const COUNTRIES = [
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
];

describe('normalizeVisaPrices', () => {
  it('treats a missing or non-array field as []', () => {
    expect(normalizeVisaPrices(undefined)).toEqual([]);
    expect(normalizeVisaPrices(null)).toEqual([]);
    expect(normalizeVisaPrices({})).toEqual([]);
    expect(normalizeVisaPrices('x')).toEqual([]);
  });

  it('drops rows without a visa id or country, keeps the rest in order', () => {
    const out = normalizeVisaPrices([
      entry({ visaTypeId: 'a' }),
      { countryCode: 'GB' },
      null,
      entry({ visaTypeId: 'b', countryCode: '' }),
      entry({ visaTypeId: 'c' }),
    ]);
    expect(out.map((v) => v.visaTypeId)).toEqual(['a', 'c']);
  });

  it('turns a malformed dollar price into null and keeps a valid one as-is', () => {
    const bad = (amountMinor: unknown) =>
      entry({ priceUsd: { amountMinor, currency: 'USD' } as never });
    const [a, b, c, d] = normalizeVisaPrices([
      bad('900'),
      bad(NaN),
      bad(-1),
      entry(),
    ]);
    expect(a.priceUsd).toBeNull();
    expect(b.priceUsd).toBeNull();
    expect(c.priceUsd).toBeNull();
    expect(d.priceUsd).toEqual(USD_9);
    expect(d.priceLocal).toEqual(NGN_12500);
  });

  it('defaults visibility to global and isAgencyVisa to false', () => {
    const [v] = normalizeVisaPrices([
      { visaTypeId: 'x', countryCode: 'GB', visaName: 'X' },
    ]);
    expect(v.visibility).toBe('global');
    expect(v.isAgencyVisa).toBe(false);
    expect(v.priceUsd).toBeNull();
    expect(v.priceLocal).toBeNull();
    expect(v.processingTime).toBeNull();
  });
});

describe('countryNameFor', () => {
  it('prefers the app countries list (case-insensitive)', () => {
    expect(countryNameFor('gb', COUNTRIES)).toBe('United Kingdom');
  });
  it('falls back to Intl or the code, never throws', () => {
    const name = countryNameFor('FR', []);
    expect(['France', 'FR']).toContain(name);
    expect(typeof countryNameFor('??', null)).toBe('string');
  });
});

describe('mapAgencyVisaRows', () => {
  it('shows the local price with "about $" and a Service fee caption', () => {
    const [row] = mapAgencyVisaRows([entry()], COUNTRIES);
    // Kobo from the server → ₦12,500; the dollar side is the server's $9.
    expect(row.priceLabel).toBe('₦12,500 · about $9');
    expect(row.priceCaption).toBe('Service fee');
  });

  it('shows the dollar price only when the server has no local rate', () => {
    const [row] = mapAgencyVisaRows(
      [
        entry({
          priceLocal: {
            amountMinor: null,
            currency: 'NGN',
            rate: null,
            asOf: null,
            available: false,
          },
        }),
      ],
      COUNTRIES,
    );
    expect(row.priceLabel).toBe('$9.00');
    expect(row.priceCaption).toBe('Service fee');
  });

  it('shows Contact for pricing with no caption when there is no price', () => {
    const [row] = mapAgencyVisaRows(
      [entry({ priceUsd: null, priceLocal: null })],
      COUNTRIES,
    );
    expect(row.priceLabel).toBe('Contact for pricing');
    expect(row.priceCaption).toBeNull();
  });

  it('builds "{country} · {processing}" and drops the dot without one', () => {
    const [a, b] = mapAgencyVisaRows(
      [
        entry(),
        entry({ visaTypeId: 'ca-sp', countryCode: 'ca', processingTime: null }),
      ],
      COUNTRIES,
    );
    expect(a.subLine).toBe('United Kingdom · 3 to 8 weeks');
    expect(b.subLine).toBe('Canada');
    expect(b.countryCode).toBe('CA');
    expect(b.flag).toBe('ca');
    expect(b.key).toBe('CA__ca-sp');
  });

  it('agency-only visas are chipped and not tappable', () => {
    const [row] = mapAgencyVisaRows(
      [entry({ isAgencyVisa: true, visibility: 'agency' })],
      COUNTRIES,
    );
    expect(row.isAgencyOnly).toBe(true);
    expect(row.tappable).toBe(false);
    expect(AGENCY_ONLY_CHIP).toBe('Only with this agency');
  });

  it("an agency's own visa made global behaves like any global visa", () => {
    const [row] = mapAgencyVisaRows(
      [entry({ isAgencyVisa: true, visibility: 'global' })],
      COUNTRIES,
    );
    expect(row.isAgencyOnly).toBe(false);
    expect(row.tappable).toBe(true);
  });

  it('keeps the backend order', () => {
    const rows = mapAgencyVisaRows(
      [entry({ visaTypeId: 'z' }), entry({ visaTypeId: 'a' })],
      COUNTRIES,
    );
    expect(rows.map((r) => r.visaTypeId)).toEqual(['z', 'a']);
  });
});
