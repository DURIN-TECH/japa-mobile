// ─────────────────────────────────────────────────────────────────────────────
// Agents tab (prototype agents.jsx AgentsView).
//
// A directory of vetted migration experts. Big ScreenHeader, then a horizontal
// "Top agencies" carousel of media cards, then a vertical "Top agents" list of
// white AgentRow cards. Agencies push to /(explorer)/agency/[id]; agents push to
// /(explorer)/agent/[id].
//
// Every measurement below is quoted 1:1 from the prototype source (agents.jsx →
// AgencyCard / AgentRow / AgentsView / SectionTitleWrap).
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX } from '@/components/explorer/theme';
import { AGENCIES, AGENTS, agencyById } from '@/components/explorer/data';
import { mapAgent } from '@/components/explorer/liveAgents';
import { useAgents } from '@/hooks/useAgents';
import { Ic } from '@/components/explorer/icons';
import {
  Portrait,
  ScreenHeader,
  SectionTitle,
  Verified,
} from '@/components/explorer/primitives';
import type { Agent } from '@/components/explorer/data';

// ── AgencyCard — 248×158 cover media card with bottom-scrim overlay ───────────
// Source: minWidth 248, height 158, radius 22, bg tone; scrim (to top)
// rgba(12,10,8,.82) 0% → .2 55% → .1 100%.
function AgencyCard({ id }: { id: string }) {
  const router = useRouter();
  const a = agencyById(id);
  if (!a) return null;
  return (
    <Pressable
      onPress={() => router.push(`/(explorer)/agency/${a.id}`)}
      style={{ width: 248 }}
    >
      <View
        style={{
          width: 248,
          height: 158,
          borderRadius: 22,
          overflow: 'hidden',
          backgroundColor: a.tone,
          // Source boxShadow: '0 1px 2px rgba(23,19,38,.08), 0 16px 28px -22px rgba(23,19,38,.5)'.
          shadowColor: '#171326',
          shadowOpacity: 0.3,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 12 },
          elevation: 4,
        }}
      >
        <Image
          source={{ uri: a.cover }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={200}
        />
        {/* Bottom scrim: .82 → .2 @55% → .1 (bottom → top) */}
        <LinearGradient
          colors={[
            'rgba(12,10,8,0.82)',
            'rgba(12,10,8,0.2)',
            'rgba(12,10,8,0.1)',
          ]}
          locations={[0, 0.55, 1]}
          start={{ x: 0.5, y: 1 }}
          end={{ x: 0.5, y: 0 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />

        {/* Bottom overlay: name + verified, then rating · agents · city */}
        <View style={{ position: 'absolute', left: 14, right: 14, bottom: 13 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginBottom: 4,
            }}
          >
            {/* Source: system font, fontSize 16 / weight 700 (NOT the display font). */}
            <Text
              style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}
              numberOfLines={1}
            >
              {a.name}
            </Text>
            {a.verified ? <Verified size={15} /> : null}
          </View>
          {/* Meta row: gap 10, fontSize 12 / weight 600, color rgba(255,255,255,.9). */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Ic.star
                size={12}
                color={EX.color.gold}
                fill={EX.color.gold}
                strokeWidth={0}
              />
              <Text
                style={{
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: 12,
                  fontWeight: '600',
                }}
              >
                {a.r}
              </Text>
            </View>
            <Text
              style={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: 12,
                fontWeight: '600',
                opacity: 0.5,
              }}
            >
              ·
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: 12,
                fontWeight: '600',
              }}
            >
              {a.agents} agents
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: 12,
                fontWeight: '600',
                opacity: 0.5,
              }}
            >
              ·
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: 12,
                fontWeight: '600',
              }}
            >
              {a.city}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ── AgentRow — white radius-22 card: portrait + name/spec + stats ────────────
// Source AgentRow: padding 14, radius 22, border rgba(23,19,38,.07), bg #fff,
// gap 13; Portrait 52 + 13px teal dot (2.5px white border); name 15.5/700;
// spec · agency 12.5; single gold star + rating 12.5/700, "(rev)" 11.5, and a
// "{succ}% success" pill 11/700 #1E8E55 on #D6F2E2 (padding 3/8).
export function AgentRow({ a }: { a: Agent }) {
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
      {/* Portrait 52 with 13px teal availability dot */}
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

      {/* Info column */}
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
          {/* Single gold star + numeric rating, 12.5/700 (NOT the 5-star Stars row). */}
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

export default function AgentsScreen() {
  const insets = useSafeAreaInsets();

  // Live agents (GET /agents, verified + available) with a demo fallback. The
  // agencies carousel stays demo until an agencies endpoint is available.
  const agentsQ = useAgents();
  const liveAgents = (agentsQ.data ?? []).map(mapAgent);
  const agentList = liveAgents.length ? liveAgents : AGENTS;

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: EX.space.tabClear }}
      >
        {/* Header — eyebrow / title / sub quoted from source. */}
        <ScreenHeader
          topInset={insets.top}
          eyebrow="Vetted & government-licensed"
          title="Find your agent"
          sub="Real specialists who’ve walked this path hundreds of times."
        />

        {/* ── Top agencies (horizontal media carousel) ──────────────────────── */}
        <View style={{ paddingHorizontal: EX.space.screenX }}>
          <SectionTitle action="See all">Top agencies</SectionTitle>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            gap: 13,
            paddingHorizontal: EX.space.screenX,
            paddingBottom: 4,
          }}
        >
          {AGENCIES.map((ag) => (
            <AgencyCard key={ag.id} id={ag.id} />
          ))}
        </ScrollView>

        {/* ── Top agents (vertical list) ────────────────────────────────────── */}
        <View style={{ paddingHorizontal: EX.space.screenX }}>
          <SectionTitle action="Filters">Top agents</SectionTitle>
          <View style={{ gap: 12 }}>
            {agentList.map((a) => (
              <AgentRow key={a.id} a={a} />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
