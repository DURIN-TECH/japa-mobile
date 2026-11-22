// ─────────────────────────────────────────────────────────────────────────────
// Refund copy (japa#356) and "meeting didn't happen" copy (japa#442).
//
// Every figure is the server's Money through formatMoney's exact format
// (kobo kept). The cancel confirm cases A–E, the result alert and the refund
// card follow the design spec on japa#356 word for word.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from '@jest/globals';
import {
  cancelConfirmCopy,
  cancelResultMessage,
  noShowReportCopy,
  refundCardCopy,
  wasPaidBooking,
} from '../refundCopy';
import {
  bookingInstant,
  bookingRouteParams,
  bookingWhen,
  formatCutoff,
} from '../zoneTime';
import { bookingRefundAmount } from '../liveTransactions';
import type { ApiTransaction } from '@/hooks/useTransactions';
import type { CancellationRefundPreview } from '@/hooks/useConsultations';

const ngn = (amountMinor: number) => ({ amountMinor, currency: 'NGN' });

/** Zone text that must never appear (user decision 2026-11-22). */
/**
 * Run `fn` with the phone's zone set to `zone`: the helpers take it as their
 * last argument (Jest cannot change the process zone inside a test).
 */
function withDeviceZone(zone: string, fn: (device: string) => void) {
  fn(zone);
}

const NO_ZONE_TEXT = /GMT|UTC|WAT|BST|EST|[+-]\d/;
// Slot at 15:00 Lagos on Thu 26 Nov 2026 → refunds close 15:00 Wed 25 Nov
// (14:00 UTC; Lagos is UTC+1 with no DST).
const UNTIL = '2026-11-25T14:00:00.000Z';
const preview = (
  over: Partial<CancellationRefundPreview> = {},
): CancellationRefundPreview => ({
  refundable: true,
  amount: ngn(812_437),
  processingFee: ngn(12_563),
  refundableUntil: UNTIL,
  ...over,
});

// ── 1. Cancel confirm ────────────────────────────────────────────────────────
describe('cancelConfirmCopy (japa#356 §1)', () => {
  it('A. no preview: today’s copy, nothing about refunds', () => {
    const c = cancelConfirmCopy(undefined);
    expect(c).toEqual({
      title: 'Cancel consultation?',
      message: 'This will release your booked slot. You can rebook anytime.',
      destructive: 'Cancel consultation',
    });
    expect(c.message).not.toMatch(/refund/i);
  });

  it('B. refundable with a fee: amount back + the fee kept, exact kobo', () => {
    const c = cancelConfirmCopy(preview());
    expect(c.message).toBe(
      'This will release your booked slot. You’ll get ₦8,124.37 back. The payment provider keeps a processing fee of ₦125.63.',
    );
    expect(c.destructive).toBe('Cancel consultation');
  });

  it('C. refundable, fee 0 or null: no fee sentence', () => {
    for (const processingFee of [ngn(0), null]) {
      const c = cancelConfirmCopy(
        preview({ amount: ngn(825_000), processingFee }),
      );
      expect(c.message).toBe(
        'This will release your booked slot. You’ll get ₦8,250.00 back.',
      );
    }
  });

  it('D. refundable, amount null: no figure, never the full price', () => {
    const c = cancelConfirmCopy(preview({ amount: null, processingFee: null }));
    expect(c.message).toBe(
      'This will release your booked slot. You’ll get your payment back, minus the payment provider’s processing fee. We’ll confirm the exact amount.',
    );
    expect(c.message).not.toMatch(/₦/);
  });

  // Review fix: `amount: null` WITH a known fee = the fee covers the whole
  // charge; nothing comes back, and the copy must say so.
  it('D2. amount null, fee known: nothing to refund, said plainly', () => {
    const c = cancelConfirmCopy(
      preview({ amount: null, processingFee: ngn(825_000) }),
    );
    expect(c.message).toBe(
      'This will release your booked slot. The payment provider’s processing fee covers the whole payment, so there’s nothing to refund.',
    );
    expect(c.destructive).toBe('Cancel without refund');
    expect(c.message).not.toMatch(/₦|get your payment back/);
  });

  it('D1. amount null, no fee (or a fee of 0): the "we’ll confirm" copy', () => {
    for (const processingFee of [null, ngn(0)]) {
      const c = cancelConfirmCopy(preview({ amount: null, processingFee }));
      expect(c.message).toMatch(/We’ll confirm the exact amount\.$/);
      expect(c.destructive).toBe('Cancel consultation');
    }
  });

  // User decision 2026-11-22: the cut-off is on the PHONE'S OWN clock with
  // NO zone label. UNTIL is 14:00 UTC (15:00 in Lagos).
  it('E. Lagos phone: the Lagos clock, no zone label', () => {
    withDeviceZone('Africa/Lagos', (d) => {
      const c = cancelConfirmCopy(
        preview({ refundable: false, amount: null, processingFee: null }),
        d,
      );
      expect(c.message).toBe(
        'It’s less than 24 hours before your consultation, so cancelling now won’t give you a refund. Refunds closed at 3:00 PM on Wed, 25 Nov.',
      );
      expect(c.destructive).toBe('Cancel without refund');
    });
  });

  it('E. London phone, Lagos booking: the London clock, no zone label', () => {
    withDeviceZone('Europe/London', (d) => {
      const c = cancelConfirmCopy(preview({ refundable: false }), d);
      expect(c.message).toBe(
        'It’s less than 24 hours before your consultation, so cancelling now won’t give you a refund. Refunds closed at 2:00 PM on Wed, 25 Nov.',
      );
      expect(c.message).not.toMatch(NO_ZONE_TEXT);
    });
  });

  it('E. the QA case: 05:00 UTC on a London phone reads 5:00 AM', () => {
    withDeviceZone('Europe/London', (d) => {
      const c = cancelConfirmCopy(
        preview({
          refundable: false,
          refundableUntil: '2026-11-21T05:00:00.000Z',
        }),
        d,
      );
      expect(c.message).toMatch(/Refunds closed at 5:00 AM on Sat, 21 Nov\.$/);
      expect(c.message).not.toMatch(NO_ZONE_TEXT);
    });
  });

  it('E. an unreadable cut-off drops the sentence, keeps the warning', () => {
    const c = cancelConfirmCopy(
      preview({ refundable: false, refundableUntil: 'not a date' }),
    );
    expect(c.message).toBe(
      'It’s less than 24 hours before your consultation, so cancelling now won’t give you a refund.',
    );
  });
});

