import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Link } from "expo-router";
import { useState } from "react";
import { View } from "react-native";


export default function Onboard() {
  const [user, setUser] = useState('User')
  return (
    <ThemedView className=" m-2">
      <ThemedText>Welcome {user}, Let's get you onboarded</ThemedText>
      <ThemedText>Do you have a passport</ThemedText>
      <Link href={{
        pathname: '/country'
      }}>Yes</Link>
      {/* TODO: Route to passport acquisition page */}
      <Link href={{pathname: '/visa'}}>No</Link>
    </ThemedView>
  )
} 