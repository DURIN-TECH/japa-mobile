import { Stack } from 'expo-router';
import React from 'react';

export default function ApplicationsLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
          title: 'Applications',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          presentation: 'card',
          headerShown: true,
          title: 'Application Details',
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: '#f9fafb',
          },
        }}
      />
    </Stack>
  );
}
