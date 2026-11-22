// ─────────────────────────────────────────────────────────────────────────────
// subscription.tsx Upgrade (japa#252): checkout opens in the in-app auth
// browser, and the plan changes ONLY through a confirmed verify. Renders the
// real screen with react-test-renderer; the hooks, router, blur, gradient,
// safe-area and the auth browser are stubbed.
// ─────────────────────────────────────────────────────────────────────────────

// ── Stubs (names start with `mock` so jest.mock factories may use them) ──────
const mockStart = jest.fn<(planId: string) => Promise<unknown>>();
const mockVerify = jest.fn<(reference: string) => Promise<unknown>>();
// japa#474: the plans / current-plan refetches, for the pull-to-refresh test.
const mockPlansRefetch = jest.fn(async () => undefined);
const mockMineRefetch = jest.fn(async () => undefined);
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
// japa#473: the router spies, the `?from=` param, focus and history are all
// settable per test.
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockRouterState = {
  params: {} as Record<string, string>,
  canGoBack: true,
  focused: true,
  /** The latest focus callback, so a test can simulate "focused again". */
  onFocus: null as null | (() => void),
};
jest.mock('expo-router', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => ({
      push: jest.fn(),
      back: mockBack,
      replace: mockReplace,
      canGoBack: () => mockRouterState.canGoBack,
    }),
    useLocalSearchParams: () => mockRouterState.params,
    useNavigation: () => ({ isFocused: () => mockRouterState.focused }),
    // Run the focus callback like an effect (the screen is focused on mount).
    useFocusEffect: (cb: () => void) =>
      ReactActual.useEffect(() => {
        mockRouterState.onFocus = cb;
        cb();
      }, [cb]),
  };
});
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
    refetch: mockPlansRefetch,
  }),
  useMySubscription: () => ({
    data: { subscription: null, entitlements: null },
    isError: false,
    refetch: mockMineRefetch,
  }),
  useStartCheckout: () => ({ mutateAsync: mockStart }),
  useVerifySubscription: () => ({ mutateAsync: mockVerify }),
}));

import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import TestRenderer, { act } from 'react-test-renderer';
import { RefreshControl } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
  const tree = await render();
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

/** Render the screen and let its first effects run. */
async function render() {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    // japa#474: the screen's pull-to-refresh needs a query client. Like the
    // app's (`QueryProvider`), it knows the plan fetcher, so a pull re-reads
    // `/subscriptions/me` through it (fix round 1: not via `mine.refetch`).
    const client = new QueryClient();
    client.setQueryDefaults(['subscription', 'me'], {
      queryFn: async () => {
        await mockMineRefetch();
        return null;
      },
    });
    tree = TestRenderer.create(
      <QueryClientProvider client={client}>
        <SubscriptionView />
      </QueryClientProvider>,
    );
  });
  return tree;
}

/** Tap "Try again" on the failed-verify error. */
async function tapTryAgain(tree: TestRenderer.ReactTestRenderer) {
  const retry = tree.root.find(
    (n) =>
      typeof n.props.onPress === 'function' &&
      typeof n.type !== 'string' &&
      n.findAll((c) => c.props.children === 'Try again').length > 0,
  );
  await act(async () => {
    await retry.props.onPress();
  });
}

