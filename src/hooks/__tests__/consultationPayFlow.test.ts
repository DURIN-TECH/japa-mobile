// ─────────────────────────────────────────────────────────────────────────────
// Consultation pay flow helpers (japa#183): the locked quote is read from the
// server's stored snapshot (never priced on the device), the countdown runs
// on the server clock, and every create / checkout / verify error maps to a
// screen verdict without throwing.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from '@jest/globals';
import {
  COUNTDOWN_WARN_SECONDS,
  PAY_COPY,
  bookingDisplay,
  chargeChanged,
  classifyConsultationPayError,
  isBookingPaidResult,
  isResumedBooking,
  formatCountdown,
  lockedQuoteFrom,
  lockedRateLine,
  quoteSecondsLeft,
} from '../consultationPayFlow';
import {
  paymentRequestParts,
  REQUEST_NOT_PAYABLE_MESSAGE,
} from '../paymentRequestFlow';
import {
  isUsableRate,
  priceInline,
  usdAtRateLine,
} from '@/components/explorer/content';

const LOCKED = Date.parse('2026-11-14T10:00:00Z');
const booking = {
  id: 'cons-1',
  priceUsdCents: 3500,
  chargedCurrency: 'NGN',
  chargedAmountMinor: 4_738_940,
  effectiveRate: 1353.97,
  quoteLockedAt: { _seconds: LOCKED / 1000, _nanoseconds: 0 },
  quoteExpiresAt: '2026-11-14T10:30:00Z',
};
const checkout = { authorizationUrl: 'https://x', reference: 'r1' };

describe('lockedQuoteFrom', () => {
  it('reads the stored snapshot exactly (Firestore or ISO timestamps)', () => {
    const q = lockedQuoteFrom(booking, checkout, LOCKED)!;
    expect(q.charged).toEqual({ amountMinor: 4_738_940, currency: 'NGN' });
    expect(q.usd).toEqual({ amountMinor: 3500, currency: 'USD' });
    expect(q.expiresAtMs).toBe(Date.parse('2026-11-14T10:30:00Z'));
    expect(q.reference).toBe('r1');
  });

  it('is null without a usable charge (never a ₦0 checkout)', () => {
    expect(
      lockedQuoteFrom({ ...booking, chargedAmountMinor: 0 }, checkout, LOCKED),
    ).toBeNull();
    expect(
      lockedQuoteFrom(
        { ...booking, chargedCurrency: undefined },
        checkout,
        LOCKED,
      ),
    ).toBeNull();
    expect(lockedQuoteFrom(null, checkout, LOCKED)).toBeNull();
  });
});

describe('countdown', () => {
  it('runs on the server clock, not the device clock alone', () => {
    // The device is 5 minutes fast when the quote arrives.
    const deviceAtReceipt = LOCKED + 5 * 60_000;
    const q = lockedQuoteFrom(booking, checkout, deviceAtReceipt)!;
    expect(quoteSecondsLeft(q, deviceAtReceipt)).toBe(30 * 60);
    expect(quoteSecondsLeft(q, deviceAtReceipt + 29 * 60_000 + 30_000)).toBe(
      30,
    );
    expect(quoteSecondsLeft(q, deviceAtReceipt + 31 * 60_000)).toBe(0);
  });

  it('keeps the earlier offset when a summary has no quoteLockedAt', () => {
    const summary = { ...booking, quoteLockedAt: undefined };
    const q = lockedQuoteFrom(summary, checkout, LOCKED, -60_000)!;
    expect(q.clockOffsetMs).toBe(-60_000);
  });

  it('formats mm:ss and warns at 5 minutes', () => {
    expect(formatCountdown(1721)).toBe('28:41');
    expect(formatCountdown(5)).toBe('0:05');
    expect(COUNTDOWN_WARN_SECONDS).toBe(300);
  });
});

