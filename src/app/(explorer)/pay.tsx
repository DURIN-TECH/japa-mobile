// ─────────────────────────────────────────────────────────────────────────────
// Payment (prototype booking flow — step 2 of 3).
//
// Reads the booking params pushed from /(explorer)/book/[agentId]. Shows a
// booking summary card, a selectable payment-method list (Card / Bank transfer /
// Paystack), and a price summary. The sticky glass CTA "Pay {fee}" is disabled
// until a method is chosen; on press it shows a brief processing spinner (~700ms)
// then pushes → /(explorer)/confirmation with the full param contract + method.
//
// Design system: coral/cream Explorer tokens (EX), Space Grotesk display font.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
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

// ── Payment methods (label + icon; `key` is passed through as `method`) ───────
const METHODS: { key: string; label: string; icon: IconType; hint: string }[] =
  [
    {
      key: 'Card',
      label: 'Card',
      icon: Ic.cards,
      hint: 'Visa · Mastercard · Verve',
    },
    {
      key: 'Bank transfer',
      label: 'Bank transfer',
      icon: Ic.brief,
      hint: 'Pay from any Nigerian bank',
    },
    {
      key: 'Paystack',
      label: 'Paystack',
      icon: Ic.zap,
      hint: 'Fast, secure checkout',
    },
  ];

// ── SummaryRow — icon + label row inside the booking summary card ─────────────
function SummaryRow({
  icon: IconCmp,
  label,
}: {
  icon: IconType;
  label: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
      {/* Bare coral icon (matches detail-screen fact rows). */}
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

export default function PayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // All nav params arrive as strings (Expo Router serialises them).
  const { type, agentId, dateIso, time, topic, mode, dur, fee } =
    useLocalSearchParams<{
      type?: string;
      agentId: string;
      dateIso: string;
      time: string;
      topic: string;
      mode: string;
      dur: string;
      fee: string;
    }>();

  const [method, setMethod] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // `application` = paying an agent-raised payment request (no date/time/mode);
  // `consultation` (default) = the booking flow with a scheduled slot.
  const isApp = type === 'application';
  const feeNum = Number(fee) || 0;
  const isVideo = (mode ?? '').toLowerCase().includes('video');
  const dateLabel = dateIso
    ? format(parseISO(dateIso), 'EEEE, MMMM d, yyyy')
    : '';

  const onPay = () => {
    if (!method || processing) return;
    // Brief simulated processing state before advancing to confirmation.
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      router.push({
        pathname: '/(explorer)/confirmation',
        params: {
          type: type ?? 'consultation',
          agentId,
          dateIso,
          time,
          topic,
          mode,
          dur,
          fee,
          method,
        },
      });
    }, 700);
  };

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      {/* ── Back header ─────────────────────────────────────────────────────── */}
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
        <Text style={displayText(24, 'semibold')}>Payment</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: EX.space.screenX,
          paddingTop: 14,
          paddingBottom: EX.space.ctaClear,
        }}
      >
        {/* ── Booking summary card ─────────────────────────────────────────── */}
        <View
          style={{
            backgroundColor: EX.color.cardWhite,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: EX.color.line08,
            padding: 16,
            gap: 13,
            shadowColor: '#171326',
            shadowOpacity: 0.04,
            shadowRadius: 2,
            shadowOffset: { width: 0, height: 1 },
            elevation: 1,
          }}
        >
          {isApp ? (
            <>
              <SummaryRow icon={Ic.cards} label={topic} />
              <SummaryRow icon={Ic.zap} label="One-time payment" />
            </>
          ) : (
            <>
              <SummaryRow icon={Ic.cal} label={dateLabel} />
              <SummaryRow icon={Ic.clock} label={`${time} · ${dur}`} />
              <SummaryRow icon={isVideo ? Ic.video : Ic.phone} label={mode} />
              <SummaryRow icon={Ic.msg} label={topic} />
            </>
          )}
        </View>

        {/* ── Payment method ───────────────────────────────────────────────── */}
        <Text
          style={{
            fontSize: 16.5,
            fontWeight: '700',
            color: EX.color.ink,
            letterSpacing: -0.18,
            marginTop: 26,
            marginBottom: 12,
          }}
        >
          Payment method
        </Text>
        <View style={{ gap: 10 }}>
          {METHODS.map((m) => {
            const on = method === m.key;
            const Icon = m.icon;
            return (
              <Pressable
                key={m.key}
                onPress={() => setMethod(m.key)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 13,
                  backgroundColor: on
                    ? EX.color.primaryTint05
                    : EX.color.cardWhite,
                  borderRadius: 18,
                  borderWidth: on ? 1.5 : 1,
                  borderColor: on ? EX.color.primary : EX.color.line10,
                  padding: 14,
                }}
              >
                {/* Method icon in a cream square. */}
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
                  <Icon size={19} color={EX.color.primary} strokeWidth={1.8} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      fontSize: 14.5,
                      fontWeight: '700',
                      color: EX.color.ink,
                    }}
                    numberOfLines={1}
                  >
                    {m.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: EX.color.muted,
                      marginTop: 1,
                    }}
                    numberOfLines={1}
                  >
                    {m.hint}
                  </Text>
                </View>
                {/* Radio — coral filled dot when selected. */}
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: 2,
                    borderColor: on ? EX.color.primary : EX.color.line16,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {on ? (
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
          })}
        </View>

        {/* ── Price summary card ───────────────────────────────────────────── */}
        <View
          style={{
            backgroundColor: EX.color.cardWhite,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: EX.color.line08,
            padding: 16,
            marginTop: 22,
            shadowColor: '#171326',
            shadowOpacity: 0.04,
            shadowRadius: 2,
            shadowOffset: { width: 0, height: 1 },
            elevation: 1,
          }}
        >
          {/* Consultation fee */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 14, color: EX.color.inkMuted }}>
              {isApp ? 'Amount' : 'Consultation fee'}
            </Text>
            <Text
              style={{ fontSize: 14, fontWeight: '600', color: EX.color.ink }}
            >
              {NAIRA(feeNum)}
            </Text>
          </View>
          {/* Service fee (₦0) */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 10,
            }}
          >
            <Text style={{ fontSize: 14, color: EX.color.inkMuted }}>
              Service fee
            </Text>
            <Text
              style={{ fontSize: 14, fontWeight: '600', color: EX.color.ink }}
            >
              ₦0
            </Text>
          </View>
          {/* Divider */}
          <View
            style={{
              height: 1,
              backgroundColor: EX.color.line08,
              marginVertical: 13,
            }}
          />
          {/* Total (bold) */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text
              style={{ fontSize: 15.5, fontWeight: '700', color: EX.color.ink }}
            >
              Total
            </Text>
            <Text
              style={{
                fontSize: 19,
                fontWeight: '700',
                color: EX.color.ink,
                letterSpacing: -0.2,
              }}
            >
              {NAIRA(feeNum)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ── Sticky glass CTA — Pay {fee} ────────────────────────────────────── */}
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
          onPress={onPay}
          disabled={!method || processing}
          style={{
            height: 54,
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: method
              ? EX.color.primary
              : 'rgba(244,81,108,0.35)',
            shadowColor: EX.color.primary,
            shadowOpacity: method ? 0.45 : 0,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 10 },
            elevation: method ? 6 : 0,
          }}
        >
          {processing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '700' }}>
              Pay {NAIRA(feeNum)}
            </Text>
          )}
        </Pressable>
      </BlurView>
    </View>
  );
}
