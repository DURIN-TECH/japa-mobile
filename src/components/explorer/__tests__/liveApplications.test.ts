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
