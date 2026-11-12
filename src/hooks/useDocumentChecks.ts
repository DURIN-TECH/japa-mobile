import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { DocumentChecksResponse } from '@/types/documentCheck.type';

// ─────────────────────────────────────────────────────────────────────────────
// Per-upload document checks (issue #115).
//
// `useDocumentChecks` reads the latest check for every checklist item of one
// application in a single call. While any check is still running it polls every
// few seconds, so the item moves from "checking" to its result without a manual
// reload; when nothing is running it stops polling. A paid-plan gate is decided
// on the server: a free applicant's response carries no results, only
// `state: 'upgrade_required'`.
// ─────────────────────────────────────────────────────────────────────────────

/** How often to look again while a check is running (ms). */
const POLL_MS = 3000;

export function useDocumentChecks(applicationId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['documentChecks', applicationId],
    queryFn: async (): Promise<DocumentChecksResponse | null> => {
      const response = await apiService.get<DocumentChecksResponse>(
        `/applications/${applicationId}/document-checks`,
      );
      return response.data ?? null;
    },
    enabled: enabled && !!applicationId,
    // Poll only while some check is pending; stop when all are final.
    refetchInterval: (query) => {
      const data = query.state.data;
      const running =
        data?.tier === 'full' && data.checks.some((c) => c.state === 'pending');
      return running ? POLL_MS : false;
    },
    // Offline, then back online: look again (the document stayed uploaded).
    refetchOnReconnect: true,
    staleTime: 1000 * 10,
  });
}

/** Run a document's check again (paid applicant). Refreshes the checks after. */
export function useRetryDocumentCheck(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (documentId: string) => {
      await apiService.post(`/documents/${documentId}/check/retry`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentChecks', applicationId] });
    },
  });
}
