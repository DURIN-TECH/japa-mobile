// Unit tests: "Do I need a visa?" pure helpers (japa#237, P8b).
import { describe, expect, it } from '@jest/globals';
import {
  buildEntryQuery,
  holdsParam,
  nextStepFor,
  outcomeHeadline,
  outcomeIcon,
  outcomeShort,
  parseStayDays,
  savedAnswerKey,
  sourceAge,
  startBarHidden,
  unknownHeadline,
  unknownOpensDetails,
} from '../entryRequirementsLogic';
import type {
  EntryAnswer,
  EntryOutcome,
  EntryUnknown,
  EntryUnknownCode,
} from '@/types/entry-requirements.type';
import type { HoldingsView } from '@/types/holdings.type';

const OUTCOMES: EntryOutcome[] = [
  'visa_required',
  'visa_free',
  'visa_on_arrival',
  'travel_authorisation',
  'transit_visa',
  'transit_free',
];
const CODES: EntryUnknownCode[] = [
  'no_rule',
  'missing_fact',
  'stale',
  'stay_not_covered',
  'purpose_not_covered',
];

const answer = (outcome: EntryOutcome, disagree = false): EntryAnswer => ({
  status: 'answer',
  destination: 'XA',
  outcome,
  message: 'The official source says …',
  stay: null,
  conditions: [],
  sources: [],
  disagree,
  mightAlsoApply: [],
  authorisation: null,
});
const unknown = (code: EntryUnknownCode): EntryUnknown => ({
  status: 'unknown',
  destination: 'XA',
  code,
  reason: 'r',
});

const holdings = (over: Partial<HoldingsView> = {}): HoldingsView => ({
  nationalities: ['XB'],
  residentialCountry: 'XD',
  heldDocuments: null,
  updatedAt: null,
  ...over,
});

describe('outcome mapping', () => {
  it('has the right headline for all six outcomes', () => {
    expect(OUTCOMES.map(outcomeHeadline)).toEqual([
      'You’ll need a visa',
      'You don’t need a visa',
      'You can get a visa when you arrive',
      'You’ll need a travel authorisation',
      'You’ll need a visa to pass through',
      'You don’t need a visa to pass through',
    ]);
  });
  it('has a distinct short line for each outcome', () => {
    expect(new Set(OUTCOMES.map(outcomeShort)).size).toBe(6);
  });
  it('never claims anything for an outcome it does not know', () => {
    expect(outcomeHeadline('mystery')).toBe(
      'Here’s what the official source says',
    );
    expect(outcomeIcon('mystery')).toBe('help');
    expect(nextStepFor('mystery', false)).toBe('none');
  });
  it('picks the next step: Start only for visa outcomes', () => {
    expect(OUTCOMES.map((o) => nextStepFor(o, false))).toEqual([
      'start',
      'official',
      'official',
      'authorisation',
      'start',
      'official',
    ]);
  });
  it('offers no button on a disagreement', () => {
    for (const o of OUTCOMES) expect(nextStepFor(o, true)).toBe('none');
  });
});

describe('unknown mapping', () => {
  it('has a headline for each of the five codes', () => {
    expect(CODES.map(unknownHeadline)).toEqual([
      'We don’t have an official source for this yet',
      'We need a little more to answer this',
      'This may be out of date',
      'We can’t answer for a stay that long',
      'We can’t answer for that purpose yet',
    ]);
  });
  it('falls back to the safe line for a new code', () => {
    expect(unknownHeadline('new_code')).toBe(
      'We don’t have an official source for this yet',
    );
  });
  it('opens the details for stay and purpose codes only', () => {
    expect(CODES.filter(unknownOpensDetails)).toEqual([
      'stay_not_covered',
      'purpose_not_covered',
    ]);
  });
});

describe('startBarHidden', () => {
  it('hides for visa-free, on arrival, transit-free and authorisation', () => {
    expect(OUTCOMES.map((o) => startBarHidden(answer(o)))).toEqual([
      false,
      true,
      true,
      true,
      false,
      true,
    ]);
  });
  it('keeps the bar on a disagreement, unknown, loading or nothing', () => {
    expect(startBarHidden(answer('visa_free', true))).toBe(false);
    for (const c of CODES) expect(startBarHidden(unknown(c))).toBe(false);
    expect(startBarHidden(null)).toBe(false);
    expect(startBarHidden(undefined)).toBe(false);
  });
});

