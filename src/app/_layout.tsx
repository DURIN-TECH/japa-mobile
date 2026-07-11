import { useFonts } from 'expo-font';
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
  initialRouteName: '(auth)',
};

// Hook to handle auth-based navigation
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

  const hasSeenIntro = useSettingsStore((state) => state.hasSeenIntro);

  // Handle navigation based on auth state
  useEffect(() => {
    if (!isInitialized) return;

    // The Destination Explorer (slated to become the main shell) drives its own
    // auth/onboarding navigation, so the global guard ignores it — a real sign-in
    // or sign-out inside (explorer) must not bounce the user to the old app.
    if (segments[0] === '(explorer)') return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardGroup = segments[0] === '(onboard)';
    const inIntro = segments[0] === 'intro';
    const isOnboarded = true; // TEMP: onboarding disabled for demo

    if (!isAuthenticated) {
      // First-run: show the introductory flow before login
      if (!hasSeenIntro) {
        if (!inIntro) {
          router.replace('/intro');
        }
        return;
      }
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else if (!isOnboarded) {
      if (!inOnboardGroup) {
        router.replace('/(onboard)');
      }
    } else {
      if (inAuthGroup || inOnboardGroup || inIntro) {
        router.replace('/(tabs)');
      }
    }
  }, [isAuthenticated, isInitialized, profile, segments, router, hasSeenIntro]);
}

function RootLayoutContent() {
  const [loaded] = useFonts({
    // eslint-disable-next-line
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
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
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="intro" options={{ animation: 'fade' }} />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboard)" />
        <Stack.Screen name="(tabs)" />
        {/* Destination Explorer — self-contained coral/cream showcase experience */}
        <Stack.Screen name="(explorer)" />
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
