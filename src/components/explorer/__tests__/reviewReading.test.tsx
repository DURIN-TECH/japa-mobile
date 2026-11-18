// japa#384: the review reading, the locked panel and the collapsed working.
//   • Parts: ReadingCard, NextStepsCard, LockedPanel, WorkingToggle
//   • Helpers: fullTierBlocked from `hasBlockingRule` / `blockingRule` (the
//     finding arrays are absent without the working), fullBlockingBody
//   • Copy: no app-written string says refusal, verdict, approved, likelihood
//     or a score; the free upgrade panel promises the reading, not the rules
//   • The review screen, composed per state: full + reading (locked), full +
//     working (collapsed, one tap opens), reading missing, full blocked, free
//     tier unchanged, and the analytics (`review_viewed` + locked seen)
//
// The screen lives in src/app/, which expo-router treats as routes, so its
// test lives here with the other review tests.

// ── Native / service stubs (absent under jest) ───────────────────────────────
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'View', createAnimatedComponent: (c: unknown) => c },
  FadeIn: { duration: () => undefined },
  useAnimatedStyle: () => ({}),
  useAnimatedProps: () => ({}),
  useReducedMotion: () => true,
  useSharedValue: (v: unknown) => ({ value: v }),
  withTiming: (v: unknown) => v,
  Easing: { bezier: () => ({}) },
}));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('expo-haptics', () => ({
  notificationAsync: () => Promise.resolve(),
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('@/services/api.service', () => ({ apiService: {} }));
const mockTrack = jest.fn();
jest.mock('@/services/analytics.service', () => ({
  analyticsService: {
    trackReviewEvent: (...a: unknown[]) => mockTrack(...a),
  },
}));
jest.mock('@/config/env', () => ({ isSelfServiceOnly: () => false }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'app1' }),
  useFocusEffect: () => undefined,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: () => undefined }),
  useQuery: () => ({}),
  useMutation: () => ({}),
}));
jest.mock('@/hooks/useApplications', () => ({
  useApplication: () => ({
    data: { visaTypeName: 'Visitor', countryCode: 'GB', visaTypeId: 'v1' },
  }),
}));
jest.mock('@/hooks/useVisaTypes', () => ({
  useVisaType: () => ({ data: undefined }),
}));
// The real whitelist builders (toView …), with the two network hooks stubbed:
// each test sets the review the screen sees in `mockAssessment`.
let mockAssessment: unknown = undefined;
jest.mock('@/hooks/useCaseOfficer', () => {
  const actual = jest.requireActual('@/hooks/useCaseOfficer') as object;
  return {
    ...actual,
    useAssessment: () => ({
      isLoading: false,
      isError: false,
      data: mockAssessment,
      refetch: () => undefined,
    }),
    useStartReview: () => ({
      start: async () => 'started',
      isStarting: false,
      notEnough: null,
    }),
  };
});

import React from 'react';
import { ScrollView, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  LockedPanel,
  NextStepsCard,
  ReadingCard,
  WorkingToggle,
} from '../review/ReviewParts';
import * as copy from '../review/reviewCopy';
import {
  FREE_BLOCKING_BODY,
  LOCKED_WORKING_BODY,
  LOCKED_WORKING_TITLE,
  READING_MISSING_NOTE,
  fullBlockingBody,
  fullTierBlocked,
  showsThenYouApply,
} from '../review/reviewCopy';
import { UPGRADE_READING_ROW } from '../UpgradePrompt';
import { toView } from '@/hooks/useCaseOfficer';
import ReviewScreen from '@/app/self-service/[id]/review';
import type { FullAssessmentData } from '@/types/assessment.type';

// ── Helpers ──────────────────────────────────────────────────────────────────
const texts = (r: ReactTestRenderer) =>
  r.root
    .findAllByType(Text)
    .map((t) =>
      ([] as unknown[])
        .concat(t.props.children)
        .filter((c) => typeof c === 'string' || typeof c === 'number')
        .join(''),
    )
    .filter(Boolean);

const render = (el: React.ReactElement) => {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(el);
  });
  return r;
};

