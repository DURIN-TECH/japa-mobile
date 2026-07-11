// ─────────────────────────────────────────────────────────────────────────────
// Destination detail (prototype detail.jsx DetailView).
// Parallax photo hero + rounded content sheet that rises over it + sticky glass
// CTA. Reanimated drives the hero parallax/zoom from the sheet's scroll offset.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Pressable, Text, View, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import { AGENTS, REQS, destById } from '@/components/explorer/data';
import { Ic } from '@/components/explorer/icons';
import { Flag, GlassButton, Portrait, Scrim } from '@/components/explorer/primitives';

const HERO = 376;

// ── Stat strip cell ──────────────────────────────────────────────────────────
function StatCell({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 3, paddingHorizontal: 4 }}>
      <Text style={{ fontSize: 16.5, fontWeight: '700', color: accent ?? EX.color.ink, letterSpacing: -0.16 }} numberOfLines={1}>{value}</Text>
      <Text style={{ fontSize: 11, color: EX.color.muted, fontWeight: '500' }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ── Path card (Work with an agent / Self-service) ────────────────────────────
function PathCard({
  icon: IconCmp, title, sub, badge, accent = EX.color.ink, dark = false, onPress,
}: { icon: React.ComponentType<any>; title: string; sub: string; badge?: string; accent?: string; dark?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20,
        borderWidth: 1, borderColor: dark ? 'transparent' : EX.color.line10,
        backgroundColor: dark ? EX.color.ink : '#fff',
        shadowColor: '#171326', shadowOpacity: dark ? 0.4 : 0.04, shadowRadius: dark ? 20 : 2, shadowOffset: { width: 0, height: dark ? 12 : 1 }, elevation: dark ? 6 : 1,
      }}
    >
      <View style={{ width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? 'rgba(255,255,255,0.12)' : EX.color.cream }}>
        <IconCmp size={21} color={dark ? EX.color.bg : accent} strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15.5, fontWeight: '700', color: dark ? EX.color.bg : EX.color.ink }} numberOfLines={1}>{title}</Text>
        <Text style={{ fontSize: 12.5, marginTop: 2, color: dark ? 'rgba(255,251,245,0.72)' : 'rgba(23,19,38,0.6)' }} numberOfLines={1}>{sub}</Text>
      </View>
      {badge ? (
        <View style={{ backgroundColor: dark ? 'rgba(255,255,255,0.16)' : EX.color.cream, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: dark ? '#FFD27A' : accent }}>{badge}</Text>
        </View>
      ) : (
        <Ic.chevR size={20} color={dark ? EX.color.bg : EX.color.muted} strokeWidth={1.8} />
      )}
    </Pressable>
  );
}

