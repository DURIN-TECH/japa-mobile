// japa#308: "What we couldn’t tell" lists only what the applicant can act on.
//   • couldntTell: which `notAssessed` values are listed, and old results
//   • nextSteps: "Add what we couldn’t check." only for listed items
//   • CouldntTell section: the three outcomes, the closing line, no staff text,
//     and unique keys when two items share a criterionId

// primitives.tsx pulls in reanimated, whose native part is absent under jest
// (same mock as afterReview.test.tsx).
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'View', createAnimatedComponent: (c: unknown) => c },
  useAnimatedStyle: () => ({}),
  useSharedValue: (v: unknown) => ({ value: v }),
  withTiming: (v: unknown) => v,
  Easing: { bezier: () => ({}) },
}));

import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  COULDNT_TELL_SKIPPED_LINE,
  couldntTell,
  nextSteps,
} from '../review/reviewCopy';
import { CouldntTell } from '../review/CouldntTell';
import type {
  FullAssessmentData,
  InsufficientItem,
} from '@/types/assessment.type';

// ── Fixtures ─────────────────────────────────────────────────────────────────
const item = (o: Partial<InsufficientItem> = {}): InsufficientItem => ({
  criterionId: 'c1',
  title: 'A rule',
  reason: 'Add your bank statement.',
  ...o,
});

// Staff-only items, with the backend's staff wording in `reason`.
const noTrigger = (id = 'nt1') =>
  item({
    criterionId: id,
    title: 'Private foster care',
    reason: 'the guidance does not say which answer this rule depends on',
    notAssessed: 'no_trigger',
  });
const notInDocs = (id = 'nd1') =>
  item({
    criterionId: id,
    title: 'Exclusion order',
    reason: 'not checked: the guidance names no document that would show this',
    notAssessed: 'not_in_documents',
  });

const fullData = (o: Partial<FullAssessmentData> = {}): FullAssessmentData => ({
  readiness: 'weak',
  hasBlockingRule: false,
  refusalGrounds: [],
  credibilityFlags: [],
  strengths: [],
  statementFindings: [],
  insufficientInformation: [],
  ...o,
});

const texts = (r: ReturnType<typeof create>) =>
  r.root
    .findAll((n) => (n.type as unknown) === 'Text')
    .map((n) => [n.props.children].flat().join(''));

const render = (items: InsufficientItem[] | undefined) => {
  let r!: ReturnType<typeof create>;
  act(() => {
    r = create(<CouldntTell items={items} />);
  });
  return r;
};

// ── couldntTell ──────────────────────────────────────────────────────────────
describe('couldntTell', () => {
  it('lists items with no marker, unanswered and missing_fact', () => {
    const a = item({ criterionId: 'a' });
    const b = item({ criterionId: 'b', notAssessed: 'unanswered' });
    const c = item({ criterionId: 'c', notAssessed: 'missing_fact' });
    expect(couldntTell([a, b, c])).toEqual({
      shown: [a, b, c],
      anyHidden: false,
    });
  });

  it('leaves out no_trigger and not_in_documents, and says so', () => {
    const a = item({ criterionId: 'a' });
    expect(couldntTell([noTrigger(), a, notInDocs()])).toEqual({
      shown: [a],
      anyHidden: true,
    });
  });

  it('leaves out a marker it does not know (staff text by default)', () => {
    const odd = item({
      notAssessed: 'something_new' as InsufficientItem['notAssessed'],
    });
    expect(couldntTell([odd])).toEqual({ shown: [], anyHidden: true });
  });

  it('keeps every item of an old result stored before the marker existed', () => {
    const old = [item({ criterionId: 'x' }), item({ criterionId: 'x' })];
    expect(couldntTell(old)).toEqual({ shown: old, anyHidden: false });
  });

  it('tolerates a missing array', () => {
    expect(couldntTell(undefined)).toEqual({ shown: [], anyHidden: false });
    expect(couldntTell(null)).toEqual({ shown: [], anyHidden: false });
  });
});

// ── nextSteps ────────────────────────────────────────────────────────────────
describe('nextSteps and what we couldn’t check', () => {
  const ADD = 'Add what we couldn’t check.';

  it('asks for it when an actionable item is listed', () => {
    const d = fullData({
      insufficientInformation: [
        noTrigger(),
        item({ notAssessed: 'unanswered' }),
      ],
    });
    expect(nextSteps(d)).toContain(ADD);
  });

  it('does not ask for it when only staff-only items are there', () => {
    const d = fullData({ insufficientInformation: [noTrigger(), notInDocs()] });
    expect(nextSteps(d)).not.toContain(ADD);
    // With nothing else to fix, the closing step is the official site (#312).
    expect(nextSteps(d)[0]).toBe(
      'When you’re happy with it, apply on the official site.',
    );
  });
});

// ── CouldntTell section ──────────────────────────────────────────────────────
describe('CouldntTell section', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('is the exact agreed closing line, with no count and no rule', () => {
    expect(COULDNT_TELL_SKIPPED_LINE).toBe(
      'Some rules in the guidance don’t apply to most people, so we didn’t check them.',
    );
    expect(COULDNT_TELL_SKIPPED_LINE).not.toMatch(/\d/);
  });

  it('draws nothing when there was nothing at all', () => {
    expect(render([]).toJSON()).toBeNull();
    expect(render(undefined).toJSON()).toBeNull();
  });

  it('shows only the title and the line when nothing actionable is left', () => {
    const t = texts(render([noTrigger(), notInDocs()]));
    expect(t).toEqual(['What we couldn’t tell', COULDNT_TELL_SKIPPED_LINE]);
  });

  it('lists actionable items, ends with the line, and shows no staff text', () => {
    const t = texts(
      render([
        noTrigger(),
        item({ title: 'Bank statement', notAssessed: 'missing_fact' }),
        notInDocs(),
      ]),
    ).join('\n');
    expect(t).toContain('What we couldn’t tell');
    expect(t).toContain('Bank statement');
    expect(t).toContain('Add your bank statement.');
    expect(t.endsWith(COULDNT_TELL_SKIPPED_LINE)).toBe(true);
    // Neither hidden title nor its staff reason reaches the screen.
    expect(t).not.toMatch(/Private foster care|Exclusion order/);
    expect(t).not.toMatch(/guidance does not say|not checked:/);
  });

  it('has no line when nothing was left out', () => {
    const t = texts(render([item()]));
    expect(t).not.toContain(COULDNT_TELL_SKIPPED_LINE);
  });

  it('renders two items with the same criterionId without a key warning', () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    const r = render([
      item({ criterionId: 'dup', title: 'First' }),
      item({ criterionId: 'dup', title: 'Second' }),
    ]);
    const t = texts(r).join('\n');
    expect(t).toContain('First');
    expect(t).toContain('Second');
    const keyWarnings = err.mock.calls.filter((c) =>
      String(c[0]).includes('same key'),
    );
    expect(keyWarnings).toEqual([]);
  });
});
