// ─────────────────────────────────────────────────────────────────────────────
// Explorer AUTH — Welcome carousel (prototype auth.jsx → AuthWelcome).
//
// Full-screen cross-fading photography (the 3 ONBOARD slides) with a slow
// Ken-Burns zoom on the active slide, a top-center brand mark, bottom copy
// (kicker / title / body), animated progress dots and two CTAs.
//
// Native only: expo-image photos, expo-linear-gradient scrim, react-native-svg
// (via icons), react-native-reanimated for fade + zoom + dot width.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { EX, EXShadow, displayText } from '@/components/explorer/theme';
import { ONBOARD } from '@/components/explorer/data';
import { Ic } from '@/components/explorer/icons';
import { PINK } from '@/components/explorer/AuthShell';
import { SeliMark } from '@/components/explorer/SeliMark';

const ADVANCE_MS = 4200; // slide dwell time (source setInterval 4200ms)

// ── Slide ─────────────────────────────────────────────────────────────────────
// One full-bleed photo. Cross-fades (opacity 900ms) and Ken-Burns zooms
// (scale 1 → 1.08 over 6000ms) whenever it becomes the active slide.
function Slide({ img, active }: { img: string; active: boolean }) {
  const opacity = useSharedValue(active ? 1 : 0);
  const scale = useSharedValue(1);

  useEffect(() => {
    // Cross-fade this slide in/out.
    opacity.value = withTiming(active ? 1 : 0, {
      duration: 900,
      easing: Easing.inOut(Easing.ease),
    });
    // Restart the slow zoom each time the slide activates; ease back otherwise.
    if (active) {
      scale.value = 1;
      scale.value = withTiming(1.08, {
        duration: 6000,
        easing: Easing.out(Easing.ease),
      });
    } else {
      scale.value = withTiming(1, { duration: 900 });
    }
  }, [active, opacity, scale]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
        style,
      ]}
    >
      <Image
        source={{ uri: img }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        contentFit="cover"
        transition={200}
      />
      {/* Source scrim: to top, rgba(10,8,12,.92) 8% → .35 46% → .5 100%. */}
      <LinearGradient
        colors={[
          'rgba(10,8,12,0.92)',
          'rgba(10,8,12,0.92)',
          'rgba(10,8,12,0.35)',
          'rgba(10,8,12,0.5)',
        ]}
        locations={[0, 0.08, 0.46, 1]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
    </Animated.View>
  );
}

// ── Dot ───────────────────────────────────────────────────────────────────────
// Progress pill: active = coral, width 26; inactive = translucent white, width 8.
// Width animates (source transition 400ms cubic-bezier(.2,.8,.2,1)).
function Dot({ active, onPress }: { active: boolean; onPress: () => void }) {
  const w = useSharedValue(active ? 26 : 8);
  useEffect(() => {
    w.value = withTiming(active ? 26 : 8, {
      duration: 400,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
    });
  }, [active, w]);
  const style = useAnimatedStyle(() => ({ width: w.value }));
  return (
    <Pressable onPress={onPress} hitSlop={10}>
      <Animated.View
        style={[
          {
            height: 4,
            borderRadius: 999,
            backgroundColor: active
              ? EX.color.primary
              : 'rgba(255,255,255,0.4)',
          },
          style,
        ]}
      />
    </Pressable>
  );
}

export default function AuthWelcome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [i, setI] = useState(0);

  // Auto-advance the carousel every ADVANCE_MS.
  useEffect(() => {
    const t = setInterval(
      () => setI((v) => (v + 1) % ONBOARD.length),
      ADVANCE_MS,
    );
    return () => clearInterval(t);
  }, []);

  const slide = ONBOARD[i];

  return (
    // Fallback tone behind the photos (source used ONBOARD[i].tone).
    <View style={{ flex: 1, backgroundColor: slide.tone }}>
      {/* Stacked cross-fading slides. */}
      {ONBOARD.map((s, idx) => (
        <Slide key={s.id} img={s.img} active={idx === i} />
      ))}

      {/* Brand mark — top-center: Seli logo mark + wordmark. */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 30,
          left: 0,
          right: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 9,
        }}
      >
        <View style={EXShadow.primaryBtn}>
          <SeliMark size={30} />
        </View>
        <Text
          style={{
            fontFamily: EX.font.display.bold,
            fontSize: 20,
            letterSpacing: -0.2,
            color: '#fff',
          }}
        >
          Seli
        </Text>
      </View>

      {/* Bottom stack: copy → dots → actions (bottom-anchored). */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 22,
          paddingBottom: Math.max(insets.bottom, 16) + 30,
        }}
      >
        {/* Copy block (source left/right 26 → +4 margin over the 22 padding). */}
        <View style={{ paddingHorizontal: 4 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              color: PINK,
              marginBottom: 12,
            }}
          >
            {slide.kicker}
          </Text>
          <Text
            style={[
              displayText(40, 'semibold'),
              { color: '#fff', lineHeight: 41 },
            ]}
          >
            {slide.title}
          </Text>
          <Text
            style={{
              marginTop: 16,
              fontSize: 15,
              lineHeight: 22.5,
              color: 'rgba(255,255,255,0.82)',
              maxWidth: 320,
            }}
          >
            {slide.body}
          </Text>
        </View>

        {/* Progress dots. */}
        <View
          style={{
            flexDirection: 'row',
            gap: 7,
            marginTop: 22,
            marginLeft: 4,
            alignItems: 'center',
          }}
        >
          {ONBOARD.map((_, idx) => (
            <Dot key={idx} active={idx === i} onPress={() => setI(idx)} />
          ))}
        </View>

        {/* Actions. */}
        <View style={{ marginTop: 24, gap: 11 }}>
          {/* Coral primary — Get started → register. */}
          <Pressable
            onPress={() => router.push('/(explorer)/(auth)/register')}
            style={[
              {
                height: 55,
                borderRadius: 16,
                backgroundColor: EX.color.primary,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              },
              EXShadow.primaryBtn,
            ]}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
              Get started
            </Text>
            <Ic.arrow size={19} color="#fff" strokeWidth={1.8} />
          </Pressable>

          {/* Glass secondary — I already have an account → login. */}
          <Pressable
            onPress={() => router.push('/(explorer)/(auth)/login')}
            style={{
              height: 55,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.24)',
              backgroundColor: 'rgba(255,255,255,0.1)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
              I already have an account
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
