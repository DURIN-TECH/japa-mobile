/**
 * Consultation pay flow helpers (japa#183)
 *
 * The pay screen books FIRST (POST /consultations, no fee in the body): the
 * server prices the booking in the client's currency and LOCKS that quote for
 * 30 minutes. The screen then shows exactly the stored snapshot
 * (`chargedAmountMinor` in `chargedCurrency`, "$X.00" from `priceUsdCents`)
 * behind "Pay {amount}". A rate move after that changes nothing on screen:
 * these helpers only read the stored values, they never price anything.
 *
 * Everything here is pure (no React, no network) so it is unit-tested
 * directly; pay.tsx wires it to the hooks in useConsultations.ts.
 */

import type { ApiTimestamp, BookingSummary } from './useConsultations';
import { toDate } from '@/components/explorer/liveDate';
import {
  formatMoney,
  minorUnitFactor,
  usdCents,
} from '@/components/explorer/content';
import type { Money } from '@/types/money.type';

// ─────────────────────────────────────────────
// THE LOCKED QUOTE
// ─────────────────────────────────────────────

/** What the pay screen holds once a booking is priced. */
export interface LockedQuote {
  /** The booking id (for POST /consultations/:id/checkout). */
  consultationId: string;
  /** The locked amount the client pays (minor units + currency). */
  charged: Money;
  /** The agent's dollar fee (US cents). */
  usd: Money;
  /** Local units per 1 USD the server used; null when it sent none. */
  fxRate: number | null;
  /** When the lock ends, in SERVER milliseconds; null = no expiry known. */
  expiresAtMs: number | null;
  /**
   * Server clock minus device clock (ms), measured when the quote arrived,
   * so the countdown is not thrown off by a wrong device clock.
   */
  clockOffsetMs: number;
  /** The Paystack checkout to open, and its reference (for verify). */
  authorizationUrl: string | null;
  reference: string | null;
}

/** The snapshot fields a booking / summary may carry. */
type SnapshotSource = Pick<
  BookingSummary,
  | 'id'
  | 'priceUsdCents'
  | 'chargedCurrency'
  | 'chargedAmountMinor'
  | 'fxRate'
  | 'quoteExpiresAt'
> & { quoteLockedAt?: ApiTimestamp };

/**
 * Build the locked quote from a booking (POST /consultations) or a booking
 * summary (checkout / verify 409s). Null when the source has no usable
 * charge snapshot (e.g. a free booking, or a malformed response): the screen
 * then shows the unavailable state, never a ₦0 checkout.
 *
 * @param source     the booking or summary
 * @param checkout   the checkout that came with it
 * @param receivedAtMs device time when the response arrived
 * @param prevOffsetMs the offset measured earlier, used when this source has
 *                   no `quoteLockedAt` to measure a new one from
 */
export function lockedQuoteFrom(
  source: SnapshotSource | null | undefined,
  checkout: { authorizationUrl?: string | null; reference?: string | null },
  receivedAtMs: number,
  prevOffsetMs = 0,
): LockedQuote | null {
  if (!source?.id) return null;
  const amount = source.chargedAmountMinor;
  const currency = source.chargedCurrency;
  const usd = usdCents(source.priceUsdCents);
  if (
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    typeof currency !== 'string' ||
    !currency ||
    !usd
  ) {
    return null;
  }
  // The lock time is SERVER "now" at pricing, so it measures the offset.
  const lockedAt = toDate(source.quoteLockedAt ?? null)?.getTime();
  const expiresAt = toDate(source.quoteExpiresAt ?? null)?.getTime();
  return {
    consultationId: source.id,
    charged: { amountMinor: amount, currency },
    usd,
    fxRate:
      typeof source.fxRate === 'number' && Number.isFinite(source.fxRate)
        ? source.fxRate
        : null,
    expiresAtMs: expiresAt ?? null,
    clockOffsetMs:
      typeof lockedAt === 'number' ? lockedAt - receivedAtMs : prevOffsetMs,
    authorizationUrl: checkout.authorizationUrl ?? null,
    reference: checkout.reference ?? null,
  };
}

/**
 * Whole seconds left on the lock at device time `nowMs` (never negative), or
 * null when the server gave no expiry.
 */
export function quoteSecondsLeft(q: LockedQuote, nowMs: number): number | null {
  if (q.expiresAtMs === null) return null;
  const serverNow = nowMs + q.clockOffsetMs;
  return Math.max(0, Math.floor((q.expiresAtMs - serverNow) / 1000));
}

/** 1721 → "28:41" (minutes:seconds, tabular). */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** At or below this many seconds the countdown turns status-error-fg. */
export const COUNTDOWN_WARN_SECONDS = 5 * 60;

