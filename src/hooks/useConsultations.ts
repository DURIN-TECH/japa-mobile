/**
 * useConsultations Hook
 *
 * React Query hooks for fetching consultation data from the backend API.
 * REPLACES the previous mock-based implementation that returned hardcoded
 * MOCK_CONSULTATIONS with a 1-second artificial delay.
 *
 * Backend endpoints used:
 * - GET /consultations           → list user's consultations (paginated)
 * - GET /consultations/:id       → single consultation detail
 * - POST /consultations          → create/book a new consultation; the server
 *                                   prices it and LOCKS the quote (japa#183).
 *                                   Hands back the client's unpaid booking of
 *                                   the same slot instead of a duplicate
 *                                   (200, `resumed: true`, japa#288)
 * - POST /consultations/:id/checkout → resume paying a pending booking
 * - POST /consultations/public/verify → confirm a Paystack charge by reference
 * - PUT /consultations/:id/status → update status (cancel, complete, etc.);
 *                                   a cancel answers with the refund outcome
 *                                   (`refund`, japa#356)
 * - POST /consultations/:id/no-show-report → the client says the meeting did
 *                                   not happen (japa#442, backend #382)
 *
 * MONEY (japa#183): the app never sends a fee, amount, currency or rate. The
 * server reads the agent's dollar fee, quotes it in the client's currency,
 * stores the snapshot (`priceUsdCents`, `chargedCurrency`,
 * `chargedAmountMinor`) and locks it for 30 minutes
 * (`quoteLockedAt` → `quoteExpiresAt`). The app shows those stored values.
 *
 * RATE (japa#332): a client is never sent the raw exchange rate (`fxRate`)
 * or Seli's markup. Every response carries `effectiveRate` instead: local
 * units per 1 USD, amount charged ÷ dollar price, markup included. That is
 * the rate behind "$6.00 at ₦1,353.97 per $1". It is absent on a free
 * booking and on a legacy one with no complete charge.
 *
 * The backend Consultation type has more fields than the mobile app's
 * original `Consultation` type. We map the API response to a richer
 * `ApiConsultation` type that includes scheduling, payment, and duration.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { retryUnlessNotFound } from './queryErrors';
import { RETURN_TO_APP } from '@/hooks/paystackCheckout';
import { apiService } from '@/services/api.service';
import { tracked } from '@/utils/networkStatus';
import type { Money } from '@/types/money.type';

/**
 * A backend timestamp as the API serialises it: an ISO string or a Firestore
 * Timestamp `{ _seconds, _nanoseconds }`. Read with `toDate` (liveDate.ts).
 */
export type ApiTimestamp =
  | string
  | { _seconds: number; _nanoseconds?: number }
  | null;

/**
 * Consultation type matching the backend model.
 *
 * Key differences from the old mobile Consultation type:
 * - `status` uses backend values (scheduled, confirmed, completed, cancelled, etc.)
 *   instead of the old simplified 'upcoming' | 'completed' | 'cancelled'
 * - `date` is a string (ISO) instead of a JS Date object
 * - Includes payment fields (the locked charge snapshot, paymentStatus)
 * - Includes scheduling details (scheduledDate, scheduledTime, durationMinutes, timezone)
 */
