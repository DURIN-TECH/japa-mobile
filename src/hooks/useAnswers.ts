// ─────────────────────────────────────────────────────────────────────────────
// Answers to "information" checklist items (issue #187).
//
// BACKEND CONTRACT
//   GET /applications/:id/answers          -> { answers: { [itemId]: { value, updatedAt } } }
//   PUT /applications/:id/answers/:itemId  body { value }  (shape by the item's answerType,
//                                          see answerTypes.ts; "" clears)
//   400 VALIDATION_ERROR  names the bad field / unknown item / a document item
//   402 UPGRADE_REQUIRED  read-only plan (auth middleware)
//   403                   no access to the application (treated as a generic failure)
//   409 ANSWERS_LOCKED    application under review or later: read-only (GET unaffected)
// The answer text is personal: it is never logged here.
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { retryUnlessNotFound } from '@/hooks/queryErrors';
import type { AnswersResponse, SaveAnswerResponse } from '@/types/answers.type';
import { ANSWER_MAX_LENGTH } from '@/types/answers.type';
import type { AnswerValue } from '@/components/explorer/answerTypes';

/** Query key for one application's answers (same shape as `checklistKey`). */
export const answersKey = (applicationId: string) =>
  ['answers', applicationId] as const;

/**
 * The saved answers. `enabled` should be true only once the checklist has at
 * least one information item (the screen decides). A failed fetch is an error
 * state the screen shows; it never hides document items.
 */
export function useAnswers(applicationId: string, enabled = true) {
  return useQuery({
    queryKey: answersKey(applicationId),
    queryFn: async (): Promise<AnswersResponse['answers']> => {
      const response = await apiService.get<AnswersResponse>(
        `/applications/${applicationId}/answers`,
      );
      return response.data?.answers ?? {};
    },
    enabled: enabled && !!applicationId,
    retry: retryUnlessNotFound,
    staleTime: 1000 * 30,
    // Back online after an offline spell: look again.
    refetchOnReconnect: true,
  });
}

/**
 * Save one answer. On success the saved text goes straight into the cached
 * answers (no refetch round-trip, so the pill and progress update at once).
 * Rejects with the api service's `{ code, status, message }`; see
 * `classifySaveError` for what the screen does with each.
 */
export function useSaveAnswer(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      itemId: string;
      /** The typed value ('' clears). */
      value: AnswerValue | '';
    }): Promise<SaveAnswerResponse> => {
      const response = await apiService.put<SaveAnswerResponse>(
        `/applications/${applicationId}/answers/${encodeURIComponent(input.itemId)}`,
        { value: input.value },
      );
      if (!response.data) throw new Error('Empty answer response');
      return response.data;
    },
    onSuccess: (saved, input) => {
      queryClient.setQueryData<AnswersResponse['answers']>(
        answersKey(applicationId),
        (prev) => {
          const next = { ...(prev ?? {}) };
          // "" clears the answer: drop the entry so the pill goes back to Waiting.
          // The server's normalised value when it sends one, else what we sent.
          if (input.value === '') delete next[input.itemId];
          else
            next[input.itemId] = {
              value: saved.value ?? input.value,
              updatedAt: saved.updatedAt,
            };
          return next;
        },
      );
    },
  });
}

// ── Save errors ───────────────────────────────────────────────────────────────

/** What went wrong with a save, which decides the message and the action. */
export type SaveErrorKind =
  | 'offline'
  | 'read_only_plan'
  | 'list_changed'
  | 'too_long'
  | 'invalid'
  | 'locked'
  | 'other';

/**
 * Pure: classify a rejected save. `text` is what was sent: a 400 for an
 * over-length answer is told apart from "the list changed" by its length (the
 * input also guards it with maxLength).
 */
export function classifySaveError(error: unknown, text: string): SaveErrorKind {
  const e = (error ?? {}) as {
    code?: string;
    status?: number;
    message?: string;
  };
  // Our own check, before any request: the typed value is not valid.
  if (e.code === 'INVALID_ANSWER') return 'invalid';
  if (e.status === 409 && e.code === 'ANSWERS_LOCKED') return 'locked';
  if (e.code === 'NETWORK_ERROR' || e.status === 0) return 'offline';
  // The read-only-plan block answers 402 UPGRADE_REQUIRED; a 403 is no access.
  if (e.status === 402 || e.code === 'UPGRADE_REQUIRED')
    return 'read_only_plan';
  if (e.status === 400) {
    if (text.length > ANSWER_MAX_LENGTH) return 'too_long';
    // The server names a bad field: show it. An unknown / document item means
    // the list changed.
    return e.message && !/unknown|not found|document|no longer/i.test(e.message)
      ? 'invalid'
      : 'list_changed';
  }
  return 'other';
}

/** The InlineError line for each kind (design spec copy), plus its action. */
export const SAVE_ERROR_COPY: Record<
  Exclude<SaveErrorKind, 'locked' | 'invalid'>,
  { message: string; action: 'retry' | 'plans' | 'refresh' }
> = {
  offline: {
    message:
      'You’re offline, so this answer isn’t saved yet. It’s still here. Reconnect and try again.',
    action: 'retry',
  },
  read_only_plan: {
    message:
      'Your plan is read-only, so this answer isn’t saved. It’s still here. Renew your plan to save it.',
    action: 'plans',
  },
  list_changed: {
    message:
      'Your list has changed since you opened it. Refresh it to carry on.',
    action: 'refresh',
  },
  too_long: {
    message: 'This answer is over 2,000 characters. Shorten it and try again.',
    action: 'retry',
  },
  other: {
    message:
      'We couldn’t save this answer. It’s still here. Try again in a moment.',
    action: 'retry',
  },
};

/** Shown when answers are read-only (409 ANSWERS_LOCKED), as for the statement. */
export const ANSWERS_LOCKED_COPY =
  'Your application is under review, so your answers can’t be changed now.';
