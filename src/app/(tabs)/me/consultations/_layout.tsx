import { Stack } from 'expo-router';
import React from 'react';

export default function ConsultationsLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="consultations"
        options={{
          presentation: 'card',
          // headerShown: true,
          title: 'My Consultations',
          // headerShadowVisible: false,
          // headerBackButtonDisplayMode: 'minimal',
          headerStyle: {
            backgroundColor: '#f9fafb',
          },
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          presentation: 'card',
          // headerShown: true,
          title: 'Consultation Details',
          // headerShadowVisible: false,
          headerStyle: {
            backgroundColor: '#f9fafb',
          },
        }}
      />
    </Stack>
  );
}
