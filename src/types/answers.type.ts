// Types for the applicant's typed answers to "information" checklist items
// (issue #187). Mirrors the backend contract:
//   GET /applications/:id/answers          -> { answers: { [itemId]: { value, updatedAt } } }
//   PUT /applications/:id/answers/:itemId  body { value }  (shape by the item's answerType,
//                                          see components/explorer/answerTypes.ts)
// A legacy answer may come back as a plain string for any type.
// These are personal details: never log them. Unsaved text may be kept on the
// device ONLY in the encrypted vault (services/draftVault.ts), never AsyncStorage.

import type { AnswerValue } from '@/components/explorer/answerTypes';

/** Longest answer the server accepts (characters, after trimming). */
export const ANSWER_MAX_LENGTH = 2000;

/** One saved answer. */
export interface SavedAnswer {
  /** Typed value (a plain string = legacy / text). */
  value: AnswerValue;
  /** The item's type when saved / re-read. */
  answerType?: string;
  /** Plain rendering of the value. */
  text?: string;
  /** Server re-read an old plain-text answer into this type's shape. */
  legacy?: true;
  /** ISO time of the last save. */
  updatedAt: string;
}

/** GET response: saved answers by checklist item id (missing id = no answer). */
export interface AnswersResponse {
  answers: Record<string, SavedAnswer>;
}

/** PUT response. */
export interface SaveAnswerResponse {
  itemId: string;
  value?: AnswerValue;
  updatedAt: string;
}
