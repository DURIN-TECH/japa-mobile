// app/(tabs)/qa/index.tsx
import { useState } from 'react';
import { FlatList, StyleSheet, TextInput } from 'react-native';
import { Link, Stack } from 'expo-router';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';


export default function QALayOut() {

  return (
    <ThemedView>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="ask" options={{ headerShown: false }} />
        <Stack.Screen name="question" options={{ headerShown: false }} />
      </Stack>
    </ThemedView>
  );
}
