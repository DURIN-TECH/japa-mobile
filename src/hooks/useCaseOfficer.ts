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
//
// WORKING RULE (japa#384): the rule-by-rule findings (the "working") are copied
// only when the server says `meta.working === true`. Anything else, including a
// missing flag or a truthy non-boolean, counts as false, and the arrays stay
// absent from the view even if the payload carries them.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService, type ApiError } from '@/services/api.service';
import { analyticsService } from '@/services/analytics.service';
import {
  parseReviewGaps,
  type ReviewGaps,
} from '@/components/explorer/review/reviewCopy';
import type {
  AssessmentMeta,
  AssessmentNarrative,
  AssessmentResult,
  BlockingRule,
  AssessmentView,
  CitedFinding,
  FreeAssessmentData,
  CountryContext,
  FullAssessmentData,
  InsufficientItem,
  PlainFinding,
  StatementFinding,
  DecisionStage,
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
export const isOffline = (e: unknown) =>
  asApiError(e)?.code === 'NETWORK_ERROR';
/** 403: this account may not see this application's review. */
export const isForbidden = (e: unknown) => asApiError(e)?.status === 403;
/** The route has no approved rubric. */
export const isNoRubric = (e: unknown) =>
  asApiError(e)?.code === 'NO_APPROVED_RUBRIC';
/** 422 NOT_ENOUGH_TO_REVIEW (japa#309): nothing yet for the review to read. */
export const isNotEnoughToReview = (e: unknown) => {
  const err = asApiError(e);
  return err?.status === 422 && err.code === 'NOT_ENOUGH_TO_REVIEW';
};

// ── Whitelist builders ────────────────────────────────────────────────────────
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
/** A non-empty string, or undefined (optional fields stay absent). */
const optStr = (v: unknown): string | undefined =>
  typeof v === 'string' && v ? v : undefined;

const STAGES: string[] = [
  'validity',
  'suitability',
  'eligibility',
  'credibility',
];
const stageOf = (v: unknown): DecisionStage | undefined =>
  typeof v === 'string' && STAGES.includes(v)
    ? (v as DecisionStage)
    : undefined;

function pickCited(raw: unknown): CitedFinding {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    criterionId: str(r.criterionId),
    title: str(r.title),
    kind: typeof r.kind === 'string' ? r.kind : undefined,
    stage: stageOf(r.stage),
    isMandatoryBar: r.isMandatoryBar === true,
    ruleRef: typeof r.ruleRef === 'string' ? r.ruleRef : null,
    sourceUrl: str(r.sourceUrl),
    sourceQuote: str(r.sourceQuote),
    detail: str(r.detail),
    whatWouldHelp: str(r.whatWouldHelp),
    // japa#308: was dropped, so the layer pill (japa#237) never showed.
    layerKey: optStr(r.layerKey),
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

/**
 * A statement finding. `comment` is the explanation; fall back to `detail` (the
 * backend writes the same text to both) so either shape renders. `nodePath` is
 * kept only when it is a list of non-negative integers, otherwise dropped.
 */
function pickStatementFinding(raw: unknown): StatementFinding {
  const r = (raw ?? {}) as Record<string, unknown>;
  const path = Array.isArray(r.nodePath) ? r.nodePath : null;
  const validPath =
    path && path.length > 0 && path.every((n) => Number.isInteger(n) && n >= 0)
      ? (path as number[])
      : undefined;
  return {
    criterionId: str(r.criterionId),
    title: str(r.title),
    comment: str(r.comment) || str(r.detail),
    detail: str(r.detail) || str(r.comment),
    stage: stageOf(r.stage),
    nodePath: validPath,
    // japa#308: was dropped, so the layer pill (japa#237) never showed.
    layerKey: optStr(r.layerKey),
  };
}

/**
 * A "could not tell" item (japa#308). `notAssessed` MUST be carried: it is what
 * `couldntTell` (reviewCopy.ts) uses to keep staff-only items (`no_trigger`,
 * `not_in_documents`) and their staff wording off the screen. Any string is
 * kept as sent, so a marker this build doesn't know is still seen as a marker
 * and hidden. `documentId` is set only on an unread-upload item
 * (`criterionId` "document:<id>"); nothing renders it yet.
 */
function pickInsufficient(raw: unknown): InsufficientItem {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    criterionId: str(r.criterionId),
    title: str(r.title),
    reason: str(r.reason),
    layerKey: optStr(r.layerKey),
    notAssessed: optStr(r.notAssessed) as InsufficientItem['notAssessed'],
    documentId: optStr(r.documentId),
  };
}

/**
 * Whitelist the country-context note (#116). Only an `available` note with its
 * server-written text and a source page is kept; anything else (absent,
 * unavailable, malformed) is undefined, so the screen draws nothing.
 */
function pickCountryContext(raw: unknown): CountryContext | undefined {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.status !== 'available') return undefined;
  const t = (r.text ?? {}) as Record<string, unknown>;
  const lines = arr(t.lines).map(str).filter(Boolean);
  const src = (r.source ?? {}) as Record<string, unknown>;
  const period = (r.period ?? {}) as Record<string, unknown>;
  if (!str(t.headline) || lines.length === 0) return undefined;
  return {
    status: 'available',
    text: { headline: str(t.headline), lines },
    period: { label: str(period.label) },
    source: {
      publisher: str(src.publisher),
      pageUrl: str(src.pageUrl),
      fileName: str(src.fileName),
      caveats: arr(src.caveats).map(str).filter(Boolean),
    },
  };
}

