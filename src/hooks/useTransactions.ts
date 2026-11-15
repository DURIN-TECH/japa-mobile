// ─────────────────────────────────────────────────────────────────────────────
// useTransactions Hook
//
// React Query hook for fetching the applicant's transaction history from the
// backend API. Backs the Explorer → Payments screen (payments.tsx).
//
// Backend endpoint used:
//   GET /transactions?role=agent|owner|admin  → list transactions
//
// The controller (transaction.controller.ts) returns the full backend
// `Transaction` documents. `ApiTransaction` below mirrors that shape, but with
// dates typed loosely (`unknown`) because the backend serializes Firestore
// `Timestamp`s inconsistently (ISO string | { _seconds } | epoch) — see
// liveDate.ts `toDate` for the normalization we apply when rendering.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';

/**
 * Transaction shape matching the backend `Transaction` interface
 * (functions/src/types/index.ts). `amount` is minor units of `currency`: the
 * amount ACTUALLY charged (kobo for an NGN charge, cents for USD). japa#183:
 * a priced charge also carries its snapshot (`priceUsdCents` = the dollar
 * price, `chargedCurrency` / `chargedAmountMinor` repeat the charge, `fxRate`).
 * Never divide by a literal 100: format through `formatMoney`.
 * Optional fields are only present on some txn types.
 */
export interface ApiTransaction {
  id: string;
  userId: string;
  agentId?: string;
  applicationId?: string;
  consultationId?: string;

  // Payment details — `type` acts as the direction/category of the txn.
  type:
    | 'consultation_fee'
    | 'service_fee'
    | 'government_fee'
    | 'refund'
    | 'escrow_release'
    | 'withdrawal';
  /** Minor units of `currency` (what was actually charged). */
  amount: number;
  currency: string;
  // ── Charge snapshot (japa#183; absent on older transactions) ──────────────
  /** The dollar price behind this charge, in US cents. */
  priceUsdCents?: number;
  chargedCurrency?: string;
  chargedAmountMinor?: number;
  /** Local units per 1 USD used for the charge. */
  fxRate?: number;

  // Lifecycle status of the transaction.
  status:
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'refunded'
    | 'held_in_escrow'
    | 'released';

  // Escrow / processor bookkeeping.
  isEscrow: boolean;
  paymentProvider: 'stripe' | 'paypal' | 'manual';
  providerTransactionId?: string;

  // Human-readable label + free-form metadata bag.
  description: string;
  metadata?: Record<string, unknown>;

  // Denormalized fields (present for read performance).
  clientName?: string;
  clientEmail?: string;
  visaTypeName?: string;

  // Serialized Firestore Timestamps — normalize via liveDate.ts `toDate`.
  createdAt: unknown;
  updatedAt: unknown;
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
