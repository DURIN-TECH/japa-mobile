// ─────────────────────────────────────────────────────────────────────────────
// subscription.tsx Upgrade (japa#252): checkout opens in the in-app auth
// browser, and the plan changes ONLY through a confirmed verify. Renders the
// real screen with react-test-renderer; the hooks, router, blur, gradient,
// safe-area and the auth browser are stubbed.
// ─────────────────────────────────────────────────────────────────────────────

// ── Stubs (names start with `mock` so jest.mock factories may use them) ──────
const mockStart = jest.fn<(planId: string) => Promise<unknown>>();
const mockVerify = jest.fn<(reference: string) => Promise<unknown>>();
const mockOpenAuth =
  jest.fn<
    (url: string, redirect: string) => Promise<{ type: string; url?: string }>
  >();

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
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: (url: string, redirect: string) =>
    mockOpenAuth(url, redirect),
  maybeCompleteAuthSession: jest.fn(),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/hooks/useSubscription', () => ({
  // One free + one paid client plan; the user is on the free one.
  usePlans: () => ({
    data: [
      {
        id: 'client_free',
        name: 'Free',
        audience: 'client',
        priceKobo: 0,
        interval: 'none',
        features: [],
      },
      {
        id: 'client_pro',
        name: 'Pro',
        audience: 'client',
        priceKobo: 500_000,
        interval: 'month',
        features: [],
      },
    ],
    isLoading: false,
    isError: false,
    isSuccess: true,
    refetch: jest.fn(),
  }),
  useMySubscription: () => ({
    data: { subscription: null, entitlements: null },
    isError: false,
    refetch: jest.fn(),
  }),
  useStartCheckout: () => ({ mutateAsync: mockStart }),
  useVerifySubscription: () => ({ mutateAsync: mockVerify }),
}));

import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import TestRenderer, { act } from 'react-test-renderer';
import SubscriptionView from '../subscription';
import {
  SUBSCRIPTION_NOT_PAID_MESSAGE,
  SUBSCRIPTION_VERIFY_ERROR_MESSAGE,
} from '@/hooks/paystackCheckout';

const CHECKOUT = 'https://checkout.paystack.com/sub';

/** All rendered text, joined. */
function text(tree: TestRenderer.ReactTestRenderer) {
  return tree.root
    .findAll((n) => typeof n.props.children === 'string')
    .map((n) => n.props.children as string)
    .join(' | ');
}

/** Render, tap the paid plan's "Upgrade" and let checkout + verify settle. */
async function upgrade() {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<SubscriptionView />);
  });
  // The Upgrade CTA is the pressable whose subtree reads "Upgrade".
  const cta = tree.root.find(
    (n) =>
      typeof n.props.onPress === 'function' &&
      n.findAll((c) => c.props.children === 'Upgrade').length > 0 &&
      typeof n.type !== 'string',
  );
  await act(async () => {
    await cta.props.onPress();
  });
  return tree;
}

beforeEach(() => {
  mockStart.mockReset();
  mockVerify.mockReset();
  mockOpenAuth.mockReset();
  mockStart.mockResolvedValue({ url: CHECKOUT, reference: 'ref_sub' });
});

describe('subscription.tsx return to app', () => {
  it('success redirect → verifies OUR reference; no error shown', async () => {
    mockOpenAuth.mockResolvedValue({
      type: 'success',
      url: 'durintech://payment-return?reference=forged',
    });
    mockVerify.mockResolvedValue({ verified: true });
    const tree = await upgrade();
    expect(mockStart).toHaveBeenCalledWith('client_pro');
    expect(mockOpenAuth).toHaveBeenCalledWith(
      CHECKOUT,
      'durintech://payment-return',
    );
    expect(mockVerify).toHaveBeenCalledWith('ref_sub');
    expect(text(tree)).not.toContain(SUBSCRIPTION_NOT_PAID_MESSAGE);
    expect(text(tree)).not.toContain(SUBSCRIPTION_VERIFY_ERROR_MESSAGE);
  });

  it('user cancels and nothing was paid → verifies once, stays silent', async () => {
    mockOpenAuth.mockResolvedValue({ type: 'cancel' });
    mockVerify.mockRejectedValue({ status: 400 });
    const tree = await upgrade();
    expect(mockVerify).toHaveBeenCalledTimes(1);
    expect(text(tree)).not.toContain(SUBSCRIPTION_NOT_PAID_MESSAGE);
    expect(text(tree)).not.toContain(SUBSCRIPTION_VERIFY_ERROR_MESSAGE);
  });

  it('returned but verify says not paid (400) → not-paid InlineError', async () => {
    mockOpenAuth.mockResolvedValue({ type: 'success' });
    mockVerify.mockRejectedValue({ status: 400 });
    const tree = await upgrade();
    expect(text(tree)).toContain(SUBSCRIPTION_NOT_PAID_MESSAGE);
  });

  it('verify call fails (network) → error + Try again re-verifies the same reference', async () => {
    mockOpenAuth.mockResolvedValue({ type: 'success' });
    mockVerify.mockRejectedValueOnce({ status: 0, code: 'NETWORK_ERROR' });
    const tree = await upgrade();
    expect(text(tree)).toContain(SUBSCRIPTION_VERIFY_ERROR_MESSAGE);

    // Retry succeeds this time: error clears, no new checkout opened.
    mockVerify.mockResolvedValueOnce({ verified: true });
    const retry = tree.root.find(
      (n) =>
        typeof n.props.onPress === 'function' &&
        typeof n.type !== 'string' &&
        n.findAll((c) => c.props.children === 'Try again').length > 0,
    );
    await act(async () => {
      await retry.props.onPress();
    });
    expect(mockVerify).toHaveBeenLastCalledWith('ref_sub');
    expect(mockOpenAuth).toHaveBeenCalledTimes(1);
    expect(text(tree)).not.toContain(SUBSCRIPTION_VERIFY_ERROR_MESSAGE);
  });
});
