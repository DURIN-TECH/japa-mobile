import { useFonts } from 'expo-font';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  Stack,
  useNavigationContainerRef,
  useRouter,
  useSegments,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import '../../global.css';

import { OnboardingProvider } from '@/context/OnboardingContext';
import { QueryProvider } from '@/providers/QueryProvider';
import { ThemeSync } from '@/providers/ThemeSync';
// ErrorBoundary catches rendering errors in any descendant component
// and shows a fallback UI instead of a white screen crash.
// Must wrap the entire app tree to be effective.
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { EX } from '@/components/explorer/theme';
// Floating feedback button + sheet (issue #257), mounted once for the whole app.
import { FeedbackHost } from '@/components/feedback/FeedbackHost';
import {
  useSettingsStore,
  useSettingsHydration,
} from '@/stores/settings.store';
import { useAuthStore, useAuthHydration } from '@/stores/auth.store';
import { authService } from '@/services/auth.service';
import { pushNotificationService } from '@/services/push-notification.service';
import { registerDevMenu } from '@/utils/dev-menu';
// Self-service-only launch flag + its hidden-route table (japa#334).
import { isSelfServiceOnly } from '@/config/env';
import {
  isHiddenInSelfServiceOnly,
  SELF_SERVICE_REDIRECT,
  selfServiceRedirectState,
  type NavStateLike,
} from '@/config/selfServiceRoutes';
// Dev-only override of that flag (japa#375): loaded before the first screen.
import { useSelfServiceOverrideLoaded } from '@/config/selfServiceOverrideStore';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  // `/` resolves to the index redirect, which sends users into the app shell.
  initialRouteName: 'index',
};

// Hook to handle auth-based navigation.
//
// The Explorer is the whole app now, so its screens live directly under app/.
// The guard keeps users on the right side of the auth boundary:
//   - signed out                       → /(auth)/welcome
//   - signed in, but on auth / stranded → /(tabs)/home
//   - signed in, self-service-only build, on a hidden route → /(tabs)/home
//     (japa#334; the table lives in config/selfServiceRoutes.ts)
// Onboarding, the tabs, and all detail screens are left alone (those flows drive
// their own forward navigation).
//
// `flagReady` (japa#375): false until the dev-only self-service-only override
// has been read from storage (always true outside development). The redirect
// effect waits for it so the hidden-route check never runs on the baked
// value in a development build that overrides it.
function useProtectedRoute(flagReady: boolean) {
  const segments = useSegments();
  const router = useRouter();
  // Root navigation container: the self-service-only redirect (japa#334)
  // resets its state instead of pushing a new tab shell.
  const navigationRef = useNavigationContainerRef();
  const {
    isAuthenticated,
    profile,
    isInitialized,
    syncAuthUser,
    setInitialized,
    fetchProfile,
  } = useAuthStore();

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged(async (user) => {
      // #263: syncAuthUser (not a bare setUser) also tears the previous user's
      // session down — push token, React Query cache, per-user stores and
      // device keys — when the session ended on its own (user → null) or the
      // account changed (uid A → uid B). It resolves after that teardown, so
      // the profile fetch and push registration below are for the NEW user.
      await syncAuthUser(user);
      if (user) {
        await fetchProfile();
        // Initialize push notifications for returning authenticated users
        pushNotificationService.initialize().catch(() => {});
      }
      setInitialized(true);
    });

    return unsubscribe;
  }, [syncAuthUser, setInitialized, fetchProfile]);

  // Handle navigation based on auth state
  useEffect(() => {
    if (!isInitialized || !flagReady) return;

    // Top-level segment names the route group: '(auth)' | '(onboard)' | '(tabs)'
    // | a detail screen. undefined = the '/' index redirect; '+not-found' = a
    // dead route — both count as "stranded" outside the app shell.
    const first = segments[0];
    const inAuthGroup = first === '(auth)';
    const stranded = first === undefined || first === '+not-found';

    if (!isAuthenticated) {
      // Signed out anywhere but the auth flow → back to the welcome carousel.
      if (!inAuthGroup) {
        router.replace('/(auth)/welcome');
      }
    } else if (inAuthGroup || stranded) {
      // Signed in but on a login screen or stranded → into the app home.
      router.replace('/(tabs)/home');
    } else if (isHiddenInSelfServiceOnly(segments, isSelfServiceOnly())) {
      // ── Self-service-only build (japa#334) ──────────────────────────────
      // A hidden screen (agents, agencies, booking, messaging, agent
      // payments: see config/selfServiceRoutes.ts) was opened by a deep
      // link, a notification or a stray push → Home. Signed-out users never
      // get here: the branch above already sent them to welcome. With the
      // flag off this branch never matches.
      //
      // Warm app (QA round 1): cut the stack back to the EXISTING tab shell
      // and switch it to Home, so there is one shell, the hidden screen is
      // gone and Back does not step into an older shell. Cold start (no
      // shell under the hidden screen yet): `replace`, which ends on Home
      // with one shell.
      const current = navigationRef.isReady()
        ? (navigationRef.getRootState() as unknown as NavStateLike)
        : null;
      const next = selfServiceRedirectState(current);
      if (next) {
        navigationRef.resetRoot(next as never);
      } else {
        router.replace(SELF_SERVICE_REDIRECT);
      }
    }
  }, [
    isAuthenticated,
    isInitialized,
    flagReady,
    profile,
    segments,
    router,
    navigationRef,
  ]);
}

