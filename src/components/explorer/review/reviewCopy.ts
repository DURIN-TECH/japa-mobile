// ─────────────────────────────────────────────────────────────────────────────
// Review copy + small pure helpers (issue #43 design spec, "Copy").
//
// HARD RULES for every string in this file:
//   • Never say verdict, refusal, refused, approved, approval, likely, chance,
//     genuine or score. The app shows readiness and things to fix, not a decision.
//   • Route-neutral: no country, nationality or visa-type names. Anything
//     route-specific (criterion titles, rule references, quotes, links) comes
//     from the review data and is rendered as received.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AssessmentErrorCode,
  AssessmentMeta,
  AssessmentView,
  CitedFinding,
  FullAssessmentData,
  InsufficientItem,
  ReadinessBand,
  StaleReason,
} from '@/types/assessment.type';

/** Band → label shown to the applicant (the enum words are never shown). */
export const BAND_LABEL: Record<ReadinessBand, string> = {
  not_ready: 'Not ready',
  weak: 'Needs work',
  competitive: 'On track',
  strong: 'Strong',
};

/** Band → level 1..4 (segments filled in the gauge / meter). */
export const BAND_LEVEL: Record<ReadinessBand, number> = {
  not_ready: 1,
  weak: 2,
  competitive: 3,
  strong: 4,
};

/** Band → one-sentence summary on the review screen. */
export const BAND_SUMMARY: Record<ReadinessBand, string> = {
  not_ready:
    'Important parts of your application are missing or don’t meet the rules yet. Start with the list below.',
  weak: 'Your application has gaps that are worth fixing before you apply.',
  competitive:
    'Your application covers most of what the rules ask for. A few things would make it clearer.',
  strong:
    'Your application covers what the rules ask for, based on what you’ve given us.',
};

/** Disclaimer, shown once per result. */
export const DISCLAIMER =
  'This is guidance on how ready your application looks against the published rules. It isn’t a decision and it isn’t legal advice.';

/** A band label, tolerant of a missing band (older/odd payloads). */
export const bandLabel = (b: ReadinessBand | null | undefined) =>
  b ? BAND_LABEL[b] : 'Reviewed';

/** Out-of-date note, by reason and by tier. */
export function staleCopy(
  reason: StaleReason | null,
  tier: 'free' | 'full',
): string {
  if (reason === 'rules_updated') {
    return tier === 'full'
      ? 'The published rules for this visa have been updated since this review. Run it again to check against the current rules.'
      : 'The published rules for this visa have been updated since this review. Running it again is part of the full review.';
  }
  return tier === 'full'
    ? 'You’ve changed your documents or answers since this review, so it’s out of date. Run it again to see where you stand now.'
    : 'You’ve changed your documents or answers since this review, so it’s out of date. Running it again is part of the full review.';
}

// ── Failed review (japa#310) ─────────────────────────────────────────────────
// Which failures a retry can fix, and what each one says.
//
//   daily_cap_exceeded  the platform-wide daily limit: a real pause, so
//                       "Reviews are paused for now, so try again tomorrow" is
//                       true for it, and only for it.
//   too_many_documents  the application has more documents than one review can
//   review_too_large    read, or is too large for one review for another
//                       reason. The same inputs fail the same way every time,
//                       and the app cannot remove a document yet (japa#314), so
//                       there is no "Try again": the applicant is pointed at
//                       support instead.
//   cost_cap_exceeded   only on failures stored before japa#310 (the old,
//                       too-tight size check). A retry goes through the new
//                       checks and can succeed, so it gets the generic wording
//                       and keeps "Try again". It never says reviews are paused.
//
// Any other or unknown code: the generic wording with "Try again".

/** Failure codes a retry cannot fix: the application is too big for one review. */
const TOO_BIG_CODES: readonly string[] = [
  'too_many_documents',
  'review_too_large',
] satisfies AssessmentErrorCode[];

/** Where "Contact support" goes (same address as Settings → Contact support). */
export const SUPPORT_MAILTO = 'mailto:support@weareseli.com';
/** Button label used instead of "Try again" when a retry cannot succeed. */
export const CONTACT_SUPPORT_LABEL = 'Contact support';

