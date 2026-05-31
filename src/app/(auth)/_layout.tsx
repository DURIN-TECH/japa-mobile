import { Stack } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';

export default function AuthLayout() {
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
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="verify-otp" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
