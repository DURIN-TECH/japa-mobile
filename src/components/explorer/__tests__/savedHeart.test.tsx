// ─────────────────────────────────────────────────────────────────────────────
// useSavedHeart (japa#146, design spec A–C): what a tap on the destination
// heart does in each state. Real React Query + the real saved-list hooks; the
// API client, haptics and router focus are stubbed.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('react-native-reanimated', () =>
  jest.requireActual('react-native-reanimated/mock'),
);
jest.mock('react-native-worklets', () =>
  jest.requireActual('react-native-worklets/lib/module/mock'),
);
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Error: 'error' },
}));
jest.mock('expo-router', () => ({ useFocusEffect: () => {} }));
jest.mock('@/services/api.service', () => ({
  apiService: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));
jest.mock('@/stores/auth.store', () => ({
  useAuthStore: (sel: (s: { isAuthenticated: boolean }) => unknown) =>
    sel({ isAuthenticated: true }),
}));

import React from 'react';
import { act, create } from 'react-test-renderer';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSavedHeart } from '../SavedHeart';
import { EX } from '../theme';
import { SAVED_DESTINATIONS_KEY } from '@/hooks/useSavedDestinations';
import { apiService } from '@/services/api.service';

const api = apiService as unknown as Record<
  'get' | 'put' | 'delete',
  jest.Mock<(...a: unknown[]) => Promise<unknown>>
>;

const VISA = { name: 'Skilled Worker', category: 'work' as const };
const saved = (visaId: string) => ({
  countryCode: 'GB',
  visaId,
  savedAt: { _seconds: 1, _nanoseconds: 0 },
  countryName: 'United Kingdom',
  visa: {
    id: visaId,
    countryCode: 'GB',
    ...VISA,
    successRate: null,
    totalApplications: null,
    source: null,
  },
});

const renderers: ReturnType<typeof create>[] = [];
function mountHeart(qc: QueryClient) {
  const ref: { current: ReturnType<typeof useSavedHeart> | null } = {
    current: null,
  };
  function Probe() {
    ref.current = useSavedHeart({
      countryCode: 'gb',
      visaId: 'skilled',
      visa: VISA,
      countryName: 'United Kingdom',
    });
    return null;
  }
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  act(() => {
    renderers.push(
      create(
        <QueryClientProvider client={qc}>
          <Probe />
        </QueryClientProvider>,
      ),
    );
  });
  return ref as { current: ReturnType<typeof useSavedHeart> };
}

async function flush() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

let qc: QueryClient;
beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
  qc = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false, staleTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
});
afterEach(() => {
  act(() => renderers.splice(0).forEach((r) => r.unmount()));
});

describe('destination heart', () => {
  it('loading: spinner, disabled, a tap does nothing', async () => {
    api.get.mockReturnValue(new Promise(() => {}));
    const h = mountHeart(qc);
    await flush();
    expect(h.current.state).toBe('loading');
    expect(h.current.buttonProps.loading).toBe(true);
    expect(h.current.buttonProps.disabled).toBe(true);
    act(() => h.current.buttonProps.onPress());
    expect(api.put).not.toHaveBeenCalled();
  });

  it('not saved → tap saves, the heart fills at once', async () => {
    api.get.mockResolvedValue({ success: true, data: [] });
    const put = new Promise(() => {}); // still in flight
    api.put.mockReturnValue(put);
    const h = mountHeart(qc);
    await flush();
    expect(h.current.buttonProps.accessibilityLabel).toBe('Save destination');
    act(() => h.current.buttonProps.onPress());
    await flush();
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(h.current.state).toBe('saved');
    expect(h.current.buttonProps.iconFill).toBe(EX.color.primary);
    expect(h.current.buttonProps.accessibilityLabel).toBe('Remove from saved');
    // In flight: a second tap is ignored (no remove, no second save).
    act(() => h.current.buttonProps.onPress());
    await flush();
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('a failed save reverts the heart and shows the message', async () => {
    api.get.mockResolvedValue({ success: true, data: [] });
    api.put.mockRejectedValue({ status: 402, code: 'UPGRADE_REQUIRED' });
    const h = mountHeart(qc);
    await flush();
    act(() => h.current.buttonProps.onPress());
    await flush();
    expect(h.current.state).toBe('notSaved');
    expect(qc.getQueryData(SAVED_DESTINATIONS_KEY)).toEqual([]);
    expect(h.current.error.message).toBe(
      'Your plan is read-only. Renew your subscription to save destinations.',
    );
    // The next tap clears it at once.
    api.put.mockReturnValue(new Promise(() => {}));
    act(() => h.current.buttonProps.onPress());
    expect(h.current.error.message).toBeNull();
  });

  it('saved → tap removes', async () => {
    api.get.mockResolvedValue({ success: true, data: [saved('skilled')] });
    api.delete.mockResolvedValue({ success: true, data: { saved: false } });
    const h = mountHeart(qc);
    await flush();
    expect(h.current.state).toBe('saved');
    // The server's list after the remove (the settle refetch reads it).
    api.get.mockResolvedValue({ success: true, data: [] });
    act(() => h.current.buttonProps.onPress());
    await flush();
    expect(api.delete).toHaveBeenCalledWith(
      '/users/me/saved-destinations/GB/skilled',
    );
    expect(h.current.state).toBe('notSaved');
  });

  it('list failed: dimmed; a tap retries the list only, never toggles', async () => {
    api.get.mockRejectedValue({ status: 500 });
    const h = mountHeart(qc);
    await flush();
    expect(h.current.state).toBe('error');
    expect(h.current.buttonProps.dimmed).toBe(true);
    api.get.mockResolvedValue({ success: true, data: [] });
    act(() => h.current.buttonProps.onPress());
    await flush();
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(api.put).not.toHaveBeenCalled();
    expect(h.current.state).toBe('notSaved');
  });

  it('list retry failing again shows the load message', async () => {
    api.get.mockRejectedValue({ status: 500 });
    const h = mountHeart(qc);
    await flush();
    act(() => h.current.buttonProps.onPress());
    await flush();
    expect(h.current.error.message).toBe(
      'We couldn’t load your saved destinations. Check your connection and try again.',
    );
  });
});
