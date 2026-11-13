// ─────────────────────────────────────────────────────────────────────────────
// AI message access: pure UI logic and copy (issue #172).
//
// Everything that DECIDES what the screens show lives here as plain functions,
// so it can be unit-tested without rendering anything:
//   - pickBarState: the AI access bar, from (aiAccess, load/save status, offline)
//   - shouldShowNotice: the one-time notice
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
  barTitle: 'AI access to this chat',
  barTitleNotActive: 'AI access: not active',
  on: 'On. Seli’s AI can read the messages you send here.',
  offByMe: 'Off. Nothing in this chat is read by Seli’s AI.',
  offByOther:
    'The other person in this chat has switched AI access off, so nothing here is read. Your own switch is still on.',
  offByBoth:
    'Off. Nothing in this chat is read by Seli’s AI. The other person has switched it off too.',
  notActive:
    'Seli’s AI doesn’t read your messages. Approve it if you’d like it to.',
  reviewLink: 'Review and approve',
  loading: 'Checking…',
  switchingOff: 'Switching off…',
  switchingOn: 'Switching on…',
  offline: 'You’re offline. Reconnect to change this.',
  errSwitchOff: 'We couldn’t switch AI access off. It’s still on. Try again.',
  errSwitchOn: 'We couldn’t switch AI access on. It’s still off. Try again.',
  errLoad: 'We couldn’t load AI access for this chat. Try again.',
  tryAgain: 'Try again',
  errForbidden: 'You can’t change AI access for this chat.',
  switchLabel: 'AI access to this chat',

  // Not-active bar, row 2 ("Keep AI out of this chat"; switch on = my side off)
  keepOutTitle: 'Keep AI out of this chat',
  keepOutNone:
    'The other person’s messages here may still be read, if they’ve allowed it.',
  keepOutMine:
    'AI is kept out. Nothing in this chat is read, including the other person’s messages.',
  keepOutOther:
    'The other person in this chat has switched AI access off, so nothing here is read.',
  keepOutBoth:
    'AI is kept out. Nothing in this chat is read. The other person has switched it off too.',
  keepingOut: 'Keeping AI out…',
  lettingIn: 'Letting AI back in…',
  errKeepOut:
    'We couldn’t keep AI out of this chat. Nothing has changed. Try again.',
  errLetIn:
    'We couldn’t change this. AI is still kept out of this chat. Try again.',

  // Bar while the account-wide setting is on
  accountOff:
    'Off for all your chats. You’ve kept AI out of every chat in your settings.',
  changeInSettings: 'Change in settings',

  // One-time notice (paragraphs and title come from the server)
  noticeNote:
    'You’ll find this switch at the top of every chat. To keep AI out of all your chats at once, go to AI message access in your settings.',
  noticeButton: 'Got it',

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

// ── Bar state ────────────────────────────────────────────────────────────────

/** What the right slot's switch shows and does. */
export interface BarSwitch {
  /** The position shown (the OLD value while saving: switches are not optimistic). */
  value: boolean;
  /** Greyed out (60%): saving, offline, or account-wide. */
  disabled: boolean;
  /** Small coral spinner to the switch's left. */
  busy: boolean;
  /** Accessibility label. */
  label: string;
  /** The `off` to send when it is toggled (my side of the chat switch). */
  nextOff: boolean;
}

export interface BarInput {
  /** `conversation.aiAccess`: object, `null` (server could not compute), or undefined. */
  aiAccess: ConversationAiAccess | null | undefined;
  /** The conversation response is in the cache. */
  conversationLoaded: boolean;
  /** The conversation query failed (and nothing is cached to show). */
  loadFailed: boolean;
  /** Treat the app as offline (see utils/networkStatus). */
  offline: boolean;
  /** A switch call is in flight: the `off` value it is trying to set. */
  saving: { off: boolean } | null;
  /** The last switch call failed: the `off` it tried, and the HTTP status (0 = no answer). */
  saveError: { off: boolean; status?: number } | null;
}

export type BarView =
  | { kind: 'loading'; title: string; helper: string }
  | { kind: 'load-error'; title: string; error: string; link: string }
  | {
      kind: 'account-off';
      title: string;
      helper: string;
      switch: BarSwitch;
      link: string;
    }
  | {
      kind: 'standard';
      title: string;
      helper: string;
      switch: BarSwitch;
      error: string | null;
    }
  | {
      kind: 'not-active';
      title: string;
      helper: string;
      link: string;
      row2: {
        title: string;
        helper: string;
        switch: BarSwitch;
        error: string | null;
      };
    };