describe('lockedRateLine / chargeChanged', () => {
  it('shows the server rate verbatim in the charged currency', () => {
    const q = lockedQuoteFrom(booking, checkout, LOCKED)!;
    expect(lockedRateLine(q)).toBe('$35.00 at ₦1,353.97 per $1');
    expect(lockedRateLine({ ...q, effectiveRate: null })).toBe('$35.00');
  });

  // ── japa#332: the rate is the server's `effectiveRate`, never `fxRate` ──
  it('the issue example: $6.00 charged ₦8,123.84 reads "$6.00 at ₦1,353.97 per $1"', () => {
    // effectiveRate = 812384 kobo ÷ 600 cents = 1353.973333 (6 decimals, as
    // the backend sends it); shown to the naira's 2 decimals.
    const q = lockedQuoteFrom(
      {
        ...booking,
        priceUsdCents: 600,
        chargedAmountMinor: 812_384,
        effectiveRate: 1353.973333,
      },
      checkout,
      LOCKED,
    )!;
    expect(q.effectiveRate).toBe(1353.973333);
    expect(lockedRateLine(q)).toBe('$6.00 at ₦1,353.97 per $1');
  });
  it('ignores a raw `fxRate`: only `effectiveRate` is ever read', () => {
    // An older backend (or a leak) sending the raw mid-market rate must not
    // put it on screen: with no effectiveRate the line is dollars only.
    // Built as a variable: `fxRate` is no longer part of the typed shape.
    const leaky = { ...booking, effectiveRate: undefined, fxRate: 1320.95 };
    const q = lockedQuoteFrom(leaky, checkout, LOCKED)!;
    expect(q.effectiveRate).toBeNull();
    expect(q).not.toHaveProperty('fxRate');
    expect(lockedRateLine(q)).toBe('$35.00');
  });
  it('a legacy booking with no / unusable effectiveRate shows the dollar price only, without throwing', () => {
    for (const bad of [undefined, null, NaN, Infinity, 0, -5, '1353.97']) {
      const q = lockedQuoteFrom(
        { ...booking, effectiveRate: bad as unknown as number },
        checkout,
        LOCKED,
      )!;
      // The quote itself is still usable (amount, expiry, checkout).
      expect(q.charged.amountMinor).toBe(4_738_940);
      expect(q.effectiveRate).toBeNull();
      expect(lockedRateLine(q)).toBe('$35.00');
    }
  });
  it('a USD charge has no "per $1" line', () => {
    const q = lockedQuoteFrom(
      {
        ...booking,
        chargedCurrency: 'USD',
        chargedAmountMinor: 3500,
        effectiveRate: 1,
      },
      checkout,
      LOCKED,
    )!;
    expect(lockedRateLine(q)).toBe('$35.00');
  });
  it('detects a re-priced amount', () => {
    const q = lockedQuoteFrom(booking, checkout, LOCKED)!;
    expect(chargeChanged(q, q)).toBe(false);
    expect(
      chargeChanged(q, { ...q, charged: { ...q.charged, amountMinor: 1 } }),
    ).toBe(true);
  });
});

