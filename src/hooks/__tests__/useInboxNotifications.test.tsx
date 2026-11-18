// ─────────────────────────────────────────────────────────────────────────────
// useInboxNotifications (#269 e2e fix): the inbox list is re-read on every
// focus (even with a cached list younger than the app's 5-minute staleTime),
// and when the polled unread count changes while the inbox is open.
// ─────────────────────────────────────────────────────────────────────────────

// expo-router's useFocusEffect: run the callback on mount, and keep it so a
// test can "focus" the screen again (coming back from a pushed screen).
const focus: { cb: (() => void) | null } = { cb: null };
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const R = require('react') as typeof import('react');
    focus.cb = cb;
    R.useEffect(() => cb(), [cb]);
  },
}));
jest.mock('@/services/api.service', () => ({
  apiService: { get: jest.fn(), put: jest.fn(), delete: jest.fn() },
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
import { useInboxNotifications } from '../useNotifications';
import { apiService } from '@/services/api.service';

const get = (apiService as unknown as { get: jest.Mock }).get as jest.Mock<
  (url: string) => Promise<unknown>
>;

const LIST_URL = '/notifications?limit=20';
const listCalls = () => get.mock.calls.filter(([u]) => u === LIST_URL).length;
// React Query notifies observers on a setTimeout(0) tick; let a few pass.
const flush = () =>
  act(async () => {
    for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0));
  });

let qc: QueryClient;
const renderers: ReturnType<typeof create>[] = [];

function mount() {
  function Probe() {
    useInboxNotifications();
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
}

beforeEach(() => {
  jest.resetAllMocks();
  focus.cb = null;
  get.mockImplementation(async (url: string) =>
    url === LIST_URL ? { data: [] } : { data: { count: 3 } },
  );
  // Mirror the app's QueryProvider: 5-minute staleTime.
  qc = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 5 * 60_000, retry: false, gcTime: Infinity },
    },
  });
  // A cached list and count, as when Home already loaded them.
  qc.setQueryData(['notifications', 20], []);
  qc.setQueryData(['notifications', 'unread-count'], 3);
});
afterEach(() => {
  act(() => renderers.splice(0).forEach((r) => r.unmount()));
  qc.clear();
});

describe('useInboxNotifications', () => {
  it('re-reads a fresh cached list when the inbox opens', async () => {
    mount();
    await flush();
    expect(listCalls()).toBe(1);
  });

  it('re-reads again when the inbox regains focus', async () => {
    mount();
    await flush();
    await act(async () => focus.cb?.());
    await flush();
    expect(listCalls()).toBe(2);
  });

  it('re-reads the list when the polled count changes', async () => {
    mount();
    await flush();
    expect(listCalls()).toBe(1);
    await act(async () => {
      qc.setQueryData(['notifications', 'unread-count'], 12);
    });
    await flush();
    expect(listCalls()).toBe(2);
  });

  it('does not re-read when the count stays the same', async () => {
    mount();
    await flush();
    await act(async () => {
      qc.setQueryData(['notifications', 'unread-count'], 3);
    });
    await flush();
    expect(listCalls()).toBe(1);
  });

  it('first open with nothing cached makes one list request, not two', async () => {
    qc.clear();
    mount();
    await flush();
    expect(listCalls()).toBe(1);
  });
});
