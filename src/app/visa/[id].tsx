// ─────────────────────────────────────────────────────────────────────────────
// Visa breakdown (full visa detail).
//
// A leaner sibling of destination/[id].tsx: a COMPACT FIXED photo header (~200,
// NOT parallax — a plain image behind a rounded content sheet) + rounded sheet
// + sticky glass CTA. The sheet holds a stat strip (approval / processing /
// applicants), the requirements checklist, a "common reasons for refusal" list,
// and a dark "boost your chances" nudge toward a specialist.
//
// Style, sizes, radii and colours are lifted directly from destination/[id].tsx
// so the two screens read as one system.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX } from '@/components/explorer/theme';
import {
  AGENTS,
  REQS,
  REJECTIONS,
  destById,
  Dest,
  Req,
} from '@/components/explorer/data';
import {
  mapRequirements,
  visaTypeToDest,
} from '@/components/explorer/liveExplore';
import { mapAgent } from '@/components/explorer/liveAgents';
import { useCountriesWithVisas, useVisaType } from '@/hooks/useVisaTypes';
import { useTopAgents } from '@/hooks/useAgents';
import { useCreateApplication } from '@/hooks/useApplications';
import { Ic } from '@/components/explorer/icons';
import { Flag, GlassButton, Scrim } from '@/components/explorer/primitives';

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

  // Demo tiles resolve from static DESTS; live tiles (reached from the backend
  // Explore grid via destination/[id]) carry a country `code` and are fetched
  // by (countryCode, visaId) — mirroring destination/[id].tsx exactly.
  const demo = destById(id);
  const liveQ = useVisaType(demo ? '' : (code ?? ''), demo ? '' : id);
  const { data: countries } = useCountriesWithVisas();

  // Effective destination (demo or live-mapped from the visa type).
  const d: Dest | undefined = useMemo(() => {
    if (demo) return demo;
    const vt = liveQ.data?.visaType;
    if (!vt) return undefined;
    const name = countries?.find(
      (c) => c.code.toLowerCase() === (code ?? '').toLowerCase(),
    )?.name;
    return visaTypeToDest(vt, name);
  }, [demo, liveQ.data, countries, code]);

  // Requirements checklist — live requirements when present, else the demo set.
  const reqs: Req[] = useMemo(() => {
    if (demo) return REQS;
    const rq = liveQ.data?.requirements;
    return rq && rq.length ? mapRequirements(rq) : REQS;
  }, [demo, liveQ.data]);

  // "Boost your chances" nudge — feature the real #1 top agent (GET /agents/top)
  // with the demo specialist as fallback.
  const topAgentsQ = useTopAgents(1);
  const specialist = useMemo(() => {
    const live = (topAgentsQ.data ?? []).map(mapAgent);
    return live[0] ?? AGENTS[0];
  }, [topAgentsQ.data]);

  // Create-application (declared before any early return to keep hook order
  // stable). For a live visa the "Start application" CTA mints a real
  // Application, then opens self-service with that id; demo/failure fall back.
  const createApp = useCreateApplication();
  const [creating, setCreating] = useState(false);

  // Live fetch still in flight.
  if (!demo && liveQ.isLoading) {
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

  if (!d) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: EX.color.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: EX.color.muted }}>Visa not found.</Text>
      </View>
    );
  }

  // Start (or continue to) the self-service application. For a live visa this
  // creates a real Application (mode 'self') and opens self-service with its id;
  // demo dests and any failure fall back to the demo self-service view.
  const startSelfService = async () => {
    if (creating) return;
    if (demo) {
      router.push(`/self-service/${d.id}`);
      return;
    }
    try {
      setCreating(true);
      const app = await createApp.mutateAsync({
        visaTypeId: d.id,
        countryCode: (code ?? d.flag).toUpperCase(),
        mode: 'self',
      });
      router.push(`/self-service/${app?.id ?? d.id}`);
    } catch {
      router.push(`/self-service/${d.id}`);
    } finally {
      setCreating(false);
    }
  };

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
            paddingBottom: EX.space.ctaClear,
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

          {/* ── What you'll need (REQS — same as destination detail) ────────── */}
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
            {reqs.map((r, i) => (
              <View
                key={r.t}
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
                      color: EX.color.muted,
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

          {/* ── Common reasons for refusal (REJECTIONS) ─────────────────────── */}
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
            Common reasons for refusal
          </Text>
          <View style={{ gap: 10 }}>
            {REJECTIONS.map((reason) => (
              <View
                key={reason}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: '#fff',
                  borderWidth: 1,
                  borderColor: EX.color.line08,
                  borderRadius: 16,
                  paddingVertical: 13,
                  paddingHorizontal: 14,
                  shadowColor: '#171326',
                  shadowOpacity: 0.04,
                  shadowRadius: 2,
                  shadowOffset: { width: 0, height: 1 },
                  elevation: 1,
                }}
              >
                {/* 26px rejected-tint circle with a coral-red X (docStatus.rejected colours) */}
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: '#FBE3E1',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ic.x size={14} color="#C0453C" strokeWidth={2.2} />
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 14,
                    fontWeight: '600',
                    color: '#9E3630',
                    lineHeight: 19,
                  }}
                >
                  {reason}
                </Text>
              </View>
            ))}
          </View>

          {/* ── Boost your chances (dark specialist nudge) ──────────────────── */}
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
            <Ic.chevR size={20} color={EX.color.primary} strokeWidth={1.8} />
          </Pressable>
        </View>
      </ScrollView>

      {/* ── Sticky glass CTA — Starting at $price / Start application ────────── */}
      <BlurView
        intensity={30}
        tint="light"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingTop: 16,
          paddingHorizontal: 20,
          paddingBottom: Math.max(insets.bottom, 16) + 6,
          backgroundColor: EX.color.glassWarmSoft,
          borderTopWidth: 1,
          borderTopColor: EX.color.line06,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View>
            <Text
              style={{
                fontSize: 11.5,
                color: EX.color.muted,
                fontWeight: '500',
              }}
            >
              Starting at
            </Text>
            <Text
              style={{
                fontSize: 21,
                fontWeight: '700',
                color: EX.color.ink,
                letterSpacing: -0.21,
              }}
            >
              ${d.price.toLocaleString()}
            </Text>
          </View>
          <Pressable
            onPress={startSelfService}
            disabled={creating}
            style={{
              flex: 1,
              height: 54,
              borderRadius: 16,
              backgroundColor: EX.color.primary,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: creating ? 0.7 : 1,
              shadowColor: EX.color.primary,
              shadowOpacity: 0.45,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 10 },
              elevation: 6,
            }}
          >
            {creating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text
                  style={{ color: '#fff', fontSize: 15.5, fontWeight: '700' }}
                >
                  Start application
                </Text>
                <Ic.arrow size={18} color="#fff" strokeWidth={1.8} />
              </>
            )}
          </Pressable>
        </View>
      </BlurView>
    </View>
  );
}
