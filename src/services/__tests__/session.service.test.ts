// ─────────────────────────────────────────────────────────────────────────────
// clearUserSession (issue #263): every per-user cache outside the auth store is
// emptied on sign-out, and a request still in flight for the previous user can
// not write its response back into the cache after the clear.
//
// Uses a REAL QueryClient (swapped in for the app's module-level one) and the
// official AsyncStorage jest mock.
// ─────────────────────────────────────────────────────────────────────────────

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient } from '@tanstack/react-query';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);
// The app's QueryProvider module renders JSX; only the client matters here.
jest.mock('@/providers/QueryProvider', () => {
  const { QueryClient: QC } = jest.requireActual<
    typeof import('@tanstack/react-query')
  >('@tanstack/react-query');
  return {
    queryClient: new QC({ defaultOptions: { queries: { retry: false } } }),
  };
});
// useRefusalLetter imports the API client (Firebase); not used by the helper.
jest.mock('@/services/api.service', () => ({ apiService: {} }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearUserSession } from '../session.service';
import { queryClient as appQueryClient } from '@/providers/QueryProvider';
import { useOnboardingStore } from '@/stores/onboarding.store';
import StorageKeys from '@/constants/Storage';

const queryClient = appQueryClient as QueryClient;

beforeEach(async () => {
  queryClient.clear();
  await AsyncStorage.clear();
  useOnboardingStore.getState().reset();
});

describe('clearUserSession', () => {
  it('empties the React Query cache (every per-user key)', async () => {
    queryClient.setQueryData(['notifications'], [{ id: 'n-A' }]);
    queryClient.setQueryData(['applications'], [{ id: 'app-A' }]);
    queryClient.setQueryData(['application', 'app-A'], { id: 'app-A' });
    queryClient.setQueryData(['conversations'], [{ id: 'c-A' }]);
    await clearUserSession();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(queryClient.getQueryData(['notifications'])).toBeUndefined();
  });

  it('cancels in-flight queries first, so a late response cannot land after the clear', async () => {
    const cancelSpy = jest.spyOn(queryClient, 'cancelQueries');
    const clearSpy = jest.spyOn(queryClient, 'clear');

    // A fetch for user A that resolves only after the clear.
    let resolveFetch: (v: string[]) => void = () => {};
    const pending = queryClient
      .fetchQuery({
        queryKey: ['notifications'],
        queryFn: ({ signal }) =>
          new Promise<string[]>((resolve, reject) => {
            resolveFetch = resolve;
            signal.addEventListener('abort', () => reject(new Error('abort')));
          }),
      })
      .catch(() => undefined);

    await clearUserSession();
    resolveFetch(['A notification']); // arrives too late
    await pending;

    // cancelQueries ran before clear.
    expect(cancelSpy).toHaveBeenCalled();
    expect(cancelSpy.mock.invocationCallOrder[0]).toBeLessThan(
      clearSpy.mock.invocationCallOrder[0],
    );
    expect(queryClient.getQueryData(['notifications'])).toBeUndefined();
    cancelSpy.mockRestore();
    clearSpy.mockRestore();
  });

  it("resets the onboarding store (the previous user's name and country)", async () => {
    useOnboardingStore.getState().setPersonalInfo('Ada', 'A');
    useOnboardingStore.getState().setCountry('NG');
    await clearUserSession();
    expect(useOnboardingStore.getState().data).toEqual({
      hasPassport: undefined,
      residentialCountry: undefined,
      firstName: undefined,
      lastName: undefined,
    });
  });

  it('removes per-user device keys and keeps device-wide settings', async () => {
    await AsyncStorage.multiSet([
      ['refusal-analysis:app-1', 'an-1'],
      ['refusal-analysis:app-2', 'an-2'],
      [StorageKeys.ONBOARDING_STATUS_KEY, 'done'],
      // Device-wide: must survive.
      [StorageKeys.THEME_PREFERENCE_KEY, 'dark'],
      ['japa-settings', '{"state":{}}'],
    ]);
    await clearUserSession();
    const keys = await AsyncStorage.getAllKeys();
    expect([...keys].sort()).toEqual(
      [StorageKeys.THEME_PREFERENCE_KEY, 'japa-settings'].sort(),
    );
  });

  it('never throws when device storage fails', async () => {
    const spy = jest
      .spyOn(AsyncStorage, 'getAllKeys')
      .mockRejectedValueOnce(new Error('disk'));
    await expect(clearUserSession()).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
