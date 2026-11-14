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

/** What the item is: a file to upload, or a detail to type (issue #187). */
export type ChecklistItemKind = 'document' | 'information';

/**
 * How much the applicant needs it (issue #187). `conditional` items carry the
 * verbatim clause that makes them conditional in `appliesWhen`.
 */
export type ChecklistNeed = 'required' | 'conditional' | 'optional';

export interface ChecklistItem {
  checklistItemId: string;
  title: string;
  /** Whose document it is. Sponsor documents are uploaded by the applicant. */
  holder: 'applicant' | 'sponsor';
  /** Kept for compatibility: true only when `need === 'required'`. */
  required: boolean;
  /**
   * #187. Older responses (and older cached lists) have none of these four:
   * a missing `kind` is a document, a missing `need` is derived from `required`
   * (see checklistLogic.ts).
   */
  kind?: ChecklistItemKind;
  /** True = the server could not classify it, so it stays a document. */
  kindReview?: true;
  /** Verbatim lead-in or item text the `kind` was decided from. */
  kindQuote?: string;
  /** Information items: which input to show. Missing / unknown = 'text'. */
  answerType?: 'date' | 'date_range' | 'money' | 'address' | 'list' | 'text';
  need?: ChecklistNeed;
  /** Verbatim "if ..." / "unless ..." clause, or the "Depending on..." lead-in. */
  appliesWhen?: string;
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
