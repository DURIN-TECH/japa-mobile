// Withdraw + the applications list (japa#259). Mocked API, no network.
//  - useWithdrawApplication sends ONE `PUT /applications/:id/status` whose
//    body is exactly `{ status: 'withdrawn' }`;
//  - on success the cached list loses the application at once (before any
//    refetch answers) and the detail entry takes the server's answer;
//  - on failure the caches are left as they were;
//  - useApplications never hands out a withdrawn application.

jest.mock('@/services/api.service', () => ({
  apiService: { get: jest.fn(), put: jest.fn() },
}));

import React from 'react';
import { act, create } from 'react-test-renderer';
import {
  describe,
  expect,
  it,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useApplications, useWithdrawApplication } from '../useApplications';
import { apiService } from '@/services/api.service';
import type { Application } from '@/types/applications.type';

type Fn = jest.Mock<(...a: unknown[]) => Promise<unknown>>;
const api = apiService as unknown as { get: Fn; put: Fn };

/** A minimal application row (only the fields these hooks read). */
const row = (id: string, status: Application['status']) =>
  ({ id, status }) as unknown as Application;

/** The server's list: one open, one withdrawn, one approved. */
const SERVER_LIST = [
  row('open-1', 'draft'),
  row('gone-1', 'withdrawn'),
  row('done-1', 'approved'),
];

/**
 * Let pending work settle: the query fetch, the mutation callbacks and React
 * Query's observer notifications each take a tick, so wait a few.
 */
const flush = async () => {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
};

const renderers: ReturnType<typeof create>[] = [];
let qc: QueryClient;

/** Mount both hooks under one QueryClient and expose their latest values. */
function mount() {
  const ref: {
    list: ReturnType<typeof useApplications> | null;
    withdraw: ReturnType<typeof useWithdrawApplication> | null;
  } = { list: null, withdraw: null };
  function Probe() {
    ref.list = useApplications();
    ref.withdraw = useWithdrawApplication();
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
  return ref as {
    list: ReturnType<typeof useApplications>;
    withdraw: ReturnType<typeof useWithdrawApplication>;
  };
}

beforeEach(() => {
  api.get.mockReset();
  api.put.mockReset();
  // gcTime Infinity: no garbage-collection timer left running after a test.
  qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
});
afterEach(() => {
  renderers.splice(0).forEach((r) => act(() => r.unmount()));
  qc.clear();
});

describe('useApplications (japa#259 list filter)', () => {
  it('never hands out a withdrawn application; the others keep their order', async () => {
    api.get.mockResolvedValue({ data: SERVER_LIST });
    const h = mount();
    await flush();
    expect(h.list.data?.map((a) => a.id)).toEqual(['open-1', 'done-1']);
  });

  it('a user whose only application is withdrawn gets an empty list', async () => {
    api.get.mockResolvedValue({ data: [row('gone-1', 'withdrawn')] });
    const h = mount();
    await flush();
    expect(h.list.data).toEqual([]);
  });
});

describe('useWithdrawApplication', () => {
  it('sends one PUT whose body carries only `status`', async () => {
    api.get.mockResolvedValue({ data: SERVER_LIST });
    api.put.mockResolvedValue({ data: row('open-1', 'withdrawn') });
    const h = mount();
    await flush();
    await act(async () => {
      await h.withdraw.mutateAsync('open-1');
    });
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(api.put.mock.calls[0]).toEqual([
      '/applications/open-1/status',
      { status: 'withdrawn' },
    ]);
  });

  it('on success the application leaves the list at once, before the refetch answers', async () => {
    api.get.mockResolvedValueOnce({ data: SERVER_LIST });
    const h = mount();
    await flush();
    expect(h.list.data?.map((a) => a.id)).toEqual(['open-1', 'done-1']);

    // The refetch triggered by the invalidation never answers in this test,
    // so what the list shows can only come from the cache update.
    api.get.mockReturnValue(new Promise(() => {}));
    api.put.mockResolvedValue({ data: row('open-1', 'withdrawn') });
    await act(async () => {
      await h.withdraw.mutateAsync('open-1');
    });
    // React Query notifies observers on the next tick.
    await flush();
    expect(h.list.data?.map((a) => a.id)).toEqual(['done-1']);
    // The detail entry holds the server's answer (the screen would show
    // "Withdrawn" if it were opened again).
    expect(
      qc.getQueryData<Application>(['application', 'open-1'])?.status,
    ).toBe('withdrawn');
  });

  it('on failure nothing changes: the application is still listed', async () => {
    api.get.mockResolvedValue({ data: SERVER_LIST });
    api.put.mockRejectedValue({ status: 0, code: 'NETWORK_ERROR' });
    const h = mount();
    await flush();
    await act(async () => {
      await h.withdraw.mutateAsync('open-1').catch(() => undefined);
    });
    expect(api.put).toHaveBeenCalledTimes(1); // no automatic retry
    expect(h.list.data?.map((a) => a.id)).toEqual(['open-1', 'done-1']);
    expect(qc.getQueryData(['application', 'open-1'])).toBeUndefined();
  });

  it('on the 409 (already closed) the application and the lists are reloaded', async () => {
    api.get.mockResolvedValueOnce({ data: SERVER_LIST });
    api.put.mockRejectedValue({
      status: 409,
      code: 'INVALID_STATUS_TRANSITION',
    });
    const h = mount();
    await flush();
    // The server's fresh answer: that application is withdrawn.
    api.get.mockResolvedValue({
      data: [row('open-1', 'withdrawn'), row('done-1', 'approved')],
    });
    await act(async () => {
      await h.withdraw.mutateAsync('open-1').catch(() => undefined);
    });
    await flush();
    expect(api.put).toHaveBeenCalledTimes(1);
    // Refetched once (the first load + the reload), and now filtered out.
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(h.list.data?.map((a) => a.id)).toEqual(['done-1']);
  });

  it('a network failure reloads nothing', async () => {
    api.get.mockResolvedValue({ data: SERVER_LIST });
    api.put.mockRejectedValue({ status: 0, code: 'NETWORK_ERROR' });
    const h = mount();
    await flush();
    await act(async () => {
      await h.withdraw.mutateAsync('open-1').catch(() => undefined);
    });
    await flush();
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});
