// ─────────────────────────────────────────────────────────────────────────────
// GlassTabBar with the props Expo Router 58 hands a custom `tabBar`
// (japa#399 QA round 1): `{ state, descriptors, emitter, navigateToTab,
// insets }`, with NO `navigation`. Pressing a tab must fire `tabPress` through
// `emitter` and switch tabs through `navigateToTab(routeKey)`; on SDK 58 the
// old `navigation.emit` crashed on the first tap.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

// Native bits the bar touches, stubbed for jest.
jest.mock('expo-blur', () => ({
  BlurView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('expo-haptics', () => ({ selectionAsync: async () => {} }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
// Flag off: all five tabs, as on dev.
jest.mock('@/config/env', () => ({ isSelfServiceOnly: () => false }));
// Icons are SVG components; a plain stub keeps the render about the bar.
jest.mock('@/components/explorer/icons', () => {
  const Stub = () => null;
  return {
    Ic: new Proxy({}, { get: () => Stub }),
  };
});

import { GlassTabBar } from '../(tabs)/_layout';

// ── SDK 58 props ─────────────────────────────────────────────────────────────
const names = ['home', 'explore', 'tracker', 'agents', 'profile'];
const mockEmit = jest.fn<(e: unknown) => { defaultPrevented: boolean }>();
const mockNavigateToTab = jest.fn<(routeKey: string) => void>();

const props = (index = 0) =>
  ({
    state: {
      index,
      routes: names.map((name) => ({ key: `${name}-key`, name })),
      routeNames: names,
    },
    descriptors: {},
    emitter: { emit: mockEmit },
    navigateToTab: mockNavigateToTab,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  }) as unknown as BottomTabBarProps;

const press = async (r: ReturnType<typeof create>, testID: string) => {
  await act(async () => {
    r.root.findByProps({ testID }).props.onPress();
  });
};

beforeEach(() => {
  mockEmit.mockReset().mockReturnValue({ defaultPrevented: false });
  mockNavigateToTab.mockReset();
});

describe('GlassTabBar (Expo Router 58 tabBar props)', () => {
  it('renders all five tabs with no `navigation` prop', async () => {
    let r!: ReturnType<typeof create>;
    await act(async () => {
      r = create(<GlassTabBar {...props()} />);
    });
    for (const n of names) {
      expect(
        r.root.findAllByProps({ testID: `tab.${n}` }, { deep: false }).length,
      ).toBe(1);
    }
  });

  it('pressing another tab emits tabPress and navigates by route key', async () => {
    let r!: ReturnType<typeof create>;
    await act(async () => {
      r = create(<GlassTabBar {...props(0)} />);
    });
    await press(r, 'tab.tracker');
    expect(mockEmit).toHaveBeenCalledWith({
      type: 'tabPress',
      target: 'tracker-key',
      canPreventDefault: true,
    });
    expect(mockNavigateToTab).toHaveBeenCalledWith('tracker-key');
  });

  it('pressing the focused tab emits but does not navigate', async () => {
    let r!: ReturnType<typeof create>;
    await act(async () => {
      r = create(<GlassTabBar {...props(4)} />);
    });
    await press(r, 'tab.profile');
    expect(mockEmit).toHaveBeenCalledTimes(1);
    expect(mockNavigateToTab).not.toHaveBeenCalled();
  });

  it('a prevented tabPress does not navigate', async () => {
    mockEmit.mockReturnValue({ defaultPrevented: true });
    let r!: ReturnType<typeof create>;
    await act(async () => {
      r = create(<GlassTabBar {...props(0)} />);
    });
    await press(r, 'tab.agents');
    expect(mockNavigateToTab).not.toHaveBeenCalled();
  });
});
