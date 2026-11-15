// ─────────────────────────────────────────────────────────────────────────────
// Profile tab row values (japa#346).
//
// Pure formatters for the counts on the Profile menu rows. The rule from
// japa#145: a count whose source has not answered (or failed, or is known to
// be incomplete) shows "–", never a made-up number.
// ─────────────────────────────────────────────────────────────────────────────

import type { ApiTransaction } from '@/hooks/useTransactions';

/** The "unknown" value: an en dash (U+2013), as on every other Profile row. */
export const UNKNOWN_VALUE = '–';

// ── My documents ─────────────────────────────────────────────────────────────

/** "0 files" · "1 file" · "N files"; null/undefined (unknown) → "–". */
export function fileCountLabel(count: number | null | undefined): string {
  if (count == null) return UNKNOWN_VALUE;
  return `${count} ${count === 1 ? 'file' : 'files'}`;
}

// ── Payments ─────────────────────────────────────────────────────────────────

/**
 * Backend statuses that mean the money actually moved: `completed`, and
 * `released` (an escrowed payment paid out). `failed`, `pending`,
 * `processing`, `held_in_escrow` and `refunded` are not counted.
 */
const PAID_STATUSES: ReadonlySet<ApiTransaction['status']> = new Set([
  'completed',
  'released',
]);

/** How many of the user's payments completed. */
export function paidCount(txns: Pick<ApiTransaction, 'status'>[]): number {
  return txns.filter((t) => PAID_STATUSES.has(t.status)).length;
}

/**
 * "N paid" for the Payments row; unknown → "–". Deliberately no money amount:
 * the user's payments can be in more than one currency (japa#178), and the
 * Payments screen already shows the per-currency totals.
 */
export function paidLabel(
  txns: Pick<ApiTransaction, 'status'>[] | null | undefined,
): string {
  if (!txns) return UNKNOWN_VALUE;
  return `${paidCount(txns)} paid`;
}

// ── Subscription ─────────────────────────────────────────────────────────────

/** The plan's name, or "–" while it isn't known. */
export function planNameLabel(name: string | null | undefined): string {
  return name ? name : UNKNOWN_VALUE;
}
