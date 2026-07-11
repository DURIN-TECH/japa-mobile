// ─────────────────────────────────────────────────────────────────────────────
// Subscription / plans (prototype flows.jsx SubscriptionView).
//
// A pricing screen presented as a bottom-sheet modal (see the stack animation in
// (explorer)/_layout.tsx). A full-bleed coral gradient header with two decorative
// circles sits above a stack of PlanCards:
//   • featured plan (tag "Most popular")  → dark gradient card + crown + coral Upgrade
//   • current plan  (id === CURRENT_PLAN) → coral border + "Current" pill + disabled CTA
//   • other plans                          → white card + dark Upgrade (+ optional tag)
//
// Every measurement below is quoted from the prototype (flows.jsx). Data comes
// from the static contract: `PLANS`, `PLAN_FEATURES` and `CURRENT_PLAN`.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX } from '@/components/explorer/theme';
import {
  PLANS,
  PLAN_FEATURES,
  CURRENT_PLAN,
  NAIRA,
  type Plan,
} from '@/components/explorer/data';
import { Ic } from '@/components/explorer/icons';
import { GlassButton } from '@/components/explorer/primitives';

// ── FeatureRow — 20px check circle + label for one plan feature ──────────────
// `dark` switches the palette so features read on the featured dark card.
function FeatureRow({ label, dark }: { label: string; dark?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: dark ? 'rgba(63,184,175,0.22)' : '#D6F2E2',
        }}
      >
        <Ic.check
          size={11}
          color={dark ? '#5BE0D3' : EX.color.success}
          strokeWidth={3.2}
        />
      </View>
      <Text
        style={{
          flex: 1,
          fontSize: 13.5,
          fontWeight: '600',
          color: dark ? 'rgba(255,255,255,0.92)' : EX.color.ink2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// ── PlanCard — one pricing tier ──────────────────────────────────────────────
function PlanCard({ plan }: { plan: Plan }) {
  const featured = plan.tag === 'Most popular';
  const current = plan.id === CURRENT_PLAN;

  // Card chrome: featured is a dark gradient; current gets a coral border; the
  // rest are plain white cards.
  const Container: React.ComponentType<any> = featured ? LinearGradient : View;
  const containerProps = featured
    ? {
        colors: [EX.color.dark1, EX.color.dark2] as const, // 158deg #241B33 → #14101F
        start: { x: 0.1, y: 0 },
        end: { x: 0.9, y: 1 },
      }
    : {};

  return (
    <Container
      {...containerProps}
      style={{
        position: 'relative',
        borderRadius: EX.radius.cardLg, // 24
        padding: 20,
        marginBottom: 15,
        backgroundColor: featured ? undefined : '#fff',
        borderWidth: featured ? 0 : 1,
        borderColor: current ? EX.color.primary : EX.color.line08,
        // Featured card floats on a soft shadow; the rest sit flat.
        shadowColor: '#171326',
        shadowOpacity: featured ? 0.4 : 0.04,
        shadowRadius: featured ? 24 : 2,
        shadowOffset: { width: 0, height: featured ? 16 : 1 },
        elevation: featured ? 8 : 1,
      }}
    >
      {/* Trailing pill (absolute top-right): coral tag, else "Current" */}
      {plan.tag ? (
        <View
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: 11,
            paddingVertical: 5,
            borderRadius: 999,
            backgroundColor: EX.color.primary,
          }}
        >
          <Ic.spark size={12} color="#fff" strokeWidth={1.8} />
          <Text
            style={{
              fontSize: 10.5,
              fontWeight: '700',
              letterSpacing: 0.42,
              textTransform: 'uppercase',
              color: '#fff',
            }}
          >
            {plan.tag}
          </Text>
        </View>
      ) : current ? (
        <View
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
            paddingHorizontal: 11,
            paddingVertical: 5,
            borderRadius: 999,
            backgroundColor: EX.color.primaryTint12,
          }}
        >
          <Text
            style={{ fontSize: 11, fontWeight: '700', color: EX.color.primary }}
          >
            Current
          </Text>
        </View>
      ) : null}

      {/* Header: crown chip (featured) · name */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {featured ? (
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(244,81,108,0.2)',
            }}
          >
            <Ic.crown size={17} color="#FF7D95" strokeWidth={1.8} />
          </View>
        ) : null}
        <Text
          style={{
            fontSize: 16,
            fontWeight: '700',
            color: featured ? '#fff' : EX.color.ink,
          }}
        >
          {plan.name}
        </Text>
      </View>

      {/* Price + interval */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: 3,
          marginTop: 8,
        }}
      >
        <Text
          style={{
            fontFamily: EX.font.display.bold,
            fontSize: 30,
            letterSpacing: -0.6,
            color: featured ? '#fff' : EX.color.ink,
          }}
        >
          {plan.price === 0 ? 'Free' : NAIRA(plan.price)}
        </Text>
        {plan.interval ? (
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: featured ? 'rgba(255,255,255,0.6)' : EX.color.muted,
            }}
          >
            /{plan.interval}
          </Text>
        ) : null}
      </View>

      {/* Blurb */}
      <Text
        style={{
          fontSize: 13,
          lineHeight: 19.5,
          color: featured ? 'rgba(255,255,255,0.72)' : EX.color.inkMuted,
          marginTop: 6,
        }}
      >
        {plan.blurb}
      </Text>

      {/* Feature list */}
      <View style={{ marginTop: 16, gap: 10 }}>
        {plan.features.map((key) => (
          <FeatureRow key={key} label={PLAN_FEATURES[key]} dark={featured} />
        ))}
      </View>

      {/* CTA — current plan is disabled; everyone else can Upgrade */}
      {current ? (
        <View
          style={{
            height: 48,
            borderRadius: 14,
            marginTop: 18,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: EX.color.line12,
          }}
        >
          <Text
            style={{ fontSize: 14, fontWeight: '700', color: EX.color.muted }}
          >
            Your current plan
          </Text>
        </View>
      ) : (
        <Pressable
          style={{
            height: 48,
            borderRadius: 14,
            marginTop: 18,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            backgroundColor: featured ? EX.color.primary : EX.color.ink,
            // Featured button carries a coral glow; the dark button sits flat.
            shadowColor: EX.color.primary,
            shadowOpacity: featured ? 0.45 : 0,
            shadowRadius: featured ? 16 : 0,
            shadowOffset: { width: 0, height: featured ? 10 : 0 },
            elevation: featured ? 6 : 0,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 14.5, fontWeight: '700' }}>
            {plan.price === 0 ? 'Switch to Free' : 'Upgrade'}
          </Text>
          <Ic.arrow size={17} color="#fff" strokeWidth={2} />
        </Pressable>
      )}
    </Container>
  );
}

