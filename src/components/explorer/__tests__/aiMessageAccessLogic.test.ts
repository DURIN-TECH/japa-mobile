// ─────────────────────────────────────────────────────────────────────────────
// Pure UI logic of the AI message access feature (issue #172): which bar state
// shows for (aiAccess, load/save status, offline), when the one-time notice
// shows, and the settings / approval helpers. Copy is asserted verbatim.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from '@jest/globals';
import {
  AI_COPY,
  approvalMode,
  pickBarState,
  settingsRowValue,
  shouldShowNotice,
  withdrawConfirmBody,
  type BarInput,
} from '../aiMessageAccessLogic';
import type {
  AiMessageAccessState,
  ConversationAiAccess,
} from '@/types/ai-message-access.type';

const access = (
  o: Partial<ConversationAiAccess> = {},
): ConversationAiAccess => ({
  myAiAccess: 'on',
  myChatSwitchOff: false,
  accountWideOff: false,
  otherSwitchedOff: false,
  qualifies: true,
  ...o,
});

const bar = (o: Partial<BarInput> = {}) =>
  pickBarState({
    aiAccess: access(),
    conversationLoaded: true,
    loadFailed: false,
    offline: false,
    saving: null,
    saveError: null,
    ...o,
  });

const wording = {
  versionId: 'v',
  draft: true,
  title: 't',
  paragraphs: [],
  text: '',
};
const userState = (
  o: Partial<AiMessageAccessState> = {},
): AiMessageAccessState => ({
  approved: false,
  approvedAt: null,
  wordingVersion: null,
  wording: null,
  hasAiPlan: false,
  qualifies: false,
  planOnly: false,
  accountWideOff: false,
  noticeDismissed: false,
  currentApprovalWording: wording,
  noticeWording: wording,
  ...o,
});

describe('pickBarState: qualifying person (standard bar)', () => {
  it('on: mine on, other on', () => {
    const v = bar();
    expect(v.kind).toBe('standard');
    if (v.kind !== 'standard') return;
    expect(v.title).toBe('AI access to this chat');
    expect(v.helper).toBe(AI_COPY.on);
    expect(v.switch).toMatchObject({
      value: true,
      disabled: false,
      nextOff: true,
    });
  });

  it('off by me: mine off, other on', () => {
    const v = bar({
      aiAccess: access({ myAiAccess: 'off', myChatSwitchOff: true }),
    });
    if (v.kind !== 'standard') throw new Error(v.kind);
    expect(v.helper).toBe('Off. Nothing in this chat is read by Seli’s AI.');
    expect(v.switch).toMatchObject({ value: false, nextOff: false });
  });

  it('off by the other person: line shown, my switch still on and usable', () => {
    const v = bar({ aiAccess: access({ otherSwitchedOff: true }) });
    if (v.kind !== 'standard') throw new Error(v.kind);
    expect(v.helper).toBe(AI_COPY.offByOther);
    expect(v.switch).toMatchObject({ value: true, disabled: false });
  });

  it('off by both', () => {
    const v = bar({
      aiAccess: access({
        myAiAccess: 'off',
        myChatSwitchOff: true,
        otherSwitchedOff: true,
      }),
    });
    if (v.kind !== 'standard') throw new Error(v.kind);
    expect(v.helper).toBe(AI_COPY.offByBoth);
    expect(v.switch.value).toBe(false);
  });
});

