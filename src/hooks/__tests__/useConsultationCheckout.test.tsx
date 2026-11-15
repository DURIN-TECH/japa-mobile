// useCreateConsultation / useConsultationCheckout / useVerifyConsultation
// request bodies (japa#183, backend #285): the app opts in to the
// return-to-app page with `returnTo: 'app'` on both checkout-opening calls,
// and never sends a fee, amount, currency or rate (mocked API, no network).

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
import {
  useConsultationCheckout,
  useCreateConsultation,
  useVerifyConsultation,
} from '../useConsultations';
import { apiService } from '@/services/api.service';

const api = apiService as unknown as Record<
  'get' | 'post' | 'put',
  jest.Mock<(...a: unknown[]) => Promise<unknown>>
>;

// ── Render a hook inside a QueryClientProvider (as useSubscriptionCheckout) ──
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

describe('useCreateConsultation', () => {
  it("POSTs the slot plus returnTo: 'app', and nothing about the price", async () => {
    api.post.mockResolvedValue({ success: true, data: { id: 'cons-1' } });
    const h = mount(() => useCreateConsultation(), qc);
    await act(async () => {
      await h.current.mutateAsync({
        agentId: 'agent-1',
        type: 'initial',
        scheduledDate: '2026-12-01',
        scheduledTime: '10:00',
        durationMinutes: 30,
        timezone: 'Africa/Lagos',
      });
    });
    // The exact body: the slot and the return opt-in, no other key.
    expect(api.post).toHaveBeenCalledWith('/consultations', {
      agentId: 'agent-1',
      type: 'initial',
      scheduledDate: '2026-12-01',
      scheduledTime: '10:00',
      durationMinutes: 30,
      timezone: 'Africa/Lagos',
      returnTo: 'app',
    });
    const body = api.post.mock.calls[0][1] as Record<string, unknown>;
    for (const key of ['fee', 'amount', 'currency', 'rate', 'fxRate']) {
      expect(body).not.toHaveProperty(key);
    }
  });
});

describe('useConsultationCheckout', () => {
  it("POSTs only returnTo: 'app' to the booking's checkout route", async () => {
    api.post.mockResolvedValue({
      success: true,
      data: { requiresPayment: false, consultation: { id: 'cons-1' } },
    });
    const h = mount(() => useConsultationCheckout(), qc);
    await act(async () => {
      await h.current.mutateAsync('cons-1');
    });
    expect(api.post).toHaveBeenCalledWith('/consultations/cons-1/checkout', {
      returnTo: 'app',
    });
  });
});

describe('useVerifyConsultation', () => {
  it('POSTs only our own reference', async () => {
    api.post.mockResolvedValue({ success: true, data: { verified: true } });
    const h = mount(() => useVerifyConsultation(), qc);
    await act(async () => {
      await h.current.mutateAsync('cons-ref-1');
    });
    expect(api.post).toHaveBeenCalledWith('/consultations/public/verify', {
      reference: 'cons-ref-1',
    });
  });
});
