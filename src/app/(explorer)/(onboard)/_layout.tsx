// ─────────────────────────────────────────────────────────────────────────────
// Destination Explorer — onboarding stack
//
// A short 4-step first-run flow shown in the Explorer's coral/cream design
// language: passport → country → personal-info → complete. Each step carries a
// 4-segment progress bar + back button, and a sticky bottom primary CTA. This is
// a self-contained sub-stack under (explorer); it is designed (not ported from a
// prototype) but faithfully reuses the Explorer tokens/primitives.
// ─────────────────────────────────────────────────────────────────────────────

import { Stack } from 'expo-router';
import { EX } from '@/components/explorer/theme';

export default function OnboardLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Warm cream background matches every Explorer surface.
        contentStyle: { backgroundColor: EX.color.bg },
        // iOS-style horizontal push between the four steps.
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="passport" />
      <Stack.Screen name="country" />
      <Stack.Screen name="personal-info" />
      <Stack.Screen name="complete" />
    </Stack>
  );
}
