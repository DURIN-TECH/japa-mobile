import { Stack } from "expo-router";

export default function MeLayout() {
  return (
    <Stack>
      <Stack.Screen
        name='index'
        options={{
          title: "Me",
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen 
        name="applications" 
        options={{
          headerShown: false,
          presentation: "card"
        }}
      />
      <Stack.Screen 
        name="consultations" 
        options={{
          headerShown: false,
          presentation: "card"
        }}
      />
    </Stack>
  )
}