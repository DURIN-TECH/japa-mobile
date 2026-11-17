// ─────────────────────────────────────────────────────────────────────────────
// Whitelist builders of useCaseOfficer (issue #43 / #116).
//
// These functions are the privacy boundary of the review feature: the server
// payload is re-built field by field, so an internal field that ever appears in
// a response can never reach a component. The tests feed payloads that carry
// every forbidden field and assert none of them comes out.
// ─────────────────────────────────────────────────────────────────────────────

// The hook module imports the API/analytics services (Firebase). The pure
// builders under test don't use them, so replace them with empty stubs.
jest.mock('@/services/api.service', () => ({ apiService: {} }));
jest.mock('@/services/analytics.service', () => ({ analyticsService: {} }));

import { describe, expect, it, jest } from '@jest/globals';
import {
  pickBlockingRule,
  pickFree,
  pickFull,
  pickNarrative,
  toView,
} from '../useCaseOfficer';

// Fields that must never be copied out of a payload.
const FORBIDDEN = ['internalCall', 'score', 'usage', 'costUsd', 'confidence'];
const allKeys = (v: unknown, out = new Set<string>()): Set<string> => {
  if (Array.isArray(v)) v.forEach((x) => allKeys(x, out));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      out.add(k);
      allKeys(x, out);
    }
  }
  return out;
};

describe('pickFree', () => {
  it('outputs only the band, at most three titled issues and the blocking flag', () => {
    const out = pickFree({
      readiness: 'weak',
      hasBlockingRule: true,
      score: 42,
      internalCall: 'refuse',
      usage: { tokens: 10 },
      costUsd: 0.2,
      refusalGrounds: [{ title: 'leak' }],
      topIssues: [
        { criterionId: 'a', title: 'A', detail: 'secret', ruleRef: 'r' },
        { criterionId: 'b', title: 'B' },
        { criterionId: 'c', title: 'C' },
        { criterionId: 'd', title: 'D' },
      ],
    });
    expect(Object.keys(out).sort()).toEqual([
      'hasBlockingRule',
      'readiness',
      'topIssues',
    ]);
    expect(out.topIssues).toHaveLength(3);
    for (const i of out.topIssues)
      expect(Object.keys(i).sort()).toEqual(['criterionId', 'title']);
    expect(out.readiness).toBe('weak');
    expect(out.hasBlockingRule).toBe(true);
  });

  it('treats an unknown band and a non-true flag as null / false', () => {
    const out = pickFree({
      readiness: 'likely_approved',
      hasBlockingRule: 'yes',
    });
    expect(out.readiness).toBeNull();
    expect(out.hasBlockingRule).toBe(false);
    expect(pickFree(undefined).topIssues).toEqual([]);
  });
});

describe('pickFull', () => {
  const cited = (id: string, kind?: string) => ({
    criterionId: id,
    title: id,
    kind,
    internalCall: 'refuse',
    score: 1,
    usage: {},
    costUsd: 1,
  });

  it('moves judgement findings out of the rule findings, keeps order', () => {
    // With the working (japa#384): only then are the arrays copied at all.
    const out = pickFull(
      {
        readiness: 'competitive',
        refusalGrounds: [
          cited('rule1', 'objective'),
          cited('judge1', 'judgement'),
          cited('rule2'),
        ],
        credibilityFlags: [cited('flag1')],
      },
      true,
    );
    expect(out.refusalGrounds?.map((f) => f.criterionId)).toEqual([
      'rule1',
      'rule2',
    ]);
    // Moved judgement findings come first, then the response's own flags.
    expect(out.credibilityFlags?.map((f) => f.criterionId)).toEqual([
      'judge1',
      'flag1',
    ]);
  });

  it('never copies internal fields, however deep', () => {
    const out = pickFull(
      {
        score: 9,
        usage: { a: 1 },
        costUsd: 3,
        internalCall: 'x',
        refusalGrounds: [cited('r')],
        credibilityFlags: [cited('c')],
        strengths: [{ criterionId: 's', title: 's', detail: 'd', score: 1 }],
        statementFindings: [
          { criterionId: 'x', comment: 'c', internalCall: 'y' },
        ],
        insufficientInformation: [{ criterionId: 'i', reason: 'r', usage: 1 }],
        narrative: { paragraphs: ['p'], conclusion: 'c', score: 1 },
        blockingRule: { title: 't', internalCall: 'x', usage: 1 },
      },
      true,
    );
    const keys = allKeys(out);
    for (const f of FORBIDDEN) expect(keys.has(f)).toBe(false);
  });

  it('keeps an available country note and drops unavailable or malformed ones', () => {
    const note = {
      status: 'available',
      text: { headline: 'H', lines: ['one', '', 2, 'two'] },
      period: { label: 'Q1' },
      source: { publisher: 'P', pageUrl: 'u', fileName: 'f', caveats: ['c'] },
      extra: 'dropped',
    };
    const ok = pickFull({ countryContext: note }).countryContext;
    expect(ok?.text.lines).toEqual(['one', 'two']);
    expect(ok?.source.pageUrl).toBe('u');
    expect(ok).not.toHaveProperty('extra');

    expect(
      pickFull({ countryContext: { ...note, status: 'unavailable' } })
        .countryContext,
    ).toBeUndefined();
    expect(
      pickFull({
        countryContext: { ...note, text: { headline: '', lines: ['x'] } },
      }).countryContext,
    ).toBeUndefined();
    expect(
      pickFull({
        countryContext: { ...note, text: { headline: 'H', lines: [] } },
      }).countryContext,
    ).toBeUndefined();
    expect(pickFull({}).countryContext).toBeUndefined();
  });
});

