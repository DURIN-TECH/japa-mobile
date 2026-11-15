// japa#312: what happens after the review.
//   • Review screen: the "Then you apply" section (exact copy, when it shows,
//     and that it renders with the screen's SectionTitle + Card), and the full
//     tier's "What to do next" closing step.
//   • Self-service screen: the "Where you apply" card copy and the step
//     numbering without the official card.

// primitives.tsx pulls in reanimated, whose native part is absent under jest
// (same mock as documentChecklist.test.tsx).
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
import { describe, expect, it, jest } from '@jest/globals';
import {
  nextSteps,
  showsThenYouApply,
  THEN_YOU_APPLY_BODY,
  THEN_YOU_APPLY_TITLE,
} from '../review/reviewCopy';
import { ThenYouApply } from '../review/ThenYouApply';
import {
  OFFICIAL_SITE_HEADING,
  OFFICIAL_SITE_TITLE,
  officialSiteBody,
  selfServiceSteps,
  stepNumberOf,
} from '../selfServiceSteps';
import type {
  AssessmentMeta,
  AssessmentStatus,
  AssessmentView,
  CitedFinding,
  FullAssessmentData,
} from '@/types/assessment.type';

// ── Fixtures ─────────────────────────────────────────────────────────────────
const meta = (
  status: AssessmentStatus = 'succeeded',
  tier: 'free' | 'full' = 'free',
): AssessmentMeta => ({
  assessmentId: 'a1',
  status,
  tier,
  rubricVersion: 1,
  staleReason: null,
  stale: false,
  startedAt: null,
  finishedAt: null,
  error: null,
});

const finding = (o: Partial<CitedFinding> = {}): CitedFinding => ({
  criterionId: 'c1',
  title: 'A rule',
  ruleRef: null,
  sourceUrl: '',
  sourceQuote: '',
  detail: '',
  whatWouldHelp: '',
  ...o,
});

const fullData = (o: Partial<FullAssessmentData> = {}): FullAssessmentData => ({
  readiness: 'strong',
  hasBlockingRule: false,
  refusalGrounds: [],
  credibilityFlags: [],
  strengths: [],
  statementFindings: [],
  insufficientInformation: [],
  ...o,
});

const freeView = (
  hasBlockingRule = false,
  status: AssessmentStatus = 'succeeded',
): AssessmentView => ({
  tier: 'free',
  meta: meta(status, 'free'),
  data: { readiness: 'weak', topIssues: [], hasBlockingRule },
});

const fullView = (
  d: FullAssessmentData = fullData(),
  status: AssessmentStatus = 'succeeded',
): AssessmentView => ({ tier: 'full', meta: meta(status, 'full'), data: d });

// Flatten all rendered text of a tree.
const texts = (r: ReturnType<typeof create>) =>
  r.root
    .findAll((n) => (n.type as unknown) === 'Text')
    .map((n) => [n.props.children].flat().join(''));

// ── Review screen: "Then you apply" ──────────────────────────────────────────
describe('"Then you apply" copy', () => {
  it('is the exact agreed wording', () => {
    expect(THEN_YOU_APPLY_TITLE).toBe('Then you apply');
    expect(THEN_YOU_APPLY_BODY).toBe(
      'We’ve checked what you’ve given us against the published rules for this visa. We don’t send your application for you. When you’re ready, you apply yourself on the official government site. The link is under “Where you apply” on your application.',
    );
  });

  it('uses curly punctuation and no decision words', () => {
    const all = `${THEN_YOU_APPLY_TITLE} ${THEN_YOU_APPLY_BODY}`;
    expect(all).not.toMatch(/['"]/);
    expect(all).not.toMatch(/verdict|refus|approv|likel|chance|genuine|score/i);
  });

  it('points at the card title on the self-service screen', () => {
    expect(THEN_YOU_APPLY_BODY).toContain(`“${OFFICIAL_SITE_TITLE}”`);
  });

  it('renders the title and body', () => {
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(<ThenYouApply />);
    });
    const t = texts(r);
    expect(t).toContain(THEN_YOU_APPLY_TITLE);
    expect(t).toContain(THEN_YOU_APPLY_BODY);
  });
});

