// Types for the per-upload document check (issue #115). Mirrors the backend's
// presented check (functions/src/controllers/document-check.controller.ts).
//
// The check is about the DOCUMENT (right type, readable, in date, in the right
// name, covers the period). It never says anything about the application's
// outcome, and a failed check never blocks or rejects an upload.

import type { ChecklistCitation } from '@/types/checklist.type';

/** One check's outcome. `not_applicable`: the rule declares nothing to compare. */
export type CheckOutcome = 'pass' | 'fix' | 'could_not_tell' | 'not_applicable';

/** The five checks, in the order they are shown. */
export const CHECK_KEYS = ['type', 'readable', 'inDate', 'name', 'period'] as const;
export type CheckKey = (typeof CHECK_KEYS)[number];

export interface CheckResult {
  outcome: CheckOutcome;
  code: string;
  /** Plain words built on the server from the real values and dates. */
  message: string;
}

/** `pending`: running now. `not_checked`: no check exists for this document. */
export type DocumentCheckState =
  | 'pending'
  | 'done'
  | 'could_not_check'
  | 'not_checked';

/** One document's check, as a paid caller sees it. */
export interface DocumentCheck {
  documentId: string;
  documentRequestId: string;
  checklistItemId: string;
  state: DocumentCheckState;
  checks: Record<CheckKey, CheckResult> | null;
  /** Why no check could run (set when `state` is `could_not_check`). */
  reason: { code: string; message: string } | null;
  /** The rule behind the item: always shown beside a result. */
  citation: ChecklistCitation | null;
  finishedAt: string | null;
  canRetry: boolean;
}

/** GET /applications/:id/document-checks. A free caller gets no results. */
export type DocumentChecksResponse =
  | { tier: 'free'; state: 'upgrade_required'; message: string; checks: [] }
  | { tier: 'full'; state: 'ok'; checks: DocumentCheck[] };