export interface ApiConsultation {
  id: string;
  userId: string;
  agentId: string;
  /** Denormalized from the agent doc — avoids extra lookups */
  agentName: string;
  /** Denormalized from the user doc */
  clientName?: string;
  clientEmail?: string;
  agencyId?: string;
  applicationId?: string;
  /** Backend consultation statuses — more granular than the old 3-status model */
  status:
    | 'pending_payment'
    | 'scheduled'
    | 'confirmed'
    | 'in_progress'
    | 'completed'
    | 'cancelled'
    | 'no_show';
  /** Consultation type categorization */
  type:
    | 'initial'
    | 'document_review'
    | 'interview_prep'
    | 'follow_up'
    | 'general';
  /** ISO date string, e.g. "2024-03-15" */
  scheduledDate: string;
  /** Time string, e.g. "10:30" */
  scheduledTime: string;
  durationMinutes: number;
  timezone?: string;
  // ── Charge snapshot (japa#183 / backend #180) ─────────────────────────────
  /** The agent's fee in US cents at booking time; 0 = a free booking. */
  priceUsdCents: number;
  /** The currency the client is (to be) charged in, e.g. "NGN". Paid only. */
  chargedCurrency?: string;
  /** The locked amount, in minor units of `chargedCurrency`. Paid only. */
  chargedAmountMinor?: number;
  /**
   * Local units per 1 USD the client effectively pays, markup included
   * (japa#332; display: "at ₦1,353.97 per $1"). Absent on a free or legacy
   * booking. Replaces the raw `fxRate`, which clients are no longer sent.
   */
  effectiveRate?: number;
  /** When the quote was locked (server clock). */
  quoteLockedAt?: ApiTimestamp;
  /** After this the quote may not be charged; a retry re-prices it. */
  quoteExpiresAt?: ApiTimestamp;
  /** 'pending' until Paystack confirms, then 'paid'. */
  paymentStatus?: string;
  notes?: string;
  summary?: string;
  recordingUrl?: string;
  /** When it was cancelled (Timestamp as serialised). */
  cancelledAt?: ApiTimestamp;

  // ── Refunds (backend #317 / #390 / #413, read by japa#356) ────────────────
  /**
   * What cancelling NOW would give back, worked out by the server (client
   * view of `GET /consultations/:id` only). Absent on a free, unpaid or
   * already-cancelled booking, and on the list / mutation answers. The app
   * never works out refundability or amounts itself: it reads this.
   */
  cancellationRefund?: CancellationRefundPreview;
  /**
   * Where the refund of this booking's fee stands, once one was started:
   * `pending` / `processing` (on its way), `completed` (refunded), `failed`
   * (delayed; a HELD refund is mirrored as `failed` too), `closed` (an admin
   * closed a held refund with nothing to give back, #413 B). Absent when
   * there is no refund.
   */
  refundStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'closed';
  /**
   * Why the refund is held for an admin, while it is (backend #413 mirrors
   * it on the booking). ASSUMPTION (japa#356, user decision 2026-11-22): the
   * client view sends it; today's client allow-list does not, so until it
   * does the screen falls back to the cancel answer's `refund.heldReason`
   * for the rest of the session. Only `fee_not_less_than_amount` is read.
   */
  refundHeldReason?: string;

  // ── "The meeting didn't happen" (backend #382, read by japa#442) ──────────
  /**
   * Whether the client may report now that the meeting did not happen. The
   * server applies every rule (paid, not cancelled, fee still held, no
   * refund, the slot started, no report yet). False on answers that did not
   * work it out (create, cancel, checkout). Absent on an older backend.
   */
  canReportNoShow?: boolean;
  /** The booking's report, or null when there is none. */
  noShowReport?: NoShowReport | null;

  createdAt: string;
  updatedAt: string;
}

/**
 * The cancel preview on the client's booking (backend
 * `CancellationRefundPreview`, consultation-refund.service.ts).
 */
export interface CancellationRefundPreview {
  /** Whether cancelling now gives the fee back (24 h before the slot or more). */
  refundable: boolean;
  /**
   * What cancelling now gives back: the charge minus the payment provider's
   * processing fee (#390). NULL while that fee is not known: then the app
   * shows no figure at all, never the full price as a guess.
   */
  amount: Money | null;
  /** The processing fee the client does not get back; null while unknown. */
  processingFee: Money | null;
  /** ISO instant: slot start minus 24 hours (cancel by then for a refund). */
  refundableUntil: string;
}

/**
 * The refund outcome a cancel answers with (backend `RefundSummary`). Null
 * on the answer when there is no refund (free booking, or a cancel less than
 * 24 hours before the slot).
 */
