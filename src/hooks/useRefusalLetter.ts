import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService, ApiError } from '@/services/api.service';
import type {
  RefusalConfirmResult,
  RefusalEnvelope,
  RefusalStarted,
} from '@/types/refusalLetter.type';

// ─────────────────────────────────────────────────────────────────────────────
// Refusal-letter analysis hooks (backend issue #122).
//
//   useStartRefusalAnalysis()   POST /ai/refusal-letters { documentId }
//   useRefusalAnalysis(id)      GET  /ai/refusal-letters/:id, polled while the
//                               job is queued or running
//   useStoredAnalysisId(appId)  remembers the running analysis id on the device,
//                               so a running analysis survives backgrounding and
//                               an app restart (the job itself runs on the server)
//
// Follows useEligibility.ts: React Query + apiService, `response.data` is the
// payload. Errors arrive as the `ApiError` the api.service interceptor builds.
// ─────────────────────────────────────────────────────────────────────────────

/** How often a pending analysis is re-read, in ms. */
const POLL_MS = 3000;

/** True for the 402 the backend sends when the plan has no case-officer feature. */
export function isUpgradeRequired(err: unknown): boolean {
  const e = err as Partial<ApiError> | null;
  return !!e && (e.status === 402 || e.code === 'UPGRADE_REQUIRED');
}

/** True for a connection failure (no response from the server). */
export function isNetworkFailure(err: unknown): boolean {
  const e = err as Partial<ApiError> | null;
  return !!e && e.code === 'NETWORK_ERROR';
}

/**
 * Start (or re-read) the analysis of an uploaded letter. The backend answers
 * 202 `{ analysisId, status }`, or 200 `{ meta, data }` when this exact letter
 * was already read; both are reduced to `{ analysisId }` here.
 */
export function useStartRefusalAnalysis() {
  return useMutation({
    mutationFn: async (documentId: string): Promise<{ analysisId: string }> => {
      const response = await apiService.post<RefusalStarted | RefusalEnvelope>(
        '/ai/refusal-letters',
        { documentId },
      );
      const body = response.data;
      if (!body) throw new Error('No response from the server.');
      if ('meta' in body) return { analysisId: body.meta.analysisId };
      return { analysisId: body.analysisId };
    },
  });
}

/**
 * Add the chosen checklist items to the applicant's document list. Sends ids
 * only (the backend reads everything else from the stored analysis). Nothing is
 * added until this is called. Re-reads the analysis and the document requests
 * afterwards so the "on your list" marks update.
 */
export function useConfirmRefusalChecklist(analysisId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (checklistItemIds: string[]) => {
      const response = await apiService.post<RefusalConfirmResult>(
        `/ai/refusal-letters/${analysisId}/checklist/confirm`,
        { checklistItemIds },
      );
      return response.data ?? { added: [], alreadyListed: [] };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['refusalAnalysis', analysisId],
      });
      // INTEGRATION: nothing reads a ['documentRequests'] query. The added
      // items show up in the personal checklist (#114) and the documents list,
      // so refresh those (prefix keys: this hook only knows the analysis id).
      queryClient.invalidateQueries({ queryKey: ['checklist'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

/** One analysis, polled until it has finished. */
export function useRefusalAnalysis(analysisId: string | null) {
  return useQuery({
    queryKey: ['refusalAnalysis', analysisId],
    queryFn: async () => {
      const response = await apiService.get<RefusalEnvelope>(
        `/ai/refusal-letters/${analysisId}`,
      );
      return response.data ?? null;
    },
    enabled: !!analysisId,
    // Poll while the job is queued or running; stop once it has finished. A
    // failed poll (a dropped connection) keeps polling, so coming back online
    // resumes the screen on its own.
    refetchInterval: (query) => {
      const status = query.state.data?.meta.status;
      return status === 'succeeded' || status === 'failed' ? false : POLL_MS;
    },
    retry: false,
  });
}

/**
 * Prefix of every AsyncStorage key this hook writes. The value is the id of an
 * analysis of the signed-in user's own refusal letter, so it is PER-USER data
 * and is removed on sign-out (see clearStoredAnalysisIds, #263).
 */
const STORAGE_PREFIX = 'refusal-analysis:';

/** AsyncStorage key for the analysis running for one application. */
const storageKey = (applicationId: string) =>
  `${STORAGE_PREFIX}${applicationId}`;

/**
 * Sign-out (#263): remove every remembered analysis id from the device, for all
 * applications. The keys are not tied to a uid, so we can't keep "only this
 * user's" ones; the next user must never resume the previous user's analysis.
 * Storage failures are swallowed (never blocks sign-out).
 */
export async function clearStoredAnalysisIds(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(STORAGE_PREFIX));
    if (ours.length > 0) await AsyncStorage.multiRemove(ours);
  } catch {
    // Best-effort: nothing else to do if the device storage is unavailable.
  }
}

/**
 * The analysis id remembered for an application: `[id, setId, ready]`.
 * `ready` is false until the stored value has been read, so the screen does not
 * flash the upload prompt while a running analysis is being restored.
 * Storage failures are swallowed: the screen works without them, it just does
 * not survive a restart.
 */
export function useStoredAnalysisId(applicationId: string) {
  const [id, setIdState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(storageKey(applicationId))
      .then((v) => {
        if (live) setIdState(v);
      })
      .catch(() => undefined)
      .finally(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, [applicationId]);

  const setId = useCallback(
    (next: string | null) => {
      setIdState(next);
      const op = next
        ? AsyncStorage.setItem(storageKey(applicationId), next)
        : AsyncStorage.removeItem(storageKey(applicationId));
      op.catch(() => undefined);
    },
    [applicationId],
  );

  return [id, setId, ready] as const;
}