describe('pickBarState: not active (does not qualify)', () => {
  const na = (
    o: Partial<ConversationAiAccess>,
    extra: Partial<BarInput> = {},
  ) => {
    const v = bar({ aiAccess: access({ qualifies: false, ...o }), ...extra });
    if (v.kind !== 'not-active') throw new Error(v.kind);
    return v;
  };

  it('keeps the approve link AND the "Keep AI out" row', () => {
    const v = na({});
    expect(v.title).toBe('AI access: not active');
    expect(v.helper).toBe(AI_COPY.notActive);
    expect(v.link).toBe('Review and approve');
    expect(v.row2.title).toBe('Keep AI out of this chat');
  });

  it('row 2 polarity: switch ON means my side is off', () => {
    expect(na({}).row2.switch).toMatchObject({ value: false, nextOff: true });
    expect(na({}).row2.helper).toBe(AI_COPY.keepOutNone);
    const kept = na({ myAiAccess: 'off', myChatSwitchOff: true });
    expect(kept.row2.switch).toMatchObject({ value: true, nextOff: false });
    expect(kept.row2.helper).toBe(AI_COPY.keepOutMine);
  });

  it('row 2 other-person and both lines', () => {
    expect(na({ otherSwitchedOff: true }).row2.helper).toBe(
      AI_COPY.keepOutOther,
    );
    expect(
      na({ myAiAccess: 'off', myChatSwitchOff: true, otherSwitchedOff: true })
        .row2.helper,
    ).toBe(AI_COPY.keepOutBoth);
  });

  it('saving and offline only touch row 2', () => {
    const saving = na({}, { saving: { off: true } });
    expect(saving.row2.helper).toBe('Keeping AI out…');
    expect(saving.row2.switch).toMatchObject({
      value: false,
      disabled: true,
      busy: true,
    });
    expect(saving.helper).toBe(AI_COPY.notActive);
    expect(na({}, { saving: { off: false } }).row2.helper).toBe(
      'Letting AI back in…',
    );
    const off = na({}, { offline: true });
    expect(off.row2.helper).toBe(AI_COPY.offline);
    expect(off.row2.switch.disabled).toBe(true);
  });

  it('row 2 errors name the state it is still in', () => {
    expect(na({}, { saveError: { off: true } }).row2.error).toBe(
      AI_COPY.errKeepOut,
    );
    expect(na({}, { saveError: { off: false } }).row2.error).toBe(
      AI_COPY.errLetIn,
    );
    expect(na({}, { saveError: { off: true, status: 403 } }).row2.error).toBe(
      'You can’t change AI access for this chat.',
    );
  });
});

describe('pickBarState: account-wide off', () => {
  it('replaces every other state, qualifying or not, with one disabled row and a link', () => {
    for (const qualifies of [true, false]) {
      const v = bar({
        aiAccess: access({
          qualifies,
          accountWideOff: true,
          myAiAccess: 'off',
          otherSwitchedOff: true,
        }),
      });
      if (v.kind !== 'account-off') throw new Error(v.kind);
      expect(v.helper).toBe(AI_COPY.accountOff);
      expect(v.link).toBe('Change in settings');
      expect(v.switch).toMatchObject({ value: false, disabled: true });
    }
  });

  it('stays the same row offline (the link still opens the screen)', () => {
    const v = bar({
      aiAccess: access({ accountWideOff: true }),
      offline: true,
    });
    expect(v.kind).toBe('account-off');
  });
});

