import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { Checklist } from '@/types/checklist.type';

/** Query key for one application's checklist (also invalidated by uploads and intake saves). */
export const checklistKey = (applicationId: string) =>
  ['checklist', applicationId] as const;

/**
 * The applicant's personal document checklist (issue #114).
 *
 * The list is built on the server, in code, from the approved visa rubric and
 * the visit details the applicant answered. This hook calls the refresh
 * endpoint (build + store, idempotent), so a changed answer is reflected the
 * next time the query runs. It is invalidated by `useCreateDocument` after an
 * upload, which is how an item flips to "uploaded" without a manual refresh.
 *
 * `enabled` is false for demo destinations and for agent-managed applications
 * (the backend only generates for self-service applications).
 */
export function useChecklist(applicationId: string, enabled: boolean) {
  return useQuery({
    queryKey: checklistKey(applicationId),
    queryFn: async (): Promise<Checklist | null> => {
      const response = await apiService.post<Checklist>(
        `/applications/${applicationId}/checklist/refresh`,
        {},
      );
      return response.data ?? null;
    },
    enabled: enabled && !!applicationId,
    staleTime: 1000 * 30, // 30 seconds: answers may have changed on another screen
  });
}