describe('classifyConsultationPayError', () => {
  it('maps each backend code (whatever call it came from)', () => {
    for (const stage of ['create', 'checkout', 'verify'] as const) {
      expect(
        classifyConsultationPayError(
          { code: 'PRICING_UNAVAILABLE', status: 503 },
          stage,
        ).kind,
      ).toBe('pricing_unavailable');
      expect(
        classifyConsultationPayError(
          { code: 'PAYMENT_IN_PROGRESS', status: 409 },
          stage,
        ).kind,
      ).toBe('in_progress');
      expect(
        classifyConsultationPayError(
          { code: 'BOOKING_NOT_PAYABLE', status: 409 },
          stage,
        ).kind,
      ).toBe('not_payable');
      expect(
        classifyConsultationPayError(
          { code: 'CHECKOUT_OPENING', status: 409 },
          stage,
        ).kind,
      ).toBe('opening');
    }
  });

  it('a bare 503 is never the pricing message (only the explicit code is)', () => {
    for (const stage of ['create', 'checkout', 'verify'] as const) {
      const v = classifyConsultationPayError(
        { code: 'UNKNOWN_ERROR', status: 503 },
        stage,
      );
      expect(v.kind).toBe('error');
    }
  });

  it('only the verify "Payment has not been completed" 400 is the unpaid case', () => {
    const v = classifyConsultationPayError(
      {
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'Payment has not been completed',
      },
      'verify',
    );
    expect(v.kind).toBe('not_completed');
    expect(v.message).toBe(PAY_COPY.notCompleted);
  });

  it('a create validation error is "couldn’t book", not "unpaid"', () => {
    const v = classifyConsultationPayError(
      {
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'The client has no email address to pay with',
      },
      'create',
    );
    expect(v.kind).toBe('booking_invalid');
    expect(v.message).toBe(PAY_COPY.bookingInvalid);
    expect(v.message).not.toBe(PAY_COPY.notCompleted);
  });

  it('PAYMENT_MISMATCH never asks someone who paid to pay again', () => {
    for (const stage of ['checkout', 'verify'] as const) {
      const v = classifyConsultationPayError(
        { code: 'PAYMENT_MISMATCH', status: 400 },
        stage,
      );
      expect(v.kind).toBe('payment_review');
      expect(v.message).toBe(PAY_COPY.paymentReview);
      expect(v.message).toMatch(/don’t pay again/);
      expect(v.message).toMatch(/support/);
    }
  });

  it('the 402 monthly consultation limit has its own verdict', () => {
    const v = classifyConsultationPayError(
      { code: 'UPGRADE_REQUIRED', status: 402 },
      'create',
    );
    expect(v.kind).toBe('limit_reached');
    expect(v.message).toBe(PAY_COPY.limitReached);
  });

  it('a 400 is never "unpaid" by its status alone', () => {
    // Verify 400 about the reference: unknown, so not called unpaid.
    expect(
      classifyConsultationPayError(
        {
          code: 'VALIDATION_ERROR',
          status: 400,
          message: 'This payment reference does not belong to this booking',
        },
        'verify',
      ).kind,
    ).toBe('unconfirmed');
    // A 400 with an unknown code, or on /checkout: the plain error.
    expect(
      classifyConsultationPayError({ code: 'SOMETHING', status: 400 }, 'verify')
        .kind,
    ).toBe('error');
    expect(
      classifyConsultationPayError(
        { code: 'VALIDATION_ERROR', status: 400 },
        'checkout',
      ).kind,
    ).toBe('error');
  });

  it('QUOTE_EXPIRED / CHECKOUT_REPLACED carry the current checkout', () => {
    for (const code of ['QUOTE_EXPIRED', 'CHECKOUT_REPLACED']) {
      const v = classifyConsultationPayError(
        {
          code,
          status: 409,
          data: {
            authorizationUrl: 'https://new',
            reference: 'r2',
            consultation: booking,
          },
        },
        'verify',
      );
      expect(v.kind).toBe('new_checkout');
      if (v.kind !== 'new_checkout') return;
      expect(v.authorizationUrl).toBe('https://new');
      expect(v.reference).toBe('r2');
      expect(v.consultation?.id).toBe('cons-1');
      expect(v.message).toBe(PAY_COPY.newPrice);
    }
  });

  it('anything else (502, 404, network, junk) is a plain error', () => {
    for (const e of [
      { code: 'BILLING_PROVIDER_ERROR', status: 502 },
      { code: 'NOT_FOUND', status: 404 },
      { code: 'NETWORK_ERROR', status: 0 },
      null,
      'boom',
    ]) {
      expect(classifyConsultationPayError(e, 'verify').kind).toBe('error');
    }
  });
});

describe('isBookingPaidResult', () => {
  it('is true only when the body says paid', () => {
    expect(isBookingPaidResult({ verified: true })).toBe(true);
    expect(
      isBookingPaidResult({
        requiresPayment: false,
        consultation: { paymentStatus: 'paid' },
      }),
    ).toBe(true);
  });
  it('a bare 2xx body is not proof of payment', () => {
    for (const body of [
      {},
      null,
      undefined,
      'ok',
      { verified: false },
      { verified: 'true' },
      { consultation: { paymentStatus: 'pending' } },
      { consultation: null },
    ]) {
      expect(isBookingPaidResult(body)).toBe(false);
    }
  });
});