export default function DestinationDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const d = destById(id);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });

  // Hero parallaxes up at -0.32× and its image zooms slightly as the sheet rises.
  const heroStyle = useAnimatedStyle(() => ({ transform: [{ translateY: scrollY.value * -0.32 }] }));
  const imgStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(scrollY.value, [0, 400], [1, 1.24], Extrapolation.CLAMP) }],
  }));

  if (!d) {
    return (
      <View style={{ flex: 1, backgroundColor: EX.color.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: EX.color.muted }}>Destination not found.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      {/* HERO — fixed behind, parallaxes as the sheet scrolls over it */}
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: HERO, overflow: 'hidden', backgroundColor: d.tone }, heroStyle]}>
        <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }, imgStyle]}>
          <Image source={{ uri: d.img }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} />
        </Animated.View>
        <Scrim variant="detail" />
        <View style={{ position: 'absolute', left: 22, right: 22, bottom: 64 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Flag code={d.flag} size={22} radius={6} />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', opacity: 0.94, letterSpacing: 0.2 }}>{d.country} · {d.city}</Text>
          </View>
          <Text style={{ color: '#fff', fontFamily: EX.font.display.semibold, fontSize: 38, lineHeight: 39, letterSpacing: -0.38, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 18 }}>
            {d.visa}
          </Text>
        </View>
      </Animated.View>

      {/* Top glass controls */}
      <View style={{ position: 'absolute', top: insets.top + 6, left: 0, right: 0, zIndex: 50, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18 }}>
        <GlassButton icon={Ic.chevL} onPress={() => router.back()} />
        <GlassButton icon={Ic.heart} />
      </View>

      {/* Scrolling content sheet */}
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 0 }}
      >
        {/* spacer revealing the hero */}
        <View style={{ height: HERO - 28 }} pointerEvents="none" />

        <View
          style={{
            backgroundColor: EX.color.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, minHeight: 540,
            paddingTop: 8, paddingHorizontal: 20, paddingBottom: 130,
            shadowColor: '#171326', shadowOpacity: 0.28, shadowRadius: 30, shadowOffset: { width: 0, height: -8 },
          }}
        >
          <View style={{ width: 40, height: 4, borderRadius: 99, backgroundColor: EX.color.line16, alignSelf: 'center', marginBottom: 16 }} />

          {/* Stat strip */}
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: EX.color.line08, borderRadius: 20, paddingVertical: 16, paddingHorizontal: 8, shadowColor: '#171326', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 }}>
            <StatCell value={d.processing} label="Processing" />
            <View style={{ width: 1, height: 30, backgroundColor: EX.color.line08 }} />
            <StatCell value={`$${d.price.toLocaleString()}`} label="Starting at" accent={EX.color.primary} />
            <View style={{ width: 1, height: 30, backgroundColor: EX.color.line08 }} />
            <StatCell value={d.approval} label="Approval" accent={EX.color.tealDeep} />
          </View>

          <Text style={{ fontSize: 14.5, lineHeight: 23, color: EX.color.ink2, marginTop: 18, marginHorizontal: 2 }}>{d.blurb}</Text>

          {/* Choose your path */}
          <Text style={[displayText(18, 'bold'), { fontFamily: undefined, fontWeight: '700', letterSpacing: -0.18, marginTop: 24, marginBottom: 12, marginHorizontal: 2 }]}>Choose your path</Text>
          <View style={{ gap: 10 }}>
            <PathCard dark icon={Ic.users} title="Work with an agent" sub="Guided by 12 verified experts" badge="Popular" onPress={() => router.push(`/(explorer)/agent/${AGENTS[0].id}`)} />
            <PathCard icon={Ic.docs} title="Self-service" sub="Step-by-step DIY application" onPress={() => router.push(`/(explorer)/self-service/${d.id}`)} />
          </View>

          {/* Eligibility CTA */}
          <Pressable
            onPress={() => router.push({ pathname: '/(explorer)/eligibility', params: { dest: d.id } })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 15, borderRadius: 20, marginTop: 18, borderWidth: 1, borderColor: EX.color.tealTint14, backgroundColor: EX.color.tealTint08 }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D6F2E2' }}>
              <Ic.shield size={22} color={EX.color.success} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: EX.color.ink }}>Check your eligibility</Text>
              <Text style={{ fontSize: 12.5, color: EX.color.inkMuted, marginTop: 1 }}>Answer 5 quick questions · 2 min</Text>
            </View>
            <Ic.chevR size={20} color={EX.color.success} strokeWidth={1.8} />
          </Pressable>

          {/* Requirements */}
          <Text style={{ fontSize: 18, fontWeight: '700', color: EX.color.ink, letterSpacing: -0.18, marginTop: 26, marginBottom: 12, marginHorizontal: 2 }}>What you&apos;ll need</Text>
          <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: EX.color.line08, borderRadius: 20, overflow: 'hidden', shadowColor: '#171326', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 }}>
            {REQS.map((r, i) => (
              <View key={r.t} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: EX.color.line06 }}>
                <View style={{ width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: EX.color.cream }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: EX.color.muted }}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 14.5, fontWeight: '600', color: EX.color.ink }}>{r.t}</Text>
                  <Text style={{ fontSize: 12.5, color: EX.color.muted, marginTop: 1 }}>{r.d}</Text>
                </View>
                <View style={{ backgroundColor: r.e === 'Ready' ? EX.color.tealTint10 : EX.color.cream, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: r.e === 'Ready' ? EX.color.tealDeep : EX.color.muted }}>{r.e}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Full visa breakdown link */}
          <Pressable
            onPress={() => router.push(`/(explorer)/visa/${d.id}`)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 15, borderRadius: 20, marginTop: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: EX.color.line08 }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: EX.color.cream }}>
              <Ic.trend size={20} color={EX.color.primary} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: EX.color.ink }}>Full visa breakdown</Text>
              <Text style={{ fontSize: 12.5, color: EX.color.inkMuted, marginTop: 1 }}>Success rates &amp; common reasons for refusal</Text>
            </View>
            <Ic.chevR size={20} color={EX.color.muted} strokeWidth={1.8} />
          </Pressable>

          {/* Top agents */}
          <Text style={{ fontSize: 18, fontWeight: '700', color: EX.color.ink, letterSpacing: -0.18, marginTop: 26, marginBottom: 12, marginHorizontal: 2 }}>Top agents for {d.country}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 11, paddingHorizontal: 20, paddingVertical: 2 }}>
            {AGENTS.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => router.push(`/(explorer)/agent/${a.id}`)}
                style={{ width: 184, backgroundColor: '#fff', borderWidth: 1, borderColor: EX.color.line08, borderRadius: 18, padding: 14, shadowColor: '#171326', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <Portrait seed={a.seed} size={42} name={a.n} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: EX.color.ink }} numberOfLines={1}>{a.n}</Text>
                    <Text style={{ fontSize: 11.5, color: EX.color.muted }} numberOfLines={1}>{a.spec}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ic.star size={13} color={EX.color.gold} fill={EX.color.gold} strokeWidth={0} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: EX.color.ink }}>{a.r}</Text>
                  </View>
                  <View style={{ backgroundColor: EX.color.tealTint10, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: EX.color.tealDeep }}>{a.succ}%</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Animated.ScrollView>

      {/* Sticky glass CTA */}
      <BlurView intensity={30} tint="light" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 16, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16) + 6, backgroundColor: EX.color.glassWarmSoft, borderTopWidth: 1, borderTopColor: EX.color.line06 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View>
            <Text style={{ fontSize: 11.5, color: EX.color.muted, fontWeight: '500' }}>Starting at</Text>
            <Text style={{ fontSize: 21, fontWeight: '700', color: EX.color.ink, letterSpacing: -0.21 }}>${d.price.toLocaleString()}</Text>
          </View>
          <Pressable
            onPress={() => router.push(`/(explorer)/self-service/${d.id}`)}
            style={{ flex: 1, height: 54, borderRadius: 16, backgroundColor: EX.color.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: EX.color.primary, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 6 }}
          >
            <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '700' }}>Start application</Text>
            <Ic.arrow size={18} color="#fff" strokeWidth={1.8} />
          </Pressable>
        </View>
      </BlurView>
    </View>
  );
}
