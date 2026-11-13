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
import { pickFree, pickFull, toView } from '../useCaseOfficer';

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
    const out = pickFull({
      readiness: 'competitive',
      refusalGrounds: [
        cited('rule1', 'objective'),
        cited('judge1', 'judgement'),
        cited('rule2'),
      ],
      credibilityFlags: [cited('flag1')],
    });
    expect(out.refusalGrounds.map((f) => f.criterionId)).toEqual([
      'rule1',
      'rule2',
    ]);
    // Moved judgement findings come first, then the response's own flags.
    expect(out.credibilityFlags.map((f) => f.criterionId)).toEqual([
      'judge1',
      'flag1',
    ]);
  });

  it('never copies internal fields, however deep', () => {
    const out = pickFull({
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
    });
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
