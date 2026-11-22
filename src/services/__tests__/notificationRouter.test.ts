// ─────────────────────────────────────────────────────────────────────────────
// routeForNotification (issue #265): the shared pure router. Push `data` values
// are always strings, so the inputs here are string-only.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from '@jest/globals';
import { routeForNotification as route } from '../notification-router';

describe('routeForNotification', () => {
  it('application + application_update -> /application/<id>', () => {
    expect(
      route({
        type: 'application_update',
        relatedEntityType: 'application',
        relatedEntityId: 'a1',
      }),
    ).toBe('/application/a1');
    expect(
      route({ relatedEntityType: 'application', relatedEntityId: 'a1' }),
    ).toBe('/application/a1');
  });

  it('rule_change_alert -> the application', () => {
    expect(
      route({
        type: 'rule_change_alert',
        relatedEntityType: 'application',
        relatedEntityId: 'a9',
      }),
    ).toBe('/application/a9');
  });

  it('self-service types: review vs application screen', () => {
    const base = { relatedEntityType: 'application', relatedEntityId: 'a2' };
    expect(route({ ...base, type: 'readiness_review_ready' })).toBe(
      '/self-service/a2/review',
    );
    for (const type of [
      'document_check_problems',
      'document_check_could_not_check',
      'document_check_passed',
    ]) {
      expect(route({ ...base, type })).toBe('/self-service/a2');
    }
  });

  it('document / document_status / document request -> /documents', () => {
    expect(
      route({
        type: 'document_status',
        relatedEntityType: 'application',
        relatedEntityId: 'a1',
      }),
    ).toBe('/documents');
    expect(
      route({ relatedEntityType: 'document', relatedEntityId: 'd1' }),
    ).toBe('/documents');
    expect(route({ type: 'system', documentRequestId: 'r1' })).toBe(
      '/documents',
    );
  });

  it('message -> conversationId, then relatedEntityId, then /messages', () => {
    expect(
      route({
        type: 'message_received',
        relatedEntityType: 'message',
        relatedEntityId: 'c1',
        conversationId: 'c2',
      }),
    ).toBe('/messages/c2');
    expect(
      route({
        type: 'message_received',
        relatedEntityType: 'message',
        relatedEntityId: 'c1',
      }),
    ).toBe('/messages/c1');
    expect(route({ type: 'message_received' })).toBe('/messages');
    expect(route({ relatedEntityType: 'message' }, 'inbox')).toBe('/messages');
  });

  it('consultation_* -> /consultation/<id>, or the list without an id', () => {
    expect(
      route({ type: 'consultation_reminder', relatedEntityId: 'k1' }),
    ).toBe('/consultation/k1');
    expect(
      route({
        type: 'consultation_booking',
        relatedEntityType: 'consultation',
        relatedEntityId: 'k2',
      }),
    ).toBe('/consultation/k2');
    expect(route({ type: 'consultation_reminder' })).toBe('/consultations');
    expect(route({ relatedEntityType: 'consultation' })).toBe('/consultations');
  });

  it('payment types -> /payments', () => {
    for (const type of [
      'payment_request',
      'payment_request_rejected',
      'payment_received',
    ]) {
      expect(
        route({
          type,
          relatedEntityType: 'application',
          relatedEntityId: 'a1',
        }),
      ).toBe('/payments');
    }
    expect(
      route({ relatedEntityType: 'payment_request', relatedEntityId: 'p1' }),
    ).toBe('/payments');
  });

  it('unknown or missing type with no entity: /notifications (push) / null (inbox)', () => {
    expect(route({ type: 'system' })).toBe('/notifications');
    expect(route({})).toBe('/notifications');
    expect(route(undefined)).toBe('/notifications');
    expect(route({ type: 'system' }, 'inbox')).toBeNull();
    expect(route(null, 'inbox')).toBeNull();
  });

  it('reads relatedEntityId first, deprecated referenceId only as a fallback', () => {
    expect(
      route({
        relatedEntityType: 'application',
        relatedEntityId: 'new',
        referenceId: 'old',
      }),
    ).toBe('/application/new');
    expect(
      route({ relatedEntityType: 'application', referenceId: 'old' }),
    ).toBe('/application/old');
  });

  it('a missing or blank id never crashes', () => {
    expect(route({ type: 'application_update' })).toBe('/notifications');
    expect(route({ type: 'application_update' }, 'inbox')).toBeNull();
    expect(
      route({ type: 'readiness_review_ready', relatedEntityId: '  ' }),
    ).toBe('/notifications');
    expect(route({ type: 'document_check_passed' }, 'inbox')).toBeNull();
  });
});

// ── #269: every backend type gets a tap target (inbox mode) ──────────────────
describe('routeForNotification (#269 type table)', () => {
  const inbox = (type: string, id?: string, entity?: string) =>
    route({ type, relatedEntityId: id, relatedEntityType: entity }, 'inbox');

  it('refusal_analysis_ready -> refusal-letter screen by applicationId', () => {
    expect(inbox('refusal_analysis_ready', 'a1', 'application')).toBe(
      '/self-service/refusal-letter?applicationId=a1',
    );
  });
  it('refusal_analysis_ready push passes analysisId through', () => {
    expect(
      route({
        type: 'refusal_analysis_ready',
        relatedEntityId: 'a1',
        analysisId: 'x9',
      }),
    ).toBe('/self-service/refusal-letter?applicationId=a1&analysisId=x9');
  });
  it('refusal_analysis_ready without an id stays / opens the inbox', () => {
    expect(inbox('refusal_analysis_ready')).toBeNull();
    expect(route({ type: 'refusal_analysis_ready' })).toBe('/notifications');
  });
  it('document_rejected / document_approved -> the application', () => {
    expect(inbox('document_rejected', 'a1', 'application')).toBe(
      '/application/a1',
    );
    expect(inbox('document_approved', 'a1', 'application')).toBe(
      '/application/a1',
    );
    expect(inbox('document_approved')).toBeNull();
  });
  it('identity results -> /verify-identity', () => {
    expect(inbox('identity_verified')).toBe('/verify-identity');
    expect(inbox('identity_verification_failed')).toBe('/verify-identity');
  });
  it('visa_news never opens anything, even with an entity', () => {
    expect(inbox('visa_news', 'n1', 'application')).toBeNull();
    expect(route({ type: 'visa_news', relatedEntityId: 'n1' })).toBe(
      '/notifications',
    );
  });
  it('self-service types as before', () => {
    expect(inbox('readiness_review_ready', 'a1')).toBe(
      '/self-service/a1/review',
    );
    expect(inbox('document_check_problems', 'a1')).toBe('/self-service/a1');
    expect(inbox('document_check_could_not_check', 'a1')).toBe(
      '/self-service/a1',
    );
    expect(inbox('document_check_passed', 'a1')).toBe('/self-service/a1');
  });

  // japa#356: both refund notices open the booking (the `consultation*`
  // rule), or the consultations list when the id is missing.
  it('consultation_refunded / _refund_delayed -> the consultation', () => {
    for (const type of [
      'consultation_refunded',
      'consultation_refund_delayed',
    ]) {
      expect(route({ type, relatedEntityId: 'k1' })).toBe('/consultation/k1');
      expect(
        route({
          type,
          relatedEntityType: 'consultation',
          relatedEntityId: 'k2',
        }),
      ).toBe('/consultation/k2');
      expect(route({ type })).toBe('/consultations');
      expect(route({ type }, 'inbox')).toBe('/consultations');
    }
  });
});
