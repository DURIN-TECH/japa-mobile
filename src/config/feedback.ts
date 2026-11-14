// ─────────────────────────────────────────────────────────────────────────────
// Feedback build flag (issue #257).
//
// `EXPO_PUBLIC_FEEDBACK_ENABLED=false` in a build's environment removes the
// floating feedback button and its Settings row for that build (for example a
// store release that testers should not see). Anything else, including unset,
// leaves the feature on. Expo inlines `EXPO_PUBLIC_*` values at bundle time,
// which is why this one flag is read from `process.env` here: it is a UI
// switch, not backend/Firebase routing (that stays in `config/env.ts`).
// ─────────────────────────────────────────────────────────────────────────────

/** True unless the build sets EXPO_PUBLIC_FEEDBACK_ENABLED to exactly "false". */
export function isFeedbackEnabledFlag(value: string | undefined): boolean {
  return value?.trim().toLowerCase() !== 'false';
}

/** Whether this build ships the feedback feature at all. */
export const FEEDBACK_ENABLED = isFeedbackEnabledFlag(
  process.env.EXPO_PUBLIC_FEEDBACK_ENABLED,
);