export default function SubscriptionView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 16) + 24,
        }}
      >
        {/* ── Coral gradient header (160deg #F4516C → #C0374F) ──────────────── */}
        <LinearGradient
          colors={[EX.color.primary, EX.color.primaryDark]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{
            paddingTop: insets.top + 14, // prototype 92 → safe-area inset
            paddingHorizontal: EX.space.screenX, // 22
            paddingBottom: 40,
            overflow: 'hidden',
          }}
        >
          {/* Two decorative translucent circles */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -50,
              right: -30,
              width: 190,
              height: 190,
              borderRadius: 95,
              backgroundColor: 'rgba(255,255,255,0.1)',
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: -70,
              left: -40,
              width: 180,
              height: 180,
              borderRadius: 90,
              backgroundColor: 'rgba(255,255,255,0.08)',
            }}
          />

          {/* Glass back button */}
          <View style={{ flexDirection: 'row' }}>
            <GlassButton icon={Ic.chevL} onPress={() => router.back()} />
          </View>

          {/* "Japa Premium" glass badge */}
          <BlurView
            intensity={18}
            tint="light"
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              borderRadius: 999,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.4)',
              backgroundColor: 'rgba(255,255,255,0.2)',
              paddingHorizontal: 12,
              paddingVertical: 6,
              marginTop: 20,
            }}
          >
            <Ic.crown size={14} color="#fff" strokeWidth={1.8} />
            <Text
              style={{
                color: '#fff',
                fontSize: 12,
                fontWeight: '700',
                letterSpacing: 0.3,
              }}
            >
              Japa Premium
            </Text>
          </BlurView>

          {/* H1 — 30 Space Grotesk (semibold), two lines */}
          <Text
            style={{
              fontFamily: EX.font.display.semibold,
              fontSize: 30,
              lineHeight: 32,
              letterSpacing: -0.6,
              color: '#fff',
              marginTop: 14,
            }}
          >
            {'Move faster with\nthe right plan'}
          </Text>

          {/* Sub */}
          <Text
            style={{
              fontSize: 14,
              lineHeight: 21,
              color: 'rgba(255,255,255,0.88)',
              marginTop: 10,
              maxWidth: 290,
            }}
          >
            Unlock agent messaging, document uploads and priority support.
          </Text>
        </LinearGradient>

        {/* ── Plan cards ───────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: EX.space.screenX, paddingTop: 24 }}>
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}

          {/* Paystack footnote — centered, two lines */}
          <Text
            style={{
              textAlign: 'center',
              fontSize: 12,
              lineHeight: 18,
              color: EX.color.muted,
              marginTop: 4,
            }}
          >
            {
              'Upgrades open a secure Paystack checkout.\nCancel anytime — no hidden fees.'
            }
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
