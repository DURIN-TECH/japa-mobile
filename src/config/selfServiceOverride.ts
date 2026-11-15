// ─────────────────────────────────────────────────────────────────────────────
// Development-only override for the self-service-only flag (japa#375).
// Temporary, like the flag itself — remove with it (DURIN-TECH/japa#336).
//
// The flag (`EXPO_PUBLIC_SELF_SERVICE_ONLY`, japa#334) is baked into the
// build. In a DEVELOPMENT build (`__DEV__` true) a developer, or a scripted
// test (Maestro, japa#361), can override it on the device without rebuilding:
//   - from the Expo dev menu (`utils/dev-menu.ts`), or
//   - with the link `durintech://dev/self-service-only?value=on|off|build`
//     (handled in `app/+native-intent.tsx`).
//
// SAFETY (the point of the issue): when `__DEV__` is false, every function
// here behaves as if no override exists. The override is never read, a link
// is not recognised and nothing is planned, so a TestFlight or store build
// can never turn agent features on through a stored value, link or menu.
//
// This file is PURE: no React, no AsyncStorage, no native module. It holds
// the override that was loaded at startup in a module variable, so
// `isSelfServiceOnly()` in `config/env.ts` stays synchronous and stays the
// single read point. The storage + reload side lives in
// `selfServiceOverrideStore.ts`, so importing `config/env` (which nearly
// every screen and test does) pulls in no native module.
// ─────────────────────────────────────────────────────────────────────────────

/** What a developer can ask for: force on, force off, or the build's value. */
export type SelfServiceRequest = 'on' | 'off' | 'build';

/** Where the effective value comes from (shown in the dev menu / screen). */
export type SelfServiceSource = 'build' | 'override';

/** AsyncStorage key for the stored override ("on" | "off"; absent = none). */
export const SELF_SERVICE_OVERRIDE_KEY = 'dev.selfServiceOnlyOverride';

/** Where the link lands after it is handled (the Home tab's URL). */
export const SELF_SERVICE_LINK_LANDING = '/home' as const;

/**
 * `__DEV__`, read at CALL time (not at import time) so a unit test can set
 * `global.__DEV__ = false` and prove the production behaviour.
 */
const isDev = (): boolean => typeof __DEV__ !== 'undefined' && __DEV__ === true;

// ── The loaded override (module state) ──────────────────────────────────────
// undefined = no override stored (or not a development build).
let loadedOverride: boolean | undefined;

/**
 * Records the override read from storage at startup, or written by the dev
 * menu / link. Ignored outside development, so even a stray call cannot make
 * a production build pick a value up.
 */
export function setLoadedSelfServiceOverride(value: boolean | undefined): void {
  if (!isDev()) return;
  loadedOverride = value;
}

/**
 * The override in effect, or undefined. ALWAYS undefined when `__DEV__` is
 * false, whatever was stored or recorded: this is the production guarantee.
 */
export function getSelfServiceOverride(): boolean | undefined {
  if (!isDev()) return undefined;
  return loadedOverride;
}

/** Test helper: forget the loaded override. */
export function resetSelfServiceOverrideForTests(): void {
  loadedOverride = undefined;
}

// ── Pure rules ──────────────────────────────────────────────────────────────

/** The effective flag: the override when there is one, else the build's. */
export function resolveSelfServiceOnly(
  baked: boolean,
  override: boolean | undefined,
): boolean {
  return override ?? baked;
}

/** Whether the effective value is the build's own or an override. */
export function selfServiceOnlySource(
  override: boolean | undefined,
): SelfServiceSource {
  return override === undefined ? 'build' : 'override';
}

/** Stored string → override. Anything but "on" / "off" means "no override". */
export function parseStoredOverride(
  raw: string | null | undefined,
): boolean | undefined {
  if (raw === 'on') return true;
  if (raw === 'off') return false;
  return undefined;
}

/** Override → stored string (null = remove the key). */
export function serializeOverride(value: boolean | undefined): string | null {
  return value === undefined ? null : value ? 'on' : 'off';
}

/**
 * What a request changes. Deterministic, so the link gives the same result
 * whether the app was running or not:
 *   - `nextOverride`: the override to keep after the request;
 *   - `write`: whether storage must change (it already matches otherwise);
 *   - `reload`: whether the EFFECTIVE value changes. When it does not (the
 *     requested value already applies), there is no reload — so a link that
 *     is re-delivered after the reload cannot cause a reload loop.
 */
export function planSelfServiceChange(
  request: SelfServiceRequest,
  baked: boolean,
  currentOverride: boolean | undefined,
): { nextOverride: boolean | undefined; write: boolean; reload: boolean } {
  const nextOverride = request === 'build' ? undefined : request === 'on';
  const before = resolveSelfServiceOnly(baked, currentOverride);
  const after = resolveSelfServiceOnly(baked, nextOverride);
  return {
    nextOverride,
    write: nextOverride !== currentOverride,
    reload: before !== after,
  };
}

// ── The development-only link ───────────────────────────────────────────────

/**
 * Result of reading an incoming link:
 *   - `null`: not the dev link (or not a development build) — leave the link
 *     alone, so every other link, and this one in production, behaves
 *     exactly as before (in production `/dev/...` is an unknown route);
 *   - `{ request }`: the dev link with an accepted value;
 *   - `{ request: null }`: the dev link with a missing / unknown value —
 *     ignored (nothing changes), but still consumed so it lands on Home.
 */
export type SelfServiceLink = { request: SelfServiceRequest | null } | null;

/**
 * Parses `durintech://dev/self-service-only?value=on|off|build`.
 *
 * expo-router hands `+native-intent` either the full URL or a path, so both
 * `durintech://dev/self-service-only?...` (where `dev` is the URL host) and
 * `/dev/self-service-only?...` are accepted. Values are case-insensitive.
 * Hand-rolled (no `URL`): React Native's URL polyfill is incomplete.
 */
export function parseSelfServiceLink(
  path: string | null | undefined,
): SelfServiceLink {
  // Production guarantee: outside development the link is never recognised.
  if (!isDev() || typeof path !== 'string') return null;

  // Drop the scheme (`durintech://`), then split path from query / hash.
  const withoutScheme = path.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const [beforeHash] = withoutScheme.split('#');
  const qIndex = beforeHash.indexOf('?');
  const pathname = qIndex >= 0 ? beforeHash.slice(0, qIndex) : beforeHash;
  const query = qIndex >= 0 ? beforeHash.slice(qIndex + 1) : '';

  // `dev/self-service-only`, with any leading / trailing slashes.
  const route = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  if (route !== 'dev/self-service-only') return null;

  // Find `value=` in the query string.
  let value: string | undefined;
  for (const pair of query.split('&')) {
    const [k, v = ''] = pair.split('=');
    if (k === 'value') {
      try {
        value = decodeURIComponent(v).trim().toLowerCase();
      } catch {
        value = undefined;
      }
      break;
    }
  }
  if (value === 'on' || value === 'off' || value === 'build') {
    return { request: value };
  }
  return { request: null };
}
