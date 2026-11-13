// Types for the applicant's typed answers to "information" checklist items
// (issue #187). Mirrors the backend contract:
//   GET /applications/:id/answers          -> { answers: { [itemId]: { text, updatedAt } } }
//   PUT /applications/:id/answers/:itemId  -> { itemId, text, updatedAt }   body { text }
// These are personal details: never log them. Unsaved text may be kept on the
// device ONLY in the encrypted vault (services/draftVault.ts), never AsyncStorage.

/** Longest answer the server accepts (characters, after trimming). */
export const ANSWER_MAX_LENGTH = 2000;

/** One saved answer. */
export interface SavedAnswer {
  text: string;
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
  text: string;
  updatedAt: string;
}
