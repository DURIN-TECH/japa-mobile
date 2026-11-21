// ─────────────────────────────────────────────────────────────────────────────
// Consultation hooks for refunds (japa#356, #392, #442), against a mocked API:
//  - useVerifyConsultation resolves a 409 CONSULTATION_RESCHEDULED as
//    `{ kind: 'rescheduled', consultation }` (never paid, never an error),
//    and still rejects every other failure;
//  - useCancelConsultation hands back the answer's `refund`;
//  - useReportNoShow POSTs the trimmed note (or none) to the report route.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('@/services/api.service', () => ({
  apiService: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
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
  rescheduledFromVerifyError,
  useCancelConsultation,
  useReportNoShow,
  useVerifyConsultation,
} from '../useConsultations';
import { isBookingPaidResult } from '../consultationPayFlow';
import { apiService } from '@/services/api.service';

const api = apiService as unknown as Record<
  'get' | 'post' | 'put',
  jest.Mock<(...a: unknown[]) => Promise<unknown>>
>;

// ── Render a hook inside a QueryClientProvider ──────────────────────────────
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

/** The 409 as api.service rejects it (`{ code, message, status, data }`). */
const moved409 = {
  code: 'CONSULTATION_RESCHEDULED',
  message:
    'Your consultation moved, so we’re refunding your payment in full. Your refund is on its way. Please pay again for the new time.',
  status: 409,
  data: {
    refundPending: true,
    consultation: {
      id: 'cons-1',
      agentName: 'Ada Obi',
      type: 'initial',
      scheduledDate: { _seconds: Date.UTC(2026, 10, 25) / 1000 },
      scheduledTime: '15:00',
      timezone: 'Africa/Lagos',
      status: 'pending_payment',
      paymentStatus: 'pending',
    },
  },
};

describe('rescheduledFromVerifyError (japa#392)', () => {
  it('reads the 409 with its booking summary', () => {
    const r = rescheduledFromVerifyError(moved409)!;
    expect(r.kind).toBe('rescheduled');
    expect(r.consultation.id).toBe('cons-1');
    expect(r.consultation.scheduledTime).toBe('15:00');
  });
  it('anything else, or no usable booking id, is not rescheduled', () => {
    expect(rescheduledFromVerifyError({ code: 'QUOTE_EXPIRED' })).toBeNull();
    expect(
      rescheduledFromVerifyError({ ...moved409, data: { consultation: {} } }),
    ).toBeNull();
    expect(rescheduledFromVerifyError(null)).toBeNull();
    expect(rescheduledFromVerifyError('boom')).toBeNull();
  });
  it('a rescheduled outcome is never "paid"', () => {
    const r = rescheduledFromVerifyError({
      ...moved409,
      data: {
        consultation: { ...moved409.data.consultation, paymentStatus: 'paid' },
      },
    });
    expect(isBookingPaidResult(r)).toBe(false);
  });
});

describe('useVerifyConsultation (japa#392)', () => {
  it('200 → kind "paid", unchanged otherwise', async () => {
    api.post.mockResolvedValue({
      success: true,
      data: { verified: true, consultation: { id: 'cons-1' } },
    });
    const h = mount(() => useVerifyConsultation(), qc);
    let out: unknown;
    await act(async () => {
      out = await h.current.mutateAsync('ref-1');
    });
    expect(out).toEqual({
      kind: 'paid',
      verified: true,
      consultation: { id: 'cons-1' },
    });
    expect(isBookingPaidResult(out)).toBe(true);
  });

  it('409 CONSULTATION_RESCHEDULED resolves as rescheduled, every time', async () => {
    api.post.mockRejectedValue(moved409);
    const h = mount(() => useVerifyConsultation(), qc);
    for (let i = 0; i < 2; i++) {
      // The same old reference verified again: the same outcome.
      let out: unknown;
      await act(async () => {
        out = await h.current.mutateAsync('old-ref');
      });
      expect((out as { kind: string }).kind).toBe('rescheduled');
      expect(isBookingPaidResult(out)).toBe(false);
    }
  });

  it('any other failure still rejects (network → "couldn’t check")', async () => {
    const netErr = { code: 'NETWORK_ERROR', message: 'x', status: 0 };
    api.post.mockRejectedValue(netErr);
    const h = mount(() => useVerifyConsultation(), qc);
    await act(async () => {
      await expect(h.current.mutateAsync('ref')).rejects.toBe(netErr);
    });
  });
});

describe('useCancelConsultation (japa#356)', () => {
  it('returns the answer’s refund', async () => {
    const refund = {
      status: 'pending',
      amount: { amountMinor: 812_437, currency: 'NGN' },
      processingFee: { amountMinor: 12_563, currency: 'NGN' },
    };
    api.put.mockResolvedValue({
      success: true,
      data: { id: 'cons-1', status: 'cancelled', refund },
    });
    const h = mount(() => useCancelConsultation(), qc);
    let out: { refund?: unknown } | undefined;
    await act(async () => {
      out = await h.current.mutateAsync('cons-1');
    });
    expect(api.put).toHaveBeenCalledWith('/consultations/cons-1/status', {
      status: 'cancelled',
    });
    expect(out?.refund).toEqual(refund);
  });
});

describe('useReportNoShow (japa#442)', () => {
  it('POSTs the trimmed note to the report route', async () => {
    api.post.mockResolvedValue({
      success: true,
      data: { noShowReport: { status: 'open' }, consultation: {} },
    });
    const h = mount(() => useReportNoShow(), qc);
    await act(async () => {
      await h.current.mutateAsync({
        consultationId: 'cons-1',
        note: '  The agent never joined.  ',
      });
    });
    expect(api.post).toHaveBeenCalledWith(
      '/consultations/cons-1/no-show-report',
      { note: 'The agent never joined.' },
    );
  });

  it('an empty note sends an empty body', async () => {
    api.post.mockResolvedValue({ success: true, data: {} });
    const h = mount(() => useReportNoShow(), qc);
    await act(async () => {
      await h.current.mutateAsync({ consultationId: 'cons-1', note: '   ' });
    });
    expect(api.post).toHaveBeenCalledWith(
      '/consultations/cons-1/no-show-report',
      {},
    );
  });

  it('a 409 rejects with the server’s code and message', async () => {
    const err = {
      code: 'FEE_NOT_HELD',
      message: 'Contact support.',
      status: 409,
    };
    api.post.mockRejectedValue(err);
    const h = mount(() => useReportNoShow(), qc);
    await act(async () => {
      await expect(
        h.current.mutateAsync({ consultationId: 'cons-1' }),
      ).rejects.toBe(err);
    });
  });
});
