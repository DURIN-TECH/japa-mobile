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
 * (functions/src/types/index.ts). `amount` is in kobo/cents — divide by 100
 * for the ₦ display value. Optional fields are only present on some txn types.
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
  amount: number; // In kobo/cents
  currency: string;

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
 * undefined) so callers can safely check `.length` for the demo fallback.
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
