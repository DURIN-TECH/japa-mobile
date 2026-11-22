// ─────────────────────────────────────────────────────────────────────────────
// Pay screen: "Your consultation moved" (japa#392, design spec on the issue).
//
// Shown when verify answers 409 CONSULTATION_RESCHEDULED: the agent moved the
// booking after its price lock, so the old checkout was retired and the
// payment just made is being refunded in full. It is NEVER a paid state and
// NEVER a failure: no "Payment failed", no "Check again", no old price, no
// countdown. From the top:
//   1. heading "Your consultation moved" (18/700 ink);
//   2. body (15/400 ink-2): we're refunding, it's on its way, pay again;
//   3. "New time" card (WhenRow pattern: 34px cream chip, coral icon,
//      14.5/600 ink) with the date and time on the phone's own clock, no zone label;
//   4. InfoNote: where the refund goes;
//   5. sticky CTA bar: coral "Pay again", no price. While the new checkout
//      is being opened: a white spinner, the button disabled (60%).
//
// `PayAgainEnd` is the end state after "Pay again" when there is nothing to
// pay (already paid, or the booking can no longer be paid): icon, title,
// body, coral "View consultation".
//
// Pure UI: pay.tsx owns the calls and passes the results in.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from './theme';
import { Ic } from './icons';
import { InfoNote, InlineError } from './AccountForm';
import { CoralButton } from './states';

/** Copy (Seli voice, curly apostrophes), exactly as the design spec. */
export const RESCHEDULED_COPY = {
  heading: 'Your consultation moved',
  body: 'Your consultation moved, so we’re refunding your payment in full. Your refund is on its way. Please pay again for the new time.',
  cardLabel: 'New time',
  note: 'Your refund goes back to the card or account you paid with. You’ll see it in Payments.',
  cta: 'Pay again',
  // "Pay again" failed for a reason the server did not put in words.
  payAgainError: 'We couldn’t start your new payment. Try again in a moment.',
  // Back on the normal pay state, above the bar.
  newPriceNote: 'This is the price for the new time.',
  // `requiresPayment: false` on "Pay again".
  paidTitle: 'This consultation is already paid for',
  paidBody: 'You don’t need to pay again.',
  view: 'View consultation',
} as const;

type IconType = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

// ── WhenRow: 34px cream chip with a coral icon + 14.5/600 ink label ─────────
function WhenRow({ icon: IconCmp, label }: { icon: IconType; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: EX.color.cream,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconCmp size={16} color={EX.color.primary} strokeWidth={1.8} />
      </View>
      {/* One line for the date at 320pt; it shrinks a little before wrapping. */}
      <Text
        style={{
          flex: 1,
          fontSize: 14.5,
          fontWeight: '600',
          color: EX.color.ink,
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {label}
      </Text>
    </View>
  );
}

// ── Back header (same as pay.tsx) ────────────────────────────────────────────
function BackBar({ title, onBack }: { title: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top + 10,
        paddingHorizontal: 18,
        paddingBottom: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Pressable
        onPress={onBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: EX.color.line10,
          backgroundColor: EX.color.cardWhite,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ic.chevL size={21} color={EX.color.ink} strokeWidth={1.8} />
      </Pressable>
      <Text style={displayText(24, 'semibold')}>{title}</Text>
    </View>
  );
}

// ── The rescheduled state ────────────────────────────────────────────────────
export function RescheduledPayment({
  when,
  busy,
  error,
  onPayAgain,
  onBack,
}: {
  /** The NEW date and time (zoneTime.ts `bookingWhen`); null = unreadable. */
  when: { date: string; time: string } | null;
  /** True while POST /consultations/:id/checkout runs. */
  busy: boolean;
  /** InlineError above the CTA (backend message, or the fallback). */
  error: string | null;
  onPayAgain: () => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="pay-rescheduled"
      style={{ flex: 1, backgroundColor: EX.color.bg }}
    >
      <BackBar title="Payment" onBack={onBack} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: EX.space.screenX,
          paddingTop: 14,
          // Clear the sticky bar (cta-clear).
          paddingBottom: EX.space.ctaClear,
          gap: 14,
        }}
      >
        {/* 1 · Heading 18/700 ink. */}
        <Text style={{ fontSize: 18, fontWeight: '700', color: EX.color.ink }}>
          {RESCHEDULED_COPY.heading}
        </Text>
        {/* 2 · Body 15/400 ink-2. */}
        <Text
          style={{
            fontSize: 15,
            fontWeight: '400',
            color: EX.color.ink2,
            lineHeight: 21,
          }}
        >
          {RESCHEDULED_COPY.body}
        </Text>
        {/* 3 · "New time" card. */}
        {when ? (
          <View
            style={{
              backgroundColor: EX.color.cardWhite,
              borderRadius: EX.radius.card,
              borderWidth: 1,
              borderColor: EX.color.line06,
              padding: 16,
              gap: 14,
            }}
          >
            <Text
              style={{ fontSize: 12, fontWeight: '600', color: EX.color.muted }}
            >
              {RESCHEDULED_COPY.cardLabel}
            </Text>
            <WhenRow icon={Ic.cal} label={when.date} />
            {when.time ? <WhenRow icon={Ic.clock} label={when.time} /> : null}
          </View>
        ) : null}
        {/* 4 · Where the refund goes. */}
        <InfoNote>{RESCHEDULED_COPY.note}</InfoNote>
      </ScrollView>

      {/* 5 · Sticky CTA: "Pay again", no price block. */}
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
        {error ? (
          <View style={{ marginBottom: 12 }}>
            <InlineError message={error} />
          </View>
        ) : null}
        <Pressable
          testID="pay-again"
          onPress={onPayAgain}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={RESCHEDULED_COPY.cta}
          accessibilityState={{ busy, disabled: busy }}
          style={{
            height: 54,
            borderRadius: EX.radius.button,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: EX.color.primary,
            // Disabled = 60% opacity, never another colour.
            opacity: busy ? 0.6 : 1,
            shadowColor: EX.color.primary,
            shadowOpacity: busy ? 0 : 0.45,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 10 },
            elevation: busy ? 0 : 6,
          }}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            // White on coral is 3.37:1: used bold at 15.5 as the README says.
            <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '700' }}>
              {RESCHEDULED_COPY.cta}
            </Text>
          )}
        </Pressable>
      </BlurView>
    </View>
  );
}

// ── End state after "Pay again" (nothing to pay) ─────────────────────────────
export function PayAgainEnd({
  title,
  body,
  onView,
  onBack,
}: {
  title: string;
  body?: string;
  /** "View consultation" → router.replace('/consultation/<id>'). */
  onView: () => void;
  onBack: () => void;
}) {
  return (
    <View
      testID="pay-again-end"
      style={{ flex: 1, backgroundColor: EX.color.bg }}
    >
      <BackBar title="Payment" onBack={onBack} />
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 40,
          gap: 12,
        }}
      >
        {/* The EmptyState icon look (40, muted, 50%). */}
        <View style={{ opacity: 0.5 }}>
          <Ic.cal size={40} color={EX.color.muted} strokeWidth={1.8} />
        </View>
        <Text
          style={{
            fontSize: 15,
            fontWeight: '600',
            color: EX.color.ink,
            textAlign: 'center',
          }}
        >
          {title}
        </Text>
        {body ? (
          <Text
            style={{
              fontSize: 13,
              lineHeight: 19,
              color: EX.color.inkMuted,
              textAlign: 'center',
            }}
          >
            {body}
          </Text>
        ) : null}
        <CoralButton label={RESCHEDULED_COPY.view} onPress={onView} />
      </View>
    </View>
  );
}
