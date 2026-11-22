// ─────────────────────────────────────────────────────────────────────────────
// book/[agentId].tsx time picker (japa#472): on today's chip the times that
// have already started are disabled (not pressable, `accessibilityState`
// disabled) and cannot be picked; after 5:00 PM the time area says "No
// times left today. Pick another day."; a future day is unchanged. Renders
// the real screen with react-test-renderer on a fixed device clock; router,
// blur, safe-area and the agent hook are stubbed.
// ─────────────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();

jest.mock('react-native-reanimated', () =>
  jest.requireActual('react-native-reanimated/mock'),
);
jest.mock('react-native-worklets', () =>
  jest.requireActual('react-native-worklets/lib/module/mock'),
);
jest.mock('expo-blur', () => ({
  BlurView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ agentId: 'agent-1' }),
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  // Focus runs once on mount, as on a real first focus.
  useFocusEffect: (cb: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useEffect } = require('react');
    useEffect(cb, [cb]);
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
// One live agent (stable object, as react-query returns).
const mockAgentQ = {
  data: {
    id: 'agent-1',
    displayName: 'Ada Obi',
    consultationFeeUsd: { amountMinor: 3500, currency: 'USD' },
  },
  isLoading: false,
  isError: false,
};
jest.mock('@/hooks/useAgents', () => ({
  useAgent: () => mockAgentQ,
}));

import React from 'react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import TestRenderer, { act } from 'react-test-renderer';
import BookConsultation from '../book/[agentId]';

/** Mounted trees, unmounted after each test (stops the clock interval). */
const mounted: TestRenderer.ReactTestRenderer[] = [];

/** Mount the screen with the device clock at `nowLocal`. */
async function render(nowLocal: Date) {
  jest.useFakeTimers({ now: nowLocal });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<BookConsultation />);
  });
  mounted.push(tree);
  return tree;
}

/** The pressable time pill labelled `label`. */
const pill = (tree: TestRenderer.ReactTestRenderer, label: string) =>
  tree.root.find(
    (n) =>
      typeof n.type !== 'string' &&
      typeof n.props.onPress === 'function' &&
      n.props.accessibilityLabel === label,
  );

/** The date chip showing day-of-month `d`. */
const dayChip = (tree: TestRenderer.ReactTestRenderer, d: string) =>
  tree.root.findAll(
    (n) =>
      typeof n.type !== 'string' &&
      typeof n.props.onPress === 'function' &&
      n.findAll((c) => c.props.children === d).length > 0,
  )[0];

/** All rendered text, joined. */
const text = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root
    .findAll((n) => typeof n.props.children === 'string')
    .map((n) => n.props.children as string)
    .join(' | ');

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
  jest.useRealTimers();
});

describe('book/[agentId] time picker (japa#472)', () => {
  it('today at 1:00 PM: 11:00 AM and 1:00 PM are disabled, 1:30 PM is open', async () => {
    const tree = await render(new Date(2026, 10, 22, 13, 0));
    await act(async () => {
      dayChip(tree, '22').props.onPress();
    });
    for (const past of ['9:00 AM', '11:00 AM', '1:00 PM']) {
      expect(pill(tree, past).props.disabled).toBe(true);
      expect(pill(tree, past).props.accessibilityState).toMatchObject({
        disabled: true,
      });
    }
    expect(pill(tree, '1:30 PM').props.disabled).toBe(false);
    // Pressing a past pill selects nothing.
    await act(async () => {
      pill(tree, '11:00 AM').props.onPress();
    });
    expect(pill(tree, '11:00 AM').props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('a future day is unchanged: every time is open', async () => {
    const tree = await render(new Date(2026, 10, 22, 13, 0));
    await act(async () => {
      dayChip(tree, '23').props.onPress();
    });
    expect(pill(tree, '9:00 AM').props.disabled).toBe(false);
    expect(pill(tree, '1:00 PM').props.disabled).toBe(false);
  });

  it('switching the date to today clears a time that is past there', async () => {
    const tree = await render(new Date(2026, 10, 22, 13, 0));
    await act(async () => {
      dayChip(tree, '23').props.onPress();
    });
    await act(async () => {
      pill(tree, '10:00 AM').props.onPress();
    });
    expect(pill(tree, '10:00 AM').props.accessibilityState).toMatchObject({
      selected: true,
    });
    await act(async () => {
      dayChip(tree, '22').props.onPress();
    });
    expect(pill(tree, '10:00 AM').props.accessibilityState).toMatchObject({
      selected: false,
      disabled: true,
    });
  });

  it('a picked time is cleared once the clock passes it', async () => {
    const tree = await render(new Date(2026, 10, 22, 13, 20));
    await act(async () => {
      dayChip(tree, '22').props.onPress();
    });
    await act(async () => {
      pill(tree, '1:30 PM').props.onPress();
    });
    expect(pill(tree, '1:30 PM').props.accessibilityState).toMatchObject({
      selected: true,
    });
    // Ten minutes later (the 30-second tick picks it up).
    await act(async () => {
      jest.advanceTimersByTime(10 * 60_000);
    });
    expect(pill(tree, '1:30 PM').props.accessibilityState).toMatchObject({
      selected: false,
      disabled: true,
    });
  });

  it('today after 5:00 PM: the chip stays, and one line replaces the pills', async () => {
    const tree = await render(new Date(2026, 10, 22, 17, 30));
    expect(dayChip(tree, '22')).toBeDefined();
    await act(async () => {
      dayChip(tree, '22').props.onPress();
    });
    expect(text(tree)).toContain('No times left today. Pick another day.');
    expect(
      tree.root.findAll(
        (n) =>
          typeof n.type !== 'string' &&
          n.props.accessibilityLabel === '9:00 AM',
      ),
    ).toHaveLength(0);
  });
});
