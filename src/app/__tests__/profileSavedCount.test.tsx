// ─────────────────────────────────────────────────────────────────────────────
// Profile (japa#146): the "Saved" stat and the "Saved destinations" row both
// show the number of items in the live saved list, "–" while it loads or
// after it failed, and the list is refetched when the tab regains focus.
// Every data hook is stubbed; the screen renders for real.
// ─────────────────────────────────────────────────────────────────────────────

// Saved-list query result for the next render (`mock` prefix: jest.mock may read it).
let mockSaved: Record<string, unknown> = {};
const mockSavedRefetch = jest.fn();
const mockRefetchOnFocus = jest.fn();

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
jest.mock('@/services/auth.service', () => ({
  authService: { logout: jest.fn() },
}));
jest.mock('@/config/env', () => ({ isSelfServiceOnly: () => false }));
// Other Profile data: loaded, nothing interesting.
const mockQ = (data: unknown) => ({ data, refetch: jest.fn() });
jest.mock('@/hooks/useMe', () => ({ useMe: () => ({ data: undefined }) }));
jest.mock('@/hooks/useApplications', () => ({
  useApplications: () => mockQ([]),
}));
jest.mock('@/hooks/useConsultations', () => ({
  useConsultations: () => mockQ([]),
}));
jest.mock('@/hooks/useMessaging', () => ({
  useConversations: () => mockQ([]),
}));
jest.mock('@/hooks/useVerification', () => ({
  useIdentityVerification: () => mockQ(undefined),
}));
jest.mock('@/hooks/useDocuments', () => ({
  useMyDocumentsCount: () => mockQ(0),
}));
jest.mock('@/hooks/useTransactions', () => ({
  useTransactions: () => mockQ([]),
}));
jest.mock('@/hooks/useCurrentPlan', () => ({
  useCurrentPlan: () => ({ plan: undefined, plans: undefined }),
}));
jest.mock('@/hooks/useRefetchOnFocus', () => ({
  useRefetchOnFocus: (fn: unknown, enabled?: boolean) =>
    mockRefetchOnFocus(fn, enabled),
}));
jest.mock('@/hooks/useSavedDestinations', () => ({
  useSavedDestinations: () => mockSaved,
}));

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import TestRenderer, { act } from 'react-test-renderer';
import ProfileScreen from '../(tabs)/profile';

/** Render Profile with this saved-list result; return [stat, row] values. */
function savedValues(saved: Record<string, unknown>): [string, string] {
  mockSaved = {
    isLoading: false,
    isError: false,
    data: undefined,
    refetch: mockSavedRefetch,
    ...saved,
  };
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    // japa#474: the screen's pull-to-refresh needs a query client.
    tree = TestRenderer.create(
      <QueryClientProvider client={new QueryClient()}>
        <ProfileScreen />
      </QueryClientProvider>,
    );
  });
  const texts = tree.root
    .findAll((n) => typeof n.props.children === 'string')
    .map((n) => n.props.children as string)
    // Each string is matched twice in a row (the Text component and its
    // host node): keep one of each pair.
    .filter((t, i, all) => all[i - 1] !== t);
  // Stat: the value right before the "Saved" label.
  const stat = texts[texts.indexOf('Saved') - 1];
  // Row: the value right after the "Saved destinations" label.
  const row = texts[texts.indexOf('Saved destinations') + 1];
  act(() => tree.unmount());
  return [stat, row];
}

const items = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ countryCode: 'GB', visaId: `v${i}` }));

beforeEach(() => {
  mockSavedRefetch.mockReset();
  mockRefetchOnFocus.mockReset();
});

describe('Profile saved count (japa#146)', () => {
  it('stat and row show the list length', () => {
    expect(savedValues({ data: items(5) })).toEqual(['5', '5']);
  });

  it('an empty list reads "0" in both', () => {
    expect(savedValues({ data: [] })).toEqual(['0', '0']);
  });

  it('"–" while the first load runs', () => {
    expect(savedValues({ isLoading: true })).toEqual(['–', '–']);
  });

  it('"–" when the load failed with nothing cached', () => {
    expect(savedValues({ isError: true })).toEqual(['–', '–']);
  });

  it('a failed background refetch keeps the cached number', () => {
    expect(savedValues({ isError: true, data: items(2) })).toEqual(['2', '2']);
  });

  it('refetches the saved list on focus', () => {
    savedValues({ data: [] });
    expect(
      mockRefetchOnFocus.mock.calls.some((c) => c[0] === mockSavedRefetch),
    ).toBe(true);
  });
});
