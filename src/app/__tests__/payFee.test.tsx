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
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
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
jest.mock('@/hooks/useConsultations', () => ({
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
  fxRate: 1353.97,
  quoteLockedAt: LOCKED_AT,
  quoteExpiresAt: EXPIRES_AT,
  requiresPayment: true,
  authorizationUrl: CHECKOUT,
  checkoutUrl: CHECKOUT,
  reference: 'cons-ref-1',
  ...over,
});

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
  mockTrackBooked.mockReset();
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
    expect(mockPush).toHaveBeenCalledTimes(1);
    const arg = mockPush.mock.calls[0][0] as {
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
    const arg = mockPush.mock.calls[0][0] as {
      pathname: string;
      params: Record<string, string>;
    };
    expect(arg.pathname).toBe('/confirmation');
    expect(arg.params.paidAmountMinor).toBe('4738940');
    expect(arg.params.paidCurrency).toBe('NGN');
    expect(arg.params.priceUsdCents).toBe('3500');
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
    expect(mockPush).not.toHaveBeenCalled();
    expect(text(tree)).toContain(PAY_COPY.notCompleted);
    expect(cta(tree).props.accessibilityLabel).toBe('Open checkout');
  });

  it('reopening resumes via /checkout and shows a FRESH price before opening', async () => {
    mockCreate.mockResolvedValue(paidBooking());
    mockOpenAuth.mockResolvedValue({ type: 'cancel' });
    mockVerify.mockRejectedValue({ code: 'VALIDATION_ERROR', status: 400 });
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
    mockVerify.mockRejectedValue({ code: 'VALIDATION_ERROR', status: 400 });
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
    mockCreate.mockRejectedValue({ code: 'BILLING_PROVIDER_ERROR', status: 502 });
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