const BANDS = ['not_ready', 'weak', 'competitive', 'strong'];
const band = (v: unknown) =>
  typeof v === 'string' && BANDS.includes(v)
    ? (v as FreeAssessmentData['readiness'])
    : null;

/** Up to three issue titles (criterion id + title only, nothing else). */
const pickTopIssues = (v: unknown) =>
  arr(v)
    .slice(0, 3)
    .map((i) => {
      const o = (i ?? {}) as Record<string, unknown>;
      return { criterionId: str(o.criterionId), title: str(o.title) };
    });

/** Free `data`: band, up to three titles, one boolean. Nothing else. */
export function pickFree(raw: unknown): FreeAssessmentData {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    readiness: band(r.readiness),
    topIssues: pickTopIssues(r.topIssues),
    hasBlockingRule: r.hasBlockingRule === true,
  };
}

/**
 * japa#384: the reading, whitelisted to its three fields. Empty strings are
 * dropped. The backend nulls the whole narrative when its conclusion or every
 * paragraph is dropped, and the app follows the same rule, so a half reading
 * (paragraphs with no conclusion, or a conclusion alone) is never drawn: it
 * becomes null and the screen shows its fallback. Text is kept whole, never
 * truncated (the server caps the lengths).
 */
export function pickNarrative(raw: unknown): AssessmentNarrative | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const paragraphs = arr(r.paragraphs).map(str).filter(Boolean);
  const conclusion = str(r.conclusion);
  if (paragraphs.length === 0 || !conclusion) return null;
  return {
    paragraphs,
    conclusion,
    nextSteps: arr(r.nextSteps).map(str).filter(Boolean),
  };
}

/**
 * japa#384: the blocking (mandatory-bar) rule, whitelisted to its five fields.
 * Null unless it is an object with a title (a bar with no title has nothing to
 * say; the screen then uses the generic blocking body, no quote).
 */
export function pickBlockingRule(raw: unknown): BlockingRule | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (!str(r.title)) return null;
  return {
    criterionId: str(r.criterionId),
    title: str(r.title),
    ruleRef: typeof r.ruleRef === 'string' && r.ruleRef ? r.ruleRef : null,
    sourceQuote: str(r.sourceQuote),
    sourceUrl: str(r.sourceUrl),
  };
}

/**
 * Full `data`, whitelisted.
 *
 * `working` is the server's `meta.working`. Only when it is exactly `true` are
 * the rule-by-rule finding arrays copied; otherwise they are left out of the
 * result altogether (not empty arrays, absent), even when the payload carries
 * them. The band, the blocking flag + rule, the reading, the top issues and the
 * country note are copied on every full response.
 *
 * ROUTING RULE (working only): a finding from a `judgement` criterion never
 * renders as "Rules not met yet", whichever array it arrives in. So any
 * judgement entry found in `refusalGrounds` is moved to the officer-questions
 * list here, once, and screens can trust the two arrays.
 */
