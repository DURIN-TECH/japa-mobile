// ─────────────────────────────────────────────────────────────────────────────
// Onboarding — Step 4 of 4 · All set (terminus)
//
// A centered success moment: a coral→teal check circle, a bold "You're all set!"
// headline, a reassuring subtitle, and a small 3-row preview of what the Explorer
// offers (Explore visas / Check eligibility / Track applications) with cream icon
// chips. The full 4-segment progress bar reads complete. A sticky coral CTA
// ("Get started") replaces the stack with the Home tab so the flow can't be
// re-entered by going back.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
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

// ── OnboardTopBar — 4-segment progress bar + back button (see passport step) ──
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

// ── FeatureRow — cream icon chip + label + supporting line ────────────────────
function FeatureRow({
  icon: IconCmp,
  title,
  sub,
}: {
  icon: IconType;
  title: string;
  sub: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: EX.color.cream,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconCmp size={19} color={EX.color.primary} strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ fontSize: 14.5, fontWeight: '700', color: EX.color.ink }}
        >
          {title}
        </Text>
        <Text style={{ fontSize: 12.5, color: EX.color.muted, marginTop: 1 }}>
          {sub}
        </Text>
      </View>
    </View>
  );
}

export default function CompleteStep() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      {/* ── Full progress + back ────────────────────────────────────────────── */}
      <OnboardTopBar step={4} insets={insets} onBack={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: EX.space.screenX,
          paddingTop: 24,
          paddingBottom: EX.space.ctaClear,
        }}
      >
        {/* ── Success mark — 76px coral→teal check circle ────────────────────── */}
        <LinearGradient
          colors={[EX.color.primary, EX.color.teal]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{
            width: 76,
            height: 76,
            borderRadius: 38,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: EX.color.primary,
            shadowOpacity: 0.4,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 12 },
            elevation: 6,
          }}
        >
          <Ic.check size={36} color="#fff" strokeWidth={2.4} />
        </LinearGradient>

        {/* ── Headline + subtitle ────────────────────────────────────────────── */}
        <Text
          style={[
            displayText(28, 'bold'),
            { marginTop: 22, textAlign: 'center' },
          ]}
        >
          You&apos;re all set!
        </Text>
        <Text
          style={{
            fontSize: 14.5,
            lineHeight: 22,
            color: EX.color.inkMuted,
            textAlign: 'center',
            marginTop: 10,
            maxWidth: 300,
          }}
        >
          Your profile is ready — let&apos;s find your path.
        </Text>

        {/* ── Feature preview list ───────────────────────────────────────────── */}
        <View
          style={{
            alignSelf: 'stretch',
            gap: 16,
            marginTop: 32,
            paddingHorizontal: 4,
          }}
        >
          <FeatureRow
            icon={Ic.globe}
            title="Explore visas"
            sub="Hand-picked routes to 30+ countries"
          />
          <FeatureRow
            icon={Ic.shield}
            title="Check eligibility"
            sub="See where you qualify in minutes"
          />
          <FeatureRow
            icon={Ic.layers}
            title="Track applications"
            sub="Live status from start to visa"
          />
        </View>
      </ScrollView>

      {/* ── Sticky glass CTA — Get started (replaces stack with Home) ───────── */}
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
          onPress={() => router.replace('/(explorer)/(tabs)/home')}
          style={{
            height: 54,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: EX.color.primary,
            shadowColor: EX.color.primary,
            shadowOpacity: 0.45,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 10 },
            elevation: 6,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '700' }}>
            Get started
          </Text>
        </Pressable>
      </BlurView>
    </View>
  );
}