function RootLayoutContent() {
  const [loaded] = useFonts({
    // eslint-disable-next-line
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    // Space Grotesk — the Explorer display face used across headings.
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  const settingsHydrated = useSettingsHydration();
  const authHydrated = useAuthHydration();
  const isDark = useSettingsStore((state) => state.isDark());
  const isInitialized = useAuthStore((state) => state.isInitialized);
  // japa#375: the dev-only self-service-only override is read from storage
  // once, before the first screen renders, so the synchronous
  // `isSelfServiceOnly()` already returns it. Immediately true when
  // `__DEV__` is false (production never reads the override).
  const flagReady = useSelfServiceOverrideLoaded();

  // Set up auth-based navigation
  useProtectedRoute(flagReady);

  // Registered once the override is known (japa#375), so a menu tap can never
  // act on the baked value before the stored override was read.
  useEffect(() => {
    if (flagReady) registerDevMenu();
  }, [flagReady]);

  useEffect(() => {
    if (
      loaded &&
      settingsHydrated &&
      authHydrated &&
      isInitialized &&
      flagReady
    ) {
      SplashScreen.hideAsync();
    }
  }, [loaded, settingsHydrated, authHydrated, isInitialized, flagReady]);

  if (!loaded || !settingsHydrated || !authHydrated || !flagReady) {
    return null;
  }

  return (
    <OnboardingProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: EX.color.bg },
          // iOS-style horizontal push for all detail screens.
          animation: 'slide_from_right',
        }}
      >
        {/* Entry point at `/` — redirects into the app once auth resolves */}
        <Stack.Screen name="index" />
        {/* Shell: auth + onboarding entry flows, then the 5-tab home */}
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboard)" />
        <Stack.Screen name="(tabs)" />
        {/* Pushed detail / flow screens */}
        <Stack.Screen name="destination/[id]" />
        <Stack.Screen name="application/[id]" />
        <Stack.Screen name="agent/[id]" />
        <Stack.Screen name="agency/[id]" />
        <Stack.Screen name="eligibility/index" />
        <Stack.Screen name="eligibility/result" />
        <Stack.Screen name="messages/index" />
        <Stack.Screen name="messages/[id]" />
        <Stack.Screen name="consultations" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="self-service/[id]" />
        {/* Intake questions (#113): pushes from the right like the other forms */}
        <Stack.Screen name="self-service/[id]/intake" />
        {/* Review flow (issue #43): both push from the right. */}
        <Stack.Screen name="self-service/[id]/statement" />
        <Stack.Screen name="self-service/[id]/review" />
        {/* Ask-about-your-review chat (#45) and refusal-letter reading (#122). The
            static `refusal-letter` route wins over `self-service/[id]`. */}
        <Stack.Screen name="ai-chat/[id]" />
        <Stack.Screen name="self-service/refusal-letter" />
        <Stack.Screen
          name="subscription"
          options={{ animation: 'slide_from_bottom' }}
        />
        {/* Which country will you apply through? (#237): slides up like a sheet */}
        <Stack.Screen
          name="apply-through/[visaId]"
          options={{ animation: 'slide_from_bottom' }}
        />
        {/* Consultation booking flow + detail + settings */}
        <Stack.Screen name="book/[agentId]" />
        <Stack.Screen name="pay" />
        <Stack.Screen
          name="confirmation"
          options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
        />
        <Stack.Screen name="consultation/[id]" />
        <Stack.Screen name="settings" />
        {/* What you already hold (#234): the screen pushes from the right; the
            country picker and add-document sheet slide up. */}
        <Stack.Screen name="holdings" />
        <Stack.Screen
          name="holdings/pick-country"
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="holdings/add-document"
          options={{ animation: 'slide_from_bottom' }}
        />
        {/* Account security / self-service (reached from Settings) */}
        <Stack.Screen name="verify-email" />
        <Stack.Screen name="ai-message-access" />
        <Stack.Screen name="change-password" />
        <Stack.Screen name="change-email" />
        <Stack.Screen name="delete-account" />
        {/* Profile secondary destinations + full visa breakdown */}
        <Stack.Screen name="documents" />
        <Stack.Screen name="verify-identity" />
        <Stack.Screen name="payments" />
        <Stack.Screen name="saved" />
        <Stack.Screen name="visa/[id]" />
        <Stack.Screen name="+not-found" />
      </Stack>
      {/* Feedback button + sheet. Renders nothing when signed out, on auth /
          onboarding / not-found screens, when hidden in Settings, or when the
          build sets EXPO_PUBLIC_FEEDBACK_ENABLED=false. */}
      <FeedbackHost />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </OnboardingProvider>
  );
}

/**
 * Root layout wraps the entire app in:
 * 1. ErrorBoundary — catches rendering crashes and shows a retry screen
 * 2. QueryProvider — React Query context for all API hooks
 * 3. ThemeSync — syncs system theme changes to the settings store
 */
export default function RootLayout() {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <ThemeSync>
          <RootLayoutContent />
        </ThemeSync>
      </QueryProvider>
    </ErrorBoundary>
  );
}
