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
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="country" />
      <Stack.Screen name="personal-info" />
      <Stack.Screen
        name="complete"
        options={{
          gestureEnabled: false,
          animation: 'fade',
        }}
      />
    </Stack>
  );
}
