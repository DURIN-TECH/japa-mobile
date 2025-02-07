import { useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import StorageKeys from '@/constants/Storage';

export default function useProtectedRoute() {
  const segments = useSegments();
  const route = useRouter();
  const [isOnboarded, setIsOnboarded] = useState(false);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const onboardStatus = await AsyncStorage.getItem(
          StorageKeys.ONBOARDING_STATUS_KEY,
        );
        console.log('Onboarding status', onboardStatus);
        setIsOnboarded(!!onboardStatus === true);
      } catch (error) {
        console.error('Error checking onboarding status', error);
      }
    };

    checkOnboardingStatus();
  }, []);

  useEffect(() => {
    const inOnboarding = segments[0] === '(onboard)';

    if (!isOnboarded && !inOnboarding) {
      // Redirect to onboarding if not completed
      route.replace('/(onboard)');
    } else if (isOnboarded && inOnboarding) {
      // Redirect to tabs if onboarding is completed
      route.replace('/(tabs)');
    }
  }, [segments, isOnboarded]);
}
