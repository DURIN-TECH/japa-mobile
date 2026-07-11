// ─────────────────────────────────────────────────────────────────────────────
// Onboarding — Step 1 of 4 · Passport
//
// Asks whether the user already holds a passport. Two big selectable radio cards
// ("Yes, I have a passport" / "Not yet"), each with an accent icon chip (green /
// amber) that keys the option's meaning. Selection is shown the Explorer way:
// coral 1.5px border + primaryTint07 fill + a coral radio dot. A sticky glass CTA
// ("Continue") stays disabled until a choice is made, then pushes to the country
// step. No text inputs here, so no KeyboardAvoidingView is needed.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';

// Lucide-style icon component signature (size/color/strokeWidth props).
type IconType = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

// ── OnboardTopBar — 4-segment progress bar + back button ──────────────────────
// `step` = number of segments filled coral (1..4). Filled segments use the coral
// primary; the rest sit on the line12 hairline colour.
function OnboardTopBar({
  step,
  insets,
  onBack,
}: {
  step: number;
  insets: { top: number };
  onBack: () => void;
}) {
  return (
    <View
      style={{
        paddingTop: insets.top + 10,
        paddingHorizontal: EX.space.screenX,
        paddingBottom: 4,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {/* Back button — 40px white circle with a chevron. */}
        <Pressable
          onPress={onBack}
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

        {/* Four equal segments; filled up to the current step. */}
        <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 5,
                borderRadius: 999,
                backgroundColor: i < step ? EX.color.primary : EX.color.line12,
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ── PassportCard — one big selectable radio option ────────────────────────────
function PassportCard({
  title,
  sub,
  icon: IconCmp,
  accent,
  accentTint,
  selected,
  onPress,
}: {
  title: string;
  sub: string;
  icon: IconType;
  accent: string;
  accentTint: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 18,
        borderRadius: 20,
        // Explorer selection treatment: coral 1.5px border + tinted fill.
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? EX.color.primary : EX.color.line10,
        backgroundColor: selected ? EX.color.primaryTint07 : EX.color.cardWhite,
        shadowColor: '#171326',
        shadowOpacity: 0.04,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
    >
      {/* Accent icon chip — green (has passport) / amber (not yet). */}
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 14,
          backgroundColor: accentTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconCmp size={22} color={accent} strokeWidth={1.8} />
      </View>

      {/* Title + supporting line. */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: EX.color.ink }}>
          {title}
        </Text>
        <Text
          style={{
            fontSize: 12.5,
            lineHeight: 17,
            color: EX.color.muted,
            marginTop: 2,
          }}
        >
          {sub}
        </Text>
      </View>

      {/* Radio — coral filled dot when selected. */}
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 2,
          borderColor: selected ? EX.color.primary : EX.color.line16,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? (
          <View
            style={{
              width: 11,
              height: 11,
              borderRadius: 6,
              backgroundColor: EX.color.primary,
            }}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

export default function PassportStep() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // 'yes' | 'no' | null — gates the Continue CTA.
  const [choice, setChoice] = useState<'yes' | 'no' | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      {/* ── Progress + back ─────────────────────────────────────────────────── */}
      <OnboardTopBar step={1} insets={insets} onBack={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: EX.space.screenX,
          paddingTop: 18,
          paddingBottom: EX.space.ctaClear,
        }}
      >
        {/* ── Heading + subtitle ─────────────────────────────────────────────── */}
        <Text style={displayText(27)}>Do you have a passport?</Text>
        <Text
          style={{
            fontSize: 14.5,
            lineHeight: 21,
            color: EX.color.inkMuted,
            marginTop: 10,
            maxWidth: 300,
          }}
        >
          It&apos;s the first thing you&apos;ll need — but you can start planning
          either way.
        </Text>

        {/* ── Two selectable cards ───────────────────────────────────────────── */}
        <View style={{ gap: 12, marginTop: 26 }}>
          <PassportCard
            title="Yes, I have a passport"
            sub="Great — you're ready to start applying."
            icon={Ic.check2}
            accent={EX.color.success}
            accentTint="rgba(30,142,85,0.10)"
            selected={choice === 'yes'}
            onPress={() => setChoice('yes')}
          />
          <PassportCard
            title="Not yet"
            sub="No problem — we'll guide you when you're ready."
            icon={Ic.clock}
            accent={EX.color.amber}
            accentTint="rgba(178,106,20,0.10)"
            selected={choice === 'no'}
            onPress={() => setChoice('no')}
          />
        </View>
      </ScrollView>

      {/* ── Sticky glass CTA — Continue ─────────────────────────────────────── */}
      <BlurView
        intensity={30}
        tint="light"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingTop: 15,
          paddingHorizontal: EX.space.screenX,
          paddingBottom: Math.max(insets.bottom, 16) + 6,
          backgroundColor: EX.color.glassWarmSoft,
          borderTopWidth: 1,
          borderTopColor: EX.color.line06,
        }}
      >
        <Pressable
          onPress={() => router.push('/(explorer)/(onboard)/country')}
          disabled={!choice}
          style={{
            height: 54,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: choice ? EX.color.primary : 'rgba(244,81,108,0.35)',
            shadowColor: EX.color.primary,
            shadowOpacity: choice ? 0.45 : 0,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 10 },
            elevation: choice ? 6 : 0,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '700' }}>
            Continue
          </Text>
        </Pressable>
      </BlurView>
    </View>
  );
}
