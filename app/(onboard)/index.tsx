import { Link } from "expo-router";
import { useState } from "react";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useOnboarding } from "@/context/OnboardingContext";

export default function Onboard() {
  const [user] = useState('User')
  
  const { updateOnboardingData } = useOnboarding();

  const selectVisa = (visa: string): void => {
    if (!visa) {
      console.error("No visa provided to selectVisa");
      return;
    }
    updateOnboardingData({
      destinationVisa: visa
    });
  }
  
  return (
    <ThemedView className="m-2">
      <ThemedText>Welcome {user}, Let's get you onboarded</ThemedText>
      <ThemedText>Do you have a passport</ThemedText>
      <Link href={{
        pathname: '/country'
      }}>
        <ThemedText>Yes</ThemedText>
      </Link>
      {/* TODO: Route to passport acquisition page */}
      <Link href={{ pathname: '/passport' }}>
        <ThemedText>No</ThemedText>
      </Link>
    </ThemedView>
  )
} 