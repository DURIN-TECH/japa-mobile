// ─────────────────────────────────────────────────────────────────────────────
// Visa breakdown (full visa detail).
//
// A leaner sibling of destination/[id].tsx: a COMPACT FIXED photo header (~200,
// NOT parallax — a plain image behind a rounded content sheet) + rounded sheet
// + sticky glass CTA. The sheet holds a stat strip (approval / processing /
// applicants), japa#255's Cost & timeline / Eligibility cards, the requirements
// checklist, the Official source link
// and a dark "boost your chances" nudge toward a specialist.
//
// Style, sizes, radii and colours are lifted directly from destination/[id].tsx
// so the two screens read as one system.
//
// japa#106: an agency-only visa 404s for anyone without a case at its agency
// (#102). The 404 shows the not-found EmptyState, with the same copy for an
// unknown and a hidden visa (it must not confirm the visa exists). Other
// load failures show an InlineError with "Try again".
//
// japa#145: live data only. The demo DESTS branch, the static REQS fallback
// and the static "Common reasons for refusal" list (REJECTIONS, no backend
// source) are gone. No published requirements → "No requirements published
// yet"; no top agent → the specialist nudge is hidden; a failed "Start
// application" shows an InlineError above the CTA instead of a demo checklist.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX } from '@/components/explorer/theme';
import type { Dest, Req } from '@/types/explorer.type';
import {
  mapRequirements,
  visaTypeToDest,
} from '@/components/explorer/liveExplore';
import { mapAgent } from '@/components/explorer/liveAgents';
import { useCountriesWithVisas, useVisaType } from '@/hooks/useVisaTypes';
import { useTopAgents } from '@/hooks/useAgents';
import { useStartApplication } from '@/hooks/useStartApplication';
import {
  StartApplicationBar,
  startBarExtraHeight,
} from '@/components/explorer/StartApplicationBar';
import { Ic } from '@/components/explorer/icons';
import { CenteredState } from '@/components/explorer/CenteredState';
import { isNotFoundError } from '@/hooks/queryErrors';
import { StateEmpty } from '@/components/explorer/states';
import { Flag, GlassButton, Scrim } from '@/components/explorer/primitives';
import {
  CostTimelineSection,
  EligibilitySection,
  OfficialSourceSection,
} from '@/components/explorer/VisaBreakdownSections';

// Compact fixed header height (destination hero is 376; this breakdown uses ~200).
const HERO = 200;

