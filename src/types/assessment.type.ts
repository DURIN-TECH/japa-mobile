// ─────────────────────────────────────────────────────────────────────────────
// Application review ("assessment") — response contract from backend issue #42.
//
// Routes (mounted at /ai):
//   POST /ai/applications/:id/assess      202 { assessmentId, status }  job queued/running
//                                          200 { meta, data }            stored result, unchanged inputs
//                                          402 UPGRADE_REQUIRED          free caller re-running changed inputs
//                                          404 NO_APPROVED_RUBRIC        route has no approved rubric
//   GET  /ai/applications/:id/assessment  200 { meta, data }
//                                          404 NO_ASSESSMENT             "no review yet"
//                                          404 NO_APPROVED_RUBRIC        "nothing to review against"
//
// The shape of `data` depends on `meta.tier`, which the SERVER decides:
//   free → readiness band + top three issues + one boolean. Nothing else exists
//          in the payload, so nothing locked can be drawn from hidden data.
//   full → the cited review.
//
// Product rules baked into these types:
//   • There is deliberately NO `score`, `internalCall`, `confidence`, `usage` or
//     `costUsd` field here. They are internal; even if a payload carries them the
//     mobile app never reads them (see `pickFullData` in useCaseOfficer.ts, which
//     copies only the fields typed below).
//   • No country, nationality or visa names: every route-specific string arrives
//     in the payload (criterion titles, rule references, quotes, links).
// ─────────────────────────────────────────────────────────────────────────────

import type { StackLayer } from '@/types/sharedRoute.type';

/** Readiness band. Computed by the backend from stored outcomes. */
export type ReadinessBand = 'not_ready' | 'weak' | 'competitive' | 'strong';

/** Job lifecycle. */
export type AssessmentStatus = 'queued' | 'running' | 'succeeded' | 'failed';

/** Why a stored review no longer matches the current state (server-computed). */
export type StaleReason = 'inputs_changed' | 'rules_updated';

// ── Failed-job codes (mirror of the backend's ASSESSMENT_ERROR_CODES) ─────────
// `meta.error.code` stays typed as `string` because a newer backend may send a
// code this build does not know; the copy helpers fall back to the generic
// "Try again" wording for those. This list is what the app knows by name.
//
// japa#310: the codes the applicant sees differently from the generic failure:
//   daily_cap_exceeded  the PLATFORM-WIDE daily limit is used up: a real pause,
//                       "try again tomorrow" is true
//   too_many_documents  this application has more documents than one review can
//                       read; the same inputs fail the same way, so a retry
//                       cannot succeed
//   review_too_large    this application is too large for one review for another
//                       reason (the rules, the text, or files together over
//                       60 MB); a retry cannot succeed
//   cost_cap_exceeded   only on failures stored before japa#310; a retry now
//                       goes through the new checks and can succeed
export const ASSESSMENT_ERROR_CODES = [
  'inputs_changed',
  'rubric_changed',
  'timed_out',
  'cost_cap_exceeded',
  'daily_cap_exceeded',
  'too_many_documents',
  'review_too_large',
  'settings_unavailable',
  'disabled',
  'provider_error',
  'provider_refused',
  'provider_stopped',
  'invalid_model_output',
  'internal_error',
  'application_closed',
] as const;
export type AssessmentErrorCode = (typeof ASSESSMENT_ERROR_CODES)[number];

/** Rubric criterion kind (copied from the rubric by the backend). */
export type CriterionKind =
  | 'objective'
  | 'mandatory_bar'
  | 'judgement'
  | string;

/**
 * Decision stage a criterion belongs to (backend `DECISION_STAGES`). Copied from
 * the rubric by code, never model text. Absent on reviews stored before the
 * field existed, so readers must tolerate `undefined`.
 */
export type DecisionStage =
  | 'validity'
  | 'suitability'
  | 'eligibility'
  | 'credibility';

/** Job metadata, beside `data` and never inside it. */
export interface AssessmentMeta {
  assessmentId: string;
  status: AssessmentStatus;
  tier: 'free' | 'full';
  rubricVersion: number;
  staleReason: StaleReason | null;
  stale: boolean;
  startedAt: string | null; // ISO
  finishedAt: string | null; // ISO
  error: { code: string; message: string } | null;
  /** japa#237: the rulebook layers (omitted for a single-layer route). */
  stackLayers?: StackLayer[];
  /**
   * japa#384: true exactly when `data` carries the rule-by-rule findings (the
   * "working": `refusalGrounds`, `credibilityFlags`, `strengths`,
   * `statementFindings`, `insufficientInformation`). The SERVER decides it from
   * the `ai.review_working` entitlement. `toView` normalises it: anything other
   * than exactly `true` from the wire becomes `false`, so screens can trust it.
   */
  working: boolean;
}

/** One of the (up to three) issues on the free tier: title only. */
export interface TopIssue {
  criterionId: string;
  title: string;
}

/** The whole free `data` object. */
export interface FreeAssessmentData {
  readiness: ReadinessBand | null;
  topIssues: TopIssue[];
  /** A fixed rule blocks the applicant (no rule text on the free tier). */
  hasBlockingRule: boolean;
}

/** A cited finding (refusal ground or credibility flag). */
export interface CitedFinding {
  criterionId: string;
  title: string;
  kind?: CriterionKind;
  /** Decision stage (backend integration): undefined on older stored reviews. */
  stage?: DecisionStage;
  isMandatoryBar?: boolean;
  ruleRef: string | null;
  sourceUrl: string;
  sourceQuote: string;
  detail: string;
  whatWouldHelp: string;
  /** japa#237: the rulebook layer of the rule (stacks only). */
  layerKey?: string;
}

