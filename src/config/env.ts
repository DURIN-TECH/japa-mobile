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

type AppEnv = 'development' | 'staging' | 'production';

// Values injected by app.config.ts → expo `extra`. Typed + defaulted defensively so
// a misconfigured build fails safe onto the dev project rather than crashing.
const extra = (Constants.expoConfig?.extra ?? {}) as {
  appEnv?: AppEnv;
  firebaseProjectId?: string;
  apiUrl?: string;
  useEmulator?: boolean;
};

export const APP_ENV: AppEnv = extra.appEnv ?? 'development';
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

// Firebase Auth emulator endpoint (used only when USE_EMULATOR is on).
export const AUTH_EMULATOR_URL = `http://${EMULATOR_HOST}:9099`;

// Base URL for the backend API. When emulating, point at the local Functions
// emulator for THIS project id (the project id is part of the emulator URL path);
// otherwise use the deployed URL baked in by app.config.ts.
export const API_URL = USE_EMULATOR
  ? `http://${EMULATOR_HOST}:5001/${FIREBASE_PROJECT_ID}/us-central1/api`
  : (extra.apiUrl ??
    'https://us-central1-durin-seli-dev.cloudfunctions.net/api');
