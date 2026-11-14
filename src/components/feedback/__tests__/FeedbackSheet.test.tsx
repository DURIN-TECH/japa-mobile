// FeedbackSheet (issue #257): Send validation, the failed / retry state that
// keeps the text, success, the screenshot card states and the discard prompt.
// The sender is injected, so nothing touches the network.

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').createElement('View', null, children),
}));
jest.mock('@/hooks/useFeedback', () => ({ submitFeedback: jest.fn() }));

import React from 'react';
import { Alert } from 'react-native';
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { FeedbackSheet } from '../FeedbackSheet';
import { FEEDBACK_COPY as C } from '../feedbackLogic';

type SendFn = (...a: unknown[]) => Promise<string | undefined>;

const renderers: ReturnType<typeof create>[] = [];

function mount(over: Partial<React.ComponentProps<typeof FeedbackSheet>> = {}) {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const send = jest.fn<SendFn>(async () => 'fb1');
  const onClose = jest.fn();
  let r!: ReturnType<typeof create>;
  act(() => {
    r = create(
      <FeedbackSheet
        visible
        screenshotUri="file:///shot.jpg"
        captureFailed={false}
        route="/home"
        onClose={onClose}
        send={send as never}
        {...over}
      />,
    );
  });
  renderers.push(r);
  return { r, send, onClose };
}

const texts = (r: ReturnType<typeof create>) =>
  r.root
    .findAll((n) => (n.type as unknown) === 'Text')
    .map((n) => n.children.join(''));
const hasText = (r: ReturnType<typeof create>, t: string) =>
  texts(r).some((s) => s.includes(t));

/** The pressable (host element with onPress) that contains a label. */
function pressable(
  r: ReturnType<typeof create>,
  label: string,
): ReactTestInstance {
  const texts = r.root.findAll(
    (n) => (n.type as unknown) === 'Text' && n.children.join('') === label,
  );
  // The title and the Send button share a label; the button is the later one.
  const text = texts[texts.length - 1];
  let n: ReactTestInstance | null = text;
  while (n && !(n.props && typeof n.props.onPress === 'function')) n = n.parent;
  if (!n) throw new Error(`no pressable for ${label}`);
  return n;
}
const press = async (r: ReturnType<typeof create>, label: string) => {
  await act(async () => {
    pressable(r, label).props.onPress();
  });
};
const type = (r: ReturnType<typeof create>, value: string) => {
  const input = r.root.findAll(
    (n) => n.props && typeof n.props.onChangeText === 'function',
  )[0];
  act(() => {
    input.props.onChangeText(value);
  });
};
const sendDisabled = (r: ReturnType<typeof create>) => {
  const p = pressable(r, C.send);
  return p.props.disabled === true;
};

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  while (renderers.length) act(() => renderers.pop()!.unmount());
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('FeedbackSheet', () => {
  it('starts with no kind chosen and Send disabled', () => {
    const { r } = mount();
    expect(hasText(r, C.title)).toBe(true);
    expect(sendDisabled(r)).toBe(true);
  });

  it('needs both a kind and a message before Send is enabled', async () => {
    const { r, send } = mount();
    type(r, 'It broke');
    expect(sendDisabled(r)).toBe(true); // message but no kind
    await press(r, C.kinds.bug.name);
    expect(sendDisabled(r)).toBe(false);
    type(r, '   ');
    expect(sendDisabled(r)).toBe(true); // whitespace only
    await press(r, C.send);
    expect(send).not.toHaveBeenCalled();
  });

  it('sends kind, message, route and the screenshot, then shows the thank-you and closes itself', async () => {
    const { r, send, onClose } = mount();
    await press(r, C.kinds.idea.name);
    type(r, 'Dark mode please');
    await press(r, C.send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toEqual({
      kind: 'idea',
      message: 'Dark mode please',
      route: '/home',
      screenshotUri: 'file:///shot.jpg',
    });
    expect(hasText(r, C.successTitle)).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1800);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('on failure keeps the text and kind, shows the error and a Try again button; retry sends the same payload', async () => {
    const { r, send } = mount();
    send.mockRejectedValueOnce({ status: 500 });
    await press(r, C.kinds.bug.name);
    type(r, 'Crash on pay');
    await press(r, C.send);
    expect(hasText(r, C.errorGeneric)).toBe(true);
    expect(hasText(r, C.tryAgain)).toBe(true);
    const input = r.root.findAll(
      (n) => n.props && typeof n.props.onChangeText === 'function',
    )[0];
    expect(input.props.value).toBe('Crash on pay');

    await press(r, C.tryAgain);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toEqual(send.mock.calls[0][0]);
    expect(hasText(r, C.successTitle)).toBe(true);
  });

  it('shows the rate-limit line on a 429', async () => {
    const { r, send } = mount();
    send.mockRejectedValueOnce({ status: 429 });
    await press(r, C.kinds.bug.name);
    type(r, 'again');
    await press(r, C.send);
    expect(hasText(r, C.errorRateLimited)).toBe(true);
  });

  it('removing the screenshot sends without it, and "Add it back" restores it', async () => {
    const { r, send } = mount();
    await press(r, C.kinds.bug.name);
    type(r, 'x');
    const remove = r.root.findAll(
      (n) =>
        n.props?.accessibilityLabel === C.removeScreenshot &&
        typeof n.props.onPress === 'function',
    )[0];
    act(() => remove.props.onPress());
    expect(hasText(r, C.screenshotRemoved)).toBe(true);
    await press(r, C.send);
    expect(
      (send.mock.calls[0][0] as { screenshotUri: unknown }).screenshotUri,
    ).toBeNull();
  });

  it('"Add it back" brings the screenshot card back', async () => {
    const { r } = mount();
    const remove = r.root.findAll(
      (n) =>
        n.props?.accessibilityLabel === C.removeScreenshot &&
        typeof n.props.onPress === 'function',
    )[0];
    act(() => remove.props.onPress());
    await press(r, C.addItBack);
    expect(hasText(r, C.screenshotTitle)).toBe(true);
  });

  it('shows the capture-failed note and still allows sending', async () => {
    const { r, send } = mount({ screenshotUri: null, captureFailed: true });
    expect(hasText(r, C.captureFailed)).toBe(true);
    await press(r, C.kinds.bug.name);
    type(r, 'no shot');
    await press(r, C.send);
    expect(
      (send.mock.calls[0][0] as { screenshotUri: unknown }).screenshotUri,
    ).toBeNull();
  });

  it('Cancel with typed text asks before discarding; with nothing typed it just closes', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const empty = mount();
    await press(empty.r, C.cancel);
    expect(alert).not.toHaveBeenCalled();
    expect(empty.onClose).toHaveBeenCalledTimes(1);

    const typed = mount();
    type(typed.r, 'half a thought');
    await press(typed.r, C.cancel);
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][0]).toBe(C.discardTitle);
    expect(typed.onClose).not.toHaveBeenCalled();
    // "Discard" closes.
    const buttons = alert.mock.calls[0][2] as {
      text: string;
      onPress?: () => void;
    }[];
    buttons.find((b) => b.text === C.discard)!.onPress!();
    expect(typed.onClose).toHaveBeenCalledTimes(1);
  });
});
