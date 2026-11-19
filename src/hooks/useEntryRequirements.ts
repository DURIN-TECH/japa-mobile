/**
 * useEntryRequirements (japa#237, P8b) — "Do I need a visa?".
 *
 *   GET /entry-requirements?destination=..&nationality=..&residence=..
 *       &holds=kind:issuer:YYYY-MM-DD,..&purpose=..&stayDays=..
 *
 * Free for every signed-in user (no plan gate). Rules:
 * - The caller passes the query string built by `buildEntryQuery`; null means
 *   "don't ask" (no nationality on file), and nothing is fetched.
 * - Every successful answer is SAVED (AsyncStorage, per person and per exact
 *   set of inputs, with the time it was saved). Offline, that saved answer is
 *   what the card shows, with its age. It is never shown as current.
 * - 429 (RATE_LIMITED) and 400 are not retried.
 * - Nothing here is sent to analytics.
 */

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '@/services/api.service';
import { tracked, useIsOffline } from '@/utils/networkStatus';
import { useAuthStore } from '@/stores/auth.store';
import { savedAnswerKey } from '@/components/explorer/entryRequirementsLogic';
import type {
  EntryResult,
  SavedEntryResult,
} from '@/types/entry-requirements.type';

const LIVE_KEY = 'entry-requirements';
const SAVED_KEY = 'entry-requirements-saved';

/** Read the saved answer for these inputs (null when none / unreadable). */
async function readSaved(
  uid: string,
  query: string,
): Promise<SavedEntryResult | null> {
  try {
    const raw = await AsyncStorage.getItem(savedAnswerKey(uid, query));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedEntryResult;
    return parsed?.result && parsed?.savedAt ? parsed : null;
  } catch {
    return null;
  }
}

/** HTTP status of a failed call, when there is one. */
function statusOf(e: unknown): number | undefined {
  return (e as { response?: { status?: number } })?.response?.status;
}

/** True when the failure was the rate limit (429). */
export function isRateLimited(e: unknown): boolean {
  return statusOf(e) === 429;
}

export function useEntryRequirements(query: string | null) {
  const uid = useAuthStore((s) => s.user?.uid) ?? '';
  const offline = useIsOffline();
  const qc = useQueryClient();

  // The live answer: only when there is something to ask and we are online.
  const live = useQuery({
    queryKey: [LIVE_KEY, uid, query],
    enabled: !!query && !!uid && !offline,
    retry: (count, e) => {
      const s = statusOf(e);
      return count < 1 && !(s && s >= 400 && s < 500);
    },
    queryFn: async (): Promise<EntryResult> => {
      const res = await tracked(() =>
        apiService.get<EntryResult>(`/entry-requirements?${query}`),
      );
      if (!res.data) throw new Error('Empty entry-requirements answer');
      return res.data;
    },
  });

  // The saved answer for the same inputs (read once per set of inputs).
  const saved = useQuery({
    queryKey: [SAVED_KEY, uid, query],
    enabled: !!query && !!uid,
    staleTime: Infinity,
    queryFn: () => readSaved(uid, query as string),
  });

  // Save every successful answer, and keep the saved copy in memory in step.
  const liveData = live.data;
  useEffect(() => {
    if (!liveData || !query || !uid) return;
    const entry: SavedEntryResult = {
      result: liveData,
      savedAt: new Date().toISOString(),
    };
    qc.setQueryData([SAVED_KEY, uid, query], entry);
    AsyncStorage.setItem(
      savedAnswerKey(uid, query),
      JSON.stringify(entry),
    ).catch(() => undefined);
    // Only when a new answer arrives.
  }, [liveData]);

  return {
    /** The answer fetched this session (online). */
    result: offline ? null : (live.data ?? null),
    /** The saved answer, for offline. */
    saved: saved.data ?? null,
    offline,
    isLoading: !!query && !offline && live.isLoading,
    isError: !offline && live.isError,
    error: live.error,
    isRefetching: live.isFetching && !live.isLoading,
    refetch: live.refetch,
  };
}
