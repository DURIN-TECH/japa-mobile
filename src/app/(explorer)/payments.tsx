// ─────────────────────────────────────────────────────────────────────────────
// Payments (profile → payments secondary destination).
//
// A transaction history for the applicant. Structure:
//   • standard 40px back header at insets.top + 10
//   • a coral-gradient "Total paid" hero card — the summed amount of every `paid`
//     transaction rendered big in the display font, with a transaction count
//   • a list of white rows (radius 18): cream card-icon chip + title/sub on the
//     left, and a right column with the amount, a status Pill and the date.
//
// Data + colours come from the static contract: `PAYMENTS`, `PAY_STATUS`, `NAIRA`.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, EXShadow, displayText } from '@/components/explorer/theme';
import {
  PAYMENTS,
  PAY_STATUS,
  NAIRA,
  type Payment,
} from '@/components/explorer/data';
import { Ic } from '@/components/explorer/icons';
import { Pill } from '@/components/explorer/primitives';

// ── PaymentRow — one transaction ─────────────────────────────────────────────
// 40px cream chip (coral card icon) + title/sub on the left; on the right a
// stacked amount (15/700), a small status Pill, and the date (11.5 muted).
// Refunded amounts read muted with a strikethrough-feel.
function PaymentRow({ p }: { p: Payment }) {
  const s = PAY_STATUS[p.status];
  const refunded = p.status === 'refunded';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#fff',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: EX.color.line06,
        paddingHorizontal: 14,
        paddingVertical: 14,
        shadowColor: '#171326',
        shadowOpacity: 0.04,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
    >
      {/* 40px cream chip with coral card icon */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: EX.color.cream,
        }}
      >
        <Ic.cards size={19} color={EX.color.primary} strokeWidth={1.8} />
      </View>

      {/* Title + sub */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ fontSize: 15, fontWeight: '600', color: EX.color.ink }}
          numberOfLines={1}
        >
          {p.title}
        </Text>
        <Text
          style={{ fontSize: 12.5, color: EX.color.muted, marginTop: 2 }}
          numberOfLines={1}
        >
          {p.sub}
        </Text>
      </View>

      {/* Right column: amount · status pill · date */}
      <View style={{ alignItems: 'flex-end', gap: 5 }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: '700',
            // Refunded reads muted, with a struck-through feel.
            color: refunded ? EX.color.muted : EX.color.ink,
            textDecorationLine: refunded ? 'line-through' : 'none',
          }}
        >
          {NAIRA(p.amount)}
        </Text>
        <Pill label={s.label} fg={s.fg} bg={s.bg} small />
        <Text style={{ fontSize: 11.5, color: EX.color.muted }}>{p.date}</Text>
      </View>
    </View>
  );
}

export default function PaymentsView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── Total paid — sum of every `paid` transaction ──────────────────────────
  const totalPaid = PAYMENTS.filter((p) => p.status === 'paid').reduce(
    (sum, p) => sum + p.amount,
    0,
  );

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      {/* ── Back header ─────────────────────────────────────────────────────── */}
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingHorizontal: 18,
          paddingBottom: 6,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
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
          <View>
            <Text style={displayText(24, 'semibold')}>Payments</Text>
            <Text
              style={{ fontSize: 12.5, color: EX.color.muted, marginTop: 2 }}
            >
              Your transaction history
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ── Coral-gradient "Total paid" hero card ─────────────────────────── */}
        <View style={{ paddingHorizontal: 22, paddingTop: 12 }}>
          <LinearGradient
            colors={[EX.color.primary, EX.color.primaryDark]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={{
              borderRadius: EX.radius.cardLg, // 24
              paddingHorizontal: 20,
              paddingVertical: 22,
              ...EXShadow.primaryBtn,
            }}
          >
            <Text
              style={{
                fontSize: 12.5,
                fontWeight: '700',
                color: 'rgba(255,255,255,0.86)',
                letterSpacing: 0.2,
              }}
            >
              Total paid
            </Text>
            <Text
              style={[displayText(30, 'bold'), { color: '#fff', marginTop: 6 }]}
            >
              {NAIRA(totalPaid)}
            </Text>
            <Text
              style={{
                fontSize: 12.5,
                color: 'rgba(255,255,255,0.82)',
                marginTop: 6,
                fontWeight: '500',
              }}
            >
              {PAYMENTS.length} transactions
            </Text>
          </LinearGradient>
        </View>

        {/* ── Transaction list ──────────────────────────────────────────────── */}
        <View
          style={{
            paddingHorizontal: 22,
            paddingTop: 16,
            gap: 10,
          }}
        >
          {PAYMENTS.map((p) => (
            <PaymentRow key={p.id} p={p} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