/**
 * Whether "Try again" can succeed for a failed review. False only for the
 * size codes above; a missing meta or error counts as retryable (as before).
 */
export function failedCanRetry(meta: AssessmentMeta | null): boolean {
  const code = meta?.error?.code;
  return !code || !TOO_BIG_CODES.includes(code);
}

/** The plain size sentence for a too-big failure, or null for any other code. */
function tooBigLine(code: string | undefined): string | null {
  if (code === 'too_many_documents')
    return 'This application has more documents than one review can read.';
  if (code === 'review_too_large')
    return 'This application is larger than one review can read.';
  return null;
}

/** What to do instead of retrying a too-big failure. */
const TOO_BIG_ACTION = 'Contact support and we’ll help you with it.';

/** Failed-job sentence for the self-service review card. */
export function failedCardCopy(meta: AssessmentMeta | null): string {
  const code = meta?.error?.code;
  if (code === 'daily_cap_exceeded') {
    return 'We couldn’t finish your review. Nothing you added is lost. Reviews are paused for now, so try again tomorrow.';
  }
  const tooBig = tooBigLine(code);
  if (tooBig)
    return `We couldn’t finish your review. ${tooBig} Nothing you added is lost. ${TOO_BIG_ACTION}`;
  const because = code === 'timed_out' ? ' because it took too long' : '';
  return `We couldn’t finish your review${because}. Nothing you added is lost. Try again.`;
}

/**
 * Failed-job reason line for the review screen. The screen adds "Nothing you
 * added is lost." itself, as a note under this line.
 */
export function failedReasonLine(meta: AssessmentMeta | null): string {
  const code = meta?.error?.code;
  if (code === 'timed_out') return 'It took too long.';
  if (code === 'daily_cap_exceeded')
    return 'Reviews are paused for now. Try again tomorrow.';
  const tooBig = tooBigLine(code);
  if (tooBig) return `${tooBig} ${TOO_BIG_ACTION}`;
  return 'Something went wrong on our side.';
}

/** Date like "4 Mar 2026" (the app has no date lib for this; keep it local). */
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Time like "14:05". */
export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** "Saved just now" within a minute, else "Saved {date}". */
export function savedLabel(iso: string | null | undefined): string {
  if (!iso) return 'Saved';
  const t = new Date(iso).getTime();
  if (!isNaN(t) && Date.now() - t < 60_000) return 'Saved just now';
  return `Saved ${fmtDate(iso)}`;
}

// ── No review for this visa (404 NO_APPROVED_RUBRIC, #251) ───────────────────
// The route has no published rulebook, so there is nothing to review against.
// That is a plain "not available for this visa yet", not a half-finished
// check, so the copy says so and points the user at what they CAN do. Shared
// by the self-service card and the full review screen so they never drift.
export const NO_REVIEW_TITLE = 'Review not available for this visa yet';
export const NO_REVIEW_BODY =
  'Seli doesn’t have a review for this visa yet. You can still prepare your answers and upload your documents here.';

// ── After the review: "Then you apply" (japa#312) ────────────────────────────
// Self-service has no end state in the app yet (recording "I’ve applied" is
// japa#298), so the review screen says in words what happens next: Seli has
// checked against the published rules, Seli does NOT send the application,
// and the applicant applies on the official site, whose link sits on the
// self-service screen under the card titled "Where you apply".
export const THEN_YOU_APPLY_TITLE = 'Then you apply';
export const THEN_YOU_APPLY_BODY =
  'We’ve checked what you’ve given us against the published rules for this visa. We don’t send your application for you. When you’re ready, you apply yourself on the official government site. The link is under “Where you apply” on your application.';

/** True for the entry a fixed (mandatory-bar) rule produced. */
export const isFixedRuleFinding = (f: CitedFinding) =>
  f.isMandatoryBar === true || f.kind === 'mandatory_bar';

/** Full tier: a fixed rule blocks the application, so the review stops early. */
export const fullTierBlocked = (d: FullAssessmentData) =>
  d.hasBlockingRule || d.refusalGrounds.some(isFixedRuleFinding);

