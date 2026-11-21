// ─────────────────────────────────────────────────────────────────────────────
// pay.tsx: "Your consultation moved" (japa#392). Verify answers 409
// CONSULTATION_RESCHEDULED, which `useVerifyConsultation` resolves as
// `{ kind: 'rescheduled', consultation }`: the screen shows the moved state
// (copy, the NEW time, "Pay again"), never "Payment failed" / "Check again"
// / the old price. "Pay again" checks the booking out anew and shows the new
// price before Paystack opens. Same harness as payFee.test.tsx (real screen,
// react-test-renderer, hooks and router stubbed).
// ─────────────────────────────────────────────────────────────────────────────

// ── Stubs (names start with `mock` so jest.mock factories may use them) ──────
const mockCreate = jest.fn<(input: unknown) => Promise<unknown>>();
const mockCheckout = jest.fn<(id: unknown) => Promise<unknown>>();
const mockVerify = jest.fn<(ref: unknown) => Promise<unknown>>();
const mockOpenAuth =
  jest.fn<
    (url: string, redirect: string) => Promise<{ type: string; url?: string }>
  >();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockTrackBooked = jest.fn();

jest.mock('react-native-reanimated', () =>
  jest.requireActual('react-native-reanimated/mock'),
);
jest.mock('react-native-worklets', () =>
  jest.requireActual('react-native-worklets/lib/module/mock'),
);
jest.mock('expo-blur', () => ({
  BlurView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: (url: string, redirect: string) =>
    mockOpenAuth(url, redirect),
  maybeCompleteAuthSession: jest.fn(),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({
    agentId: 'agent-1',
    dateIso: '2026-12-01',
    time: '10:00 AM',
    topic: 'Initial consultation',
    mode: 'Video call',
    dur: '30 min',
  }),
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: jest.fn(),
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/hooks/usePaymentRequests', () => ({
  usePaymentRequests: () => ({ data: [] }),
  useVerifyPaymentRequest: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('@/hooks/useAgents', () => ({
  useAgent: () => ({
    data: { consultationFeeUsd: { amountMinor: 3500, currency: 'USD' } },
  }),
}));
// GET /consultations/:id (japa#288: the full booking behind a 409's summary).
// Returns the SAME object per id, as react-query does (a new object per
// render would re-run the screen's effect forever).
const mockDetail =
  jest.fn<(id: unknown) => { data: unknown; isError?: boolean }>();
jest.mock('@/hooks/useConsultations', () => ({
  useConsultation: (id: unknown) => mockDetail(id),
  getConsultationTypeLabel: (type: string) =>
    ({ document_review: 'Document Review', general: 'General Consultation' })[
      type
    ] ?? type,
  useCreateConsultation: () => ({ mutateAsync: mockCreate }),
  useConsultationCheckout: () => ({ mutateAsync: mockCheckout }),
  useVerifyConsultation: () => ({ mutateAsync: mockVerify }),
}));
jest.mock('@/services/analytics.service', () => ({
  analyticsService: {
    trackConsultationBooked: (p: unknown) => mockTrackBooked(p),
  },
}));

import React from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import TestRenderer, { act } from 'react-test-renderer';
import PayScreen from '../pay';

const CHECKOUT = 'https://checkout.paystack.com/cons';
const LOCKED_AT = '2026-11-14T10:00:00.000Z';
const EXPIRES_AT = '2026-11-14T10:30:00.000Z';

/** A paid booking as POST /consultations returns it ($35 → ₦47,389.40). */
const paidBooking = (over: Record<string, unknown> = {}) => ({
  id: 'cons-1',
  agentName: 'Ada Obi',
  status: 'pending_payment',
  paymentStatus: 'pending',
  priceUsdCents: 3500,
  chargedCurrency: 'NGN',
  chargedAmountMinor: 4_738_940,
  effectiveRate: 1353.97,
  quoteLockedAt: LOCKED_AT,
  quoteExpiresAt: EXPIRES_AT,
  requiresPayment: true,
  authorizationUrl: CHECKOUT,
  checkoutUrl: CHECKOUT,
  reference: 'cons-ref-1',
  ...over,
});

/** useConsultation with nothing fetched (stable object, see mockDetail). */
const NO_DETAIL = { data: undefined };

// Mounted trees, unmounted after each test (stops the countdown interval).
const mounted: TestRenderer.ReactTestRenderer[] = [];

/** Mount the screen and let the on-arrival booking call settle. */
async function render() {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<PayScreen />);
  });
  mounted.push(tree);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
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

/** Every pressable (composite) node, in render order. */
const pressables = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root.findAll(
    (n) => typeof n.type !== 'string' && typeof n.props.onPress === 'function',
  );

/** The sticky CTA (the pressable carrying the accessibility label). */
const cta = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root.find(
    (n) =>
      typeof n.type !== 'string' &&
      typeof n.props.onPress === 'function' &&
      typeof n.props.accessibilityLabel === 'string',
  );

/** Choose the first payment method (Card). */
async function chooseMethod(tree: TestRenderer.ReactTestRenderer) {
  const card = pressables(tree).find(
    (n) =>
      n.findAll((c) => c.props.children === 'Card').length > 0 &&
      n !== cta(tree),
  );
  await act(async () => {
    card!.props.onPress();
  });
}

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
  jest.restoreAllMocks();
});

