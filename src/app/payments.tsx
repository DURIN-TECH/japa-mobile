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
// japa#145: live only. Transactions from GET /transactions; open payment
// requests from GET /payment-requests (shown as their own block, hidden when
// there are none). Display colours stay static (`PAY_STATUS`, `NAIRA`).
// States: both loading → coral spinner; both empty → "No payments yet"; if
// only one query fails, that block shows its own section error + retry.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, EXShadow, displayText } from '@/components/explorer/theme';
import { PAY_STATUS, NAIRA } from '@/components/explorer/content';
import type { Payment } from '@/types/explorer.type';
import { usePaymentRequests } from '@/hooks/usePaymentRequests';
import { CATEGORY_LABELS } from '@/types/payment-requests.type';
import { fmtDate } from '@/components/explorer/liveDate';
import {
  StateEmpty,
  StateError,
  StateLoading,
  loadErrorCopy,
} from '@/components/explorer/states';
import { Ic } from '@/components/explorer/icons';
import { Pill } from '@/components/explorer/primitives';
// Live data: GET /transactions → mapped onto the `Payment` row contract.
import { useTransactions } from '@/hooks/useTransactions';
import { mapTransaction } from '@/components/explorer/liveTransactions';

// ── PaymentRow — one transaction ─────────────────────────────────────────────
// 40px cream chip (coral card icon) + title/sub on the left; on the right a
// stacked amount (15/700), a small status Pill, and the date (11.5 muted).
// Refunded amounts read muted with a strikethrough-feel.
function PaymentRow({ p, onPress }: { p: Payment; onPress?: () => void }) {
  const s = PAY_STATUS[p.status];
  const refunded = p.status === 'refunded';

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
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
    </Pressable>
  );
}

// Section heading (same type ramp as SectionTitle, compact spacing here).
function BlockTitle({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontSize: 16,
        fontWeight: '700',
        color: EX.color.ink,
        marginTop: 8,
        marginHorizontal: 2,
      }}
    >
      {children}
    </Text>
  );
}

export default function PaymentsView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── Live transactions (GET /transactions) ────────────────────────────────
  const txQ = useTransactions();
  const rows = React.useMemo(
    () => (txQ.data ?? []).map(mapTransaction),
    [txQ.data],
  );

  // ── Open payment requests (GET /payment-requests?role=client) ───────────
  // Only requests still awaiting the client; amounts are kobo → naira. Each
  // row opens its application, where it can be approved or declined.
  const prQ = usePaymentRequests();
  const requests = React.useMemo(
    () =>
      (prQ.data ?? [])
        .filter((r) => r.status === 'pending')
        .map((r) => ({
          appId: r.applicationId,
          row: {
            id: r.id,
            title: CATEGORY_LABELS[r.category] ?? 'Payment request',
            sub: r.description || 'Requested by your agent',
            amount: Math.round(r.amount / 100),
            date: r.expiresAt ? `Due ${fmtDate(r.expiresAt, 'MMM d')}` : '',
            status: 'pending' as const,
            method: '—',
          } satisfies Payment,
        })),
    [prQ.data],
  );

  // Per-block state: a block is "settled" once its query answered (data) or
  // failed with nothing cached.
  const txLoading = txQ.isLoading && !txQ.data;
  const prLoading = prQ.isLoading && !prQ.data;
  const txError = txQ.isError && !txQ.data;
  const prError = prQ.isError && !prQ.data;
  const loading = txLoading || prLoading;
  const firstRun =
    !loading && !txError && !prError && rows.length === 0 && !requests.length;

  // ── Total paid — sum of every `paid` transaction in the active rows ───────
  const totalPaid = rows
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);

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

      {/* ── First load: coral spinner; nothing at all: empty state ──────── */}
      {loading ? <StateLoading /> : null}
      {firstRun ? (
        <StateEmpty
          // Spec proposed a wallet icon; Ic has none, so Ic.cards (allowed).
          icon={Ic.cards}
          title="No payments yet"
          body="Consultation and agent fees you pay will show here."
        />
      ) : null}

      {!loading && !firstRun ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* ── Payment requests awaiting you (hidden when none) ──────────────── */}
          {prError ? (
            <View style={{ paddingHorizontal: 22, paddingTop: 12 }}>
              <StateError
                section
                message={loadErrorCopy('your payment requests')}
                onRetry={() => prQ.refetch()}
                retrying={prQ.isRefetching}
              />
            </View>
          ) : requests.length ? (
            <View style={{ paddingHorizontal: 22, paddingTop: 12, gap: 10 }}>
              <BlockTitle>Payment requests</BlockTitle>
              {requests.map(({ appId, row }) => (
                <PaymentRow
                  key={row.id}
                  p={row}
                  onPress={() => router.push(`/application/${appId}`)}
                />
              ))}
            </View>
          ) : null}

          {txError ? (
            <View style={{ paddingHorizontal: 22, paddingTop: 12 }}>
              <StateError
                section
                message={loadErrorCopy('your payments')}
                onRetry={() => txQ.refetch()}
                retrying={txQ.isRefetching}
              />
            </View>
          ) : rows.length ? (
            <>
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
                    style={[
                      displayText(30, 'bold'),
                      { color: '#fff', marginTop: 6 },
                    ]}
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
                    {rows.length} transaction{rows.length === 1 ? '' : 's'}
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
                {rows.map((p) => (
                  <PaymentRow key={p.id} p={p} />
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>
      ) : null}
    </View>
  );
}
