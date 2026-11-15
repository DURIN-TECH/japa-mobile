// ─────────────────────────────────────────────────────────────────────────────
// useTransactions Hook
//
// React Query hook for fetching the applicant's transaction history from the
// backend API. Backs the Explorer → Payments screen (payments.tsx).
//
// Backend endpoint used:
//   GET /transactions?role=agent|owner|admin  → list transactions
//
// A client (the payer) is answered with the backend's `ClientTransaction`
// (functions/src/transactions/client-transaction.ts, japa#329): a
// field-by-field allow-list, NOT the stored `Transaction` document.
// `ApiTransaction` below mirrors exactly that key set. Dates are typed
// loosely (`unknown`) because the backend serializes Firestore `Timestamp`s
// inconsistently (ISO string | { _seconds } | epoch) — see liveDate.ts
// `toDate` for the normalization we apply when rendering.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import type { Money } from '@/types/money.type';

/**
 * One payment as its payer sees it: the backend's `ClientTransaction`
 * (japa#329). Nothing else is sent to a client. In particular there is NO
 * exchange rate of any kind on a transaction (no `fxRate`, no markup, no
 * `effectiveRate`), no Paystack reference, no agent id, no `metadata` and no
 * escrow bookkeeping, so none of those are typed here (japa#332).
 *
 * `amount` is minor units of `currency`: the amount ACTUALLY charged (kobo
 * for an NGN charge, cents for USD). Never divide by a literal 100: format
 * through `formatMoney`. Optional fields appear only when the row has them.
 */
export interface ApiTransaction {
  id: string;

  // `type` acts as the direction/category of the txn.
  type:
    | 'consultation_fee'
    | 'service_fee'
    | 'government_fee'
    | 'refund'
    | 'escrow_release'
    | 'withdrawal';

  // Lifecycle status of the transaction.
  status:
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'refunded'
    | 'held_in_escrow'
    | 'released';

  /** Human-readable label ("Consultation fee", ...). */
  description: string;
  /** The visa / service name, when the row carries one. */
  visaTypeName?: string;

  // ── What was charged, and the dollar price behind it ─────────────────────
  /** The amount actually charged, in minor units of its own currency. */
  amountCharged: Money;
  /** The dollar price (US cents); absent on a row never priced in dollars. */
  priceUsd?: Money;
  // Flat copies of the two figures above (what the Payments screen reads).
  /** Same as `amountCharged.amountMinor`. */
  amount: number;
  /** Same as `amountCharged.currency`. */
  currency: string;
  /** Same as `priceUsd.amountMinor`; absent when `priceUsd` is. */
  priceUsdCents?: number;

  /**
   * Which processor took the payment; turned into the method label
   * (liveTransactions.ts `METHOD_LABEL`). The name only, no provider ids.
   */
  paymentProvider: 'stripe' | 'paypal' | 'manual' | 'paystack';

  /** The client's application this payment belongs to, if any. */
  applicationId?: string;
  /** The consultation booking this payment is the fee of, if any. */
  consultationId?: string;

  // Serialized Firestore Timestamps — normalize via liveDate.ts `toDate`.
  createdAt: unknown;
  /** When the processor took the payment (consultation fees record it). */
  paidAt?: unknown;
}

/**
 * Fetch the current user's transaction history. Returns a bare array (never
 * undefined) so callers can safely check `.length` for the empty state.
 */
export function useTransactions() {
  return useQuery({
    queryKey: ['transactions'],
    queryFn: () =>
      apiService
        .get<ApiTransaction[]>('/transactions')
        .then((r) => r.data ?? []),
  });
}