/**
 * "$35.00 at ₦1,353.97 per $1": the dollar price and the server's rate,
 * shown verbatim (the rate is FORMATTED in the charged currency, not used to
 * compute anything). Just "$35.00" when the server sent no rate.
 */
export function lockedRateLine(q: LockedQuote): string {
  const usd = formatMoney(q.usd);
  if (q.fxRate === null || q.charged.currency.toUpperCase() === 'USD') {
    return usd;
  }
  // A rate may carry more decimals than money: shown to the currency's own
  // decimals (₦1,353.97; a zero-decimal currency as a whole number). This
  // only formats the server's figure; nothing is multiplied by it.
  const rate = formatMoney({
    amountMinor: Math.round(q.fxRate * minorUnitFactor(q.charged.currency)),
    currency: q.charged.currency,
  });
  return `${usd} at ${rate} per $1`;
}

/** True when two quotes would charge a different amount or currency. */
export function chargeChanged(a: LockedQuote | null, b: LockedQuote): boolean {
  return (
    !a ||
    a.charged.amountMinor !== b.charged.amountMinor ||
    a.charged.currency !== b.charged.currency
  );
}

// ─────────────────────────────────────────────
// ERRORS FROM CREATE / CHECKOUT / VERIFY
// ─────────────────────────────────────────────

/** Copy (Seli voice, curly apostrophes). */
export const PAY_COPY = {
  pricingUnavailable:
    'We can’t price this booking right now. Nothing was charged. Try again in a moment.',
  inProgress:
    'Your payment is still being processed. Check again in a few minutes.',
  notPayable:
    'This booking can’t be paid any more. Try again to book a new slot.',
  opening: 'Your checkout is being prepared. Try again in a moment.',
  newPrice: 'Your price was refreshed. Check the new amount, then pay.',
  // ONLY for a checkout the backend says is genuinely unpaid.
  notCompleted:
    'We haven’t received your payment yet. Open checkout to finish paying.',
  expired: 'Your price has expired. Refresh to see today’s price.',
  // The booking call itself was refused (create 400): nothing exists to pay.
  bookingInvalid:
    'We couldn’t book this consultation. Nothing was charged. Go back and check your details, then try again.',
  // A payment landed that does not match the booking: NEVER ask to pay again.
  paymentReview:
    'We received a payment that doesn’t match this booking. Please don’t pay again. We’re checking it, and our support team will sort it out.',
  // The plan's monthly consultation limit (create 402): a retry cannot work.
  limitReached:
    'You’ve reached your plan’s monthly consultation limit. Upgrade your plan to book more.',
  // Verify was refused for a reason other than "not paid yet".
  unconfirmed:
    'We couldn’t confirm this payment. If you’ve already paid, don’t pay again: contact support and we’ll sort it out.',
  error: 'We couldn’t complete that. Nothing was charged. Try again.',
} as const;

/**
 * Which call failed. The backend reuses `VALIDATION_ERROR` (400) for very
 * different things, so the same code means something else per call:
 *  - `create`   POST /consultations: the booking was refused (e.g. the
 *               client has no email). No checkout exists yet;
 *  - `checkout` POST /consultations/:id/checkout (resume / re-price);
 *  - `verify`   POST /consultations/public/verify: "Payment has not been
 *               completed" (genuinely unpaid), or a reference problem.
 */
export type PayStage = 'create' | 'checkout' | 'verify';

/** How the screen should react to a failed create / checkout / verify. */
export type PayErrorVerdict =
  /** 503 PRICING_UNAVAILABLE: nothing written; show dollars only + retry. */
  | { kind: 'pricing_unavailable'; message: string }
  /** 409 PAYMENT_IN_PROGRESS: keep everything, do NOT reopen checkout. */
  | { kind: 'in_progress'; message: string }
  /** 409 QUOTE_EXPIRED / CHECKOUT_REPLACED: use the checkout in `data`. */
  | {
      kind: 'new_checkout';
      message: string;
      authorizationUrl: string | null;
      reference: string | null;
      consultation: BookingSummary | null;
    }
  /** 409 BOOKING_NOT_PAYABLE: the booking is closed; a retry books anew. */
  | { kind: 'not_payable'; message: string }
  /** 409 CHECKOUT_OPENING: another request is opening it; retry shortly. */
  | { kind: 'opening'; message: string }
  /** Verify 400 "Payment has not been completed": genuinely not paid yet. */
  | { kind: 'not_completed'; message: string }
  /** Create 400 VALIDATION_ERROR: the booking was refused; nothing to pay. */
  | { kind: 'booking_invalid'; message: string }
  /**
   * 400 PAYMENT_MISMATCH: the client PAID, but the amount / currency does
   * not match the stored charge. Terminal: no pay / retry control at all.
   */
  | { kind: 'payment_review'; message: string }
  /** Create 402 UPGRADE_REQUIRED: monthly plan limit. Terminal: no retry. */
  | { kind: 'limit_reached'; message: string }
  /**
   * Verify 400 for any other reason (e.g. the reference is not one of this
   * booking's checkouts, which can also be money we cannot place): we do
   * not know it is unpaid, so we never say "we haven't received it".
   */
  | { kind: 'unconfirmed'; message: string }
  /** Anything else (404, 502 BILLING_PROVIDER_ERROR, network, 5xx). */
  | { kind: 'error'; message: string };

