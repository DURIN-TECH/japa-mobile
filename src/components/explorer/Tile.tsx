// ─────────────────────────────────────────────────────────────────────────────
// Destination Tile — full-bleed image, legibility scrim, overlaid type.
// Shared by the Explore grid and the Home "recommended" scroller. Ported 1:1 from
// the prototype's grid.jsx Tile (heights, radii, chip and type specs preserved).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { EX } from './theme';
import { Dest } from './data';
import { Flag, Scrim } from './primitives';

// Small translucent glass chip used for price / "Most popular" over imagery.
function GlassChip({ children, style }: { children: React.ReactNode; style?: any }) {
  return (
    <BlurView
      intensity={16}
      tint="light"
      style={[
        {
          flexDirection: 'row', alignItems: 'center', gap: 5, overflow: 'hidden',
          backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999,
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
          paddingHorizontal: 10, paddingVertical: 5,
        },
        style,
      ]}
    >
      {children}
    </BlurView>
  );
}

export function Tile({ d, big = false, onPress }: { d: Dest; big?: boolean; onPress: () => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: '100%', height: big ? 248 : 214, borderRadius: EX.radius.hero, overflow: 'hidden',
        backgroundColor: d.tone,
        shadowColor: '#171326', shadowOpacity: 0.2, shadowRadius: 22, shadowOffset: { width: 0, height: 14 }, elevation: 6,
      }}
    >
      {!failed ? (
        <Image
          source={{ uri: d.img }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          contentFit="cover"
          transition={200}
          onError={() => setFailed(true)}
        />
      ) : null}
      <Scrim variant="tile" />

      {/* price chip */}
      <View style={{ position: 'absolute', top: 12, right: 12 }}>
        <GlassChip>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 0.1 }}>${d.price.toLocaleString()}</Text>
        </GlassChip>
      </View>

      {big ? (
        <View style={{ position: 'absolute', top: 12, left: 12 }}>
          <GlassChip>
            <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#FFD27A' }} />
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>Most popular</Text>
          </GlassChip>
        </View>
      ) : null}

      {/* type block */}
      <View style={{ position: 'absolute', left: 14, right: 14, bottom: 13 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 }}>
          <Flag code={d.flag} size={18} radius={5} />
          <Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '600', opacity: 0.92, letterSpacing: 0.2 }} numberOfLines={1}>
            {d.country}
          </Text>
        </View>
        <Text
          style={{
            color: '#fff', fontFamily: EX.font.display.semibold, fontSize: big ? 28 : 22, lineHeight: big ? 29 : 23,
            letterSpacing: -0.28, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 12,
          }}
          numberOfLines={2}
        >
          {d.visa}
        </Text>
        {big ? (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
            <Text style={{ color: '#fff', fontSize: 12.5, opacity: 0.9 }}>{d.processing}</Text>
            <Text style={{ color: '#fff', fontSize: 12.5, opacity: 0.5 }}>·</Text>
            <Text style={{ color: '#fff', fontSize: 12.5, opacity: 0.9 }}>{d.applied.toLocaleString()} applied</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
