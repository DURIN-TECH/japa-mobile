// ─────────────────────────────────────────────────────────────────────────────
// routeForNotification with the self-service-only flag (japa#334).
//
// Flag on: a notice about a hidden feature (messages, consultations, agent
// payments, identity, agent document requests) resolves to "nothing
// matched" (push: /notifications, inbox: null) and never to a hidden route.
// Flag off: exactly the routes the router returned before the flag existed.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from '@jest/globals';
import {
  isSelfServiceHiddenNotification,
  routeForNotification,
  type NotificationRouteInput,
  type NotificationRouteMode,
} from '../notification-router';
import { isHiddenInSelfServiceOnly } from '@/config/selfServiceRoutes';

const on = (input: NotificationRouteInput, mode: NotificationRouteMode) =>
  routeForNotification(input, mode, { selfServiceOnly: true });
const off = (input: NotificationRouteInput, mode: NotificationRouteMode) =>
  routeForNotification(input, mode, { selfServiceOnly: false });

// Notices of hidden features, with the route they open when the flag is off.
const HIDDEN: [string, NotificationRouteInput, string][] = [
  [
    'message_received',
    {
      type: 'message_received',
      relatedEntityType: 'message',
      relatedEntityId: 'c1',
      conversationId: 'c2',
    },
    '/messages/c2',
  ],
  ['message_received, no id', { type: 'message_received' }, '/messages'],
  [
    'consultation_reminder',
    { type: 'consultation_reminder', relatedEntityId: 'k1' },
    '/consultation/k1',
  ],
  [
    'consultation_booking',
    {
      type: 'consultation_booking',
      relatedEntityType: 'consultation',
      relatedEntityId: 'k2',
    },
    '/consultation/k2',
  ],
  [
    'payment_request',
    {
      type: 'payment_request',
      relatedEntityType: 'application',
      relatedEntityId: 'a1',
    },
    '/payments',
  ],
  [
    'payment_request_rejected',
    { type: 'payment_request_rejected' },
    '/payments',
  ],
  ['payment_received', { type: 'payment_received' }, '/payments'],
  ['identity_verified', { type: 'identity_verified' }, '/verify-identity'],
  [
    'identity_verification_failed',
    { type: 'identity_verification_failed' },
    '/verify-identity',
  ],
  [
    'document_status',
    {
      type: 'document_status',
      relatedEntityType: 'application',
      relatedEntityId: 'a1',
    },
    '/documents',
  ],
  [
    'documentRequestId on another type',
    { type: 'system', documentRequestId: 'r1' },
    '/documents',
  ],
  [
    'entity consultation',
    { relatedEntityType: 'consultation', relatedEntityId: 'k3' },
    '/consultation/k3',
  ],
  [
    'entity payment_request',
    { relatedEntityType: 'payment_request', relatedEntityId: 'p1' },
    '/payments',
  ],
  ['entity payment', { relatedEntityType: 'payment' }, '/payments'],
  [
    'entity message',
    { relatedEntityType: 'message', relatedEntityId: 'c3' },
    '/messages/c3',
  ],
  [
    'entity document',
    { relatedEntityType: 'document', relatedEntityId: 'd1' },
    '/documents',
  ],
];

// Self-service notices: the same route with the flag on or off.
const KEPT: [string, NotificationRouteInput, string][] = [
  [
    'readiness_review_ready',
    { type: 'readiness_review_ready', relatedEntityId: 'a1' },
    '/self-service/a1/review',
  ],
  [
    'document_check_problems',
    { type: 'document_check_problems', relatedEntityId: 'a1' },
    '/self-service/a1',
  ],
  [
    'document_check_could_not_check',
    { type: 'document_check_could_not_check', relatedEntityId: 'a1' },
    '/self-service/a1',
  ],
  [
    'document_check_passed',
    { type: 'document_check_passed', relatedEntityId: 'a1' },
    '/self-service/a1',
  ],
  [
    'refusal_analysis_ready',
    { type: 'refusal_analysis_ready', relatedEntityId: 'a1', analysisId: 'x9' },
    '/self-service/refusal-letter?applicationId=a1&analysisId=x9',
  ],
  [
    'document_rejected',
    {
      type: 'document_rejected',
      relatedEntityType: 'application',
      relatedEntityId: 'a1',
    },
    '/application/a1',
  ],
  [
    'document_approved on a document entity',
    {
      type: 'document_approved',
      relatedEntityType: 'document',
      relatedEntityId: 'a1',
    },
    '/application/a1',
  ],
  [
    'rule_change_alert',
    { type: 'rule_change_alert', relatedEntityId: 'a9' },
    '/application/a9',
  ],
  [
    'application_update',
    {
      type: 'application_update',
      relatedEntityType: 'application',
      relatedEntityId: 'a1',
    },
    '/application/a1',
  ],
  [
    'entity application',
    { relatedEntityType: 'application', relatedEntityId: 'a2' },
    '/application/a2',
  ],
];

describe('routeForNotification, self-service-only flag on', () => {
  it.each(HIDDEN)('%s -> the fallback, never a hidden route', (_, input) => {
    expect(on(input, 'push')).toBe('/notifications');
    expect(on(input, 'inbox')).toBeNull();
    expect(isSelfServiceHiddenNotification(input)).toBe(true);
  });

  it.each(KEPT)('%s -> its route, as before', (_, input, expected) => {
    expect(on(input, 'push')).toBe(expected);
    expect(on(input, 'inbox')).toBe(expected);
    expect(isSelfServiceHiddenNotification(input)).toBe(false);
  });

  it('visa_news and unknown types still fall back', () => {
    expect(on({ type: 'visa_news', relatedEntityId: 'n1' }, 'push')).toBe(
      '/notifications',
    );
    expect(on({ type: 'system' }, 'inbox')).toBeNull();
    expect(on({}, 'push')).toBe('/notifications');
    expect(routeForNotification(null, 'inbox', { selfServiceOnly: true })).toBe(
      null,
    );
    expect(isSelfServiceHiddenNotification({ type: 'visa_news' })).toBe(false);
    expect(isSelfServiceHiddenNotification(null)).toBe(false);
  });

  it('never returns a route the guard would redirect', () => {
    for (const [, input] of [...HIDDEN, ...KEPT]) {
      for (const mode of ['push', 'inbox'] as const) {
        expect(isHiddenInSelfServiceOnly(on(input, mode), true)).toBe(false);
      }
    }
  });
});

describe('routeForNotification, self-service-only flag off', () => {
  it.each([...HIDDEN, ...KEPT])(
    '%s -> the same route as today',
    (_, input, expected) => {
      expect(off(input, 'push')).toBe(expected);
      expect(off(input, 'inbox')).toBe(expected);
      // No options at all = flag off (every existing caller and test).
      expect(routeForNotification(input, 'push')).toBe(expected);
      expect(routeForNotification(input)).toBe(expected);
    },
  );

  it('fallbacks unchanged', () => {
    expect(off({ type: 'system' }, 'push')).toBe('/notifications');
    expect(off({ type: 'system' }, 'inbox')).toBeNull();
  });
});
