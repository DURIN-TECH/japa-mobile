import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import '../../global.css';

import { OnboardingProvider } from '@/context/OnboardingContext';
import { QueryProvider } from '@/providers/QueryProvider';
import { ThemeSync } from '@/providers/ThemeSync';
import { useSettingsStore, useSettingsHydration } from '@/stores/settings.store';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList {
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
  initialRouteName: 'index',
};

function RootLayoutContent() {
  const [loaded] = useFonts({
    // eslint-disable-next-line
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const hasHydrated = useSettingsHydration();
  const isDark = useSettingsStore((state) => state.isDark());

  useEffect(() => {
    if (loaded && hasHydrated) {
      SplashScreen.hideAsync();
    }
  }, [loaded, hasHydrated]);

  if (!loaded || !hasHydrated) {
    return null;
  }

  return (
    <OnboardingProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
