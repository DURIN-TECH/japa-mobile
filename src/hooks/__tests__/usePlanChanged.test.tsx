// ─────────────────────────────────────────────────────────────────────────────
// japa#473: a locked start clears when the plan ACTUALLY changes.
//
// `useStartApplication` keeps an 'upgrade' failure after a 402. When the
// client comes back from the plans screen with a new plan (the server's
// GET /subscriptions/me answer moves), the failure clears and the start bar
// shows its normal start button again. Coming back without paying (same
// answer) keeps the upgrade card. Nothing starts by itself.
//
// Real QueryClient + the real hook and bar; the API, router and native
// visual modules are stubbed.
// ─────────────────────────────────────────────────────────────────────────────

// The current plan the stubbed GET /subscriptions/me answers with.
let mockSubscription: unknown = {
  subscription: null,
  entitlements: { features: [] },
};
jest.mock('@/services/api.service', () => ({
  apiService: {
    post: jest.fn(),
    get: jest.fn(async (url: string) => {
      if (url === '/subscriptions/me') return { data: mockSubscription };
      throw new Error(`unexpected GET ${url}`);
    }),
  },
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('expo-blur', () => ({
  BlurView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStartApplication } from '../useStartApplication';
import { planSignature } from '../usePlanChanged';
import { StartApplicationBar } from '@/components/explorer/StartApplicationBar';
import { apiService } from '@/services/api.service';

const post = (
  apiService as unknown as {
    post: jest.Mock<(...a: unknown[]) => Promise<unknown>>;
  }
).post;

const PAID = {
  subscription: { planId: 'client_pro', status: 'active' },
  entitlements: { features: ['ai.review'] },
};

let qc: QueryClient;
let tree: ReactTestRenderer | null = null;
const hook: { current: ReturnType<typeof useStartApplication> | null } = {
  current: null,
};

/** The visa screen's start area: the hook feeding the real bar. */
function Screen() {
  const s = useStartApplication('visa-1', 'gb');
  hook.current = s;
  return (
    <StartApplicationBar
      price={100}
      creating={s.creating}
      failure={s.failure}
      onStart={s.start}
      onDismissUpgrade={s.dismissUpgrade}
    />
  );
}

/** Let queries resolve and effects run. */
async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

/** Mount, then tap start once and get a 402 (the upgrade card). */
async function mountLocked() {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  qc = new QueryClient({
    // gcTime Infinity: no garbage-collection timers outlive the test.
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  await act(async () => {
    tree = create(
      <QueryClientProvider client={qc}>
        <Screen />
      </QueryClientProvider>,
    );
  });
  await flush();
  post.mockRejectedValueOnce({ status: 402, code: 'PAYMENT_REQUIRED' });
  await act(async () => {
    await hook.current!.start();
  });
  expect(hook.current!.failure).toBe('upgrade');
}

/** The server's plan answer is re-read (what verify's invalidation does). */
async function refetchPlan() {
  await act(async () => {
    await qc.invalidateQueries({ queryKey: ['subscription', 'me'] });
  });
  await flush();
}

const hasStartButton = () =>
  tree!.root.findAll((n) => n.props.testID === 'startBar.start').length > 0;

beforeEach(() => {
  post.mockReset();
  mockSubscription = { subscription: null, entitlements: { features: [] } };
});
afterEach(() => {
  act(() => tree?.unmount());
  tree = null;
  qc?.clear();
});

describe('usePlanChanged + useStartApplication (japa#473)', () => {
  it('plan changes → the upgrade failure clears and the start button is back', async () => {
    await mountLocked();
    expect(hasStartButton()).toBe(false);

    mockSubscription = PAID;
    await refetchPlan();

    expect(hook.current!.failure).toBeNull();
    expect(hasStartButton()).toBe(true);
    // Not run automatically: still only the one (402) request.
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('plan unchanged (came back without paying) → stays locked', async () => {
    await mountLocked();
    await refetchPlan();
    expect(hook.current!.failure).toBe('upgrade');
    expect(hasStartButton()).toBe(false);
  });

  it('after unlocking, a tap asks the server again (402 brings the card back)', async () => {
    await mountLocked();
    mockSubscription = PAID;
    await refetchPlan();
    post.mockRejectedValueOnce({ status: 402, code: 'PAYMENT_REQUIRED' });
    await act(async () => {
      await hook.current!.start();
    });
    expect(post).toHaveBeenCalledTimes(2);
    expect(hook.current!.failure).toBe('upgrade');
  });
});

describe('planSignature', () => {
  it('is undefined only while unknown; null is a real "no paid plan" answer', () => {
    expect(planSignature(undefined)).toBeUndefined();
    expect(planSignature(null)).toBeDefined();
    expect(
      planSignature({ subscription: null, entitlements: null }),
    ).not.toEqual(planSignature(PAID as never));
  });
});
