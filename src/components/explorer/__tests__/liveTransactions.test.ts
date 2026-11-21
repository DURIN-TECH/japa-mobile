// ─────────────────────────────────────────────────────────────────────────────
// liveTransactions (japa#332): GET /transactions answers a client with the
// backend's `ClientTransaction` allow-list (japa#329). The Payments row is
// built from that shape alone: no exchange rate is sent on a transaction,
// and none is needed.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from '@jest/globals';
import {
  countsAsPaid,
  hasRefundAmount,
  mapStatus,
  refundRowStatus,
  mapTransaction,
  totalsPaid,
} from '../liveTransactions';
import { paidCount } from '../profileLogic';
import { PAY_STATUS } from '../content';
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
    expect(mapStatus('completed', 'consultation_fee')).toBe('paid');
    expect(mapStatus('released', 'consultation_fee')).toBe('paid');
    expect(mapStatus('pending', 'consultation_fee')).toBe('pending');
    expect(mapStatus('processing', 'consultation_fee')).toBe('pending');
    expect(mapStatus('held_in_escrow', 'consultation_fee')).toBe('pending');
    expect(mapStatus('refunded', 'consultation_fee')).toBe('refunded');
  });

  it('maps a failed charge to failed, never paid', () => {
    expect(mapStatus('failed', 'consultation_fee')).toBe('failed');
    expect(mapTransaction({ ...clientRow, status: 'failed' }).status).toBe(
      'failed',
    );
  });

  it('maps an unknown status to pending, never paid', () => {
    const odd = 'something_new' as unknown as ApiTransaction['status'];
    expect(mapStatus(odd, 'consultation_fee')).toBe('pending');
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

// ── japa#398: a refund is never Paid, never in "Total paid" ─────────────────

/** Every backend status, so a test can sweep them all. */
// Built from a Record keyed by the status union: a new backend status fails
// to compile here until it is added.
const STATUS_SET: Record<ApiTransaction['status'], true> = {
  pending: true,
  processing: true,
  completed: true,
  failed: true,
  refunded: true,
  held_in_escrow: true,
  released: true,
  // japa#356 / backend #413 B: a refund an admin closed with nothing due.
  closed: true,
};
const ALL_STATUSES = Object.keys(STATUS_SET) as ApiTransaction['status'][];

/** A transaction of `type` and `status` for `amountMinor`, in `currency`. */
const txn = (
  id: string,
  type: ApiTransaction['type'],
  status: ApiTransaction['status'],
  amountMinor: number,
  currency = 'NGN',
): ApiTransaction => ({
  ...clientRow,
  id,
  type,
  status,
  description: '',
  amount: amountMinor,
  currency,
  amountCharged: { amountMinor, currency },
});

describe('refund rows (japa#398)', () => {
  it('done refunds (completed, released, refunded) map to Refunded', () => {
    for (const s of ['completed', 'released', 'refunded'] as const) {
      expect(mapStatus(s, 'refund')).toBe('refunded');
      expect(mapTransaction(txn('r', 'refund', s, 100)).status).toBe(
        'refunded',
      );
    }
    // …which is the existing grey "Refunded" pill.
    expect(PAY_STATUS[mapStatus('completed', 'refund')]).toEqual({
      label: 'Refunded',
      fg: '#8B8499',
      bg: 'rgba(23,19,38,0.06)',
    });
  });

  // japa#356: refunds have their own pills: "Refund pending" in flight,
  // "Refund delayed" when failed (never "Failed"), "No refund due" closed.
  it('in-flight refunds map to Refund pending, a failed one to Refund delayed', () => {
    expect(mapStatus('pending', 'refund')).toBe('refund_pending');
    expect(mapStatus('processing', 'refund')).toBe('refund_pending');
    expect(mapStatus('held_in_escrow', 'refund')).toBe('refund_pending');
    expect(mapStatus('failed', 'refund')).toBe('refund_delayed');
    expect(mapStatus('closed', 'refund')).toBe('refund_none_due');
  });

  it('an unknown refund status maps to Refund pending', () => {
    const odd = 'something_new' as unknown as ApiTransaction['status'];
    expect(mapStatus(odd, 'refund')).toBe('refund_pending');
  });

  it('no refund row is ever Failed or a bare Pending (japa#356)', () => {
    for (const s of ALL_STATUSES) {
      const st = mapTransaction(txn('r', 'refund', s, 100)).status;
      expect(['failed', 'pending', 'paid']).not.toContain(st);
    }
  });

  it('no refund maps to paid or counts as paid, whatever its status', () => {
    for (const s of ALL_STATUSES) {
      expect(mapStatus(s, 'refund')).not.toBe('paid');
      expect(mapTransaction(txn('r', 'refund', s, 100)).status).not.toBe(
        'paid',
      );
      expect(countsAsPaid({ status: s, type: 'refund' })).toBe(false);
    }
  });

  it('₦50,000 service fee + ₦50,000 completed refund → Total paid ₦50,000', () => {
    const rows = [
      txn('a', 'service_fee', 'completed', 5_000_000),
      txn('b', 'refund', 'completed', 5_000_000),
    ].map(mapTransaction);
    expect(totalsPaid(rows)).toEqual([
      { amountMinor: 5_000_000, currency: 'NGN' },
    ]);
  });

  it('only refunds → no totals (the hero shows its zero total), row kept', () => {
    const rows = [txn('b', 'refund', 'completed', 5_000_000)].map(
      mapTransaction,
    );
    expect(totalsPaid(rows)).toEqual([]);
    // The refund row itself is still listed, as Refunded.
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('refunded');
  });
});

describe('non-refund rows keep their mapping (japa#398)', () => {
  const expected: Record<ApiTransaction['status'], Payment['status']> = {
    completed: 'paid',
    released: 'paid',
    pending: 'pending',
    processing: 'pending',
    held_in_escrow: 'pending',
    refunded: 'refunded',
    failed: 'failed',
    // Not a status non-refund rows have; unknown → pending (japa#353).
    closed: 'pending',
  };
  const others: ApiTransaction['type'][] = [
    'consultation_fee',
    'service_fee',
    'government_fee',
    'escrow_release',
    'withdrawal',
  ];
  it('every non-refund type × status maps as before', () => {
    for (const type of others) {
      for (const s of ALL_STATUSES) {
        expect(mapStatus(s, type)).toBe(expected[s]);
      }
    }
  });
});

// ── Payments and Profile agree (japa#398) ───────────────────────────────────
describe('Payments totals and Profile count use the same rule', () => {
  // One mixed fixture: paid, pending, failed, refunded, refund-completed,
  // refund-pending, and more than one currency.
  const fixture: ApiTransaction[] = [
    txn('paid-ngn', 'consultation_fee', 'completed', 1_000),
    txn('released-ngn', 'escrow_release', 'released', 2_000),
    txn('paid-usd', 'service_fee', 'completed', 300, 'USD'),
    txn('pending', 'service_fee', 'pending', 4_000),
    txn('processing-usd', 'government_fee', 'processing', 8_000, 'USD'),
    txn('failed', 'service_fee', 'failed', 16_000),
    txn('refunded', 'consultation_fee', 'refunded', 32_000),
    txn('refund-completed', 'refund', 'completed', 64_000),
    txn('refund-released-usd', 'refund', 'released', 128_000, 'USD'),
    txn('refund-pending', 'refund', 'pending', 256_000),
    txn('withdrawal', 'withdrawal', 'completed', 512, 'GBP'),
  ];
  const rows = fixture.map(mapTransaction);
  const paidRows = rows.filter((r) => r.status === 'paid');

  it("Profile's count equals the number of paid Payments rows", () => {
    expect(paidCount(fixture)).toBe(paidRows.length);
    expect(paidRows.map((r) => r.id)).toEqual([
      'paid-ngn',
      'released-ngn',
      'paid-usd',
      'withdrawal',
    ]);
  });

  it('a row is paid exactly when countsAsPaid says so', () => {
    fixture.forEach((t, i) => {
      expect(rows[i].status === 'paid').toBe(countsAsPaid(t));
    });
  });

  it('every paid row, and only those, is summed into the totals', () => {
    // Expected totals rebuilt by hand from the paid rows alone.
    expect(totalsPaid(rows)).toEqual([
      { amountMinor: 3_000, currency: 'NGN' },
      { amountMinor: 300, currency: 'USD' },
      { amountMinor: 512, currency: 'GBP' },
    ]);
    // And the sum over all currencies equals the sum over paid rows.
    const total = totalsPaid(rows).reduce((n, m) => n + m.amountMinor, 0);
    const paidSum = paidRows.reduce((n, r) => n + r.amount.amountMinor, 0);
    expect(total).toBe(paidSum);
  });

  it('payment-request rows (always pending) count in neither', () => {
    const request: Payment = {
      id: 'pr-1',
      title: 'Payment request',
      sub: '',
      amount: { amountMinor: 99_000, currency: 'NGN' },
      usd: null,
      date: '',
      status: 'pending',
      method: '—',
    };
    expect(totalsPaid([...rows, request])).toEqual(totalsPaid(rows));
    // Profile counts transactions only; a request is not one, and as a
    // `pending` row it would not count anyway.
    expect(countsAsPaid({ status: 'pending', type: 'service_fee' })).toBe(
      false,
    );
  });
});

// ── PAY_STATUS is keyed by Payment['status'] (japa#398) ─────────────────────
// Checked by `tsc --noEmit` (this file is in the tsconfig): a map missing a
// Payment status must not type-check as PAY_STATUS's type.
describe('PAY_STATUS type', () => {
  it('has a pill for every Payment status', () => {
    const statuses: Record<Payment['status'], true> = {
      paid: true,
      pending: true,
      refunded: true,
      failed: true,
      refund_pending: true,
      refund_delayed: true,
      refund_none_due: true,
    };
    for (const s of Object.keys(statuses) as Payment['status'][]) {
      expect(PAY_STATUS[s].label).toBeTruthy();
    }
    // @ts-expect-error — `failed` is missing, so this is not a PAY_STATUS.
    const incomplete: typeof PAY_STATUS = {
      paid: PAY_STATUS.paid,
      pending: PAY_STATUS.pending,
      refunded: PAY_STATUS.refunded,
      refund_pending: PAY_STATUS.refund_pending,
      refund_delayed: PAY_STATUS.refund_delayed,
      refund_none_due: PAY_STATUS.refund_none_due,
    };
    expect(incomplete).toBeDefined();
  });
});

// ── japa#356: refund rows in Payments ───────────────────────────────────────
describe('refund rows read the server refundState first (japa#356)', () => {
  /** A refund row as the client endpoint sends it after backend #413 H. */
  const refund = (over: Partial<ApiTransaction> = {}): ApiTransaction => ({
    ...txn('rf-1', 'refund', 'pending', 812_437),
    description: '',
    priceUsd: undefined,
    priceUsdCents: undefined,
    refundOf: 'txn-1',
    refundState: 'on_its_way',
    ...over,
  });

  it('each refundState maps to its pill', () => {
    const table: [ApiTransaction['refundState'], Payment['status'], string][] =
      [
        ['on_its_way', 'refund_pending', 'Refund pending'],
        ['refunded', 'refunded', 'Refunded'],
        ['delayed', 'refund_delayed', 'Refund delayed'],
        ['none_due', 'refund_none_due', 'No refund due'],
      ];
    for (const [state, status, label] of table) {
      const p = mapTransaction(refund({ refundState: state }));
      expect(p.status).toBe(status);
      expect(refundRowStatus({ status: 'pending', refundState: state })).toBe(
        status,
      );
      expect(PAY_STATUS[p.status].label).toBe(label);
    }
  });

  it('a HELD refund (status failed, refundState delayed) is Refund delayed', () => {
    expect(
      mapTransaction(
        refund({ status: 'failed', refundState: 'delayed', amount: 0 }),
      ).status,
    ).toBe('refund_delayed');
  });

  it('the server state wins over the raw status', () => {
    // A held row may look pending internally; the server says delayed.
    expect(refundRowStatus({ status: 'pending', refundState: 'delayed' })).toBe(
      'refund_delayed',
    );
  });

  it('with no refundState, the status decides (older backend)', () => {
    expect(
      mapTransaction(refund({ refundState: undefined, status: 'completed' }))
        .status,
    ).toBe('refunded');
    expect(
      mapTransaction(refund({ refundState: undefined, status: 'failed' }))
        .status,
    ).toBe('refund_delayed');
  });

  it('title, sub, own amount with kobo, no dollar line', () => {
    const p = mapTransaction(refund());
    expect(p.isRefund).toBe(true);
    expect(p.title).toBe('Consultation refund');
    expect(p.sub).toBe('Refund');
    expect(p.amount).toEqual({ amountMinor: 812_437, currency: 'NGN' });
    expect(p.usd).toBeNull();
    // Even when the row carries a dollar price, a refund shows none.
    expect(mapTransaction(refund({ priceUsdCents: 600 })).usd).toBeNull();
  });

  it("keeps the backend's description (a #354 unapplied-payment refund)", () => {
    const p = mapTransaction(
      refund({
        description: 'Refund: consultation payment that could not be applied',
        refundOf: undefined,
      }),
    );
    expect(p.title).toBe(
      'Refund: consultation payment that could not be applied',
    );
    expect(p.isRefund).toBe(true);
  });

  it('the fee row stays Paid with the price paid; refunds never in Total paid', () => {
    const rows = [
      clientRow, // ₦8,123.84 paid
      refund({ refundState: 'refunded', status: 'completed' }),
      refund({ id: 'rf-2', refundState: 'on_its_way' }),
      refund({
        id: 'rf-3',
        refundState: 'delayed',
        status: 'failed',
        amount: 0,
      }),
      refund({
        id: 'rf-4',
        refundState: 'none_due',
        status: 'closed',
        amount: 0,
      }),
    ].map(mapTransaction);
    expect(rows[0].status).toBe('paid');
    expect(rows[0].amount).toEqual({ amountMinor: 812_384, currency: 'NGN' });
    expect(rows[0].isRefund).toBeUndefined();
    expect(totalsPaid(rows)).toEqual([
      { amountMinor: 812_384, currency: 'NGN' },
    ]);
  });

  it('hasRefundAmount: only a positive amount is a refund amount', () => {
    expect(hasRefundAmount({ amount: 812_437 })).toBe(true);
    expect(hasRefundAmount({ amount: 0 })).toBe(false);
    expect(hasRefundAmount({ amount: -5 })).toBe(false);
    expect(hasRefundAmount({ amount: NaN })).toBe(false);
  });
});
