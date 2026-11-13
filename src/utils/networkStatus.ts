// ─────────────────────────────────────────────────────────────────────────────
// Offline signal without NetInfo (issue #172, design spec "Offline on mobile").
//
// The app has no NetInfo dependency and the issue allows existing libraries
// only. So "offline" is: React Query's `onlineManager` says so, OR the last API
// call failed with the API client's `NETWORK_ERROR` and nothing has succeeded
// since. (React Query's own online state is driven by browser events, which do
// not fire in React Native, so the second signal is the one that does the work.)
// ─────────────────────────────────────────────────────────────────────────────

import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';

/** True for the error the API client rejects with when no response arrived. */
export function isNetworkError(e: unknown): boolean {
  return (
    !!e &&
    typeof e === 'object' &&
    (e as { code?: unknown }).code === 'NETWORK_ERROR'
  );
}

// Module-level flag: the last call's outcome, shared by every hook.
let lastCallFailedOffline = false;
const listeners = new Set<() => void>();

function set(v: boolean) {
  if (v === lastCallFailedOffline) return;
  lastCallFailedOffline = v;
  listeners.forEach((l) => l());
}

/** Call with every API outcome: a network error sets the flag, a success clears it. */
export function reportApiResult(error?: unknown) {
  if (error === undefined) set(false);
  else if (isNetworkError(error)) set(true);
  // Other errors (4xx/5xx) mean the server answered, so we are online: leave as is.
  else set(false);
}

/** Current value of the "last call failed offline" flag (also used by tests). */
export function lastCallFailedOfflineNow(): boolean {
  return lastCallFailedOffline;
}

/** Wraps an API call so its outcome feeds the offline signal. */
export async function tracked<T>(call: () => Promise<T>): Promise<T> {
  try {
    const out = await call();
    reportApiResult();
    return out;
  } catch (e) {
    reportApiResult(e);
    throw e;
  }
}

/** Pure combination, kept separate so it can be tested. */
export function combineOffline(queryOnline: boolean, lastFailed: boolean) {
  return !queryOnline || lastFailed;
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  const off = onlineManager.subscribe(cb);
  return () => {
    listeners.delete(cb);
    off();
  };
};

/** True while the app should treat itself as offline. */
export function useIsOffline(): boolean {
  return useSyncExternalStore(subscribe, () =>
    combineOffline(onlineManager.isOnline(), lastCallFailedOffline),
  );
}
