// ─────────────────────────────────────────────────────────────────────────────
// Pure UI logic of the AI message access feature (issues #172, #193): the chat
// header icon (highlighted or gray), the "This chat" switch on the settings
// screen, and the settings / approval helpers. Copy is asserted verbatim.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from '@jest/globals';
import {
  AI_COPY,
  approvalMode,
  chatAiIconView,
  settingsRowValue,
  withdrawConfirmBody,
} from '../aiMessageAccessLogic';
import type {
  AiMessageAccessState,
  ConversationAiAccess,
} from '@/types/ai-message-access.type';

const access = (
  o: Partial<ConversationAiAccess> = {},
): ConversationAiAccess => ({
  myAiAccess: 'on',
  accountWideOff: false,
  otherSwitchedOff: false,
  qualifies: true,
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

describe('chatAiIconView', () => {
  const on = access();
  it('highlighted only when qualifying, my access on, and the other person not off', () => {
    expect(chatAiIconView(on)).toEqual({
      highlighted: true,
      label: 'AI access on for this chat',
    });
  });

  it('gray for every other state', () => {
    const gray = { highlighted: false, label: 'AI access off for this chat' };
    expect(chatAiIconView(access({ qualifies: false }))).toEqual(gray);
    expect(
      chatAiIconView(access({ myAiAccess: 'off', accountWideOff: true })),
    ).toEqual(gray);
    expect(chatAiIconView(access({ otherSwitchedOff: true }))).toEqual(gray);
  });

  it('gray while loading or unknown (null / undefined), never highlighted', () => {
    expect(chatAiIconView(null).highlighted).toBe(false);
    expect(chatAiIconView(undefined).highlighted).toBe(false);
  });

  it('a missing qualifies is unknown, so gray', () => {
    const partial = {
      myAiAccess: 'on',
      otherSwitchedOff: false,
    } as unknown as ConversationAiAccess;
    expect(chatAiIconView(partial).highlighted).toBe(false);
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
