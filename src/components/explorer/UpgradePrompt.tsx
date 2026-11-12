// ─────────────────────────────────────────────────────────────────────────────
// Upgrade prompts — every "this is part of a paid plan" surface in the app.
//
// INTEGRATION: the review (#43), chat (#45), refusal letter (#122) and document
// check (#115) screens each drew their own prompt and each pushed the plans
// screen on its own. They all live here now and all go to ONE destination,
// `PLANS_ROUTE` (the existing plans screen, src/app/subscription.tsx).
//
//   UpgradePanel   the static "what the full review adds" panel (review screen)
//   UpgradePrompt  icon + one line + coral "See plans" (a feature that is off)
//   UpgradeLink    a bare "See plans" text link, for inline notes and errors
//
// No prompt draws locked data or says anything about outcomes: they only say
// what the plan adds.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { EX } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { Card } from '@/components/explorer/primitives';
import { SolidButton } from '@/components/explorer/review/ReviewParts';

/** The one plans screen every upgrade prompt opens. */
export const PLANS_ROUTE = '/subscription' as const;

/** Open the plans screen. Components use this when they have no tracking to add. */
export function useOpenPlans() {
  const router = useRouter();
  return () => router.push(PLANS_ROUTE);
}

/**
 * The locked area on the free tier. STATIC: it states what the full review
 * contains and shows no placeholder rows, blur or counts, so nothing locked is
 * drawn from data. `onPress` lets the review screen record the tap before it
 * opens the plans screen; omit it to go straight there.
 */
export function UpgradePanel({ onPress }: { onPress?: () => void }) {
  const openPlans = useOpenPlans();
  const rows = [
    'Each issue explained, with the published rule it comes from',
    'A check on every document you upload',
    'A new review each time you change something',
  ];
  return (
    <Card style={{ padding: 18, borderRadius: EX.radius.cardLg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
        <LinearGradient
          colors={[EX.color.primary, EX.color.primaryDark]}
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ic.crown size={22} color="#fff" strokeWidth={1.8} />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text
            style={{ fontSize: 16, fontWeight: '700', color: EX.color.ink }}
          >
            Get the full review
          </Text>
          <Text
            style={{ fontSize: 13, color: EX.color.inkMuted, marginTop: 2 }}
          >
            This is the short version. The full review adds:
          </Text>
        </View>
      </View>
      <View style={{ gap: 9, marginTop: 14, marginBottom: 16 }}>
        {rows.map((r) => (
          <View
            key={r}
            style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}
          >
            <Ic.check size={16} color={EX.color.primary} strokeWidth={2.6} />
            <Text
              style={{
                flex: 1,
                fontSize: 14,
                fontWeight: '600',
                color: EX.color.ink2,
              }}
            >
              {r}
            </Text>
          </View>
        ))}
      </View>
      <SolidButton
        label="See plans"
        onPress={onPress ?? openPlans}
        tone="coral"
      />
    </Card>
  );
}

/** Icon + one line + coral action: the empty-state pattern for a feature the plan lacks. */
export function UpgradePrompt({ message }: { message: string }) {
  const openPlans = useOpenPlans();
  return (
    <Card>
      <View style={{ alignItems: 'center', paddingVertical: 28, gap: 12 }}>
        <Ic.crown size={34} color={EX.color.faint} strokeWidth={1.6} />
        <Text
          style={{
            color: EX.color.inkMuted,
            fontSize: 14.5,
            lineHeight: 21,
            textAlign: 'center',
            paddingHorizontal: 12,
          }}
        >
          {message}
        </Text>
        <View style={{ alignSelf: 'stretch', marginTop: 4 }}>
          <SolidButton label="See plans" onPress={openPlans} tone="coral" />
        </View>
      </View>
    </Card>
  );
}

/** A bare "See plans" link, for a note or error line that offers the upgrade. */
export function UpgradeLink({ label = 'See plans' }: { label?: string }) {
  const openPlans = useOpenPlans();
  return (
    <Pressable
      onPress={openPlans}
      hitSlop={6}
      accessibilityRole="link"
      accessibilityLabel={label}
    >
      <Text
        style={{ fontSize: 13, fontWeight: '700', color: EX.color.primary }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
