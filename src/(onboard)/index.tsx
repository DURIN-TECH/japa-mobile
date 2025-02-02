import { Link } from "expo-router";
import { useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { useOnboarding } from "@/context/OnboardingContext";
import { View, Text } from "react-native";

export default function Onboard() {
  const [user] = useState('User')  
  const { onboardingData, updateOnboardingData } = useOnboarding();

  const hasPassport = (hasPassport: boolean): void => {
    if(!hasPassport) {
      console.error("No passport status specified");
      return;
    }
    updateOnboardingData({
      hasPassport
    });
    console.log(onboardingData)
  }
  
  return (
    <View className="m-2">
      <Text className="text-lg font-bold px-3 my-4">Welcome {user}, Let's get you onboarded</Text>
      <ThemedView>
        <Text className="text-md font-semibold mb-3">Do you have a passport</Text>

        <ThemedView className="flex-row gap-5">
          <Link href='/country' onPress={() => hasPassport(true)}>
            <Text>Yes</Text>
          </Link>
          
          {/* To passport acquisition page */}
          <Link href='/passport' onPress={() => hasPassport(true)}>
            <Text>No</Text>
          </Link>
        </ThemedView>        
      </ThemedView>
    </View>
  )
} 