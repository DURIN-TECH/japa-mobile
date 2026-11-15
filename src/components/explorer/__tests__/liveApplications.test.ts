// ─────────────────────────────────────────────────────────────────────────────
// Unit tests: case visa title (japa#106). A case on an agency-only visa
// shows the real visa name, never "Visa".
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from '@jest/globals';
import { mapApplication, resolveVisaTitle } from '../liveApplications';
import { STATUS } from '../content';
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

// japa#259: a withdrawn application reads "Withdrawn" (neutral pill, the same
// colours as "Draft"), not "Under review".
describe('withdrawn status label', () => {
  it('maps backend `withdrawn` to its own bucket', () => {
    expect(mapApplication(app({ status: 'withdrawn' })).status).toBe(
      'withdrawn',
    );
  });
  it('the bucket is labelled "Withdrawn"', () => {
    const bucket = mapApplication(app({ status: 'withdrawn' })).status;
    expect(STATUS[bucket].label).toBe('Withdrawn');
  });
  it('uses the same neutral colours as "Draft"', () => {
    expect(STATUS.withdrawn.fg).toBe(STATUS.draft.fg);
    expect(STATUS.withdrawn.bg).toBe(STATUS.draft.bg);
    expect(STATUS.draft.label).toBe('Draft');
  });
  it('leaves the other statuses where they were', () => {
    expect(mapApplication(app({ status: 'draft' })).status).toBe('draft');
    expect(mapApplication(app({ status: 'under_review' })).status).toBe(
      'review',
    );
    expect(mapApplication(app({ status: 'approved' })).status).toBe('approved');
  });
});