/** A plain finding without a citation (strengths, statement findings). */
export interface PlainFinding {
  criterionId: string;
  title: string;
  detail: string;
  layerKey?: string;
}

/**
 * A finding about the applicant's statement. `comment` is the explanation (the
 * backend also copies it to `detail` for older readers); `nodePath` is the
 * child index path of the block it is about, absent when the position could
 * not be validated (a position is never guessed).
 */
export interface StatementFinding extends PlainFinding {
  comment: string;
  stage?: DecisionStage;
  nodePath?: number[];
}

/**
 * Why the engine did not assess a rule (mirror of the backend's
 * `InsufficientItem.notAssessed`, japa#308). Absent on an item the applicant
 * can help with (an unreadable document, a judgement call that could not be
 * completed) and on results stored before the field existed.
 *   unanswered        the rule's trigger question isn't answered yet
 *   missing_fact      a fact the rule needs is missing
 *   no_trigger        the guidance names no answer the rule depends on (staff only)
 *   not_in_documents  no document in the rulebook would show it (staff only)
 */
export type NotAssessedReason =
  | 'unanswered'
  | 'no_trigger'
  | 'missing_fact'
  | 'not_in_documents';

/** Something the engine could not decide. */
export interface InsufficientItem {
  criterionId: string;
  title: string;
  /** For `no_trigger` / `not_in_documents` items this is staff text: never shown. */
  reason: string;
  layerKey?: string;
  notAssessed?: NotAssessedReason;
  /**
   * Set only on an item about an UPLOAD that could not be read, not a rule:
   * `criterionId` is then `document:<documentId>` and it has no `notAssessed`
   * (the applicant can act on it). Carried, not rendered yet.
   */
  documentId?: string;
}

/**
 * Published outcome statistics for the applicant's passport country (#116),
 * exactly as the server sends it. Present on the FULL tier only, and only when
 * the server found published figures (`status: 'available'`); the server omits
 * the field otherwise, and the app draws nothing. The wording (`text`) is
 * written by the server from the published numbers: the app shows it as
 * received and adds no wording of its own about likelihood.
 */
export interface CountryContext {
  status: 'available';
  /** Server-written template text: a headline and the lines under it. */
  text: { headline: string; lines: string[] };
  /** Period the figures cover, e.g. "year ending 2026 Q2". */
  period: { label: string };
  source: {
    publisher: string;
    /** The data tables page the figures come from (opened as a link). */
    pageUrl: string;
    fileName: string;
    /** The publisher's caveats (already included in `text.lines`). */
    caveats: string[];
  };
}

/**
 * japa#384: the caseworker-style reading of the applicant's own application,
 * written by the server and checked there in code (banned wording, injection,
 * every figure and quotation grounded in what was sent). Mirrors the backend's
 * `AssessmentNarrative` exactly. The app renders it as received and never
 * truncates it.
 *   paragraphs  1 to 6 short paragraphs, in order
 *   conclusion  the readiness conclusion, set apart under the paragraphs
 *   nextSteps   0 to 5 things that would change the reading
 */
export interface AssessmentNarrative {
  paragraphs: string[];
  conclusion: string;
  nextSteps: string[];
}

/**
 * japa#384: the fixed (mandatory-bar) rule that stops the review. Sent on the
 * full tier WHATEVER the working entitlement (blocking rules are never
 * paywalled); copied by the server from the rubric, never model text. Mirrors
 * the backend's `BlockingRule` exactly. The free tier never carries it.
 */
export interface BlockingRule {
  criterionId: string;
  title: string;
  ruleRef: string | null;
  sourceQuote: string;
  sourceUrl: string;
}

/**
 * The full `data` object, trimmed to the fields mobile uses. Everything the
 * backend sends beyond these is ignored on purpose.
 *
 * japa#384: the finding arrays (the "working") are OPTIONAL. `pickFull` copies
 * them only when `meta.working === true`; otherwise they are absent from the
 * view even if a payload carries them, so nothing behind the working
 * entitlement can be drawn from data the plan doesn't include.
 */
export interface FullAssessmentData {
  readiness: ReadinessBand | null;
  hasBlockingRule: boolean;
  /** japa#384: the bar's rule text; null when no fixed rule blocks. */
  blockingRule: BlockingRule | null;
  /** japa#384: the reading; null when it failed, was skipped or is older. */
  narrative: AssessmentNarrative | null;
  /** japa#384: up to three issue titles (the fallback "Start with these"). */
  topIssues: TopIssue[];
  refusalGrounds?: CitedFinding[];
  credibilityFlags?: CitedFinding[];
  strengths?: PlainFinding[];
  statementFindings?: StatementFinding[];
  insufficientInformation?: InsufficientItem[];
  /** Published figures note (#116). Absent unless the server sent one. */
  countryContext?: CountryContext;
}

/** What the review hook hands to screens, already tier-discriminated. */
export type AssessmentView =
  | { tier: 'free'; meta: AssessmentMeta; data: FreeAssessmentData | null }
  | { tier: 'full'; meta: AssessmentMeta; data: FullAssessmentData | null };

/** Why there is no review to show, distinct from a network failure. */
export type AssessmentEmpty = 'none' | 'no_rubric';

/** Result of the GET: a review, or one of the two "nothing yet" answers. */
export type AssessmentResult =
  | { kind: 'review'; view: AssessmentView }
  | { kind: 'empty'; reason: AssessmentEmpty };
