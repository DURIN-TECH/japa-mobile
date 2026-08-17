// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Expo config — selects the Firebase project + backend by environment.
//
// The static base lives in app.json; this file extends it and overrides the pieces
// that differ per environment so DEV (durin-seli-dev) and PROD (japa-platform) never
// require manual file swaps:
//   • the native Firebase config file (firebase/<env>/…)
//   • the API base URL + project id (exposed to runtime via `extra`, read by
//     src/config/env.ts)
//
// APP_ENV is supplied by the EAS build profile (see eas.json: development/staging/
// production) or the shell for local runs. It defaults to `development` so a bare
// `expo start` talks to the DEV backend — matching how the team develops.
// ─────────────────────────────────────────────────────────────────────────────

import { ExpoConfig, ConfigContext } from 'expo/config';

type AppEnv = 'development' | 'staging' | 'production';

const APP_ENV = (process.env.APP_ENV as AppEnv) || 'development';
const IS_PROD = APP_ENV === 'production';

// Per-environment Firebase project + deployed API. PROD stays on the existing
// japa-platform project; every non-prod environment uses the isolated dev project.
const FIREBASE_PROJECT_ID = IS_PROD ? 'japa-platform' : 'durin-seli-dev';
const API_URL = IS_PROD
  ? 'https://us-central1-japa-platform.cloudfunctions.net/api'
  : 'https://us-central1-durin-seli-dev.cloudfunctions.net/api';

// Opt-in local emulator suite (functions + auth). Off by default so builds hit the
// DEPLOYED backend; set EXPO_PUBLIC_USE_EMULATOR=true to develop against
// `firebase emulators:start`. (Only surfaced to runtime here; the URL is derived in
// src/config/env.ts because the emulator host depends on the platform.)
const USE_EMULATOR = process.env.EXPO_PUBLIC_USE_EMULATOR === 'true';

// Native Firebase config files live under firebase/<env>/ so dev/prod never clobber
// each other. Expo prebuild copies the selected file into the native project.
const googleServicesDir = IS_PROD ? './firebase/prod' : './firebase/dev';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  // name/slug are required on ExpoConfig; carry them through from app.json.
  name: config.name ?? 'Seli',
  slug: config.slug ?? 'japa-mobile',
  ios: {
    ...config.ios,
    googleServicesFile: `${googleServicesDir}/GoogleService-Info.plist`,
  },
  android: {
    ...config.android,
    googleServicesFile: `${googleServicesDir}/google-services.json`,
  },
  extra: {
    ...config.extra,
    // Consumed by src/config/env.ts at runtime.
    appEnv: APP_ENV,
    firebaseProjectId: FIREBASE_PROJECT_ID,
    apiUrl: API_URL,
    useEmulator: USE_EMULATOR,
  },
});
