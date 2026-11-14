import { describe, expect, it } from '@jest/globals';
import {
  decodeForm,
  defaultCurrencyFor,
  emptyForm,
  encodeForm,
  isAnswerValueNonEmpty,
  isFormEmpty,
  isRealIsoDate,
  legacyNote,
  normaliseAnswerType,
  parseAmount,
  isSavedAnswerCounted,
  sentenceCase,
  serverErrorField,
  serverErrorMessage,
  toPayload,
  valueToForm,
  valueToWire,
  type AddressForm,
} from '@/components/explorer/answerTypes';
import { chunkText } from '@/services/draftVault';
import {
  itemState,
  computeProgress,
} from '@/components/explorer/checklistLogic';
import type { Checklist, ChecklistItem } from '@/types/checklist.type';

const addr = (o: Partial<AddressForm> = {}): AddressForm => ({
  ...(emptyForm('address', 'GBP') as AddressForm),
  ...o,
});

describe('normaliseAnswerType', () => {
  it('keeps the six types, anything else is text', () => {
    for (const t of ['text', 'date', 'date_range', 'money', 'address', 'list'])
      expect(normaliseAnswerType(t)).toBe(t);
    expect(normaliseAnswerType(undefined)).toBe('text');
    expect(normaliseAnswerType('phone')).toBe('text');
  });
});

describe('isRealIsoDate', () => {
  it('accepts real dates, rejects impossible or malformed ones', () => {
    expect(isRealIsoDate('2027-02-28')).toBe(true);
    expect(isRealIsoDate('2028-02-29')).toBe(true);
    expect(isRealIsoDate('2027-02-30')).toBe(false);
    expect(isRealIsoDate('27-02-01')).toBe(false);
    expect(isRealIsoDate(5)).toBe(false);
  });
});

describe('toPayload (validation per type)', () => {
  it('empty clears for every type (text "", structured null)', () => {
    for (const t of [
      'text',
      'date',
      'date_range',
      'money',
      'address',
      'list',
    ] as const)
      expect(toPayload(t, '')).toEqual({
        ok: true,
        value: t === 'text' ? '' : null,
      });
  });
  it('text: trimmed, max 2000', () => {
    expect(toPayload('text', '  hi ')).toEqual({ ok: true, value: 'hi' });
    expect(toPayload('text', 'a'.repeat(2001)).ok).toBe(false);
  });
  it('date', () => {
    expect(toPayload('date', encodeForm('date', '1990-05-17'))).toEqual({
      ok: true,
      value: '1990-05-17',
    });
    const bad = toPayload('date', JSON.stringify('1990-02-31'));
    expect(bad.ok).toBe(false);
  });
  it('date_range: both dates, to >= from', () => {
    const w = (from: string, to: string) =>
      toPayload('date_range', encodeForm('date_range', { from, to }));
    expect(w('2027-03-01', '2027-03-10')).toEqual({
      ok: true,
      value: { from: '2027-03-01', to: '2027-03-10' },
    });
    expect(w('2027-03-01', '2027-03-01').ok).toBe(true);
    const early = w('2027-03-10', '2027-03-01');
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.error.field).toBe('to');
    const half = w('2027-03-10', '');
    expect(half.ok).toBe(false);
    if (!half.ok) expect(half.error.field).toBe('to');
  });
  it('money: finite non-negative amount, 3-letter currency', () => {
    const w = (amount: string, currency: string) =>
      toPayload('money', encodeForm('money', { amount, currency }));
    expect(w('1,200.50', 'gbp')).toEqual({
      ok: true,
      value: { amount: 1200.5, currency: 'GBP' },
    });
    expect(w('0', 'GBP').ok).toBe(true);
    expect(w('-5', 'GBP').ok).toBe(false);
    expect(w('abc', 'GBP').ok).toBe(false);
    const cur = w('5', 'POUNDS');
    expect(cur.ok).toBe(false);
    if (!cur.ok) expect(cur.error.field).toBe('currency');
  });
  it('address: line1, city, country required; names the missing field', () => {
    const w = (a: Partial<AddressForm>) =>
      toPayload('address', encodeForm('address', addr(a)));
    expect(
      w({
        line1: ' 1 High St ',
        city: 'Leeds',
        country: 'UK',
        note: '2 years',
      }),
    ).toEqual({
      ok: true,
      value: {
        line1: '1 High St',
        city: 'Leeds',
        country: 'UK',
        note: '2 years',
      },
    });
    const noCity = w({ line1: '1 High St', country: 'UK' });
    expect(noCity.ok).toBe(false);
    if (!noCity.ok) expect(noCity.error.field).toBe('city');
    // A note alone is not a complete address.
    expect(w({ note: 'x' }).ok).toBe(false);
  });
  it('list: blanks dropped, max 20 entries of 500 chars', () => {
    const w = (rows: string[]) => toPayload('list', encodeForm('list', rows));
    expect(w(['a', '  ', ' b '])).toEqual({ ok: true, value: ['a', 'b'] });
    expect(w(Array.from({ length: 21 }, (_, i) => `x${i}`)).ok).toBe(false);
    expect(w(['y'.repeat(501)]).ok).toBe(false);
    expect(w(Array.from({ length: 20 }, (_, i) => `x${i}`)).ok).toBe(true);
  });
});