/** The error line for a failed switch call; the 403 line wins over the generic one. */
function errorLine(
  e: BarInput['saveError'],
  mode: 'standard' | 'keep-out',
): string | null {
  if (!e) return null;
  if (e.status === 403) return AI_COPY.errForbidden;
  if (mode === 'standard')
    return e.off ? AI_COPY.errSwitchOff : AI_COPY.errSwitchOn;
  return e.off ? AI_COPY.errKeepOut : AI_COPY.errLetIn;
}

/**
 * Choose what the AI access bar shows. Precedence:
 *   loading → load error (incl. aiAccess null/missing) → account-wide off →
 *   not active (does not qualify) → standard.
 * Within a state: saving → offline → the plain state line.
 */
export function pickBarState(i: BarInput): BarView {
  const title = AI_COPY.barTitle;

  // 1. Still loading the conversation.
  if (!i.conversationLoaded && !i.loadFailed)
    return { kind: 'loading', title, helper: AI_COPY.loading };

  // 2. Could not load, or the server could not compute it: unknown, never "on".
  if (!i.conversationLoaded || !i.aiAccess)
    return {
      kind: 'load-error',
      title,
      error: AI_COPY.errLoad,
      link: AI_COPY.tryAgain,
    };

  const a = i.aiAccess;
  const mineOn = a.myAiAccess === 'on';
  // An error from a call that failed because we are offline would only repeat
  // what the offline line already says.
  const showError = !i.offline;

  // 3. Account-wide setting on: one row, switch shown off and disabled. The
  //    chat's own value is kept by the server and returns when it is turned off.
  if (a.accountWideOff) {
    return {
      kind: 'account-off',
      title,
      helper: AI_COPY.accountOff,
      switch: {
        value: false,
        disabled: true,
        busy: false,
        label: AI_COPY.switchLabel,
        nextOff: false,
      },
      link: AI_COPY.changeInSettings,
    };
  }

  // 4. Does not qualify: "not active" row plus the "Keep AI out" row. Switch on
  //    = my side is off, so the polarity is the reverse of the standard bar.
  if (!a.qualifies) {
    const keptOut = !mineOn;
    let helper: string;
    if (i.saving)
      helper = i.saving.off ? AI_COPY.keepingOut : AI_COPY.lettingIn;
    else if (i.offline) helper = AI_COPY.offline;
    else if (keptOut)
      helper = a.otherSwitchedOff ? AI_COPY.keepOutBoth : AI_COPY.keepOutMine;
    else
      helper = a.otherSwitchedOff ? AI_COPY.keepOutOther : AI_COPY.keepOutNone;
    return {
      kind: 'not-active',
      title: AI_COPY.barTitleNotActive,
      helper: AI_COPY.notActive,
      link: AI_COPY.reviewLink,
      row2: {
        title: AI_COPY.keepOutTitle,
        helper,
        switch: {
          value: keptOut,
          disabled: !!i.saving || i.offline,
          busy: !!i.saving,
          label: AI_COPY.keepOutTitle,
          nextOff: !keptOut,
        },
        error: showError ? errorLine(i.saveError, 'keep-out') : null,
      },
    };
  }

  // 5. Qualifies: the ordinary one-row bar. Switch on = AI may read this chat.
  let helper: string;
  if (i.saving)
    helper = i.saving.off ? AI_COPY.switchingOff : AI_COPY.switchingOn;
  else if (i.offline) helper = AI_COPY.offline;
  else if (mineOn)
    helper = a.otherSwitchedOff ? AI_COPY.offByOther : AI_COPY.on;
  else helper = a.otherSwitchedOff ? AI_COPY.offByBoth : AI_COPY.offByMe;
  return {
    kind: 'standard',
    title,
    helper,
    switch: {
      value: mineOn,
      disabled: !!i.saving || i.offline,
      busy: !!i.saving,
      label: AI_COPY.switchLabel,
      nextOff: mineOn,
    },
    error: showError ? errorLine(i.saveError, 'standard') : null,
  };
}

// ── One-time notice ──────────────────────────────────────────────────────────

/**
 * Show the notice only to plan-only people who have not dismissed it, on a live
 * chat. `dismissedHere` covers the gap between tapping "Got it" and the server's
 * answer (and a failed record, which retries on the next chat open).
 */
export function shouldShowNotice(
  state: Pick<AiMessageAccessState, 'planOnly' | 'noticeDismissed'> | undefined,
  dismissedHere: boolean,
  isLiveChat: boolean,
): boolean {
  return (
    !!state &&
    isLiveChat &&
    state.planOnly &&
    !state.noticeDismissed &&
    !dismissedHere
  );
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