export interface RefundSummary {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'closed';
  /** What the client gets back; NULL while the refund is held (#390). */
  amount: Money | null;
  /** The processing fee kept out of the charge; null when none / held. */
  processingFee: Money | null;
  /** Why the refund is held for an admin (only while it is). Not shown. */
  heldReason?: string;
}

/** PUT /consultations/:id/status (200): the booking plus the refund outcome. */
export type CancelConsultationResult = ApiConsultation & {
  refund?: RefundSummary | null;
};

/**
 * The client's "the meeting didn't happen" report (backend #382 client
 * view): its status and times only.
 *  - `open`: Seli is looking into it (the agent's payment is paused);
 *  - `refunded`: Seli found the agent didn't show: full refund;
 *  - `released`: Seli found the meeting took place: no refund.
 */
export interface NoShowReport {
  status: 'open' | 'refunded' | 'released';
  createdAt: ApiTimestamp;
  resolvedAt?: ApiTimestamp;
}

/** The longest note the backend accepts on a report (`NO_SHOW_NOTE_MAX_LENGTH`). */
export const NO_SHOW_NOTE_MAX_LENGTH = 1000;

/** POST /consultations/:id/no-show-report (201). */
export interface NoShowReportResult {
  noShowReport: NoShowReport;
  consultation: ApiConsultation;
}

/**
 * Input for creating a new consultation (booking flow).
 * Sent to POST /consultations.
 */
export interface CreateConsultationInput {
  agentId: string;
  type: ApiConsultation['type'];
  scheduledDate: string; // ISO date
  scheduledTime: string; // HH:mm
  durationMinutes: number;
  timezone: string;
  applicationId?: string; // optional link to an existing application
  // NO fee / amount / currency (japa#183): the server prices the booking.
  // `returnTo: 'app'` is NOT part of this input: `useCreateConsultation`
  // adds it to every request itself, so no caller can forget it.
}

/**
 * What POST /consultations returns: the booking (with its locked snapshot)
 * plus the checkout to open. A free booking (`requiresPayment: false`) is
 * already scheduled and paid, `priceUsdCents: 0`, with no Paystack.
 *
 * japa#288: when the client already has an UNPAID pending booking with this
 * agent at this date and time, the server creates nothing and answers 200
 * with THAT booking in this same shape plus `resumed: true` (matched on
 * agent + date + time only, so its `type` / `durationMinutes` may differ
 * from the input). A resumed booking with `requiresPayment: false` was paid
 * meanwhile; it is not a free booking.
 */
export type CreateConsultationResult = ApiConsultation & {
  /** True when an earlier pending booking was handed back (HTTP 200). */
  resumed?: boolean;
} & (
    | { requiresPayment: false }
    | {
        requiresPayment: true;
        /** Paystack hosted checkout (https). */
        authorizationUrl: string;
        /** Same URL, older name. */
        checkoutUrl?: string;
        /** Paystack reference: what verify is called with. */
        reference: string;
      }
  );

/**
 * The payer-safe booking summary the checkout / verify routes return
 * (backend `bookingSummary`). Carries the snapshot when the booking was
 * priced by the server.
 */
export interface BookingSummary {
  id: string;
  agentName: string;
  type: ApiConsultation['type'];
  scheduledDate: ApiTimestamp;
  scheduledTime: string;
  timezone?: string;
  status: ApiConsultation['status'];
  paymentStatus?: string;
  priceUsdCents?: number;
  chargedCurrency?: string;
  chargedAmountMinor?: number;
  /** Local units per 1 USD effectively paid (japa#332); see ApiConsultation. */
  effectiveRate?: number;
  quoteExpiresAt?: ApiTimestamp;
}

/** POST /consultations/:id/checkout (200). */
export type ConsultationCheckoutResult =
  | { requiresPayment: false; consultation: BookingSummary }
  | {
      requiresPayment: true;
      authorizationUrl: string;
      reference: string;
      consultation: BookingSummary;
    };

