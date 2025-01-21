import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import "../global.css";

import { useColorScheme } from '@/hooks/useColorScheme';
import { OnboardingProvider } from '@/context/OnboardingContext';
import useProtectedRoute from '@/hooks/useProtectedRoute';
import { getOnboardingStatus } from '@/utils/storage.service';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

declare global {
  namespace ReactNavigation {
    interface RootParamList {
      "/agents/[id]": { id: string };
      "/agents/[id]/book-consultation": { agentId: string };
      "/agents/[id]/payment": { 
        id: string;
        type: "consultation" | "visa";
        date: string;
        time: string;
      };
      "/agents/[id]/confirmation": {
        id: string;
        type: "consultation" | "visa";
        date: string;
        time: string;
        paymentMethod: string;
      };
      "/agents/[id]/visa-service/[type]": { id: string; type: string };
    }
  }
}

export const unstable_settings = {
  initialRouteName: 'index',
}

export default function RootLayout() {
  // useProtectedRoute();
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <OnboardingProvider>
        <Stack>
          <Stack.Screen
            name="(tabs)"
            options={{ headerShown: false }} />
          (!!getOnboardingStatus() && <Stack.Screen name="(onboard)" options={{ headerShown: false }} />)
          <Stack.Screen
            name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </OnboardingProvider>
    </ThemeProvider>
  );
}
