// ─────────────────────────────────────────────────────────────────────────────
// Agent detail (prototype agents.jsx AgentDetail).
//
// A tonal GRADIENT header (155deg, tone → tone@42% → rgba(23,19,38,.92)@130%)
// with two faint decorative circles (200 top-right, 220 bottom-left). A centered
// 92px portrait sits on it (3px white-16 border + 20px teal dot). A floating
// blurred glass stat panel (Rating / Success / Approved) overlaps the header's
// bottom edge by -32. Below: bio, specialisations, response/language fact cards,
// the agency they work at, and recent reviews. Sticky glass CTA at the base.
//
// Every measurement is quoted 1:1 from the prototype source.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX } from '@/components/explorer/theme';
import {
  NAIRA,
  agentById,
  agencyById,
  reviewsForAgent,
} from '@/components/explorer/data';
import { mapAgent } from '@/components/explorer/liveAgents';
import { mapReview } from '@/components/explorer/liveReviews';
import { useAgent, useAgentReviews } from '@/hooks/useAgents';
import { Ic } from '@/components/explorer/icons';
import {
  Chip,
  GlassButton,
  Portrait,
  Stars,
  Verified,
} from '@/components/explorer/primitives';
import type { Review } from '@/components/explorer/data';

// ── GlassStat — one column of the floating panel (value 19/700, label 11.5) ───
// Source GlassStat: flex 1, textAlign center, padding '15px 8px'; value 19/700
// #171326; label 11.5/500 #5B5468 marginTop 2. NO accent colours.
function GlassStat({ value, label }: { value: string; label: string }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 15,
        paddingHorizontal: 8,
      }}
    >
      <Text
        style={{
          fontSize: 19,
          fontWeight: '700',
          color: EX.color.ink,
          letterSpacing: -0.19,
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 11.5,
          color: EX.color.inkMuted,
          fontWeight: '500',
          marginTop: 2,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

// Vertical hairline between glass stats (source Div: width 1, rgba(23,19,38,.1)).
function GlassDiv() {
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

// ── FactCard — small white card: bare coral icon + value + label ──────────────
// Source FactCard: radius 18, padding 15; Icon size 18 #F4516C; value 14/700
// marginTop 9 (lineHeight 1.2); label 11.5 #8B8499 marginTop 2.
function FactCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{
    size?: number;
    color?: string;
    strokeWidth?: number;
  }>;
  label: string;
  value: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: EX.color.cardWhite,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: EX.color.line08,
        padding: 15,
        shadowColor: '#171326',
        shadowOpacity: 0.04,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
    >
      <Icon size={18} color={EX.color.primary} strokeWidth={1.8} />
      <Text
        style={{
          fontSize: 14,
          fontWeight: '700',
          color: EX.color.ink,
          marginTop: 9,
          lineHeight: 17,
        }}
        numberOfLines={2}
      >
        {value}
      </Text>
      <Text style={{ fontSize: 11.5, color: EX.color.muted, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

// ── ReviewCard — portrait + name/ago + stars + review body ───────────────────
// Source: radius 18, padding 15; header gap 10 marginBottom 9; Portrait 36;
// name 13.5/700; ago 11.5 #8B8499; Stars 13; body 13.5/1.5 #5B5468.
function ReviewCard({ rev }: { rev: Review }) {
  return (
    <View
      style={{
        backgroundColor: EX.color.cardWhite,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: EX.color.line08,
        padding: 15,
        shadowColor: '#171326',
        shadowOpacity: 0.04,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginBottom: 9,
        }}
      >
        <Portrait seed={rev.seed} size={36} name={rev.n} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{ fontSize: 13.5, fontWeight: '700', color: EX.color.ink }}
            numberOfLines={1}
          >
            {rev.n}
          </Text>
          <Text style={{ fontSize: 11.5, color: EX.color.muted }}>
            {rev.ago}
          </Text>
        </View>
        <Stars r={rev.r} size={13} />
      </View>
      <Text
        style={{ fontSize: 13.5, lineHeight: 20, color: EX.color.inkMuted }}
      >
        {rev.t}
      </Text>
    </View>
  );
}

export default function AgentDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Demo agents resolve from static AGENTS; otherwise fetch live (GET /agents/:id).
  const demo = agentById(id);
  const liveQ = useAgent(demo ? undefined : id);
  const a = demo ?? (liveQ.data ? mapAgent(liveQ.data) : undefined);

  // Reviews: demo agents use the static REVIEWS; live agents fetch from the
  // backend (GET /agents/:id/reviews). Hook is called before any early return
  // and disabled on the demo path (undefined agentId).
  const reviewsQ = useAgentReviews(demo ? undefined : id);

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
        <Text style={{ color: EX.color.muted }}>Agent not found.</Text>
      </View>
    );
  }

  // Agency is demo-only for now; the section self-hides when absent.
  const agency = agencyById(a.agencyId);
  // Reviews: demo path uses static REVIEWS; live path maps backend reviews.
  // The "Recent reviews" section already self-hides when the array is empty.
  const reviews = demo
    ? reviewsForAgent(a.id)
    : (reviewsQ.data ?? []).map(mapReview);

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: EX.space.ctaClear }}
      >
        {/* ── Tonal gradient header ───────────────────────────────────────── */}
        {/* CSS: linear-gradient(155deg, tone 0%, tone 42%, rgba(23,19,38,.92) 130%).
            155deg points down-and-slightly-right → start top-left, end bottom-right.
            Source paddingTop 104 (54 status + 50) becomes insets.top + 50. */}
        <LinearGradient
          colors={[a.tone, a.tone, 'rgba(23,19,38,0.92)']}
          locations={[0, 0.42, 1]}
          start={{ x: 0.29, y: 0.05 }}
          end={{ x: 0.71, y: 0.95 }}
          style={{
            paddingTop: insets.top + 50,
            paddingBottom: 56,
            paddingHorizontal: EX.space.screenX,
            alignItems: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Faint decorative circles (200 top-right, 220 bottom-left). */}
          <View
            style={{
              position: 'absolute',
              top: -60,
              right: -40,
              width: 200,
              height: 200,
              borderRadius: 100,
              backgroundColor: 'rgba(255,255,255,0.06)',
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: -80,
              left: -50,
              width: 220,
              height: 220,
              borderRadius: 110,
              backgroundColor: 'rgba(255,255,255,0.05)',
            }}
          />

          {/* Centered identity: 92px portrait + 20px teal dot */}
          <View>
            <Portrait
              seed={a.seed}
              size={92}
              name={a.n}
              style={{
                borderWidth: 3,
                borderColor: 'rgba(255,255,255,0.16)',
                shadowColor: '#000',
                shadowOpacity: 0.5,
                shadowRadius: 15,
                shadowOffset: { width: 0, height: 14 },
              }}
            />
            {a.avail ? (
              <View
                style={{
                  position: 'absolute',
                  right: 4,
                  bottom: 4,
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: EX.color.teal,
                  borderWidth: 3,
                  borderColor: '#fff',
                }}
              />
            ) : null}
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              marginTop: 14,
            }}
          >
            <Text
              style={{
                color: '#fff',
                fontFamily: EX.font.display.semibold,
                fontSize: 25,
                letterSpacing: -0.25,
              }}
            >
              {a.n}
            </Text>
            <Verified size={18} />
          </View>
          <Text
            style={{
              color: 'rgba(255,255,255,0.8)',
              fontSize: 13.5,
              fontWeight: '600',
              marginTop: 4,
            }}
          >
            {a.spec} · {a.years} yrs experience
          </Text>
        </LinearGradient>

        {/* ── Floating glass stat panel (overlaps header by -32) ─────────────── */}
        {/* Source: radius 20, glass rgba(255,255,255,.72), border rgba(255,255,255,.6). */}
        <View style={{ paddingHorizontal: EX.space.screenX, marginTop: -32 }}>
          <BlurView
            intensity={24}
            tint="light"
            style={{
              flexDirection: 'row',
              borderRadius: 20,
              overflow: 'hidden',
              backgroundColor: 'rgba(255,255,255,0.72)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.6)',
              shadowColor: '#171326',
              shadowOpacity: 0.28,
              shadowRadius: 15,
              shadowOffset: { width: 0, height: 14 },
              elevation: 6,
            }}
          >
            <GlassStat value={String(a.r)} label="Rating" />
            <GlassDiv />
            <GlassStat value={`${a.succ}%`} label="Success" />
            <GlassDiv />
            <GlassStat value={a.apps.toLocaleString()} label="Approved" />
          </BlurView>
        </View>

        {/* ── Body (source padding '22px 22px 130px') ───────────────────────── */}
        <View style={{ paddingHorizontal: EX.space.screenX, paddingTop: 22 }}>
          {/* Bio — 14.5/1.6 #5B5468 */}
          <Text
            style={{ fontSize: 14.5, lineHeight: 23, color: EX.color.inkMuted }}
          >
            {a.bio}
          </Text>

          {/* Specialises in */}
          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              color: EX.color.ink,
              letterSpacing: -0.18,
              marginTop: 24,
              marginBottom: 12,
            }}
          >
            Specialises in
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {a.specs.map((s) => (
              <Chip
                key={s}
                label={s}
                textStyle={{ color: EX.color.inkMuted }}
              />
            ))}
          </View>

          {/* Response time + languages fact cards (source join(' · ')). */}
          <View style={{ flexDirection: 'row', gap: 11, marginTop: 18 }}>
            <FactCard icon={Ic.clock} label="Response time" value={a.resp} />
            <FactCard
              icon={Ic.lang}
              label="Languages"
              value={a.langs.join(' · ')}
            />
          </View>

          {/* Works at (agency row) */}
          {agency ? (
            <>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: EX.color.ink,
                  letterSpacing: -0.18,
                  marginTop: 26,
                  marginBottom: 12,
                }}
              >
                Works at
              </Text>
              <Pressable
                onPress={() => router.push(`/(explorer)/agency/${agency.id}`)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 13,
                  backgroundColor: EX.color.cardWhite,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: EX.color.line08,
                  padding: 13,
                  shadowColor: '#171326',
                  shadowOpacity: 0.04,
                  shadowRadius: 2,
                  shadowOffset: { width: 0, height: 1 },
                  elevation: 1,
                }}
              >
                {/* 50px cover thumb, radius 14 */}
                <Image
                  source={{ uri: agency.cover }}
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 14,
                    backgroundColor: agency.tone,
                  }}
                  contentFit="cover"
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '700',
                        color: EX.color.ink,
                      }}
                      numberOfLines={1}
                    >
                      {agency.name}
                    </Text>
                    {agency.verified ? <Verified size={14} /> : null}
                  </View>
                  <Text
                    style={{
                      fontSize: 12.5,
                      color: EX.color.muted,
                      marginTop: 1,
                    }}
                    numberOfLines={1}
                  >
                    {a.role} · {agency.city}
                  </Text>
                </View>
                <Ic.chevR
                  size={19}
                  color="rgba(23,19,38,0.4)"
                  strokeWidth={1.8}
                />
              </Pressable>
            </>
          ) : null}

          {/* Recent reviews (action = "{n} reviews") */}
          {reviews.length ? (
            <>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  marginTop: 26,
                  marginBottom: 12,
                }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: EX.color.ink,
                    letterSpacing: -0.18,
                  }}
                >
                  Recent reviews
                </Text>
                <Text
                  style={{
                    color: EX.color.primary,
                    fontSize: 13.5,
                    fontWeight: '600',
                  }}
                >
                  {reviews.length} reviews
                </Text>
              </View>
              <View style={{ gap: 11 }}>
                {reviews.map((r) => (
                  <ReviewCard key={r.id} rev={r} />
                ))}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>

      {/* ── Top glass controls (fixed overlay; source absolute top 54) ──────── */}
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
        <GlassButton
          icon={Ic.msg}
          onPress={() => router.push('/(explorer)/messages')}
        />
      </View>

      {/* ── Sticky glass CTA (source padding '15px 22px 24px') ───────────────── */}
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* 54px message square */}
          <Pressable
            onPress={() => router.push('/(explorer)/messages')}
            style={{
              width: 54,
              height: 54,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: EX.color.line12,
              backgroundColor: '#fff',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ic.msg size={21} color={EX.color.ink} strokeWidth={1.8} />
          </Pressable>

          {/* Consultation fee (natural width) */}
          <View>
            <Text
              style={{
                fontSize: 11.5,
                color: EX.color.muted,
                fontWeight: '500',
              }}
            >
              Consultation
            </Text>
            <Text
              style={{
                fontSize: 20,
                fontWeight: '700',
                color: EX.color.ink,
                letterSpacing: -0.2,
                lineHeight: 20,
              }}
            >
              {NAIRA(a.fee)}
            </Text>
          </View>

          {/* Book (coral, flex 1, with arrow) */}
          <Pressable
            onPress={() => router.push(`/(explorer)/book/${a.id}`)}
            style={{
              flex: 1,
              height: 54,
              borderRadius: 16,
              backgroundColor: EX.color.primary,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              shadowColor: EX.color.primary,
              shadowOpacity: 0.45,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 10 },
              elevation: 6,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '700' }}>
              Book
            </Text>
            <Ic.arrow size={18} color="#fff" strokeWidth={1.8} />
          </Pressable>
        </View>
      </BlurView>
    </View>
  );
}
