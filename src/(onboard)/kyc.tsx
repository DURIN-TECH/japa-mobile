import { useState } from "react";
import { View, TextInput, Button } from "react-native";
import { router } from "expo-router";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useOnboarding } from "@/context/OnboardingContext";
import { setOnboardingStatus } from "@/utils/storage.service";
import { debounce } from "@/utils/debounce";

export default function KYC() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [country, setCountry] = useState('');
  const [email, setEmail] = useState('');
  const { onboardingData, updateOnboardingData } = useOnboarding();

  const setKYCValue = (KYCKey: string, KYCValue: string): void => {
    if (!KYCValue) {
      console.error("No KYCValue provided to selectKYCValue");
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
  }

  const updateOnboardingStatusStorage = async (timestamp: Date): Promise<void> => {
    await setOnboardingStatus(JSON.stringify(timestamp));
  }

  const handleSubmit = () => {
    updateOnboardingData({
      firstName,
      lastName,
      residentialCountry: country,
    })
    console.log(onboardingData)
    updateOnboardingStatusStorage(new Date(Date.now()));
    router.navigate('/(tabs)');
  }

  return (
    <View>
      <ThemedText className="text-lg font-bold px-3 my-4">Let's get to know you</ThemedText>

      <ThemedView>
        <View className="my-5">
          <TextInput
            placeholder="First Name"
            placeholderTextColor="grey"
            autoComplete="given-name"
            autoFocus={true}
            className="pl-3 pr-3 py-2 border text-gray-400 border-x-0 border-t-0 border-gray-200"
            value={firstName}
            onChangeText={(val) => setKYCValue('firstName', val)}
          />
        </View>

        <View className="my-5">
          <TextInput
            placeholder="Last Name"
            placeholderTextColor="grey"
            autoComplete="family-name"
            className="pl-3 pr-3 py-2 border text-gray-400 border-x-0 border-t-0 border-gray-200"
            value={lastName}
            onChangeText={(val) => setKYCValue('lastName', val)}
          />
        </View>

        <View className="my-5">
          <TextInput
            placeholder="Email Address"
            placeholderTextColor="grey"
            autoComplete="email"
            className="pl-3 pr-3 py-2 border text-gray-400 border-x-0 border-t-0 border-gray-200"
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
            className="pl-3 pr-3 py-2 border text-gray-400 border-x-0 border-t-0 border-gray-200"
            value={country}
            onChangeText={(val) => setKYCValue('country', val)}
          />
        </View>

        <View>
          <Button title="Submit" onPress={handleSubmit}/>
        </View>
      </ThemedView>
    </View>
  )
}