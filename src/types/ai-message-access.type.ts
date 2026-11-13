/**
 * AI message access types (issue #172).
 *
 * Mirror of the backend contract (seli-backend: ai-message-access.controller.ts,
 * messaging.controller.ts). Wording is DRAFT: it needs owner or legal sign-off
 * before release, and the client renders whatever text the server returns.
 */

// Firestore Timestamps arrive as `{ _seconds, _nanoseconds }`; read through
// `fmtDate` (liveDate.ts), never `new Date()`.
export type ApiTimestamp = unknown;

/** One versioned block of wording returned by the server. */
export interface AiWording {
  versionId: string;
  /** True until the owner or legal signs the text off. */
  draft: boolean;
  title: string;
  paragraphs: string[];
  text: string;
}

/** GET /users/me/ai-message-access (and the body of every write on it). */
export interface AiMessageAccessState {
  approved: boolean;
  approvedAt: ApiTimestamp | null;
  /** Version of the ACTIVE approval. */
  wordingVersion: string | null;
  /** Exact stored text of the active approval (paragraphs joined by a blank line). */
  wording: string | null;
  hasAiPlan: boolean;
  /** approved || hasAiPlan */
  qualifies: boolean;
  /** hasAiPlan && !approved */
  planOnly: boolean;
  /** "Keep AI out of all my chats". */
  accountWideOff: boolean;
  /** True only for the CURRENT notice version. */
  noticeDismissed: boolean;
  currentApprovalWording: AiWording;
  noticeWording: AiWording;
}

/**
 * Per-conversation access view for the signed-in person. `null` on the
 * conversation means the server could not compute it: unknown, NEVER "on".
 */
export interface ConversationAiAccess {
  /** Effective: off only when my account-wide setting is off (no per-chat switch). */
  myAiAccess: 'on' | 'off';
  accountWideOff: boolean;
  /** Yes/no only: the other person's account-wide setting is off (or they can't be resolved). */
  otherSwitchedOff: boolean;
  /** I have an active approval or an AI plan. */
  qualifies: boolean;
}
