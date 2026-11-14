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
        type: 'consultation_booked',
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
