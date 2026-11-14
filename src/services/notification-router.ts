/**
 * Notification router (#265)
 *
 * ONE pure function that turns a notification's identifying fields into the
 * in-app route it should open. Shared by:
 *   - the push handler (`push-notification.service.ts`): foreground "View",
 *     background tap and cold-start tap, where the input is the FCM `data`
 *     map (every value is a string);
 *   - the inbox (`src/app/notifications.tsx`): where the input is the stored
 *     notification record.
 * So a push and its inbox row always open the same screen.
 *
 * Pure on purpose: no React, no expo-router, no Firebase. Easy to unit test.
 *
 * Field precedence (the backend sends `type`, `relatedEntityType`,
 * `relatedEntityId`, plus optional extras like `conversationId` and
 * `documentRequestId`):
 *   1. `type`-specific rules (the most precise signal)
 *   2. `relatedEntityType` rules
 *   3. the fallback: `/notifications` for a push, `null` for an inbox row
 * The id is `relatedEntityId`, falling back to the deprecated `referenceId`
 * only for old records.
 *
 * Never throws: a missing or empty id degrades to a list screen or the
 * fallback. A route to something that no longer exists (a deleted
 * application) is the target screen's own not-found state to handle.
 */

/** Where the route will be used; only changes the "nothing matched" result. */
export type NotificationRouteMode = 'push' | 'inbox';

/** What the router reads. Every field is optional (push data is loose). */
export interface NotificationRouteInput {
  type?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  /** Sent with message notices; the conversation id. */
  conversationId?: string | null;
  /** Sent with document-request notices. Presence alone means "documents". */
  documentRequestId?: string | null;
  /**
   * Push-only (#268): the refusal analysis id. The inbox record does not
   * store `data`, so inbox taps never have it; the refusal-letter screen
   * then falls back to the id saved on the phone.
   */
  analysisId?: string | null;
  /** @deprecated Old records only. `relatedEntityId` wins. */
  referenceId?: string | null;
}

/** Trim and turn blank/non-string values into undefined. */
const clean = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

/**
 * Route for a notification, or `null` when there is nothing sensible to open
 * (inbox mode only; push mode falls back to the inbox list).
 */
export function routeForNotification(
  input: NotificationRouteInput | null | undefined,
  mode: NotificationRouteMode = 'push',
): string | null {
  const fallback = mode === 'push' ? '/notifications' : null;
  if (!input) return fallback;

  const type = clean(input.type);
  const entityType = clean(input.relatedEntityType);
  const id = clean(input.relatedEntityId) ?? clean(input.referenceId);

  // ── 1. type-specific rules ───────────────────────────────────────────────
  switch (type) {
    // Self-service (#266): the report is ready → the review screen.
    case 'readiness_review_ready':
      return id ? `/self-service/${id}/review` : fallback;

    // Self-service document checks → the self-service application screen.
    case 'document_check_problems':
    case 'document_check_could_not_check':
    case 'document_check_passed':
      return id ? `/self-service/${id}` : fallback;

    // Refusal-letter analysis ready (#268): the refusal-letter screen for the
    // application, with the analysis id when the push carried it so the
    // result shows on any phone.
    case 'refusal_analysis_ready': {
      if (!id) return fallback;
      const analysisId = clean(input.analysisId);
      return `/self-service/refusal-letter?applicationId=${encodeURIComponent(id)}${
        analysisId ? `&analysisId=${encodeURIComponent(analysisId)}` : ''
      }`;
    }

    // Document decisions on an application → that application (explicit so
    // they do not rely on the entity fallback).
    case 'document_rejected':
    case 'document_approved':
      return id ? `/application/${id}` : fallback;

    // Identity check result → the verification screen (it shows the verified
    // state, or the reason and the form again). The backend sends no entity.
    case 'identity_verified':
    case 'identity_verification_failed':
      return '/verify-identity';

    // Visa news: the app has no news screen (the backend's /news/<id> does
    // not exist here), so never pick up an entity rule; just fall back.
    case 'visa_news':
      return fallback;

    // Messages: the conversation id, then the entity id, else the list.
    case 'message_received':
      return messageRoute(input, id);

    // Document requests → the documents screen (no per-request screen).
    case 'document_status':
      return '/documents';

    // Money notices → the payments screen.
    case 'payment_request':
    case 'payment_request_rejected':
    case 'payment_received':
      return '/payments';

    // A rule changed under an application → that application.
    case 'rule_change_alert':
    case 'application_update':
      return id ? `/application/${id}` : fallback;
  }
  // consultation_reminder, consultation_booked, ...
  if (type?.startsWith('consultation')) return consultationRoute(id);

  // A documentRequestId on any other type still means "documents".
  if (clean(input.documentRequestId)) return '/documents';

  // ── 2. relatedEntityType rules ───────────────────────────────────────────
  switch (entityType) {
    case 'application':
      return id ? `/application/${id}` : fallback;
    case 'consultation':
      return consultationRoute(id);
    case 'document':
      return '/documents';
    case 'payment_request':
    case 'payment':
      return '/payments';
    case 'message':
      return messageRoute(input, id);
  }

  // ── 3. nothing matched ───────────────────────────────────────────────────
  return fallback;
}

/** `/messages/<conversation>`; the entity id IS the conversation id. */
function messageRoute(input: NotificationRouteInput, id?: string): string {
  const conversationId = clean(input.conversationId) ?? id;
  return conversationId ? `/messages/${conversationId}` : '/messages';
}

/** `/consultation/<id>`, or the list when there is no id. */
function consultationRoute(id?: string): string {
  return id ? `/consultation/${id}` : '/consultations';
}
