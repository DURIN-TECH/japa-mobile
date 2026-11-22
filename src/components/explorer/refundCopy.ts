// ─────────────────────────────────────────────────────────────────────────────
// Refund and "meeting didn't happen" copy for the consultation screen
// (japa#356, japa#442). Pure: no React, no network, so every sentence is
// unit-tested.
//
// MONEY RULE: every amount here comes from the server as `Money` and goes
// through `formatMoney` with its default EXACT formatting ("₦8,124.37"; never
// `whole`, never rounded). Nothing is added, subtracted or estimated on the
// device: the backend decides refundability, the amount and the processing
// fee (`cancellationRefund`, the cancel answer's `refund`, the refund row).
//
// Copy follows the design spec on japa#356 (curly apostrophes, Seli voice,
// "consultation"). The #442 sentences had no design spec when this was built;
// they follow the system's voice and are listed in the build report.
// ─────────────────────────────────────────────────────────────────────────────

import { PAY_STATUS, formatMoney } from './content';
import { EX } from './theme';
import { formatCutoff } from './zoneTime';
import type {
  ApiConsultation,
  CancellationRefundPreview,
  NoShowReport,
  RefundSummary,
} from '@/hooks/useConsultations';
import type { Money } from '@/types/money.type';

/** A Money that is really there and above zero (a fee of 0 is "no fee"). */
function positive(m: Money | null | undefined): m is Money {
  return (
    !!m &&
    typeof m.amountMinor === 'number' &&
    Number.isFinite(m.amountMinor) &&
    m.amountMinor > 0 &&
    typeof m.currency === 'string' &&
    !!m.currency
  );
}

// ── 1. Cancel confirm ────────────────────────────────────────────────────────

/** Native confirm alert content: title, message, destructive button label. */
export interface CancelConfirmCopy {
  title: string;
  message: string;
  /** "Cancel consultation", or "Cancel without refund" (case E). */
  destructive: string;
}

const RELEASE = 'This will release your booked slot.';

/**
 * The cancel confirm (design spec japa#356 §1), from the server's preview
 * only. Cases:
 *  A. no preview (free / unpaid / already cancelled): today's copy;
 *  B. refundable, amount, fee > 0: amount back + the fee the provider keeps;
 *  C. refundable, amount, no fee: amount back;
 *  D. refundable, amount null. The backend sends null in two cases
 *     (consultation-refund.service.ts `cancellationRefundPreview`):
 *     D1. fee not known yet (`processingFee: null`): "minus the processing
 *         fee, we'll confirm", and NO figure (never the full price);
 *     D2. fee KNOWN and at least the charge (`processingFee` set): nothing
 *         comes back, so say so plainly (review fix) and label the button
 *         "Cancel without refund", as E does;
 *  E. not refundable: no refund, with the cut-off on the PHONE'S OWN clock
 *     and no zone label (user decision 2026-11-22, zoneTime.ts).
 *
 * @param preview `cancellationRefund` from GET /consultations/:id
 */
export function cancelConfirmCopy(
  preview: CancellationRefundPreview | null | undefined,
  /** The phone's zone; tests only (defaults to the real one). */
  device?: string | null,
): CancelConfirmCopy {
  const title = 'Cancel consultation?';
  // A. Nothing to say about refunds.
  if (!preview) {
    return {
      title,
      message: `${RELEASE} You can rebook anytime.`,
      destructive: 'Cancel consultation',
    };
  }
  // E. Inside 24 hours: say clearly there is no refund, BEFORE they confirm.
  if (!preview.refundable) {
    // The phone's own clock, no zone label.
    const cutoff = formatCutoff(preview.refundableUntil, device);
    const closed = cutoff ? ` Refunds closed at ${cutoff}.` : '';
    return {
      title,
      message: `It’s less than 24 hours before your consultation, so cancelling now won’t give you a refund.${closed}`,
      destructive: 'Cancel without refund',
    };
  }
  // D2. The fee is known and covers the whole charge: nothing comes back.
  // Never promise money that won't arrive.
  if (!positive(preview.amount) && positive(preview.processingFee)) {
    return {
      title,
      message: `${RELEASE} The payment provider’s processing fee covers the whole payment, so there’s nothing to refund.`,
      destructive: 'Cancel without refund',
    };
  }
  // D1. Refundable, but the provider's fee is not known yet: no figure.
  if (!positive(preview.amount)) {
    return {
      title,
      message: `${RELEASE} You’ll get your payment back, minus the payment provider’s processing fee. We’ll confirm the exact amount.`,
      destructive: 'Cancel consultation',
    };
  }
  // B / C. The amount the server gives, plus the fee when there is one.
  const back = `You’ll get ${formatMoney(preview.amount)} back.`;
  const fee = positive(preview.processingFee)
    ? ` The payment provider keeps a processing fee of ${formatMoney(preview.processingFee)}.`
    : '';
  return {
    title,
    message: `${RELEASE} ${back}${fee}`,
    destructive: 'Cancel consultation',
  };
}

// ── 2. Cancel result ─────────────────────────────────────────────────────────

/** Title of the alert shown once the cancel went through. */
export const CANCEL_RESULT_TITLE = 'Consultation cancelled';

/** Unchanged since before japa#356. */
export const CANCEL_ERROR =
  'We couldn’t cancel your consultation. Try again in a moment.';

/**
 * Whether the booking was paid with money before the cancel, so a `refund:
 * null` answer means "no refund" rather than "free". True when the server
 * sent a cancel preview (it only does for paid bookings), or the booking is
 * marked paid with a dollar price above 0.
 */