describe('emptiness', () => {
  it('isFormEmpty', () => {
    expect(isFormEmpty('text', '  ')).toBe(true);
    expect(isFormEmpty('date_range', { from: '2027-01-01', to: '' })).toBe(
      false,
    );
    expect(isFormEmpty('money', { amount: '', currency: 'USD' })).toBe(true);
    expect(isFormEmpty('address', addr())).toBe(true);
    expect(isFormEmpty('address', addr({ note: 'x' }))).toBe(false);
    expect(isFormEmpty('list', ['', ' '])).toBe(true);
    expect(isFormEmpty('list', ['', 'a'])).toBe(false);
  });
  it('isAnswerValueNonEmpty: a saved answer counts when non-empty for its type', () => {
    expect(isAnswerValueNonEmpty('text', 'hi')).toBe(true);
    expect(isAnswerValueNonEmpty('text', '  ')).toBe(false);
    expect(isAnswerValueNonEmpty('date', '1990-05-17')).toBe(true);
    expect(
      isAnswerValueNonEmpty('date_range', { from: '2027-01-01', to: '' }),
    ).toBe(false);
    expect(
      isAnswerValueNonEmpty('date_range', {
        from: '2027-01-01',
        to: '2027-01-05',
      }),
    ).toBe(true);
    expect(isAnswerValueNonEmpty('money', { amount: 0, currency: 'GBP' })).toBe(
      true,
    );
    expect(isAnswerValueNonEmpty('money', { currency: 'GBP' })).toBe(false);
    expect(
      isAnswerValueNonEmpty('address', { line1: 'a', city: 'b', country: '' }),
    ).toBe(false);
    expect(
      isAnswerValueNonEmpty('address', { line1: 'a', city: 'b', country: 'c' }),
    ).toBe(true);
    expect(isAnswerValueNonEmpty('list', [])).toBe(false);
    expect(isAnswerValueNonEmpty('list', ['x'])).toBe(true);
    expect(isAnswerValueNonEmpty('list', undefined)).toBe(false);
  });
});

describe('draft round-trip of structured values', () => {
  const cases: [
    Parameters<typeof encodeForm>[0],
    Parameters<typeof encodeForm>[1],
  ][] = [
    ['date', '1990-05-17'],
    ['date_range', { from: '2027-03-01', to: '2027-03-10' }],
    ['money', { amount: '850.5', currency: 'USD' }],
    [
      'address',
      addr({
        line1: '1 High St',
        city: 'Leeds',
        country: 'UK',
        postcode: 'LS1 1AA',
      }),
    ],
    ['list', ['one', 'two', 'three']],
  ];
  for (const [type, form] of cases)
    it(`${type} encodes and decodes to the same form`, () => {
      const wire = encodeForm(type, form);
      expect(decodeForm(type, wire, 'GBP')).toEqual(form);
      // and the wire is stable (an unchanged value is never re-saved)
      expect(encodeForm(type, decodeForm(type, wire, 'GBP'))).toBe(wire);
    });
  it('a long list survives the vault chunking', () => {
    const rows = Array.from(
      { length: 20 },
      (_, i) => `entry ${i} ${'é'.repeat(300)}`,
    );
    const wire = encodeForm('list', rows);
    expect(wire.length).toBeGreaterThan(2048);
    const chunks = chunkText(wire);
    expect(chunks.length).toBeGreaterThan(1);
    expect(decodeForm('list', chunks.join(''), 'GBP')).toEqual(rows);
  });
  it('a corrupt draft gives the empty form, not a crash', () => {
    expect(decodeForm('address', '{not json', 'GBP')).toEqual(addr());
    expect(decodeForm('list', '"str"', 'GBP')).toEqual(['']);
  });
  it('a saved server value has the same wire as the form it fills', () => {
    const value = { amount: 1200.5, currency: 'EUR' };
    expect(valueToWire('money', value, 'GBP')).toBe(
      encodeForm('money', { amount: '1,200.50', currency: 'EUR' }),
    );
  });
});

describe('legacy plain-string answers are never lost', () => {
  it('fill the text box, first address field, or one list row', () => {
    expect(valueToForm('text', 'old', 'GBP')).toBe('old');
    expect((valueToForm('address', 'old', 'GBP') as AddressForm).line1).toBe(
      'old',
    );
    expect(valueToForm('list', 'old', 'GBP')).toEqual(['old']);
  });
  it('for date / range / money they show as a note', () => {
    expect(legacyNote('date_range', 'June 2027')).toBe('June 2027');
    expect(legacyNote('money', '£500')).toBe('£500');
    expect(legacyNote('date', '1990-05-17')).toBeNull();
    expect(legacyNote('text', 'old')).toBeNull();
  });
  it('count as answered', () => {
    expect(isAnswerValueNonEmpty('date_range', 'June 2027')).toBe(true);
  });
});

