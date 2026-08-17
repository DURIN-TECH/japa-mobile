// ─────────────────────────────────────────────────────────────────────────────
// Confirmation (prototype booking flow — step 3 of 3, flow terminus).
//
// Reads the same params as /pay plus the chosen `method`. Centered
// success mark, headline + reassurance subtitle, a details card recapping the
// booking, and two CTAs: coral "View my consultations" (→ consultations) and an
// outline "Back to home" (→ home tab). A small top-right close (X) also returns
// home. No back header — this ends the flow, so both routes use router.replace.
//
// Design system: coral/cream Explorer tokens (EX), Space Grotesk display font.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, parseISO } from 'date-fns';
import { EX, displayText } from '@/components/explorer/theme';
import { NAIRA } from '@/components/explorer/data';
import { Ic } from '@/components/explorer/icons';

// Lucide-style icon component signature (size/color/strokeWidth props).
type IconType = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

// ── DetailRow — icon + label row inside the details card ──────────────────────
function DetailRow({
  icon: IconCmp,
  label,
}: {
  icon: IconType;
  label: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
      <IconCmp size={17} color={EX.color.primary} strokeWidth={1.8} />
      <Text
        style={{
          flex: 1,
          fontSize: 14,
          fontWeight: '600',
          color: EX.color.ink2,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

export default function ConfirmationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Same param shape as the pay screen, plus `method`.
  const { type, dateIso, time, topic, mode, dur, fee, method } =
    useLocalSearchParams<{
      type?: string;
      agentId: string;
      dateIso: string;
      time: string;
      topic: string;
      mode: string;
      dur: string;
      fee: string;
      method: string;
    }>();

  const isApp = type === 'application';
  const feeNum = Number(fee) || 0;
  const isVideo = (mode ?? '').toLowerCase().includes('video');
  const dateLabel = dateIso
    ? format(parseISO(dateIso), 'EEEE, MMMM d, yyyy')
    : '';

  const goHome = () => router.replace('/(tabs)/home');

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      {/* ── Top-right close (X → home) ───────────────────────────────────────── */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 8,
          right: 16,
          zIndex: 10,
        }}
      >
        <Pressable
          onPress={goHome}
          hitSlop={8}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: EX.color.line10,
            backgroundColor: '#fff',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ic.x size={19} color={EX.color.ink} strokeWidth={1.8} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: EX.space.screenX,
          paddingTop: insets.top + 60,
          paddingBottom: Math.max(insets.bottom, 24) + 12,
        }}
      >
        {/* ── Success mark — 72px teal→coral check circle ────────────────────── */}
        <LinearGradient
          colors={[EX.color.teal, EX.color.primary]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: EX.color.primary,
            shadowOpacity: 0.4,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 12 },
            elevation: 6,
          }}
        >
          <Ic.check size={34} color="#fff" strokeWidth={2.4} />
        </LinearGradient>

        {/* ── Headline + reassurance subtitle ────────────────────────────────── */}
        <Text
          style={[
            displayText(26, 'bold'),
            { marginTop: 22, textAlign: 'center' },
          ]}
        >
          {isApp ? 'Payment complete!' : 'Consultation booked!'}
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
          {isApp
            ? 'Your payment was received — your agent will keep your application moving.'
            : 'We’ve emailed you the details and a calendar invite.'}
        </Text>

        {/* ── Details card ───────────────────────────────────────────────────── */}
        <View
          style={{
            alignSelf: 'stretch',
            backgroundColor: EX.color.cardWhite,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: EX.color.line08,
            padding: 16,
            gap: 13,
            marginTop: 28,
            shadowColor: '#171326',
            shadowOpacity: 0.04,
            shadowRadius: 2,
            shadowOffset: { width: 0, height: 1 },
            elevation: 1,
          }}
        >
          {isApp ? (
            <DetailRow icon={Ic.cards} label={topic} />
          ) : (
            <>
              <DetailRow icon={Ic.cal} label={dateLabel} />
              <DetailRow icon={Ic.clock} label={`${time} · ${dur}`} />
              <DetailRow icon={isVideo ? Ic.video : Ic.phone} label={mode} />
            </>
          )}
          <DetailRow
            icon={Ic.check2}
            label={`Paid · ${NAIRA(feeNum)} · ${method}`}
          />
        </View>

        {/* ── CTAs ───────────────────────────────────────────────────────────── */}
        <View style={{ alignSelf: 'stretch', gap: 11, marginTop: 28 }}>
          {/* Primary — consultations, or applications for an app payment (coral, replace) */}
          <Pressable
            onPress={() =>
              router.replace(isApp ? '/(tabs)/tracker' : '/consultations')
            }
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
              {isApp ? 'View my applications' : 'View my consultations'}
            </Text>
          </Pressable>

          {/* Secondary — Back to home (outline, replace) */}
          <Pressable
            onPress={goHome}
            style={{
              height: 54,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#fff',
              borderWidth: 1,
              borderColor: EX.color.line12,
            }}
          >
            <Text
              style={{ color: EX.color.ink, fontSize: 15.5, fontWeight: '700' }}
            >
              Back to home
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
