// ─────────────────────────────────────────────────────────────────────────────
// Storage + reload side of the development-only self-service-only override
// (japa#375). The pure rules and the in-memory value live in
// `selfServiceOverride.ts`; this file reads / writes AsyncStorage (the store
// the app already uses for persisted settings) and reloads the JS bundle.
//
// Flow:
//   1. Startup: the root layout waits for `loadSelfServiceOverride()` before
//      the first screen renders (`useSelfServiceOverrideLoaded`), so the
//      synchronous `isSelfServiceOnly()` already sees the override.
//   2. Change (dev menu or link): `applySelfServiceRequest()` writes storage,
//      updates the in-memory value, and — only when the EFFECTIVE value
//      changes — reloads the app (`DevSettings.reload()`), so every screen,
//      the route guard and notification routing start again on the new value
//      without having to re-render reactively.
//
// Every entry point returns early when `__DEV__` is false: production and
// TestFlight builds never read or write the key and never reload.
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoLinking from 'expo-linking';
import { useEffect, useState } from 'react';
import { DevSettings } from 'react-native';

import { SELF_SERVICE_ONLY } from '@/config/env';
import {
  getSelfServiceOverride,
  parseSelfServiceLink,
  parseStoredOverride,
  planSelfServiceChange,
  serializeOverride,
  setLoadedSelfServiceOverride,
  SELF_SERVICE_LINK_LANDING,
  SELF_SERVICE_OVERRIDE_KEY,
  type SelfServiceRequest,
} from '@/config/selfServiceOverride';
// `__DEV__` check, read at call time (one definition for all dev tools).
import { isDevBuild as isDev } from '@/config/isDevBuild';

// ── 1. Load once at startup ─────────────────────────────────────────────────
// Memoised: the root layout and a cold-start link may both ask for it, and
// they must see the same value. A failed read counts as "no override", and
// so does a read that has not settled after LOAD_TIMEOUT_MS: the root layout
// waits for this before rendering, so a stuck storage read must never leave
// a development build on the splash screen. A late answer is then ignored.
export const LOAD_TIMEOUT_MS = 1500;
let loading: Promise<void> | null = null;

export function loadSelfServiceOverride(): Promise<void> {
  if (!isDev()) return Promise.resolve(); // production: never touch storage
  if (!loading) {
    loading = new Promise<void>((resolve) => {
      let settled = false;
      const finish = (value: boolean | undefined) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        setLoadedSelfServiceOverride(value);
        resolve();
      };
      const timer = setTimeout(() => {
        console.warn(
          '[dev] self-service-only override read timed out; using the build value',
        );
        finish(undefined);
      }, LOAD_TIMEOUT_MS);
      AsyncStorage.getItem(SELF_SERVICE_OVERRIDE_KEY).then(
        (raw) => finish(parseStoredOverride(raw)),
        () => finish(undefined),
      );
    });
  }
  return loading;
}

/** Test helper: forget the memoised load. */
export function resetSelfServiceOverrideLoadForTests(): void {
  loading = null;
}

/**
 * True once the override is loaded (immediately outside development). The
 * root layout renders nothing until then, like its font / store hydration.
 */