beforeEach(() => {
  mockCreate.mockReset();
  mockCheckout.mockReset();
  mockVerify.mockReset();
  mockOpenAuth.mockReset();
  mockPush.mockReset();
  mockReplace.mockReset();
  mockTrackBooked.mockReset();
  mockDetail.mockReset();
  mockDetail.mockReturnValue(NO_DETAIL);
  // Device clock = 2 minutes after the server locked the quote.
  jest
    .spyOn(Date, 'now')
    .mockReturnValue(new Date('2026-11-14T10:02:00.000Z').getTime());
});

/** The 409's booking summary: moved to 15:00 Lagos on Wed 25 Nov 2026. */
const movedSummary = {
  id: 'cons-1',
  agentName: 'Ada Obi',
  type: 'initial',
  scheduledDate: { _seconds: Date.UTC(2026, 10, 25) / 1000 },
  scheduledTime: '15:00',
  timezone: 'Africa/Lagos',
  status: 'pending_payment',
  paymentStatus: 'pending',
  priceUsdCents: 3500,
  chargedCurrency: 'NGN',
  chargedAmountMinor: 4_738_940,
};
const rescheduled = {
  kind: 'rescheduled',
  consultation: movedSummary,
  message: 'Your consultation moved…',
};

const CHECKOUT_2 = 'https://checkout.paystack.com/new-time';
/** "Pay again" priced now: $9.00 → ₦12,450.00. */
const newCheckout = {
  requiresPayment: true,
  authorizationUrl: CHECKOUT_2,
  reference: 'cons-ref-2',
  consultation: {
    ...movedSummary,
    priceUsdCents: 900,
    chargedAmountMinor: 1_245_000,
    effectiveRate: 1383.33,
    quoteLockedAt: '2026-11-14T10:02:00.000Z',
    quoteExpiresAt: '2026-11-14T10:32:00.000Z',
  },
};

/** The "Pay again" button. */
const payAgain = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root.find(
    (n) =>
      n.props.testID === 'pay-again' && typeof n.props.onPress === 'function',
  );

/** Book, pick Card, Pay → Paystack closes → verify says "moved". */
async function reachRescheduled() {
  mockCreate.mockResolvedValue(paidBooking());
  mockOpenAuth.mockResolvedValue({ type: 'success' });
  mockVerify.mockResolvedValue(rescheduled);
  const tree = await render();
  await chooseMethod(tree);
  await act(async () => {
    await cta(tree).props.onPress();
  });
  return tree;
}

