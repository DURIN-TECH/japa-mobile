// #269: backend type -> inbox kind table, and the bell badge rules.
import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it } from '@jest/globals';
import { toKind } from '../liveNotifications';
import { UnreadBadge, badgeText, bellLabel } from '../UnreadBadge';

describe('toKind', () => {
  const table: Record<string, string> = {
    application_update: 'status',
    readiness_review_ready: 'status',
    refusal_analysis_ready: 'status',
    system: 'status',
    some_future_type: 'status',
    rule_change_alert: 'alert',
    identity_verification_failed: 'alert',
    document_status: 'action',
    document_rejected: 'action',
    document_check_problems: 'action',
    document_check_could_not_check: 'action',
    document_approved: 'verified',
    document_check_passed: 'verified',
    identity_verified: 'verified',
    consultation_booking: 'consult',
    consultation_reminder: 'consult',
    consultation_confirmed: 'consult',
    consultation_rescheduled: 'consult',
    consultation_cancelled: 'consult',
    consultation_completed: 'consult',
    payment_request: 'payment',
    payment_request_rejected: 'payment',
    payment_received: 'payment',
    message_received: 'message',
    visa_news: 'news',
  };
  for (const [type, kind] of Object.entries(table)) {
    it(`${type} -> ${kind}`, () => expect(toKind(type)).toBe(kind));
  }
});

describe('bell badge', () => {
  it('number rules', () => {
    expect(badgeText(1)).toBe('1');
    expect(badgeText(9)).toBe('9');
    expect(badgeText(10)).toBe('9+');
    expect(badgeText(250)).toBe('9+');
    for (const bad of [0, -3, NaN, undefined, null, '4']) {
      expect(badgeText(bad)).toBeNull();
    }
  });
  it('accessibility label', () => {
    expect(bellLabel(0)).toBe('Notifications');
    expect(bellLabel(3)).toBe('Notifications, 3 unread');
    expect(bellLabel(12)).toBe('Notifications, more than 9 unread');
  });
  it('renders the number, or nothing', () => {
    let on!: ReturnType<typeof create>;
    let off!: ReturnType<typeof create>;
    act(() => {
      on = create(<UnreadBadge count={12} />);
      off = create(<UnreadBadge count={0} />);
    });
    expect(JSON.stringify(on.toJSON())).toContain('9+');
    expect(off.toJSON()).toBeNull();
  });
});
