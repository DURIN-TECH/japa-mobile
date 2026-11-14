// Feedback logic (issue #257): when the button shows, the route sent, when Send
// is enabled, the counter, and which message an error becomes.

import { describe, expect, it } from '@jest/globals';
import {
  canSend,
  counterText,
  placeholderFor,
  routeFromSegments,
  sendErrorMessage,
  shouldShowFeedbackButton,
  FEEDBACK_COPY,
  type ButtonVisibilityInput,
} from '../feedbackLogic';
import { isFeedbackEnabledFlag } from '@/config/feedback';

const base: ButtonVisibilityInput = {
  buildEnabled: true,
  userEnabled: true,
  isAuthenticated: true,
  segments: ['(tabs)', 'home'],
  keyboardOpen: false,
  sheetOpen: false,
  capturing: false,
};
const show = (o: Partial<ButtonVisibilityInput> = {}) =>
  shouldShowFeedbackButton({ ...base, ...o });

describe('shouldShowFeedbackButton', () => {
  it('shows for a signed-in user on a normal screen', () => {
    expect(show()).toBe(true);
    expect(show({ segments: ['application', '[id]'] })).toBe(true);
    expect(show({ segments: ['settings'] })).toBe(true);
  });

  it('is hidden when signed out', () => {
    expect(show({ isAuthenticated: false })).toBe(false);
  });

  it('is hidden on auth, onboarding, not-found and the index redirect', () => {
    for (const segments of [
      ['(auth)', 'login'],
      ['(onboard)', 'passport'],
      ['+not-found'],
      [],
    ]) {
      expect(show({ segments })).toBe(false);
    }
  });

  it('is hidden while the keyboard is open, the sheet is open or a capture runs', () => {
    expect(show({ keyboardOpen: true })).toBe(false);
    expect(show({ sheetOpen: true })).toBe(false);
    expect(show({ capturing: true })).toBe(false);
  });

  it('is hidden by the Settings toggle and by the build flag', () => {
    expect(show({ userEnabled: false })).toBe(false);
    expect(show({ buildEnabled: false })).toBe(false);
  });
});

describe('isFeedbackEnabledFlag', () => {
  it('is off only for "false"', () => {
    expect(isFeedbackEnabledFlag('false')).toBe(false);
    expect(isFeedbackEnabledFlag(' FALSE ')).toBe(false);
    expect(isFeedbackEnabledFlag(undefined)).toBe(true);
    expect(isFeedbackEnabledFlag('true')).toBe(true);
    expect(isFeedbackEnabledFlag('')).toBe(true);
  });
});

describe('routeFromSegments', () => {
  it('builds a params-free pattern, never a record id', () => {
    expect(routeFromSegments(['(tabs)', 'home'])).toBe('/home');
    expect(routeFromSegments(['application', '[id]'])).toBe(
      '/application/[id]',
    );
  });
  it('is capped at 200 characters', () => {
    expect(routeFromSegments(['a'.repeat(500)]).length).toBe(200);
  });
});

describe('canSend', () => {
  it('needs a kind and 1 to 2000 trimmed characters', () => {
    expect(canSend(null, 'hello')).toBe(false);
    expect(canSend('bug', '')).toBe(false);
    expect(canSend('bug', '   \n ')).toBe(false);
    expect(canSend('bug', 'x')).toBe(true);
    expect(canSend('idea', 'x'.repeat(2000))).toBe(true);
    expect(canSend('idea', 'x'.repeat(2001))).toBe(false);
  });
});

describe('counterText', () => {
  it('appears from 1,800 characters', () => {
    expect(counterText(1799)).toBeNull();
    expect(counterText(1800)).toBe('1,800 / 2,000');
    expect(counterText(1850)).toBe('1,850 / 2,000');
  });
  it('says so at the limit', () => {
    expect(counterText(2000)).toBe('2,000 / 2,000 · That’s the limit');
  });
});

describe('placeholderFor', () => {
  it('follows the chosen kind', () => {
    expect(placeholderFor(null)).toBe('Tell us in your own words.');
    expect(placeholderFor('bug')).toBe(
      'What happened, and what did you expect?',
    );
    expect(placeholderFor('idea')).toBe('What would make Seli better for you?');
  });
});

describe('sendErrorMessage', () => {
  it('429 gets the rate-limit line, everything else the generic one', () => {
    expect(sendErrorMessage({ status: 429 })).toBe(
      FEEDBACK_COPY.errorRateLimited,
    );
    expect(sendErrorMessage({ status: 500 })).toBe(FEEDBACK_COPY.errorGeneric);
    expect(sendErrorMessage({ status: 0, code: 'NETWORK_ERROR' })).toBe(
      FEEDBACK_COPY.errorGeneric,
    );
    expect(sendErrorMessage(new Error('x'))).toBe(FEEDBACK_COPY.errorGeneric);
    expect(sendErrorMessage(undefined)).toBe(FEEDBACK_COPY.errorGeneric);
  });
});

describe('routeFromSegments route groups', () => {
  it('drops (group) segments', () => {
    expect(routeFromSegments(['(tabs)', 'home'])).toBe('/home');
    expect(routeFromSegments(['(auth)', '(x)', 'login'])).toBe('/login');
  });
});