describe('money helpers', () => {
  it('default currency from a symbol or code in the item text, else GBP', () => {
    expect(defaultCurrencyFor('how much you earn (over £20,000)')).toBe('GBP');
    expect(defaultCurrencyFor('income of $5,000')).toBe('USD');
    expect(defaultCurrencyFor('trip cost in EUR')).toBe('EUR');
    expect(defaultCurrencyFor('how much you think your trip will cost')).toBe(
      'GBP',
    );
  });
  it('parseAmount', () => {
    expect(parseAmount('1,200')).toBe(1200);
    expect(parseAmount('.5')).toBe(0.5);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('1e3')).toBeNull();
  });
});

describe('sentenceCase', () => {
  it('capitalises only the first letter, leaves the rest verbatim', () => {
    expect(sentenceCase("the dates you're planning to travel to the UK")).toBe(
      "The dates you're planning to travel to the UK",
    );
    expect(sentenceCase('your CAS reference number')).toBe(
      'Your CAS reference number',
    );
    expect(sentenceCase('Already fine')).toBe('Already fine');
    expect(sentenceCase('')).toBe('');
    expect(sentenceCase('  indented')).toBe('  Indented');
    expect(sentenceCase('£500 fee')).toBe('£500 fee');
  });
});

describe('progress counts typed answers', () => {
  const item = (
    id: string,
    answerType?: ChecklistItem['answerType'],
  ): ChecklistItem =>
    ({
      checklistItemId: id,
      title: id,
      holder: 'applicant',
      required: true,
      kind: 'information',
      need: 'required',
      answerType,
      reason: '',
      citation: {},
      documentRequestId: null,
      status: null,
      current: true,
    }) as unknown as ChecklistItem;
  it('an item is answered only when its typed value is non-empty', () => {
    const range = item('r', 'date_range');
    const half = {
      r: { value: { from: '2027-01-01', to: '' }, updatedAt: 'x' },
    };
    expect(itemState(range, [], half as never)).toBe('waiting');
    const full = {
      r: { value: { from: '2027-01-01', to: '2027-01-02' }, updatedAt: 'x' },
    };
    expect(itemState(range, [], full as never)).toBe('answered');
    const cl = {
      state: 'ready',
      rubricVersion: 1,
      items: [range, item('t')],
    } as Checklist;
    const p = computeProgress(cl, [], {
      ...full,
      t: { value: '   ', updatedAt: 'x' },
    } as never);
    expect(p.answered).toBe(1);
    expect(p.fraction).toBe(0.5);
  });
});

describe('legacy:true answers show but do not count unless they fit', () => {
  it('plain string for a non-text type is not counted', () => {
    expect(isSavedAnswerCounted('date_range', 'June 2027', true)).toBe(false);
    expect(isSavedAnswerCounted('money', '£500', true)).toBe(false);
    expect(isSavedAnswerCounted('date', 'sometime', true)).toBe(false);
    expect(isSavedAnswerCounted('date', '1990-05-17', true)).toBe(true);
    expect(isSavedAnswerCounted('text', 'old', true)).toBe(true);
  });
  it('an address legacy { note } is not counted and prefills the note', () => {
    const v = { note: 'lived there 2 years' };
    expect(isSavedAnswerCounted('address', v, true)).toBe(false);
    expect((valueToForm('address', v, 'GBP') as AddressForm).note).toBe(
      'lived there 2 years',
    );
  });
  it('a legacy one-entry list fits the list type', () => {
    expect(isSavedAnswerCounted('list', ['old text'], true)).toBe(true);
  });
  it('itemState keeps a legacy range answer Waiting', () => {
    const range = {
      checklistItemId: 'r',
      kind: 'information',
      answerType: 'date_range',
    } as unknown as ChecklistItem;
    expect(
      itemState(range, [], {
        r: { value: 'June', legacy: true, updatedAt: 'x' },
      } as never),
    ).toBe('waiting');
  });
});

describe('server 400 field mapping', () => {
  it('finds the input a message names', () => {
    expect(serverErrorField('"value.country" is required')).toBe('country');
    expect(
      serverErrorField('"value.to" must be on or after "value.from"'),
    ).toBe('to');
    expect(serverErrorField('something else')).toBeNull();
  });
  it('labels fields in the message', () => {
    expect(serverErrorMessage('"value.country" is required')).toBe(
      'Country is required',
    );
    expect(
      serverErrorMessage('"value.to" must be on or after "value.from"'),
    ).toBe('To must be on or after From');
    expect(serverErrorMessage(undefined)).toBe(
      'Check this answer and try again.',
    );
  });
});