/**
 * The backend's wording for a genuinely unpaid checkout on verify. It shares
 * the `VALIDATION_ERROR` code with the reference errors, so the message is
 * the only thing that tells them apart (follow-up: a code of its own).
 */
const UNPAID_MESSAGE = /has not been completed/i;

/**
 * Classify an `ApiError` (`{ code, message, status, data }`, api.service)
 * from one of the three calls. Matches on the backend's `code` (plus the
 * call it came from), never on a bare HTTP status, so a 400 that is not
 * "unpaid" can never show the "we haven't received your payment" copy.
 * Never throws, whatever it is given.
 *
 * @param error the thrown value
 * @param stage which call failed (see `PayStage`)
 */
export function classifyConsultationPayError(
  error: unknown,
  stage: PayStage,
): PayErrorVerdict {
  const e = (typeof error === 'object' && error !== null ? error : {}) as {
    code?: unknown;
    message?: unknown;
    status?: unknown;
    data?: unknown;
  };
  const code = typeof e.code === 'string' ? e.code : '';
  const message = typeof e.message === 'string' ? e.message : '';
  const status = typeof e.status === 'number' ? e.status : 0;

  if (code === 'PRICING_UNAVAILABLE' || status === 503) {
    return {
      kind: 'pricing_unavailable',
      message: PAY_COPY.pricingUnavailable,
    };
  }
  // The client paid something we will not accept: checked BEFORE any other
  // 400 so it can never fall into a "pay again" message.
  if (code === 'PAYMENT_MISMATCH') {
    return { kind: 'payment_review', message: PAY_COPY.paymentReview };
  }
  // Plan limit (`paymentRequired` → 402 UPGRADE_REQUIRED). Only create
  // checks the limit; a retry cannot succeed until the plan changes.
  if (code === 'UPGRADE_REQUIRED' || status === 402) {
    return { kind: 'limit_reached', message: PAY_COPY.limitReached };
  }
  if (code === 'PAYMENT_IN_PROGRESS') {
    return { kind: 'in_progress', message: PAY_COPY.inProgress };
  }
  if (code === 'QUOTE_EXPIRED' || code === 'CHECKOUT_REPLACED') {
    const data = (e.data ?? {}) as {
      authorizationUrl?: unknown;
      reference?: unknown;
      consultation?: unknown;
    };
    return {
      kind: 'new_checkout',
      message: PAY_COPY.newPrice,
      authorizationUrl:
        typeof data.authorizationUrl === 'string'
          ? data.authorizationUrl
          : null,
      reference: typeof data.reference === 'string' ? data.reference : null,
      consultation:
        data.consultation && typeof data.consultation === 'object'
          ? (data.consultation as BookingSummary)
          : null,
    };
  }
  if (code === 'BOOKING_NOT_PAYABLE') {
    return { kind: 'not_payable', message: PAY_COPY.notPayable };
  }
  if (code === 'CHECKOUT_OPENING') {
    return { kind: 'opening', message: PAY_COPY.opening };
  }
  if (code === 'VALIDATION_ERROR') {
    // Create: the booking itself was refused; there is no checkout to open.
    if (stage === 'create') {
      return { kind: 'booking_invalid', message: PAY_COPY.bookingInvalid };
    }
    if (stage === 'verify') {
      // Only "Payment has not been completed" is the unpaid case; any other
      // verify 400 is a reference problem we cannot call unpaid.
      return UNPAID_MESSAGE.test(message)
        ? { kind: 'not_completed', message: PAY_COPY.notCompleted }
        : { kind: 'unconfirmed', message: PAY_COPY.unconfirmed };
    }
  }
  return { kind: 'error', message: PAY_COPY.error };
}

/**
 * True only when a verify response BODY says the booking is paid (like
 * `isPaidResult` on the payment-request path): a 2xx alone is not proof.
 * The backend answers `{ verified: true, consultation }`; a paid booking may
 * also come back in the `{ requiresPayment: false, consultation }` shape,
 * whose summary carries `paymentStatus: 'paid'`.
 */
export function isBookingPaidResult(data: unknown): boolean {
  const d = (typeof data === 'object' && data !== null ? data : {}) as {
    verified?: unknown;
    consultation?: { paymentStatus?: unknown } | null;
  };
  return d.verified === true || d.consultation?.paymentStatus === 'paid';
}
