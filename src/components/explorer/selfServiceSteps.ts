// ─────────────────────────────────────────────────────────────────────────────
// Self-service screen: step numbering and the "Where you apply" card copy
// (japa#312).
//
// The official-application card used to be a numbered step ("Step 1 · Official
// application", "Complete the online form") that told applicants to apply
// before preparing. The real order is: get ready here first (documents,
// statement, review), then apply on the official site. So the card is no
// longer a step: it is titled "Where you apply", and the numbered steps are
// only the ones done in the app.
// ─────────────────────────────────────────────────────────────────────────────

/** The numbered steps on the self-service screen, in screen order. */
export type SelfServiceStep = 'intake' | 'documents' | 'statement' | 'review';

/**
 * The steps that are present. The intake (#113) only exists for routes with
 * questions, and when present it is Step 1 and shifts the rest. The statement
 * and review steps (#43) are always there.
 */
export function selfServiceSteps(hasIntake: boolean): SelfServiceStep[] {
  return [
    ...(hasIntake ? (['intake'] as const) : []),
    'documents',
    'statement',
    'review',
  ];
}

/** 1-based step number of `key`, so the numbering never has a gap. */
export const stepNumberOf = (steps: SelfServiceStep[], key: SelfServiceStep) =>
  steps.indexOf(key) + 1;

// ── "Where you apply" card ───────────────────────────────────────────────────
export const OFFICIAL_SITE_TITLE = 'Where you apply';
export const OFFICIAL_SITE_HEADING = 'Apply on the official site';

/**
 * Card body. With a link the "Open <host>" button follows; without one there
 * is no button and no guessed link (japa#174), so the copy says so.
 */
export function officialSiteBody(hasLink: boolean, country: string): string {
  const first =
    'Get ready here first: your documents, your statement and your review.';
  return hasLink
    ? `${first} Then fill in your application on the official government site.`
    : `${first} Then apply on the ${country} government’s official site. We don’t have the link for this visa yet.`;
}