// ── 2. Cancel result ─────────────────────────────────────────────────────────
describe('cancelResultMessage (japa#356 §2): from the PUT answer', () => {
  it('amount + fee', () => {
    expect(
      cancelResultMessage(
        { status: 'pending', amount: ngn(812_437), processingFee: ngn(12_563) },
        true,
      ),
    ).toBe(
      'Your refund of ₦8,124.37 is on its way. The payment provider kept a processing fee of ₦125.63.',
    );
  });
  it('amount, no fee', () => {
    expect(
      cancelResultMessage(
        { status: 'pending', amount: ngn(825_000), processingFee: null },
        true,
      ),
    ).toBe('Your refund of ₦8,250.00 is on its way.');
  });
  it('held (amount null)', () => {
    expect(
      cancelResultMessage(
        {
          status: 'failed',
          amount: null,
          processingFee: null,
          heldReason: 'fee_unknown',
        },
        true,
      ),
    ).toBe(
      'Your refund is delayed while we confirm the payment provider’s processing fee. We’re on it.',
    );
  });
  it('refund null on a paid booking: no refund (the 24-hour line passed)', () => {
    expect(cancelResultMessage(null, true)).toBe(
      'Your slot is released. As it was less than 24 hours before your consultation, there’s no refund.',
    );
  });
  it('refund null on a free booking', () => {
    expect(cancelResultMessage(null, false)).toBe('Your slot is released.');
    // An older backend that sends no `refund` at all reads the same.
    expect(cancelResultMessage(undefined, false)).toBe(
      'Your slot is released.',
    );
  });
  it('wasPaidBooking: a preview, or paid with a price', () => {
    expect(wasPaidBooking({ cancellationRefund: preview() })).toBe(true);
    expect(wasPaidBooking({ paymentStatus: 'paid', priceUsdCents: 600 })).toBe(
      true,
    );
    expect(wasPaidBooking({ paymentStatus: 'paid', priceUsdCents: 0 })).toBe(
      false,
    );
    expect(
      wasPaidBooking({ paymentStatus: 'pending', priceUsdCents: 600 }),
    ).toBe(false);
  });
});

