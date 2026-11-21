// ─────────────────────────────────────────────────────────────────────────────
// consultation/[id].tsx: refunds (japa#356) and "the meeting didn't happen"
// (japa#442). Renders the real screen with react-test-renderer (no
// simulator); router, safe-area, Alert and the data hooks are stubbed so only
// the screen's own logic runs.
// ─────────────────────────────────────────────────────────────────────────────

// ── Stubs (names start with `mock` so jest.mock factories may use them) ──────
const mockBack = jest.fn();
const mockCancel = jest.fn();
const mockReport = jest.fn();
let mockBooking: Record<string, unknown> | undefined;
let mockTx: unknown[] | undefined;
let mockCancelPending = false;
let mockReportPending = false;
let mockOffline = false;

jest.mock('react-native-reanimated', () =>
  jest.requireActual('react-native-reanimated/mock'),
);
jest.mock('react-native-worklets', () =>
  jest.requireActual('react-native-worklets/lib/module/mock'),
);
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'cons-1' }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: mockBack }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/hooks/useConsultations', () => ({
  useConsultation: () => ({
    data: mockBooking,
    isLoading: false,
    isError: false,
  }),
  useCancelConsultation: () => ({
    mutate: mockCancel,
    isPending: mockCancelPending,
  }),
  useReportNoShow: () => ({
    mutate: mockReport,
    isPending: mockReportPending,
  }),
  NO_SHOW_NOTE_MAX_LENGTH: 1000,
}));
jest.mock('@/hooks/useTransactions', () => ({
  useTransactions: () => ({ data: mockTx }),
}));
jest.mock('@/hooks/useAgents', () => ({
  useAgent: () => ({ data: undefined }),
}));
jest.mock('@/hooks/useMessaging', () => ({
  useConversations: () => ({ data: [] }),
}));
jest.mock('@/utils/networkStatus', () => ({
  useIsOffline: () => mockOffline,
  isNetworkError: (e: { code?: string }) => e?.code === 'NETWORK_ERROR',
}));

import React from 'react';
import { Alert } from 'react-native';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import TestRenderer, { act } from 'react-test-renderer';
import ConsultationDetailView from '../consultation/[id]';

/** A paid, upcoming booking as the client's GET /consultations/:id sends it. */
const booking = (over: Record<string, unknown> = {}) => ({
  id: 'cons-1',
  userId: 'u1',
  agentId: 'agent-1',
  agentName: 'Ada Obi',
  status: 'scheduled',
  type: 'initial',
  scheduledDate: '2026-11-26T00:00:00.000Z',
  scheduledTime: '15:00',
  durationMinutes: 30,
  timezone: 'Africa/Lagos',
  priceUsdCents: 600,
  chargedCurrency: 'NGN',
  chargedAmountMinor: 825_000,
  paymentStatus: 'paid',
  canReportNoShow: false,
  noShowReport: null,
  createdAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
  ...over,
});

const mounted: TestRenderer.ReactTestRenderer[] = [];
function render() {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<ConsultationDetailView />);
  });
  mounted.push(tree);
  return tree;
}
const text = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root
    .findAll((n) => typeof n.props.children === 'string')
    .map((n) => n.props.children as string)
    .join(' | ');
const byTestId = (tree: TestRenderer.ReactTestRenderer, id: string) =>
  tree.root.findAll(
    (n) => n.props.testID === id && typeof n.type !== 'string',
  )[0];

type AlertButton = { text: string; onPress?: () => void };
let alertSpy: jest.SpiedFunction<typeof Alert.alert>;