describe('paymentRequestParts', () => {
  const base = {
    amount: 10000,
    currency: 'USD',
    priceUsd: { amountMinor: 10000, currency: 'USD' },
    legacy: false,
    charge: null,
    status: 'pending' as const,
  };
  it('pending: dollars only (the app never converts)', () => {
    expect(priceInline(paymentRequestParts(base))).toBe('$100.00');
  });
  it('approved: the local charge with "about $"', () => {
    expect(
      priceInline(
        paymentRequestParts({
          ...base,
          status: 'approved',
          charge: { amountMinor: 15_000_000, currency: 'NGN' },
        }),
      ),
    ).toBe('₦150,000 · about $100');
  });
  it('paid: exact, no "about"', () => {
    expect(
      priceInline(
        paymentRequestParts({
          ...base,
          status: 'paid',
          charge: { amountMinor: 15_000_000, currency: 'NGN' },
        }),
      ),
    ).toBe('₦150,000.00 · $100.00');
  });

  // ── japa#332: a priced request carries the server's `effectiveRate` ─────
  it('approved with effectiveRate: "$100.00 at ₦1,500.00 per $1" under the amount', () => {
    const parts = paymentRequestParts({
      ...base,
      status: 'approved',
      charge: { amountMinor: 15_000_000, currency: 'NGN' },
      effectiveRate: 1500,
    });
    expect(parts.primary).toBe('₦150,000');
    expect(parts.secondary).toBe('$100.00 at ₦1,500.00 per $1');
  });
  it('the issue example on a paid request: "$6.00 at ₦1,353.97 per $1"', () => {
    const parts = paymentRequestParts({
      ...base,
      amount: 600,
      priceUsd: { amountMinor: 600, currency: 'USD' },
      status: 'paid',
      charge: { amountMinor: 812_384, currency: 'NGN' },
      effectiveRate: 1353.973333,
    });
    expect(parts.primary).toBe('₦8,123.84');
    expect(parts.secondary).toBe('$6.00 at ₦1,353.97 per $1');
  });
  it('a pending request never shows a rate, even if one were sent', () => {
    // No charge yet = nothing was priced, so there is no rate to show.
    expect(
      priceInline(paymentRequestParts({ ...base, effectiveRate: 1500 })),
    ).toBe('$100.00');
  });
  it('priced but no usable effectiveRate (older record): the dollar-only line, no throw', () => {
    for (const bad of [undefined, null, NaN, 0, -1]) {
      expect(
        priceInline(
          paymentRequestParts({
            ...base,
            status: 'paid',
            charge: { amountMinor: 15_000_000, currency: 'NGN' },
            effectiveRate: bad as unknown as number,
          }),
        ),
      ).toBe('₦150,000.00 · $100.00');
    }
  });
  it('a USD charge keeps "$100.00" alone', () => {
    expect(
      priceInline(
        paymentRequestParts({
          ...base,
          status: 'paid',
          charge: { amountMinor: 10000, currency: 'USD' },
          effectiveRate: 1,
        }),
      ),
    ).toBe('$100.00');
  });
  it('legacy: its own amount and currency', () => {
    expect(
      priceInline(
        paymentRequestParts({
          ...base,
          legacy: true,
          amount: 500_000,
          currency: 'NGN',
          priceUsd: null,
        }),
      ),
    ).toBe('₦5,000.00');
    expect(REQUEST_NOT_PAYABLE_MESSAGE).toMatch(/can’t be paid/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// japa#288: resumed bookings and the booking a 409 names.
// ─────────────────────────────────────────────────────────────────────────────
describe('409s that name the booking (japa#288)', () => {
  const consultation = { id: 'cons-old', type: 'general' };

  it('CHECKOUT_OPENING carries data.consultation (its id is the retry target)', () => {
    for (const stage of ['create', 'checkout'] as const) {
      const v = classifyConsultationPayError(
        { code: 'CHECKOUT_OPENING', status: 409, data: { consultation } },
        stage,
      );
      expect(v).toMatchObject({
        kind: 'opening',
        message: PAY_COPY.opening,
        consultation: { id: 'cons-old' },
        authorizationUrl: null,
        reference: null,
      });
    }
  });

  it('PAYMENT_IN_PROGRESS carries the booking and its current checkout', () => {
    const v = classifyConsultationPayError(
      {
        code: 'PAYMENT_IN_PROGRESS',
        status: 409,
        data: { authorizationUrl: 'https://x', reference: 'r1', consultation },
      },
      'create',
    );
    expect(v).toMatchObject({
      kind: 'in_progress',
      message: PAY_COPY.inProgress,
      authorizationUrl: 'https://x',
      reference: 'r1',
      consultation: { id: 'cons-old' },
    });
  });

  it('missing or malformed data gives nulls, never a throw', () => {
    for (const data of [
      undefined,
      null,
      'x',
      42,
      {},
      { consultation: 'cons-old' },
      { consultation: {} },
      { consultation: { id: 7 } },
      { consultation: { id: '' } },
      { reference: 9, authorizationUrl: {} },
    ]) {
      for (const code of ['CHECKOUT_OPENING', 'PAYMENT_IN_PROGRESS']) {
        const v = classifyConsultationPayError(
          { code, status: 409, data },
          'create',
        );
        expect(v).toMatchObject({
          consultation: null,
          authorizationUrl: null,
          reference: null,
        });
      }
    }
  });

  it('QUOTE_EXPIRED / CHECKOUT_REPLACED still hand over their checkout', () => {
    const v = classifyConsultationPayError(
      {
        code: 'QUOTE_EXPIRED',
        status: 409,
        data: { authorizationUrl: 'https://n', reference: 'r2', consultation },
      },
      'verify',
    );
    expect(v).toMatchObject({
      kind: 'new_checkout',
      authorizationUrl: 'https://n',
      reference: 'r2',
      consultation: { id: 'cons-old' },
    });
  });
});

describe('lockedQuoteFrom: a resumed booking’s clock (japa#288)', () => {
  // Locked at 10:00, expires 10:30, handed back at 10:10 device time.
  const TEN_PAST = LOCKED + 10 * 60_000;

  it('does not take an old quoteLockedAt as "now": 20:00 left, not 30:00', () => {
    const q = lockedQuoteFrom(booking, checkout, TEN_PAST, 0, false)!;
    expect(q.clockOffsetMs).toBe(0);
    expect(quoteSecondsLeft(q, TEN_PAST)).toBe(20 * 60);
    // What the default (fresh lock) would wrongly have shown here.
    const fresh = lockedQuoteFrom(booking, checkout, TEN_PAST)!;
    expect(quoteSecondsLeft(fresh, TEN_PAST)).toBe(30 * 60);
  });

  it('already past its expiry: 0 seconds left at once', () => {
    const late = LOCKED + 45 * 60_000;
    const q = lockedQuoteFrom(booking, checkout, late, 0, false)!;
    expect(quoteSecondsLeft(q, late)).toBe(0);
  });

  it('keeps an offset measured earlier when one is passed', () => {
    const q = lockedQuoteFrom(booking, checkout, TEN_PAST, -5000, false)!;
    expect(q.clockOffsetMs).toBe(-5000);
  });
});

describe('isResumedBooking', () => {
  it('is true only for resumed: true', () => {
    expect(isResumedBooking({ id: 'c', resumed: true })).toBe(true);
    for (const v of [
      { id: 'c' },
      { resumed: false },
      { resumed: 'true' },
      { resumed: 1 },
      null,
      undefined,
      'resumed',
    ]) {
      expect(isResumedBooking(v)).toBe(false);
    }
  });
});

describe('bookingDisplay', () => {
  const picked = {
    topic: 'Document check',
    type: 'document_review' as const,
    durLabel: '30 min',
  };
  const label = (t: string) => `label:${t}`;

  it('shows the pick while the server has said nothing', () => {
    for (const actual of [null, undefined, {}]) {
      expect(bookingDisplay(picked, actual, label)).toEqual({
        topic: 'Document check',
        dur: '30 min',
        differs: false,
      });
    }
  });

  it('keeps the pick (its own wording) when the booking matches it', () => {
    expect(
      bookingDisplay(
        picked,
        { type: 'document_review', durationMinutes: 30 },
        label,
      ),
    ).toEqual({ topic: 'Document check', dur: '30 min', differs: false });
  });

  it('shows the resumed booking’s type and duration when they differ', () => {
    expect(
      bookingDisplay(picked, { type: 'general', durationMinutes: 45 }, label),
    ).toEqual({ topic: 'label:general', dur: '45 min', differs: true });
  });

  it('replaces only the line that differs', () => {
    expect(
      bookingDisplay(
        picked,
        { type: 'document_review', durationMinutes: 45 },
        label,
      ),
    ).toEqual({ topic: 'Document check', dur: '45 min', differs: true });
    // A 409 summary: type only, the duration is not known yet.
    expect(bookingDisplay(picked, { type: 'initial' }, label)).toEqual({
      topic: 'label:initial',
      dur: '30 min',
      differs: true,
    });
  });

  it('ignores a duration that is not a positive number', () => {
    for (const durationMinutes of [0, -5, NaN, Infinity]) {
      expect(bookingDisplay(picked, { durationMinutes }, label).dur).toBe(
        '30 min',
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// usdAtRateLine / isUsableRate (japa#332): the one formatter behind the rate
// line on the pay screen, the confirmation and a priced payment request.
// ─────────────────────────────────────────────────────────────────────────────
describe('usdAtRateLine / isUsableRate', () => {
  const usd = { amountMinor: 600, currency: 'USD' };
  it('formats the rate in the charged currency', () => {
    expect(usdAtRateLine(usd, 'NGN', 1353.973333)).toBe(
      '$6.00 at ₦1,353.97 per $1',
    );
  });
  it('a rate below 10 keeps 4 decimals, so it reproduces the charge (GBP)', () => {
    // $100.00 charged £78.83: "£0.79" would read as £79.00.
    const hundred = { amountMinor: 10_000, currency: 'USD' };
    expect(usdAtRateLine(hundred, 'GBP', 0.7883)).toBe(
      '$100.00 at £0.7883 per $1',
    );
    expect(usdAtRateLine(hundred, 'GBP', 0.788349)).toBe(
      '$100.00 at £0.7883 per $1',
    );
    expect(usdAtRateLine(hundred, 'CAD', 1.4)).toBe(
      '$100.00 at CA$1.4000 per $1',
    );
  });
  it('a rate of 10 or more keeps 2 decimals, thousands grouped (NGN, KES, UGX)', () => {
    expect(usdAtRateLine(usd, 'NGN', 1353.97)).toBe(
      '$6.00 at ₦1,353.97 per $1',
    );
    expect(usdAtRateLine(usd, 'NGN', 1500)).toBe('$6.00 at ₦1,500.00 per $1');
    expect(usdAtRateLine(usd, 'KES', 129.456)).toBe(
      '$6.00 at KSh129.46 per $1',
    );
    // A zero-decimal currency: the rate still shows 2 decimals.
    expect(usdAtRateLine(usd, 'UGX', 3712.5)).toBe(
      '$6.00 at USh3,712.50 per $1',
    );
    expect(usdAtRateLine(usd, 'GHS', 10)).toBe('$6.00 at GH₵10.00 per $1');
  });
  it('falls back to the dollar price when there is no usable rate or currency', () => {
    expect(usdAtRateLine(usd, 'NGN', undefined)).toBe('$6.00');
    expect(usdAtRateLine(usd, 'NGN', null)).toBe('$6.00');
    expect(usdAtRateLine(usd, 'NGN', NaN)).toBe('$6.00');
    expect(usdAtRateLine(usd, 'NGN', 0)).toBe('$6.00');
    expect(usdAtRateLine(usd, 'NGN', '1353.97')).toBe('$6.00');
    expect(usdAtRateLine(usd, undefined, 1353.97)).toBe('$6.00');
    expect(usdAtRateLine(usd, '', 1353.97)).toBe('$6.00');
    expect(usdAtRateLine(usd, 'usd', 1)).toBe('$6.00');
  });
  it('gives an empty string (never "undefined at …") without a dollar price', () => {
    expect(usdAtRateLine(null, 'NGN', 1353.97)).toBe('');
    expect(usdAtRateLine(undefined, 'NGN', 1353.97)).toBe('');
  });
  it('isUsableRate accepts only finite numbers above zero', () => {
    expect(isUsableRate(1353.97)).toBe(true);
    for (const bad of [0, -1, NaN, Infinity, null, undefined, '1', {}]) {
      expect(isUsableRate(bad)).toBe(false);
    }
  });
});
