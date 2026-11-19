// ─────────────────────────────────────────────────────────────────────────────
// AI message access: pure UI logic and copy (issue #172).
//
// Everything that DECIDES what the screens show lives here as plain functions,
// so it can be unit-tested without rendering anything:
//   - chatAiIconView: the chat header icon (highlighted or gray) and its label
//   - settingsRowValue / withdrawConfirmBody / approvalMode: settings + approval
//
// Copy is the design spec's wording, verbatim (curly apostrophes). All approval
// and notice wording is a DRAFT that needs owner or legal sign-off before
// release. The wording of the approval itself and of the notice paragraphs is NOT
// here: the server returns it and the screens render what it returns.
//
// Key rule: `aiAccess === null` (or missing) is unknown, never "on".
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AiMessageAccessState,
  ConversationAiAccess,
} from '@/types/ai-message-access.type';

// ── Copy ─────────────────────────────────────────────────────────────────────
export const AI_COPY = {
  // Chat header icon (accessibility labels, #193)
  iconOn: 'AI access on for this chat',
  iconOff: 'AI access off for this chat',

  offline: 'You’re offline. Reconnect to change this.',
  tryAgain: 'Try again',

  // Settings row
  settingsGroup: 'Privacy',
  settingsRow: 'AI message access',
  valueApproved: 'Approved',
  valuePlan: 'Included in your plan',
  valueNotApproved: 'Not approved',
  valueAccountOff: 'Off for all chats',

  // Approval screen
  screenTitle: 'AI message access',
  introDefault:
    'Seli’s AI only reads your messages if you say so. Read the wording below, then approve it if you’re happy.',
  planNote:
    'The plan you’re on includes AI, so Seli’s AI can read the messages you send without a separate approval. You can switch it off for all your chats below.',
  introPlan:
    'You can also approve it yourself. Your approval stays in place if your plan changes.',
  cardApproving: 'What you’re approving',
  cardApproved: 'What you approved',
  infoNote:
    'You stay in control. Keep AI out of all your chats, or withdraw your approval here, whenever you like.',
  approveButton: 'Approve AI access',
  approvedHeading: 'You’ve approved AI message access',
  withdrawButton: 'Withdraw approval',
  confirmTitle: 'Withdraw approval?',
  confirmBody:
    'From now on, Seli’s AI won’t read your messages on the basis of this approval. You can approve again at any time.',
  confirmBodyPlan:
    'The plan you’re on includes AI, so Seli’s AI can still read the messages you send. To stop that everywhere, turn on “Keep AI out of all my chats” here.',
  confirmCancel: 'Cancel',
  confirmWithdraw: 'Withdraw',
  errApprove: 'We couldn’t save your approval. Try again.',
  errWithdraw:
    'We couldn’t withdraw your approval. It’s still in place. Try again.',
  errLoadScreen: 'We couldn’t load your AI message access. Try again.',

  // Account-wide setting
  allChats: 'All chats',
  allChatsTitle: 'Keep AI out of all my chats',
  allChatsOff:
    'Seli’s AI reads your messages only if you’ve approved it or your plan includes it.',
  allChatsOn:
    'Seli’s AI reads none of your messages. This covers new chats too.',
  saving: 'Saving…',
  errAllChatsOn: 'We couldn’t turn this on. Nothing has changed. Try again.',
  errAllChatsOff:
    'We couldn’t turn this off. AI is still kept out of all your chats. Try again.',
  approvalLineAccountOff:
    '“Keep AI out of all my chats” is on, so your messages aren’t read, whatever you’ve approved.',
} as const;

// ── Chat header icon ─────────────────────────────────────────────────────────

/**
 * Highlighted (coral) or gray, plus the spoken label. Highlighted ONLY when the
 * person qualifies (approved or on an AI plan) AND AI access is on for this chat
 * (not off by them, by their all-chats setting, or by the other person).
 * Unknown (`null` / undefined, e.g. still loading) is never highlighted.
 */
export function chatAiIconView(
  aiAccess: ConversationAiAccess | null | undefined,
): { highlighted: boolean; label: string } {
  const highlighted =
    !!aiAccess &&
    aiAccess.qualifies === true && // missing = unknown, never a definite state
    aiAccess.myAiAccess === 'on' &&
    !aiAccess.otherSwitchedOff;
  return {
    highlighted,
    label: highlighted ? AI_COPY.iconOn : AI_COPY.iconOff,
  };
}

// ── Settings row ─────────────────────────────────────────────────────────────

/** The value shown on the Privacy row; undefined while loading or on error. */
export function settingsRowValue(
  state: AiMessageAccessState | undefined,
): string | undefined {
  if (!state) return undefined;
  if (state.accountWideOff) return AI_COPY.valueAccountOff; // wins over the others
  if (state.approved) return AI_COPY.valueApproved;
  if (state.planOnly) return AI_COPY.valuePlan;
  return AI_COPY.valueNotApproved;
}

// ── Approval screen ──────────────────────────────────────────────────────────

/** Which block the approval screen shows. */
export function approvalMode(
  state: AiMessageAccessState,
): 'approved' | 'plan-only' | 'not-approved' {
  if (state.approved) return 'approved';
  return state.planOnly ? 'plan-only' : 'not-approved';
}

/** Confirm body for withdrawing: the plan variant only if the plan still lets AI read. */
export function withdrawConfirmBody(state: AiMessageAccessState): string {
  return state.hasAiPlan && !state.accountWideOff
    ? AI_COPY.confirmBodyPlan
    : AI_COPY.confirmBody;
}

/** Error line for the approve / withdraw call. */
export function approvalError(kind: 'approve' | 'withdraw'): string {
  return kind === 'approve' ? AI_COPY.errApprove : AI_COPY.errWithdraw;
}

/** Error line for the account-wide switch; `off` is the value it tried to set. */
export function accountWideError(off: boolean): string {
  return off ? AI_COPY.errAllChatsOn : AI_COPY.errAllChatsOff;
}
