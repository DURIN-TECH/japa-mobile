// useStartCheckout / useVerifySubscription / useApprovePaymentRequest
// (japa#252): the app opts in to the return-to-app page with
// `returnTo: 'app'`, checkout resolves `{ url, reference }`, and a verified
// subscription refreshes the plan + entitlement caches (mocked API, no network).

jest.mock('@/services/api.service', () => ({
  apiService: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
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
import { useStartCheckout, useVerifySubscription } from '../useSubscription';
import { useApprovePaymentRequest } from '../usePaymentRequests';
import { apiService } from '@/services/api.service';

const api = apiService as unknown as Record<
  'get' | 'post' | 'put',
  jest.Mock<(...a: unknown[]) => Promise<unknown>>
>;

// ── Render a hook inside a QueryClientProvider (same pattern as useAnswers) ──
const renderers: ReturnType<typeof create>[] = [];
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
beforeEach(() => {
  jest.resetAllMocks();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  act(() => renderers.splice(0).forEach((r) => r.unmount()));
});

describe('useStartCheckout', () => {
  it("POSTs returnTo: 'app' and resolves { url, reference }", async () => {
    api.post.mockResolvedValue({
      success: true,
      data: { url: 'https://checkout.paystack.com/x', reference: 'ref_1' },
    });
    const h = mount(() => useStartCheckout(), qc);
    let out: unknown;
    await act(async () => {
      out = await h.current.mutateAsync('client_pro');
    });
    expect(api.post).toHaveBeenCalledWith('/subscriptions/checkout', {
      planId: 'client_pro',
      returnTo: 'app',
    });
    expect(out).toEqual({
      url: 'https://checkout.paystack.com/x',
      reference: 'ref_1',
    });
  });

  it('resolves null for a free-plan switch, a non-https url or no reference', async () => {
    const h = mount(() => useStartCheckout(), qc);
    for (const data of [
      { applied: true, planId: 'client_free' },
      { url: 'http://x', reference: 'r' },
      { url: 'https://checkout.paystack.com/x' },
    ]) {
      api.post.mockResolvedValueOnce({ success: true, data });
      let out: unknown = 'unset';
      await act(async () => {
        out = await h.current.mutateAsync('p');
      });
      expect(out).toBeNull();
    }
  });
});

describe('useVerifySubscription', () => {
  it('POSTs the reference and invalidates subscription + authorization', async () => {
    api.post.mockResolvedValue({ success: true, data: { verified: true } });
    const spy = jest.spyOn(qc, 'invalidateQueries');
    const h = mount(() => useVerifySubscription(), qc);
    await act(async () => {
      await h.current.mutateAsync('ref_1');
    });
    expect(api.post).toHaveBeenCalledWith('/subscriptions/verify', {
      reference: 'ref_1',
    });
    const keys = spy.mock.calls.map(
      (c) => (c[0] as { queryKey: unknown }).queryKey,
    );
    expect(keys).toEqual(
      expect.arrayContaining([['subscription', 'me'], ['authorization']]),
    );
  });

  it('a 400 (not paid) rejects and invalidates nothing — plan unchanged', async () => {
    api.post.mockRejectedValue({ status: 400, code: 'VALIDATION_ERROR' });
    const spy = jest.spyOn(qc, 'invalidateQueries');
    const h = mount(() => useVerifySubscription(), qc);
    await act(async () => {
      await expect(h.current.mutateAsync('forged')).rejects.toEqual({
        status: 400,
        code: 'VALIDATION_ERROR',
      });
    });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('useApprovePaymentRequest', () => {
  it("PUTs returnTo: 'app' on approve", async () => {
    api.put.mockResolvedValue({ success: true, data: { id: 'pr1' } });
    const h = mount(() => useApprovePaymentRequest(), qc);
    await act(async () => {
      await h.current.mutateAsync('pr1');
    });
    expect(api.put).toHaveBeenCalledWith('/payment-requests/pr1/approve', {
      returnTo: 'app',
    });
  });
});