/** POST /consultations/public/verify (200): the booking is paid. */
export interface VerifyConsultationResult {
  /** japa#392: set by `useVerifyConsultation` (not the backend) on a 200. */
  kind?: 'paid';
  verified: true;
  consultation: BookingSummary;
  /** An extra payment landed on a paid booking and is held for a refund. */
  refundPending?: boolean;
}

/**
 * japa#392: verify answered 409 `CONSULTATION_RESCHEDULED`. The agent moved
 * the booking after its price lock, so the old checkout was retired: the
 * payment just made is being refunded IN FULL and the client pays again for
 * the new time. Never "paid", never a failure.
 */
export interface VerifyConsultationRescheduled {
  kind: 'rescheduled';
  /** The booking summary with the NEW date / time / timezone. */
  consultation: BookingSummary;
  /** The backend's own sentence (the screen uses its own copy). */
  message: string;
}

/** What `useVerifyConsultation` resolves with (japa#392). */
export type VerifyConsultationOutcome =
  | VerifyConsultationResult
  | VerifyConsultationRescheduled;

/**
 * japa#392: the rescheduled outcome out of a failed verify, or null when the
 * error is anything else (those still reject as before). Reads the 409's
 * `data.consultation` defensively: without a usable booking id it is not
 * treated as rescheduled. Pure, never throws.
 */
export function rescheduledFromVerifyError(
  error: unknown,
): VerifyConsultationRescheduled | null {
  const e = (typeof error === 'object' && error !== null ? error : {}) as {
    code?: unknown;
    message?: unknown;
    data?: unknown;
  };
  if (e.code !== 'CONSULTATION_RESCHEDULED') return null;
  const data = (
    typeof e.data === 'object' && e.data !== null ? e.data : {}
  ) as { consultation?: unknown };
  const c = data.consultation as { id?: unknown } | null | undefined;
  if (!c || typeof c !== 'object' || typeof c.id !== 'string' || !c.id) {
    return null;
  }
  return {
    kind: 'rescheduled',
    consultation: c as BookingSummary,
    message: typeof e.message === 'string' ? e.message : '',
  };
}

// ─────────────────────────────────────────────
// QUERY HOOKS
// ─────────────────────────────────────────────

/**
 * Fetch all consultations for the current user.
 * The backend uses the auth token to determine the user and returns
 * their consultations sorted by scheduledDate descending.
 *
 * Used on: Me screen (consultations section), Consultations list screen
 *
 * @param status - Optional filter (e.g. 'scheduled', 'completed')
 */
export function useConsultations(
  status?: string,
  // False skips the call: a self-service-only build (japa#334) hides
  // consultations, so the Profile counts opt out. Default true.
  opts: { enabled?: boolean } = {},
) {
  // Must pass role=client so the backend queries by userId (client)
  // instead of the default role=agent which queries by agentId
  const params = new URLSearchParams({ role: 'client' });
  if (status) params.set('status', status);

  return useQuery({
    queryKey: ['consultations', status],
    enabled: opts.enabled ?? true,
    queryFn: async () => {
      const response = await apiService.get<ApiConsultation[]>(
        `/consultations?${params.toString()}`,
      );
      return response.data ?? [];
    },
  });
}

/**
 * Fetch a single consultation by ID.
 * Used on: Consultation detail screen (me/consultations/[id].tsx)
 *
 * @param id - Consultation document ID. Query disabled if undefined.
 */
export function useConsultation(id: string | undefined) {
  return useQuery({
    queryKey: ['consultations', id],
    queryFn: async () => {
      const response = await apiService.get<ApiConsultation>(
        `/consultations/${id}`,
      );
      return response.data!;
    },
    enabled: !!id,
    // japa#145: a 404 is final (not-found state), so don't retry it.
    retry: retryUnlessNotFound,
  });
}

// ─────────────────────────────────────────────
// MUTATION HOOKS
// ─────────────────────────────────────────────

/**
 * Create a new consultation (book an appointment with an agent).
 * On success, invalidates the consultations query cache so the list refreshes.
 *
 * Used on: Book consultation screen (apply/agents/[id]/book-consultation.tsx)
 */
