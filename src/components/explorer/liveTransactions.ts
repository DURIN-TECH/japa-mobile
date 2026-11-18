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

// Collapse the backend's 7 statuses into the 4 Payment states the pills expect.
// Exported for its unit tests.
export function mapStatus(status: ApiTransaction['status']): Payment['status'] {
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
    status: mapStatus(t.status),
    method: METHOD_LABEL[t.paymentProvider] || '—',
  };
}

// ── Total paid — one sum PER CURRENCY of every `paid` row ───────────────────
// Minor units of different currencies are never added together: the result is
// one Money per currency, in first-seen order. Only `paid` rows count; failed,
// pending and refunded rows are skipped (japa#353).
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
