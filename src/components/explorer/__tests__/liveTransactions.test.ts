// ─────────────────────────────────────────────────────────────────────────────
// liveTransactions (japa#332): GET /transactions answers a client with the
// backend's `ClientTransaction` allow-list (japa#329). The Payments row is
// built from that shape alone: no exchange rate is sent on a transaction,
// and none is needed.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from '@jest/globals';
import { mapStatus, mapTransaction, totalsPaid } from '../liveTransactions';
import type { Payment } from '@/types/explorer.type';
import type { ApiTransaction } from '@/hooks/useTransactions';

/** A consultation fee exactly as the client endpoint returns it. */
const clientRow: ApiTransaction = {
  id: 'txn-1',
  type: 'consultation_fee',
  status: 'completed',
  description: 'Consultation fee',
  amountCharged: { amountMinor: 812_384, currency: 'NGN' },
  priceUsd: { amountMinor: 600, currency: 'USD' },
  amount: 812_384,
  currency: 'NGN',
  priceUsdCents: 600,
  paymentProvider: 'paystack',
  consultationId: 'cons-1',
  createdAt: '2026-11-14T10:00:00.000Z',
  paidAt: '2026-11-14T10:01:00.000Z',
};

describe('mapTransaction', () => {
  it('maps the client shape: charged amount, dollar price, status', () => {
    const p = mapTransaction(clientRow);
    expect(p.id).toBe('txn-1');
    expect(p.title).toBe('Consultation fee');
    expect(p.amount).toEqual({ amountMinor: 812_384, currency: 'NGN' });
    expect(p.usd).toEqual({ amountMinor: 600, currency: 'USD' });
    expect(p.status).toBe('paid');
  });

  it('labels a Paystack payment "Paystack" (it used to read "—")', () => {
    expect(mapTransaction(clientRow).method).toBe('Paystack');
    expect(
      mapTransaction({ ...clientRow, paymentProvider: 'manual' }).method,
    ).toBe('—');
  });

  it('a legacy row with no dollar price maps without one, no crash', () => {
    const legacy: ApiTransaction = { ...clientRow };
    delete legacy.priceUsd;
    delete legacy.priceUsdCents;
    const p = mapTransaction(legacy);
    expect(p.usd).toBeNull();
    expect(p.amount).toEqual({ amountMinor: 812_384, currency: 'NGN' });
  });

  it('an unknown provider reads "—" rather than undefined', () => {
    const odd = {
      ...clientRow,
      paymentProvider: 'something-new',
    } as unknown as ApiTransaction;
    expect(mapTransaction(odd).method).toBe('—');
  });
});

// ── japa#353: failed charges and unknown statuses ───────────────────────────
describe('mapStatus', () => {
  it('keeps the existing mappings', () => {
    expect(mapStatus('completed')).toBe('paid');
    expect(mapStatus('released')).toBe('paid');
    expect(mapStatus('pending')).toBe('pending');
    expect(mapStatus('processing')).toBe('pending');
    expect(mapStatus('held_in_escrow')).toBe('pending');
    expect(mapStatus('refunded')).toBe('refunded');
  });

  it('maps a failed charge to failed, never paid', () => {
    expect(mapStatus('failed')).toBe('failed');
    expect(mapTransaction({ ...clientRow, status: 'failed' }).status).toBe(
      'failed',
    );
  });

  it('maps an unknown status to pending, never paid', () => {
    const odd = 'something_new' as unknown as ApiTransaction['status'];
    expect(mapStatus(odd)).toBe('pending');
    expect(mapTransaction({ ...clientRow, status: odd }).status).toBe(
      'pending',
    );
  });
});

describe('totalsPaid', () => {
  /** A Payments row with only what the total reads. */
  const row = (
    status: Payment['status'],
    amountMinor: number,
    currency = 'NGN',
  ): Pick<Payment, 'status' | 'amount'> => ({
    status,
    amount: { amountMinor, currency },
  });

  it('₦50,000 paid + ₦50,000 failed → Total paid ₦50,000', () => {
    expect(
      totalsPaid([row('paid', 5_000_000), row('failed', 5_000_000)]),
    ).toEqual([{ amountMinor: 5_000_000, currency: 'NGN' }]);
  });

  it('sums only paid rows (failed, pending, refunded skipped)', () => {
    expect(
      totalsPaid([
        row('paid', 1_000),
        row('failed', 2_000),
        row('pending', 4_000),
        row('refunded', 8_000),
        row('paid', 500),
      ]),
    ).toEqual([{ amountMinor: 1_500, currency: 'NGN' }]);
  });

  it('keeps one total per currency, in first-seen order', () => {
    expect(
      totalsPaid([
        row('paid', 3_700, 'USD'),
        row('failed', 9_999, 'USD'),
        row('paid', 1_000, 'NGN'),
        row('pending', 2_000, 'NGN'),
        row('refunded', 4_000, 'USD'),
        row('paid', 300, 'USD'),
        row('failed', 7_000, 'GBP'),
      ]),
    ).toEqual([
      { amountMinor: 4_000, currency: 'USD' },
      { amountMinor: 1_000, currency: 'NGN' },
    ]);
  });

  it('only failed rows → no totals (the screen shows the zero total)', () => {
    expect(totalsPaid([row('failed', 5_000_000)])).toEqual([]);
    expect(totalsPaid([])).toEqual([]);
  });
});
