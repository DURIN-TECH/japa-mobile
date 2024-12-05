import { ThemedView } from '@/components/ThemedView';
import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <ThemedView>
      <Stack screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' }
      }} />
    </ThemedView>
  );
}