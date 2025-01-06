import { Link } from "expo-router";
import { useState } from "react";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useOnboarding } from "@/context/OnboardingContext";
import { View } from "react-native";

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
      <ThemedText className="text-lg font-bold px-3 my-4">Welcome {user}, Let's get you onboarded</ThemedText>
      <ThemedView>
        <ThemedText className="text-md font-semibold mb-3">Do you have a passport</ThemedText>

        <ThemedView className="flex-row gap-5">
          <Link href='/country' onPress={() => hasPassport(true)}>
            <ThemedText>Yes</ThemedText>
          </Link>
          
          {/* To passport acquisition page */}
          <Link href='/passport' onPress={() => hasPassport(true)}>
            <ThemedText>No</ThemedText>
          </Link>
        </ThemedView>        
      </ThemedView>
    </View>
  )
} 