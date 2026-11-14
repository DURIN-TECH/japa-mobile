/**
 * Payment-request checkout helpers (japa#145)
 *
 * The client pays an agent-raised payment request in two backend steps:
 *   1. PUT  /payment-requests/:id/approve → `{ ...request, authorizationUrl,
 *      paystackReference }`; the app opens `authorizationUrl` (Paystack).
 *   2. POST /payment-requests/:id/verify  → the request with `status: 'paid'`
 *      once Paystack confirms the charge, otherwise the request plus a
 *      `paymentStatus` (abandoned / failed) with HTTP 200.
 *
 * So "the call succeeded" is NOT "the money landed": the confirmation may only
 * be shown when `isPaidResult` is true. These helpers are pure so they are
 * unit-tested directly.
 */

import { formatMoney, priceParts, type PriceParts } from '@/components/explorer/content';
import type { PaymentRequest } from '@/types/payment-requests.type';

/** The Paystack checkout URL from an approve response, or null if unusable. */
export function getAuthorizationUrl(data: unknown): string | null {
  const url = (data as { authorizationUrl?: unknown } | null | undefined)
    ?.authorizationUrl;
  // https only: never hand a malformed/other-scheme string to Linking.
  return typeof url === 'string' && /^https:\/\//i.test(url) ? url : null;
}

/** The Paystack reference from an approve response / request, or null. */
export function getPaystackReference(data: unknown): string | null {
  const ref = (data as { paystackReference?: unknown } | null | undefined)
    ?.paystackReference;
  return typeof ref === 'string' && ref.length > 0 ? ref : null;
}

/** True only when a verify response says the request is settled. */
export function isPaidResult(data: unknown): boolean {
  return (data as { status?: unknown } | null | undefined)?.status === 'paid';
}

/** User-facing copy when verify answered but the charge isn't paid. */
export const NOT_PAID_MESSAGE =
  'We haven’t received your payment yet. If you cancelled, open checkout again to finish paying.';

/** User-facing copy when a payment-request call itself failed. */
export const PAYMENT_ERROR_MESSAGE =
  'We couldn’t complete that. Nothing was charged. Try again.';

/** Copy when approve answers 409 REQUEST_NOT_PAYABLE (the agent cancelled it). */
export const REQUEST_NOT_PAYABLE_MESSAGE =
  'This request can’t be paid any more. Your agent may have cancelled it.';

/**
 * A payment request's price for display (japa#183):
 *  - pending (no `charge` yet): the dollar price only, "$100.00"; the app
 *    never converts, the local amount comes with approve;
 *  - approved (priced, not paid): "₦150,000 · about $100";
 *  - paid: exact, "₦150,000.00 · $100.00";
 *  - legacy (`legacy: true`, or no dollar price): its own `amount` +
 *    `currency` through the same formatter.
 */
export function paymentRequestParts(
  r: Pick<
    PaymentRequest,
    'amount' | 'currency' | 'priceUsd' | 'legacy' | 'charge' | 'status'
  >,
): PriceParts {
  const own: PriceParts = {
    primary: formatMoney({ amountMinor: r.amount, currency: r.currency }),
    secondary: null,
    free: false,
    localUnavailable: false,
  };
  if (r.legacy || !r.priceUsd) return own;
  return priceParts(r.charge ?? null, r.priceUsd, {
    locked: r.status === 'paid',
  });
}
