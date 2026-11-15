// ─────────────────────────────────────────────────────────────────────────────
// Self-service-only build flag parser (japa#334).
// Temporary launch flag — remove when agent features are released (DURIN-TECH/japa#336).
//
// `EXPO_PUBLIC_SELF_SERVICE_ONLY=true` in a build's environment turns the app
// into the self-service-only launch build: agents, agencies, consultation
// booking, agent messaging and agent payment requests lose every entry point
// and their routes redirect to Home (see `selfServiceRoutes.ts`).
//
// OFF by default, the opposite of the feedback flag: only the exact value
// "true" (case and surrounding spaces ignored) turns it on. Unset, empty,
// "1", "yes" or anything else leaves the app exactly as it is today, so a
// plain local `expo start` shows every feature.
//
// app.config.ts repeats this rule (the Expo config loader cannot import local
// TS files) and bakes the result into expo `extra.selfServiceOnly`. Runtime
// code reads it through `SELF_SERVICE_ONLY` / `isSelfServiceOnly()` in
// `config/env.ts`, never `process.env`.
// ─────────────────────────────────────────────────────────────────────────────

/** True only when the value is exactly "true" (case and spaces ignored). */
export function isSelfServiceOnlyFlag(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}
