// ─────────────────────────────────────────────────────────────────────────────
// useSavedDestinations (japa#146): the list call, optimistic save / remove on
// the ONE shared key, and the rollback when a write fails. Run through a tiny
// harness component (no extra libs), with the API client mocked.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('@/services/api.service', () => ({
  apiService: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));
// Signed in (the list query is enabled only then).
jest.mock('@/stores/auth.store', () => ({
  useAuthStore: (sel: (s: { isAuthenticated: boolean }) => unknown) =>
    sel({ isAuthenticated: true }),
}));

import React from 'react';
import { act, create } from 'react-test-renderer';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  SAVED_DESTINATIONS_KEY,
  useRemoveDestination,
  useSaveDestination,
  useSavedDestinationPending,
  useSavedDestinations,
} from '../useSavedDestinations';
import { apiService } from '@/services/api.service';
import type { SavedDestinationItem } from '@/types/savedDestinations.type';

const api = apiService as unknown as Record<
  'get' | 'post' | 'put' | 'delete',
  jest.Mock<(...a: unknown[]) => Promise<unknown>>
>;

function item(code: string, visaId: string, s = 100): SavedDestinationItem {
  return {
    countryCode: code,
    visaId,
    savedAt: { _seconds: s, _nanoseconds: 0 },
    countryName: 'United Kingdom',
    visa: {
      id: visaId,
      countryCode: code,
      name: `Visa ${visaId}`,
      description: 'd',
      category: 'work',
      processingTime: '3 weeks',
      baseCostUsd: 100,
      successRate: null,
      totalApplications: null,
      source: null,
    },
  };
}

const renderers: ReturnType<typeof create>[] = [];

// Mount a hook and expose its latest value.
function mount<T>(useHook: () => T, qc: QueryClient) {
  const ref: { current: T | null } = { current: null };
  function Probe() {
    ref.current = useHook();
    return null;
  }
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  act(() => {
    renderers.push(
      create(
        <QueryClientProvider client={qc}>
          <Probe />
        </QueryClientProvider>,
      ),
    );
  });
  return ref as { current: T };
}

/** A promise the test resolves / rejects by hand. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Let pending promises and React Query's notifications run. */
async function flush() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

const ids = (qc: QueryClient) =>
  (qc.getQueryData<SavedDestinationItem[]>(SAVED_DESTINATIONS_KEY) ?? []).map(
    (i) => i.visaId,
  );

let qc: QueryClient;
afterEach(() => {
  act(() => renderers.splice(0).forEach((r) => r.unmount()));
});
beforeEach(() => {
  jest.resetAllMocks();
  qc = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false, staleTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
});

describe('list', () => {
  it('GETs the list and keeps the API order (newest first)', async () => {
    api.get.mockResolvedValue({
      success: true,
      data: [item('GB', 'new', 200), item('ca', 'old', 100)],
    });
    const h = mount(() => useSavedDestinations(), qc);
    await flush();
    expect(api.get).toHaveBeenCalledWith('/users/me/saved-destinations');
    expect(h.current.data?.map((i) => i.visaId)).toEqual(['new', 'old']);
    // Country codes come out upper case whatever the API sent.
    expect(h.current.data?.[1].countryCode).toBe('CA');
  });
});

