// Unit tests: "What you already hold" pure helpers (japa#234).
import { describe, expect, it } from '@jest/globals';
import {
  HOLDINGS_COPY,
  buildNewDocument,
  canSubmitDocument,
  clampDate,
  counterLine,
  documentSubline,
  documentTitle,
  documentsState,
  formatDay,
  nationalitiesSummary,
  parseDay,
  saveErrorMessage,
  sortDocuments,
  toApiDay,
  toggleSelection,
  withNationality,
  withoutNationality,
} from '../holdingsLogic';
import type { HeldDocumentView } from '@/types/holdings.type';

const doc = (
  id: string,
  validUntil: string,
  expired: boolean,
): HeldDocumentView => ({
  id,
  kind: 'visa',
  issuerCountryCode: 'AA',
  validUntil,
  expired,
});

describe('toggleSelection', () => {
  it('adds at the end and removes on a second tap', () => {
    expect(toggleSelection(['AA'], 'BB')).toEqual(['AA', 'BB']);
    expect(toggleSelection(['AA', 'BB'], 'aa')).toEqual(['BB']);
  });
  it('ignores an unchosen row at the cap of 5', () => {
    const five = ['A1', 'A2', 'A3', 'A4', 'A5'];
    expect(toggleSelection(five, 'A6')).toBe(five);
    expect(toggleSelection(five, 'A5')).toEqual(['A1', 'A2', 'A3', 'A4']);
  });
});

describe('counterLine', () => {
  it('reads 0 chosen … 5 of 5', () => {
    expect(counterLine(0)).toBe('0 chosen');
    expect(counterLine(3)).toBe('3 chosen');
    expect(counterLine(5)).toBe('5 of 5 chosen. Remove one to pick another.');
  });
});

describe('list replace helpers (the API replaces the whole list)', () => {
  it('withNationality sends existing + new, uppercase, no duplicates', () => {
    expect(withNationality(['AA'], 'bb')).toEqual(['AA', 'BB']);
    expect(withNationality(['AA'], 'aa')).toEqual(['AA']);
  });
  it('withoutNationality drops one and keeps the rest in order', () => {
    expect(withoutNationality(['AA', 'BB', 'CC'], 'bb')).toEqual(['AA', 'CC']);
    expect(withoutNationality(['AA'], 'AA')).toEqual([]);
  });
});

describe('nationalitiesSummary', () => {
  it('is Not set / singular / plural', () => {
    expect(nationalitiesSummary(undefined)).toBe('Not set');
    expect(nationalitiesSummary([])).toBe('Not set');
    expect(nationalitiesSummary(['AA'])).toBe('1 nationality');
    expect(nationalitiesSummary(['AA', 'BB'])).toBe('2 nationalities');
  });
});

describe('documentsState', () => {
  it('tells never stated (null) from holds none ([])', () => {
    expect(documentsState(null)).toBe('unstated');
    expect(documentsState(undefined)).toBe('unstated');
    expect(documentsState([])).toBe('none');
    expect(documentsState([doc('1', '2030-01-01', false)])).toBe('list');
  });
});

describe('sortDocuments', () => {
  it('puts valid first (soonest end first), then expired (latest first)', () => {
    const sorted = sortDocuments([
      doc('old', '2020-01-01', true),
      doc('late', '2031-01-01', false),
      doc('older', '2018-01-01', true),
      doc('soon', '2027-03-14', false),
    ]).map((d) => d.id);
    expect(sorted).toEqual(['soon', 'late', 'old', 'older']);
  });
});

describe('expired display', () => {
  it('valid: "Valid until 14 Mar 2027"', () => {
    expect(documentSubline(doc('1', '2027-03-14', false))).toBe(
      'Valid until 14 Mar 2027',
    );
  });
  it('expired: "Ended … Doesn’t count."', () => {
    expect(documentSubline(doc('1', '2024-03-14', true))).toBe(
      'Ended 14 Mar 2024. Doesn’t count.',
    );
  });
  it('title never shows a raw code', () => {
    expect(documentTitle('visa', 'Canada')).toBe('Visa from Canada');
    expect(documentTitle('residence_permit', undefined)).toBe(
      'Residence permit',
    );
  });
});

describe('dates', () => {
  it('parses a day as LOCAL and round-trips', () => {
    const d = parseDay('2027-03-14')!;
    expect(d.getDate()).toBe(14);
    expect(toApiDay(d)).toBe('2027-03-14');
    expect(formatDay('2027-03-04')).toBe('4 Mar 2027');
    expect(parseDay('nope')).toBeNull();
    expect(formatDay('nope')).toBe('');
  });
  it('clamps to the range the backend accepts', () => {
    expect(toApiDay(clampDate(new Date(1980, 5, 1)))).toBe('1990-01-01');
    expect(toApiDay(clampDate(new Date(2200, 5, 1)))).toBe('2100-12-31');
    expect(toApiDay(clampDate(new Date(2024, 5, 1)))).toBe('2024-06-01');
  });
});

describe('add-document validation', () => {
  const full = {
    kind: 'visa' as const,
    issuerCountryCode: 'aa',
    validUntil: new Date(2027, 2, 14),
    note: '  work visa  ',
  };
  it('needs kind, issuer and date', () => {
    expect(canSubmitDocument(full)).toBe(true);
    expect(canSubmitDocument({ ...full, kind: null })).toBe(false);
    expect(canSubmitDocument({ ...full, issuerCountryCode: null })).toBe(false);
    expect(canSubmitDocument({ ...full, validUntil: null })).toBe(false);
  });
  it('builds the body: uppercase issuer, trimmed note, day string', () => {
    expect(buildNewDocument(full)).toEqual({
      kind: 'visa',
      issuerCountryCode: 'AA',
      validUntil: '2027-03-14',
      note: 'work visa',
    });
  });
  it('omits an empty note and caps a long one at 200', () => {
    expect(buildNewDocument({ ...full, note: '   ' })).not.toHaveProperty(
      'note',
    );
    expect(
      buildNewDocument({ ...full, note: 'x'.repeat(300) })!.note,
    ).toHaveLength(200);
    expect(buildNewDocument({ ...full, kind: null })).toBeNull();
  });
});

describe('saveErrorMessage', () => {
  it('uses the generic line for network and server errors', () => {
    expect(saveErrorMessage({ code: 'NETWORK_ERROR', status: 0 })).toBe(
      HOLDINGS_COPY.saveError,
    );
    expect(
      saveErrorMessage({ code: 'INTERNAL_ERROR', status: 500 }, 'document'),
    ).toBe(HOLDINGS_COPY.saveError);
  });
  it('maps a nationalities validation error to the limit line', () => {
    expect(
      saveErrorMessage(
        { code: 'VALIDATION_ERROR', status: 400 },
        'nationalities',
      ),
    ).toBe('You can add up to 5 nationalities.');
  });
  it('documents: limit line, short server line, else fallback', () => {
    const v = (message: string) => ({
      code: 'VALIDATION_ERROR',
      status: 400,
      message,
    });
    expect(
      saveErrorMessage(v('Give at most 20 held documents'), 'document'),
    ).toBe(HOLDINGS_COPY.documentsLimit);
    expect(saveErrorMessage(v('validUntil must be a date'), 'document')).toBe(
      'validUntil must be a date',
    );
    expect(saveErrorMessage(v('a\nb'), 'document')).toBe(
      HOLDINGS_COPY.validationFallback,
    );
  });
});
