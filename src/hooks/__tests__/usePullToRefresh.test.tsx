// ─────────────────────────────────────────────────────────────────────────────
// japa#474: the shared pull-to-refresh hook, the foreground plan re-read and
// the full-cache refresh after a confirmed subscription verify.
//
// Real QueryClient; the API and AppState are stubbed. No network.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('@/services/api.service', () => ({
  apiService: { post: jest.fn(), get: jest.fn() },
}));

import React from 'react';
import { AppState } from 'react-native';
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
import { usePullToRefresh, type RefetchSource } from '../usePullToRefresh';
import { usePlanForegroundRefresh } from '../usePlanForegroundRefresh';
import { isPlanQueryKey, useVerifySubscription } from '../useSubscription';
import { apiService } from '@/services/api.service';

const post = (
  apiService as unknown as {
    post: jest.Mock<(...a: unknown[]) => Promise<unknown>>;
  }
).post;

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let qc: QueryClient;
let tree: ReactTestRenderer | null = null;

/** Mount `useHook` under a QueryClientProvider; returns the latest value. */
function mount<T>(useHook: () => T) {
  const ref: { current: T | null } = { current: null };
  function Probe() {
    ref.current = useHook();
    return null;
  }
  act(() => {
    tree = create(
      <QueryClientProvider client={qc}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  return ref as { current: T };
}

/** A promise the test resolves / rejects by hand. */
function deferred() {
  let resolve!: (v?: unknown) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Seed the two plan queries so `refetchQueries` has something to refetch. */
function seedPlan() {
  const plan = jest.fn(async () => ({ subscription: null }));
  const authz = jest.fn(async () => ({ role: 'client' }));
  // refetchQueries needs a queryFn: defaults per key, BEFORE the data, so
  // the cached queries are created with them.
  qc.setQueryDefaults(['subscription', 'me'], { queryFn: plan });
  qc.setQueryDefaults(['authorization'], { queryFn: authz });
  qc.setQueryData(['subscription', 'me'], { subscription: null });
  qc.setQueryData(['authorization'], { role: 'client' });
  return { plan, authz };
}

beforeEach(() => {
  qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  post.mockReset();
});
afterEach(() => {
  act(() => tree?.unmount());
  tree = null;
  qc.clear();
});

// ── usePullToRefresh ────────────────────────────────────────────────────────
describe('usePullToRefresh', () => {
  it('not refreshing until the user pulls (background refetches never show it)', () => {
    const h = mount(() => usePullToRefresh([]));
    expect(h.current.refreshing).toBe(false);
    // The ready-made control carries the coral spinner and the handler.
    expect(h.current.control.props.refreshing).toBe(false);
    expect(h.current.control.props.tintColor).toBe('#F4516C');
    expect(h.current.control.props.colors).toEqual(['#F4516C']);
  });

  it('a pull shows the spinner, runs every refetch in parallel plus the plan, then clears', async () => {
    const { plan, authz } = seedPlan();
    const a = deferred();
    const b = deferred();
    const refetchA = jest.fn(() => a.promise);
    const refetchB = jest.fn(() => b.promise);
    const fn = jest.fn();
    const h = mount(() =>
      usePullToRefresh([
        { refetch: refetchA },
        { refetch: refetchB },
        fn,
        null,
        false,
      ]),
    );

    let done!: Promise<void>;
    act(() => {
      done = h.current.onRefresh();
    });
    // Both started before either finished (parallel), spinner on.
    await act(async () => {});
    expect(refetchA).toHaveBeenCalledTimes(1);
    expect(refetchB).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(plan).toHaveBeenCalledTimes(1);
    expect(authz).toHaveBeenCalledTimes(1);
    expect(h.current.refreshing).toBe(true);

    await act(async () => {
      a.resolve();
      b.resolve();
      await done;
    });
    expect(h.current.refreshing).toBe(false);
  });

  it('a failed refetch stops the spinner and does not throw (old data kept by the query)', async () => {
    seedPlan();
    const ok = jest.fn(async () => 'fine');
    const h = mount(() =>
      usePullToRefresh([
        { refetch: () => Promise.reject(new Error('offline')) },
        { refetch: ok },
      ]),
    );
    await act(async () => {
      await expect(h.current.onRefresh()).resolves.toBeUndefined();
    });
    expect(ok).toHaveBeenCalledTimes(1);
    expect(h.current.refreshing).toBe(false);
  });

  it('a failing real query keeps its old data on screen', async () => {
    let fail = false;
    qc.setQueryDefaults(['things'], {
      queryFn: async () => {
        if (fail) throw new Error('500');
        return ['old row'];
      },
    });
    await qc.fetchQuery({ queryKey: ['things'] });
    fail = true;
    const h = mount(() =>
      usePullToRefresh([() => qc.refetchQueries({ queryKey: ['things'] })]),
    );
    await act(async () => {
      await h.current.onRefresh();
    });
    expect(qc.getQueryData(['things'])).toEqual(['old row']);
    expect(qc.getQueryState(['things'])?.status).toBe('error');
    expect(h.current.refreshing).toBe(false);
  });

  it('skips disabled queries (isEnabled false) and ignores a second pull mid-pull', async () => {
    const disabled = jest.fn(async () => undefined);
    const slow = deferred();
    const enabled = jest.fn(() => slow.promise);
    const sources: RefetchSource[] = [
      { refetch: disabled, isEnabled: false },
      { refetch: enabled, isEnabled: true },
    ];
    const h = mount(() => usePullToRefresh(sources));
    let first!: Promise<void>;
    act(() => {
      first = h.current.onRefresh();
    });
    await act(async () => {
      await h.current.onRefresh(); // ignored: one pull at a time
    });
    expect(disabled).not.toHaveBeenCalled();
    expect(enabled).toHaveBeenCalledTimes(1);
    await act(async () => {
      slow.resolve();
      await first;
    });
    expect(h.current.refreshing).toBe(false);
  });
});

// ── usePlanForegroundRefresh ────────────────────────────────────────────────
describe('usePlanForegroundRefresh', () => {
  it('background → active invalidates the plan queries only', () => {
    let listener: ((s: string) => void) | null = null;
    const remove = jest.fn();
    const spyAdd = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation(((_t: string, cb: (s: string) => void) => {
        listener = cb;
        return { remove };
      }) as never);
    const spyInv = jest.spyOn(qc, 'invalidateQueries');

    mount(() => usePlanForegroundRefresh());
    act(() => listener?.('background'));
    expect(spyInv).not.toHaveBeenCalled();
    act(() => listener?.('active'));

    const keys = spyInv.mock.calls.map(
      (c) => (c[0] as { queryKey: unknown }).queryKey,
    );
    expect(keys).toEqual([['subscription', 'me'], ['authorization']]);

    // Staying active (e.g. a second 'active' report) does nothing more.
    act(() => listener?.('active'));
    expect(spyInv).toHaveBeenCalledTimes(2);

    act(() => tree?.unmount());
    tree = null;
    expect(remove).toHaveBeenCalled();
    spyAdd.mockRestore();
  });
});

// ── useVerifySubscription ───────────────────────────────────────────────────
describe('useVerifySubscription cache refresh', () => {
  it('success invalidates the whole cache: the plan (awaited) and everything else', async () => {
    post.mockResolvedValueOnce({ data: { verified: true } });
    // Plan-dependent caches the free plan answered.
    for (const key of [
      ['subscription', 'me'],
      ['authorization'],
      ['assessment', 'app-1'],
      ['application', 'app-1'],
      ['applications', undefined],
      ['documentChecks', 'app-1'],
      ['refusalAnalysis', 'an-1'],
      ['conversations'],
      ['users', 'me'],
    ]) {
      qc.setQueryData(key, { stale: false });
    }
    const spy = jest.spyOn(qc, 'invalidateQueries');
    const h = mount(() => useVerifySubscription());
    await act(async () => {
      await h.current.mutateAsync('ref_1');
    });

    // Every query in the cache is now invalidated (stale), none skipped.
    const all = qc.getQueryCache().getAll();
    expect(all.length).toBe(9);
    expect(all.every((q) => q.state.isInvalidated)).toBe(true);
    // The plan keys went through their own (awaited) calls.
    const keys = spy.mock.calls
      .map((c) => (c[0] as { queryKey?: unknown } | undefined)?.queryKey)
      .filter(Boolean);
    expect(keys).toEqual([['subscription', 'me'], ['authorization']]);
  });

  it('failure invalidates nothing', async () => {
    post.mockRejectedValueOnce({ status: 400 });
    qc.setQueryData(['assessment', 'app-1'], { tier: 'free' });
    const spy = jest.spyOn(qc, 'invalidateQueries');
    const h = mount(() => useVerifySubscription());
    await act(async () => {
      await h.current.mutateAsync('ref_1').catch(() => undefined);
    });
    expect(spy).not.toHaveBeenCalled();
    expect(qc.getQueryState(['assessment', 'app-1'])?.isInvalidated).toBe(
      false,
    );
  });

  it('isPlanQueryKey picks out exactly the two plan queries', () => {
    expect(isPlanQueryKey(['subscription', 'me'])).toBe(true);
    expect(isPlanQueryKey(['authorization'])).toBe(true);
    expect(isPlanQueryKey(['plans', 'client'])).toBe(false);
    expect(isPlanQueryKey(['assessment', 'x'])).toBe(false);
  });
});
