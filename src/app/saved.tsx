// ─────────────────────────────────────────────────────────────────────────────
// Saved destinations (profile → saved secondary destination).
//
// japa#145: there is no saved-destinations endpoint yet (real saving is
// follow-up #146), so this screen no longer resolves the demo `SAVED` ids. It
// always shows the first-run empty state from the #145 design spec:
//   • standard 40px back header at insets.top + 10
//   • `bookmark` · "Nothing saved yet" · "Destinations you save will show up
//     here." · coral "Explore destinations" → the Explore tab
// When #146 lands, the 2-column Tile grid (as on Explore) comes back here,
// fed by the live saved list.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { StateEmpty } from '@/components/explorer/states';

export default function SavedView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Switch to the Explore tab with the selection haptic tab presses use.
  const toExplore = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push('/(tabs)/explore');
  };

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      {/* ── Back header ─────────────────────────────────────────────────────── */}
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingHorizontal: 18,
          paddingBottom: 6,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: EX.color.line10,
              backgroundColor: '#fff',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ic.chevL size={21} color={EX.color.ink} strokeWidth={1.8} />
          </Pressable>
          <Text style={displayText(24, 'semibold')}>Saved destinations</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}
      >
        {/* ── First-run empty state (no saved source until #146) ──────────── */}
        <StateEmpty
          icon={Ic.bookmark}
          title="Nothing saved yet"
          body="Destinations you save will show up here."
          action={{
            label: 'Explore destinations',
            onPress: toExplore,
            variant: 'coral',
          }}
        />
      </ScrollView>
    </View>
  );
}
