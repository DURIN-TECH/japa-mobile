// ─────────────────────────────────────────────────────────────────────────────
// Tracker — application journey overview (prototype applications.jsx AppsView).
//
// ScreenHeader ("{n} active applications" / "Your journey" / + button), a summary
// glass band floating over the lead destination's photo ("Closest to the finish
// line"), then an "All applications" section listing every application as an
// AppCard. Each card pushes to /(explorer)/application/${id}.
//
// Ported 1:1 from the prototype's AppsView / AppCard. Every measurement below is
// quoted from applications.jsx — card radius 24, 60px thumb (radius 16), country
// 11.5/600 #8B8499, visa 16/700, "Step X of N" 11.5, 6px Progress, next-step band
// radius 14 (coral tint .07 + zap / cream #FFF6EC + clock), summary band height
// 142 / radius 24 / 105° scrim.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX } from '@/components/explorer/theme';
import { APPS, App, destById } from '@/components/explorer/data';
import { Ic } from '@/components/explorer/icons';
import { Flag, Progress, ScreenHeader, StatusPill } from '@/components/explorer/primitives';

// ── AppCard — one application row (white radius-24 card) ──────────────────────
// Layout mirrors the source button exactly:
//   • outer card: #fff, radius 24, no border, two-layer soft drop shadow
//   • top row  (padding 13, gap 13): 60px thumb (radius 16) + identity + StatusPill
//   • identity: flag 15 (radius 4) + country 11.5/600 #8B8499, visa 16/700 #171326
//   • bottom (padding 0/13/13): "Step X of N" 11.5/600 · pct 11.5/700 #171326,
//     6px Progress, then the next-step band.
function AppCard({ app, onPress }: { app: App; onPress: () => void }) {
  const d = destById(app.destId);
  if (!d) return null;

  const pct = Math.round(app.progress * 100);
  const actionable = app.next.cta != null; // has a CTA → user must act
  const NextIcon = actionable ? Ic.zap : Ic.clock;

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: EX.color.cardWhite,
        borderRadius: 24,
        // Source boxShadow: 0 1px 2px rgba(23,19,38,0.05), 0 18px 30px -24px rgba(23,19,38,0.5).
        // RN allows a single layer — approximate the soft lifted drop below.
        shadowColor: '#171326',
        shadowOpacity: 0.13,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 10 },
        elevation: 3,
      }}
    >
      {/* Top row: thumb + destination identity + status pill (padding 13, gap 13) */}
      <View style={{ flexDirection: 'row', gap: 13, padding: 13 }}>
        {/* 60px destination thumbnail (radius 16) */}
        <View style={{ width: 60, height: 60, borderRadius: 16, overflow: 'hidden', backgroundColor: d.tone }}>
          <Image source={{ uri: d.img }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />
        </View>

        {/* Identity block + pill, top-aligned (source: alignItems flex-start, gap 8) */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flex: 1 }}>
              {/* Flag 15 (radius 4) + country 11.5/600 #8B8499 (gap 6) */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Flag code={d.flag} size={15} radius={4} />
                <Text style={{ fontSize: 11.5, color: EX.color.muted, fontWeight: '600' }} numberOfLines={1}>
                  {d.country}
                </Text>
              </View>
              {/* Visa 16/700 #171326 (letterSpacing -0.01em), marginTop 2 */}
              <Text style={{ fontSize: 16, fontWeight: '700', color: EX.color.ink, letterSpacing: -0.16, marginTop: 2 }} numberOfLines={1}>
                {d.visa}
              </Text>
            </View>
            <StatusPill status={app.status} small />
          </View>
        </View>
      </View>

      {/* Bottom section (padding: 0 13 13) */}
      <View style={{ paddingHorizontal: 13, paddingBottom: 13 }}>
        {/* Step count + percent (marginBottom 6) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontSize: 11.5, color: EX.color.muted, fontWeight: '600' }}>
            Step {app.step} of {app.steps.length}
          </Text>
          <Text style={{ fontSize: 11.5, color: EX.color.ink, fontWeight: '700' }}>{pct}%</Text>
        </View>

        {/* 6px Progress (track rgba(23,19,38,0.08), fill coral) */}
        <Progress value={app.progress} height={6} />

        {/* Next-step band: radius 14, marginTop 12, padding 10/12, gap 9.
            actionable → coral tint .07 + zap (coral) + ink text + coral chevron;
            waiting    → cream #FFF6EC + clock (muted) + inkMuted text, no chevron. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 9,
            marginTop: 12,
            borderRadius: 14,
            paddingVertical: 10,
            paddingHorizontal: 12,
            backgroundColor: actionable ? EX.color.primaryTint07 : EX.color.cream,
          }}
        >
          <NextIcon size={16} color={actionable ? EX.color.primary : EX.color.muted} strokeWidth={1.8} />
          <Text
            style={{ flex: 1, fontSize: 12.5, fontWeight: '600', lineHeight: 16.25, color: actionable ? EX.color.ink : EX.color.inkMuted }}
            numberOfLines={2}
          >
            {app.next.label}
          </Text>
          {actionable ? <Ic.chevR size={16} color={EX.color.primary} strokeWidth={1.8} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function AppsView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Source uses APPS[0] as the lead (NOT sorted by progress).
  const lead = APPS[0];
  const leadDest = destById(lead?.destId);
  const leadPct = lead ? Math.round(lead.progress * 100) : 0;

  // ── Status filter chips ────────────────────────────────────────────────────
  const [filter, setFilter] = useState<'all' | 'progress' | 'action' | 'done'>('all');
  const filtered = APPS.filter((a) =>
    filter === 'all'
      ? true
      : filter === 'action'
        ? !!a.next.cta
        : filter === 'done'
          ? a.status === 'approved'
          : a.status !== 'approved',
  );
  const FILTERS: { key: typeof filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'progress', label: 'In progress' },
    { key: 'action', label: 'Action needed' },
    { key: 'done', label: 'Completed' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: EX.space.tabClear }}>
        {/* ── Header: count eyebrow · title · new-application button ─────────── */}
        <ScreenHeader
          topInset={insets.top}
          eyebrow={`${APPS.length} active applications`}
          title="Your journey"
          right={
            <Pressable
              onPress={() => router.push('/(explorer)/(tabs)/explore')}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                borderWidth: 1,
                borderColor: EX.color.line10,
                backgroundColor: EX.color.cardWhite,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ic.plus size={20} color={EX.color.ink} strokeWidth={1.8} />
            </Pressable>
          }
        />

        {/* ── Summary band over the lead destination (source: 105° scrim, height 142) ── */}
        {lead && leadDest ? (
          <Pressable
            onPress={() => router.push(`/(explorer)/application/${lead.id}`)}
            style={{
              marginTop: 10,
              marginHorizontal: EX.space.screenX,
              marginBottom: 4,
              height: 142,
              borderRadius: 24,
              overflow: 'hidden',
              backgroundColor: leadDest.tone,
            }}
          >
            <Image source={{ uri: leadDest.img }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} />
            {/* 105° scrim: rgba(12,10,8, .74 → .32@60% → .12) */}
            <LinearGradient
              colors={['rgba(12,10,8,0.74)', 'rgba(12,10,8,0.32)', 'rgba(12,10,8,0.12)']}
              locations={[0, 0.6, 1]}
              start={{ x: 0, y: 0.37 }}
              end={{ x: 1, y: 0.63 }}
              style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            />
            {/* Content: padding 16, column, space-between */}
            <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.82)', fontWeight: '600' }}>Closest to the finish line</Text>
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#fff', marginTop: 2 }} numberOfLines={1}>
                  {leadDest.country} · {leadDest.visa}
                </Text>
              </View>
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.85)', fontWeight: '600' }}>Under review</Text>
                  <Text style={{ fontSize: 11.5, color: '#fff', fontWeight: '700' }}>{leadPct}%</Text>
                </View>
                {/* 6px white progress on a 25%-white track */}
                <Progress value={lead.progress} height={6} color="#fff" track="rgba(255,255,255,0.25)" />
              </View>
            </View>
          </Pressable>
        ) : null}

        {/* ── All applications (cards gap 13, bottom clears tab bar) ─────────── */}
        <View style={{ paddingHorizontal: EX.space.screenX }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: EX.color.ink, letterSpacing: -0.18, marginTop: 26, marginBottom: 12, marginHorizontal: 2 }}>
            All applications
          </Text>

          {/* Status filter chips */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14, marginHorizontal: 2 }}>
            {FILTERS.map((f) => {
              const on = filter === f.key;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  style={{
                    borderWidth: 1,
                    borderColor: on ? EX.color.ink : EX.color.line12,
                    backgroundColor: on ? EX.color.ink : EX.color.cardWhite,
                    borderRadius: 999,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: on ? EX.color.bg : EX.color.ink2 }}>{f.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {filtered.length > 0 ? (
            <View style={{ gap: 13 }}>
              {filtered.map((app) => (
                <AppCard key={app.id} app={app} onPress={() => router.push(`/(explorer)/application/${app.id}`)} />
              ))}
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 44 }}>
              <Ic.layers size={38} color={EX.color.muted} strokeWidth={1.5} style={{ opacity: 0.5, marginBottom: 12 }} />
              <Text style={{ fontSize: 14, color: EX.color.muted }}>No {FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} applications</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
