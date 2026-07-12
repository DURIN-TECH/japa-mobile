// ─────────────────────────────────────────────────────────────────────────────
// Live adapter — backend Transaction → Explorer `Payment`.
//
// The Payments screen (payments.tsx) renders the static `Payment` contract
// (title/sub/amount/date/status/method). This maps a live `ApiTransaction`
// (GET /transactions) onto that shape so the pixel-perfect UI can display real
// data with the demo `PAYMENTS` as a fallback.
//
// Key conversions:
//   • amount: backend is in kobo/cents → divide by 100 for the ₦ value.
//   • date: Firestore Timestamps are serialized inconsistently → normalize via
//     liveDate.ts `fmtDate` (`toDate`-safe).
//   • status: collapse the 7 backend statuses into the 3 Payment states.
// ─────────────────────────────────────────────────────────────────────────────

import type { Payment } from '@/components/explorer/data';
import type { ApiTransaction } from '@/hooks/useTransactions';
import { fmtDate } from '@/components/explorer/liveDate';

// Human-readable label for each transaction `type` — used to derive a title
// when the backend `description` is empty.
const TYPE_LABEL: Record<ApiTransaction['type'], string> = {
  consultation_fee: 'Consultation fee',
  service_fee: 'Application service fee',
  government_fee: 'Government fee',
  refund: 'Refund',
  escrow_release: 'Escrow release',
  withdrawal: 'Withdrawal',
};

// Friendly payment-method label from the processor. `manual` (bank
// transfer/escrow) has no card, so it reads as an em dash.
const METHOD_LABEL: Record<ApiTransaction['paymentProvider'], string> = {
  stripe: 'Card',
  paypal: 'PayPal',
  manual: '—',
};

// Collapse the backend's 7 statuses into the 3 Payment states the pills expect.
function mapStatus(status: ApiTransaction['status']): Payment['status'] {
  switch (status) {
    case 'completed':
    case 'released':
      return 'paid';
    case 'pending':
    case 'processing':
    case 'held_in_escrow':
      return 'pending';
    case 'refunded':
      return 'refunded';
    // failed / anything unexpected — default to 'paid' per the agreed mapping.
    default:
      return 'paid';
  }
}

// Map one live transaction onto the Explorer `Payment` row contract.
export function mapTransaction(t: ApiTransaction): Payment {
  return {
    id: t.id,
    // Prefer the backend description; fall back to a type-derived label.
    title: t.description || TYPE_LABEL[t.type] || 'Transaction',
    // Counterparty / context detail — visa type if denormalized, else the
    // transaction category label.
    sub: t.visaTypeName || TYPE_LABEL[t.type] || '',
    // kobo → naira.
    amount: Math.round(t.amount / 100),
    date: fmtDate(t.createdAt, 'MMM d'),
    status: mapStatus(t.status),
    method: METHOD_LABEL[t.paymentProvider] || '—',
  };
}
