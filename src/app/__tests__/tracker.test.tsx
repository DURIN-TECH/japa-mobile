// ─────────────────────────────────────────────────────────────────────────────
// (tabs)/tracker.tsx pull-to-refresh (japa#474): the applications list has a
// coral RefreshControl; a pull refetches the applications (and the plan, via
// the shared hook); the rows stay on screen while it runs; a failed pull
// stops the spinner and keeps them. The applications hook is stubbed.
// ─────────────────────────────────────────────────────────────────────────────

const mockRefetch = jest.fn<() => Promise<unknown>>();
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
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/hooks/useApplications', () => ({
  useApplications: () => mockQuery,
}));

import React from 'react';
import { RefreshControl } from 'react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import TestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppsView from '../(tabs)/tracker';

/** One application as GET /applications returns it (fields the mapper reads). */
const APP = {
  id: 'app-1',
  userId: 'u1',
  visaTypeId: 'skilled',
  countryCode: 'GB',
  countryName: 'United Kingdom',
  visaTypeName: 'Skilled Worker',
  status: 'in_progress',
  mode: 'self',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-02T00:00:00.000Z',
};

function render() {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <QueryClientProvider client={new QueryClient()}>
        <AppsView />
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
  mockRefetch.mockReset();
  mockQuery = {
    isLoading: false,
    isError: false,
    isRefetching: false,
    refetch: mockRefetch,
    data: [APP],
  };
});

describe('Tracker pull-to-refresh (japa#474)', () => {
  it('coral RefreshControl; a pull refetches the applications', async () => {
    mockRefetch.mockResolvedValue(undefined);
    const tree = render();
    const before = text(tree);
    expect(before).toContain('Skilled Worker');
    const rc = tree.root.findByType(RefreshControl);
    expect(rc.props.tintColor).toBe('#F4516C');
    expect(rc.props.colors).toEqual(['#F4516C']);
    await act(async () => {
      await rc.props.onRefresh();
    });
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    expect(text(tree)).toContain('Skilled Worker');
  });

  it('spinner shows only during the pull; the rows stay on screen meanwhile', async () => {
    let finish!: () => void;
    mockRefetch.mockImplementation(
      () => new Promise<void>((r) => (finish = r)),
    );
    const tree = render();
    let pull!: Promise<void>;
    act(() => {
      pull = tree.root.findByType(RefreshControl).props.onRefresh();
    });
    // Let the hook start the refetch (it is called on the next microtask).
    await act(async () => {});
    expect(tree.root.findByType(RefreshControl).props.refreshing).toBe(true);
    expect(text(tree)).toContain('Skilled Worker');
    await act(async () => {
      finish();
      await pull;
    });
    expect(tree.root.findByType(RefreshControl).props.refreshing).toBe(false);
  });

  it('a failed pull stops the spinner and keeps the old rows', async () => {
    mockRefetch.mockRejectedValue(new Error('offline'));
    const tree = render();
    await act(async () => {
      await tree.root.findByType(RefreshControl).props.onRefresh();
    });
    expect(tree.root.findByType(RefreshControl).props.refreshing).toBe(false);
    expect(text(tree)).toContain('Skilled Worker');
  });
});
