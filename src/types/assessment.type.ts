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

/** Readiness band. Computed by the backend from stored outcomes. */
export type ReadinessBand = 'not_ready' | 'weak' | 'competitive' | 'strong';

/** Job lifecycle. */
export type AssessmentStatus = 'queued' | 'running' | 'succeeded' | 'failed';

/** Why a stored review no longer matches the current state (server-computed). */
export type StaleReason = 'inputs_changed' | 'rules_updated';

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
}

/** A plain finding without a citation (strengths, statement findings). */
export interface PlainFinding {
  criterionId: string;
  title: string;
  detail: string;
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

/** Something the engine could not decide. */
export interface InsufficientItem {
  criterionId: string;
  title: string;
  reason: string;
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
 * The full `data` object, trimmed to the fields mobile uses. Everything the
 * backend sends beyond these is ignored on purpose.
 */
export interface FullAssessmentData {
  readiness: ReadinessBand | null;
  hasBlockingRule: boolean;
  refusalGrounds: CitedFinding[];
  credibilityFlags: CitedFinding[];
  strengths: PlainFinding[];
  statementFindings: StatementFinding[];
  insufficientInformation: InsufficientItem[];
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
