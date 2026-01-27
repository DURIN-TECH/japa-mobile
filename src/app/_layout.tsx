import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import '../../global.css';

import { OnboardingProvider } from '@/context/OnboardingContext';
import { QueryProvider } from '@/providers/QueryProvider';
import { ThemeSync } from '@/providers/ThemeSync';
import { useSettingsStore, useSettingsHydration } from '@/stores/settings.store';
import { useAuthStore, useAuthHydration } from '@/stores/auth.store';
import { authService } from '@/services/auth.service';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList {
      '/(auth)/login': undefined;
      '/(auth)/register': undefined;
      '/(auth)/verify-otp': undefined;
      '/(auth)/forgot-password': undefined;
      '/(onboard)': undefined;
      '/(tabs)': undefined;
      '/apply/agents/[id]': { id: string };
      '/apply/agents/[id]/book-consultation': { agentId: string };
      '/apply/agents/[id]/payment': {
        id: string;
        type: 'consultation' | 'visa';
        date: string;
        time: string;
      };
      '/apply/agents/[id]/confirmation': {
        id: string;
        type: 'consultation' | 'visa';
        date: string;
        time: string;
        paymentMethod: string;
      };
      '/apply/agents/[id]/visa-service/[type]': { id: string; type: string };
      '/applications/[id]': { id: string };
      '/consultations/[id]': { id: string };
      '/apply/visa-details/[id]': { id: string };
      '/apply/self-service/[id]': { id: string };
    }
  }
}

export const unstable_settings = {
  initialRouteName: '(auth)',
};

// Hook to handle auth-based navigation
function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const { isAuthenticated, profile, isInitialized, setUser, setInitialized, fetchProfile } = useAuthStore();

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged(async (user) => {
      setUser(user);
      if (user) {
        await fetchProfile();
      }
      setInitialized(true);
    });

    return unsubscribe;
  }, [setUser, setInitialized, fetchProfile]);

  // Handle navigation based on auth state
  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardGroup = segments[0] === '(onboard)';
    const isOnboarded = profile?.onboardingCompleted ?? false;

    if (!isAuthenticated) {
      // Not authenticated - redirect to login
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else if (!isOnboarded) {
      // Authenticated but not onboarded - redirect to onboarding
      if (!inOnboardGroup) {
        router.replace('/(onboard)');
      }
    } else {
      // Authenticated and onboarded - redirect to main app
      if (inAuthGroup || inOnboardGroup) {
        router.replace('/(tabs)');
      }
    }
  }, [isAuthenticated, isInitialized, profile, segments, router]);
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
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboard)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </OnboardingProvider>
  );
}

export default function RootLayout() {
  return (
    <QueryProvider>
      <ThemeSync>
        <RootLayoutContent />
      </ThemeSync>
    </QueryProvider>
  );
}