describe('showsThenYouApply', () => {
  it('shows for a free result and a full result', () => {
    expect(showsThenYouApply(freeView())).toBe(true);
    expect(showsThenYouApply(fullView())).toBe(true);
    // Rules still to fix do not block: the applicant fixes them, then applies.
    expect(
      showsThenYouApply(fullView(fullData({ refusalGrounds: [finding()] }))),
    ).toBe(true);
  });

  it('does not show when a fixed rule blocks (free or full)', () => {
    expect(showsThenYouApply(freeView(true))).toBe(false);
    expect(
      showsThenYouApply(fullView(fullData({ hasBlockingRule: true }))),
    ).toBe(false);
    expect(
      showsThenYouApply(
        fullView(
          fullData({ refusalGrounds: [finding({ isMandatoryBar: true })] }),
        ),
      ),
    ).toBe(false);
    expect(
      showsThenYouApply(
        fullView(
          fullData({ refusalGrounds: [finding({ kind: 'mandatory_bar' })] }),
        ),
      ),
    ).toBe(false);
  });

  it('does not show while waiting, after a failure or with no result', () => {
    expect(showsThenYouApply(null)).toBe(false);
    expect(showsThenYouApply(freeView(false, 'queued'))).toBe(false);
    expect(showsThenYouApply(freeView(false, 'running'))).toBe(false);
    expect(showsThenYouApply(fullView(fullData(), 'failed'))).toBe(false);
    expect(
      showsThenYouApply({
        tier: 'full',
        meta: meta('succeeded', 'full'),
        data: null,
      }),
    ).toBe(false);
  });
});

// ── Review screen: full tier "What to do next" ───────────────────────────────
describe('nextSteps', () => {
  it('ends with the official site, then the re-run, when nothing is left to fix', () => {
    expect(nextSteps(fullData())).toEqual([
      'When you’re happy with it, apply on the official site.',
      'Run the review again to see where you stand.',
    ]);
  });

  it('keeps the other steps unchanged', () => {
    const d = fullData({
      refusalGrounds: [finding(), finding({ criterionId: 'c2' })],
      insufficientInformation: [{ criterionId: 'i1', title: 'x', reason: 'y' }],
      credibilityFlags: [finding({ criterionId: 'q1' })],
    });
    expect(nextSteps(d)).toEqual([
      'Fix the 2 rules that aren’t met yet.',
      'Add what we couldn’t check.',
      'Get ready for the question an officer may ask.',
      'Run the review again to see where you stand.',
    ]);
  });

  it('no longer says "Keep your documents up to date"', () => {
    expect(nextSteps(fullData()).join(' ')).not.toMatch(/up to date/);
  });
});

// ── Self-service screen: "Where you apply" card + step numbering ─────────────
describe('"Where you apply" card', () => {
  it('has the new title and heading', () => {
    expect(OFFICIAL_SITE_TITLE).toBe('Where you apply');
    expect(OFFICIAL_SITE_HEADING).toBe('Apply on the official site');
  });

  it('with a link: get ready here first, then the official site', () => {
    expect(officialSiteBody(true, 'United Kingdom')).toBe(
      'Get ready here first: your documents, your statement and your review. Then fill in your application on the official government site.',
    );
  });

  it('without a link: names the country and says the link is missing', () => {
    expect(officialSiteBody(false, 'United Kingdom')).toBe(
      'Get ready here first: your documents, your statement and your review. Then apply on the United Kingdom government’s official site. We don’t have the link for this visa yet.',
    );
  });
});

describe('selfServiceSteps', () => {
  it('with an intake: Intake 1, Documents 2, Statement 3, Review 4', () => {
    const s = selfServiceSteps(true);
    expect(stepNumberOf(s, 'intake')).toBe(1);
    expect(stepNumberOf(s, 'documents')).toBe(2);
    expect(stepNumberOf(s, 'statement')).toBe(3);
    expect(stepNumberOf(s, 'review')).toBe(4);
  });

  it('without an intake: Documents 1, Statement 2, Review 3', () => {
    const s = selfServiceSteps(false);
    expect(s).toEqual(['documents', 'statement', 'review']);
    expect(stepNumberOf(s, 'documents')).toBe(1);
    expect(stepNumberOf(s, 'statement')).toBe(2);
    expect(stepNumberOf(s, 'review')).toBe(3);
  });
});