describe('pay.tsx rescheduled state (japa#392)', () => {
  it('shows the copy, the new time and "Pay again"; nothing about failure', async () => {
    const tree = await reachRescheduled();
    const t = text(tree);
    expect(t).toContain('Your consultation moved');
    expect(t).toContain(
      'Your consultation moved, so we’re refunding your payment in full. Your refund is on its way. Please pay again for the new time.',
    );
    expect(t).toContain('New time');
    expect(t).toContain('Wednesday, November 25, 2026');
    expect(t).toContain('3:00 PM');
    expect(t).toContain(
      'Your refund goes back to the card or account you paid with. You’ll see it in Payments.',
    );
    expect(t).toContain('Pay again');
    // Never failure wording, never the old price, never the countdown.
    expect(t).not.toMatch(/Payment failed|Check again|Open checkout/);
    expect(t).not.toContain('₦47,389.40');
    expect(t).not.toContain('locked for 30 minutes');
    // Never treated as paid.
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('"Pay again" checks out anew and shows the NEW price first; Pay opens it', async () => {
    const tree = await reachRescheduled();
    mockCheckout.mockResolvedValue(newCheckout);
    mockOpenAuth.mockClear();
    await act(async () => {
      await payAgain(tree).props.onPress();
    });
    expect(mockCheckout).toHaveBeenCalledWith('cons-1');
    // Back on the locked quote: the new price, its rate line, the note.
    const t = text(tree);
    expect(cta(tree).props.accessibilityLabel).toBe('Pay ₦12,450.00');
    expect(t).toContain('$9.00 at ₦1,383.33 per $1');
    expect(t).toContain('This is the price for the new time.');
    expect(t).not.toContain('₦47,389.40');
    // The summary card shows the new slot.
    expect(t).toContain('Wednesday, November 25, 2026');
    // Paystack has NOT opened yet (two taps, #183).
    expect(mockOpenAuth).not.toHaveBeenCalled();
    // Second tap: opens the new checkout.
    mockVerify.mockResolvedValue({
      verified: true,
      consultation: { ...newCheckout.consultation, paymentStatus: 'paid' },
    });
    await act(async () => {
      await cta(tree).props.onPress();
    });
    expect(mockOpenAuth).toHaveBeenCalledWith(
      CHECKOUT_2,
      'durintech://payment-return',
    );
    expect(mockVerify).toHaveBeenLastCalledWith('cons-ref-2');
    // Confirmation with the paid amount and the NEW slot.
    const arg = mockReplace.mock.calls[0][0] as {
      params: Record<string, string>;
    };
    expect(arg.params.paidAmountMinor).toBe('1245000');
    expect(arg.params.dateIso).toBe('2026-11-25');
    expect(arg.params.time).toBe('3:00 PM');
  });

  it('"Pay again" ignores a second tap while it runs', async () => {
    const tree = await reachRescheduled();
    let resolve!: (v: unknown) => void;
    mockCheckout.mockReturnValue(new Promise((r) => (resolve = r)));
    await act(async () => {
      payAgain(tree).props.onPress();
      payAgain(tree).props.onPress();
    });
    expect(mockCheckout).toHaveBeenCalledTimes(1);
    expect(payAgain(tree).props.disabled).toBe(true);
    await act(async () => {
      resolve(newCheckout);
    });
  });

  it('a checkout error shows an InlineError and "Pay again" works again', async () => {
    const tree = await reachRescheduled();
    mockCheckout.mockRejectedValueOnce({
      code: 'BILLING_PROVIDER_ERROR',
      message: 'Payment provider is unavailable.',
      status: 502,
    });
    await act(async () => {
      await payAgain(tree).props.onPress();
    });
    expect(text(tree)).toContain('Payment provider is unavailable.');
    expect(payAgain(tree).props.disabled).toBe(false);
    // No message from the server → the fallback.
    mockCheckout.mockRejectedValueOnce({
      code: 'NETWORK_ERROR',
      message: 'Network error. Please check your connection.',
      status: 0,
    });
    await act(async () => {
      await payAgain(tree).props.onPress();
    });
    expect(text(tree)).toContain(
      'We couldn’t start your new payment. Try again in a moment.',
    );
    expect(mockOpenAuth).toHaveBeenCalledTimes(1); // only the first payment
  });

  it('already paid → end state with "View consultation"', async () => {
    const tree = await reachRescheduled();
    mockCheckout.mockResolvedValue({
      requiresPayment: false,
      consultation: { ...movedSummary, paymentStatus: 'paid' },
    });
    await act(async () => {
      await payAgain(tree).props.onPress();
    });
    const t = text(tree);
    expect(t).toContain('This consultation is already paid for');
    expect(t).toContain('You don’t need to pay again.');
    const view = tree.root.find(
      (n) =>
        n.props.accessibilityLabel === 'View consultation' &&
        typeof n.props.onPress === 'function',
    );
    act(() => view.props.onPress());
    expect(mockReplace).toHaveBeenCalledWith('/consultation/cons-1');
  });

  it('409 BOOKING_NOT_PAYABLE → the backend message, no Paystack', async () => {
    const tree = await reachRescheduled();
    mockOpenAuth.mockClear();
    mockCheckout.mockRejectedValue({
      code: 'BOOKING_NOT_PAYABLE',
      message: 'This consultation was cancelled, so it can’t be paid.',
      status: 409,
    });
    await act(async () => {
      await payAgain(tree).props.onPress();
    });
    expect(text(tree)).toContain(
      'This consultation was cancelled, so it can’t be paid.',
    );
    expect(text(tree)).toContain('View consultation');
    expect(mockOpenAuth).not.toHaveBeenCalled();
  });

  it('"Check again" on the same old reference lands in the same state', async () => {
    // The first verify CALL fails (network): "Check again".
    mockCreate.mockResolvedValue(paidBooking());
    mockOpenAuth.mockResolvedValue({ type: 'success' });
    mockVerify.mockRejectedValueOnce({ code: 'NETWORK_ERROR', status: 0 });
    const tree = await render();
    await chooseMethod(tree);
    await act(async () => {
      await cta(tree).props.onPress();
    });
    expect(cta(tree).props.accessibilityLabel).toBe('Check again');
    // Re-verify the SAME reference: the booking moved.
    mockVerify.mockResolvedValue(rescheduled);
    await act(async () => {
      await cta(tree).props.onPress();
    });
    expect(mockVerify).toHaveBeenLastCalledWith('cons-ref-1');
    expect(text(tree)).toContain('Your consultation moved');
    expect(text(tree)).not.toContain('Check again');
  });

  it('the 200 paid path is unchanged', async () => {
    mockCreate.mockResolvedValue(paidBooking());
    mockOpenAuth.mockResolvedValue({ type: 'success' });
    mockVerify.mockResolvedValue({
      kind: 'paid',
      verified: true,
      consultation: { ...paidBooking(), paymentStatus: 'paid' },
    });
    const tree = await render();
    await chooseMethod(tree);
    await act(async () => {
      await cta(tree).props.onPress();
    });
    const arg = mockReplace.mock.calls[0][0] as {
      pathname: string;
      params: Record<string, string>;
    };
    expect(arg.pathname).toBe('/confirmation');
    expect(arg.params.paidAmountMinor).toBe('4738940');
    // The slot first picked (nothing moved).
    expect(arg.params.dateIso).toBe('2026-12-01');
    expect(arg.params.time).toBe('10:00 AM');
  });
});