// ── 3. Refund card ───────────────────────────────────────────────────────────
describe('refundCardCopy (japa#356 §3)', () => {
  it('pending / processing: on its way, with the row’s figure', () => {
    for (const s of ['pending', 'processing'] as const) {
      const c = refundCardCopy(s, ngn(812_437))!;
      expect(c.pill.label).toBe('Refund on its way');
      expect(c.pill.fg).toBe('#B26A14');
      expect(c.body).toBe(
        'Your refund of ₦8,124.37 is on its way to the card or account you paid with. Your bank may take a few days to show it.',
      );
    }
  });
  it('no row / held (null): the figure is dropped', () => {
    expect(refundCardCopy('pending', null)!.body).toBe(
      'Your refund is on its way to the card or account you paid with.',
    );
    expect(refundCardCopy('pending', ngn(0))!.body).toBe(
      'Your refund is on its way to the card or account you paid with.',
    );
  });
  it('completed: Refunded (neutral)', () => {
    const c = refundCardCopy('completed', ngn(812_437))!;
    expect(c.pill).toEqual({
      label: 'Refunded',
      fg: '#8B8499',
      bg: 'rgba(23,19,38,0.06)',
    });
    expect(c.body).toBe(
      'We’ve sent ₦8,124.37 back to the card or account you paid with.',
    );
  });
  it('failed (incl. held): Refund delayed, no figure', () => {
    const c = refundCardCopy('failed', ngn(812_437))!;
    expect(c.pill.label).toBe('Refund delayed');
    expect(c.pill.fg).toBe('#C0453C');
    expect(c.body).toBe(
      'Your refund is taking longer than usual. We’re on it, and we’ll let you know when it’s sent.',
    );
  });
  it('closed: No refund due', () => {
    expect(refundCardCopy('closed', null)!.pill.label).toBe('No refund due');
  });
  it('no refundStatus: no card', () => {
    expect(refundCardCopy(undefined, ngn(1))).toBeNull();
  });
});

// ── The card's figure: the booking's own refund row ──────────────────────────
describe('bookingRefundAmount', () => {
  const row = (over: Partial<ApiTransaction>): ApiTransaction => ({
    id: 'rf',
    type: 'refund',
    status: 'pending',
    description: '',
    amountCharged: ngn(812_437),
    amount: 812_437,
    currency: 'NGN',
    paymentProvider: 'paystack',
    consultationId: 'cons-1',
    createdAt: '2026-11-20T10:00:00.000Z',
    refundState: 'on_its_way',
    refundOf: 'fee-1',
    ...over,
  });
  it('the one refund row of the booking, exactly', () => {
    expect(
      bookingRefundAmount(
        [
          row({ type: 'consultation_fee', id: 'fee', amount: 825_000 }),
          row({}),
          row({ id: 'other', consultationId: 'cons-2', amount: 1 }),
        ],
        'cons-1',
      ),
    ).toEqual(ngn(812_437));
  });
  // Review fix: a #354 / #392 refund of a payment on a retired checkout
  // carries the booking's id but no `refundOf`: never this booking's refund.
  it('ignores a refund with no refundOf (an unapplied-payment refund)', () => {
    const unapplied = row({
      id: 'rf-old',
      amount: 4_738_940,
      refundOf: undefined,
      description: 'Refund: consultation payment that could not be applied',
    });
    // Alone: no figure (never the old price as this booking's refund).
    expect(bookingRefundAmount([unapplied], 'cons-1')).toBeNull();
    // Next to the booking's own fee refund: that one's figure comes back.
    expect(bookingRefundAmount([unapplied, row({})], 'cons-1')).toEqual(
      ngn(812_437),
    );
  });

  it('none, held (0), or two refund rows: null', () => {
    expect(bookingRefundAmount([], 'cons-1')).toBeNull();
    expect(bookingRefundAmount(undefined, 'cons-1')).toBeNull();
    expect(
      bookingRefundAmount(
        [row({ amount: 0, refundState: 'delayed' })],
        'cons-1',
      ),
    ).toBeNull();
    expect(
      bookingRefundAmount([row({}), row({ id: 'topup', amount: 5 })], 'cons-1'),
    ).toBeNull();
  });
});