export function pickFull(raw: unknown, working = false): FullAssessmentData {
  const r = (raw ?? {}) as Record<string, unknown>;
  const base: FullAssessmentData = {
    readiness: band(r.readiness),
    hasBlockingRule: r.hasBlockingRule === true,
    blockingRule: pickBlockingRule(r.blockingRule),
    narrative: pickNarrative(r.narrative),
    topIssues: pickTopIssues(r.topIssues),
    countryContext: pickCountryContext(r.countryContext),
  };
  // Exactly `true` only: a string "true", 1 or a missing flag stay locked.
  if (working !== true) return base;
  const grounds = arr(r.refusalGrounds).map(pickCited);
  const flags = arr(r.credibilityFlags).map(pickCited);
  const isJudgement = (f: CitedFinding) => f.kind === 'judgement';
  return {
    ...base,
    refusalGrounds: grounds.filter((f) => !isJudgement(f)),
    credibilityFlags: [...grounds.filter(isJudgement), ...flags],
    strengths: arr(r.strengths).map(pickPlain),
    statementFindings: arr(r.statementFindings).map(pickStatementFinding),
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
  // japa#384: normalise the working flag once, here. Anything other than
  // exactly `true` on the wire is false, so every screen reads a real boolean.
  const meta: AssessmentMeta = {
    ...envelope.meta,
    working: (envelope.meta as { working?: unknown }).working === true,
  };
  // The server decides the tier. Anything that is not exactly "full" is free.
  if (meta.tier === 'full') {
    return {
      tier: 'full',
      meta,
      data: envelope.data ? pickFull(envelope.data, meta.working) : null,
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
        queryClient.invalidateQueries({
          queryKey: assessmentKey(applicationId),
        });
      }
    });
    return () => sub.remove();
  }, [applicationId, queryClient]);

  return useQuery<AssessmentResult>({
    queryKey: assessmentKey(applicationId),
    enabled: !!applicationId,
    queryFn: async () => {
      try {
        const res = await apiService.get<{
          meta: AssessmentMeta;
          data: unknown;
        }>(`/ai/applications/${applicationId}/assessment`);
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

/**
 * When the latest FINISHED review completed (ISO), or null when there is none
 * yet. Integration: the intake response carries a `lastReviewAt` field, but the
 * backend currently sends it as null, so the intake card and screen take the
 * time from the review itself (this query) instead. A review that is still
 * queued/running or failed has no finish time worth comparing against.
 */
export function lastReviewFinishedAt(
  result: AssessmentResult | undefined,
): string | null {
  if (result?.kind !== 'review') return null;
  const m = result.view.meta;
  return m.status === 'succeeded' ? m.finishedAt : null;
}

/** What happened when the user asked for a review. */
export type StartOutcome =
  | 'started' // a job is queued/running, or a stored result came back
  | 'upgrade' // 402: a free caller re-running changed inputs
  | 'no_rubric' // 404: nothing to review against
  | 'not_enough' // 422: intake or documents still needed (see `notEnough`)
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
  // japa#309: what the last refused start said was still needed, read from the
  // 422 body. Null when the body had nothing usable (the caller then uses its
  // own view) and reset on every new start.
  const [notEnough, setNotEnough] = useState<ReviewGaps | null>(null);

  const start = async (
    source: 'cta' | 'rerun' | 'retry' = 'cta',
  ): Promise<StartOutcome> => {
    // Guard: ignore a second tap while one is in flight.
    if (run.isPending) return 'started';
    analyticsService.trackReviewEvent('review_run_started', { source });
    setNotEnough(null);
    try {
      await run.mutateAsync();
      return 'started';
    } catch (e) {
      if (isUpgradeRequired(e)) return 'upgrade'; // not an error: show upgrade path
      if (isNoRubric(e)) return 'no_rubric';
      // Checked before the generic error: a refusal for missing content is not
      // a failure, and it is never the upgrade screen.
      if (isNotEnoughToReview(e)) {
        setNotEnough(parseReviewGaps(asApiError(e)?.body));
        return 'not_enough';
      }
      if (isOffline(e)) return 'offline';
      return 'error';
    }
  };

  return { start, isStarting: run.isPending, notEnough };
}