beforeEach(() => {
  mockBack.mockReset();
  mockReplace.mockReset();
  mockRouterState.params = {};
  mockRouterState.canGoBack = true;
  mockRouterState.focused = true;
  mockRouterState.onFocus = null;
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

// ── japa#473: opened from a locked action, the screen returns there ─────────
describe('subscription.tsx return to the locked action (japa#473)', () => {
  const FROM_UPGRADE = { from: 'upgrade' };

  it('from-upgrade + paid → router.back() once, no Home', async () => {
    mockRouterState.params = FROM_UPGRADE;
    mockOpenAuth.mockResolvedValue({ type: 'success' });
    mockVerify.mockResolvedValue({ verified: true });
    await upgrade();
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('from-upgrade + Paystack closed and nothing paid → back (still locked there)', async () => {
    mockRouterState.params = FROM_UPGRADE;
    mockOpenAuth.mockResolvedValue({ type: 'cancel' });
    mockVerify.mockRejectedValue({ status: 400 });
    await upgrade();
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('from-upgrade + returned but not paid → stays, shows the message', async () => {
    mockRouterState.params = FROM_UPGRADE;
    mockOpenAuth.mockResolvedValue({ type: 'success' });
    mockVerify.mockRejectedValue({ status: 400 });
    const tree = await upgrade();
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(text(tree)).toContain(SUBSCRIPTION_NOT_PAID_MESSAGE);
  });

  it('from-upgrade + checkout could not open → stays', async () => {
    mockRouterState.params = FROM_UPGRADE;
    mockOpenAuth.mockRejectedValue(new Error('no browser'));
    await upgrade();
    expect(mockVerify).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('from-upgrade + verify call failed → stays; a paid "Try again" then closes once', async () => {
    mockRouterState.params = FROM_UPGRADE;
    mockOpenAuth.mockResolvedValue({ type: 'success' });
    mockVerify.mockRejectedValueOnce({ status: 0, code: 'NETWORK_ERROR' });
    const tree = await upgrade();
    expect(mockBack).not.toHaveBeenCalled();
    expect(text(tree)).toContain(SUBSCRIPTION_VERIFY_ERROR_MESSAGE);

    mockVerify.mockResolvedValueOnce({ verified: true });
    await tapTryAgain(tree);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('no marker (profile / settings) + paid → stays open', async () => {
    mockOpenAuth.mockResolvedValue({ type: 'success' });
    mockVerify.mockResolvedValue({ verified: true });
    await upgrade();
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('no marker + cancelled → stays open', async () => {
    mockOpenAuth.mockResolvedValue({ type: 'dismiss' });
    mockVerify.mockRejectedValue({ status: 400 });
    await upgrade();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('from-upgrade + no history (deep link / cold start) → Home', async () => {
    mockRouterState.params = FROM_UPGRADE;
    mockRouterState.canGoBack = false;
    mockOpenAuth.mockResolvedValue({ type: 'success' });
    mockVerify.mockResolvedValue({ verified: true });
    await upgrade();
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/home');
  });

  it('Android: /payment-return still on top → waits, then closes once on refocus', async () => {
    mockRouterState.params = FROM_UPGRADE;
    // The verify answers while /payment-return covers the plans screen.
    mockRouterState.focused = false;
    mockOpenAuth.mockResolvedValue({ type: 'success' });
    mockVerify.mockResolvedValue({ verified: true });
    const tree = await upgrade();
    expect(mockBack).not.toHaveBeenCalled();

    // /payment-return removed itself: we are focused again → leave once.
    mockRouterState.focused = true;
    await act(async () => {
      mockRouterState.onFocus?.();
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
    // A later focus (nothing pending any more) never pops a second screen.
    await act(async () => {
      mockRouterState.onFocus?.();
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(tree).toBeTruthy();
  });
});

// ── japa#474: pull-to-refresh on the plans screen ───────────────────────────
describe('subscription.tsx pull-to-refresh (japa#474)', () => {
  it('a coral RefreshControl; a pull refetches the plans and the current plan (once)', async () => {
    mockPlansRefetch.mockClear();
    mockMineRefetch.mockClear();
    const tree = await render();
    const rc = tree.root.findByType(RefreshControl);
    expect(rc.props.tintColor).toBe('#F4516C');
    expect(rc.props.enabled).toBe(true);
    await act(async () => {
      await rc.props.onRefresh();
    });
    expect(mockPlansRefetch).toHaveBeenCalledTimes(1);
    expect(mockMineRefetch).toHaveBeenCalledTimes(1);
  });

  it('switched off while a checkout is in flight (no refetch races the verify)', async () => {
    mockPlansRefetch.mockClear();
    // Checkout never closes during this test: the screen stays busy.
    mockOpenAuth.mockImplementation(() => new Promise(() => {}));
    const tree = await render();
    const cta = tree.root.find(
      (n) =>
        typeof n.props.onPress === 'function' &&
        n.findAll((c) => c.props.children === 'Upgrade').length > 0 &&
        typeof n.type !== 'string',
    );
    await act(async () => {
      void cta.props.onPress();
    });
    const rc = tree.root.findByType(RefreshControl);
    expect(rc.props.enabled).toBe(false);
    await act(async () => {
      await rc.props.onRefresh();
    });
    expect(mockPlansRefetch).not.toHaveBeenCalled();
  });
});
