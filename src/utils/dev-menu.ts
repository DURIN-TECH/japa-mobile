import { Alert } from 'react-native';
import { registerDevMenuItems } from 'expo-dev-menu';
import { router } from 'expo-router';

import { useSettingsStore } from '@/stores/settings.store';
// Self-service-only flag + its dev-only override (japa#375).
import { isSelfServiceOnly } from '@/config/env';
import {
  getSelfServiceOverride,
  selfServiceOnlySource,
} from '@/config/selfServiceOverride';
import { applySelfServiceRequest } from '@/config/selfServiceOverrideStore';

/**
 * Dev menu label for the self-service-only flag, e.g.
 * "Self-service only: ON (override) - turn off". The menu is registered after
 * the override is loaded and again after every reload, so it is current.
 */
export function selfServiceMenuLabel(
  effective: boolean,
  source: 'build' | 'override',
): string {
  return `Self-service only: ${effective ? 'ON' : 'OFF'} (${source}) - turn ${
    effective ? 'off' : 'on'
  }`;
}

// Registers custom items in the Expo dev client menu (cmd+D on iOS sim,
// cmd+M on Android emulator, or shake on device). Dev-only — guarded by __DEV__.
export function registerDevMenu() {
  if (!__DEV__) return;

  // ── Self-service-only flag (japa#375) ────────────────────────────────────
  // Read through the single read point, then shown with its source.
  const effective = isSelfServiceOnly();
  const source = selfServiceOnlySource(getSelfServiceOverride());

  registerDevMenuItems([
    {
      // Flips the EFFECTIVE value and stores it as an override; the app
      // reloads so every screen, the route guard and notification routing
      // pick it up. Dev menu only, never the app's Settings.
      name: selfServiceMenuLabel(effective, source),
      shouldCollapse: true,
      callback: () => {
        void applySelfServiceRequest(effective ? 'off' : 'on');
      },
    },
    {
      // Clears the override: back to the value baked into the build. Reloads
      // only when that changes the effective value.
      name: "Self-service only: use the build's value",
      shouldCollapse: true,
      callback: () => {
        void applySelfServiceRequest('build');
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