export function useSelfServiceOverrideLoaded(): boolean {
  const [loaded, setLoaded] = useState(!isDev());
  useEffect(() => {
    if (loaded) return;
    let alive = true;
    loadSelfServiceOverride().finally(() => {
      if (alive) setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [loaded]);
  return loaded;
}

// ── 2. Change it ────────────────────────────────────────────────────────────

/** Reloads the JS bundle (dev client / Metro). No-op where unavailable. */
function reloadApp(): void {
  // DevSettings is a development facility; guarded for web / tests.
  DevSettings?.reload?.();
}

/**
 * Applies "on" | "off" | "build". Returns whether the app is reloading.
 * Does nothing (and returns false) outside development.
 */
export async function applySelfServiceRequest(
  request: SelfServiceRequest,
): Promise<boolean> {
  if (!isDev()) return false;
  // A cold-start link can arrive before the root layout's load finished.
  await loadSelfServiceOverride();

  const plan = planSelfServiceChange(
    request,
    SELF_SERVICE_ONLY,
    getSelfServiceOverride(),
  );
  if (plan.write) {
    const stored = serializeOverride(plan.nextOverride);
    if (stored === null) {
      await AsyncStorage.removeItem(SELF_SERVICE_OVERRIDE_KEY);
    } else {
      await AsyncStorage.setItem(SELF_SERVICE_OVERRIDE_KEY, stored);
    }
    setLoadedSelfServiceOverride(plan.nextOverride);
  }
  // Only a change of the effective value reloads: a link re-delivered after
  // the reload finds its value already applied, so there is no loop.
  if (plan.reload) reloadApp();
  return plan.reload;
}

// ── 3. The development-only link ────────────────────────────────────────────
//
// THE STALE-LINK PROBLEM (japa#375 review). The native side keeps the last
// link it received, and that memory survives a JS reload:
//   - iOS: expo-linking stores every opened URL (cold or warm) as its
//     "initial URL" (`ExpoLinkingRegistry.initialURL`), and expo-router's
//     iOS cold-start path reads exactly that (`Linking.getLinkingURL()`).
//   - Android: expo-router reads React Native's initial URL (the launching
//     intent), which stays the same across a JS reload. expo-linking keeps
//     its own copy too (`ExpoLinkingModule.initialURL`, set on onCreate /
//     onNewIntent, cleared only by `clearInitialURL()` or a new process).
// Without care, `value=on` → dev menu "off" → reload re-delivers `value=on`
// as the initial URL and flips it straight back (and every later Metro
// reload re-applies it).
//
// FIX: a dev link is applied exactly once.
//   1. On handling it, call `ExpoLinking.clearInitialURL()` (exists in
//      expo-linking 56: sets the native value to nil / null on both
//      platforms). On iOS the next reload then starts at the root URL and
//      the link never reaches us again.
//   2. On Android the RN initial URL is not cleared, so an `initial`
//      delivery is only trusted when expo-linking still holds a dev link
//      too. A genuinely new launch is a new process, whose expo-linking
//      value is set from the launching intent; a JS reload of the same
//      process finds it cleared by step 1, so the stale link is dropped
//      (lands on Home, changes nothing, no reload).
// Links opened while the app runs (`initial: false`) are real new events and
// are always applied, so opening the same or another value later still works
// deterministically, warm or cold.

/** Forgets the native copy of the last link (no-op where unavailable). */
function clearNativeLink(): void {
  try {
    ExpoLinking.clearInitialURL?.();
  } catch {
    // Older native module / web: nothing to clear.
  }
}

/** Whether expo-linking's native memory still holds a dev link. */
function nativeStillHoldsDevLink(): boolean {
  try {
    return parseSelfServiceLink(ExpoLinking.getLinkingURL()) !== null;
  } catch {
    return false;
  }
}

/**
 * Handler for `app/+native-intent.tsx` (`redirectSystemPath`), which
 * expo-router calls for the initial URL on a cold start (`initial: true`)
 * AND for every link while the app runs (`initial: false`).
 *
 * Returns the path to open:
 *   - any other link, or ANY link when `__DEV__` is false: the path
 *     unchanged, synchronously, so nothing about existing links changes (in
 *     production `/dev/self-service-only` stays an unknown route and does
 *     what an unknown link does today);
 *   - a stale dev link re-delivered after a reload: Home, nothing changes;
 *   - the dev link: a promise of Home, after the value is applied (an
 *     unknown `value=` changes nothing but still lands on Home).
 */
export function handleSelfServiceLink(
  path: string,
  initial = false,
): string | Promise<string> {
  const link = parseSelfServiceLink(path); // always null outside __DEV__
  if (!link) return path;

  // Re-delivered after a reload (see above): already applied once, drop it.
  if (initial && !nativeStillHoldsDevLink()) return SELF_SERVICE_LINK_LANDING;

  // Applied exactly once: forget it natively BEFORE anything can reload.
  clearNativeLink();

  if (!link.request) {
    console.warn(
      `[dev] ignored self-service-only link (value must be on, off or build): ${path}`,
    );
    return SELF_SERVICE_LINK_LANDING;
  }
  return applySelfServiceRequest(link.request)
    .catch((e) => {
      console.warn('[dev] self-service-only link failed', e);
      return false;
    })
    .then(() => SELF_SERVICE_LINK_LANDING);
}
