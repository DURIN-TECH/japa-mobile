import { Alert } from 'react-native';
import { registerDevMenuItems } from 'expo-dev-menu';
import { router } from 'expo-router';

import { useSettingsStore } from '@/stores/settings.store';
// Self-service-only flag + its dev-only override (japa#375).
import { isSelfServiceOnly } from '@/config/env';
import { applySelfServiceRequest } from '@/config/selfServiceOverrideStore';
import { isDevBuild } from '@/config/isDevBuild';

/**
 * Runs a self-service-only change from a dev menu tap (japa#375). The menu
 * ignores what a callback returns, so any failure — a rejected promise or a
 * synchronous throw (e.g. from storage) — is caught and logged here instead
 * of surfacing as an unhandled rejection.
 */
export function runSelfServiceRequest(request: () => Promise<unknown>): void {
  try {
    request().catch((e) => {
      console.warn('[dev] self-service-only change failed', e);
    });
  } catch (e) {
    console.warn('[dev] self-service-only change failed', e);
  }
}

// Registers custom items in the Expo dev client menu (cmd+D on iOS sim,
// cmd+M on Android emulator, or shake on device). Dev-only — guarded by __DEV__.
export function registerDevMenu() {
  if (!isDevBuild()) return;

  registerDevMenuItems([
    // ── Self-service-only flag (japa#375) ──────────────────────────────────
    // Labels are deliberately state-free: they are set once at registration
    // and an action that does not reload (e.g. clearing an override equal to
    // the build's value) would leave a stateful label lying. The current
    // value and its source are on the App configuration screen below.
    {
      // Flips the EFFECTIVE value, read when tapped, and stores it as an
      // override; the app reloads so every screen, the route guard and
      // notification routing pick it up. Dev menu only, never Settings.
      name: 'Self-service only: toggle on/off',
      shouldCollapse: true,
      callback: () => {
        runSelfServiceRequest(() =>
          applySelfServiceRequest(isSelfServiceOnly() ? 'off' : 'on'),
        );
      },
    },
    {
      // Clears the override: back to the value baked into the build. Reloads
      // only when that changes the effective value.
      name: "Self-service only: use the build's value",
      shouldCollapse: true,
      callback: () => {
        runSelfServiceRequest(() => applySelfServiceRequest('build'));
      },
    },
    {
      // japa#330: what this running app is actually configured with
      // (environment, API server, Firebase project, build/update, signed-in
      // user's role claim + token expiry). Lives here, in the dev menu, not
      // in the app's Settings — it is a developer tool, not a user feature.
      name: 'App configuration',
      shouldCollapse: true,
      callback: () => {
        router.push('/dev-config');
      },
    },
    {
      name: 'Reset settings store',
      shouldCollapse: true,
      callback: () => {
        useSettingsStore.persist.clearStorage();
        useSettingsStore.setState({
          themePreference: 'system',
          notificationsEnabled: true,
          language: 'en',
          hasSeenIntro: false,
        });
        console.log('Settings store reset to defaults');
        Alert.alert('Settings cleared', 'Persisted settings have been reset.');
      },
    },
    {
      name: 'Go to Explorer welcome',
      shouldCollapse: true,
      callback: () => {
        router.replace('/(auth)/welcome');
      },
    },
  ]);
}
