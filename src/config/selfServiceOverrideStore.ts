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

/** `__DEV__` read at call time (tests flip `global.__DEV__`). */
const isDev = (): boolean => typeof __DEV__ !== 'undefined' && __DEV__ === true;

// ── 1. Load once at startup ─────────────────────────────────────────────────
// Memoised: the root layout and a cold-start link may both ask for it, and
// they must see the same value. A failed read counts as "no override".
let loading: Promise<void> | null = null;

export function loadSelfServiceOverride(): Promise<void> {
  if (!isDev()) return Promise.resolve(); // production: never touch storage
  if (!loading) {
    loading = AsyncStorage.getItem(SELF_SERVICE_OVERRIDE_KEY)
      .then((raw) => setLoadedSelfServiceOverride(parseStoredOverride(raw)))
      .catch(() => setLoadedSelfServiceOverride(undefined));
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

/**
 * Handler for `app/+native-intent.tsx` (`redirectSystemPath`), which
 * expo-router calls for the initial URL on a cold start AND for every link
 * while the app runs, so both cases go through the same code.
 *
 * Returns the path to open:
 *   - any other link, or ANY link when `__DEV__` is false: the path
 *     unchanged, synchronously, so nothing about existing links changes (in
 *     production `/dev/self-service-only` stays an unknown route and does
 *     what an unknown link does today);
 *   - the dev link: a promise of Home, after the value is applied (an
 *     unknown `value=` changes nothing but still lands on Home).
 */
export function handleSelfServiceLink(path: string): string | Promise<string> {
  const link = parseSelfServiceLink(path); // always null outside __DEV__
  if (!link) return path;
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