/**
 * Whether the review screen shows the "Then you apply" section (japa#312).
 *
 * Only for a finished result (free or full) that no fixed rule blocks. A
 * blocked result keeps its own wording and "Find an agent": telling that
 * applicant to go and apply would be wrong. Every other state (waiting,
 * failed, no data) has nothing to follow up on yet.
 */
export function showsThenYouApply(view: AssessmentView | null): boolean {
  if (!view || view.meta.status !== 'succeeded' || !view.data) return false;
  if (view.tier === 'free') return !view.data.hasBlockingRule;
  return !fullTierBlocked(view.data);
}

// ── "What we couldn't tell": only what the applicant can act on (japa#308) ──
// The engine also stores rules it never checked because they can't be tied to
// the applicant: specialist rules whose guidance names no answer they depend
// on (`no_trigger`) and rules no document in the rulebook would show
// (`not_in_documents`). On UK Standard Visitor v2 that is about two hundred
// items, so listing them buried the few real ones. They are kept for staff;
// the applicant sees one calm line instead, naming no rule and giving no count.
// Their `reason` text is written for staff and is never shown.

/**
 * Closing line of "What we couldn’t tell" when items were left out. Route
 * neutral on purpose ("most people", not "most visitors"): this screen serves
 * every visa.
 */
export const COULDNT_TELL_SKIPPED_LINE =
  'Some rules in the guidance don’t apply to most people, so we didn’t check them.';

/**
 * Splits `insufficientInformation` into the items to list and whether any were
 * left out. Kept: `notAssessed` absent (unreadable document, judgement call not
 * completed, and every item of a result stored before the field existed),
 * `unanswered` and `missing_fact`. Any other value, including one a newer
 * backend may add, is left out: an unknown reason is staff text by default.
 *
 * Tolerates a missing array (older or odd payloads).
 */
export function couldntTell(items: InsufficientItem[] | null | undefined): {
  shown: InsufficientItem[];
  anyHidden: boolean;
} {
  const all = items ?? [];
  const shown = all.filter(
    (i) =>
      i.notAssessed == null ||
      i.notAssessed === 'unanswered' ||
      i.notAssessed === 'missing_fact',
  );
  return { shown, anyHidden: shown.length < all.length };
}

/**
 * Full tier "What to do next", built in the app from which sections are
 * non-empty. With nothing left to fix, the closing step points at the official
 * site (japa#312), and "run the review again" always ends the list.
 */
export function nextSteps(d: FullAssessmentData): string[] {
  const steps: string[] = [];
  const g = d.refusalGrounds.length;
  if (g > 0)
    steps.push(
      g === 1
        ? 'Fix the rule that isn’t met yet.'
        : `Fix the ${g} rules that aren’t met yet.`,
    );
  // japa#308: only when something the applicant can act on is listed, never
  // for the staff-only items "What we couldn’t tell" leaves out.
  if (couldntTell(d.insufficientInformation).shown.length > 0)
    steps.push('Add what we couldn’t check.');
  const q = d.credibilityFlags.length;
  if (q > 0)
    steps.push(
      q === 1
        ? 'Get ready for the question an officer may ask.'
        : `Get ready for the ${q} questions an officer may ask.`,
    );
  if (steps.length === 0)
    steps.push('When you’re happy with it, apply on the official site.');
  steps.push('Run the review again to see where you stand.');
  return steps;
}

// ── Enough to review (japa#309) ──────────────────────────────────────────────
// A review needs something to read. The backend refuses a start (422
// NOT_ENOUGH_TO_REVIEW) until the application has (1) no open required intake
// question, when the route has an intake, and (2) at least one uploaded
// document that is not the refusal letter (the review never reads that one).
// The statement is not required. The hub works the same rule out from what it
// already has loaded, so it can say what is still needed instead of offering a
// button that would only be refused.

/** A part of the application the review still needs, in the backend's order. */
export type ReviewGap = 'intake' | 'documents';

/** What is still needed. `missing` is never empty. */
export interface ReviewGaps {
  missing: ReviewGap[];
  /** Open required intake questions; 0 when the intake is not missing. */
  openRequiredCount: number;
}

