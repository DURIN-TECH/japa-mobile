// ─────────────────────────────────────────────────────────────────────────────
// Root entry (`/`)
//
// After the Explorer became the only shell there is no top-level index route, so
// a cold start / reload at `/` would fall through to +not-found. This screen is
// that entry point: it holds the splash until Firebase auth resolves, then
// redirects into the Explorer — the app for signed-in users, the welcome flow
// otherwise. The auth guard in _layout keeps things in sync after this.
// ─────────────────────────────────────────────────────────────────────────────

import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/auth.store';

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  // Keep the native splash up until we know whether the user is signed in
  // (the root layout only hides the splash once isInitialized is true).
  if (!isInitialized) return null;

  return (
    <Redirect href={isAuthenticated ? '/(tabs)/home' : '/(auth)/welcome'} />
  );
}
