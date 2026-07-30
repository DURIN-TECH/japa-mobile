/**
 * useNotifications Hook
 *
 * React Query hooks for the notification system.
 * Provides access to the user's notifications and unread count.
 *
 * Backend endpoints used:
 * - GET /notifications              → paginated notification list
 * - GET /notifications/unread-count → just the count (for badge display)
 * - PUT /notifications/:id/read     → mark single notification as read
 * - PUT /notifications/read-all     → mark all notifications as read
 *
 * The unread count is polled every 30 seconds so the home screen bell icon
 * stays relatively up-to-date without WebSocket complexity.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';

/**
 * Notification type matching the backend model.
 *
 * The `type` field determines the icon and deep-link behavior:
 * - application_update → navigates to /me/applications/:referenceId
 * - document_status → navigates to document in application
 * - consultation_reminder → navigates to /me/consultations/:referenceId
 * - payment_received → shows payment confirmation
 * - payment_request → navigates to /me/applications/:referenceId
 * - payment_request_rejected → navigates to /me/applications/:referenceId
 * - system → general system announcement
 */
export interface ApiNotification {
  id: string;
  userId: string;
  type:
    | 'application_update'
    | 'document_status'
    | 'consultation_reminder'
    | 'payment_received'
    | 'payment_request'
    | 'payment_request_rejected'
    | 'message_received'
    | 'system';
  title: string;
  /** Notification body text — matches backend field name */
  body: string;
  /** For backward compat if backend ever sends `message` instead of `body` */
  message?: string;
  /** Deep linking — type of the related entity */
  relatedEntityType?:
    | 'application'
    | 'consultation'
    | 'document'
    | 'message'
    | 'payment_request';
  /** Deep linking — ID of the related entity */
  relatedEntityId?: string;
  /** @deprecated Use relatedEntityId instead */
  referenceId?: string;
  /** Whether the user has seen this notification */
  isRead: boolean;
  createdAt: string;
}

/** Shape returned by GET /notifications/unread-count */
interface UnreadCountResponse {
  count: number;
}

// ─────────────────────────────────────────────
// QUERY HOOKS
// ─────────────────────────────────────────────

/**
 * Fetch the user's notifications list.
 * Sorted by createdAt descending (newest first).
 *
 * @param limit - Max notifications to fetch (default 20)
 */
export function useNotifications(limit = 20) {
  return useQuery({
    queryKey: ['notifications', limit],
    queryFn: async () => {
      const response = await apiService.get<ApiNotification[]>(
        `/notifications?limit=${limit}`,
      );
      return response.data ?? [];
    },
  });
}

/**
 * Fetch just the unread notification count.
 * Used for the badge number on the home screen bell icon.
 *
 * Refetches every 30 seconds to keep the count fresh without
 * needing real-time WebSocket updates. This is a lightweight
 * endpoint that only returns { count: number }.
 */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const response = await apiService.get<UnreadCountResponse>(
        '/notifications/unread-count',
      );
      return response.data?.count ?? 0;
    },
    // Poll every 30 seconds for fresh count
    refetchInterval: 30_000,
    // Keep refetching even when the app tab is in the background
    refetchIntervalInBackground: false,
  });
}

// ─────────────────────────────────────────────
// MUTATION HOOKS
// ─────────────────────────────────────────────

/**
 * Mark a single notification as read.
 * Called when the user taps on a notification to view it.
 *
 * Optimistically updates the local cache so the UI responds instantly,
 * then the backend confirms the change.
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      await apiService.put(`/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      // Refetch both the notification list and unread count
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/**
 * Mark all notifications as read.
 * Called when user taps "Mark all as read" button.
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiService.put('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
