import { ThemedView } from '@/components/ThemedView';
import { Stack } from 'expo-router';
import { View } from 'react-native';

export default function Layout() {
  return (
    <View>
      <Stack screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' }
      }}/>
    </View>
  );
}