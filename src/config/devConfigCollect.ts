// ─────────────────────────────────────────────────────────────────────────────
// Live reads for the dev-only "App configuration" screen (japa#330).
// Gathers the values the running app is actually using; the pure formatting
// lives in devConfigInfo.ts. Every native read is guarded so a missing module
// shows "unavailable" instead of crashing the screen. Never reads secrets: the
// ID token is reduced to its role claim and expiry.
// ─────────────────────────────────────────────────────────────────────────────

import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
// Modular Firebase API. Imported statically but only CALLED inside
// collectDevConfigSources (never at module scope), so `expo export` in Node
// (see CLAUDE.md, CI) never touches a native Firebase app.
import { getApp } from '@react-native-firebase/app';
import { getAuth, getIdTokenResult } from '@react-native-firebase/auth';
import { NativeModules, Platform } from 'react-native';
import {
  APP_ENV,
  API_URL,
  FIREBASE_PROJECT_ID,
  USE_EMULATOR,
  EMULATOR_HOST,
  EMULATOR_PROJECT_ID,
  FEEDBACK_ENABLED,
  SELF_SERVICE_ONLY,
  isSelfServiceOnly,
} from '@/config/env';

import type { DevConfigSources } from '@/config/devConfigInfo';
import {
  getSelfServiceOverride,
  selfServiceOnlySource,
} from '@/config/selfServiceOverride';

// ── Live collection (native reads, each one guarded) ─────────────────────────
function safe<T>(read: () => T): T | undefined {
  try {
    return read();
  } catch {
    return undefined;
  }
}

export async function collectDevConfigSources(): Promise<DevConfigSources> {
  // expo-updates values: each read guarded so a build without the native
  // module still renders the rest of the screen.
  const updates = safe(() => ({
    isEnabled: Updates.isEnabled,
    channel: Updates.channel,
    runtimeVersion: Updates.runtimeVersion,
    updateId: Updates.updateId,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
  }));

  // Native Firebase app options: what the binary's google-services/plist
  // actually initialised, independent of what app.config.ts says.
  const firebaseOptions = safe(
    () => getApp().options as { projectId?: string; appId?: string },
  );

  // Where the JS came from: Metro's URL in a dev build, a file path when
  // embedded. Strip any query string (it carries platform/dev flags only).
  const scriptURL: string | undefined = safe(
    () => NativeModules.SourceCode?.scriptURL,
  );
  const bundleSource = scriptURL
    ? scriptURL.startsWith('http')
      ? scriptURL.split('?')[0]
      : 'embedded'
    : undefined;

  // Signed-in user + token claims. getIdTokenResult reads the cached token
  // (no forced refresh), so opening this screen doesn't change auth state.
  let user: DevConfigSources['user'] = null;
  try {
    const current = getAuth(getApp()).currentUser;
    if (current) {
      const token = await getIdTokenResult(current).catch(() => undefined);
      user = {
        uid: current.uid,
        email: current.email,
        emailVerified: current.emailVerified,
        role: (token?.claims?.role as string | undefined) ?? null,
        tokenExpiresAt: token?.expirationTime ?? null,
      };
    }
  } catch {
    user = null;
  }

  const platformBuild =
    Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode?.toString();

  return {
    appEnv: APP_ENV,
    apiUrl: API_URL,
    firebaseProjectId: FIREBASE_PROJECT_ID,
    nativeFirebaseProjectId: firebaseOptions?.projectId,
    nativeFirebaseAppId: firebaseOptions?.appId,
    useEmulator: USE_EMULATOR,
    emulatorHost: EMULATOR_HOST,
    emulatorProjectId: EMULATOR_PROJECT_ID,
    feedbackEnabled: FEEDBACK_ENABLED,
    // japa#375: effective flag via the single read point, plus its source.
    selfServiceOnly: isSelfServiceOnly(),
    selfServiceOnlySource: selfServiceOnlySource(getSelfServiceOverride()),
    selfServiceOnlyBuild: SELF_SERVICE_ONLY,
    appVersion: Constants.expoConfig?.version,
    buildNumber: platformBuild,
    bundleId:
      Platform.OS === 'ios'
        ? Constants.expoConfig?.ios?.bundleIdentifier
        : Constants.expoConfig?.android?.package,
    updatesEnabled: updates?.isEnabled,
    updateChannel: updates?.channel,
    runtimeVersion: updates?.runtimeVersion,
    updateId: updates?.updateId,
    isEmbeddedLaunch: updates?.isEmbeddedLaunch,
    bundleSource,
    isDevBuild: __DEV__,
    os: Platform.OS,
    osVersion: String(Platform.Version),
    deviceName: Constants.deviceName ?? undefined,
    user,
  };
}
