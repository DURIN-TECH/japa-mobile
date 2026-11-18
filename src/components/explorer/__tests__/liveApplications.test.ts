// ─────────────────────────────────────────────────────────────────────────────
// Unit tests: case visa title (japa#106). A case on an agency-only visa
// shows the real visa name, never "Visa".
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from '@jest/globals';
import { mapApplication, resolveVisaTitle } from '../liveApplications';
import type { Application } from '@/types/applications.type';

const app = (over: Partial<Application> = {}): Application =>
  ({
    id: 'app12345abc',
    userId: 'u1',
    visaTypeId: 'own-1',
    countryCode: 'GB',
    countryName: 'United Kingdom',
    visaTypeName: 'Acme Sponsored Worker',
    status: 'under_review',
    progress: 40,
    documentsRequired: 0,
    documentsUploaded: 0,
    totalCost: 0,
    lastUpdated: new Date().toISOString(),
    ...over,
  }) as unknown as Application;

describe('resolveVisaTitle', () => {
  it('uses the denormalised visaTypeName first', () => {
    expect(resolveVisaTitle(app(), 'Other')).toBe('Acme Sponsored Worker');
  });
  it('falls back to the fetched visa name', () => {
    expect(
      resolveVisaTitle(app({ visaTypeName: undefined }), 'Fetched name'),
    ).toBe('Fetched name');
    expect(resolveVisaTitle(app({ visaTypeName: '  ' }), 'Fetched')).toBe(
      'Fetched',
    );
  });
  it('shows the country while the name loads, never "Visa"', () => {
    expect(resolveVisaTitle(app({ visaTypeName: undefined }))).toBe(
      'United Kingdom',
    );
    expect(
      resolveVisaTitle(
        app({ visaTypeName: undefined, countryName: undefined }),
      ),
    ).toBe('GB');
  });
});

describe('mapApplication', () => {
  it('puts the resolved title on dest.visa', () => {
    expect(mapApplication(app()).dest?.visa).toBe('Acme Sponsored Worker');
    expect(
      mapApplication(app({ visaTypeName: undefined }), undefined, 'Fetched')
        .dest?.visa,
    ).toBe('Fetched');
  });
});

// japa#183: case cost is integer US cents in `costCurrency` (absent = USD);
// the dest price is whole dollars, so a 5,000,000-cent case is $50,000.
describe('mapApplication case cost units', () => {
  it('reads totalCost as US cents, not dollars', () => {
    expect(mapApplication(app({ totalCost: 5_000_000 })).dest?.price).toBe(
      50_000,
    );
    expect(
      mapApplication(app({ totalCost: 5_000_000, costCurrency: 'USD' })).dest
        ?.price,
    ).toBe(50_000);
  });
  it('a missing cost is 0', () => {
    expect(
      mapApplication(app({ totalCost: undefined as unknown as number })).dest
        ?.price,
    ).toBe(0);
  });
});

// japa#183 review: the cost is formatted in ITS OWN currency through the
// money helper; a non-USD cost is never printed with "$".
describe('mapApplication case cost currency', () => {
  it('formats a dollar cost through the money helper', () => {
    const a = mapApplication(app({ totalCost: 5_000_000 }));
    expect(a.cost).toEqual({ amountMinor: 5_000_000, currency: 'USD' });
    expect(a.costLabel).toBe('$50,000.00');
  });
  it('formats a naira cost as naira and keeps it out of the dollar price', () => {
    const a = mapApplication(app({ totalCost: 500_000, costCurrency: 'NGN' }));
    expect(a.cost).toEqual({ amountMinor: 500_000, currency: 'NGN' });
    expect(a.costLabel).toBe('₦5,000.00');
    expect(a.costLabel).not.toContain('$');
    // `dest.price` is printed with "$": no naira figure may land there.
    expect(a.dest?.price).toBe(0);
  });
  it('a zero-decimal currency uses its own factor', () => {
    expect(
      mapApplication(app({ totalCost: 50_000, costCurrency: 'UGX' })).costLabel,
    ).toBe('USh50,000');
  });
  it('a missing cost has no label', () => {
    const a = mapApplication(
      app({ totalCost: undefined as unknown as number }),
    );
    expect(a.cost).toBeNull();
    expect(a.costLabel).toBe('');
  });
});