export function wasPaidBooking(
  c: Partial<
    Pick<
      ApiConsultation,
      'cancellationRefund' | 'paymentStatus' | 'priceUsdCents'
    >
  >,
): boolean {
  if (c.cancellationRefund) return true;
  return (
    c.paymentStatus === 'paid' &&
    typeof c.priceUsdCents === 'number' &&
    c.priceUsdCents > 0
  );
}

/**
 * The result message (design spec japa#356 §2), from the PUT answer's
 * `refund`, NOT the preview: if the 24-hour line passed while the screen was
 * open, the client is told what actually happened.
 *
 * @param refund  the answer's `refund` (undefined = an older backend: treated
 *                as null)
 * @param wasPaid `wasPaidBooking` of the booking as it was before the cancel
 */
export function cancelResultMessage(
  refund: RefundSummary | null | undefined,
  wasPaid: boolean,
): string {
  if (refund) {
    // Held while the processing fee is confirmed (#390): no figure.
    if (!positive(refund.amount)) {
      return 'Your refund is delayed while we confirm the payment provider’s processing fee. We’re on it.';
    }
    const fee = positive(refund.processingFee)
      ? ` The payment provider kept a processing fee of ${formatMoney(refund.processingFee)}.`
      : '';
    return `Your refund of ${formatMoney(refund.amount)} is on its way.${fee}`;
  }
  return wasPaid
    ? 'Your slot is released. As it was less than 24 hours before your consultation, there’s no refund.'
    : 'Your slot is released.';
}

// ── 3. Refund card ───────────────────────────────────────────────────────────

/**
 * Pill colours: the system's status pairs, READ from their one source (review
 * fix), never copied: PAY_STATUS for the refund pills (warning / neutral /
 * error) and EX.status for the report pills (review / approved).
 */
const pair = (p: { fg: string; bg: string }) => ({ fg: p.fg, bg: p.bg });
const WARNING = pair(PAY_STATUS.refund_pending);
const NEUTRAL = pair(PAY_STATUS.refunded);
const ERROR = pair(PAY_STATUS.refund_delayed);

/** The refund card's pill and body line. */
export interface RefundCardCopy {
  pill: { label: string; fg: string; bg: string };
  body: string;
}

/**
 * The refund card on a booking (design spec japa#356 §3). Null when the
 * booking has no `refundStatus` (no card at all).
 *
 * @param refundStatus the booking's `refundStatus`
 * @param amount       the refund's own amount from its `GET /transactions`
 *                     row, or null when there is no row (yet), the row is
 *                     held (0), or it cannot be told apart from another
 *                     refund of the same booking. Null drops the figure;
 *                     the card never waits for it.
 */
export function refundCardCopy(
  refundStatus: ApiConsultation['refundStatus'],
  amount: Money | null,
): RefundCardCopy | null {
  switch (refundStatus) {
    case 'pending':
    case 'processing':
      return {
        pill: { label: 'Refund on its way', ...WARNING },
        body: positive(amount)
          ? `Your refund of ${formatMoney(amount)} is on its way to the card or account you paid with. Your bank may take a few days to show it.`
          : 'Your refund is on its way to the card or account you paid with.',
      };
    case 'completed':
      return {
        pill: { label: 'Refunded', ...NEUTRAL },
        body: positive(amount)
          ? `We’ve sent ${formatMoney(amount)} back to the card or account you paid with.`
          : 'We’ve sent your refund back to the card or account you paid with.',
      };
    case 'failed':
      // Includes a HELD refund (#390: the fee is not known yet).
      return {
        pill: { label: 'Refund delayed', ...ERROR },
        body: 'Your refund is taking longer than usual. We’re on it, and we’ll let you know when it’s sent.',
      };
    case 'closed':
      // #413 B: an admin closed a held refund because the payment
      // provider's fee was the whole payment. Not in the design spec
      // (assumption, reported on the issue).
      return {
        pill: { label: 'No refund due', ...NEUTRAL },
        body: 'The payment provider kept the whole payment as its processing fee, so there’s nothing to refund.',
      };
    default:
      return null;
  }
}

// ── 4. "The meeting didn't happen" (japa#442) ────────────────────────────────

/** The action's label on the booking screen. */
export const NO_SHOW_ACTION = 'The meeting didn’t happen';

/** The confirm step: what happens next, in Seli's voice. */
export const NO_SHOW_CONFIRM = {
  title: 'Tell us the meeting didn’t happen',
  body: 'Seli will look into it. We’ll pause your agent’s payment while we do, and let you know what we find.',
  notePlaceholder: 'Add a short note (optional)',
  send: 'Send report',
  back: 'Not now',
} as const;

/** Offline: nothing is sent. */
export const NO_SHOW_OFFLINE =
  'You’re offline, so we couldn’t send your report. Reconnect and try again.';

/** Any other failure with no message from the server. */
export const NO_SHOW_ERROR =
  'We couldn’t send your report. Try again in a moment.';

/** The report card on a booking, from its `noShowReport` status. */
export function noShowReportCopy(
  report: NoShowReport | null | undefined,
): RefundCardCopy | null {
  switch (report?.status) {
    case 'open':
      return {
        // status-review pair (blue), as "Under review" elsewhere in the app.
        pill: { label: 'Under review', ...pair(EX.status.review) },
        body: 'You told us the meeting didn’t happen. Seli is looking into it, and your agent’s payment is paused until we let you know.',
      };
    case 'refunded':
      return {
        pill: { label: 'Resolved', ...pair(EX.status.approved) },
        body: 'Seli confirmed the meeting didn’t happen, so we’re refunding your payment in full.',
      };
    case 'released':
      return {
        pill: { label: 'Resolved', ...NEUTRAL },
        body: 'Seli found the meeting took place, so there’s no refund.',
      };
    default:
      return null;
  }
}
