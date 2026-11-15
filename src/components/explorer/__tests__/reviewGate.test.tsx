// japa#309: a review needs something to read.
//   • The pure "enough to review" rule (open required intake questions, at
//     least one document that is not the refusal letter) and its copy.
//   • Reading the backend's 422 NOT_ENOUGH_TO_REVIEW body.
//   • The review state / sticky CTA: no "Review my application" while
//     something is needed or the inputs are loading; every other state as before.
//   • The review card's "still needed" lines, each opening its step.

// The cards import the review hooks (API / analytics / Firebase) and
// ReviewParts pulls in reanimated, absent under jest: stub them.
jest.mock('@/services/api.service', () => ({ apiService: {} }));
jest.mock('@/services/analytics.service', () => ({ analyticsService: {} }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'View', createAnimatedComponent: (c: unknown) => c },
  useAnimatedStyle: () => ({}),
  useSharedValue: (v: unknown) => ({ value: v }),
  withTiming: (v: unknown) => v,
  Easing: { bezier: () => ({}) },
}));

import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, jest } from '@jest/globals';
import {
  NEEDS_CONTENT_BODY,
  NEEDS_CONTENT_ELSEWHERE,
  NEEDS_CONTENT_GENERIC,
  parseReviewGaps,
  reviewContent,
  reviewGapLines,
  reviewableDocumentCount,
  type ReviewContent,
  type ReviewGaps,
} from '../review/reviewCopy';
import {
  ReviewCard,
  deriveReviewCta,
  deriveReviewState,
} from '../review/SelfServiceCards';
import { selfServiceSteps, stepNumberOf } from '../selfServiceSteps';
import type { AssessmentMeta, AssessmentResult } from '@/types/assessment.type';

const BOTH: ReviewGaps = {
  missing: ['intake', 'documents'],
  openRequiredCount: 3,
};

// ── reviewableDocumentCount ─────────────────────────────────────────────────
describe('reviewableDocumentCount', () => {
  it('leaves out the refusal letter, which the review never reads', () => {
    expect(
      reviewableDocumentCount([
        { requirementId: 'refusal-letter' },
        { requirementId: 'passport' },
        { requirementId: 'docreq:abc' },
      ]),
    ).toBe(2);
    expect(reviewableDocumentCount([{ requirementId: 'refusal-letter' }])).toBe(
      0,
    );
    expect(reviewableDocumentCount([])).toBe(0);
  });
});

