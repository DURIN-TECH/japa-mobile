// ─────────────────────────────────────────────────────────────────────────────
// Agency detail (prototype agents.jsx AgencyDetail).
//
// Parallax photo hero (256 tall, translateY py*-0.3) with the same Reanimated
// approach as destination/[id].tsx. A rounded content sheet rises over it and
// carries a grab handle, a 4-column icon MiniStat strip, blurb, licence badge
// pills, and the agency's agents (AgentRow list). A sticky dark CTA
// ("Contact {name}") anchors the base.
//
// Every measurement is quoted 1:1 from the prototype source.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX } from '@/components/explorer/theme';
import { agencyById, agentsForAgency } from '@/components/explorer/data';
import { mapAgency } from '@/components/explorer/liveAgencies';
import { mapAgent } from '@/components/explorer/liveAgents';
import {
  usePublicAgency,
  usePublicAgencyAgents,
} from '@/hooks/useAgencies';
import { Ic } from '@/components/explorer/icons';
import {
  GlassButton,
  Portrait,
  Verified,
} from '@/components/explorer/primitives';
import type { Agent } from '@/components/explorer/data';

const HERO = 256;

// ── MiniStat — one column of the 4-up icon stat strip ────────────────────────
// Source: flexDirection column, gap 5, padding '14px 12px'; Icon 17 #F4516C;
// value 16/700 #171326; label 11 #8B8499. Left-aligned (no accents).
function MiniStat({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{
    size?: number;
    color?: string;
    strokeWidth?: number;
  }>;
  value: string;
  label: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        gap: 5,
        paddingVertical: 14,
        paddingHorizontal: 12,
        minWidth: 0,
      }}
    >
      <Icon size={17} color={EX.color.primary} strokeWidth={1.8} />
      <Text
        style={{
          fontSize: 16,
          fontWeight: '700',
          color: EX.color.ink,
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

// Vertical hairline between mini-stats (source Div: width 1, rgba(23,19,38,.1)).
function MiniDiv() {
  return (
    <View
      style={{
        width: 1,
        alignSelf: 'stretch',
        backgroundColor: EX.color.line10,
      }}
    />
  );
}

// ── AgentRow — white radius-22 card (local copy; mirrors agents.tsx) ──────────
// Duplicated here per the prototype's per-screen "local component" convention.
// Source shows spec · agencyName, single gold star + rating 12.5/700, "(rev)"
// 11.5, and a "{succ}% success" pill 11/700 #1E8E55 on #D6F2E2 (padding 3/8).
function AgentRow({ a }: { a: Agent }) {
  const router = useRouter();
  const agency = agencyById(a.agencyId);
  return (
    <Pressable
      onPress={() => router.push(`/(explorer)/agent/${a.id}`)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
        backgroundColor: EX.color.cardWhite,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: 'rgba(23,19,38,0.07)',
        padding: 14,
        shadowColor: '#171326',
        shadowOpacity: 0.04,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
    >
      <View>
        <Portrait seed={a.seed} size={52} name={a.n} />
        {a.avail ? (
          <View
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              width: 13,
              height: 13,
              borderRadius: 6.5,
              backgroundColor: EX.color.teal,
              borderWidth: 2.5,
              borderColor: EX.color.cardWhite,
            }}
          />
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text
            style={{ fontSize: 15.5, fontWeight: '700', color: EX.color.ink }}
            numberOfLines={1}
          >
            {a.n}
          </Text>
          <Verified size={14} />
        </View>
        <Text
          style={{ fontSize: 12.5, color: EX.color.muted, marginTop: 1 }}
          numberOfLines={1}
        >
          {a.spec}
          {agency ? ` · ${agency.name}` : ''}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 9,
            marginTop: 7,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ic.star
              size={13}
              color={EX.color.gold}
              fill={EX.color.gold}
              strokeWidth={0}
            />
            <Text
              style={{ fontSize: 12.5, fontWeight: '700', color: EX.color.ink }}
            >
              {a.r}
            </Text>
          </View>
          <Text style={{ fontSize: 11.5, color: EX.color.muted }}>
            ({a.rev.toLocaleString()})
          </Text>
          <View
            style={{
              backgroundColor: '#D6F2E2',
              borderRadius: 999,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: EX.color.success,
              }}
            >
              {a.succ}% success
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function AgencyDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Resolve demo-or-live. If the id matches a demo agency we render that and
  // disable the network queries; otherwise we fetch the public agency (and its
  // agents) from the backend. Both queries are disabled on the demo path.
  const demo = agencyById(id);
  const agQ = usePublicAgency(demo ? undefined : id);
  const agentsQ = usePublicAgencyAgents(demo ? undefined : id);
  const a = demo ?? (agQ.data ? mapAgency(agQ.data) : undefined);

  // Hero parallax driven by the sheet's scroll offset (source py * -0.3).
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const heroStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scrollY.value * -0.3 }],
  }));
  const imgStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          scrollY.value,
          [0, 400],
          [1, 1.24],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // Loading — only on the live path while the single-agency fetch is in flight.
  if (!demo && agQ.isLoading) {
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

  if (!a) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: EX.color.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: EX.color.muted }}>Agency not found.</Text>
      </View>
    );
  }

  // Agents list — demo lookup, or live agents mapped from the backend.
  const agents = demo
    ? agentsForAgency(a.id)
    : (agentsQ.data ?? []).map(mapAgent);

  // MiniStat strip stats. Live agencies carry no agency-level rating/reviews/
  // success, so we COMPUTE them from the agency's agents: rating = avg (1dp),
  // reviews = sum, success = avg (rounded). Fall back to the agency's own
  // values when demo, or when a live agency has no agents yet.
  const isLive = !demo;
  const hasAgents = agents.length > 0;
  const statR =
    isLive && hasAgents
      ? Number(
          (agents.reduce((s, x) => s + x.r, 0) / agents.length).toFixed(1),
        )
      : a.r;
  const statRev =
    isLive && hasAgents
      ? agents.reduce((s, x) => s + x.rev, 0)
      : a.rev;
  const statSucc =
    isLive && hasAgents
      ? Math.round(agents.reduce((s, x) => s + x.succ, 0) / agents.length)
      : a.succ;

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      {/* HERO — fixed behind, parallaxes as the sheet scrolls over it */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: HERO,
            overflow: 'hidden',
            backgroundColor: a.tone,
          },
          heroStyle,
        ]}
      >
        <Animated.View
          style={[
            { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
            imgStyle,
          ]}
        >
          <Image
            source={{ uri: a.cover }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={200}
          />
        </Animated.View>
        {/* Scrim: .82 → .2 @52% → .34 (bottom → top) */}
        <LinearGradient
          colors={[
            'rgba(12,10,8,0.82)',
            'rgba(12,10,8,0.2)',
            'rgba(12,10,8,0.34)',
          ]}
          locations={[0, 0.52, 1]}
          start={{ x: 0.5, y: 1 }}
          end={{ x: 0.5, y: 0 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />
        <View style={{ position: 'absolute', left: 22, right: 22, bottom: 50 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
            }}
          >
            <Text
              style={{
                color: '#fff',
                fontFamily: EX.font.display.semibold,
                fontSize: 28,
                letterSpacing: -0.28,
                textShadowColor: 'rgba(0,0,0,0.3)',
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 14,
              }}
              numberOfLines={1}
            >
              {a.name}
            </Text>
            {a.verified ? <Verified size={19} /> : null}
          </View>
          {/* Pin · "{city}, Nigeria" · "Since {est}" (gap 9, 13/600). */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Ic.pin size={14} color="#fff" strokeWidth={1.8} />
              <Text
                style={{
                  color: 'rgba(255,255,255,0.92)',
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                {a.city}, Nigeria
              </Text>
            </View>
            {/* "Since {year}" only when we actually have a founding year
                (live agencies with no createdAt map to est 0 → hide it). */}
            {a.est ? (
              <>
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.92)',
                    fontSize: 13,
                    fontWeight: '600',
                    opacity: 0.5,
                  }}
                >
                  ·
                </Text>
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.92)',
                    fontSize: 13,
                    fontWeight: '600',
                  }}
                >
                  Since {a.est}
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </Animated.View>

      {/* Top glass controls (source absolute top 54): back + share) */}
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
        <GlassButton icon={Ic.arrowUR} />
      </View>

      {/* Scrolling content sheet */}
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* spacer revealing the hero (source HERO - 26) */}
        <View style={{ height: HERO - 26 }} pointerEvents="none" />

        <View
          style={{
            backgroundColor: EX.color.bg,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            minHeight: 600,
            paddingTop: 8,
            paddingHorizontal: 22,
            paddingBottom: EX.space.ctaClear,
            shadowColor: '#171326',
            shadowOpacity: 0.26,
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

          {/* 4-column icon mini-stat strip (no container padding; cells own it). */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: '#fff',
              borderWidth: 1,
              borderColor: EX.color.line08,
              borderRadius: 20,
              shadowColor: '#171326',
              shadowOpacity: 0.04,
              shadowRadius: 2,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
            }}
          >
            <MiniStat icon={Ic.star} value={String(statR)} label="Rating" />
            <MiniDiv />
            <MiniStat icon={Ic.users} value={String(a.agents)} label="Agents" />
            <MiniDiv />
            <MiniStat icon={Ic.trend} value={`${statSucc}%`} label="Success" />
            <MiniDiv />
            <MiniStat
              icon={Ic.msg}
              value={`${(statRev / 1000).toFixed(1)}k`}
              label="Reviews"
            />
          </View>

          {/* Blurb — 14.5/1.6 #5B5468, margin '18px 2px 0' */}
          <Text
            style={{
              fontSize: 14.5,
              lineHeight: 23,
              color: EX.color.inkMuted,
              marginTop: 18,
              marginHorizontal: 2,
            }}
          >
            {a.blurb}
          </Text>

          {/* Licence badge pills — shield 14, 12.5/600 #1E8E55 on #D6F2E2, padding 7/13 */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 14,
            }}
          >
            {a.badges.map((b) => (
              <View
                key={b}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: '#D6F2E2',
                  borderRadius: 999,
                  paddingHorizontal: 13,
                  paddingVertical: 7,
                }}
              >
                <Ic.shield
                  size={14}
                  color={EX.color.success}
                  strokeWidth={1.8}
                />
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: '600',
                    color: EX.color.success,
                  }}
                >
                  {b}
                </Text>
              </View>
            ))}
          </View>

          {/* Agents here */}
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
            {agents.length} agents here
          </Text>
          <View style={{ gap: 12 }}>
            {agents.map((ag) => (
              <AgentRow key={ag.id} a={ag} />
            ))}
          </View>
        </View>
      </Animated.ScrollView>

      {/* ── Sticky dark CTA (source padding '15px 22px 24px') ────────────────── */}
      <BlurView
        intensity={30}
        tint="light"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingTop: 15,
          paddingHorizontal: 22,
          paddingBottom: Math.max(insets.bottom, 16) + 6,
          backgroundColor: EX.color.glassWarmSoft,
          borderTopWidth: 1,
          borderTopColor: EX.color.line06,
        }}
      >
        <Pressable
          onPress={() => router.push('/(explorer)/messages')}
          style={{
            height: 54,
            borderRadius: 16,
            backgroundColor: EX.color.ink,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            shadowColor: '#171326',
            shadowOpacity: 0.4,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 12 },
            elevation: 6,
          }}
        >
          <Ic.msg size={18} color={EX.color.bg} strokeWidth={1.8} />
          <Text
            style={{ color: EX.color.bg, fontSize: 15.5, fontWeight: '700' }}
          >
            Contact {a.name}
          </Text>
        </Pressable>
      </BlurView>
    </View>
  );
}
