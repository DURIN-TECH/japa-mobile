// ─────────────────────────────────────────────────────────────────────────────
// Destination Explorer — immersive AUTH stack
//
// The dark, photo-backed onboarding + auth flow (welcome carousel → login /
// register / OTP / forgot-password). Its own Stack so these screens push
// horizontally and keep a black backdrop while the hero photo loads (the parent
// Explorer group is warm cream — this group is deliberately dark).
// ─────────────────────────────────────────────────────────────────────────────

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0E0E0E' }, // dark backdrop under the photos
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
