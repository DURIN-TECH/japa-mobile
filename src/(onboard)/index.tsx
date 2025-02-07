import { Link, RelativePathString } from 'expo-router';
import { useState } from 'react';
import { View, Text } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { useOnboarding } from '@/context/OnboardingContext';

export default function Onboard() {
  const [user] = useState('User');
  const { onboardingData, updateOnboardingData } = useOnboarding();

  const hasPassport = (hasPassport: boolean): void => {
    if (!hasPassport) {
      console.error('No passport status specified');
      return;
    }
    if (updateOnboardingData) {
      updateOnboardingData({
        hasPassport,
      });
    }
    console.log(onboardingData);
  };

  return (
    <View className="m-2">
      <Text className="my-4 px-3 text-lg font-bold">
        Welcome {user}, Let's get you onboarded
      </Text>
      <ThemedView>
        <Text className="text-md mb-3 font-semibold">
          Do you have a passport
        </Text>

        <ThemedView className="flex-row gap-5">
          <Link
            href={{
              pathname: '/(onboard)/country' as RelativePathString,
            }}
            onPress={() => hasPassport(true)}
          >
            <Text>Yes</Text>
          </Link>

          {/* To passport acquisition page */}
          <Link
            href={{
              pathname: '/passport' as RelativePathString,
            }}
            onPress={() => hasPassport(true)}
          >
            <Text>No</Text>
          </Link>
        </ThemedView>
      </ThemedView>
    </View>
  );
}
