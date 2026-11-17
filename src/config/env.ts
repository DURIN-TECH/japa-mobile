// ─────────────────────────────────────────────────────────────────────────────
// Environment configuration — the single source of truth for which backend +
// Firebase project the app talks to.
//
// All environment selection happens in `app.config.ts` (which reads APP_ENV from
// the EAS build profile / shell and bakes the resolved values into `extra`). This
// module just surfaces those baked values to runtime code, so nothing at runtime
// reads `process.env` directly and dev/prod can never drift out of sync.
//
//   development / staging → durin-seli-dev (isolated dev Firebase project)
//   production            → japa-platform  (existing prod project)
//
// Set EXPO_PUBLIC_USE_EMULATOR=true to develop against the local Firebase emulator
// suite instead of the deployed backend (see app.config.ts).
// ─────────────────────────────────────────────────────────────────────────────

import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Pure (no native imports): the dev-only override's in-memory value (japa#375).
import {
  getSelfServiceOverride,
  resolveSelfServiceOnly,
} from '@/config/selfServiceOverride';

type AppEnv = 'development' | 'staging' | 'production';

// Values injected by app.config.ts → expo `extra`. Typed + defaulted defensively so
// a misconfigured build fails safe onto the dev project rather than crashing.
const extra = (Constants.expoConfig?.extra ?? {}) as {
  appEnv?: AppEnv;
  firebaseProjectId?: string;
  apiUrl?: string;
  useEmulator?: boolean;
  emulatorProjectId?: string;
  // Raw EXPO_PUBLIC_EMULATOR_*_PORT values (japa#361); see emulatorPort().
  emulatorAuthPort?: string | number;
  emulatorFunctionsPort?: string | number;
  feedbackEnabled?: boolean;
  selfServiceOnly?: boolean;
};

export const APP_ENV: AppEnv = extra.appEnv ?? 'development';
// Whether this build ships the feedback button (issue #257); baked in by
// app.config.ts from EXPO_PUBLIC_FEEDBACK_ENABLED. On unless explicitly false.
export const FEEDBACK_ENABLED = extra.feedbackEnabled !== false;

// ── Self-service-only launch build (japa#334) ───────────────────────────────
// Baked in by app.config.ts from EXPO_PUBLIC_SELF_SERVICE_ONLY. OFF unless the
// build explicitly set it to "true" (see src/config/selfServiceOnly.ts), so a
// misconfigured or local build shows every feature, exactly as before.
export const SELF_SERVICE_ONLY = extra.selfServiceOnly === true;

/**
 * Whether this build hides the agent / agency / booking / messaging features.
 *
 * Screens call this function rather than reading the constant at import time
 * so jest can flip the flag per test with
 * `jest.spyOn(env, 'isSelfServiceOnly').mockReturnValue(true)` (or a
 * `jest.mock('@/config/env', ...)`) without rebuilding the app config.
 *
 * Development-only override (japa#375): in a `__DEV__` build the value can
 * be switched from the Expo dev menu or the link
 * `durintech://dev/self-service-only?value=on|off|build` (see
 * `selfServiceOverride.ts`). This stays the ONE read point — no screen reads
 * the override itself. `getSelfServiceOverride()` is always undefined when
 * `__DEV__` is false, so production / TestFlight builds return the baked
 * value whatever is stored; with no override stored, every build behaves
 * exactly as before.
 */
export function isSelfServiceOnly(): boolean {
  return resolveSelfServiceOnly(SELF_SERVICE_ONLY, getSelfServiceOverride());
}

export const IS_PROD = APP_ENV === 'production';

// The Firebase project this build's native config (google-services / plist) targets.
// Mobile Auth mints tokens for THIS project, so the backend it calls must be the
// same project or every authenticated request 401s.
export const FIREBASE_PROJECT_ID = extra.firebaseProjectId ?? 'durin-seli-dev';

// Whether to route at the local emulator suite instead of the deployed backend.
export const USE_EMULATOR = extra.useEmulator ?? false;

// Android emulators reach the host machine via 10.0.2.2, not localhost/127.0.0.1.
export const EMULATOR_HOST =
  Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

// ── Emulator ports (japa#361) ───────────────────────────────────────────────
// The firebase.json defaults. A build that does not set
// EXPO_PUBLIC_EMULATOR_AUTH_PORT / EXPO_PUBLIC_EMULATOR_FUNCTIONS_PORT keeps
// them, so every existing emulator set-up (`make mobile`, hand runs) is
// unchanged. The Maestro e2e runner sets both to the firebase.e2e.json ports.
export const DEFAULT_AUTH_EMULATOR_PORT = 9099;
export const DEFAULT_FUNCTIONS_EMULATOR_PORT = 5001;

/**
 * A baked emulator port, or `fallback` when it is unset or not a valid TCP
 * port (an integer 1–65535, digits only). Falling back rather than throwing
 * keeps a typo from crashing the app at import time; the App configuration
 * dev screen shows the URLs actually used.
 */
export function emulatorPort(
  raw: string | number | undefined | null,
  fallback: number,
): number {
  if (raw === undefined || raw === null) return fallback;
  const text = String(raw).trim();
  if (!/^\d{1,5}$/.test(text)) return fallback;
  const port = Number(text);
  return port >= 1 && port <= 65535 ? port : fallback;
}

export const AUTH_EMULATOR_PORT = emulatorPort(
  extra.emulatorAuthPort,
  DEFAULT_AUTH_EMULATOR_PORT,
);
export const FUNCTIONS_EMULATOR_PORT = emulatorPort(
  extra.emulatorFunctionsPort,
  DEFAULT_FUNCTIONS_EMULATOR_PORT,
);

// Firebase Auth emulator endpoint (used only when USE_EMULATOR is on).
export const AUTH_EMULATOR_URL = `http://${EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`;

// Project id the local emulator suite runs under (see app.config.ts). Deliberately
// NOT FIREBASE_PROJECT_ID: the backend emulators run in singleProjectMode as
// `japa-platform`, so a dev build (durin-seli-dev) using its own id here would hit
// `/durin-seli-dev/...` and 404 on every call. The Auth emulator mints tokens for
// this same id, so emulator auth + API stay consistent.
export const EMULATOR_PROJECT_ID = extra.emulatorProjectId ?? 'japa-platform';

// Base URL for the backend API. When emulating, point at the local Functions
// emulator under the EMULATOR's project id (it is part of the emulator URL path);
// otherwise use the deployed URL baked in by app.config.ts.
export const API_URL = USE_EMULATOR
  ? `http://${EMULATOR_HOST}:${FUNCTIONS_EMULATOR_PORT}/${EMULATOR_PROJECT_ID}/us-central1/api`
  : (extra.apiUrl ??
    'https://us-central1-durin-seli-dev.cloudfunctions.net/api');
