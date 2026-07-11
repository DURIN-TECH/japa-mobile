// ─────────────────────────────────────────────────────────────────────────────
// Destination Explorer — navigation stack
//
// Self-contained route group that hosts the full Explorer experience (5-tab shell
// + pushed detail/flow screens). Loads the Space Grotesk display font used across
// the Explorer's coral/cream design language. The live app's blue theme and wired
// screens are untouched — this group is reachable from the app but independent.
// ─────────────────────────────────────────────────────────────────────────────

import { Stack } from 'expo-router';
import { View } from 'react-native';
import { useFonts } from 'expo-font';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { EX } from '@/components/explorer/theme';

export default function ExplorerLayout() {
  const [loaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  // Hold the warm background while the display font loads so headings don't flash.
  if (!loaded)
    return <View style={{ flex: 1, backgroundColor: EX.color.bg }} />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: EX.color.bg },
        // iOS-style horizontal push for all detail screens.
        animation: 'slide_from_right',
      }}
    >
      {/* Standalone shell: auth + onboarding entry flows */}
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(onboard)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="destination/[id]" />
      <Stack.Screen name="application/[id]" />
      <Stack.Screen name="agent/[id]" />
      <Stack.Screen name="agency/[id]" />
      <Stack.Screen name="eligibility/index" />
      <Stack.Screen name="eligibility/result" />
      <Stack.Screen name="messages/index" />
      <Stack.Screen name="messages/[id]" />
      <Stack.Screen name="consultations" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="self-service/[id]" />
      <Stack.Screen
        name="subscription"
        options={{ animation: 'slide_from_bottom' }}
      />
      {/* Consultation booking flow + detail + settings */}
      <Stack.Screen name="book/[agentId]" />
      <Stack.Screen name="pay" />
      <Stack.Screen
        name="confirmation"
        options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
      />
      <Stack.Screen name="consultation/[id]" />
      <Stack.Screen name="settings" />
      {/* Profile secondary destinations + full visa breakdown */}
      <Stack.Screen name="documents" />
      <Stack.Screen name="payments" />
      <Stack.Screen name="saved" />
      <Stack.Screen name="visa/[id]" />
    </Stack>
  );
}
