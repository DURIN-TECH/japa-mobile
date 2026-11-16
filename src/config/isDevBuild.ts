// ─────────────────────────────────────────────────────────────────────────────
// The one "is this a development build?" check for dev tools (japa#375).
//
// `__DEV__` is true only in a development bundle (Metro / dev client). It is
// false in every release bundle — `preview`, `tester` (TestFlight, which is
// APP_ENV=staging, so `IS_PROD` is false there) and `production` — so dev
// tools gate on this, never on `IS_PROD` / `APP_ENV`.
//
// Read at CALL time, not import time, so a unit test can set
// `global.__DEV__ = false` and prove the release-build behaviour.
// ─────────────────────────────────────────────────────────────────────────────

/** True only in a development (`__DEV__`) bundle. */
export function isDevBuild(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
}
