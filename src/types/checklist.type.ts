// Types for the personal document checklist (issue #114). Mirrors the backend's
// ChecklistView (functions/src/services/ai/checklist.service.ts).

/** Lifecycle of the stored request behind an item (null = not generated yet). */
export type ChecklistRequestStatus =
  | 'pending'
  | 'fulfilled'
  | 'waived'
  | 'cancelled';

/** Verbatim quote + official URL behind an item. Never model-written. */
export interface ChecklistCitation {
  quote: string;
  url: string;
  ruleRef?: string;
}

export interface ChecklistItem {
  checklistItemId: string;
  title: string;
  /** Whose document it is. Sponsor documents are uploaded by the applicant. */
  holder: 'applicant' | 'sponsor';
  required: boolean;
  reason: string;
  citation: ChecklistCitation;
  /** The DocumentRequest to upload against (null until generated). */
  documentRequestId: string | null;
  status: ChecklistRequestStatus | null;
  fulfilledDocumentId?: string;
  /** False = fulfilled earlier, no longer asked for after an answer changed. */
  current: boolean;
}

export type ChecklistState = 'ready' | 'intake_needed' | 'no_checklist';

export interface Checklist {
  state: ChecklistState;
  emptyReason?: string;
  rubricVersion: number | null;
  items: ChecklistItem[];
}
