// Unit tests: timeline de-duplication and trimming (japa#274).
import { describe, expect, it } from '@jest/globals';
import { TIMELINE_PREVIEW, dedupeSteps, trimSteps } from '../timelineTrim';
import type { AppStep } from '@/types/explorer.type';

const step = (over: Partial<AppStep> = {}): AppStep => ({
  t: 'Embassy decision',
  desc: 'Await visa decision.',
  d: 'Jan 13, 2027',
  s: 'next',
  by: 'system',
  ...over,
});

describe('dedupeSteps', () => {
  it('collapses 4 consecutive identical entries into one', () => {
    expect(dedupeSteps([step(), step(), step(), step()])).toHaveLength(1);
  });

  it('keeps entries that differ in title, description, date or actor', () => {
    const out = dedupeSteps([
      step(),
      step({ t: 'Other' }),
      step({ t: 'Other', desc: 'x' }),
      step({ t: 'Other', desc: 'x', d: 'Jan 14, 2027' }),
      step({ t: 'Other', desc: 'x', d: 'Jan 14, 2027', by: 'agent' }),
    ]);
    expect(out).toHaveLength(5);
  });

  it('only collapses adjacent repeats', () => {
    const out = dedupeSteps([step(), step({ t: 'B' }), step()]);
    expect(out.map((s) => s.t)).toEqual([
      'Embassy decision',
      'B',
      'Embassy decision',
    ]);
  });

  it('handles an empty list', () => {
    expect(dedupeSteps([])).toEqual([]);
  });
});

describe('trimSteps', () => {
  const many = Array.from({ length: 7 }, (_, i) => step({ t: `Step ${i}` }));

  it('shows the first 3 collapsed, with the total for "Show all (N)"', () => {
    const r = trimSteps(many, false);
    expect(r.visible.map((s) => s.t)).toEqual(['Step 0', 'Step 1', 'Step 2']);
    expect(r.total).toBe(7);
    expect(r.canToggle).toBe(true);
  });

  it('shows everything when expanded', () => {
    expect(trimSteps(many, true).visible).toHaveLength(7);
  });

  it('needs no toggle at or under the limit', () => {
    const few = many.slice(0, TIMELINE_PREVIEW);
    const r = trimSteps(few, false);
    expect(r.visible).toHaveLength(TIMELINE_PREVIEW);
    expect(r.canToggle).toBe(false);
  });
});
