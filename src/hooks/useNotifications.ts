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

import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { apiService } from '@/services/api.service';

/**
 * Notification type matching the backend model.
 *
 * The `type` field picks the inbox icon (toKind) and the tap target
 * (`routeForNotification(record, 'inbox')` in notification-router.ts):
 * - application_update, rule_change_alert, document_rejected,
 *   document_approved → /application/:id
 * - readiness_review_ready → /self-service/:id/review
 * - document_check_* → /self-service/:id
 * - refusal_analysis_ready → /self-service/refusal-letter?applicationId=:id
 * - document_status → /documents
 * - consultation_* → /consultation/:id (or /consultations with no id)
 * - payment_request, payment_request_rejected, payment_received → /payments
 * - message_received → /messages/:conversationId (or /messages)
 * - identity_verified, identity_verification_failed → /verify-identity
 * - visa_news → nothing opens, ever (the app has no news screen); the row
 *   just marks itself read
 * - system and unknown types → the related entity's screen when the router
 *   knows the entity type, else nothing opens (row just marks read)
 */
export interface ApiNotification {
  id: string;
  userId: string;
  type:
    | 'application_update'
    | 'document_status'
    | 'consultation_booking'
    | 'consultation_reminder'
    | 'consultation_confirmed'
    | 'consultation_rescheduled'
    | 'consultation_cancelled'
    | 'consultation_completed'
    // japa#356: refund notices (backend consultation-refund.service.ts).
    // Title and body are the backend's, shown as sent.
    | 'consultation_refunded'
    | 'consultation_refund_delayed'
    // japa#442: "the meeting didn't happen" report sent / decided.
    | 'consultation_no_show_reported'
    | 'consultation_no_show_resolved'
    | 'payment_received'
    | 'payment_request'
    | 'payment_request_rejected'
    | 'message_received'
    | 'rule_change_alert'
    | 'readiness_review_ready'
    | 'document_check_problems'
    | 'document_check_could_not_check'
    | 'document_check_passed'
    | 'refusal_analysis_ready'
    | 'document_approved'
    | 'document_rejected'
    | 'identity_verified'
    | 'identity_verification_failed'
    | 'visa_news'
    | 'system'
    | (string & {}); // unknown future types fall back to `status` in toKind
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
    | 'news_article'
    | 'payment_request'
    | 'subscription'
    | 'agency'
    | 'agent'
    | 'verification'
    | 'review'
    | 'visa';
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

/**
 * The inbox screen's list (#269 e2e fix). The list query inherits the app's
 * 5-minute staleTime, while the bell count polls every 30s, so the inbox could
 * show an old cached list under a newer badge number. This keeps them in step:
 *   1. every time the inbox gains focus (first open AND coming back from a
 *      screen pushed on top of it) the list is re-read from the server;
 *   2. while the inbox is open, a change in the polled unread count re-reads
 *      the list too (inbox-only notices arrive without a push to invalidate it).
 * `cancelRefetch: false` joins a read already in flight instead of restarting
 * it, so a focus read on first open, or a count change caused by a mark-read
 * invalidation, never doubles the request.
 */
export function useInboxNotifications(limit = 20) {
  const listQ = useNotifications(limit);
  const countQ = useUnreadNotificationCount();
  const { refetch } = listQ;

  // ── 1. Fresh on every focus ───────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      refetch({ cancelRefetch: false });
    }, [refetch]),
  );

  // ── 2. Re-read when the polled count changes ──────────────────────────────
  // Only a successful count counts; the first value seen is the baseline.
  const count = countQ.isSuccess ? countQ.data : undefined;
  const lastCount = useRef<number | undefined>(count);
  useEffect(() => {
    if (count === undefined) return;
    if (lastCount.current !== undefined && lastCount.current !== count) {
      refetch({ cancelRefetch: false });
    }
    lastCount.current = count;
  }, [count, refetch]);

  return listQ;
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

/**
 * Delete one notification (japa#145).
 * Backend: DELETE /notifications/:id (present on origin/dev).
 *
 * The screen keeps no local-only state: on success the list refetches; on
 * failure the row stays as the server has it and the screen shows an
 * InlineError ("We couldn’t update that notification. Try again.").
 */
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      await apiService.delete(`/notifications/${notificationId}`);
    },
    onSettled: () => {
      // Success or failure, re-read the server's truth.
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
