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
 * - POST /consultations          → create/book a new consultation
 * - PUT /consultations/:id/status → update status (cancel, complete, etc.)
 *
 * The backend Consultation type has more fields than the mobile app's
 * original `Consultation` type. We map the API response to a richer
 * `ApiConsultation` type that includes scheduling, payment, and duration.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';

/**
 * Consultation type matching the backend model.
 *
 * Key differences from the old mobile Consultation type:
 * - `status` uses backend values (scheduled, confirmed, completed, cancelled, etc.)
 *   instead of the old simplified 'upcoming' | 'completed' | 'cancelled'
 * - `date` is a string (ISO) instead of a JS Date object
 * - Includes payment fields (fee, paymentStatus)
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
  fee: number; // in cents
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
  fee: number; // in cents — comes from the agent's consultationFee
  applicationId?: string; // optional link to an existing application
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
  const queryParam = status ? `?status=${status}` : '';
  return useQuery({
    queryKey: ['consultations', status],
    queryFn: async () => {
      const response = await apiService.get<ApiConsultation[]>(
        `/consultations${queryParam}`,
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
      const response = await apiService.post<ApiConsultation>(
        '/consultations',
        input,
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
 * Format a consultation's scheduled date and time for display.
 * e.g. "2024-03-15" + "10:30" → "Mar 15, 2024 at 10:30 AM"
 */
export function formatConsultationDateTime(
  scheduledDate: string,
  scheduledTime: string,
): string {
  try {
    // Combine date and time into a full Date object
    const dateTime = new Date(`${scheduledDate}T${scheduledTime}:00`);
    return dateTime.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    // Fallback if date parsing fails
    return `${scheduledDate} ${scheduledTime}`;
  }
}
