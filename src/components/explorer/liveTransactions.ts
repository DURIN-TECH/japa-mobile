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
//     A `refund` row is never `paid` (japa#398) and has its own states
//     (japa#356): on its way → "Refund pending", done → "Refunded", failed
//     or held → "Refund delayed", closed → "No refund due". The server's
//     `refundState` (#413 H) is read first; the raw status is the fallback.
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
  // japa#356: and never "Failed" or a bare "Pending" either; a refund has
  // its own pills (PAY_STATUS refund_*). This is the status-only fallback
  // for a row the server sent no `refundState` on (see `refundRowStatus`).
  if (type === 'refund') {
    switch (status) {
      // Money is back with the user: the grey "Refunded" pill.
      case 'completed':
      case 'released':
      case 'refunded':
        return 'refunded';
      // It failed (a held refund is mirrored as failed too): "Refund
      // delayed", because Seli is still on it. Never "Failed".
      case 'failed':
        return 'refund_delayed';
      // #413 B: an admin closed a held refund with nothing to give back.
      case 'closed':
        return 'refund_none_due';
      // pending / processing / held_in_escrow, and anything unknown
      // (japa#356: an unknown status is "Refund pending").
      default:
        return 'refund_pending';
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

// ── Refund rows: the server's own reading first (japa#356) ──────────────────
// `refundState` (backend #413 H) is worked out from fields the client never
// sees (a HELD refund is `failed`-looking internally but reads `delayed`), so
// it wins over the raw status. A row without it (an older backend) falls back
// to the status-only rule in `mapStatus`.
const REFUND_STATE_STATUS: Record<
  NonNullable<ApiTransaction['refundState']>,
  Payment['status']
> = {
  on_its_way: 'refund_pending',
  refunded: 'refunded',
  delayed: 'refund_delayed',
  none_due: 'refund_none_due',
};

/**
 * The Payments pill of a `refund` row (japa#356). Never `paid`, never
 * `failed`. Exported for its unit tests and the consultation refund card.
 */
export function refundRowStatus(
  t: Pick<ApiTransaction, 'status' | 'refundState'>,
): Payment['status'] {
  const fromState = t.refundState
    ? REFUND_STATE_STATUS[t.refundState]
    : undefined;
  return fromState ?? mapStatus(t.status, 'refund');
}

/**
 * Whether a refund row's `amount` is a real refund amount (japa#356). A HELD
 * row and a closed `none_due` row carry 0, which must never read "+₦0.00"
 * (backend #413 H). Only a positive amount is shown.
 */
export function hasRefundAmount(t: Pick<ApiTransaction, 'amount'>): boolean {
  return typeof t.amount === 'number' && Number.isFinite(t.amount) && t.amount > 0;
}

// Map one live transaction onto the Explorer `Payment` row contract.
export function mapTransaction(t: ApiTransaction): Payment {
  // japa#356: a refund is its own row: "Consultation refund" (unless the
  // backend sent a description, e.g. #354's "Refund: consultation payment
  // that could not be applied"), sub "Refund", its OWN amount (what the
  // backend sends, never worked out here), no dollar line, and a refund pill.
  if (t.type === 'refund') {
    return {
      id: t.id,
      title: t.description || 'Consultation refund',
      sub: 'Refund',
      amount: { amountMinor: t.amount, currency: t.currency || 'NGN' },
      usd: null,
      date: fmtDate(t.createdAt, 'MMM d'),
      status: refundRowStatus(t),
      method: METHOD_LABEL[t.paymentProvider] || '—',
      isRefund: true,
    };
  }
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
