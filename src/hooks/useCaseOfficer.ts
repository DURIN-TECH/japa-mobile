// ─────────────────────────────────────────────────────────────────────────────
// useCaseOfficer — React Query hooks for the application "review" (backend #42).
//
// Follows useEligibility.ts: every call goes through `apiService` (axios + the
// Firebase auth interceptor); no new HTTP client.
//
// What lives here:
//   • useAssessment(applicationId)   latest review (or one of two "nothing yet"
//                                    answers), polling every 5s while a job is
//                                    queued/running, and refetching on app
//                                    foreground so a backgrounded run resumes.
//   • useRunAssessment()             POST /assess. Guards against double taps.
//   • helpers to read ApiError codes (402 upgrade, offline, no rubric).
//
// TIER RULE: the tier comes from `meta.tier` in the response, never from
// `useFeature` (it returns true while entitlements are unresolved, the opposite
// of the backend's fail-closed rule).
//
// PRIVACY RULE: the response is re-built from a WHITELIST (`pickFree` /
// `pickFull`). Fields such as a numeric score, an internal call, usage or cost
// are never copied, so they can never reach a component even if a payload
// carries them.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService, type ApiError } from '@/services/api.service';
import { analyticsService } from '@/services/analytics.service';
import type {
  AssessmentMeta,
  AssessmentResult,
  AssessmentView,
  CitedFinding,
  FreeAssessmentData,
  FullAssessmentData,
  InsufficientItem,
  PlainFinding,
} from '@/types/assessment.type';

/** How often a queued/running job is polled (spec: every 5s). */
export const ASSESSMENT_POLL_MS = 5000;

/** Query key for one application's review. */
export const assessmentKey = (applicationId: string) =>
  ['assessment', applicationId] as const;

// ── Error helpers ─────────────────────────────────────────────────────────────
// apiService rejects with a plain ApiError { code, message, status }.
const asApiError = (e: unknown): ApiError | null =>
  e && typeof e === 'object' && 'status' in e && 'code' in e
    ? (e as ApiError)
    : null;

/** 402 UPGRADE_REQUIRED: a free caller tried to re-run changed inputs. */
export const isUpgradeRequired = (e: unknown) => asApiError(e)?.status === 402;
/** No response at all (offline / timeout). */
export const isOffline = (e: unknown) => asApiError(e)?.code === 'NETWORK_ERROR';
/** 403: this account may not see this application's review. */
export const isForbidden = (e: unknown) => asApiError(e)?.status === 403;
/** The route has no approved rubric. */
export const isNoRubric = (e: unknown) =>
  asApiError(e)?.code === 'NO_APPROVED_RUBRIC';

// ── Whitelist builders ────────────────────────────────────────────────────────
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function pickCited(raw: unknown): CitedFinding {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    criterionId: str(r.criterionId),
    title: str(r.title),
    kind: typeof r.kind === 'string' ? r.kind : undefined,
    isMandatoryBar: r.isMandatoryBar === true,
    ruleRef: typeof r.ruleRef === 'string' ? r.ruleRef : null,
    sourceUrl: str(r.sourceUrl),
    sourceQuote: str(r.sourceQuote),
    detail: str(r.detail),
    whatWouldHelp: str(r.whatWouldHelp),
  };
}

function pickPlain(raw: unknown): PlainFinding {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    criterionId: str(r.criterionId),
    title: str(r.title),
    detail: str(r.detail),
  };
}

function pickInsufficient(raw: unknown): InsufficientItem {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    criterionId: str(r.criterionId),
    title: str(r.title),
    reason: str(r.reason),
  };
}

const BANDS = ['not_ready', 'weak', 'competitive', 'strong'];
const band = (v: unknown) =>
  typeof v === 'string' && BANDS.includes(v)
    ? (v as FreeAssessmentData['readiness'])
    : null;

/** Free `data`: band, up to three titles, one boolean. Nothing else. */
export function pickFree(raw: unknown): FreeAssessmentData {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    readiness: band(r.readiness),
    topIssues: arr(r.topIssues)
      .slice(0, 3)
      .map((i) => {
        const o = (i ?? {}) as Record<string, unknown>;
        return { criterionId: str(o.criterionId), title: str(o.title) };
      }),
    hasBlockingRule: r.hasBlockingRule === true,
  };
}

/**
 * Full `data`, whitelisted. ROUTING RULE: a finding from a `judgement` criterion
 * never renders as "Rules not met yet", whichever array it arrives in. So any
 * judgement entry found in `refusalGrounds` is moved to the officer-questions
 * list here, once, and screens can trust the two arrays.
 */
export function pickFull(raw: unknown): FullAssessmentData {
  const r = (raw ?? {}) as Record<string, unknown>;
  const grounds = arr(r.refusalGrounds).map(pickCited);
  const flags = arr(r.credibilityFlags).map(pickCited);
  const isJudgement = (f: CitedFinding) => f.kind === 'judgement';
  return {
    readiness: band(r.readiness),
    hasBlockingRule: r.hasBlockingRule === true,
    refusalGrounds: grounds.filter((f) => !isJudgement(f)),
    credibilityFlags: [...grounds.filter(isJudgement), ...flags],
    strengths: arr(r.strengths).map(pickPlain),
    statementFindings: arr(r.statementFindings).map(pickPlain),
    insufficientInformation: arr(r.insufficientInformation).map(
      pickInsufficient,
    ),
  };
}