describe('toView', () => {
  it('only an exact "full" tier gets the full builder; anything else is free', () => {
    const meta = (tier: string) => ({ tier }) as never;
    const data = { readiness: 'strong', refusalGrounds: [{ title: 'x' }] };
    expect(toView({ meta: meta('full'), data }).tier).toBe('full');
    const free = toView({ meta: meta('premium'), data });
    expect(free.tier).toBe('free');
    expect(free.data).not.toHaveProperty('refusalGrounds');
  });
});

// ── japa#384: the working gate, the reading and the blocking rule ────────────
// The rule-by-rule findings ("the working") are copied ONLY when the server's
// `meta.working` is exactly `true`. With it false they are absent from the
// view (not empty arrays) even when the payload carries them.
describe('japa#384 working gate', () => {
  const WORKING_KEYS = [
    'refusalGrounds',
    'credibilityFlags',
    'strengths',
    'statementFindings',
    'insufficientInformation',
  ];
  // A full payload that (wrongly or not) carries the whole working.
  const payload = {
    readiness: 'weak',
    hasBlockingRule: false,
    blockingRule: null,
    topIssues: [
      { criterionId: 'a', title: 'A', detail: 'secret' },
      { criterionId: 'b', title: 'B' },
      { criterionId: 'c', title: 'C' },
      { criterionId: 'd', title: 'D' },
    ],
    narrative: {
      paragraphs: ['One.', 'Two.'],
      conclusion: 'As things stand…',
      nextSteps: ['Add your tenancy agreement.'],
    },
    refusalGrounds: [{ criterionId: 'r', title: 'R', sourceQuote: 'q' }],
    credibilityFlags: [{ criterionId: 'f', title: 'F' }],
    strengths: [{ criterionId: 's', title: 'S' }],
    statementFindings: [{ criterionId: 'st', comment: 'c' }],
    insufficientInformation: [{ criterionId: 'i', reason: 'r' }],
  };
  const meta = (working: unknown) =>
    ({
      assessmentId: 'a1',
      status: 'succeeded',
      tier: 'full',
      working,
    }) as never;

  it('leaves every finding array out when working is false', () => {
    const out = pickFull(payload, false);
    for (const k of WORKING_KEYS) expect(out).not.toHaveProperty(k);
    // What the full tier always gets is still there.
    expect(out.readiness).toBe('weak');
    expect(out.narrative?.paragraphs).toEqual(['One.', 'Two.']);
    expect(out.topIssues.map((t) => t.title)).toEqual(['A', 'B', 'C']);
    for (const t of out.topIssues)
      expect(Object.keys(t).sort()).toEqual(['criterionId', 'title']);
    // Default (no second argument) is locked too.
    for (const k of WORKING_KEYS)
      expect(pickFull(payload)).not.toHaveProperty(k);
  });

  it('copies the finding arrays when working is true', () => {
    const out = pickFull(payload, true);
    for (const k of WORKING_KEYS)
      expect(Array.isArray(out[k as 'strengths'])).toBe(true);
    expect(out.refusalGrounds?.[0].criterionId).toBe('r');
  });

  it('through toView: only an exact `true` unlocks; meta.working is normalised', () => {
    for (const w of [undefined, null, false, 'true', 1, {}]) {
      const v = toView({ meta: meta(w), data: payload });
      expect(v.meta.working).toBe(false);
      for (const k of WORKING_KEYS) expect(v.data).not.toHaveProperty(k);
    }
    const on = toView({ meta: meta(true), data: payload });
    expect(on.meta.working).toBe(true);
    expect(on.data).toHaveProperty('refusalGrounds');
  });

  it('the free tier never carries the reading or the blocking rule', () => {
    const v = toView({
      meta: { ...(meta(true) as object), tier: 'free' } as never,
      data: { ...payload, blockingRule: { title: 'Bar' } },
    });
    expect(v.tier).toBe('free');
    expect(v.data).not.toHaveProperty('narrative');
    expect(v.data).not.toHaveProperty('blockingRule');
    expect(v.data).not.toHaveProperty('refusalGrounds');
  });
});

