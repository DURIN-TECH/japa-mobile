import { useFonts } from 'expo-font';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { Stack, useRouter, useSegments } from 'expo-router';
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
import {
  useSettingsStore,
  useSettingsHydration,
} from '@/stores/settings.store';
import { useAuthStore, useAuthHydration } from '@/stores/auth.store';
import { authService } from '@/services/auth.service';
import { pushNotificationService } from '@/services/push-notification.service';
import { registerDevMenu } from '@/utils/dev-menu';

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
// Onboarding, the tabs, and all detail screens are left alone (those flows drive
// their own forward navigation).
function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const {
    isAuthenticated,
    profile,
    isInitialized,
    setUser,
    setInitialized,
    fetchProfile,
  } = useAuthStore();

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged(async (user) => {
      setUser(user);
      if (user) {
        await fetchProfile();
        // Initialize push notifications for returning authenticated users
        pushNotificationService.initialize().catch(() => {});
      }
      setInitialized(true);
    });

    return unsubscribe;
  }, [setUser, setInitialized, fetchProfile]);

  // Handle navigation based on auth state
  useEffect(() => {
    if (!isInitialized) return;

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
    }
  }, [isAuthenticated, isInitialized, profile, segments, router]);
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

  // Set up auth-based navigation
  useProtectedRoute();

  useEffect(() => {
    registerDevMenu();
  }, []);

  useEffect(() => {
    if (loaded && settingsHydrated && authHydrated && isInitialized) {
      SplashScreen.hideAsync();
    }
  }, [loaded, settingsHydrated, authHydrated, isInitialized]);

  if (!loaded || !settingsHydrated || !authHydrated) {
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
        <Stack.Screen
          name="subscription"
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
        {/* Account security / self-service (reached from Settings) */}
        <Stack.Screen name="verify-email" />
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
