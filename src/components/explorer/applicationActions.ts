// ─────────────────────────────────────────────────────────────────────────────
// Application screen — sticky button decision (japa#307).
//
// Pure helpers that decide what the sticky coral button on
// `/application/:id` says and where it goes. Kept out of the screen so the
// rules can be unit-tested, and so other work on the same screen (japa#259,
// withdraw) can reuse "is this a self-service application / is it closed".
//
// The rules:
//   - Self-service application (mode 'self', no agent, no agency), open
//     status: always a way back into the self-service steps
//     (`/self-service/:id`). "Upload document" while documents are still
//     outstanding, "Continue application" otherwise (counts equal, uploads
//     above the required count, or a visa with no required documents).
//   - Self-service application, closed status: no button (nothing to continue).
//   - Agent-managed application (has an `agentId`): exactly as before
//     japa#307 — the upload CTA opens self-service while documents are
//     outstanding, otherwise "Message your agent" opens the conversation.
//   - Anything else (no agent but not self-service, e.g. `mode: 'agent'` with
//     only an `agencyId`, or `mode: 'self'` with an agency): no button, so
//     "Message your agent" never shows on a case without an agent.
// ─────────────────────────────────────────────────────────────────────────────

import type { Application, ApplicationStatus } from '@/types/applications.type';

// ── Status buckets ───────────────────────────────────────────────────────────
// Statuses after which the applicant has nothing left to do. Every other
// status is open.
const CLOSED_STATUSES: readonly ApplicationStatus[] = [
  'approved',
  'rejected',
  'withdrawn',
  'expired',
];

/** True when the application is finished (approved, rejected, withdrawn, expired). */
export function isClosedStatus(status: ApplicationStatus): boolean {
  return CLOSED_STATUSES.includes(status);
}

// ── Self-service test ────────────────────────────────────────────────────────
/**
 * Same rule as the backend's `isSelfServiceApplication`
 * (seli-backend `functions/src/utils/self-service.ts`): `mode` is 'self' AND
 * no agent AND no agency. Missing data is NOT self-service (fail closed).
 */
export function isSelfServiceApplication(
  app: Pick<Application, 'mode' | 'agentId' | 'agencyId'> | null | undefined,
): boolean {
  if (!app) return false;
  return app.mode === 'self' && !app.agentId && !app.agencyId;
}

// ── Sticky button ────────────────────────────────────────────────────────────
/** Where the sticky button goes: the self-service steps, or the agent chat. */
export type StickyTarget = 'self-service' | 'agent-conversation';

export interface StickyAction {
  /** Button copy (verb-first, sentence case). */
  label: string;
  target: StickyTarget;
}

/** The fields the decision reads (a partial doc is fine). */
export type StickyActionInput = Pick<
  Application,
  | 'mode'
  | 'agentId'
  | 'agencyId'
  | 'status'
  | 'documentsRequired'
  | 'documentsUploaded'
>;

export const STICKY_LABEL_UPLOAD = 'Upload document';
export const STICKY_LABEL_CONTINUE = 'Continue application';
export const STICKY_LABEL_MESSAGE_AGENT = 'Message your agent';

/**
 * The sticky button's label and target, or `null` for no button.
 * See the file header for the rules.
 */
export function stickyAction(
  app: StickyActionInput | null | undefined,
): StickyAction | null {
  if (!app) return null;

  // Documents still outstanding (the same test `mapApplication` uses for its
  // `next.cta`). The counts are not always reliable, which is why the
  // self-service branch below never depends on them for the target.
  const docsOutstanding =
    (app.documentsRequired ?? 0) > (app.documentsUploaded ?? 0);

  // Self-service: always a way back in while the application is open.
  if (isSelfServiceApplication(app)) {
    if (isClosedStatus(app.status)) return null;
    return {
      label: docsOutstanding ? STICKY_LABEL_UPLOAD : STICKY_LABEL_CONTINUE,
      target: 'self-service',
    };
  }

  // Agent-managed: unchanged behaviour (no status check, as before).
  if (app.agentId) {
    return docsOutstanding
      ? { label: STICKY_LABEL_UPLOAD, target: 'self-service' }
      : { label: STICKY_LABEL_MESSAGE_AGENT, target: 'agent-conversation' };
  }

  // No agent and not self-service: nothing sensible to offer.
  return null;
}