// ── reviewContent ───────────────────────────────────────────────────────────
describe('reviewContent', () => {
  it('empty application: both parts are missing, intake first', () => {
    expect(
      reviewContent({ intakeOpen: 2, intakeEditable: true, documents: 0 }),
    ).toEqual({
      status: 'missing',
      gaps: { missing: ['intake', 'documents'], openRequiredCount: 2 },
    });
  });

  it('intake done but no documents: documents only', () => {
    expect(
      reviewContent({ intakeOpen: 0, intakeEditable: true, documents: 0 }),
    ).toEqual({
      status: 'missing',
      gaps: { missing: ['documents'], openRequiredCount: 0 },
    });
  });

  it('documents but open required questions: intake only', () => {
    expect(
      reviewContent({ intakeOpen: 1, intakeEditable: true, documents: 3 }),
    ).toEqual({
      status: 'missing',
      gaps: { missing: ['intake'], openRequiredCount: 1 },
    });
  });

  it('a route with no intake and one document is enough', () => {
    expect(
      reviewContent({ intakeOpen: 'none', intakeEditable: true, documents: 1 }),
    ).toEqual({
      status: 'enough',
    });
  });

  it('a route with no intake and no document still needs a document', () => {
    expect(
      reviewContent({ intakeOpen: 'none', intakeEditable: true, documents: 0 }),
    ).toEqual({
      status: 'missing',
      gaps: { missing: ['documents'], openRequiredCount: 0 },
    });
  });

  it('is loading while either part is loading', () => {
    expect(
      reviewContent({
        intakeOpen: 'loading',
        intakeEditable: true,
        documents: 0,
      }),
    ).toEqual({
      status: 'loading',
    });
    expect(
      reviewContent({
        intakeOpen: 0,
        intakeEditable: true,
        documents: 'loading',
      }),
    ).toEqual({
      status: 'loading',
    });
  });

  // Code review (japa#309): past the editable statuses (e.g. under_review) the
  // intake can no longer be saved, so its open questions never block.
  it('a non-editable intake with open questions and a document: enough', () => {
    expect(
      reviewContent({ intakeOpen: 2, intakeEditable: false, documents: 1 }),
    ).toEqual({ status: 'enough' });
    // …so the run button is offered.
    const check = reviewContent({
      intakeOpen: 2,
      intakeEditable: false,
      documents: 1,
    });
    expect(
      deriveReviewCta(
        deriveReviewState(undefined, false, { check, submitted: false }),
        false,
      ),
    ).toEqual({
      label: 'Review my application',
      action: 'run',
      withArrow: true,
    });
  });

  it('a non-editable intake with open questions and no document: documents only', () => {
    expect(
      reviewContent({ intakeOpen: 2, intakeEditable: false, documents: 0 }),
    ).toEqual({
      status: 'missing',
      gaps: { missing: ['documents'], openRequiredCount: 0 },
    });
  });

  it('a part that failed to load never blocks (the backend decides)', () => {
    expect(
      reviewContent({
        intakeOpen: 'unknown',
        intakeEditable: true,
        documents: 1,
      }),
    ).toEqual({
      status: 'enough',
    });
    expect(
      reviewContent({
        intakeOpen: 0,
        intakeEditable: true,
        documents: 'unknown',
      }),
    ).toEqual({
      status: 'enough',
    });
    expect(
      reviewContent({
        intakeOpen: 2,
        intakeEditable: true,
        documents: 'unknown',
      }),
    ).toEqual({
      status: 'missing',
      gaps: { missing: ['intake'], openRequiredCount: 2 },
    });
  });
});

// ── parseReviewGaps (422 body) ──────────────────────────────────────────────
describe('parseReviewGaps', () => {
  it('reads the backend body, fields at the top level', () => {
    expect(
      parseReviewGaps({
        success: false,
        error: 'NOT_ENOUGH_TO_REVIEW',
        message: 'Your application needs a little more…',
        missing: ['intake', 'documents'],
        openRequiredCount: 2,
      }),
    ).toEqual({ missing: ['intake', 'documents'], openRequiredCount: 2 });
  });

  it('fixes the order, drops unknown parts, and zeroes the count without intake', () => {
    expect(
      parseReviewGaps({
        missing: ['documents', 'statement', 'intake'],
        openRequiredCount: 4,
      }),
    ).toEqual({ missing: ['intake', 'documents'], openRequiredCount: 4 });
    expect(
      parseReviewGaps({ missing: ['documents'], openRequiredCount: 5 }),
    ).toEqual({ missing: ['documents'], openRequiredCount: 0 });
  });

  it('returns null when nothing usable is there', () => {
    expect(parseReviewGaps(undefined)).toBeNull();
    expect(parseReviewGaps('oops')).toBeNull();
    expect(parseReviewGaps({ missing: [] })).toBeNull();
    expect(parseReviewGaps({ missing: ['statement'] })).toBeNull();
    expect(parseReviewGaps({ data: { missing: ['intake'] } })).toBeNull();
  });

  it('tolerates a missing or odd count', () => {
    expect(parseReviewGaps({ missing: ['intake'] })).toEqual({
      missing: ['intake'],
      openRequiredCount: 0,
    });
    expect(
      parseReviewGaps({ missing: ['intake'], openRequiredCount: 'two' }),
    ).toEqual({ missing: ['intake'], openRequiredCount: 0 });
  });
});

