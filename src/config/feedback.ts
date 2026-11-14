// ─────────────────────────────────────────────────────────────────────────────
// Feedback build flag parser (issue #257).
//
// `EXPO_PUBLIC_FEEDBACK_ENABLED=false` in a build's environment removes the
// floating feedback button and its Settings row for that build. Anything else,
// including unset, leaves the feature on.
//
// app.config.ts repeats this rule (the Expo config loader cannot import local
// TS files) and bakes the result into expo `extra.feedbackEnabled`. Runtime
// code reads it from `FEEDBACK_ENABLED` in `config/env.ts`, never `process.env`.
// ─────────────────────────────────────────────────────────────────────────────

/** True unless the value is exactly "false" (case and spaces ignored). */
export function isFeedbackEnabledFlag(value: string | undefined): boolean {
  return value?.trim().toLowerCase() !== 'false';
}
