// ─────────────────────────────────────────────────────────────────────────────
// Pure checklist logic (issues #114, #115, #187): need labels, the state of an
// item, and the progress counts. No React, no network: unit-tested directly.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Checklist,
  ChecklistItem,
  ChecklistNeed,
} from '@/types/checklist.type';
import type { Document } from '@/types/documents.type';
import type { SavedAnswer } from '@/types/answers.type';
import {
  isAnswerValueNonEmpty,
  normaliseAnswerType,
} from '@/components/explorer/answerTypes';

/** The `requirementId` the backend gives an upload made against a request. */
export const checklistRequirementId = (documentRequestId: string) =>
  `docreq:${documentRequestId}`;

// ── Kind ──────────────────────────────────────────────────────────────────────

/**
 * True for a typed-detail item. A missing `kind` is a document, and a
 * `kindReview` item (the server could not classify it) is ALWAYS a document,
 * even if `kind` somehow says otherwise: nothing extra is shown to the applicant.
 */
export function isInformationItem(item: ChecklistItem): boolean {
  return item.kind === 'information' && !item.kindReview;
}

// ── Need ──────────────────────────────────────────────────────────────────────

/** The item's need. Older responses have none: fall back to `required`. */
export function needOf(item: ChecklistItem): ChecklistNeed {
  if (
    item.need === 'required' ||
    item.need === 'conditional' ||
    item.need === 'optional'
  )
    return item.need;
  return item.required ? 'required' : 'optional';
}

/** The label under the title. */
export function needLabel(need: ChecklistNeed): string {
  if (need === 'required') return 'Required';
  if (need === 'conditional') return 'If it applies to you';
  return 'Optional';
}

/**
 * The clause shown under a conditional label, verbatim apart from ONE trailing
 * colon (the "Depending on your circumstances, you might also need to provide:"
 * lead-in). Null for any other need, or when there is no clause.
 */
export function appliesWhenText(item: ChecklistItem): string | null {
  if (needOf(item) !== 'conditional') return null;
  const raw = item.appliesWhen?.trim();
  if (!raw) return null;
  return raw.replace(/:$/, '');
}

// ── Item state ────────────────────────────────────────────────────────────────

/** What the applicant sees for an item. */
export type ItemState =
  | 'waiting'
  | 'uploaded'
  | 'accepted'
  | 'needs_another'
  | 'answered'
  | 'not_needed';

/** The latest document (list is newest first) uploaded against a document item. */
export function latestDocFor(item: ChecklistItem, docs: Document[]) {
  if (!item.documentRequestId) return undefined;
  return docs.find(
    (d) => d.requirementId === checklistRequirementId(item.documentRequestId!),
  );
}

/**
 * True when the saved answer has content for the item's type (#187): a date
 * range needs both dates, an address its required fields, money an amount, a
 * list one non-blank entry. A legacy plain string counts when it has text.
 */
export const hasAnswer = (item: ChecklistItem, a?: SavedAnswer | null) =>
  !!a && isAnswerValueNonEmpty(normaliseAnswerType(item.answerType), a.value);

/**
 * Derive the state. Information items: Answered when there is a non-empty SAVED
 * answer (an unsaved draft does not count), else Waiting. Documents: from the
 * request status and the latest document on it.
 */
export function itemState(
  item: ChecklistItem,
  docs: Document[],
  answers?: Record<string, SavedAnswer> | null,
): ItemState {
  if (item.status === 'waived') return 'not_needed';
  if (isInformationItem(item))
    return hasAnswer(item, answers?.[item.checklistItemId])
      ? 'answered'
      : 'waiting';
  if (!item.documentRequestId) return 'waiting';
  const doc = latestDocFor(item, docs);
  if (!doc) return 'waiting';
  if (doc.status === 'verified') return 'accepted';
  if (doc.status === 'rejected' || doc.status === 'resubmission_required')
    return 'needs_another';
  return 'uploaded';
}

// ── Progress ──────────────────────────────────────────────────────────────────

export interface ChecklistProgress {
  /** Document items uploaded or accepted (any need). */
  uploaded: number;
  /** Document items accepted. */
  verified: number;
  /** Information items with a saved answer (any need). */
  answered: number;
  /** Required items, both kinds. */
  required: number;
  /** Done required items / required items, 0 when there are none. */
  fraction: number;
  /** True when the list has at least one information item (shows "Answered"). */
  hasInformation: boolean;
}

/**
 * Counts for the progress card, from the checklist (design spec, section 3).
 * Counted items: current and not waived. The bar counts REQUIRED items of both
 * kinds only (conditional and optional items never hold progress back).
 */
export function computeProgress(
  checklist: Checklist,
  docs: Document[],
  answers: Record<string, SavedAnswer>,
): ChecklistProgress {
  const counted = checklist.items.filter(
    (i) => i.current && i.status !== 'waived',
  );
  let uploaded = 0;
  let verified = 0;
  let answered = 0;
  let required = 0;
  let requiredDone = 0;
  for (const item of counted) {
    const state = itemState(item, docs, answers);
    const done =
      state === 'uploaded' || state === 'accepted' || state === 'answered';
    if (state === 'uploaded' || state === 'accepted') uploaded++;
    if (state === 'accepted') verified++;
    if (state === 'answered') answered++;
    if (needOf(item) === 'required') {
      required++;
      if (done) requiredDone++;
    }
  }
  return {
    uploaded,
    verified,
    answered,
    required,
    fraction: required === 0 ? 0 : requiredDone / required,
    hasInformation: counted.some(isInformationItem),
  };
}
