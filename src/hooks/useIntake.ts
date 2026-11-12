// ─────────────────────────────────────────────────────────────────────────────
// Intake hooks (issue #113): the route's intake questions + saved answers, and
// the save mutation. Questions come from the backend (approved rubric); this
// file knows nothing about any particular route.
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import type { IntakeAnswers, IntakeResponse } from '@/types/intake.type';

/** Query key for one application's intake. */
export const intakeKey = (applicationId: string) =>
  ['intake', applicationId] as const;

/**
 * Load the intake for an application. `enabled` lets the demo path (and the
 * moment before the application resolves) skip the request entirely.
 */
export function useIntake(applicationId: string, enabled = true) {
  return useQuery({
    queryKey: intakeKey(applicationId),
    queryFn: async (): Promise<IntakeResponse> => {
      const res = await apiService.get<IntakeResponse>(
        `/applications/${applicationId}/intake`,
      );
      if (!res.data) throw new Error('Empty intake response');
      return res.data;
    },
    enabled: enabled && !!applicationId,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Save a full set of answers. On success the cache is replaced with the
 * server's answer and everything that reads the answers is invalidated:
 * the checklist (#114) and the review (#42) queries, plus the application.
 * Errors reject with the api service's `{ code, message, status }` object.
 */
export function useSaveIntake(applicationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (answers: IntakeAnswers): Promise<IntakeResponse> => {
      const res = await apiService.put<IntakeResponse>(
        `/applications/${applicationId}/intake`,
        { answers },
      );
      if (!res.data) throw new Error('Empty intake response');
      return res.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(intakeKey(applicationId), data);
      qc.invalidateQueries({ queryKey: ['checklist', applicationId] });
      qc.invalidateQueries({ queryKey: ['review', applicationId] });
      qc.invalidateQueries({ queryKey: ['application', applicationId] });
    },
  });
}
