// ─────────────────────────────────────────────────────────────────────────────
// Ask-anywhere chat — wire types (issue #45).
// Mirrors the backend contract in functions/src/types/ai-chat.ts. Read-only
// shapes: the app never builds a citation or an answer itself.
// ─────────────────────────────────────────────────────────────────────────────

/** What kind of reply an assistant message is (drives the empty states). */
export type ChatReplyKind =
  | 'answer'
  | 'no_assessment'
  | 'assessment_pending'
  | 'no_rubric'
  | 'declined'
  | 'withheld';

/** One citation, copied from the approved rubric by the server. */
export interface ChatCitation {
  criterionId: string;
  title: string;
  ruleRef: string | null;
  sourceUrl: string;
  sourceQuote: string;
}

/** POST /ai/applications/:id/chat → 200 body (inside `data`). */
export interface ChatReply {
  id: string;
  answer: string;
  kind: ChatReplyKind;
  // True when the server wants the UI to offer running a review.
  offerAssessment: boolean;
  // True when the stored review is older than the application's current state.
  outdated: boolean;
  citations: ChatCitation[];
  // Serialised timestamp (ISO string or Firestore {_seconds}); parse with toDate.
  createdAt: unknown;
}

/** One stored turn from GET /ai/applications/:id/chat (oldest first). */
export interface ChatHistoryMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  kind: ChatReplyKind | null;
  citations: ChatCitation[];
  createdAt: unknown;
}

export interface ChatHistory {
  messages: ChatHistoryMessage[];
}