describe('japa#384 pickNarrative', () => {
  it('keeps paragraphs in order, the conclusion and the steps, nothing else', () => {
    const n = pickNarrative({
      paragraphs: ['First.', '', 2, 'Second.'],
      conclusion: 'Where it leaves you.',
      nextSteps: ['Step one.', null, 'Step two.'],
      extra: 'dropped',
    });
    expect(n).toEqual({
      paragraphs: ['First.', 'Second.'],
      conclusion: 'Where it leaves you.',
      nextSteps: ['Step one.', 'Step two.'],
    });
  });

  it('never truncates long text', () => {
    const long = 'x'.repeat(700);
    const n = pickNarrative({
      paragraphs: [long],
      conclusion: 'y'.repeat(400),
    });
    expect(n?.paragraphs[0]).toHaveLength(700);
    expect(n?.conclusion).toHaveLength(400);
    expect(n?.nextSteps).toEqual([]);
  });

  it('is null when missing, malformed, without a conclusion or without paragraphs', () => {
    expect(pickNarrative(undefined)).toBeNull();
    expect(pickNarrative(null)).toBeNull();
    expect(pickNarrative('text')).toBeNull();
    expect(pickNarrative([])).toBeNull();
    expect(pickNarrative({ paragraphs: ['p'] })).toBeNull();
    expect(pickNarrative({ paragraphs: [], conclusion: 'c' })).toBeNull();
    expect(pickNarrative({ paragraphs: [''], conclusion: 'c' })).toBeNull();
    // An old stored review (no narrative key) → null → the screen's fallback.
    expect(pickFull({ readiness: 'weak' }).narrative).toBeNull();
  });
});

describe('japa#384 pickBlockingRule', () => {
  it('keeps the five rule fields and drops the rest', () => {
    const b = pickBlockingRule({
      criterionId: 'bar1',
      title: 'Banned from entry',
      ruleRef: 'V 3.2',
      sourceQuote: 'The applicant must not be…',
      sourceUrl: 'https://example.gov/rule',
      internalCall: 'refuse',
    });
    expect(b).toEqual({
      criterionId: 'bar1',
      title: 'Banned from entry',
      ruleRef: 'V 3.2',
      sourceQuote: 'The applicant must not be…',
      sourceUrl: 'https://example.gov/rule',
    });
  });

  it('is null when absent or without a title; an empty ruleRef is null', () => {
    expect(pickBlockingRule(null)).toBeNull();
    expect(pickBlockingRule({ ruleRef: 'x' })).toBeNull();
    expect(pickBlockingRule({ title: 'T', ruleRef: '' })?.ruleRef).toBeNull();
  });

  it('is copied on the full tier whatever the working flag', () => {
    const data = { hasBlockingRule: true, blockingRule: { title: 'Bar' } };
    expect(pickFull(data, false).blockingRule?.title).toBe('Bar');
    expect(pickFull(data, true).blockingRule?.title).toBe('Bar');
  });
});
