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

import type {
  ApiConsultation,
  ApiTimestamp,
  BookingSummary,
} from './useConsultations';
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
 * @param lockIsFresh true (default) when the server locked this quote while
 *                   answering THIS request, so `quoteLockedAt` is "server
 *                   now" and measures the clock offset. Pass false for a
 *                   RESUMED booking (japa#288): its `quoteLockedAt` is when
 *                   the earlier booking was locked, minutes ago. Measuring
 *                   from it would shift the clock back by the booking's age
 *                   and restart the countdown at the full 30:00. Then
 *                   `prevOffsetMs` is used (0 = the device clock), and the
 *                   countdown runs to the booking's real `quoteExpiresAt`.
 */
export function lockedQuoteFrom(
  source: SnapshotSource | null | undefined,
  checkout: { authorizationUrl?: string | null; reference?: string | null },
  receivedAtMs: number,
  prevOffsetMs = 0,
  lockIsFresh = true,
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
  // The lock time is SERVER "now" at pricing, so it measures the offset,
  // but ONLY for a quote locked by this very request (see `lockIsFresh`).
  const lockedAt = lockIsFresh
    ? toDate(source.quoteLockedAt ?? null)?.getTime()
    : undefined;
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
  // The verify CALL failed (network / 5xx) after Paystack closed: we do not
  // know whether they paid, so never "Nothing was charged". The CTA becomes
  // "Check again", which re-verifies the SAME reference (no new checkout).
  verifyFailed:
    'We couldn’t check your payment just now. If you paid, don’t pay again. Tap Check again.',
  error: 'We couldn’t complete that. Nothing was charged. Try again.',
  // japa#288: the server handed back an EARLIER unpaid booking of this slot
  // whose topic or length is not what was just picked. Shown under the
  // summary card, which then lists that booking's own details.
  resumedDetails:
    'You’ve already started booking this slot. These are the details of that booking.',
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
  /**
   * 409 PAYMENT_IN_PROGRESS: keep everything, do NOT reopen checkout. Carries
   * the booking and its CURRENT checkout from `data` (japa#288), so a create
   * that ran into an earlier booking of the same slot can adopt it and offer
   * "Check again" on that reference instead of booking the slot twice.
   */
  | ({ kind: 'in_progress'; message: string } & ConflictCheckout)
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
  /**
   * 409 CHECKOUT_OPENING: another request is opening it; retry shortly.
   * `consultation` names the booking (japa#288): the retry goes through
   * POST /consultations/:id/checkout for THAT booking, never a new create.
   * No checkout exists yet, so `authorizationUrl` / `reference` are null.
   */
  | ({ kind: 'opening'; message: string } & ConflictCheckout)
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
 * What a 409's `data` may carry (backend `sendCheckoutConflict` /
 * CHECKOUT_OPENING): the booking's payer-safe summary and, when one exists,
 * the checkout to use. Every field is null when the backend sent none.
 */
export interface ConflictCheckout {
  authorizationUrl: string | null;
  reference: string | null;
  consultation: BookingSummary | null;
}

/**
 * Read `{ authorizationUrl, reference, consultation }` out of an error's
 * `data`, type-checking each field (never trusts the shape, never throws).
 * A `consultation` without a string `id` is useless to the caller (it cannot
 * name the booking), so it is dropped.
 */
function conflictCheckoutFrom(raw: unknown): ConflictCheckout {
  const data = (typeof raw === 'object' && raw !== null ? raw : {}) as {
    authorizationUrl?: unknown;
    reference?: unknown;
    consultation?: unknown;
  };
  const c = data.consultation;
  return {
    authorizationUrl:
      typeof data.authorizationUrl === 'string' ? data.authorizationUrl : null,
    reference: typeof data.reference === 'string' ? data.reference : null,
    consultation:
      c &&
      typeof c === 'object' &&
      typeof (c as { id?: unknown }).id === 'string' &&
      (c as { id: string }).id
        ? (c as BookingSummary)
        : null,
  };
}

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

  // ONLY the explicit code, never a bare 503: a 503 from the platform itself
  // (cold start, gateway) says nothing about pricing. On verify it must fall
  // to `error`, which the screen turns into "couldn’t check your payment…
  // Check again" (they may have paid), never "Nothing was charged".
  if (code === 'PRICING_UNAVAILABLE') {
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
    return {
      kind: 'in_progress',
      message: PAY_COPY.inProgress,
      ...conflictCheckoutFrom(e.data),
    };
  }
  if (code === 'QUOTE_EXPIRED' || code === 'CHECKOUT_REPLACED') {
    return {
      kind: 'new_checkout',
      message: PAY_COPY.newPrice,
      ...conflictCheckoutFrom(e.data),
    };
  }
  if (code === 'BOOKING_NOT_PAYABLE') {
    return { kind: 'not_payable', message: PAY_COPY.notPayable };
  }
  if (code === 'CHECKOUT_OPENING') {
    return {
      kind: 'opening',
      message: PAY_COPY.opening,
      ...conflictCheckoutFrom(e.data),
    };
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

// ─────────────────────────────────────────────
// RESUMED BOOKINGS (japa#288)
// ─────────────────────────────────────────────
//
// POST /consultations no longer books a slot twice. When the client already
// has an UNPAID pending booking with the same agent at the same date and
// time, the server answers 200 (not 201) with THAT booking in the create
// shape plus `resumed: true`. The app treats it exactly like a fresh create.
//
// DECISION (documented on the issue): the server matches on agent + date +
// time ONLY, not on consultation type or duration, and the app follows it.
// So a resumed booking may have a different type / length than the one just
// picked. The price is the same either way (the agent's fee does not depend
// on them), but the screen must show what is actually booked: the resumed
// booking's own type, duration and locked price, never the fresh pick.

/**
 * True when a POST /consultations answer is an earlier booking handed back
 * (`resumed: true`) rather than a new one. Matters in one place only: a
 * resumed booking with `requiresPayment: false` was PAID meanwhile (free
 * bookings are never resumed), so it must not be shown as "Free".
 */
export function isResumedBooking(res: unknown): boolean {
  return (
    typeof res === 'object' &&
    res !== null &&
    (res as { resumed?: unknown }).resumed === true
  );
}

/** What the user picked on the booking screen (route params). */
export interface PickedBooking {
  /** The free-text topic chip, e.g. "Document review". */
  topic: string;
  /** The backend type that topic maps to (what a create would send). */
  type: ApiConsultation['type'];
  /** The duration chip, e.g. "30 min". */
  durLabel: string;
}

/**
 * What the server says is booked. Both fields are optional: a 409's summary
 * carries `type` only, `durationMinutes` arrives with the full booking.
 */
export interface ActualBooking {
  type?: ApiConsultation['type'];
  durationMinutes?: number;
}

/**
 * The topic and duration lines the pay / confirmation screens show: the
 * user's own pick, unless the server's booking says otherwise (a resumed
 * booking, see the DECISION above). A field the server did not send keeps
 * the pick, so a fresh booking renders exactly as before.
 *
 * @param picked    the route params
 * @param actual    the booking as the server holds it (null = not known yet)
 * @param typeLabel maps a backend type to its label (`getConsultationTypeLabel`;
 *                  passed in so this file stays free of the API client)
 * @returns `differs` is true when either line was replaced
 */
export function bookingDisplay(
  picked: PickedBooking,
  actual: ActualBooking | null | undefined,
  typeLabel: (type: ApiConsultation['type']) => string,
): { topic: string; dur: string; differs: boolean } {
  // Topic: the picked chip text is nicer than a category label, so it stays
  // whenever it maps to the SAME type the booking has.
  const typeDiffers = !!actual?.type && actual.type !== picked.type;
  // Duration: compared as whole minutes ("30 min" → 30).
  const pickedMinutes = parseInt(picked.durLabel, 10);
  const minutes = actual?.durationMinutes;
  const durDiffers =
    typeof minutes === 'number' &&
    Number.isFinite(minutes) &&
    minutes > 0 &&
    minutes !== pickedMinutes;
  return {
    topic: typeDiffers ? typeLabel(actual!.type!) : picked.topic,
    dur: durDiffers ? `${minutes} min` : picked.durLabel,
    differs: typeDiffers || durDiffers,
  };
}
