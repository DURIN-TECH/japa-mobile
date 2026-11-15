// ─────────────────────────────────────────────────────────────────────────────
// liveTransactions (japa#332): GET /transactions answers a client with the
// backend's `ClientTransaction` allow-list (japa#329). The Payments row is
// built from that shape alone: no exchange rate is sent on a transaction,
// and none is needed.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from '@jest/globals';
import { mapTransaction } from '../liveTransactions';
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
