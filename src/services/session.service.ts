// ─────────────────────────────────────────────────────────────────────────────
// Per-user session data teardown (issue #263).
//
// When one account signs out (or the signed-in account changes), the next
// person on this phone must never see the previous user's data. This module is
// the ONE place that knows every per-user cache outside the auth store:
//
//   • React Query cache (`queryClient`): notifications, applications,
//     consultations, conversations, documents, checklist, authorization, ...
//     In-flight queries are cancelled FIRST, so a response for the old user
//     cannot land in the cache after it was cleared.
//   • `useOnboardingStore`: the name / country / passport answers typed during
//     onboarding (personal details).
//   • Device storage (AsyncStorage):
//       - `refusal-analysis:<applicationId>` (useRefusalLetter): the id of an
//         analysis of the user's own refusal letter → per-user, removed.
//       - the onboarding status key `@jposk` (utils/storage.service.ts): no
//         code writes or reads it today; its only possible meaning is "did THE
//         SIGNED-IN USER finish onboarding" (per-user; the real flag is
//         `profile.onboardingCompleted` on the server), so it is removed too.
//         Device-wide settings (theme, language, notifications toggle,
//         first-run intro) live in `useSettingsStore` and are KEPT.
//
// NOT handled here (on purpose):
//   • Auth store fields (`user`, `profile`, ...) — reset by auth.store.ts
//     itself, which calls this helper (keeps the import one-directional:
//     auth.store → session.service, no cycle).
//   • Unsaved answer drafts + encrypted vault (#187) — cleared by the
//     auth.store subscription on every sign-out / account change.
//   • Push token — auth.store calls pushNotificationService.unregisterToken()
//     itself, because WHEN it runs matters (before the Firebase session ends).
//
// Every step is best-effort and isolated: one failing never skips the others,
// and this never throws (sign-out must always complete).
// ─────────────────────────────────────────────────────────────────────────────

import { queryClient } from '@/providers/QueryProvider';
import { useOnboardingStore } from '@/stores/onboarding.store';
import { clearStoredAnalysisIds } from '@/hooks/useRefusalLetter';
import { removeOnboardingStatus } from '@/utils/storage.service';

/**
 * Empty every per-user cache outside the auth store. Safe to call more than
 * once (each step is a no-op on an already-empty cache).
 */
export async function clearUserSession(): Promise<void> {
  // ── 1. React Query: cancel in-flight requests, THEN drop everything ───────
  // cancelQueries() aborts running fetches and reverts their queries to the
  // previous state; without it a fetch started for user A could resolve after
  // clear() and write A's data back into the (now B's) cache.
  try {
    await queryClient.cancelQueries();
  } catch {
    // Cancellation failures are not fatal: clear() below still runs.
  }
  // clear() removes every query AND mutation from the caches (not just marks
  // them stale), so no screen can render A's data, even for one frame.
  queryClient.clear();

  // ── 2. Zustand stores holding per-user state ──────────────────────────────
  useOnboardingStore.getState().reset();

  // ── 3. Device storage keys holding per-user state ─────────────────────────
  await Promise.all([
    clearStoredAnalysisIds(), // swallows its own errors
    removeOnboardingStatus().catch(() => undefined),
  ]);
}
