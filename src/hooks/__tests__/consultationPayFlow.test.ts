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
  chargeChanged,
  classifyConsultationPayError,
  formatCountdown,
  lockedQuoteFrom,
  lockedRateLine,
  quoteSecondsLeft,
} from '../consultationPayFlow';
import {
  paymentRequestParts,
  REQUEST_NOT_PAYABLE_MESSAGE,
} from '../paymentRequestFlow';
import { priceInline } from '@/components/explorer/content';

const LOCKED = Date.parse('2026-11-14T10:00:00Z');
const booking = {
  id: 'cons-1',
  priceUsdCents: 3500,
  chargedCurrency: 'NGN',
  chargedAmountMinor: 4_738_940,
  fxRate: 1353.97,
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
    expect(lockedRateLine({ ...q, fxRate: null })).toBe('$35.00');
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
  it('maps each backend code', () => {
    expect(
      classifyConsultationPayError({ code: 'PRICING_UNAVAILABLE', status: 503 })
        .kind,
    ).toBe('pricing_unavailable');
    expect(
      classifyConsultationPayError({ code: 'PAYMENT_IN_PROGRESS', status: 409 })
        .kind,
    ).toBe('in_progress');
    expect(
      classifyConsultationPayError({ code: 'BOOKING_NOT_PAYABLE', status: 409 })
        .kind,
    ).toBe('not_payable');
    expect(
      classifyConsultationPayError({ code: 'CHECKOUT_OPENING', status: 409 })
        .kind,
    ).toBe('opening');
    expect(
      classifyConsultationPayError({ code: 'VALIDATION_ERROR', status: 400 })
        .kind,
    ).toBe('not_completed');
  });

  it('QUOTE_EXPIRED / CHECKOUT_REPLACED carry the current checkout', () => {
    const v = classifyConsultationPayError({
      code: 'QUOTE_EXPIRED',
      status: 409,
      data: {
        authorizationUrl: 'https://new',
        reference: 'r2',
        consultation: booking,
      },
    });
    expect(v.kind).toBe('new_checkout');
    if (v.kind !== 'new_checkout') return;
    expect(v.authorizationUrl).toBe('https://new');
    expect(v.reference).toBe('r2');
    expect(v.consultation?.id).toBe('cons-1');
    expect(v.message).toBe(PAY_COPY.newPrice);
  });

  it('anything else (502, 404, network, junk) is a plain error', () => {
    for (const e of [
      { code: 'BILLING_PROVIDER_ERROR', status: 502 },
      { code: 'NOT_FOUND', status: 404 },
      { code: 'NETWORK_ERROR', status: 0 },
      null,
      'boom',
    ]) {
      expect(classifyConsultationPayError(e).kind).toBe('error');
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
