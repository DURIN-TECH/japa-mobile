// ─────────────────────────────────────────────────────────────────────────────
// Unit tests: the application screen's sticky button (japa#307).
// One block per acceptance-criteria row: self-service open with documents
// outstanding / none outstanding / no required documents, self-service
// closed, no-agent non-self-service, and agent-managed (unchanged).
//
// japa#259 (withdraw), at the end of the file: the action's visibility rule
// (self-service + open only), the list filter dropping `withdrawn`, the 409
// test and the confirmation copy.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from '@jest/globals';
import {
  WITHDRAW_CONFIRM_ACTION,
  WITHDRAW_CONFIRM_CANCEL,
  WITHDRAW_CONFIRM_MESSAGE,
  WITHDRAW_CONFIRM_TITLE,
  WITHDRAW_ERROR_MESSAGE,
  WITHDRAW_LABEL,
  canWithdraw,
  isAlreadyClosedError,
  isClosedStatus,
  isSelfServiceApplication,
  stickyAction,
  withoutWithdrawn,
  type StickyActionInput,
} from '../applicationActions';
import type { ApplicationStatus } from '@/types/applications.type';

// A self-service case with 6 of 6 documents uploaded, under review.
const app = (over: Partial<StickyActionInput> = {}): StickyActionInput => ({
  mode: 'self',
  agentId: undefined,
  agencyId: undefined,
  status: 'under_review',
  documentsRequired: 6,
  documentsUploaded: 6,
  ...over,
});

const OPEN: ApplicationStatus[] = [
  'draft',
  'pending_payment',
  'pending_documents',
  'under_review',
  'submitted_to_embassy',
  'interview_scheduled',
];
const CLOSED: ApplicationStatus[] = [
  'approved',
  'rejected',
  'withdrawn',
  'expired',
];

describe('isClosedStatus', () => {
  it.each(CLOSED)('%s is closed', (s) => expect(isClosedStatus(s)).toBe(true));
  it.each(OPEN)('%s is open', (s) => expect(isClosedStatus(s)).toBe(false));
});

describe('isSelfServiceApplication', () => {
  it('is true for mode self with no agent and no agency', () => {
    expect(isSelfServiceApplication(app())).toBe(true);
  });
  it('is false for mode self with an agency (not self-service)', () => {
    expect(isSelfServiceApplication(app({ agencyId: 'ag1' }))).toBe(false);
  });
  it('is false for mode self with an agent', () => {
    expect(isSelfServiceApplication(app({ agentId: 'a1' }))).toBe(false);
  });
  it('is false for mode agent', () => {
    expect(isSelfServiceApplication(app({ mode: 'agent' }))).toBe(false);
  });
  it('fails closed on missing data', () => {
    expect(isSelfServiceApplication(undefined)).toBe(false);
    expect(isSelfServiceApplication(null)).toBe(false);
  });
});

describe('stickyAction — self-service, open status', () => {
  it('documents outstanding → "Upload document" to self-service', () => {
    expect(
      stickyAction(app({ documentsRequired: 13, documentsUploaded: 2 })),
    ).toEqual({ label: 'Upload document', target: 'self-service' });
  });
  it('counts equal → "Continue application" to self-service', () => {
    expect(stickyAction(app())).toEqual({
      label: 'Continue application',
      target: 'self-service',
    });
  });
  it('uploads above the required count → "Continue application"', () => {
    expect(
      stickyAction(app({ documentsRequired: 6, documentsUploaded: 8 })),
    ).toEqual({ label: 'Continue application', target: 'self-service' });
  });
  it('visa with documentsRequired 0 → "Continue application"', () => {
    expect(
      stickyAction(app({ documentsRequired: 0, documentsUploaded: 0 })),
    ).toEqual({ label: 'Continue application', target: 'self-service' });
  });
  it.each(OPEN)('%s keeps the way back in', (status) => {
    expect(stickyAction(app({ status }))?.target).toBe('self-service');
  });
});

describe('stickyAction — self-service, closed status', () => {
  it.each(CLOSED)('%s → no button', (status) => {
    expect(stickyAction(app({ status }))).toBeNull();
    // Also with documents outstanding: still nothing to continue.
    expect(
      stickyAction(app({ status, documentsRequired: 5, documentsUploaded: 1 })),
    ).toBeNull();
  });
});

describe('stickyAction — no agent, not self-service', () => {
  it('mode agent with only an agencyId → no button', () => {
    expect(stickyAction(app({ mode: 'agent', agencyId: 'ag1' }))).toBeNull();
  });
  it('mode self with an agencyId → no button (not self-service)', () => {
    expect(stickyAction(app({ agencyId: 'ag1' }))).toBeNull();
  });
  it('never says "Message your agent" without an agentId', () => {
    const cases = [
      app({ mode: 'agent' }),
      app({ mode: 'agent', agencyId: 'ag1', documentsUploaded: 0 }),
      app({ agencyId: 'ag1' }),
      ...CLOSED.map((status) => app({ status })),
    ];
    for (const c of cases) {
      expect(stickyAction(c)?.label).not.toBe('Message your agent');
    }
  });
});