/** Whether the review can start, as far as the app can tell. */
export type ReviewContent =
  | { status: 'loading' } // intake or documents still loading: no run yet
  | { status: 'enough' }
  | { status: 'missing'; gaps: ReviewGaps };

/** The refusal letter's requirement id. The review does not read it. */
export const REFUSAL_LETTER_REQUIREMENT_ID = 'refusal-letter';

/** Uploaded documents the review reads (everything but the refusal letter). */
export function reviewableDocumentCount(
  docs: readonly { requirementId?: string | null }[],
): number {
  return docs.filter((d) => d.requirementId !== REFUSAL_LETTER_REQUIREMENT_ID)
    .length;
}

/**
 * The hub's own "enough to review" check.
 *
 * `intakeOpen`: the number of open required questions, `'none'` when the
 * route has no intake, `'unknown'` when it could not be loaded.
 * `documents`: the reviewable document count, or `'unknown'` when the list
 * could not be loaded.
 *
 * An unknown part never blocks: the backend decides, and a refusal comes back
 * as the same lines (see `parseReviewGaps`).
 */
export function reviewContent(input: {
  intakeOpen: number | 'none' | 'unknown' | 'loading';
  documents: number | 'unknown' | 'loading';
}): ReviewContent {
  const { intakeOpen, documents } = input;
  if (intakeOpen === 'loading' || documents === 'loading')
    return { status: 'loading' };
  const missing: ReviewGap[] = [];
  const open = typeof intakeOpen === 'number' ? intakeOpen : 0;
  if (open > 0) missing.push('intake');
  if (documents === 0) missing.push('documents');
  return missing.length === 0
    ? { status: 'enough' }
    : { status: 'missing', gaps: { missing, openRequiredCount: open } };
}

/**
 * Reads the backend's 422 NOT_ENOUGH_TO_REVIEW body
 * (`{ error, message, missing, openRequiredCount }`, fields at the top level).
 * Unknown entries are dropped and the order is fixed (intake, then
 * documents). Returns null when nothing usable is left, so the caller can fall
 * back to its own view.
 */
export function parseReviewGaps(body: unknown): ReviewGaps | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { missing?: unknown; openRequiredCount?: unknown };
  const raw = Array.isArray(b.missing) ? b.missing : [];
  const missing = (['intake', 'documents'] as const).filter((g) =>
    raw.includes(g),
  );
  if (missing.length === 0) return null;
  const n = b.openRequiredCount;
  const openRequiredCount =
    missing.includes('intake') && typeof n === 'number' && n > 0
      ? Math.floor(n)
      : 0;
  return { missing: [...missing], openRequiredCount };
}

/**
 * One line per missing part, in order. `intakeStep` is the intake's step
 * number on the screen (0 when the screen shows no intake step, e.g. it has
 * not loaded): the step number comes from `selfServiceSteps`, never a fixed 1.
 */
export function reviewGapLines(
  gaps: ReviewGaps,
  intakeStep: number,
): { gap: ReviewGap; text: string }[] {
  return gaps.missing.map((gap) => {
    if (gap === 'documents')
      return { gap, text: 'Upload at least one document.' };
    const n = gaps.openRequiredCount;
    const what =
      n === 1
        ? 'the required question'
        : n > 1
          ? `the ${n} required questions`
          : 'the required questions';
    const where = intakeStep > 0 ? ` in Step ${intakeStep}` : '';
    return { gap, text: `Answer ${what}${where}.` };
  });
}

/** Lead line of the review card when something is still needed. */
export const NEEDS_CONTENT_BODY =
  'Seli needs a little more before it can review your application:';

/**
 * Where the hub is not on screen (the review screen), a refused start gets one
 * line pointing back to it.
 */
export const NEEDS_CONTENT_ELSEWHERE =
  'Your application needs a little more before it can be reviewed. Go back to your application to see what’s still needed.';

/** A refused start whose body named nothing usable (should not happen). */
export const NEEDS_CONTENT_GENERIC =
  'Your application needs a little more before it can be reviewed.';