// ── reviewGapLines (copy) ───────────────────────────────────────────────────
describe('reviewGapLines', () => {
  it('says what is needed, one line per part, with the intake step number', () => {
    expect(reviewGapLines(BOTH, 1)).toEqual([
      { gap: 'intake', text: 'Answer the 3 required questions in Step 1.' },
      { gap: 'documents', text: 'Upload at least one document.' },
    ]);
  });

  it('uses the singular for one question', () => {
    expect(
      reviewGapLines({ missing: ['intake'], openRequiredCount: 1 }, 1)[0].text,
    ).toBe('Answer the required question in Step 1.');
  });

  it('takes the step number from the screen’s steps, not a fixed 1', () => {
    const withIntake = stepNumberOf(selfServiceSteps(true), 'intake');
    const without = stepNumberOf(selfServiceSteps(false), 'intake');
    expect(reviewGapLines(BOTH, withIntake)[0].text).toContain('in Step 1.');
    // No intake step on screen (e.g. it failed to load): no step number.
    expect(reviewGapLines(BOTH, without)[0].text).toBe(
      'Answer the 3 required questions.',
    );
  });

  it('copes with an unknown count', () => {
    expect(
      reviewGapLines({ missing: ['intake'], openRequiredCount: 0 }, 1)[0].text,
    ).toBe('Answer the required questions in Step 1.');
  });

  it('avoids the decision words banned by reviewCopy.ts', () => {
    const all = [
      ...reviewGapLines(BOTH, 1).map((l) => l.text),
      NEEDS_CONTENT_BODY,
      NEEDS_CONTENT_ELSEWHERE,
      NEEDS_CONTENT_GENERIC,
    ].join(' ');
    expect(all).not.toMatch(
      /verdict|refus|approv|likely|chance|genuine|score/i,
    );
  });
});

// ── deriveReviewState / deriveReviewCta ─────────────────────────────────────
const meta = (over: Partial<AssessmentMeta> = {}): AssessmentMeta =>
  ({
    assessmentId: 'a1',
    status: 'succeeded',
    tier: 'full',
    stale: false,
    staleReason: null,
    startedAt: null,
    finishedAt: '2026-11-01T10:00:00Z',
    ...over,
  }) as unknown as AssessmentMeta;
const review = (m: AssessmentMeta, tier: 'free' | 'full' = 'full') =>
  ({
    kind: 'review',
    view: { meta: m, tier, data: null },
  }) as unknown as AssessmentResult;

const MISSING = {
  check: { status: 'missing', gaps: BOTH },
  submitted: false,
} as const;
const LOADING = { check: { status: 'loading' }, submitted: false } as const;

describe('deriveReviewState with the content check', () => {
  it('never run + something missing → needs_content, and no run button', () => {
    expect(deriveReviewState(undefined, false, MISSING)).toBe('needs_content');
    expect(
      deriveReviewState({ kind: 'empty', reason: 'none' }, false, MISSING),
    ).toBe('needs_content');
    expect(deriveReviewCta('needs_content', false)).toBeNull();
  });

  it('never run + inputs loading → checking, a disabled run button', () => {
    expect(deriveReviewState(undefined, false, LOADING)).toBe('checking');
    expect(deriveReviewCta('checking', false)).toEqual({
      label: 'Review my application',
      action: 'run',
      disabled: true,
    });
  });

  it('never run + enough (or no content given) → the run button as before', () => {
    expect(
      deriveReviewState(undefined, false, {
        check: { status: 'enough' },
        submitted: false,
      }),
    ).toBe('none');
    expect(deriveReviewState(undefined, false)).toBe('none');
    expect(deriveReviewCta('none', false)).toEqual({
      label: 'Review my application',
      action: 'run',
      withArrow: true,
    });
  });

  it('leaves every other state as it was', () => {
    // Offline with nothing cached keeps its copy.
    expect(deriveReviewState(undefined, true, MISSING)).toBe('load_error');
    expect(
      deriveReviewState({ kind: 'empty', reason: 'no_rubric' }, false, MISSING),
    ).toBe('no_rubric');
    expect(
      deriveReviewState(review(meta({ status: 'running' })), false, MISSING),
    ).toBe('running');
    expect(
      deriveReviewState(review(meta({ status: 'failed' })), false, MISSING),
    ).toBe('failed');
    expect(deriveReviewState(review(meta()), false, MISSING)).toBe('ready');
    expect(
      deriveReviewState(review(meta({ stale: true })), false, MISSING),
    ).toBe('stale_full');
    expect(
      deriveReviewState(
        review(meta({ stale: true, tier: 'free' } as never), 'free'),
        false,
        MISSING,
      ),
    ).toBe('stale_free');
  });

  it('submitted (view only): no CTA for a never-run review, whatever the content', () => {
    expect(deriveReviewCta('needs_content', true)).toBeNull();
    expect(deriveReviewCta('checking', true)).toBeNull();
  });

  it('submitted (view only): the content check is ignored, so the state is as before', () => {
    const documentsOnly: { check: ReviewContent; submitted: boolean } = {
      check: {
        status: 'missing',
        gaps: { missing: ['documents'], openRequiredCount: 0 },
      },
      submitted: true,
    };
    expect(deriveReviewState(undefined, false, documentsOnly)).toBe('none');
    expect(
      deriveReviewState({ kind: 'empty', reason: 'none' }, false, {
        ...MISSING,
        submitted: true,
      }),
    ).toBe('none');
    expect(
      deriveReviewState(undefined, false, { ...LOADING, submitted: true }),
    ).toBe('none');
    // …and a submitted never-run review still has no sticky bar.
    expect(deriveReviewCta('none', true)).toBeNull();
  });
});

