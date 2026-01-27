import { Stack } from 'expo-router';

export default function ApplyLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="visa-details/[id]"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="agents"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      {/* <Stack.Screen
        name="self-service"
        options={{
          headerShown: true,
          presentation: "card"
        }}
      />
      <Stack.Screen
        name="visa-details"
        options={{
          headerShown: false,
          presentation: "card"
        }}
      /> */}
      <Stack.Screen
        name="self-service/[id]"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
    </Stack>
  );
}
