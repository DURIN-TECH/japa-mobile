// ─────────────────────────────────────────────────────────────────────────────
// Unit tests: agency "Visas they handle" mappers (japa#106).
// Prices are WHOLE NAIRA (no /100); agency-only visas are chipped and not
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

/** One `visaPrices[]` entry as the backend sends it. */
const entry = (over: Partial<PublicVisaPrice> = {}): PublicVisaPrice => ({
  visaTypeId: 'uk-sw',
  countryCode: 'GB',
  visaName: 'Skilled Worker visa',
  category: 'work',
  price: 12500,
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

  it('turns a non-number price into null and keeps naira as-is', () => {
    const [a, b, c, d] = normalizeVisaPrices([
      entry({ price: '12500' as unknown as number }),
      entry({ price: NaN }),
      entry({ price: -1 }),
      entry({ price: 12500 }),
    ]);
    expect(a.price).toBeNull();
    expect(b.price).toBeNull();
    expect(c.price).toBeNull();
    expect(d.price).toBe(12500);
  });

  it('defaults visibility to global and isAgencyVisa to false', () => {
    const [v] = normalizeVisaPrices([
      { visaTypeId: 'x', countryCode: 'GB', visaName: 'X' },
    ]);
    expect(v.visibility).toBe('global');
    expect(v.isAgencyVisa).toBe(false);
    expect(v.price).toBeNull();
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
  it('formats the price in whole naira with a Service fee caption', () => {
    const [row] = mapAgencyVisaRows([entry({ price: 12500 })], COUNTRIES);
    // No cents conversion: 12500 → ₦12,500 (not ₦125).
    expect(row.priceLabel).toBe('₦12,500');
    expect(row.priceCaption).toBe('Service fee');
  });

  it('shows Contact for pricing with no caption when there is no price', () => {
    const [row] = mapAgencyVisaRows([entry({ price: null })], COUNTRIES);
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