const NARRATIVE = {
  paragraphs: [
    'You told us you plan to spend 15 days in Manchester visiting your brother.',
    'Your salary credits of ₦850,000 a month match what you told us.',
    'Taken together, the reason for your visit is clear.',
  ],
  conclusion:
    'As things stand, what you have sent is not yet enough for an officer to be satisfied that you will return home.',
  nextSteps: [
    'Add your tenancy agreement.',
    'Add proof of your rent payments.',
  ],
};

const fullData = (o: Partial<FullAssessmentData> = {}): FullAssessmentData => ({
  readiness: 'weak',
  hasBlockingRule: false,
  blockingRule: null,
  narrative: null,
  topIssues: [],
  ...o,
});

// ── Parts ────────────────────────────────────────────────────────────────────
describe('ReadingCard', () => {
  it('shows every paragraph in order, then the eyebrow and the conclusion', () => {
    const t = texts(render(<ReadingCard narrative={NARRATIVE} />));
    expect(t).toEqual([
      ...NARRATIVE.paragraphs,
      'Where this leaves you',
      NARRATIVE.conclusion,
    ]);
  });

  it('never truncates (no numberOfLines on any text)', () => {
    const r = render(<ReadingCard narrative={NARRATIVE} />);
    for (const t of r.root.findAllByType(Text))
      expect(t.props.numberOfLines).toBeUndefined();
  });
});

describe('NextStepsCard', () => {
  it('numbers each step from 1', () => {
    const t = texts(render(<NextStepsCard steps={NARRATIVE.nextSteps} />));
    expect(t).toEqual([
      '1',
      NARRATIVE.nextSteps[0],
      '2',
      NARRATIVE.nextSteps[1],
    ]);
  });
});

describe('LockedPanel', () => {
  it('is static text: title + body, one label, nothing pressable', () => {
    const r = render(<LockedPanel />);
    expect(texts(r)).toEqual([LOCKED_WORKING_TITLE, LOCKED_WORKING_BODY]);
    const root = r.root.findAll(
      (n) => n.props.accessibilityRole === 'text' && !!n.props.accessible,
    )[0];
    expect(root.props.accessibilityLabel).toBe(
      `${LOCKED_WORKING_TITLE}. ${LOCKED_WORKING_BODY}`,
    );
    // No button, link or press handler anywhere in it.
    expect(
      r.root.findAll((n) => typeof n.props.onPress === 'function'),
    ).toEqual([]);
    expect(
      r.root.findAll(
        (n) =>
          n.props.accessibilityRole === 'button' ||
          n.props.accessibilityRole === 'link',
      ),
    ).toEqual([]);
  });

  it('body says what it shows and that it isn’t in the current plan, no price', () => {
    expect(LOCKED_WORKING_BODY).toMatch(/each rule we checked/);
    expect(LOCKED_WORKING_BODY).toMatch(/published wording/);
    expect(LOCKED_WORKING_BODY).toMatch(/isn’t in your current plan/);
    expect(LOCKED_WORKING_BODY).not.toMatch(/[₦$£€]|\d/);
  });
});