export function useCreateConsultation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateConsultationInput) => {
      // `returnTo: 'app'` (backend #285): Paystack returns through the
      // backend's app return page, which redirects to the app's deep link,
      // so the in-app auth browser closes by itself after paying.
      const response = await apiService.post<CreateConsultationResult>(
        '/consultations',
        { ...input, returnTo: RETURN_TO_APP },
      );
      return response.data!;
    },
    // After creating, refetch the consultations list so it includes the new one
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] });
    },
  });
}

/**
 * Resume paying a pending booking: POST /consultations/:id/checkout (only the
 * booking's own client may call it). Inside the 30-minute lock it hands back
 * the SAME checkout; after it, a FRESH quote and a new checkout (so the
 * screen must show the new `chargedAmountMinor` before opening it). 409s
 * (PAYMENT_IN_PROGRESS, BOOKING_NOT_PAYABLE, CHECKOUT_OPENING) and 503
 * PRICING_UNAVAILABLE reject as `ApiError`; see `classifyConsultationPayError`.
 *
 * Sends `{ returnTo: 'app' }` (backend #285) so a NEW checkout returns to the
 * app. Inside the lock the backend hands back the booking's existing
 * checkout unchanged, so one first opened on the web still returns to the
 * web confirm page: the auth browser then does not close by itself, the
 * user closes it, and `runPaystackCheckout` verifies all the same.
 */
export function useConsultationCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (consultationId: string) => {
      const response = await apiService.post<ConsultationCheckoutResult>(
        `/consultations/${consultationId}/checkout`,
        { returnTo: RETURN_TO_APP },
      );
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] });
    },
  });
}

/**
 * Confirm a consultation's Paystack charge: POST /consultations/public/verify
 * `{ reference }` (public despite the name; the reference is the one OUR
 * backend returned, never one read from the return deep link). 200 =
 * `{ kind: 'paid', verified: true }`; 400 "not completed" and the other 409s
 * reject as `ApiError` (see `classifyConsultationPayError`).
 *
 * japa#392: a 409 `CONSULTATION_RESCHEDULED` RESOLVES (it is not an error)
 * with `{ kind: 'rescheduled', consultation }`: the booking moved, the
 * payment is being refunded in full, and the client pays again for the new
 * time. Verifying the same old reference again gives the same outcome.
 */
export function useVerifyConsultation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      reference: string,
    ): Promise<VerifyConsultationOutcome> => {
      try {
        const response = await apiService.post<VerifyConsultationResult>(
          '/consultations/public/verify',
          { reference },
        );
        return { ...response.data!, kind: 'paid' };
      } catch (err) {
        const moved = rescheduledFromVerifyError(err);
        if (moved) return moved;
        throw err;
      }
    },
    // Runs for BOTH outcomes, because a rescheduled 409 RESOLVES above:
    //  - paid: the fee row is now paid;
    //  - rescheduled (japa#392): the backend has just written the full
    //    refund row, and the screen says "You'll see it in Payments", so the
    //    cached payments list (5-minute staleTime) must be refetched too.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

/**
 * Cancel a consultation.
 * Calls PUT /consultations/:id/status with { status: 'cancelled' }.
 *
 * japa#356: the answer carries `refund` (`{ status, amount, processingFee }`
 * or null). The screen tells the client what ACTUALLY happened from it, not
 * from the preview it showed before: the 24-hour line may have passed while
 * the screen was open.
 *
 * Used on: Consultation detail screen (cancel button)
 */
export function useCancelConsultation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (consultationId: string) => {
      const response = await apiService.put<CancelConsultationResult>(
        `/consultations/${consultationId}/status`,
        { status: 'cancelled' },
      );
      return response.data!;
    },
    // Refetch both the list and the specific consultation detail, and the
    // payments (a refund row may have just been written, japa#356).
    onSuccess: (_data, consultationId) => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] });
      queryClient.invalidateQueries({
        queryKey: ['consultations', consultationId],
      });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