// ── Booking times on the phone's own clock (user decision 2026-11-22) ─────
describe('zoneTime', () => {
  /** A 15:00 Lagos slot on Wed 25 Nov 2026 (14:00 UTC). */
  const lagos = {
    // The UTC calendar day is the day picked (backend slot-time.ts).
    scheduledDate: { _seconds: Date.UTC(2026, 10, 25) / 1000 },
    scheduledTime: '15:00',
    timezone: 'Africa/Lagos',
  };

  it('formatCutoff: the phone’s clock in each zone, never a zone label', () => {
    withDeviceZone('Africa/Lagos', (d) =>
      expect(formatCutoff(UNTIL, d)).toBe('3:00 PM on Wed, 25 Nov'),
    );
    withDeviceZone('Europe/London', (d) =>
      expect(formatCutoff(UNTIL, d)).toBe('2:00 PM on Wed, 25 Nov'),
    );
    withDeviceZone('America/New_York', (d) => {
      expect(formatCutoff(UNTIL, d)).toBe('9:00 AM on Wed, 25 Nov');
      expect(formatCutoff(UNTIL, d)).not.toMatch(NO_ZONE_TEXT);
    });
    expect(formatCutoff('not a date')).toBe('');
  });

  it('bookingInstant: the stored wall clock in the booking’s zone', () => {
    expect(bookingInstant(lagos)?.toISOString()).toBe(
      '2026-11-25T14:00:00.000Z',
    );
    // An unknown zone reads the wall clock as UTC (never throws).
    expect(
      bookingInstant({ ...lagos, timezone: 'Not/AZone' })?.toISOString(),
    ).toBe('2026-11-25T15:00:00.000Z');
    expect(bookingInstant({ ...lagos, scheduledTime: 'x' })).toBeNull();
  });

  it('bookingWhen: Lagos phone shows 3:00 PM; London phone 2:00 PM; no label', () => {
    withDeviceZone('Africa/Lagos', (d) =>
      expect(bookingWhen(lagos, d)).toEqual({
        date: 'Wednesday, November 25, 2026',
        time: '3:00 PM',
      }),
    );
    withDeviceZone('Europe/London', (d) => {
      const w = bookingWhen(lagos, d)!;
      expect(w).toEqual({
        date: 'Wednesday, November 25, 2026',
        time: '2:00 PM',
      });
      expect(w.time).not.toMatch(NO_ZONE_TEXT);
    });
  });

  it('bookingWhen: the DATE follows the phone too (late-night slot)', () => {
    // 23:30 Lagos on 25 Nov is 17:30 in New York, and 06:30 on 26 Nov in Tokyo.
    const late = { ...lagos, scheduledTime: '23:30' };
    withDeviceZone('Asia/Tokyo', (d) =>
      expect(bookingWhen(late, d)).toEqual({
        date: 'Thursday, November 26, 2026',
        time: '7:30 AM',
      }),
    );
  });

  it('bookingWhen: no date → null; no time → the stored date alone', () => {
    expect(bookingWhen({ scheduledDate: null })).toBeNull();
    expect(
      bookingWhen({
        scheduledDate: '2026-11-25T00:00:00.000Z',
        scheduledTime: 'x',
      }),
    ).toEqual({ date: 'Wednesday, November 25, 2026', time: '' });
  });

  it('bookingRouteParams: the phone’s clock, in the route-param forms', () => {
    withDeviceZone('Europe/London', (d) =>
      expect(bookingRouteParams(lagos, d)).toEqual({
        dateIso: '2026-11-25',
        time: '2:00 PM',
      }),
    );
  });
});

// ── 4. The report card (japa#442) ────────────────────────────────────────────
describe('noShowReportCopy (japa#442)', () => {
  const at = { _seconds: 1 };
  it('open: under review', () => {
    const c = noShowReportCopy({ status: 'open', createdAt: at })!;
    expect(c.pill.label).toBe('Under review');
    expect(c.body).toMatch(/Seli is looking into it/);
  });
  it('refunded: resolved with a refund', () => {
    expect(
      noShowReportCopy({ status: 'refunded', createdAt: at })!.body,
    ).toMatch(/refunding your payment in full/);
  });
  it('released: Seli found the meeting took place', () => {
    expect(noShowReportCopy({ status: 'released', createdAt: at })!.body).toBe(
      'Seli found the meeting took place, so there’s no refund.',
    );
  });
  it('no report: no card', () => {
    expect(noShowReportCopy(null)).toBeNull();
    expect(noShowReportCopy(undefined)).toBeNull();
  });
});