// ── Stat strip cell (matches destination detail's StatCell) ──────────────────
function StatCell({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: string;
}) {
  return (
    <View
      style={{ flex: 1, alignItems: 'center', gap: 3, paddingHorizontal: 4 }}
    >
      <Text
        style={{
          fontSize: 16.5,
          fontWeight: '700',
          color: accent ?? EX.color.ink,
          letterSpacing: -0.16,
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text
        style={{ fontSize: 11, color: EX.color.muted, fontWeight: '500' }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

export default function VisaBreakdown() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, code } = useLocalSearchParams<{ id: string; code?: string }>();

  // Tiles (reached from the Explore grid via destination/[id]) carry a
  // country `code`; the visa is fetched by (countryCode, visaId), mirroring
  // destination/[id].tsx. No code → the query stays off → not-found.
  const liveQ = useVisaType(code ?? '', id ?? '');
  const { data: countries } = useCountriesWithVisas();

  // Effective destination, live-mapped from the visa type.
  const d: Dest | undefined = useMemo(() => {
    const vt = liveQ.data?.visaType;
    if (!vt) return undefined;
    const name = countries?.find(
      (c) => c.code.toLowerCase() === (code ?? '').toLowerCase(),
    )?.name;
    return visaTypeToDest(vt, name);
  }, [liveQ.data, countries, code]);

  // Requirements checklist — the live requirements only ([] → empty state).
  const reqs: Req[] = useMemo(
    () => mapRequirements(liveQ.data?.requirements ?? []),
    [liveQ.data],
  );

  // "Boost your chances" nudge — the real #1 top agent (GET /agents/top).
  // None (or not loaded) → the nudge section is hidden, never a named demo.
  const topAgentsQ = useTopAgents(1);
  const specialist = useMemo(
    () => (topAgentsQ.data ?? []).map(mapAgent)[0] ?? null,
    [topAgentsQ.data],
  );

  // Create-application (declared before any early return to keep hook order
  // stable). For a live visa the "Start application" CTA mints a real
  // Application, then opens self-service with that id. A failure shows an
  // InlineError above the CTA (the CTA is the retry).
  // japa#174: shared start flow (402 → upgrade, 404/403 → unavailable, other → retry).
  const startApp = useStartApplication(
    d?.id ?? id ?? '',
    code ?? d?.flag ?? '',
  );

  // Live fetch still in flight.
  if (liveQ.isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: EX.color.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={EX.color.primary} />
      </View>
    );
  }

  // Load failure that isn't a 404 (offline, server error), nothing cached.
  if (liveQ.isError && !liveQ.data && !isNotFoundError(liveQ.error)) {
    return (
      <CenteredState
        icon={Ic.globe}
        title="We couldn’t load this visa"
        errorMessage="Check your connection and try again."
        onRetry={() => liveQ.refetch()}
        retrying={liveQ.isRefetching}
        actionLabel="Back to explore"
        onAction={() => router.replace('/(tabs)/explore')}
      />
    );
  }

  // Not found: unknown id, or an agency-only visa this user can't reach.
  if (!d) {
    return (
      <CenteredState
        icon={Ic.globe}
        title="We couldn’t find this visa"
        body="It may have been removed, or it’s only offered through an agency you’re not working with."
        actionLabel="Back to explore"
        onAction={() => router.replace('/(tabs)/explore')}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      {/* ── COMPACT FIXED HEADER (200, NOT parallax) — plain image + scrim ───── */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: HERO,
          overflow: 'hidden',
          backgroundColor: d.tone,
        }}
      >
        <Image
          source={{ uri: d.img }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={200}
        />
        <Scrim variant="detail" />
        {/* Caption: flag + country · city over the visa title (28 Space Grotesk) */}
        <View style={{ position: 'absolute', left: 22, right: 22, bottom: 44 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <Flag code={d.flag} size={20} radius={5} />
            <Text
              style={{
                color: '#fff',
                fontSize: 13,
                fontWeight: '600',
                opacity: 0.94,
                letterSpacing: 0.2,
              }}
              numberOfLines={1}
            >
              {d.country} · {d.city}
            </Text>
          </View>
          <Text
            style={{
              color: '#fff',
              fontFamily: EX.font.display.semibold,
              fontSize: 28,
              lineHeight: 32,
              letterSpacing: -0.28,
              textShadowColor: 'rgba(0,0,0,0.35)',
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 16,
            }}
          >
            {d.visa}
          </Text>
        </View>
      </View>

      {/* Top glass control (back) at insets.top + 6, matching detail screens */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 6,
          left: 0,
          right: 0,
          zIndex: 50,
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: 18,
        }}
      >
        <GlassButton icon={Ic.chevL} onPress={() => router.back()} />
      </View>

      {/* ── Scrolling content sheet (plain ScrollView — no parallax) ─────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 0 }}
      >
        {/* spacer revealing the fixed header (HERO - 28, sheet overlaps by 28) */}
        <View style={{ height: HERO - 28 }} pointerEvents="none" />

        <View
          style={{
            backgroundColor: EX.color.bg,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            minHeight: 560,
            paddingTop: 8,
            paddingHorizontal: 20,
            paddingBottom:
              EX.space.ctaClear + startBarExtraHeight(startApp.failure),
            shadowColor: '#171326',
            shadowOpacity: 0.28,
            shadowRadius: 30,
            shadowOffset: { width: 0, height: -8 },
          }}
        >
          {/* Grab handle */}
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 99,
              backgroundColor: EX.color.line16,
              alignSelf: 'center',
              marginBottom: 16,
            }}
          />

          {/* ── Stat strip: Approval (teal) · Processing · Applicants ────────── */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#fff',
              borderWidth: 1,
              borderColor: EX.color.line08,
              borderRadius: 20,
              paddingVertical: 16,
              paddingHorizontal: 8,
              shadowColor: '#171326',
              shadowOpacity: 0.04,
              shadowRadius: 2,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
            }}
          >
            <StatCell
              value={d.approval}
              label="Approval"
              accent={EX.color.tealDeep}
            />
            <View
              style={{ width: 1, height: 30, backgroundColor: EX.color.line08 }}
            />
            <StatCell value={d.processing} label="Processing" />
            <View
              style={{ width: 1, height: 30, backgroundColor: EX.color.line08 }}
            />
            <StatCell value={d.applied.toLocaleString()} label="Applicants" />
          </View>

          {/* Blurb */}
          <Text
            style={{
              fontSize: 14.5,
              lineHeight: 23,
              color: EX.color.ink2,
              marginTop: 18,
              marginHorizontal: 2,
            }}
          >
            {d.blurb}
          </Text>

          {/* japa#255: real VisaType data. Each section hides itself when its
              fields are empty and owns its own top margin (no gap). */}
          {liveQ.data?.visaType ? (
            <>
              <CostTimelineSection
                visa={liveQ.data.visaType}
                statStripProcessing={d.processing}
              />
              <EligibilitySection visa={liveQ.data.visaType} />
            </>
          ) : null}

          {/* ── What you'll need (live requirements, as destination detail) ───── */}
          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              color: EX.color.ink,
              letterSpacing: -0.18,
              marginTop: 26,
              marginBottom: 12,
              marginHorizontal: 2,
            }}
          >
            What you&apos;ll need
          </Text>
          <View
            style={{
              backgroundColor: '#fff',
              borderWidth: 1,
              borderColor: EX.color.line08,
              borderRadius: 20,
              overflow: 'hidden',
              shadowColor: '#171326',
              shadowOpacity: 0.04,
              shadowRadius: 2,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
            }}
          >
            {reqs.length === 0 ? (
              // japa#145: nothing published yet — say so, never a static list.
              <StateEmpty
                section
                icon={Ic.docs}
                title="No requirements published yet"
                body="We’ll list every document you need here as soon as it’s published."
              />
            ) : null}
            {reqs.map((r, i) => (
              <View
                key={`${r.t}-${i}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 13,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderTopWidth: i ? 1 : 0,
                  borderTopColor: EX.color.line06,
                }}
              >
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: EX.color.cream,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: EX.color.muted,
                    }}
                  >
                    {i + 1}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      fontSize: 14.5,
                      fontWeight: '600',
                      color: EX.color.ink,
                    }}
                  >
                    {r.t}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12.5,
                      color: EX.color.inkMuted,
                      marginTop: 1,
                    }}
                  >
                    {r.d}
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor:
                      r.e === 'Ready' ? EX.color.tealTint10 : EX.color.cream,
                    borderRadius: 999,
                    paddingHorizontal: 9,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color:
                        r.e === 'Ready' ? EX.color.tealDeep : EX.color.muted,
                    }}
                  >
                    {r.e}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* japa#255: link to the official application page (only with a URL). */}
          {liveQ.data?.visaType ? (
            <OfficialSourceSection visa={liveQ.data.visaType} />
          ) : null}

          {/* ── Boost your chances (dark specialist nudge) ──────────────────── */}
          {/* Only with a real top agent (GET /agents/top). */}
          {specialist ? (
            <>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: EX.color.ink,
                  letterSpacing: -0.18,
                  marginTop: 26,
                  marginBottom: 12,
                  marginHorizontal: 2,
                }}
              >
                Boost your chances
              </Text>
              <Pressable
                onPress={() => router.push(`/agent/${specialist.id}`)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  padding: 16,
                  borderRadius: 20,
                  backgroundColor: EX.color.ink,
                  shadowColor: '#171326',
                  shadowOpacity: 0.4,
                  shadowRadius: 20,
                  shadowOffset: { width: 0, height: 12 },
                  elevation: 6,
                }}
              >
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(255,255,255,0.12)',
                  }}
                >
                  <Ic.spark size={21} color={EX.color.bg} strokeWidth={1.8} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      fontSize: 15.5,
                      fontWeight: '700',
                      color: EX.color.bg,
                    }}
                    numberOfLines={1}
                  >
                    Work with a specialist
                  </Text>
                  <Text
                    style={{
                      fontSize: 12.5,
                      marginTop: 2,
                      color: 'rgba(255,251,245,0.72)',
                    }}
                    numberOfLines={1}
                  >
                    {specialist.n} · {specialist.succ}% success
                  </Text>
                </View>
                <Ic.chevR
                  size={20}
                  color={EX.color.primary}
                  strokeWidth={1.8}
                />
              </Pressable>
            </>
          ) : null}
        </View>
      </ScrollView>

      {/* ── Sticky CTA: Starting at $price / Start application, plus the
          start-failure states (japa#174) ──────────────────────────────────── */}
      <StartApplicationBar
        price={d.price}
        creating={startApp.creating}
        failure={startApp.failure}
        onStart={startApp.start}
        onDismissUpgrade={startApp.dismissUpgrade}
        duplicate={startApp.duplicate}
        onContinueExisting={startApp.continueExisting}
        onStartAnyway={startApp.startAnyway}
        onDismissDuplicate={startApp.dismissDuplicate}
      />
    </View>
  );
}
