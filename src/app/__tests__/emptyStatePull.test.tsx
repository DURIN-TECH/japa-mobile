// ─────────────────────────────────────────────────────────────────────────────
// japa#474 fix round 1 (QA FAIL): the empty / not-yet states can be pulled.
//
// A client waiting for their first booking, message or payment, or for a
// review that finished elsewhere, must be able to pull to check again. Each
// screen is rendered in that state; it must carry the coral RefreshControl,
// and a pull must refetch the screen's own queries.
//
// Screens: consultations ("No consultations yet"), messages/index ("No
// messages yet"), payments ("No payments yet") and self-service/[id]/review
// ("See how ready you are", and the no-rulebook state). Data hooks, router
// and native visual modules are stubbed; no network.
// ─────────────────────────────────────────────────────────────────────────────

// ── Stubs (names start with `mock` so jest.mock factories may use them) ──────
/** A query stub: loaded, not failing, with its own refetch spy. */
function mockQ(data: unknown) {
  return {
    data,
    isLoading: false,
    isError: false,
    isSuccess: true,
    isRefetching: false,
    isFetching: false,
    error: null,
    refetch: jest.fn(async () => undefined),
  };
}
const mockQueries: Record<string, ReturnType<typeof mockQ>> = {};

jest.mock('react-native-reanimated', () =>
  jest.requireActual('react-native-reanimated/mock'),
);
jest.mock('react-native-worklets', () =>
  jest.requireActual('react-native-worklets/lib/module/mock'),
);
jest.mock('expo-blur', () => ({
  BlurView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => undefined),
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: {},
  NotificationFeedbackType: {},
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'app-1' }),
  useFocusEffect: () => undefined,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/services/analytics.service', () => ({
  analyticsService: { logEvent: jest.fn(), track: jest.fn() },
}));
jest.mock('@/hooks/useConsultations', () => ({
  useConsultations: () => mockQueries.consults,
}));
jest.mock('@/hooks/useMessaging', () => ({
  useConversations: () => mockQueries.convos,
}));
jest.mock('@/hooks/useTransactions', () => ({
  useTransactions: () => mockQueries.tx,
}));
jest.mock('@/hooks/usePaymentRequests', () => ({
  usePaymentRequests: () => mockQueries.pr,
}));
jest.mock('@/hooks/useApplications', () => ({
  useApplication: () => mockQueries.app,
}));
jest.mock('@/hooks/useVisaTypes', () => ({
  useVisaType: () => mockQueries.vt,
}));
jest.mock('@/hooks/useCaseOfficer', () => ({
  assessmentKey: (id: string) => ['assessment', id],
  isForbidden: () => false,
  isInFlight: () => false,
  isOffline: () => false,
  useAssessment: () => mockQueries.review,
  useStartReview: () => ({ start: jest.fn(), isStarting: false }),
}));

import React from 'react';
import { RefreshControl } from 'react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import TestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ConsultationsScreen from '../consultations';
import MessagesScreen from '../messages/index';
import PaymentsScreen from '../payments';
import ReviewScreen from '../self-service/[id]/review';

function render(Screen: React.ComponentType) {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <QueryClientProvider client={new QueryClient()}>
        <Screen />
      </QueryClientProvider>,
    );
  });
  return tree;
}

/** All rendered text, joined. */
function text(tree: TestRenderer.ReactTestRenderer) {
  return tree.root
    .findAll((n) => typeof n.props.children === 'string')
    .map((n) => n.props.children as string)
    .join(' | ');
}

/** The one coral RefreshControl on screen; pulls it and waits. */
async function pull(tree: TestRenderer.ReactTestRenderer) {
  const rc = tree.root.findByType(RefreshControl);
  expect(rc.props.tintColor).toBe('#F4516C');
  expect(rc.props.colors).toEqual(['#F4516C']);
  await act(async () => {
    await rc.props.onRefresh();
  });
}

beforeEach(() => {
  // Every list empty: the first-run state on each screen.
  mockQueries.consults = mockQ([]);
  mockQueries.convos = mockQ([]);
  mockQueries.tx = mockQ([]);
  mockQueries.pr = mockQ([]);
  mockQueries.app = mockQ({
    id: 'app-1',
    visaTypeName: 'Skilled Worker',
    countryCode: 'GB',
    visaTypeId: 'skilled',
  });
  mockQueries.vt = mockQ(undefined);
  mockQueries.review = mockQ({ kind: 'empty', reason: 'none' });
});

describe('empty states can be pulled (japa#474 fix round 1)', () => {
  it('consultations: "No consultations yet" pulls and refetches', async () => {
    const tree = render(ConsultationsScreen);
    expect(text(tree)).toContain('No consultations yet');
    await pull(tree);
    expect(mockQueries.consults.refetch).toHaveBeenCalledTimes(1);
    expect(mockQueries.convos.refetch).toHaveBeenCalledTimes(1);
    // The empty state is still there afterwards (nothing new arrived).
    expect(text(tree)).toContain('No consultations yet');
  });

  it('messages: "No messages yet" pulls and refetches', async () => {
    const tree = render(MessagesScreen);
    expect(text(tree)).toContain('No messages yet');
    await pull(tree);
    expect(mockQueries.convos.refetch).toHaveBeenCalledTimes(1);
  });

  it('payments: "No payments yet" pulls and refetches', async () => {
    const tree = render(PaymentsScreen);
    expect(text(tree)).toContain('No payments yet');
    await pull(tree);
    expect(mockQueries.tx.refetch).toHaveBeenCalledTimes(1);
    expect(mockQueries.pr.refetch).toHaveBeenCalledTimes(1);
  });

  it('review: "See how ready you are" (no review yet) pulls and refetches', async () => {
    const tree = render(ReviewScreen);
    expect(text(tree)).toContain('See how ready you are');
    await pull(tree);
    expect(mockQueries.review.refetch).toHaveBeenCalledTimes(1);
    expect(mockQueries.app.refetch).toHaveBeenCalledTimes(1);
  });

  it('review: the no-rulebook state pulls too', async () => {
    mockQueries.review = mockQ({ kind: 'empty', reason: 'no_rubric' });
    const tree = render(ReviewScreen);
    expect(text(tree)).toContain('Back to your application');
    await pull(tree);
    expect(mockQueries.review.refetch).toHaveBeenCalledTimes(1);
  });
});