// ── ReviewCard: the "still needed" lines ────────────────────────────────────
function texts(r: ReactTestRenderer): string[] {
  return r.root
    .findAllByType(Text)
    .map((t) => [].concat(t.props.children as never).join(''));
}

describe('ReviewCard needs_content', () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  it('lists one line per missing part, and each line opens its step', () => {
    const onOpenGap = jest.fn();
    let r!: ReactTestRenderer;
    act(() => {
      r = create(
        <ReviewCard
          state="needs_content"
          offlineCached={false}
          onSeeLast={() => undefined}
          onRetryLoad={() => undefined}
          gaps={BOTH}
          intakeStep={1}
          onOpenGap={onOpenGap}
        />,
      );
    });
    const shown = texts(r);
    expect(shown).toContain(NEEDS_CONTENT_BODY);
    expect(shown).toContain('Answer the 3 required questions in Step 1.');
    expect(shown).toContain('Upload at least one document.');
    expect(shown.join(' ')).not.toContain('Review my application');

    const buttons = r.root.findAll(
      (n) =>
        n.props.accessibilityRole === 'button' &&
        typeof n.props.onPress === 'function' &&
        typeof n.props.accessibilityLabel === 'string',
    );
    const byLabel = (l: string) =>
      buttons.find((b) => b.props.accessibilityLabel === l)!;
    act(() =>
      byLabel('Answer the 3 required questions in Step 1.').props.onPress(),
    );
    act(() => byLabel('Upload at least one document.').props.onPress());
    expect(onOpenGap.mock.calls).toEqual([['intake'], ['documents']]);
    act(() => r.unmount());
  });

  it('a submitted application missing content draws the card as before: no lines, no action', () => {
    // What the hub does for e.g. `submitted_to_embassy`, never reviewed, with
    // no documents and open questions.
    const state = deriveReviewState(undefined, false, {
      check: { status: 'missing', gaps: BOTH },
      submitted: true,
    });
    let r!: ReactTestRenderer;
    act(() => {
      r = create(
        <ReviewCard
          state={state}
          offlineCached={false}
          onSeeLast={() => undefined}
          onRetryLoad={() => undefined}
          gaps={BOTH}
          intakeStep={1}
          onOpenGap={() => undefined}
        />,
      );
    });
    const shown = texts(r);
    expect(shown).toContain('See how ready you are');
    expect(shown.join(' ')).toContain('shows you what to fix first');
    expect(shown).not.toContain(NEEDS_CONTENT_BODY);
    expect(shown.join(' ')).not.toMatch(
      /Upload at least one document|Answer the/,
    );
    expect(
      r.root.findAll(
        (n) =>
          n.props.accessibilityRole === 'button' &&
          typeof n.props.onPress === 'function',
      ),
    ).toHaveLength(0);
    act(() => r.unmount());
  });

  it('checking draws the never-run card', () => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(
        <ReviewCard
          state="checking"
          offlineCached={false}
          onSeeLast={() => undefined}
          onRetryLoad={() => undefined}
        />,
      );
    });
    expect(texts(r)).toContain('See how ready you are');
    act(() => r.unmount());
  });
});