describe('pickBarState: loading, error, saving, offline', () => {
  it('loading while the conversation is not loaded', () => {
    const v = bar({ aiAccess: undefined, conversationLoaded: false });
    expect(v).toMatchObject({ kind: 'loading', helper: 'Checking…' });
  });

  it('a failed load is an error with a Try again link, never "on"', () => {
    const v = bar({
      aiAccess: undefined,
      conversationLoaded: false,
      loadFailed: true,
    });
    expect(v).toMatchObject({
      kind: 'load-error',
      error: 'We couldn’t load AI access for this chat. Try again.',
      link: 'Try again',
    });
  });

  it('aiAccess null (server could not compute) is an error, not "on"', () => {
    expect(bar({ aiAccess: null }).kind).toBe('load-error');
    expect(bar({ aiAccess: undefined }).kind).toBe('load-error');
  });

  it('saving keeps the OLD value, disabled, with the switching copy (not optimistic)', () => {
    const off = bar({ saving: { off: true } });
    if (off.kind !== 'standard') throw new Error(off.kind);
    expect(off.helper).toBe('Switching off…');
    expect(off.switch).toMatchObject({
      value: true,
      disabled: true,
      busy: true,
    });
    const on = bar({
      aiAccess: access({ myAiAccess: 'off' }),
      saving: { off: false },
    });
    if (on.kind !== 'standard') throw new Error(on.kind);
    expect(on.helper).toBe('Switching on…');
    expect(on.switch.value).toBe(false);
  });

  it('a failed save keeps the previous state, enabled, with the error', () => {
    const v = bar({ saveError: { off: true } });
    if (v.kind !== 'standard') throw new Error(v.kind);
    expect(v.helper).toBe(AI_COPY.on);
    expect(v.switch).toMatchObject({ value: true, disabled: false });
    expect(v.error).toBe(
      'We couldn’t switch AI access off. It’s still on. Try again.',
    );
    const back = bar({
      aiAccess: access({ myAiAccess: 'off' }),
      saveError: { off: false },
    });
    if (back.kind !== 'standard') throw new Error(back.kind);
    expect(back.error).toBe(
      'We couldn’t switch AI access on. It’s still off. Try again.',
    );
    const denied = bar({ saveError: { off: true, status: 403 } });
    if (denied.kind !== 'standard') throw new Error(denied.kind);
    expect(denied.error).toBe('You can’t change AI access for this chat.');
  });

  it('offline: offline line, switch at last known value and disabled, no repeated error', () => {
    const v = bar({ offline: true, saveError: { off: true, status: 0 } });
    if (v.kind !== 'standard') throw new Error(v.kind);
    expect(v.helper).toBe('You’re offline. Reconnect to change this.');
    expect(v.switch).toMatchObject({ value: true, disabled: true });
    expect(v.error).toBeNull();
  });
});

describe('shouldShowNotice', () => {
  const live = true;
  it('shows to plan-only people who have not dismissed it', () => {
    expect(
      shouldShowNotice({ planOnly: true, noticeDismissed: false }, false, live),
    ).toBe(true);
  });
  it('never to approved or non-plan people, or once dismissed', () => {
    expect(
      shouldShowNotice(
        { planOnly: false, noticeDismissed: false },
        false,
        live,
      ),
    ).toBe(false);
    expect(
      shouldShowNotice({ planOnly: true, noticeDismissed: true }, false, live),
    ).toBe(false);
    expect(
      shouldShowNotice({ planOnly: true, noticeDismissed: false }, true, live),
    ).toBe(false);
  });
  it('not on demo threads, and not before the state loads', () => {
    expect(
      shouldShowNotice(
        { planOnly: true, noticeDismissed: false },
        false,
        false,
      ),
    ).toBe(false);
    expect(shouldShowNotice(undefined, false, live)).toBe(false);
  });
});

describe('settings and approval helpers', () => {
  it('Privacy row value; account-wide off wins; undefined while unknown', () => {
    expect(settingsRowValue(undefined)).toBeUndefined();
    expect(settingsRowValue(userState())).toBe('Not approved');
    expect(
      settingsRowValue(userState({ approved: true, qualifies: true })),
    ).toBe('Approved');
    expect(
      settingsRowValue(userState({ hasAiPlan: true, planOnly: true })),
    ).toBe('Included in your plan');
    expect(
      settingsRowValue(
        userState({ approved: true, hasAiPlan: true, accountWideOff: true }),
      ),
    ).toBe('Off for all chats');
  });

  it('approval mode', () => {
    expect(approvalMode(userState())).toBe('not-approved');
    expect(approvalMode(userState({ planOnly: true, hasAiPlan: true }))).toBe(
      'plan-only',
    );
    expect(approvalMode(userState({ approved: true, hasAiPlan: true }))).toBe(
      'approved',
    );
  });

  it('withdraw confirm body: plan variant only while the plan still lets AI read', () => {
    expect(withdrawConfirmBody(userState({ approved: true }))).toBe(
      AI_COPY.confirmBody,
    );
    expect(
      withdrawConfirmBody(userState({ approved: true, hasAiPlan: true })),
    ).toBe(AI_COPY.confirmBodyPlan);
    expect(
      withdrawConfirmBody(
        userState({ approved: true, hasAiPlan: true, accountWideOff: true }),
      ),
    ).toBe(AI_COPY.confirmBody);
  });
});
