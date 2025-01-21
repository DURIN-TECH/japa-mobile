import { Stack } from "expo-router";
import React from "react";

export default function AgentLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          headerShown: false 
        }} 
      />
      <Stack.Screen 
        name="[id]" 
        options={{ 
          headerShown: false 
        }} 
      />
      <Stack.Screen 
        name="[id]/book-consultation" 
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Book Consultation',
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: '#f9fafb'
          }
        }}
      />
      <Stack.Screen 
        name="[id]/payment" 
        options={{
          presentation: 'card',
          headerShown: false
        }}
      />
      <Stack.Screen 
        name="[id]/visa-service/[type]" 
        options={{
          presentation: 'card',
          headerShown: true,
          title: 'Visa Service Details',
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      <Stack.Screen 
        name="[id]/confirmation" 
        options={{
          presentation: 'card',
          headerShown: false
        }}
      />
    </Stack>
  );
} 