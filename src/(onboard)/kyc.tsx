import { useState } from 'react';
import { View, TextInput, Button } from 'react-native';
import { router } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useOnboarding } from '@/context/OnboardingContext';
import { setOnboardingStatus } from '@/utils/storage.service';

export default function KYC() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [country, setCountry] = useState('');
  const [email, setEmail] = useState('');
  const { onboardingData, updateOnboardingData } = useOnboarding();

  const setKYCValue = (KYCKey: string, KYCValue: string): void => {
    if (!KYCValue) {
      console.error('No KYCValue provided to selectKYCValue');
      return;
    }

    if (KYCKey === 'firstName') {
      setFirstName(KYCValue);
      console.log(KYCKey, KYCValue);
    }

    if (KYCKey === 'lastName') {
      setLastName(KYCValue);
      console.log(KYCKey, KYCValue);
    }

    if (KYCKey === 'country') {
      setCountry(KYCValue);
      console.log(KYCKey, KYCValue);
    }

    if (KYCKey === 'email') {
      setEmail(KYCValue);
      console.log(KYCKey, KYCValue);
    }
  };

  const updateOnboardingStatusStorage = async (
    timestamp: Date,
  ): Promise<void> => {
    await setOnboardingStatus(JSON.stringify(timestamp));
  };

  const handleSubmit = () => {
    if (!updateOnboardingData) return;

    updateOnboardingData({
      firstName,
      lastName,
      email,
      residentialCountry: country,
      completedOnboarding: false,
    });
    console.log(onboardingData);
    updateOnboardingStatusStorage(new Date(Date.now()));
    router.navigate('/(tabs)');
  };

  return (
    <View>
      <ThemedText className="my-4 px-3 text-lg font-bold">
        Let's get to know you
      </ThemedText>

      <ThemedView>
        <View className="my-5">
          <TextInput
            placeholder="First Name"
            placeholderTextColor="grey"
            autoComplete="given-name"
            autoFocus={true}
            className="border border-x-0 border-t-0 border-gray-200 py-2 pl-3 pr-3 text-gray-400"
            value={firstName}
            onChangeText={(val) => setKYCValue('firstName', val)}
          />
        </View>

        <View className="my-5">
          <TextInput
            placeholder="Last Name"
            placeholderTextColor="grey"
            autoComplete="family-name"
            className="border border-x-0 border-t-0 border-gray-200 py-2 pl-3 pr-3 text-gray-400"
            value={lastName}
            onChangeText={(val) => setKYCValue('lastName', val)}
          />
        </View>

        <View className="my-5">
          <TextInput
            placeholder="Email Address"
            placeholderTextColor="grey"
            autoComplete="email"
            className="border border-x-0 border-t-0 border-gray-200 py-2 pl-3 pr-3 text-gray-400"
            value={email}
            keyboardType="email-address"
            onChangeText={(val) => setKYCValue('email', val)}
          />
        </View>

        <View className="my-5">
          <TextInput
            placeholder="Resident Country"
            placeholderTextColor="grey"
            autoComplete="country"
            className="border border-x-0 border-t-0 border-gray-200 py-2 pl-3 pr-3 text-gray-400"
            value={country}
            onChangeText={(val) => setKYCValue('country', val)}
          />
        </View>

        <View>
          <Button title="Submit" onPress={handleSubmit} />
        </View>
      </ThemedView>
    </View>
  );
}
