/**
 * usePaymentRequests Hooks
 *
 * React Query hooks for the payment request approve/reject flow.
 * Clients can view, approve, or reject payment requests from agents.
 *
 * Backend endpoints used:
 * - GET /payment-requests?role=client&applicationId=...  → list for client
 * - PUT /payment-requests/:id/approve                    → approve request
 * - PUT /payment-requests/:id/reject                     → reject with reason
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { PaymentRequest } from '@/types/payment-requests.type';

// ─────────────────────────────────────────────
// QUERY HOOKS
// ─────────────────────────────────────────────

/**
 * Fetch payment requests for the authenticated client.
 * Optionally filtered by applicationId.
 *
 * @param applicationId - Filter to a specific application (optional)
 */
export function usePaymentRequests(applicationId?: string) {
  const queryParams = applicationId
    ? `?role=client&applicationId=${applicationId}`
    : '?role=client';

  return useQuery({
    queryKey: ['payment-requests', applicationId],
    queryFn: async () => {
      const response = await apiService.get<PaymentRequest[]>(
        `/payment-requests${queryParams}`,
      );
      return response.data ?? [];
    },
  });
}

// ─────────────────────────────────────────────
// MUTATION HOOKS
// ─────────────────────────────────────────────

/**
 * Approve a payment request.
 * Releases escrow funds to the agent and increments amountPaid.
 */
export function useApprovePaymentRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string) => {
      const response = await apiService.put<PaymentRequest>(
        `/payment-requests/${requestId}/approve`,
      );
      return response.data;
    },
    onSuccess: () => {
      // Invalidate payment requests so the list refreshes
      queryClient.invalidateQueries({ queryKey: ['payment-requests'] });
      // Also refresh applications since amountPaid changed
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}

/**
 * Reject a payment request.
 * Auto-creates a chat conversation with the rejection reason.
 * Returns the rejected request plus a conversationId.
 */
export function useRejectPaymentRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      reason,
    }: {
      requestId: string;
      reason: string;
    }) => {
      const response = await apiService.put<
        PaymentRequest & { conversationId?: string }
      >(`/payment-requests/${requestId}/reject`, { reason });
      return response.data;
    },
    onSuccess: () => {
      // Invalidate payment requests so the list refreshes
      queryClient.invalidateQueries({ queryKey: ['payment-requests'] });
    },
  });
}
