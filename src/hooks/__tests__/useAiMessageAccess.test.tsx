// ─────────────────────────────────────────────────────────────────────────────
// Hooks of the AI message access feature (issue #172): the calls they make, and
// that the cache changes only after the server answers. Run through a tiny harness component (no extra libs).
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('@/services/api.service', () => ({
  apiService: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
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
import {
  useApproveAiAccess,
  useSetAccountWideOff,
  useWithdrawAiAccess,
  AI_ACCESS_KEY,
} from '../useAiMessageAccess';
import { apiService } from '@/services/api.service';

const api = apiService as unknown as Record<
  'get' | 'post' | 'put' | 'delete',
  jest.Mock<(...a: unknown[]) => Promise<unknown>>
>;

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

let qc: QueryClient;
afterEach(() => {
  act(() => renderers.splice(0).forEach((r) => r.unmount()));
});
beforeEach(() => {
  jest.resetAllMocks();
  qc = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
});

describe('user-state writes', () => {
  const state = { approved: true, accountWideOff: false };

  it('approve POSTs the wording version and stores the returned state', async () => {
    api.post.mockResolvedValue({ success: true, data: state });
    const h = mount(() => useApproveAiAccess(), qc);
    await act(async () => {
      h.current.mutate('ai-message-access-approval.draft-1');
    });
    expect(api.post).toHaveBeenCalledWith(
      '/users/me/ai-message-access/approval',
      {
        wordingVersion: 'ai-message-access-approval.draft-1',
      },
    );
    expect(qc.getQueryData(AI_ACCESS_KEY)).toEqual(state);
  });

  it('a 409 WORDING_VERSION_MISMATCH refetches the state so the new wording shows', async () => {
    api.post.mockRejectedValue({
      code: 'WORDING_VERSION_MISMATCH',
      status: 409,
    });
    const spy = jest.spyOn(qc, 'invalidateQueries');
    const h = mount(() => useApproveAiAccess(), qc);
    await act(async () => {
      h.current.mutate('old', { onError: () => {} });
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: AI_ACCESS_KEY });
  });

  it('withdraw sends DELETE on the approval', async () => {
    api.delete.mockResolvedValue({ success: true, data: { approved: false } });
    const h = mount(() => useWithdrawAiAccess(), qc);
    await act(async () => {
      h.current.mutate();
    });
    expect(api.delete).toHaveBeenCalledWith(
      '/users/me/ai-message-access/approval',
    );
    expect(qc.getQueryData(AI_ACCESS_KEY)).toEqual({ approved: false });
  });

  it('account-wide switch PUTs { off } and refetches conversations', async () => {
    api.put.mockResolvedValue({
      success: true,
      data: { accountWideOff: true },
    });
    const spy = jest.spyOn(qc, 'invalidateQueries');
    const h = mount(() => useSetAccountWideOff(), qc);
    await act(async () => {
      h.current.mutate(true);
    });
    expect(api.put).toHaveBeenCalledWith(
      '/users/me/ai-message-access/account-wide-off',
      {
        off: true,
      },
    );
    expect(spy).toHaveBeenCalledWith({ queryKey: ['conversations'] });
  });
});
