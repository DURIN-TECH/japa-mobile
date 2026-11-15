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
 *                                   prices it and LOCKS the quote (japa#183)
 * - POST /consultations/:id/checkout → resume paying a pending booking
 * - POST /consultations/public/verify → confirm a Paystack charge by reference
 * - PUT /consultations/:id/status → update status (cancel, complete, etc.)
 *
 * MONEY (japa#183): the app never sends a fee, amount, currency or rate. The
 * server reads the agent's dollar fee, quotes it in the client's currency,
 * stores the snapshot (`priceUsdCents`, `chargedCurrency`,
 * `chargedAmountMinor`, `fxRate`) and locks it for 30 minutes
 * (`quoteLockedAt` → `quoteExpiresAt`). The app shows those stored values.
 *
 * The backend Consultation type has more fields than the mobile app's
 * original `Consultation` type. We map the API response to a richer
 * `ApiConsultation` type that includes scheduling, payment, and duration.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { retryUnlessNotFound } from './queryErrors';
import { RETURN_TO_APP } from '@/hooks/paystackCheckout';
import { apiService } from '@/services/api.service';

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
  /** Local units per 1 USD the quote used (display: "at ₦1,353.97 per $1"). */
  fxRate?: number;
  /** When the quote was locked (server clock). */
  quoteLockedAt?: ApiTimestamp;
  /** After this the quote may not be charged; a retry re-prices it. */
  quoteExpiresAt?: ApiTimestamp;
  /** 'pending' until Paystack confirms, then 'paid'. */
  paymentStatus?: string;
  notes?: string;
  summary?: string;
  recordingUrl?: string;
  createdAt: string;
  updatedAt: string;
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
 */
export type CreateConsultationResult = ApiConsultation &
  (
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
  fxRate?: number;
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
  verified: true;
  consultation: BookingSummary;
  /** An extra payment landed on a paid booking and is held for a refund. */
  refundPending?: boolean;
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
export function useConsultations(status?: string) {
  // Must pass role=client so the backend queries by userId (client)
  // instead of the default role=agent which queries by agentId
  const params = new URLSearchParams({ role: 'client' });
  if (status) params.set('status', status);

  return useQuery({
    queryKey: ['consultations', status],
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
 * `{ verified: true }`; 400 "not completed" and the 409s reject as
 * `ApiError` (see `classifyConsultationPayError`).
 */
export function useVerifyConsultation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reference: string) => {
      const response = await apiService.post<VerifyConsultationResult>(
        '/consultations/public/verify',
        { reference },
      );
      return response.data!;
    },
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
 * Used on: Consultation detail screen (cancel button)
 */
export function useCancelConsultation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (consultationId: string) => {
      const response = await apiService.put<ApiConsultation>(
        `/consultations/${consultationId}/status`,
        { status: 'cancelled' },
      );
      return response.data!;
    },
    // Refetch both the list and the specific consultation detail
    onSuccess: (_data, consultationId) => {
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
