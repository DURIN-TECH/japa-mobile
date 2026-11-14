/**
 * Shared-route hooks (japa#237, P8a of #228) — the applicant's "apply through".
 *
 * Backend endpoints:
 * - GET  /shared-routes/:id/apply-through             → the countries, the rule, the questions
 * - POST /shared-routes/:id/apply-through {answers}   → the same, with a proposal worked out
 * - PUT  /applications/:id/through-country            → change the country (before payment)
 * - POST /applications { sharedRouteId, throughCountryCode, ... } → start (useCreateApplication)
 *
 * Nothing is saved by the two reads: the choice is recorded only when the
 * application is created (or changed). Answers are live, so nothing is cached
 * between visits to the sheet (gcTime short, staleTime 0).
 */

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { tracked } from '@/utils/networkStatus';
import { intakeKey } from '@/hooks/useIntake';
import { checklistKey } from '@/hooks/useChecklist';
import { assessmentKey } from '@/hooks/useCaseOfficer';
import type { IntakeAnswers } from '@/types/intake.type';
import type {
  ApplyThroughView,
  ChangeThroughCountryResult,
} from '@/types/sharedRoute.type';

/** Stable text for a set of answers, so equal answers share one query key. */
function stableAnswers(answers: IntakeAnswers): string {
  return JSON.stringify(
    Object.entries(answers).sort(([a], [b]) => a.localeCompare(b)),
  );
}

/**
 * The apply-through step. No answers → GET; with answers → POST. While a new
 * answer is in flight the previous view stays on screen (`isPlaceholderData`
 * is true), so the sheet doesn't flash empty between questions.
 */
export function useApplyThrough(
  sharedRouteId: string | undefined,
  answers: IntakeAnswers,
) {
  const hasAnswers = Object.keys(answers).length > 0;
  return useQuery({
    queryKey: ['applyThrough', sharedRouteId, stableAnswers(answers)],
    enabled: !!sharedRouteId,
    // Live answers: never reuse an old proposal.
    staleTime: 0,
    gcTime: 1000 * 30,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<ApplyThroughView> => {
      const path = `/shared-routes/${encodeURIComponent(sharedRouteId ?? '')}/apply-through`;
      const res = await tracked(() =>
        hasAnswers
          ? apiService.post<ApplyThroughView>(path, { answers })
          : apiService.get<ApplyThroughView>(path),
      );
      if (!res.data) throw new Error('Empty apply-through response');
      return res.data;
    },
  });
}

/**
 * Change the country an application goes through. On success everything that
 * reads the application's rules is refreshed: the application, its intake,
 * checklist and review (the stack changes with the country).
 */
export function useChangeThroughCountry(applicationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      throughCountryCode: string,
    ): Promise<ChangeThroughCountryResult> => {
      const res = await apiService.put<ChangeThroughCountryResult>(
        `/applications/${applicationId}/through-country`,
        { throughCountryCode: throughCountryCode.toUpperCase() },
      );
      if (!res.data) throw new Error('Empty change-country response');
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['application', applicationId] });
      qc.invalidateQueries({ queryKey: ['applications'] });
      qc.invalidateQueries({ queryKey: intakeKey(applicationId) });
      qc.invalidateQueries({ queryKey: checklistKey(applicationId) });
      qc.invalidateQueries({ queryKey: assessmentKey(applicationId) });
    },
  });
}