describe('stickyAction — agent-managed (unchanged)', () => {
  const agentCase = (over: Partial<StickyActionInput> = {}) =>
    app({ mode: 'agent', agentId: 'a1', agencyId: 'ag1', ...over });

  it('documents outstanding → "Upload document" to self-service', () => {
    expect(stickyAction(agentCase({ documentsUploaded: 2 }))).toEqual({
      label: 'Upload document',
      target: 'self-service',
    });
  });
  it('no documents outstanding → "Message your agent"', () => {
    expect(stickyAction(agentCase())).toEqual({
      label: 'Message your agent',
      target: 'agent-conversation',
    });
  });
  it('closed status behaves as before (no status check)', () => {
    expect(stickyAction(agentCase({ status: 'approved' }))).toEqual({
      label: 'Message your agent',
      target: 'agent-conversation',
    });
  });
  it('mode self with an agent is agent-managed', () => {
    expect(stickyAction(app({ agentId: 'a1' }))?.label).toBe(
      'Message your agent',
    );
  });
});

describe('stickyAction — missing data', () => {
  it('no case → no button', () => {
    expect(stickyAction(undefined)).toBeNull();
    expect(stickyAction(null)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// japa#259: withdraw
// ─────────────────────────────────────────────────────────────────────────────

describe('canWithdraw — the "Withdraw application" action', () => {
  it.each(OPEN)('self-service, %s (open) → shown', (status) => {
    expect(canWithdraw(app({ status }))).toBe(true);
  });
  it.each(CLOSED)('self-service, %s (closed) → hidden', (status) => {
    expect(canWithdraw(app({ status }))).toBe(false);
  });
  it.each(OPEN)('agent-managed, %s → hidden', (status) => {
    expect(
      canWithdraw(
        app({ mode: 'agent', agentId: 'a1', agencyId: 'ag1', status }),
      ),
    ).toBe(false);
  });
  it('mode self with an agent or an agency is not self-service → hidden', () => {
    expect(canWithdraw(app({ agentId: 'a1' }))).toBe(false);
    expect(canWithdraw(app({ agencyId: 'ag1' }))).toBe(false);
  });
  it('mode agent with no agent yet → hidden', () => {
    expect(canWithdraw(app({ mode: 'agent' }))).toBe(false);
  });
  it('no case loaded → hidden', () => {
    expect(canWithdraw(undefined)).toBe(false);
    expect(canWithdraw(null)).toBe(false);
  });
  it('a withdrawn application has neither the action nor a sticky button', () => {
    const withdrawn = app({ status: 'withdrawn' });
    expect(canWithdraw(withdrawn)).toBe(false);
    expect(stickyAction(withdrawn)).toBeNull();
  });
});

describe('withoutWithdrawn — the list filter', () => {
  const row = (id: string, status: ApplicationStatus) => ({ id, status });

  it('drops withdrawn applications and keeps every other status, in order', () => {
    const all = [...OPEN, ...CLOSED].map((s) => row(s, s));
    expect(withoutWithdrawn(all).map((a) => a.id)).toEqual([
      ...OPEN,
      'approved',
      'rejected',
      'expired',
    ]);
  });
  it('a user whose only application is withdrawn gets an empty list', () => {
    expect(withoutWithdrawn([row('a', 'withdrawn')])).toEqual([]);
  });
  it('an empty list stays empty, and the input is not mutated', () => {
    expect(withoutWithdrawn([])).toEqual([]);
    const input = [row('a', 'withdrawn'), row('b', 'draft')];
    withoutWithdrawn(input);
    expect(input).toHaveLength(2);
  });
});

describe('isAlreadyClosedError — the backend 409 on a closed application', () => {
  it('is true for a 409', () => {
    expect(
      isAlreadyClosedError({ status: 409, code: 'INVALID_STATUS_TRANSITION' }),
    ).toBe(true);
  });
  it('is false for network (status 0), server and other errors', () => {
    expect(isAlreadyClosedError({ status: 0 })).toBe(false);
    expect(isAlreadyClosedError({ status: 500 })).toBe(false);
    expect(isAlreadyClosedError({ status: 403 })).toBe(false);
    expect(isAlreadyClosedError(new Error('boom'))).toBe(false);
    expect(isAlreadyClosedError(undefined)).toBe(false);
  });
});

describe('withdraw copy (issue #259, verbatim)', () => {
  it('matches the acceptance criteria', () => {
    expect(WITHDRAW_LABEL).toBe('Withdraw application');
    expect(WITHDRAW_CONFIRM_TITLE).toBe('Withdraw this application?');
    expect(WITHDRAW_CONFIRM_MESSAGE).toBe(
      'It leaves your journey and stops counting toward your plan. You can’t undo this.',
    );
    expect(WITHDRAW_CONFIRM_CANCEL).toBe('Cancel');
    expect(WITHDRAW_CONFIRM_ACTION).toBe('Withdraw');
    expect(WITHDRAW_ERROR_MESSAGE).toBe(
      'We couldn’t withdraw this application. Check your connection and try again.',
    );
  });
});
