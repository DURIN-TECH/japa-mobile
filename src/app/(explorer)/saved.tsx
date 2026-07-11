// ─────────────────────────────────────────────────────────────────────────────
// Saved destinations (profile → saved secondary destination).
//
// A bookmarked-destinations board. Reuses the exact 2-column tile grid from the
// Explore screen — each saved destination id (`SAVED`) is resolved via
// `destById` and rendered with the shared `Tile`, deep-linking to its detail.
// Structure:
//   • standard 40px back header at insets.top + 10 with a "watching" subheading
//   • a responsive 2-column grid of destination Tiles
//   • an empty-state fallback when nothing is saved.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import { SAVED, destById, type Dest } from '@/components/explorer/data';
import { Ic } from '@/components/explorer/icons';
import { Tile } from '@/components/explorer/Tile';

export default function SavedView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Resolve saved ids → destinations (drop any that no longer exist).
  const saved = SAVED.map((id) => destById(id)).filter(
    (d): d is Dest => Boolean(d),
  );
  const open = (id: string) => router.push(`/(explorer)/destination/${id}`);

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
          <View>
            <Text style={displayText(24, 'semibold')}>Saved destinations</Text>
            <Text style={{ fontSize: 12.5, color: EX.color.muted, marginTop: 2 }}>
              {saved.length} place{saved.length === 1 ? '' : 's'} you&rsquo;re
              watching
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {saved.length === 0 ? (
          // ── Empty state ──────────────────────────────────────────────────
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 64,
              paddingHorizontal: 40,
              gap: 12,
            }}
          >
            <Ic.bookmark
              size={40}
              color={EX.color.muted}
              strokeWidth={1.8}
              style={{ opacity: 0.5 }}
            />
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: EX.color.ink,
                textAlign: 'center',
              }}
            >
              Nothing saved yet
            </Text>
            <Text
              style={{
                fontSize: 13,
                lineHeight: 19,
                color: EX.color.muted,
                textAlign: 'center',
              }}
            >
              Tap the bookmark on any destination to keep an eye on it here.
            </Text>
            <Pressable
              onPress={() => router.push('/(explorer)/(tabs)/explore')}
              style={{
                marginTop: 6,
                backgroundColor: EX.color.primary,
                borderRadius: EX.radius.button,
                paddingHorizontal: 20,
                paddingVertical: 12,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                Explore destinations
              </Text>
            </Pressable>
          </View>
        ) : (
          // ── 2-column tile grid (matches Explore) ─────────────────────────
          <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                rowGap: 13,
              }}
            >
              {saved.map((d) => (
                <View key={d.id} style={{ width: '48.4%' }}>
                  <Tile d={d} onPress={() => open(d.id)} />
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
