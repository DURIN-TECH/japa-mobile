// ─────────────────────────────────────────────────────────────────────────────
// Which refusal analysis the refusal-letter screen shows (#269).
//
// Two sources can name an analysis for an application:
//   - the id saved on the phone (useStoredAnalysisId), set when this phone
//     started an analysis;
//   - an `analysisId` route param, from a "refusal_analysis_ready" push. It is
//     the newest analysis, so it wins.
//
// Rules (pure, so they are unit tested on their own):
//   1. Once the saved id has loaded, a pushed id is ADOPTED: it becomes the
//      saved id for the application, so there is one "current" id and
//      "Start over" (which clears the saved id) works as before. The saved id
//      it replaced is kept as the fallback.
//   2. If loading the adopted pushed id fails with 403/404 (not this user's,
//      or gone), drop it and go back to the fallback id, or to the upload
//      step when there is none. The user is never left on an error whose
//      "Try again" would re-read the same id.
//   3. Any other failure (network, 5xx) keeps the normal error + "Try again".
// ─────────────────────────────────────────────────────────────────────────────

/** What the decision reads. */
export interface AnalysisIdState {
  /** `analysisId` route param (from a push), if any. */
  paramId: string | null;
  /** The id saved on the phone for this application. */
  savedId: string | null;
  /** The saved id has been read from storage. */
  storedReady: boolean;
  /** The route param has already been adopted (never adopt it twice). */
  paramHandled: boolean;
  /** The adopted pushed id, while it is still the current one. */
  pushedId: string | null;
  /** The saved id the pushed id replaced (the fallback). */
  previousId: string | null;
  /** The error from loading the current analysis, if any. */
  loadError: unknown;
}

/** What the screen should do next. */
export type AnalysisIdStep =
  | { kind: 'none' }
  | { kind: 'adopt'; id: string; previousId: string | null }
  | { kind: 'fallback'; id: string | null };

/** True for a 403/404 read: the analysis is not this user's or no longer exists. */
export function isAnalysisGone(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  return status === 403 || status === 404;
}

/** The id to load right now (a pending param already wins before adoption). */
export function currentAnalysisId(
  s: Pick<AnalysisIdState, 'paramId' | 'savedId' | 'paramHandled'>,
): string | null {
  if (!s.paramHandled && s.paramId) return s.paramId;
  return s.savedId;
}

/** The next step: adopt the pushed id, fall back from a rejected one, or nothing. */
export function nextAnalysisIdStep(s: AnalysisIdState): AnalysisIdStep {
  if (!s.storedReady) return { kind: 'none' };

  // Rule 1: adopt a pushed id once.
  if (s.paramId && !s.paramHandled) {
    return {
      kind: 'adopt',
      id: s.paramId,
      previousId: s.savedId && s.savedId !== s.paramId ? s.savedId : null,
    };
  }

  // Rule 2: the adopted pushed id is current and was rejected → fall back.
  if (s.pushedId && s.savedId === s.pushedId && isAnalysisGone(s.loadError)) {
    return { kind: 'fallback', id: s.previousId };
  }

  return { kind: 'none' };
}