beforeEach(() => {
  mockBack.mockReset();
  mockCancel.mockReset();
  mockReport.mockReset();
  mockBooking = booking();
  mockTx = [];
  mockCancelPending = false;
  mockReportPending = false;
  mockOffline = false;
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => {
  act(() => mounted.splice(0).forEach((t) => t.unmount()));
  alertSpy.mockRestore();
});

/** Press "Cancel consultation", then the confirm's destructive button. */
function cancelThroughConfirm(tree: TestRenderer.ReactTestRenderer) {
  act(() => byTestId(tree, 'cancel-consultation').props.onPress());
  const [, , buttons] = alertSpy.mock.calls[0] as [
    string,
    string,
    AlertButton[],
  ];
  act(() => buttons[1].onPress!());
}

describe('cancel confirm and result (japa#356)', () => {
  it('worded from the preview: amount + fee, exact kobo', () => {
    mockBooking = booking({
      cancellationRefund: {
        refundable: true,
        amount: { amountMinor: 812_437, currency: 'NGN' },
        processingFee: { amountMinor: 12_563, currency: 'NGN' },
        refundableUntil: '2026-11-25T14:00:00.000Z',
      },
    });
    const tree = render();
    act(() => byTestId(tree, 'cancel-consultation').props.onPress());
    const [title, message, buttons] = alertSpy.mock.calls[0] as [
      string,
      string,
      AlertButton[],
    ];
    expect(title).toBe('Cancel consultation?');
    expect(message).toBe(
      'This will release your booked slot. You’ll get ₦8,124.37 back. The payment provider keeps a processing fee of ₦125.63.',
    );
    expect(buttons.map((b) => b.text)).toEqual([
      'Keep it',
      'Cancel consultation',
    ]);
  });

  it('not refundable: "Cancel without refund"', () => {
    mockBooking = booking({
      cancellationRefund: {
        refundable: false,
        amount: null,
        processingFee: null,
        refundableUntil: '2026-11-25T14:00:00.000Z',
      },
    });
    const tree = render();
    act(() => byTestId(tree, 'cancel-consultation').props.onPress());
    const [, message, buttons] = alertSpy.mock.calls[0] as [
      string,
      string,
      AlertButton[],
    ];
    expect(message).toMatch(/won’t give you a refund\. Refunds closed at /);
    expect(buttons[1].text).toBe('Cancel without refund');
  });

  it('success: stays on the screen, the result comes from the answer', () => {
    // The preview said refundable, but the answer says no refund (the line
    // passed while the screen was open): the client is told the truth.
    mockBooking = booking({
      cancellationRefund: {
        refundable: true,
        amount: { amountMinor: 812_437, currency: 'NGN' },
        processingFee: null,
        refundableUntil: '2026-11-25T14:00:00.000Z',
      },
    });
    mockCancel.mockImplementation((_id, opts) =>
      (opts as { onSuccess: (r: unknown) => void }).onSuccess({
        status: 'cancelled',
        refund: null,
      }),
    );
    const tree = render();
    cancelThroughConfirm(tree);
    expect(mockBack).not.toHaveBeenCalled();
    expect(alertSpy.mock.calls[1]).toEqual([
      'Consultation cancelled',
      'Your slot is released. As it was less than 24 hours before your consultation, there’s no refund.',
      [{ text: 'OK' }],
    ]);
  });

  it('success with a refund: "Your refund of … is on its way."', () => {
    mockBooking = booking({
      cancellationRefund: {
        refundable: true,
        amount: null,
        processingFee: null,
        refundableUntil: '2026-11-25T14:00:00.000Z',
      },
    });
    mockCancel.mockImplementation((_id, opts) =>
      (opts as { onSuccess: (r: unknown) => void }).onSuccess({
        refund: {
          status: 'pending',
          amount: { amountMinor: 812_437, currency: 'NGN' },
          processingFee: { amountMinor: 12_563, currency: 'NGN' },
        },
      }),
    );
    const tree = render();
    cancelThroughConfirm(tree);
    expect(alertSpy.mock.calls[1][1]).toBe(
      'Your refund of ₦8,124.37 is on its way. The payment provider kept a processing fee of ₦125.63.',
    );
  });

  it('error: today’s alert', () => {
    mockCancel.mockImplementation((_id, opts) =>
      (opts as { onError: (e: unknown) => void }).onError({ code: 'X' }),
    );
    const tree = render();
    cancelThroughConfirm(tree);
    expect(alertSpy.mock.calls[1][0]).toBe(
      'We couldn’t cancel your consultation. Try again in a moment.',
    );
  });

  it('while cancelling: a spinner, not pressable', () => {
    mockCancelPending = true;
    const tree = render();
    const link = byTestId(tree, 'cancel-consultation');
    expect(link.props.disabled).toBe(true);
    expect(text(tree)).not.toContain('Cancel consultation');
  });
});

describe('refund card (japa#356)', () => {
  it('pending, with the refund row’s figure', () => {
    mockBooking = booking({ status: 'cancelled', refundStatus: 'pending' });
    mockTx = [
      {
        id: 'rf-1',
        type: 'refund',
        status: 'pending',
        amount: 812_437,
        currency: 'NGN',
        consultationId: 'cons-1',
        refundState: 'on_its_way',
      },
    ];
    const tree = render();
    const t = text(tree);
    expect(t).toContain('Refund');
    expect(t).toContain('Refund on its way');
    expect(t).toContain(
      'Your refund of ₦8,124.37 is on its way to the card or account you paid with.',
    );
  });
  it('no refund row yet: the card without the figure', () => {
    mockBooking = booking({ status: 'cancelled', refundStatus: 'completed' });
    mockTx = undefined; // still loading
    const t = text(render());
    expect(t).toContain('Refunded');
    expect(t).toContain(
      'We’ve sent your refund back to the card or account you paid with.',
    );
  });
  it('failed: Refund delayed', () => {
    mockBooking = booking({ status: 'cancelled', refundStatus: 'failed' });
    expect(text(render())).toContain('Refund delayed');
  });
  it('no refundStatus: no card', () => {
    mockBooking = booking({ status: 'cancelled' });
    expect(byTestId(render(), 'refund-card')).toBeUndefined();
  });
});

describe('"The meeting didn’t happen" (japa#442)', () => {
  it('hidden unless the server allows it', () => {
    expect(byTestId(render(), 'no-show-open')).toBeUndefined();
    mockBooking = booking({
      canReportNoShow: true,
      noShowReport: { status: 'open', createdAt: 'x' },
    });
    expect(byTestId(render(), 'no-show-open')).toBeUndefined();
  });

  it('shown → confirm step → sends the note', () => {
    mockBooking = booking({ canReportNoShow: true });
    const tree = render();
    act(() => byTestId(tree, 'no-show-open').props.onPress());
    expect(text(tree)).toContain('Seli will look into it.');
    act(() =>
      byTestId(tree, 'no-show-note').props.onChangeText('Agent never joined'),
    );
    act(() => byTestId(tree, 'no-show-send').props.onPress());
    expect(mockReport).toHaveBeenCalledTimes(1);
    expect(mockReport.mock.calls[0][0]).toEqual({
      consultationId: 'cons-1',
      note: 'Agent never joined',
    });
  });

  it('while sending: the send button is busy and disabled', () => {
    mockBooking = booking({ canReportNoShow: true });
    mockReportPending = true;
    const tree = render();
    act(() => byTestId(tree, 'no-show-open').props.onPress());
    // The Pressable itself (the first match is the OutlineAction wrapper).
    const send = tree.root.findAll(
      (n) => n.props.testID === 'no-show-send' && 'disabled' in n.props,
    )[0];
    expect(send.props.disabled).toBe(true);
    act(() => byTestId(tree, 'no-show-send').props.onPress());
    expect(mockReport).not.toHaveBeenCalled();
  });

  // Review fix: a NETWORK_ERROR never blocks the next tap. The first send
  // fails offline (the offline message shows), the second one is SENT.
  it('a network error shows the offline message, and the next tap sends again', () => {
    mockBooking = booking({ canReportNoShow: true });
    // The app-wide offline flag may be stuck on from an earlier failure:
    // it must not stop the send.
    mockOffline = true;
    mockReport.mockImplementationOnce((_v, opts) =>
      (opts as { onError: (e: unknown) => void }).onError({
        code: 'NETWORK_ERROR',
        message: 'Network error. Please check your connection.',
        status: 0,
      }),
    );
    const tree = render();
    act(() => byTestId(tree, 'no-show-open').props.onPress());
    act(() => byTestId(tree, 'no-show-send').props.onPress());
    expect(mockReport).toHaveBeenCalledTimes(1);
    expect(text(tree)).toContain(
      'You’re offline, so we couldn’t send your report. Reconnect and try again.',
    );
    // Reconnected: the second tap calls the API again.
    act(() => byTestId(tree, 'no-show-send').props.onPress());
    expect(mockReport).toHaveBeenCalledTimes(2);
  });

  it('a 409 shows the server’s message', () => {
    mockBooking = booking({ canReportNoShow: true });
    mockReport.mockImplementation((_v, opts) =>
      (opts as { onError: (e: unknown) => void }).onError({
        code: 'FEE_NOT_HELD',
        message: 'Your agent has already been paid. Contact support.',
        status: 409,
      }),
    );
    const tree = render();
    act(() => byTestId(tree, 'no-show-open').props.onPress());
    act(() => byTestId(tree, 'no-show-send').props.onPress());
    expect(text(tree)).toContain(
      'Your agent has already been paid. Contact support.',
    );
  });

  // The scripted check #442 asks for (no Maestro fixture for a paid,
  // started, fee-held booking exists yet): shown → sent → under review.
  it('scripted: report shown → sent → under review, action gone', () => {
    mockBooking = booking({ canReportNoShow: true });
    // The hook refetches on success; the server's new booking has a report.
    mockReport.mockImplementation((_v, opts) => {
      mockBooking = booking({
        canReportNoShow: false,
        noShowReport: { status: 'open', createdAt: 'x' },
      });
      (opts as { onSuccess: () => void }).onSuccess();
    });
    const tree = render();
    act(() => byTestId(tree, 'no-show-open').props.onPress());
    act(() => byTestId(tree, 'no-show-send').props.onPress());
    // The refetched booking re-renders the screen.
    act(() => tree.update(<ConsultationDetailView />));
    const t = text(tree);
    expect(t).toContain('Under review');
    expect(byTestId(tree, 'no-show-open')).toBeUndefined();
    expect(byTestId(tree, 'no-show-confirm')).toBeUndefined();
  });

  it('report states from the booking: under review / resolved', () => {
    mockBooking = booking({ noShowReport: { status: 'open', createdAt: 'x' } });
    let t = text(render());
    expect(t).toContain('Your report');
    expect(t).toContain('Under review');
    // The cancel link is hidden while a report is open (the server refuses).
    expect(t).not.toContain('Cancel consultation');

    mockBooking = booking({
      noShowReport: { status: 'released', createdAt: 'x' },
    });
    t = text(render());
    expect(t).toContain(
      'Seli found the meeting took place, so there’s no refund.',
    );

    mockBooking = booking({
      status: 'completed',
      refundStatus: 'pending',
      noShowReport: { status: 'refunded', createdAt: 'x' },
    });
    t = text(render());
    expect(t).toContain('refunding your payment in full');
    // …and the refund then shows as in #356.
    expect(t).toContain('Refund on its way');
  });
});
