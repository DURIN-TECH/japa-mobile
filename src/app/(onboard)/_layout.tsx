import { Stack } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';

export default function OnboardLayout() {
  const { isDark } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: isDark ? '#111827' : '#f9fafb',
        },
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
