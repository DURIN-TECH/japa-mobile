// ─────────────────────────────────────────────────────────────────────────────
// Live adapter — backend Transaction → Explorer `Payment`.
//
// The Payments screen (payments.tsx) renders the static `Payment` contract
// (title/sub/amount/date/status/method). This maps a live `ApiTransaction`
// (GET /transactions) onto that shape so the pixel-perfect UI can display real
// data.
//
// Key conversions:
//   • amount (japa#183): kept as Money (minor units + its own currency, the
//     amount actually charged), never flattened to a naira number; the
//     dollar price comes from `priceUsdCents` when the backend sent it.
//   • date: Firestore Timestamps are serialized inconsistently → normalize via
//     liveDate.ts `fmtDate` (`toDate`-safe).
//   • status: collapse the 7 backend statuses into the 4 Payment states
//     (japa#353: `failed` is its own state; an unknown status is `pending`).
//     A `refund` row is never `paid` (japa#398): done → Refunded, in flight →
//     Pending, failed → Failed.
//   • countsAsPaid: the one "this is a payment the user made" rule, shared
//     with Profile's `paidCount` so both screens count the same rows.
//   • totalsPaid: the "Total paid" hero sum, one Money per currency, of the
//     `paid` rows only (japa#353: failed charges never count).
// ─────────────────────────────────────────────────────────────────────────────

import type { Payment } from '@/types/explorer.type';
import type { Money } from '@/types/money.type';
import type { ApiTransaction } from '@/hooks/useTransactions';
import { fmtDate } from '@/components/explorer/liveDate';
import { usdCents } from '@/components/explorer/content';

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
// transfer/escrow) has no card, so it reads as an em dash. Paystack is the
// processor every checkout in the app goes through today; its rows read
// "Paystack" (the same word the confirmation screen uses), not "Card",
// because a Paystack checkout can also be paid by bank transfer or USSD and
// the row does not say which (japa#332; these rows used to show "—").
const METHOD_LABEL: Record<ApiTransaction['paymentProvider'], string> = {
  stripe: 'Card',
  paypal: 'PayPal',
  paystack: 'Paystack',
  manual: '—',
};

// ── "Counts as paid": the ONE rule (japa#398) ───────────────────────────────
// Backend statuses that mean the money actually moved: `completed`, and
// `released` (an escrowed payment paid out). `failed`, `pending`,
// `processing`, `held_in_escrow` and `refunded` never count.
const PAID_STATUSES: ReadonlySet<ApiTransaction['status']> = new Set([
  'completed',
  'released',
]);

/**
 * Does this transaction count as a payment the user made? The single
 * predicate behind BOTH the Payments screen (`mapStatus` → `paid` →
 * `totalsPaid`) and the Profile "N paid" row (`paidCount` in
 * profileLogic.ts), so the two screens can never disagree (japa#398).
 *
 * A `refund` row is money coming BACK to the user, not a payment they made,
 * so it never counts, whatever its own status (a completed refund is
 * `completed` on the backend). `escrow_release` and `withdrawal` rows keep
 * the status-only rule they always had.
 */
export function countsAsPaid(
  t: Pick<ApiTransaction, 'status' | 'type'>,
): boolean {
  return t.type !== 'refund' && PAID_STATUSES.has(t.status);
}

// Collapse the backend's 7 statuses into the 4 Payment states the pills expect.
// `type` is required (japa#398): `paid` can only come from `countsAsPaid`,
// which needs the type to rule refunds out. Exported for its unit tests.
export function mapStatus(
  status: ApiTransaction['status'],
  type: ApiTransaction['type'],
): Payment['status'] {
  // `paid` comes ONLY from the shared rule, so a Payments row is `paid`
  // exactly when Profile counts it. Guarded by the agreement test.
  if (countsAsPaid({ status, type })) return 'paid';

  // ── Refund rows (japa#398) — never `paid` ──
  if (type === 'refund') {
    switch (status) {
      // Money is back with the user: the existing grey "Refunded" pill, with
      // the muted, struck-through amount every refunded row gets.
      case 'completed':
      case 'released':
      case 'refunded':
        return 'refunded';
      // Still in flight, or it failed: saying "Refunded" would tell the
      // client the money is back before it is (PM default, japa#398).
      case 'failed':
        return 'failed';
      // pending / processing / held_in_escrow, and anything unknown.
      default:
        return 'pending';
    }
  }

  // ── Every other row: unchanged since japa#353 ──
  // `completed` / `released` never get here: `countsAsPaid` above already
  // returned `paid` for them, so this switch has no `paid` branch.
  switch (status) {
    case 'pending':
    case 'processing':
    case 'held_in_escrow':
      return 'pending';
    case 'refunded':
      return 'refunded';
    // japa#353: a failed charge is shown as "Failed", never as "Paid".
    case 'failed':
      return 'failed';
    // Anything unexpected → 'pending' (japa#353). An unknown status is most
    // likely a new in-progress state on the backend; "Pending" claims neither
    // that money moved (unlike "Paid") nor that it did not (unlike "Failed",
    // which would alarm a client whose payment may have gone through), and
    // pending rows are already left out of "Total paid".
    default:
      return 'pending';
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
    // What was charged, in its own currency (₦50,000 = 5,000,000 kobo).
    amount: { amountMinor: t.amount, currency: t.currency || 'NGN' },
    // Its dollar price, when the charge was priced from one.
    usd: usdCents(t.priceUsdCents),
    date: fmtDate(t.createdAt, 'MMM d'),
    // Pass the type too: a refund row is never `paid` (japa#398).
    status: mapStatus(t.status, t.type),
    method: METHOD_LABEL[t.paymentProvider] || '—',
  };
}

// ── Total paid — one sum PER CURRENCY of every `paid` row ───────────────────
// Minor units of different currencies are never added together: the result is
// one Money per currency, in first-seen order. Only `paid` rows count; failed,
// pending and refunded rows are skipped (japa#353). A row is `paid` only when
// `countsAsPaid` says so (via `mapStatus`), so refund rows never reach this
// sum (japa#398).
export function totalsPaid(
  rows: Pick<Payment, 'status' | 'amount'>[],
): Money[] {
  const byCurrency = new Map<string, number>();
  for (const p of rows) {
    if (p.status !== 'paid') continue;
    const c = p.amount.currency;
    byCurrency.set(c, (byCurrency.get(c) ?? 0) + p.amount.amountMinor);
  }
  return [...byCurrency].map(([currency, amountMinor]) => ({
    amountMinor,
    currency,
  }));
}
