// ─────────────────────────────────────────────────────────────────────────────
// pay.tsx booking flow (japa#183): the screen books FIRST with no fee in the
// body, then shows the server's LOCKED amount behind "Pay {amount}", opens
// that checkout and verifies with POST /consultations/public/verify. Renders
// the real screen with react-test-renderer (no simulator); router, blur,
// safe-area, the auth browser and the hooks are stubbed so only the screen's
// own logic runs.
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
// japa#472: "Pick another time" goes back to the booking screen.
const mockBack = jest.fn();
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
    back: () => mockBack(),
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
// japa#472: the spinner the SLOT_IN_PAST state must not leave running.
import { ActivityIndicator } from 'react-native';
import PayScreen from '../pay';
import { PAY_COPY } from '@/hooks/consultationPayFlow';

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
  mockBack.mockReset();
  mockTrackBooked.mockReset();
  mockDetail.mockReset();
  mockDetail.mockReturnValue(NO_DETAIL);
  // Device clock = 2 minutes after the server locked the quote.
  jest
    .spyOn(Date, 'now')
    .mockReturnValue(new Date('2026-11-14T10:02:00.000Z').getTime());
});

describe('pay.tsx booking (japa#183)', () => {
  it('books on arrival with NO fee / amount / currency in the body', async () => {
    mockCreate.mockResolvedValue(paidBooking());
    await render();
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const sent = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(sent).sort()).toEqual(
      [
        'agentId',
        'durationMinutes',
        'scheduledDate',
        'scheduledTime',
        'timezone',
        'type',
      ].sort(),
    );
    expect(sent.scheduledTime).toBe('10:00');
    expect(sent.durationMinutes).toBe(30);
  });

  it('shows the locked amount, the server rate and "Pay ₦…"', async () => {
    mockCreate.mockResolvedValue(paidBooking());
    const tree = await render();
    const t = text(tree);
    expect(t).toContain('₦47,389.40');
    expect(t).toContain('$35.00 at ₦1,353.97 per $1');
    expect(t).toContain('Your price is locked for 30 minutes.');
    // The device clock is 2 minutes fast (10:02 vs the server's 10:00 lock):
    // the countdown follows the SERVER clock, so a fresh lock reads 30:00.
    expect(t).toContain('30:00');
    expect(cta(tree).props.accessibilityLabel).toBe('Pay ₦47,389.40');
  });

  // ── japa#332: the rate shown is the server's `effectiveRate` ─────────────
  it('the issue example: $6.00 charged ₦8,123.84 shows "$6.00 at ₦1,353.97 per $1"', async () => {
    mockCreate.mockResolvedValue(
      paidBooking({
        priceUsdCents: 600,
        chargedAmountMinor: 812_384,
        effectiveRate: 1353.973333,
      }),
    );
    const tree = await render();
    const t = text(tree);
    expect(t).toContain('₦8,123.84');
    expect(t).toContain('$6.00 at ₦1,353.97 per $1');
  });

  it('a legacy booking with no effectiveRate shows the dollar price only and still pays', async () => {
    // A raw `fxRate` (which clients are no longer sent) must not be shown.
    mockCreate.mockResolvedValue(
      paidBooking({ effectiveRate: undefined, fxRate: 1320.95 }),
    );
    mockOpenAuth.mockResolvedValue({ type: 'success' });
    mockVerify.mockResolvedValue({
      verified: true,
      consultation: {
        ...paidBooking({ effectiveRate: undefined }),
        paymentStatus: 'paid',
      },
    });
    const tree = await render();
    const t = text(tree);
    expect(t).toContain('₦47,389.40');
    expect(t).toContain('$35.00');
    expect(t).not.toContain('per $1');
    expect(t).not.toContain('1,320.95');
    expect(cta(tree).props.accessibilityLabel).toBe('Pay ₦47,389.40');
    // Paying still works, and the confirmation gets no rate ('' = none).
    await chooseMethod(tree);
    await act(async () => {
      await cta(tree).props.onPress();
    });
    const arg = mockReplace.mock.calls[0][0] as {
      params: Record<string, string>;
    };
    expect(arg.params.paidAmountMinor).toBe('4738940');
    expect(arg.params.effectiveRate).toBe('');
  });

  it('a free booking goes straight to confirmation, no checkout', async () => {
    mockCreate.mockResolvedValue({
      id: 'cons-free',
      status: 'scheduled',
      paymentStatus: 'paid',
      priceUsdCents: 0,
      requiresPayment: false,
    });
    await render();
    expect(mockOpenAuth).not.toHaveBeenCalled();
    // REPLACED, not pushed: the pay screen (still "Getting your price…")
    // leaves the stack, so back from the confirmation cannot land on it.
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledTimes(1);
    const arg = mockReplace.mock.calls[0][0] as {
      pathname: string;
      params: Record<string, string>;
    };
    expect(arg.pathname).toBe('/confirmation');
    expect(arg.params.free).toBe('1');
  });

  it('Pay opens the locked checkout and verifies our reference → confirmation', async () => {
    mockCreate.mockResolvedValue(paidBooking());
    mockOpenAuth.mockResolvedValue({ type: 'success' });
    mockVerify.mockResolvedValue({
      verified: true,
      consultation: { ...paidBooking(), paymentStatus: 'paid' },
    });
    const tree = await render();
    await chooseMethod(tree);
    await act(async () => {
      await cta(tree).props.onPress();
    });
    expect(mockOpenAuth).toHaveBeenCalledWith(
      CHECKOUT,
      'durintech://payment-return',
    );
    expect(mockVerify).toHaveBeenCalledWith('cons-ref-1');
    const arg = mockReplace.mock.calls[0][0] as {
      pathname: string;
      params: Record<string, string>;
    };
    expect(arg.pathname).toBe('/confirmation');
    expect(arg.params.paidAmountMinor).toBe('4738940');
    expect(arg.params.paidCurrency).toBe('NGN');
    expect(arg.params.priceUsdCents).toBe('3500');
    // japa#332: the server's effective rate goes with the amount, so the
    // confirmation can repeat "$35.00 at ₦1,353.97 per $1".
    expect(arg.params.effectiveRate).toBe('1353.97');
    // Analytics: the real currency, value in major units.
    expect(mockTrackBooked).toHaveBeenCalledWith(
      expect.objectContaining({
        charged: { amountMinor: 4_738_940, currency: 'NGN' },
      }),
    );
  });

  it('verify 400 "not completed" stays with Open checkout as the retry', async () => {
    mockCreate.mockResolvedValue(paidBooking());
    mockOpenAuth.mockResolvedValue({ type: 'cancel' });
    mockVerify.mockRejectedValue({
      code: 'VALIDATION_ERROR',
      status: 400,
      message: 'Payment has not been completed',
    });
    const tree = await render();
    await chooseMethod(tree);
    await act(async () => {
      await cta(tree).props.onPress();
    });
    expect(mockReplace).not.toHaveBeenCalled();
    expect(text(tree)).toContain(PAY_COPY.notCompleted);
    expect(cta(tree).props.accessibilityLabel).toBe('Open checkout');
  });

  it('reopening resumes via /checkout and shows a FRESH price before opening', async () => {
    mockCreate.mockResolvedValue(paidBooking());
    mockOpenAuth.mockResolvedValue({ type: 'cancel' });
    // The backend's wording for a genuinely unpaid checkout.
    mockVerify.mockRejectedValue({
      code: 'VALIDATION_ERROR',
      status: 400,
      message: 'Payment has not been completed',
    });
    const tree = await render();
    await chooseMethod(tree);
    await act(async () => {
      await cta(tree).props.onPress();
    });
    // The lock passed: the backend re-prices.
    mockCheckout.mockResolvedValue({
      requiresPayment: true,
      authorizationUrl: 'https://checkout.paystack.com/new',
      reference: 'cons-ref-2',
      consultation: {
        ...paidBooking(),
        chargedAmountMinor: 4_900_000,
        quoteExpiresAt: '2026-11-14T11:00:00.000Z',
      },
    });
    mockOpenAuth.mockClear();
    await act(async () => {
      await cta(tree).props.onPress();
    });
    expect(mockCheckout).toHaveBeenCalledWith('cons-1');
    // Not opened: the user sees the new amount first.
    expect(mockOpenAuth).not.toHaveBeenCalled();
    expect(text(tree)).toContain('₦49,000.00');
    expect(text(tree)).toContain(PAY_COPY.newPrice);
    expect(cta(tree).props.accessibilityLabel).toBe('Pay ₦49,000.00');
  });

  it('409 PAYMENT_IN_PROGRESS on resume says so and does not reopen', async () => {
    mockCreate.mockResolvedValue(paidBooking());
    mockOpenAuth.mockResolvedValue({ type: 'cancel' });
    // The backend's wording for a genuinely unpaid checkout.
    mockVerify.mockRejectedValue({
      code: 'VALIDATION_ERROR',
      status: 400,
      message: 'Payment has not been completed',
    });
    const tree = await render();
    await chooseMethod(tree);
    await act(async () => {
      await cta(tree).props.onPress();
    });
    mockCheckout.mockRejectedValue({
      code: 'PAYMENT_IN_PROGRESS',
      status: 409,
    });
    mockOpenAuth.mockClear();
    await act(async () => {
      await cta(tree).props.onPress();
    });
    expect(mockOpenAuth).not.toHaveBeenCalled();
    expect(text(tree)).toContain(PAY_COPY.inProgress);
  });

  it('503 PRICING_UNAVAILABLE: dollars only, message, Pay disabled, Try again', async () => {
    mockCreate.mockRejectedValue({
      code: 'PRICING_UNAVAILABLE',
      status: 503,
      message: 'x',
    });
    const tree = await render();
    const t = text(tree);
    expect(t).toContain(PAY_COPY.pricingUnavailable);
    expect(t).toContain('$35.00');
    expect(t).not.toContain('₦');
    expect(cta(tree).props.accessibilityLabel).toBe('Pay');
    expect(cta(tree).props.disabled).toBe(true);
    // "Try again" re-runs the booking call.
    mockCreate.mockResolvedValue(paidBooking());
    const retry = pressables(tree).find(
      (n) => n.findAll((c) => c.props.children === 'Try again').length > 0,
    );
    await act(async () => {
      await retry!.props.onPress();
    });
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(text(tree)).toContain('₦47,389.40');
  });

  it('other failures (502 / network) never crash and keep the retry', async () => {
    mockCreate.mockRejectedValue({
      code: 'BILLING_PROVIDER_ERROR',
      status: 502,
    });
    const tree = await render();
    expect(text(tree)).toContain(PAY_COPY.error);
    expect(text(tree)).toContain('Try again');
  });

  it('an expired quote shows the expired message and "Refresh price" re-prices the same booking', async () => {
    mockCreate.mockResolvedValue(paidBooking());
    const tree = await render();
    // Jump the device clock past the lock (device 10:33 = server 10:31,
    // the device runs 2 minutes fast) and let the next tick render.
    (Date.now as jest.Mock).mockReturnValue(
      new Date('2026-11-14T10:33:00.000Z').getTime(),
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1100));
    });
    expect(text(tree)).toContain(PAY_COPY.expired);
    expect(cta(tree).props.accessibilityLabel).toBe('Refresh price');
    mockCheckout.mockResolvedValue({
      requiresPayment: true,
      authorizationUrl: CHECKOUT,
      reference: 'cons-ref-3',
      consultation: {
        ...paidBooking(),
        quoteExpiresAt: '2026-11-14T11:01:00.000Z',
      },
    });
    await act(async () => {
      await cta(tree).props.onPress();
    });
    expect(mockCheckout).toHaveBeenCalledWith('cons-1');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});

