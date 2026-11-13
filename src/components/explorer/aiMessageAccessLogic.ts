// ─────────────────────────────────────────────────────────────────────────────
// AI message access: pure UI logic and copy (issue #172).
//
// Everything that DECIDES what the screens show lives here as plain functions,
// so it can be unit-tested without rendering anything:
//   - chatAiIconView: the chat header icon (highlighted or gray) and its label
//   - chatSwitchView: the "This chat" switch on the AI settings screen
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

  // "This chat" row on the AI settings screen (shown only when opened from a chat)
  thisChat: 'This chat',
  chatSwitchTitle: 'AI access in this chat',
  chatOtherOff: 'The other person has switched it off.',
  chatOtherOffBoth: 'The other person has switched it off too.',
  errSwitchOff: 'We couldn’t switch AI access off. It’s still on. Try again.',
  errSwitchOn: 'We couldn’t switch AI access on. It’s still off. Try again.',
  errForbidden: 'You can’t change AI access for this chat.',
  errChatLoad: 'We couldn’t load AI access for this chat.',
  loading: 'Checking…',
  switchingOff: 'Switching off…',
  switchingOn: 'Switching on…',
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
    'The plan you’re on includes AI, so Seli’s AI can read the messages you send without a separate approval. You can switch it off in any chat, or for all your chats below.',
  introPlan:
    'You can also approve it yourself. Your approval stays in place if your plan changes.',
  cardApproving: 'What you’re approving',
  cardApproved: 'What you approved',
  infoNote:
    'You stay in control. Switch AI access off in any chat, keep AI out of all your chats, or withdraw your approval here, whenever you like.',
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
  allChatsOff: 'AI access follows each chat’s own switch.',
  allChatsOn:
    'Seli’s AI reads none of your messages, and every chat you’re in counts as switched off by you. This covers new chats too.',
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
    aiAccess.qualifies &&
    aiAccess.myAiAccess === 'on' &&
    !aiAccess.otherSwitchedOff;
  return {
    highlighted,
    label: highlighted ? AI_COPY.iconOn : AI_COPY.iconOff,
  };
}

// ── "This chat" row on the settings screen ───────────────────────────────────

export interface ChatSwitchInput {
  aiAccess: ConversationAiAccess | null | undefined;
  /** A switch call is in flight: the `off` it is trying to set. */
  saving: { off: boolean } | null;
  offline: boolean;
  /** The last switch call failed: the `off` it tried, and the HTTP status. */
  saveError: { off: boolean; status?: number } | null;
}

export interface ChatSwitchView {
  /** Shown position: MY side (the OLD value while saving: not optimistic). */
  value: boolean;
  disabled: boolean;
  busy: boolean;
  /** One short line under the title; null when there is nothing to say. */
  helper: string | null;
  error: string | null;
  /** The `off` to send when toggled. */
  nextOff: boolean;
}

/** State of the per-chat switch; null while `aiAccess` is unknown. */
export function chatSwitchView(i: ChatSwitchInput): ChatSwitchView | null {
  const a = i.aiAccess;
  if (!a) return null;
  const on = a.myAiAccess === 'on';
  let helper: string | null = null;
  if (i.saving)
    helper = i.saving.off ? AI_COPY.switchingOff : AI_COPY.switchingOn;
  else if (i.offline) helper = AI_COPY.offline;
  else if (a.otherSwitchedOff)
    helper = on ? AI_COPY.chatOtherOff : AI_COPY.chatOtherOffBoth;
  let error: string | null = null;
  if (i.saveError && !i.offline)
    error =
      i.saveError.status === 403
        ? AI_COPY.errForbidden
        : i.saveError.off
          ? AI_COPY.errSwitchOff
          : AI_COPY.errSwitchOn;
  return {
    value: on,
    // The all-chats setting owns the state while it is on (switch lives below).
    disabled: !!i.saving || i.offline || a.accountWideOff,
    busy: !!i.saving,
    helper,
    error,
    nextOff: on,
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