describe('save', () => {
  it('PUTs the item and shows it first at once (optimistic)', async () => {
    qc.setQueryData(SAVED_DESTINATIONS_KEY, [item('CA', 'b')]);
    const put = deferred<unknown>();
    api.put.mockReturnValue(put.promise);
    api.get.mockResolvedValue({
      success: true,
      data: [item('GB', 'a', 300), item('CA', 'b')],
    });
    const h = mount(
      () => ({
        // A mounted list (as on a screen), so the settle refetch runs.
        list: useSavedDestinations(),
        save: useSaveDestination('gb', 'a'),
        pending: useSavedDestinationPending('gb', 'a'),
      }),
      qc,
    );
    await act(async () => {
      h.current.save.mutate({
        visa: { name: 'Skilled Worker', category: 'work' },
        countryName: 'United Kingdom',
      });
    });
    await flush();
    expect(api.put).toHaveBeenCalledWith('/users/me/saved-destinations/GB/a');
    // Before the server answered.
    expect(ids(qc)).toEqual(['a', 'b']);
    expect(h.current.pending).toBe(true);

    await act(async () => {
      put.resolve({ success: true, data: item('GB', 'a', 300) });
    });
    await flush();
    expect(ids(qc)).toEqual(['a', 'b']);
    expect(h.current.pending).toBe(false);
    // Ends on the server's list.
    expect(api.get).toHaveBeenCalled();
  });

  it('a failed save takes the item back out (rollback)', async () => {
    qc.setQueryData(SAVED_DESTINATIONS_KEY, [item('CA', 'b')]);
    api.put.mockRejectedValue({ status: 402, code: 'UPGRADE_REQUIRED' });
    api.get.mockResolvedValue({ success: true, data: [item('CA', 'b')] });
    const onError = jest.fn();
    const h = mount(() => useSaveDestination('gb', 'a'), qc);
    await act(async () => {
      h.current.mutate(
        { visa: { name: 'Skilled Worker', category: 'work' } },
        { onError },
      );
    });
    expect(ids(qc)).toEqual(['b']);
    expect(onError).toHaveBeenCalled();
  });

  it('a failed save of something already saved leaves it saved', async () => {
    qc.setQueryData(SAVED_DESTINATIONS_KEY, [item('GB', 'a')]);
    api.put.mockRejectedValue({ status: 0, code: 'NETWORK_ERROR' });
    api.get.mockRejectedValue({ status: 0 });
    const h = mount(() => useSaveDestination('GB', 'a'), qc);
    await act(async () => {
      h.current.mutate(
        { visa: { name: 'x', category: 'work' } },
        { onError: () => {} },
      );
    });
    expect(ids(qc)).toEqual(['a']);
  });
});

describe('remove', () => {
  it('DELETEs and drops the item at once (optimistic)', async () => {
    qc.setQueryData(SAVED_DESTINATIONS_KEY, [item('GB', 'a'), item('CA', 'b')]);
    const del = deferred<unknown>();
    api.delete.mockReturnValue(del.promise);
    api.get.mockResolvedValue({ success: true, data: [item('CA', 'b')] });
    const h = mount(() => useRemoveDestination('gb', 'a'), qc);
    await act(async () => {
      h.current.mutate();
    });
    expect(api.delete).toHaveBeenCalledWith(
      '/users/me/saved-destinations/GB/a',
    );
    expect(ids(qc)).toEqual(['b']);
    await act(async () => {
      del.resolve({
        success: true,
        data: { countryCode: 'GB', visaId: 'a', saved: false },
      });
    });
    expect(ids(qc)).toEqual(['b']);
  });

  it('a failed remove puts the item back where it was (rollback)', async () => {
    qc.setQueryData(SAVED_DESTINATIONS_KEY, [
      item('US', 'c'),
      item('GB', 'a'),
      item('CA', 'b'),
    ]);
    api.delete.mockRejectedValue({ status: 500 });
    // The follow-up refetch fails too: the restored cache must stand.
    api.get.mockRejectedValue({ status: 500 });
    const h = mount(() => useRemoveDestination('gb', 'a'), qc);
    await act(async () => {
      h.current.mutate(undefined, { onError: () => {} });
    });
    expect(ids(qc)).toEqual(['c', 'a', 'b']);
  });

  it('a rollback does not undo a concurrent write on another destination', async () => {
    qc.setQueryData(SAVED_DESTINATIONS_KEY, [item('GB', 'a')]);
    const del = deferred<unknown>();
    api.delete.mockReturnValue(del.promise);
    api.put.mockResolvedValue({ success: true, data: item('CA', 'b', 500) });
    api.get.mockReturnValue(new Promise(() => {})); // refetch never lands
    const h = mount(
      () => ({
        remove: useRemoveDestination('GB', 'a'),
        save: useSaveDestination('CA', 'b'),
      }),
      qc,
    );
    await act(async () => {
      h.current.remove.mutate(undefined, { onError: () => {} });
    });
    await act(async () => {
      h.current.save.mutate({ visa: { name: 'b', category: 'student' } });
    });
    expect(ids(qc)).toEqual(['b']);
    await act(async () => {
      del.reject({ status: 500 });
    });
    // "a" is back, and "b" (saved meanwhile) is still there.
    expect(ids(qc).sort()).toEqual(['a', 'b']);
  });
});