/**
 * japa#442: the client says the meeting did not happen.
 * POST /consultations/:id/no-show-report `{ note? }` (backend #382). Only
 * the booking's own client may call it, and only while `canReportNoShow`.
 *
 * - 201: `{ noShowReport: { status: 'open' }, consultation }`;
 * - 409 (nothing written): NO_SHOW_REPORT_EXISTS, FEE_NOT_HELD, NOT_PAID,
 *   ALREADY_REFUNDED, MEETING_NOT_STARTED, BOOKING_CANCELLED, each with a
 *   plain-words `message`;
 * - 400 VALIDATION_ERROR: the note is too long (the input caps it first).
 *
 * The call feeds the offline signal (`tracked`), so a network failure flips
 * `useIsOffline` and the screen can say so. Whatever the outcome, the
 * booking is refetched afterwards so the screen shows what the server holds.
 */
export function useReportNoShow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      consultationId,
      note,
    }: {
      consultationId: string;
      note?: string;
    }) => {
      // An empty note is not sent at all (the field is optional).
      const trimmed = (note ?? '').trim();
      const response = await tracked(() =>
        apiService.post<NoShowReportResult>(
          `/consultations/${consultationId}/no-show-report`,
          trimmed ? { note: trimmed } : {},
        ),
      );
      return response.data!;
    },
    // Success or a 409: the booking changed (or was not what we thought), so
    // read it again. A network error leaves the cache alone.
    onSettled: (_data, error, { consultationId }) => {
      if (error && (error as { code?: unknown }).code === 'NETWORK_ERROR') {
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['consultations'] });
      queryClient.invalidateQueries({
        queryKey: ['consultations', consultationId],
      });
    },
  });
}

// ─────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────

/**
 * Map backend consultation status to a simplified display status.
 * The backend has 7 statuses; the mobile UI groups them into 3 buckets:
 * - 'upcoming': pending_payment, scheduled, confirmed (not yet happened)
 * - 'completed': completed, in_progress (done or ongoing)
 * - 'cancelled': cancelled, no_show (didn't happen)
 */
export function getConsultationDisplayStatus(
  status: ApiConsultation['status'],
): 'upcoming' | 'completed' | 'cancelled' {
  switch (status) {
    case 'pending_payment':
    case 'scheduled':
    case 'confirmed':
      return 'upcoming';
    case 'in_progress':
    case 'completed':
      return 'completed';
    case 'cancelled':
    case 'no_show':
      return 'cancelled';
    default:
      return 'upcoming';
  }
}

/**
 * Map consultation type to a human-readable label.
 * e.g. 'document_review' → 'Document Review'
 */
export function getConsultationTypeLabel(
  type: ApiConsultation['type'],
): string {
  const labels: Record<string, string> = {
    initial: 'Initial Consultation',
    document_review: 'Document Review',
    interview_prep: 'Interview Preparation',
    follow_up: 'Follow Up',
    general: 'General Consultation',
  };
  return labels[type] ?? type;
}

/**
 * Parse a date that may be a string, number, or serialized
 * Firestore Timestamp ({ _seconds, _nanoseconds }).
 */
function parseDate(value: unknown): Date {
  if (!value) return new Date();
  if (typeof value === 'object' && value !== null && '_seconds' in value) {
    return new Date((value as { _seconds: number })._seconds * 1000);
  }
  return new Date(value as string | number);
}

/**
 * Format a consultation's scheduled date and time for display.
 * Handles both ISO date strings and serialized Firestore Timestamps.
 * e.g. "2024-03-15" + "10:30" → "Mar 15, 2024 at 10:30 AM"
 */
export function formatConsultationDateTime(
  scheduledDate: string,
  scheduledTime: string,
): string {
  try {
    const date = parseDate(scheduledDate);
    // If scheduledTime is provided, set the time on the parsed date
    if (scheduledTime) {
      const [hours, minutes] = scheduledTime.split(':').map(Number);
      date.setHours(hours, minutes, 0, 0);
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return `${scheduledDate} ${scheduledTime}`;
  }
}