/** Build a tier-discriminated view from the `{ meta, data }` envelope. */
export function toView(envelope: {
  meta: AssessmentMeta;
  data: unknown;
}): AssessmentView {
  const meta = envelope.meta;
  // The server decides the tier. Anything that is not exactly "full" is free.
  if (meta.tier === 'full') {
    return {
      tier: 'full',
      meta,
      data: envelope.data ? pickFull(envelope.data) : null,
    };
  }
  return {
    tier: 'free',
    meta,
    data: envelope.data ? pickFree(envelope.data) : null,
  };
}

// ── Derived state helpers (used by the card, the CTA and the review screen) ──
/** A job is in flight. */
export const isInFlight = (m?: AssessmentMeta | null) =>
  m?.status === 'queued' || m?.status === 'running';

// ── Queries / mutations ───────────────────────────────────────────────────────

/**
 * Latest review for an application.
 *
 * Resolves to `{ kind: 'review' }`, or `{ kind: 'empty', reason }` for the two
 * distinct "nothing yet" answers (404 NO_ASSESSMENT / 404 NO_APPROVED_RUBRIC),
 * so neither is shown as an error. A network failure or 403 stays an error.
 *
 * Polls while a job is queued/running and refetches when the app returns to the
 * foreground, so a run that finished while the app was backgrounded shows up.
 */
export function useAssessment(applicationId: string) {
  const queryClient = useQueryClient();

  // Foreground refetch (React Query's focusManager is not wired to AppState in
  // this app, so do it here, scoped to this query).
  useEffect(() => {
    if (!applicationId) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        queryClient.invalidateQueries({ queryKey: assessmentKey(applicationId) });
      }
    });
    return () => sub.remove();
  }, [applicationId, queryClient]);

  return useQuery<AssessmentResult>({
    queryKey: assessmentKey(applicationId),
    enabled: !!applicationId,
    queryFn: async () => {
      try {
        const res = await apiService.get<{ meta: AssessmentMeta; data: unknown }>(
          `/ai/applications/${applicationId}/assessment`,
        );
        if (!res.data) return { kind: 'empty', reason: 'none' } as const;
        return { kind: 'review', view: toView(res.data) } as const;
      } catch (e) {
        const err = asApiError(e);
        if (err?.status === 404 && err.code === 'NO_ASSESSMENT')
          return { kind: 'empty', reason: 'none' } as const;
        if (err?.status === 404 && err.code === 'NO_APPROVED_RUBRIC')
          return { kind: 'empty', reason: 'no_rubric' } as const;
        throw e;
      }
    },
    // Poll only while a job is in flight; otherwise stay quiet.
    refetchInterval: (query) => {
      const d = query.state.data;
      return d?.kind === 'review' && isInFlight(d.view.meta)
        ? ASSESSMENT_POLL_MS
        : false;
    },
    staleTime: 1000 * 15,
  });
}

/**
 * Start (or resume) a review: POST /ai/applications/:id/assess.
 *   202 → a job is queued/running (poll via useAssessment)
 *   200 → the stored result for unchanged inputs
 *   402 → rejects (see `isUpgradeRequired`): a free caller re-running changed inputs
 * The caller disables its button while `isPending`, so two taps cannot start two
 * jobs; the backend also derives the job id from the inputs, so a second POST for
 * the same inputs addresses the same job.
 */
export function useRunAssessment(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiService.post<unknown>(
        `/ai/applications/${applicationId}/assess`,
      );
      return res.data;
    },
    // Success or a 402, the server state moved or was refused: refetch it.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: assessmentKey(applicationId) });
    },
  });
}

/** What happened when the user asked for a review. */
export type StartOutcome =
  | 'started' // a job is queued/running, or a stored result came back
  | 'upgrade' // 402: a free caller re-running changed inputs
  | 'no_rubric' // 404: nothing to review against
  | 'offline' // no response
  | 'error'; // anything else

/**
 * `useRunAssessment` plus outcome mapping, so every entry point (card, sticky
 * CTA, review screen) handles the same cases the same way. `isStarting` is true
 * from the tap until the POST settles; callers disable their button on it, so
 * two taps cannot start two jobs.
 */
export function useStartReview(applicationId: string) {
  const run = useRunAssessment(applicationId);

  const start = async (
    source: 'cta' | 'rerun' | 'retry' = 'cta',
  ): Promise<StartOutcome> => {
    // Guard: ignore a second tap while one is in flight.
    if (run.isPending) return 'started';
    analyticsService.trackReviewEvent('review_run_started', { source });
    try {
      await run.mutateAsync();
      return 'started';
    } catch (e) {
      if (isUpgradeRequired(e)) return 'upgrade'; // not an error: show upgrade path
      if (isNoRubric(e)) return 'no_rubric';
      if (isOffline(e)) return 'offline';
      return 'error';
    }
  };

  return { start, isStarting: run.isPending };
}
