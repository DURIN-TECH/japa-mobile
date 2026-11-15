// ─────────────────────────────────────────────────────────────────────────────
// Incoming-link hook (expo-router `+native-intent`), added for japa#375.
//
// expo-router calls `redirectSystemPath` for the app's initial URL on a cold
// start (`initial: true`) and for every link that arrives while it runs
// (`initial: false`), before it resolves the link to a route. This file is
// NOT a route (expo-router ignores `+native-intent` when building routes).
//
// Its only job today is the DEVELOPMENT-ONLY link
// `durintech://dev/self-service-only?value=on|off|build`, which sets the
// self-service-only override and lands on Home (see
// `config/selfServiceOverrideStore.ts`). Every other link, and this one when
// `__DEV__` is false, is returned unchanged, so existing links behave
// exactly as before.
// ─────────────────────────────────────────────────────────────────────────────

import { handleSelfServiceLink } from '@/config/selfServiceOverrideStore';

export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}): string | Promise<string> {
  // expo-router warns that a throw here can crash the app: fall back to the
  // link as it came in.
  try {
    // `initial` lets the handler drop a dev link the native side re-delivers
    // after a reload (it has already been applied once).
    return handleSelfServiceLink(path, initial);
  } catch {
    return path;
  }
}
