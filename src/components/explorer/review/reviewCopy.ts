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
  AssessmentMeta,
  AssessmentView,
  CitedFinding,
  FullAssessmentData,
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

/** Failed-job reason clause for the card sentence ("…finish your review{clause}"). */
export function failedCardCopy(meta: AssessmentMeta | null): string {
  const code = meta?.error?.code;
  if (code === 'daily_cap_exceeded' || code === 'cost_cap_exceeded') {
    return 'We couldn’t finish your review. Nothing you added is lost. Reviews are paused for now, so try again tomorrow.';
  }
  const because = code === 'timed_out' ? ' because it took too long' : '';
  return `We couldn’t finish your review${because}. Nothing you added is lost. Try again.`;
}

/** Failed-job reason line for the review screen. */
export function failedReasonLine(meta: AssessmentMeta | null): string {
  const code = meta?.error?.code;
  if (code === 'timed_out') return 'It took too long.';
  if (code === 'daily_cap_exceeded' || code === 'cost_cap_exceeded')
    return 'Reviews are paused for now. Try again tomorrow.';
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
  if (d.insufficientInformation.length > 0)
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
