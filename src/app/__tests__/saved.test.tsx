// ─────────────────────────────────────────────────────────────────────────────
// saved.tsx (japa#146): the Saved screen's states from the live list —
// loading spinner, "Nothing saved yet", InlineError + "Try again", and the
// tile grid in API order whose tiles open that destination. The saved-list
// hook is stubbed; everything else renders for real.
// ─────────────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
const mockRefetch = jest.fn();
// The hook's result for the next render.
let mockQuery: Record<string, unknown> = {};

jest.mock('react-native-reanimated', () =>
  jest.requireActual('react-native-reanimated/mock'),
);
jest.mock('react-native-worklets', () =>
  jest.requireActual('react-native-worklets/lib/module/mock'),
);
jest.mock('expo-blur', () => ({
  BlurView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/hooks/useSavedDestinations', () => ({
  useSavedDestinations: () => mockQuery,
}));

import React from 'react';
import { ActivityIndicator, RefreshControl } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import TestRenderer, { act } from 'react-test-renderer';
import SavedView from '../saved';
import { Tile } from '@/components/explorer/Tile';
import type { SavedDestinationItem } from '@/types/savedDestinations.type';

function item(
  code: string,
  visaId: string,
  name: string,
): SavedDestinationItem {
  return {
    countryCode: code,
    visaId,
    savedAt: { _seconds: 1, _nanoseconds: 0 },
    countryName: code === 'GB' ? 'United Kingdom' : 'Canada',
    visa: {
      id: visaId,
      countryCode: code,
      name,
      description: '',
      category: 'work',
      processingTime: '3 weeks',
      baseCostUsd: 100,
      successRate: null,
      totalApplications: null,
      source: null,
    },
  };
}

/** Render with the given query result; returns the renderer. */
function render(q: Record<string, unknown>) {
  mockQuery = {
    isLoading: false,
    isError: false,
    isRefetching: false,
    refetch: mockRefetch,
    data: undefined,
    ...q,
  };
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    // japa#474: the screen's pull-to-refresh needs a query client.
    tree = TestRenderer.create(
      <QueryClientProvider client={new QueryClient()}>
        <SavedView />
      </QueryClientProvider>,
    );
  });
  return tree;
}

/** All rendered text, joined. */
function text(tree: TestRenderer.ReactTestRenderer) {
  return tree.root
    .findAll((n) => typeof n.props.children === 'string')
    .map((n) => n.props.children as string)
    .join(' | ');
}

beforeEach(() => {
  mockPush.mockReset();
  mockRefetch.mockReset();
});

describe('Saved screen (japa#146)', () => {
  it('first load: coral spinner, no tiles, no empty state', () => {
    const tree = render({ isLoading: true });
    expect(tree.root.findAllByType(ActivityIndicator).length).toBe(1);
    expect(tree.root.findAllByType(Tile).length).toBe(0);
    expect(text(tree)).not.toContain('Nothing saved yet');
  });

  it('none saved: the existing empty state', () => {
    const tree = render({ data: [] });
    const t = text(tree);
    expect(t).toContain('Nothing saved yet');
    expect(t).toContain('Destinations you save will show up here.');
    expect(t).toContain('Explore destinations');
  });

  it('load failed: InlineError + "Try again" calls refetch', () => {
    const tree = render({ isError: true });
    const t = text(tree);
    expect(t).toContain(
      'We couldn’t load your saved destinations. Check your connection and try again.',
    );
    // The pressable that holds the "Try again" label.
    const retry = tree.root.find(
      (n) =>
        n.props.accessibilityRole === 'button' &&
        !!n.props.onPress &&
        n.findAll((c) => c.props.children === 'Try again').length > 0,
    );
    act(() => retry.props.onPress());
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('saved: one regular tile per item, in API order; a tap opens it', () => {
    const tree = render({
      data: [
        item('GB', 'skilled', 'Skilled Worker'),
        item('CA', 'study', 'Study Permit'),
      ],
    });
    const tiles = tree.root.findAllByType(Tile);
    expect(tiles.map((t) => t.props.d.visa)).toEqual([
      'Skilled Worker',
      'Study Permit',
    ]);
    // Never the big "MOST POPULAR" lead tile.
    expect(tiles.every((t) => !t.props.big)).toBe(true);
    act(() => tiles[0].props.onPress());
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/destination/[id]',
      params: { id: 'skilled', code: 'gb' },
    });
  });

  it('cached list + failed refetch: the grid stays, no error', () => {
    const tree = render({
      isError: true,
      data: [item('GB', 'skilled', 'Skilled Worker')],
    });
    expect(tree.root.findAllByType(Tile).length).toBe(1);
    expect(text(tree)).not.toContain('We couldn’t load');
  });
});

// ── japa#474: pull-to-refresh on the saved grid ─────────────────────────────
describe('Saved screen pull-to-refresh (japa#474)', () => {
  it('the FlatList has a coral RefreshControl; a pull refetches the list', async () => {
    mockRefetch.mockImplementation(async () => undefined);
    const tree = render({ data: [item('GB', 'skilled', 'Skilled Worker')] });
    const rc = tree.root.findByType(RefreshControl);
    expect(rc.props.tintColor).toBe('#F4516C');
    expect(rc.props.refreshing).toBe(false);
    await act(async () => {
      await rc.props.onRefresh();
    });
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    // The tiles stayed on screen through the pull.
    expect(tree.root.findAllByType(Tile).length).toBe(1);
  });
});