describe('buildEntryQuery', () => {
  it('does not ask without a nationality or destination', () => {
    expect(
      buildEntryQuery({
        destination: 'XA',
        nationality: null,
        holdings: holdings(),
      }),
    ).toBeNull();
    expect(
      buildEntryQuery({
        destination: '',
        nationality: 'XB',
        holdings: holdings(),
      }),
    ).toBeNull();
  });
  it('leaves holds out when the person never said', () => {
    expect(
      buildEntryQuery({
        destination: 'XA',
        nationality: 'XB',
        holdings: holdings(),
      }),
    ).toBe('destination=XA&nationality=XB&residence=XD');
  });
  it('sends an empty holds when they said they hold none', () => {
    expect(
      buildEntryQuery({
        destination: 'XA',
        nationality: 'XB',
        holdings: holdings({ heldDocuments: [], residentialCountry: null }),
      }),
    ).toBe('destination=XA&nationality=XB&holds=');
  });
  it('leaves expired documents out and keeps the valid ones', () => {
    const h = holdings({
      heldDocuments: [
        {
          id: '1',
          kind: 'visa',
          issuerCountryCode: 'XE',
          validUntil: '2020-01-01',
          expired: true,
        },
        {
          id: '2',
          kind: 'residence_permit',
          issuerCountryCode: 'XF',
          validUntil: '2030-05-01',
          expired: false,
        },
        {
          id: '3',
          kind: 'travel_authorisation',
          issuerAuthorityId: 'auth-g',
          validUntil: '2031-02-03',
          expired: false,
        },
      ],
    });
    expect(holdsParam(h)).toEqual([
      'residence_permit:XF:2030-05-01',
      'travel_authorisation:auth-g:2031-02-03',
    ]);
    const q = buildEntryQuery({
      destination: 'XA',
      nationality: 'XB',
      holdings: h,
      purpose: 'study',
      stayDays: 90,
    });
    expect(q).toBe(
      'destination=XA&nationality=XB&residence=XD&holds=residence_permit:XF:2030-05-01,travel_authorisation:auth-g:2031-02-03&purpose=study&stayDays=90',
    );
  });
  it('sends all-expired as an empty holds, never the expired ones', () => {
    const h = holdings({
      heldDocuments: [
        {
          id: '1',
          kind: 'visa',
          issuerCountryCode: 'XE',
          validUntil: '2020-01-01',
          expired: true,
        },
      ],
    });
    expect(
      buildEntryQuery({ destination: 'XA', nationality: 'XB', holdings: h }),
    ).toContain('&holds=');
    expect(
      buildEntryQuery({ destination: 'XA', nationality: 'XB', holdings: h }),
    ).not.toContain('XE');
  });
  it('ignores a bad stay', () => {
    const q = buildEntryQuery({
      destination: 'XA',
      nationality: 'XB',
      holdings: holdings(),
      stayDays: 0,
    });
    expect(q).not.toContain('stayDays');
  });
});

describe('small helpers', () => {
  it('parses stay days 1..3650 only', () => {
    expect(parseStayDays(' 30 ')).toBe(30);
    expect(parseStayDays('')).toBeUndefined();
    expect(parseStayDays('0')).toBeUndefined();
    expect(parseStayDays('3651')).toBeUndefined();
    expect(parseStayDays('1e3')).toBeUndefined();
  });
  it('keys the saved answer per person and per inputs', () => {
    expect(savedAnswerKey('u1', 'q')).not.toBe(savedAnswerKey('u2', 'q'));
    expect(savedAnswerKey('u1', 'q')).not.toBe(savedAnswerKey('u1', 'r'));
  });
});

describe('sourceAge', () => {
  const now = new Date(2026, 10, 14, 12, 0, 0);
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const H = 3600_000;
  it('is words under 30 days', () => {
    expect(sourceAge(ago(10_000), now)).toBe('just now');
    expect(sourceAge(ago(5 * 60_000), now)).toBe('5 minutes ago');
    expect(sourceAge(ago(1 * H), now)).toBe('1 hour ago');
    expect(sourceAge(ago(3 * 24 * H), now)).toBe('3 days ago');
    expect(sourceAge(ago(29 * 24 * H), now)).toBe('29 days ago');
  });
  it('is a date from 30 days on', () => {
    const t = new Date(2026, 2, 14, 9, 0, 0);
    expect(sourceAge(t.toISOString(), now)).toBe('on 14 Mar 2026');
    expect(sourceAge(ago(30 * 24 * H), now)).toMatch(
      /^on \d{1,2} [A-Z][a-z]{2} 2026$/,
    );
  });
  it('is empty for nothing and just now for the future', () => {
    expect(sourceAge(undefined, now)).toBe('');
    expect(sourceAge('nope', now)).toBe('');
    expect(sourceAge(ago(-5 * H), now)).toBe('just now');
  });
});
