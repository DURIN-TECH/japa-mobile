// japa#308: "What we couldn’t tell" lists only what the applicant can act on.
//   • couldntTell: which `notAssessed` values are listed, and old results
//   • nextSteps: "Add what we couldn’t check." only for listed items
//   • the server payload path: pickFull → couldntTell → the section
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

// The hook module imports the API/analytics services (Firebase); the pure
// whitelist builder under test doesn't use them.
jest.mock('@/services/api.service', () => ({ apiService: {} }));
jest.mock('@/services/analytics.service', () => ({ analyticsService: {} }));

import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  COULDNT_TELL_SKIPPED_LINE,
  couldntTell,
  nextSteps,
} from '../review/reviewCopy';
import { CouldntTell } from '../review/CouldntTell';
import { pickFull } from '@/hooks/useCaseOfficer';
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
      'Some rules in the guidance can’t be checked from your documents or answers here, so they aren’t part of this review.',
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

// ── Server payload → pickFull → couldntTell → section ────────────────────────
// The screen only ever sees `pickFull`'s output, so the marker must survive the
// whitelist. Shapes follow the backend's `InsufficientItem` (#308) and the UK
// Standard Visitor v2 replay fixture (criterion ids and titles copied from it).
const NO_TRIGGER_REASON =
  'the guidance does not say which answer this rule depends on';
const NOT_CHECKABLE_REASON =
  'not checked: the guidance names no document that would show this';

const serverPayload = (insufficientInformation: unknown[]) => ({
  readiness: 'not_ready',
  confidence: 'low', // internal: never copied
  score: 12, // internal: never copied
  hasBlockingRule: false,
  refusalGrounds: [
    {
      criterionId: 'crit_e19c2e8b5538e282',
      title:
        'Passport or identity document establishing identity and nationality',
      kind: 'objective',
      detail: 'We couldn’t find this in your documents: Passport',
    },
  ],
  credibilityFlags: [],
  strengths: [],
  statementFindings: [],
  insufficientInformation,
});

describe('server payload through pickFull', () => {
  // After #308: staff-only items, one of each actionable kind, an unread
  // upload, and a repeated criterionId.
  const newShape = serverPayload([
    {
      criterionId: 'crit_f79abbbfcd5e443e',
      title:
        'Private foster care: written statement of consent from parent or guardian',
      reason: NO_TRIGGER_REASON,
      notAssessed: 'no_trigger',
    },
    {
      criterionId: 'crit_f87b0872fda83810',
      title: 'Secretary of State personal exclusion direction',
      reason: NOT_CHECKABLE_REASON,
      notAssessed: 'not_in_documents',
    },
    {
      criterionId: 'crit_a1f09ac8e949d1cc',
      title: 'Required fee paid',
      reason: NOT_CHECKABLE_REASON,
      notAssessed: 'not_in_documents',
      layerKey: 'gb-visitor',
    },
    {
      criterionId: 'crit_x_unanswered',
      title: 'Visiting for a permitted activity',
      reason: 'Answer the question about what you’ll do on your visit.',
      notAssessed: 'unanswered',
    },
    {
      criterionId: 'crit_x_unanswered',
      title: 'Visiting for a permitted activity',
      reason: 'Answer the question about how long you’ll stay.',
      notAssessed: 'unanswered',
    },
    {
      criterionId: 'crit_x_fact',
      title: 'Funds available for the visit',
      reason: 'Tell us how much you hold.',
      notAssessed: 'missing_fact',
    },
    {
      criterionId: 'document:doc123',
      title: 'Bank statement',
      reason:
        'We couldn’t read this upload, so nothing in it was checked. Upload a clearer copy.',
      documentId: 'doc123',
    },
  ]);

  it('carries notAssessed, documentId and layerKey through the whitelist', () => {
    const items = pickFull(newShape).insufficientInformation;
    expect(items.map((i) => i.notAssessed)).toEqual([
      'no_trigger',
      'not_in_documents',
      'not_in_documents',
      'unanswered',
      'unanswered',
      'missing_fact',
      undefined,
    ]);
    expect(items[6].documentId).toBe('doc123');
    expect(items[2].layerKey).toBe('gb-visitor');
  });

  it('lists only the actionable items and keeps the internal fields out', () => {
    const d = pickFull(newShape);
    const { shown, anyHidden } = couldntTell(d.insufficientInformation);
    expect(shown.map((i) => i.criterionId)).toEqual([
      'crit_x_unanswered',
      'crit_x_unanswered',
      'crit_x_fact',
      'document:doc123',
    ]);
    expect(anyHidden).toBe(true);
    expect(nextSteps(d)).toContain('Add what we couldn’t check.');
    expect(d).not.toHaveProperty('score');
    expect(d).not.toHaveProperty('confidence');
  });

  it('renders no staff text, ends with the closing line, warns about no key', () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    const t = texts(render(pickFull(newShape).insufficientInformation)).join(
      '\n',
    );
    expect(t).toContain('Bank statement');
    expect(t).toContain('Funds available for the visit');
    expect(t).not.toMatch(/Private foster care|exclusion direction|fee paid/);
    expect(t).not.toContain(NO_TRIGGER_REASON);
    expect(t).not.toContain(NOT_CHECKABLE_REASON);
    expect(t.endsWith(COULDNT_TELL_SKIPPED_LINE)).toBe(true);
    expect(
      err.mock.calls.filter((c) => String(c[0]).includes('same key')),
    ).toEqual([]);
    err.mockRestore();
  });

  it('with only staff-only items, shows the title and the line, no next step', () => {
    const d = pickFull(
      serverPayload([
        {
          criterionId: 'crit_8bd65e5a3974c02d',
          title: 'Biometrics provided when required',
          reason: NOT_CHECKABLE_REASON,
          notAssessed: 'not_in_documents',
        },
      ]),
    );
    expect(texts(render(d.insufficientInformation))).toEqual([
      'What we couldn’t tell',
      COULDNT_TELL_SKIPPED_LINE,
    ]);
    expect(nextSteps(d)).not.toContain('Add what we couldn’t check.');
  });

  it('renders an old stored result (no markers) as before, without crashing', () => {
    // Stored before the marker existed: no notAssessed on any item.
    const d = pickFull(
      serverPayload([
        { criterionId: 'crit_old', title: 'Old item', reason: 'Old reason.' },
        { criterionId: 'crit_old', title: 'Old item', reason: 'Old reason.' },
      ]),
    );
    const t = texts(render(d.insufficientInformation));
    expect(t.filter((x) => x === 'Old item')).toHaveLength(2);
    expect(t).not.toContain(COULDNT_TELL_SKIPPED_LINE);
    expect(nextSteps(d)).toContain('Add what we couldn’t check.');
  });
});