describe('WorkingToggle', () => {
  it('collapsed: "Show each rule", expanded false, chevron not turned', () => {
    const onToggle = jest.fn();
    const r = render(<WorkingToggle open={false} onToggle={onToggle} />);
    expect(texts(r)[0]).toBe('Show each rule');
    const btn = r.root.findAll(
      (n) => n.props.accessibilityRole === 'button',
    )[0];
    expect(btn.props.accessibilityState).toEqual({ expanded: false });
    expect(btn.props.accessibilityHint).toBe('Shows each rule we checked');
    act(() => btn.props.onPress());
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('open: "Hide each rule", expanded true', () => {
    const r = render(<WorkingToggle open onToggle={() => undefined} />);
    expect(texts(r)[0]).toBe('Hide each rule');
    const btn = r.root.findAll(
      (n) => n.props.accessibilityRole === 'button',
    )[0];
    expect(btn.props.accessibilityState).toEqual({ expanded: true });
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────
describe('fullTierBlocked (japa#384)', () => {
  it('is blocked from hasBlockingRule or blockingRule, with no finding arrays', () => {
    expect(fullTierBlocked(fullData({ hasBlockingRule: true }))).toBe(true);
    expect(
      fullTierBlocked(
        fullData({
          blockingRule: {
            criterionId: 'b',
            title: 'Bar',
            ruleRef: null,
            sourceQuote: '',
            sourceUrl: '',
          },
        }),
      ),
    ).toBe(true);
    expect(fullTierBlocked(fullData())).toBe(false);
    // An unblocked full result without the working still gets "Then you apply".
    expect(
      showsThenYouApply(
        toView({
          meta: { status: 'succeeded', tier: 'full', working: false } as never,
          data: { readiness: 'weak', hasBlockingRule: false },
        }),
      ),
    ).toBe(true);
  });

  it('fullBlockingBody: the rule title first, or the generic body', () => {
    expect(fullBlockingBody('No previous ban')).toBe(
      'No previous ban. This is a fixed rule, checked from the details on your profile. It isn’t a judgement about you.',
    );
    expect(fullBlockingBody(null)).toBe(FREE_BLOCKING_BODY);
    expect(fullBlockingBody('')).toBe(FREE_BLOCKING_BODY);
  });
});

// ── Copy rule (#43) ──────────────────────────────────────────────────────────
describe('app-written copy', () => {
  it('never says refusal, verdict, approved, likelihood or a score', () => {
    // Every string exported from reviewCopy, bar the refusal-letter
    // requirement id (a data key, never shown), plus the upgrade promise.
    const strings = [
      ...Object.entries(copy)
        .filter(([k]) => k !== 'REFUSAL_LETTER_REQUIREMENT_ID')
        .map(([, v]): unknown => v)
        .filter((v): v is string => typeof v === 'string'),
      UPGRADE_READING_ROW,
    ];
    for (const s of strings)
      expect(s).not.toMatch(/refus|verdict|approv|likel|score/i);
  });

  it('the free upgrade panel promises the reading, not the rule-by-rule list', () => {
    expect(UPGRADE_READING_ROW).toBe(
      'A full reading of your application, in plain English',
    );
  });
});

// ── The screen, per state ────────────────────────────────────────────────────
const meta = (o: Record<string, unknown> = {}) => ({
  assessmentId: 'as1',
  status: 'succeeded',
  tier: 'full',
  working: false,
  rubricVersion: 1,
  staleReason: null,
  stale: false,
  startedAt: null,
  finishedAt: '2026-11-16T10:00:00Z',
  error: null,
  ...o,
});
// A full payload that also carries the working (the gate must still hide it).
const fullPayload = (o: Record<string, unknown> = {}) => ({
  readiness: 'weak',
  hasBlockingRule: false,
  blockingRule: null,
  narrative: NARRATIVE,
  topIssues: [
    { criterionId: 't1', title: 'Show where your money comes from' },
    { criterionId: 't2', title: 'Show your home in Lagos' },
  ],
  refusalGrounds: [
    {
      criterionId: 'r1',
      title: 'Funds rule',
      kind: 'objective',
      sourceQuote: 'quote',
      sourceUrl: 'https://example.gov/r',
      detail: 'Detail',
    },
  ],
  credibilityFlags: [{ criterionId: 'c1', title: 'Purpose', detail: 'd' }],
  strengths: [{ criterionId: 's1', title: 'Your job is documented' }],
  statementFindings: [],
  insufficientInformation: [],
  ...o,
});
const showReview = (m: Record<string, unknown>, data: unknown) => {
  mockAssessment = { kind: 'review', view: toView({ meta: m as never, data }) };
};
const WORKING_HEADERS = [
  'Rules not met yet',
  'What an officer may ask about',
  'In your statement',
  'What we couldn’t tell',
  'What you’ve got',
  'What to do next',
];

describe('ReviewScreen (japa#384)', () => {
  beforeEach(() => {
    mockTrack.mockClear();
    mockAssessment = undefined;
  });

  it('full, reading, no working: the reading, steps, disclaimer, locked panel, then you apply', () => {
    showReview(meta(), fullPayload());
    const t = texts(render(<ReviewScreen />));
    const at = (s: string) => t.indexOf(s);
    expect(at('Our reading of your application')).toBeGreaterThan(-1);
    expect(at(NARRATIVE.paragraphs[0])).toBeLessThan(
      at(NARRATIVE.paragraphs[2]),
    );
    expect(at(NARRATIVE.conclusion)).toBeGreaterThan(
      at(NARRATIVE.paragraphs[2]),
    );
    expect(at('What would change this')).toBeGreaterThan(
      at(NARRATIVE.conclusion),
    );
    expect(at(copy.DISCLAIMER)).toBeGreaterThan(at(NARRATIVE.nextSteps[1]));
    expect(at(LOCKED_WORKING_TITLE)).toBeGreaterThan(at(copy.DISCLAIMER));
    expect(at('Then you apply')).toBeGreaterThan(at(LOCKED_WORKING_TITLE));
    // None of the working is drawn, though the payload carried it.
    for (const h of WORKING_HEADERS) expect(t).not.toContain(h);
    expect(t).not.toContain('Funds rule');
    expect(t).not.toContain('How each rule was applied');
    // Analytics: viewed with the two new flags.
    expect(mockTrack).toHaveBeenCalledWith('review_viewed', {
      tier: 'full',
      band: 'weak',
      working: false,
      hasNarrative: true,
    });
  });

  it('no next steps: no "What would change this" header', () => {
    showReview(
      meta(),
      fullPayload({ narrative: { ...NARRATIVE, nextSteps: [] } }),
    );
    expect(texts(render(<ReviewScreen />))).not.toContain(
      'What would change this',
    );
  });

  it('full with the working: collapsed under "How each rule was applied", one tap opens', () => {
    showReview(meta({ working: true }), fullPayload());
    const r = render(<ReviewScreen />);
    let t = texts(r);
    expect(t).toContain('Our reading of your application');
    expect(t).toContain('How each rule was applied');
    expect(t).toContain('Show each rule');
    expect(t).not.toContain(LOCKED_WORKING_TITLE);
    expect(t).not.toContain('Rules not met yet');
    const toggle = r.root.findAll(
      (n) =>
        n.props.accessibilityRole === 'button' &&
        n.props.accessibilityLabel === 'Show each rule' &&
        typeof n.props.onPress === 'function',
    )[0];
    act(() => toggle.props.onPress());
    t = texts(r);
    expect(t).toContain('Hide each rule');
    expect(t).toContain('Rules not met yet');
    expect(t).toContain('Funds rule');
    expect(t).toContain('What to do next');
    expect(t.indexOf('Then you apply')).toBeGreaterThan(
      t.indexOf('What to do next'),
    );
    expect(mockTrack).toHaveBeenCalledWith(
      'review_viewed',
      expect.objectContaining({ working: true, hasNarrative: true }),
    );
  });

  it('no reading: InfoNote, "Start with these" from topIssues, then the locked panel', () => {
    showReview(meta(), fullPayload({ narrative: null }));
    const t = texts(render(<ReviewScreen />));
    expect(t).toContain(READING_MISSING_NOTE);
    expect(t.indexOf('Start with these')).toBeGreaterThan(
      t.indexOf(READING_MISSING_NOTE),
    );
    expect(t).toContain('Show where your money comes from');
    expect(t).toContain(LOCKED_WORKING_TITLE);
    expect(t).not.toContain('Our reading of your application');
    expect(t).not.toContain('What would change this');
    expect(mockTrack).toHaveBeenCalledWith(
      'review_viewed',
      expect.objectContaining({ hasNarrative: false }),
    );
  });

  it('no reading and no top issues: the "Nothing stood out" row', () => {
    showReview(meta(), fullPayload({ narrative: null, topIssues: [] }));
    expect(texts(render(<ReviewScreen />))).toContain(copy.NOTHING_STOOD_OUT);
  });

  it('blocked without the working: the card from blockingRule, the review stops', () => {
    showReview(
      meta(),
      fullPayload({
        hasBlockingRule: true,
        refusalGrounds: [],
        blockingRule: {
          criterionId: 'bar',
          title: 'You haven’t been banned from entry',
          ruleRef: 'V 3.1',
          sourceQuote: 'The applicant must not be subject to a ban.',
          sourceUrl: 'https://example.gov/bar',
        },
      }),
    );
    const t = texts(render(<ReviewScreen />));
    expect(t).toContain('One rule stands in the way');
    expect(t).toContain(fullBlockingBody('You haven’t been banned from entry'));
    expect(t).toContain('V 3.1');
    expect(t).toContain('“The applicant must not be subject to a ban.”');
    expect(t).toContain('Read the rule');
    for (const s of [
      'Our reading of your application',
      LOCKED_WORKING_TITLE,
      'How each rule was applied',
      'Then you apply',
      'Back to your application',
    ])
      expect(t).not.toContain(s);
  });

  it('blocked flag with no rule text: generic body, no quote', () => {
    showReview(
      meta(),
      fullPayload({ hasBlockingRule: true, blockingRule: null }),
    );
    const t = texts(render(<ReviewScreen />));
    expect(t).toContain(FREE_BLOCKING_BODY);
    expect(t).not.toContain('Read the rule');
  });

  it('free tier unchanged: band summary, "Start with these", upgrade panel with the new promise', () => {
    showReview(meta({ tier: 'free' }), {
      readiness: 'weak',
      hasBlockingRule: false,
      topIssues: [{ criterionId: 't1', title: 'Issue one' }],
    });
    const t = texts(render(<ReviewScreen />));
    expect(t).toContain(copy.BAND_SUMMARY.weak);
    expect(t.indexOf(copy.DISCLAIMER)).toBeLessThan(
      t.indexOf('Start with these'),
    );
    expect(t).toContain('Issue one');
    expect(t).toContain(UPGRADE_READING_ROW);
    expect(t).not.toContain(LOCKED_WORKING_TITLE);
    expect(t).not.toContain('Our reading of your application');
    expect(mockTrack).toHaveBeenCalledWith('review_viewed', {
      tier: 'free',
      band: 'weak',
      working: false,
      hasNarrative: false,
    });
  });

  it('fires review_working_locked_seen once, when the panel scrolls into view', () => {
    showReview(meta(), fullPayload());
    const r = render(<ReviewScreen />);
    const scroll = r.root.findByType(ScrollView);
    const pad = r.root.findAll(
      (n) =>
        typeof n.props.onLayout === 'function' &&
        (n.type as unknown) === 'View',
    );
    const layout = (y: number, height = 0) => ({
      nativeEvent: { layout: { x: 0, y, width: 320, height } },
    });
    const seen = () =>
      mockTrack.mock.calls.filter((c) => c[0] === 'review_working_locked_seen')
        .length;
    // Viewport 600 tall; pad view starts at 300; panel at 1000 inside it.
    act(() => scroll.props.onLayout(layout(0, 600)));
    // The pad view and the panel wrapper are the two Views with onLayout.
    const [padView, panelWrap] = pad;
    act(() => padView.props.onLayout(layout(300)));
    act(() => panelWrap.props.onLayout(layout(1000)));
    expect(seen()).toBe(0); // 0 + 600 < 1300
    act(() =>
      scroll.props.onScroll({
        nativeEvent: { contentOffset: { x: 0, y: 500 } },
      }),
    );
    expect(seen()).toBe(0); // 500 + 600 < 1300
    act(() =>
      scroll.props.onScroll({
        nativeEvent: { contentOffset: { x: 0, y: 800 } },
      }),
    );
    expect(seen()).toBe(1);
    act(() =>
      scroll.props.onScroll({
        nativeEvent: { contentOffset: { x: 0, y: 900 } },
      }),
    );
    expect(seen()).toBe(1); // once per assessment
  });

  it('never fires the locked event with the working', () => {
    showReview(meta({ working: true }), fullPayload());
    const r = render(<ReviewScreen />);
    const scroll = r.root.findByType(ScrollView);
    act(() =>
      scroll.props.onLayout({
        nativeEvent: { layout: { x: 0, y: 0, width: 1, height: 99999 } },
      }),
    );
    expect(
      mockTrack.mock.calls.filter((c) => c[0] === 'review_working_locked_seen'),
    ).toEqual([]);
  });
});
