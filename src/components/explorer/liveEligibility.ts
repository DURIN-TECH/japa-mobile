// ─────────────────────────────────────────────────────────────────────────────
// Eligibility — live backend adapter (japa#145).
//
// The quiz (`/eligibility`) and result (`/eligibility/result`) screens used to
// fall back to the static demo `ELIG_Q` questions and `ELIG_RESULT` score.
// They now render only backend data:
//   • GET  /eligibility/questions/:visaTypeId → mapQuestion() → EligQ
//   • GET  /eligibility/checks/:checkId       → mapCheckResult() → result view
// Moved out of the screens so the mapping is unit-tested.
//
// Pure (type-only imports) so it is tested directly.
// ─────────────────────────────────────────────────────────────────────────────

import type { EligQ } from '@/types/explorer.type';
import type {
  EligibilityCheck,
  EligibilityLevel,
  EligibilityQuestion,
} from '@/types/eligibility.type';

/**
 * Backend question → the wizard's EligQ. The wizard renders four input types
 * (boolean / single / multiple / number); 'date' / 'text' (and anything
 * unknown) become a single-select when the question ships options, else a
 * number field, so every question stays renderable.
 */
export function mapQuestion(bq: EligibilityQuestion): EligQ {
  let type: EligQ['type'];
  switch (bq.type) {
    case 'boolean':
    case 'multiple':
    case 'number':
    case 'single':
      type = bq.type;
      break;
    default:
      type = bq.options?.length ? 'single' : 'number';
      break;
  }
  return {
    id: bq.id,
    type,
    q: bq.question,
    // Prefer explicit help text; fall back to the longer description.
    help: bq.helpText ?? bq.description,
    opts: bq.options,
    unit: bq.unit,
    min: bq.minValue,
    max: bq.maxValue,
  };
}

/** eligibilityLevel → verdict pill copy. */
export const VERDICT: Record<EligibilityLevel, string> = {
  high: 'Likely eligible',
  medium: 'Possibly eligible',
  low: 'Needs work',
  not_applicable: 'No visa required',
};

/** Generic summary when the backend sent no recommendation. */
export const GENERIC_SUMMARY: Record<EligibilityLevel, string> = {
  high: 'Based on your answers, you have a strong profile for this visa.',
  medium: 'Based on your answers, you may be eligible with a few improvements.',
  low: 'Based on your answers, your profile needs work. An expert can help.',
  not_applicable:
    'Based on your answers, you may not need a visa for this trip.',
};

/** What the result screen renders. */
export interface EligResultView {
  /** 0–100. */
  score: number;
  verdict: string;
  summary: string;
  /** Criteria met (passed breakdown items). */
  matched: string[];
  /** What's missing (explicit requirements, else failed breakdown items). */
  gaps: string[];
}

/** One scored check → the result view. Never invents a score or verdict. */
export function mapCheckResult(
  c: Pick<
    EligibilityCheck,
    | 'score'
    | 'eligibilityLevel'
    | 'breakdown'
    | 'missingRequirements'
    | 'recommendations'
  >,
): EligResultView {
  const breakdown = Array.isArray(c.breakdown) ? c.breakdown : [];
  const matched = breakdown.filter((b) => b.passed).map((b) => b.question);
  const gaps = c.missingRequirements?.length
    ? c.missingRequirements
    : breakdown.filter((b) => !b.passed).map((b) => b.question);
  const score = Number.isFinite(c.score)
    ? Math.max(0, Math.min(100, c.score))
    : 0;
  return {
    score,
    verdict: VERDICT[c.eligibilityLevel] ?? '',
    summary:
      c.recommendations?.[0] ?? GENERIC_SUMMARY[c.eligibilityLevel] ?? '',
    matched,
    gaps,
  };
}