// ── Fix round 1 (review of japa#183) ─────────────────────────────────────────
// How the SCREEN wires each verify / create verdict (the pure classifier is
// covered in consultationPayFlow.test.ts).
describe('pay.tsx booking: verify and create outcomes (japa#183 review)', () => {
  /** The "Try again" link under the CTA, if it is on screen. */
  const tryAgain = (tree: TestRenderer.ReactTestRenderer) =>
    pressables(tree).find(
      (n) => n.findAll((c) => c.props.children === 'Try again').length > 0,
    );

  /** Mount with a locked quote, pick a method, pay, and let verify answer. */
  async function payThenVerify(verifyAnswer: () => void) {
    mockCreate.mockResolvedValue(paidBooking());
    mockOpenAuth.mockResolvedValue({ type: 'cancel' });
    verifyAnswer();
    const tree = await render();
    await chooseMethod(tree);
    await act(async () => {
      await cta(tree).props.onPress();
    });
    return tree;
  }

  it('verify 409 BOOKING_NOT_PAYABLE: no dead Pay button, "Try again" books a new slot', async () => {
    const tree = await payThenVerify(() =>
      mockVerify.mockRejectedValue({
        code: 'BOOKING_NOT_PAYABLE',
        status: 409,
        message: 'This booking is no longer awaiting payment',
      }),
    );
    expect(mockReplace).not.toHaveBeenCalled();
    expect(text(tree)).toContain(PAY_COPY.notPayable);
    // The CTA is the plain, DISABLED "Pay" (not a live button that does
    // nothing, and not "Open checkout" for a closed booking).
    expect(cta(tree).props.accessibilityLabel).toBe('Pay');
    expect(cta(tree).props.disabled).toBe(true);
    // "Try again" is there and books a NEW booking (create, not /checkout).
    const retry = tryAgain(tree);
    expect(retry).toBeDefined();
    mockCreate.mockResolvedValue(
      paidBooking({ id: 'cons-2', reference: 'cons-ref-9' }),
    );
    await act(async () => {
      await retry!.props.onPress();
    });
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCheckout).not.toHaveBeenCalled();
    // The new quote is payable again, labelled as a fresh "Pay ₦…".
    expect(cta(tree).props.accessibilityLabel).toBe('Pay ₦47,389.40');
    expect(cta(tree).props.disabled).toBe(false);
  });

  for (const code of ['QUOTE_EXPIRED', 'CHECKOUT_REPLACED']) {
    it(`verify 409 ${code}: shows the new quote, and the next Pay opens it directly`, async () => {
      const NEW_URL = 'https://checkout.paystack.com/new';
      const tree = await payThenVerify(() =>
        mockVerify.mockRejectedValue({
          code,
          status: 409,
          data: {
            authorizationUrl: NEW_URL,
            reference: 'cons-ref-2',
            consultation: {
              ...paidBooking(),
              chargedAmountMinor: 4_900_000,
              quoteExpiresAt: '2026-11-14T11:00:00.000Z',
            },
          },
        }),
      );
      // The new amount is on screen before anything else opens.
      expect(mockReplace).not.toHaveBeenCalled();
      expect(text(tree)).toContain('₦49,000.00');
      expect(text(tree)).toContain(PAY_COPY.newPrice);
      expect(cta(tree).props.accessibilityLabel).toBe('Pay ₦49,000.00');
      // Next Pay: straight to the NEW checkout, verified with the NEW
      // reference, without another /checkout round trip.
      mockOpenAuth.mockClear();
      mockVerify.mockReset();
      mockVerify.mockResolvedValue({
        verified: true,
        consultation: {
          ...paidBooking(),
          chargedAmountMinor: 4_900_000,
          paymentStatus: 'paid',
        },
      });
      await act(async () => {
        await cta(tree).props.onPress();
      });
      expect(mockCheckout).not.toHaveBeenCalled();
      expect(mockOpenAuth).toHaveBeenCalledWith(
        NEW_URL,
        'durintech://payment-return',
      );
      expect(mockVerify).toHaveBeenCalledWith('cons-ref-2');
      const arg = mockReplace.mock.calls[0][0] as {
        params: Record<string, string>;
      };
      expect(arg.params.paidAmountMinor).toBe('4900000');
    });
  }

  it('verify 2xx that does not say "paid" never reaches the confirmation', async () => {
    const tree = await payThenVerify(() =>
      mockVerify.mockResolvedValue({
        consultation: { ...paidBooking(), paymentStatus: 'pending' },
      }),
    );
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockTrackBooked).not.toHaveBeenCalled();
    expect(text(tree)).toContain(PAY_COPY.notCompleted);
    expect(cta(tree).props.accessibilityLabel).toBe('Open checkout');
  });

  it('verify 2xx in the { requiresPayment: false } shape with a paid summary is paid', async () => {
    await payThenVerify(() =>
      mockVerify.mockResolvedValue({
        requiresPayment: false,
        consultation: { ...paidBooking(), paymentStatus: 'paid' },
      }),
    );
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('verify 400 PAYMENT_MISMATCH: says we are checking it, and offers NO way to pay again', async () => {
    const tree = await payThenVerify(() =>
      mockVerify.mockRejectedValue({
        code: 'PAYMENT_MISMATCH',
        status: 400,
        message: "The payment does not match the booking's price",
      }),
    );
    const t = text(tree);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(t).toContain(PAY_COPY.paymentReview);
    expect(t).not.toContain(PAY_COPY.notCompleted);
    // No pay control of any kind: the CTA is disabled and there is no retry.
    expect(cta(tree).props.accessibilityLabel).toBe('Pay');
    expect(cta(tree).props.disabled).toBe(true);
    expect(tryAgain(tree)).toBeUndefined();
    // Even a forced press opens nothing.
    mockOpenAuth.mockClear();
    await act(async () => {
      await cta(tree).props.onPress();
    });
    expect(mockOpenAuth).not.toHaveBeenCalled();
    expect(mockCheckout).not.toHaveBeenCalled();
  });

  it('verify 400 for a reference problem is not called "unpaid"', async () => {
    const tree = await payThenVerify(() =>
      mockVerify.mockRejectedValue({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'This payment reference does not belong to this booking',
      }),
    );
    expect(text(tree)).toContain(PAY_COPY.unconfirmed);
    expect(text(tree)).not.toContain(PAY_COPY.notCompleted);
    // "Don’t pay again" sits next to "Check again", never "Open checkout".
    expect(cta(tree).props.accessibilityLabel).toBe('Check again');
    // The press only re-verifies: nothing opens, no /checkout.
    mockOpenAuth.mockClear();
    mockVerify.mockClear();
    await act(async () => {
      await cta(tree).props.onPress();
    });
    expect(mockVerify).toHaveBeenCalledWith('cons-ref-1');
    expect(mockOpenAuth).not.toHaveBeenCalled();
    expect(mockCheckout).not.toHaveBeenCalled();
  });

  it('verify 409 PAYMENT_IN_PROGRESS: "Check again" (re-verify only), then paid → confirmation', async () => {
    const tree = await payThenVerify(() =>
      mockVerify.mockRejectedValue({
        code: 'PAYMENT_IN_PROGRESS',
        status: 409,
      }),
    );
    expect(text(tree)).toContain(PAY_COPY.inProgress);
    expect(cta(tree).props.accessibilityLabel).toBe('Check again');
    // The lock note is hidden while the check is pending.
    expect(text(tree)).not.toContain('Your price is locked for 30 minutes.');
    mockOpenAuth.mockClear();
    mockVerify.mockReset();
    mockVerify.mockResolvedValue({
      verified: true,
      consultation: { ...paidBooking(), paymentStatus: 'paid' },
    });
    await act(async () => {
      await cta(tree).props.onPress();
    });
    expect(mockOpenAuth).not.toHaveBeenCalled();
    expect(mockCheckout).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledTimes(1);
    // Booked analytics fired exactly once.
    expect(mockTrackBooked).toHaveBeenCalledTimes(1);
  });

  it('verify bare 503 (no PRICING_UNAVAILABLE code): "Check again", never "Nothing was charged"', async () => {
    const tree = await payThenVerify(() =>
      mockVerify.mockRejectedValue({ code: 'UNKNOWN_ERROR', status: 503 }),
    );
    const t = text(tree);
    expect(t).toContain(PAY_COPY.verifyFailed);
    expect(t).not.toContain('Nothing was charged');
    expect(t).not.toContain(PAY_COPY.pricingUnavailable);
    expect(cta(tree).props.accessibilityLabel).toBe('Check again');
  });

  it('a pending check is never shown as expired, even after the lock has passed', async () => {
    const tree = await payThenVerify(() =>
      mockVerify.mockRejectedValue({ code: 'NETWORK_ERROR', status: 0 }),
    );
    expect(cta(tree).props.accessibilityLabel).toBe('Check again');
    // Device 10:33 = server 10:31: one minute past `quoteExpiresAt`.
    (Date.now as jest.Mock).mockReturnValue(
      new Date('2026-11-14T10:33:00.000Z').getTime(),
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1100));
    });
    const t = text(tree);
    expect(cta(tree).props.accessibilityLabel).toBe('Check again');
    expect(t).not.toContain(PAY_COPY.expired);
    expect(t).toContain(PAY_COPY.verifyFailed);
    // No "locked for 30 minutes · 0:00" note beside the pending check.
    expect(t).not.toContain('Your price is locked for 30 minutes.');
    // The press re-verifies; it does not re-price through /checkout.
    await act(async () => {
      await cta(tree).props.onPress();
    });
    expect(mockCheckout).not.toHaveBeenCalled();
    expect(mockVerify).toHaveBeenLastCalledWith('cons-ref-1');
  });

  it('a double tap on "Try again" sends ONE booking call', async () => {
    mockCreate.mockRejectedValue({
      code: 'BILLING_PROVIDER_ERROR',
      status: 502,
    });
    const tree = await render();
    mockCreate.mockReset();
    mockCreate.mockResolvedValue(paidBooking());
    const retry = tryAgain(tree)!;
    await act(async () => {
      // Two presses before any re-render.
      void retry.props.onPress();
      void retry.props.onPress();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('create 400 VALIDATION_ERROR: "couldn’t book", never "haven’t received your payment"', async () => {
    mockCreate.mockRejectedValue({
      code: 'VALIDATION_ERROR',
      status: 400,
      message: 'The client has no email address to pay with',
    });
    const tree = await render();
    const t = text(tree);
    expect(t).toContain(PAY_COPY.bookingInvalid);
    expect(t).not.toContain(PAY_COPY.notCompleted);
    expect(tryAgain(tree)).toBeDefined();
  });

  // A checkout first opened on the web returns to the WEB confirm page
  // inside the lock, so the auth browser never reaches the app deep link:
  // the user closes it. That is not a failure: verify decides.
  for (const closed of ['cancel', 'dismiss']) {
    it(`browser closed by the user (${closed}) after paying on a web-return checkout → verified, confirmation`, async () => {
      mockCreate.mockResolvedValue(paidBooking());
      mockOpenAuth.mockResolvedValue({ type: closed });
      mockVerify.mockResolvedValue({
        verified: true,
        consultation: { ...paidBooking(), paymentStatus: 'paid' },
      });
      const tree = await render();
      await chooseMethod(tree);
      await act(async () => {
        await cta(tree).props.onPress();
      });
      expect(mockVerify).toHaveBeenCalledWith('cons-ref-1');
      expect(mockReplace).toHaveBeenCalledTimes(1);
      const arg = mockReplace.mock.calls[0][0] as { pathname: string };
      expect(arg.pathname).toBe('/confirmation');
      // No error of any kind was shown on the way.
      expect(text(tree)).not.toContain(PAY_COPY.error);
      expect(text(tree)).not.toContain(PAY_COPY.notCompleted);
    });
  }

  it('verify network / 5xx after Paystack: no "Nothing was charged", "Check again" re-verifies the same reference', async () => {
    const tree = await payThenVerify(() =>
      mockVerify.mockRejectedValue({ code: 'NETWORK_ERROR', status: 0 }),
    );
    let t = text(tree);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(t).toContain(PAY_COPY.verifyFailed);
    expect(t).not.toContain('Nothing was charged');
    expect(cta(tree).props.accessibilityLabel).toBe('Check again');
    expect(cta(tree).props.disabled).toBe(false);

    // A 5xx on the re-check: still "Check again", still nothing opened.
    mockOpenAuth.mockClear();
    mockVerify.mockReset();
    mockVerify.mockRejectedValue({ code: 'INTERNAL_ERROR', status: 500 });
    await act(async () => {
      await cta(tree).props.onPress();
    });
    t = text(tree);
    expect(mockVerify).toHaveBeenCalledWith('cons-ref-1');
    expect(t).toContain(PAY_COPY.verifyFailed);
    expect(t).not.toContain('Nothing was charged');
    expect(cta(tree).props.accessibilityLabel).toBe('Check again');

    // The re-check gets through and the booking IS paid: confirmation,
    // with the SAME reference, no checkout opened, no /checkout, no rebook.
    mockVerify.mockReset();
    mockVerify.mockResolvedValue({
      verified: true,
      consultation: { ...paidBooking(), paymentStatus: 'paid' },
    });
    await act(async () => {
      await cta(tree).props.onPress();
    });
    expect(mockVerify).toHaveBeenCalledTimes(1);
    expect(mockVerify).toHaveBeenCalledWith('cons-ref-1');
    expect(mockOpenAuth).not.toHaveBeenCalled();
    expect(mockCheckout).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    const arg = mockReplace.mock.calls[0][0] as {
      pathname: string;
      params: Record<string, string>;
    };
    expect(arg.pathname).toBe('/confirmation');
    expect(arg.params.paidAmountMinor).toBe('4738940');
  });

  it('"Check again" that finds the checkout unpaid goes back to "Open checkout"', async () => {
    const tree = await payThenVerify(() =>
      mockVerify.mockRejectedValue({
        code: 'BILLING_PROVIDER_ERROR',
        status: 502,
      }),
    );
    expect(cta(tree).props.accessibilityLabel).toBe('Check again');
    mockVerify.mockReset();
    mockVerify.mockRejectedValue({
      code: 'VALIDATION_ERROR',
      status: 400,
      message: 'Payment has not been completed',
    });
    await act(async () => {
      await cta(tree).props.onPress();
    });
    expect(mockReplace).not.toHaveBeenCalled();
    expect(text(tree)).toContain(PAY_COPY.notCompleted);
    expect(cta(tree).props.accessibilityLabel).toBe('Open checkout');
  });

  it('create 402 monthly limit: its own message, no retry, Pay disabled', async () => {
    mockCreate.mockRejectedValue({
      code: 'UPGRADE_REQUIRED',
      status: 402,
      message: "You've reached your plan's monthly consultation limit.",
    });
    const tree = await render();
    expect(text(tree)).toContain(PAY_COPY.limitReached);
    expect(tryAgain(tree)).toBeUndefined();
    expect(cta(tree).props.disabled).toBe(true);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  // japa#472: the slot has already started. The backend's words in the
  // InlineError, no Pay button, no retry, no spinner; "Pick another time"
  // goes back to the booking screen.
  it('create 400 SLOT_IN_PAST: the backend message, no Pay, "Pick another time" goes back', async () => {
    mockCreate.mockRejectedValue({
      code: 'SLOT_IN_PAST',
      status: 400,
      message: 'That time has already passed. Please pick a later time.',
    });
    const tree = await render();
    expect(text(tree)).toContain(
      'That time has already passed. Please pick a later time.',
    );
    // The only labelled CTA is "Pick another time"; nothing reads "Pay".
    expect(cta(tree).props.accessibilityLabel).toBe('Pick another time');
    // No Pay button: no text reads "Pay" or "Pay ₦…" (the method rows'
    // "Pay from any Nigerian bank" is a description, not a button).
    expect(text(tree).split(' | ')).not.toContainEqual(
      expect.stringMatching(/^Pay($| [^f])/),
    );
    expect(tryAgain(tree)).toBeUndefined();
    // No spinner left running.
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
    await act(async () => {
      cta(tree).props.onPress();
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
    // The slot was never re-booked.
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// japa#288: the server hands back the client's unpaid booking of the same
// slot (200 `resumed: true`) instead of booking it twice, and names the
// booking on a 409 CHECKOUT_OPENING / PAYMENT_IN_PROGRESS.
// ─────────────────────────────────────────────────────────────────────────────
describe('pay.tsx booking: resumed bookings (japa#288)', () => {
  /** The "Try again" link under the CTA, if it is on screen. */
  const tryAgain = (tree: TestRenderer.ReactTestRenderer) =>
    pressables(tree).find(
      (n) => n.findAll((c) => c.props.children === 'Try again').length > 0,
    );

  /** A payer-safe summary as a 409's `data.consultation` carries it. */
  const summary = (over: Record<string, unknown> = {}) => ({
    id: 'cons-old',
    agentName: 'Ada Obi',
    type: 'general',
    scheduledDate: '2026-12-01',
    scheduledTime: '10:00',
    status: 'pending_payment',
    paymentStatus: 'pending',
    priceUsdCents: 3500,
    chargedCurrency: 'NGN',
    chargedAmountMinor: 4_738_940,
    effectiveRate: 1353.97,
    quoteExpiresAt: EXPIRES_AT,
    ...over,
  });

  it('a resumed 200 is handled exactly like a 201: its pay screen, one create, no error', async () => {
    mockCreate.mockResolvedValue(
      paidBooking({
        id: 'cons-old',
        reference: 'cons-ref-old',
        resumed: true,
        type: 'general',
        durationMinutes: 30,
      }),
    );
    mockOpenAuth.mockResolvedValue({ type: 'cancel' });
    mockVerify.mockResolvedValue({
      verified: true,
      consultation: summary({ paymentStatus: 'paid', status: 'scheduled' }),
    });
    const tree = await render();
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const t = text(tree);
    expect(t).toContain('₦47,389.40');
    // Same type and length as the pick: no error, and no "earlier booking" note.
    expect(t).not.toContain(PAY_COPY.resumedDetails);
    for (const msg of [PAY_COPY.error, PAY_COPY.bookingInvalid]) {
      expect(t).not.toContain(msg);
    }
    expect(cta(tree).props.accessibilityLabel).toBe('Pay ₦47,389.40');
    // Pay opens the RESUMED booking's checkout and verifies its reference.
    await chooseMethod(tree);
    await act(async () => {
      await cta(tree).props.onPress();
    });
    expect(mockOpenAuth.mock.calls[0][0]).toBe(CHECKOUT);
    expect(mockVerify).toHaveBeenCalledWith('cons-ref-old');
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('a resumed booking shows ITS type, duration and price, not what was just picked', async () => {
    // Picked: "Initial consultation" (general), 30 min. Booked earlier: a
    // 45-minute document review at an older locked price.
    mockCreate.mockResolvedValue(
      paidBooking({
        id: 'cons-old',
        resumed: true,
        type: 'document_review',
        durationMinutes: 45,
        chargedAmountMinor: 4_900_000,
      }),
    );
    mockOpenAuth.mockResolvedValue({ type: 'cancel' });
    mockVerify.mockResolvedValue({
      verified: true,
      consultation: summary({
        type: 'document_review',
        paymentStatus: 'paid',
        chargedAmountMinor: 4_900_000,
      }),
    });
    const tree = await render();
    const t = text(tree);
    expect(t).toContain('10:00 AM · 45 min');
    expect(t).not.toContain('· 30 min');
    expect(t).toContain('Document Review');
    expect(t).not.toContain('Initial consultation');
    expect(t).toContain(PAY_COPY.resumedDetails);
    expect(cta(tree).props.accessibilityLabel).toBe('Pay ₦49,000.00');
    // The confirmation and the analytics carry the booked values too.
    await chooseMethod(tree);
    await act(async () => {
      await cta(tree).props.onPress();
    });
    const arg = mockReplace.mock.calls[0][0] as {
      params: Record<string, string>;
    };
    expect(arg.params.dur).toBe('45 min');
    expect(arg.params.topic).toBe('Document Review');
    expect(arg.params.paidAmountMinor).toBe('4900000');
    expect(mockTrackBooked).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'document_review' }),
    );
  });

  it('resumed with requiresPayment: false was PAID meanwhile: confirmation with the amount, never "Free"', async () => {
    mockCreate.mockResolvedValue(
      paidBooking({
        id: 'cons-old',
        resumed: true,
        status: 'scheduled',
        paymentStatus: 'paid',
        requiresPayment: false,
        authorizationUrl: undefined,
        reference: undefined,
      }),
    );
    await render();
    expect(mockOpenAuth).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledTimes(1);
    const arg = mockReplace.mock.calls[0][0] as {
      pathname: string;
      params: Record<string, string>;
    };
    expect(arg.pathname).toBe('/confirmation');
    expect(arg.params.free).toBe('');
    expect(arg.params.paidAmountMinor).toBe('4738940');
    expect(arg.params.paidCurrency).toBe('NGN');
  });

  it('a booking resumed 10 minutes into its lock keeps counting to its REAL expiry (20:00, not 30:00)', async () => {
    // Device "now" is 10:02. The earlier booking was locked at 09:52 and
    // expires at 10:22: 20 minutes are left, whatever `quoteLockedAt` says.
    mockCreate.mockResolvedValue(
      paidBooking({
        id: 'cons-old',
        resumed: true,
        quoteLockedAt: '2026-11-14T09:52:00.000Z',
        quoteExpiresAt: '2026-11-14T10:22:00.000Z',
      }),
    );
    const tree = await render();
    const t = text(tree);
    expect(t).toContain('20:00');
    expect(t).not.toContain('30:00');
    expect(t).not.toContain(PAY_COPY.expired);
    expect(cta(tree).props.accessibilityLabel).toBe('Pay ₦47,389.40');
  });

  it('a resumed booking whose lock has already passed shows "Refresh price", which re-prices the same booking', async () => {
    // Locked 09:20, expired 09:50; device "now" is 10:02.
    mockCreate.mockResolvedValue(
      paidBooking({
        id: 'cons-old',
        resumed: true,
        quoteLockedAt: '2026-11-14T09:20:00.000Z',
        quoteExpiresAt: '2026-11-14T09:50:00.000Z',
      }),
    );
    const tree = await render();
    expect(text(tree)).toContain(PAY_COPY.expired);
    expect(text(tree)).not.toContain('Your price is locked');
    expect(cta(tree).props.accessibilityLabel).toBe('Refresh price');
    expect(cta(tree).props.disabled).toBe(false);
    mockCheckout.mockResolvedValue({
      requiresPayment: true,
      authorizationUrl: 'https://checkout.paystack.com/new',
      reference: 'cons-ref-2',
      consultation: summary({
        chargedAmountMinor: 4_900_000,
        quoteExpiresAt: '2026-11-14T10:32:00.000Z',
      }),
    });
    await act(async () => {
      await cta(tree).props.onPress();
    });
    expect(mockCheckout).toHaveBeenCalledWith('cons-old');
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockOpenAuth).not.toHaveBeenCalled();
    expect(cta(tree).props.accessibilityLabel).toBe('Pay ₦49,000.00');
  });

  it('a NEW booking still measures the server clock from its lock (device 2 minutes fast → 30:00)', async () => {
    mockCreate.mockResolvedValue(paidBooking());
    const tree = await render();
    expect(text(tree)).toContain('30:00');
  });

  it('a failed fetch of a 409-named booking never crashes: the 409 summary’s type, and the note anyway', async () => {
    const failed = { data: undefined, isError: true };
    mockDetail.mockImplementation((id) =>
      id === 'cons-old' ? failed : NO_DETAIL,
    );
    // Same type as the pick ("Initial consultation" → general): nothing
    // differs on its own, so only the failed fetch brings the note up.
    mockCreate.mockRejectedValue({
      code: 'CHECKOUT_OPENING',
      status: 409,
      data: { consultation: summary({ type: 'general' }) },
    });
    const tree = await render();
    const t = text(tree);
    expect(t).toContain(PAY_COPY.resumedDetails);
    expect(t).toContain(PAY_COPY.opening);
    expect(t).toContain('Initial consultation');
    // The retry still targets the named booking.
    mockCheckout.mockResolvedValue({
      requiresPayment: true,
      authorizationUrl: CHECKOUT,
      reference: 'cons-ref-old',
      consultation: summary(),
    });
    await act(async () => {
      await tryAgain(tree)!.props.onPress();
    });
    expect(mockCheckout).toHaveBeenCalledWith('cons-old');
    expect(cta(tree).props.accessibilityLabel).toBe('Pay ₦47,389.40');
  });

  it('a failed fetch keeps the type the 409 summary gave', async () => {
    const failed = { data: undefined, isError: true };
    mockDetail.mockImplementation((id) =>
      id === 'cons-old' ? failed : NO_DETAIL,
    );
    mockCreate.mockRejectedValue({
      code: 'CHECKOUT_OPENING',
      status: 409,
      data: { consultation: summary({ type: 'document_review' }) },
    });
    const tree = await render();
    expect(text(tree)).toContain('Document Review');
    expect(text(tree)).toContain(PAY_COPY.resumedDetails);
  });

  it('create 409 CHECKOUT_OPENING: "Try again" goes through /:id/checkout for THAT booking, not a new create', async () => {
    mockCreate.mockRejectedValue({
      code: 'CHECKOUT_OPENING',
      status: 409,
      data: { consultation: summary() },
    });
    const tree = await render();
    expect(text(tree)).toContain(PAY_COPY.opening);
    expect(cta(tree).props.disabled).toBe(true);
    mockCheckout.mockResolvedValue({
      requiresPayment: true,
      authorizationUrl: CHECKOUT,
      reference: 'cons-ref-old',
      consultation: summary(),
    });
    await act(async () => {
      await tryAgain(tree)!.props.onPress();
    });
    expect(mockCheckout).toHaveBeenCalledTimes(1);
    expect(mockCheckout).toHaveBeenCalledWith('cons-old');
    // Still the ONE create from arrival.
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(text(tree)).not.toContain(PAY_COPY.opening);
    expect(cta(tree).props.accessibilityLabel).toBe('Pay ₦47,389.40');
  });

  it('CHECKOUT_OPENING again on the retry keeps retrying the same booking', async () => {
    const opening = {
      code: 'CHECKOUT_OPENING',
      status: 409,
      data: { consultation: summary() },
    };
    mockCreate.mockRejectedValue(opening);
    const tree = await render();
    mockCheckout.mockRejectedValue(opening);
    await act(async () => {
      await tryAgain(tree)!.props.onPress();
    });
    await act(async () => {
      await tryAgain(tree)!.props.onPress();
    });
    expect(mockCheckout).toHaveBeenCalledTimes(2);
    expect(mockCheckout).toHaveBeenLastCalledWith('cons-old');
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(text(tree)).toContain(PAY_COPY.opening);
  });

  it('a 409-named booking shows its real duration once the booking is fetched', async () => {
    // The summary has no duration: the screen reads GET /consultations/:id.
    const detail = {
      data: { id: 'cons-old', type: 'document_review', durationMinutes: 45 },
    };
    mockDetail.mockImplementation((id) =>
      id === 'cons-old' ? detail : NO_DETAIL,
    );
    mockCreate.mockRejectedValue({
      code: 'CHECKOUT_OPENING',
      status: 409,
      data: { consultation: summary({ type: 'document_review' }) },
    });
    const tree = await render();
    const t = text(tree);
    expect(t).toContain('10:00 AM · 45 min');
    expect(t).toContain('Document Review');
    expect(t).toContain(PAY_COPY.resumedDetails);
  });

  it('CHECKOUT_OPENING without a booking in data falls back to a plain retry (create)', async () => {
    // An older backend: nothing to adopt, so the retry is the create, which
    // the server resumes by itself.
    mockCreate.mockRejectedValue({ code: 'CHECKOUT_OPENING', status: 409 });
    const tree = await render();
    mockCreate.mockResolvedValue(paidBooking({ resumed: true }));
    await act(async () => {
      await tryAgain(tree)!.props.onPress();
    });
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCheckout).not.toHaveBeenCalled();
  });

  it('create 409 PAYMENT_IN_PROGRESS: the in-progress message, the booking’s amount, and "Check again" only', async () => {
    mockCreate.mockRejectedValue({
      code: 'PAYMENT_IN_PROGRESS',
      status: 409,
      data: {
        authorizationUrl: CHECKOUT,
        reference: 'cons-ref-old',
        consultation: summary(),
      },
    });
    const tree = await render();
    const t = text(tree);
    expect(t).toContain(PAY_COPY.inProgress);
    expect(t).toContain('₦47,389.40');
    expect(t).not.toContain('Nothing was charged');
    // Live without a payment method: it only checks, it does not pay.
    expect(cta(tree).props.accessibilityLabel).toBe('Check again');
    expect(cta(tree).props.disabled).toBe(false);
    expect(tryAgain(tree)).toBeUndefined();
    // Check again = verify THAT reference. No browser, no create, no checkout.
    mockVerify.mockRejectedValue({ code: 'PAYMENT_IN_PROGRESS', status: 409 });
    await act(async () => {
      await cta(tree).props.onPress();
    });
    expect(mockVerify).toHaveBeenCalledWith('cons-ref-old');
    expect(mockOpenAuth).not.toHaveBeenCalled();
    expect(mockCheckout).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(text(tree)).toContain(PAY_COPY.inProgress);
    expect(cta(tree).props.accessibilityLabel).toBe('Check again');
    // The payment lands: confirmation.
    mockVerify.mockResolvedValue({
      verified: true,
      consultation: summary({ paymentStatus: 'paid' }),
    });
    await act(async () => {
      await cta(tree).props.onPress();
    });
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('in progress, then found unpaid: "Open checkout" reopens through /:id/checkout of the same booking', async () => {
    mockCreate.mockRejectedValue({
      code: 'PAYMENT_IN_PROGRESS',
      status: 409,
      data: {
        authorizationUrl: CHECKOUT,
        reference: 'cons-ref-old',
        consultation: summary(),
      },
    });
    const tree = await render();
    mockVerify.mockRejectedValue({
      code: 'VALIDATION_ERROR',
      status: 400,
      message: 'Payment has not been completed',
    });
    await act(async () => {
      await cta(tree).props.onPress();
    });
    expect(text(tree)).toContain(PAY_COPY.notCompleted);
    expect(cta(tree).props.accessibilityLabel).toBe('Open checkout');
    mockCheckout.mockResolvedValue({
      requiresPayment: true,
      authorizationUrl: CHECKOUT,
      reference: 'cons-ref-old',
      consultation: summary(),
    });
    mockOpenAuth.mockResolvedValue({ type: 'cancel' });
    await chooseMethod(tree);
    await act(async () => {
      await cta(tree).props.onPress();
    });
    expect(mockCheckout).toHaveBeenCalledWith('cons-old');
    expect(mockOpenAuth).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('PAYMENT_IN_PROGRESS with no booking in data: the message and a retry, nothing else', async () => {
    mockCreate.mockRejectedValue({ code: 'PAYMENT_IN_PROGRESS', status: 409 });
    const tree = await render();
    expect(text(tree)).toContain(PAY_COPY.inProgress);
    expect(cta(tree).props.disabled).toBe(true);
    expect(tryAgain(tree)).toBeDefined();
  });

  it('an adopted booking that closed (409 BOOKING_NOT_PAYABLE) is dropped: the next try books anew', async () => {
    mockCreate.mockRejectedValue({
      code: 'CHECKOUT_OPENING',
      status: 409,
      data: { consultation: summary({ type: 'document_review' }) },
    });
    const tree = await render();
    mockCheckout.mockRejectedValue({
      code: 'BOOKING_NOT_PAYABLE',
      status: 409,
    });
    await act(async () => {
      await tryAgain(tree)!.props.onPress();
    });
    expect(text(tree)).toContain(PAY_COPY.notPayable);
    // Back to the user's own pick (the old booking's details are gone).
    expect(text(tree)).toContain('Initial consultation');
    mockCreate.mockResolvedValue(paidBooking({ id: 'cons-new' }));
    await act(async () => {
      await tryAgain(tree)!.props.onPress();
    });
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(cta(tree).props.accessibilityLabel).toBe('Pay ₦47,389.40');
  });
});
