// ─────────────────────────────────────────────────────────────────────────────
// Application detail (prototype applications.jsx AppDetail).
//
// Parallax photo hero (240) + rounded content sheet + sticky coral CTA. The hero
// translates up at py * -0.3 (Reanimated stands in for the source's scroll
// listener). Sheet holds: a dark "Next step" nudge (when actionable), a Progress
// header, a vertical Timeline stepper, and a "Your agent" row. The sticky CTA
// performs the next step or messages the agent.
//
// Every measurement is quoted from AppDetail: HERO 240, scrim to-top
// (.8 → .2@50% → .36), StatusPill full, country · Ref 13/600, visa 28 Space
// Grotesk; sheet radius 28 / padding 20-22-130; dark next-step card radius 18;
// timeline card radius 22 / padding 20; nodes 26 (done teal check 3.4, current
// coral + 5px ring + 7px dot, next 2px .14 border); agent row radius 20 / 48px
// portrait; sticky coral CTA 54h radius 16.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedScrollHandler, useAnimatedStyle, useSharedValue,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, EXShadow } from '@/components/explorer/theme';
import {
  AppStep, CONVOS, NAIRA, agentById, appById, convoForAgent, destById, paymentRequestsForApp,
} from '@/components/explorer/data';
import { Ic } from '@/components/explorer/icons';
import { Flag, GlassButton, Portrait, StatusPill } from '@/components/explorer/primitives';

const HERO = 240;

// ── Timeline — vertical stepper (source: gap 14, paddingBottom 22, nodes 26) ──
// done    = solid teal circle + white check (13, strokeWidth 3.4), teal connector
// current = solid coral node + white 7px dot inside a 5px coral-tint ring
// next    = white circle with a 2px rgba(23,19,38,0.14) border, grey connector
function Timeline({ steps }: { steps: AppStep[] }) {
  return (
    <View>
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        const done = step.s === 'done';
        const current = step.s === 'current';

        return (
          <View key={`${step.t}-${i}`} style={{ flexDirection: 'row', gap: 14, paddingBottom: last ? 0 : 22 }}>
            {/* Marker + connector column */}
            <View style={{ alignItems: 'center' }}>
              {done ? (
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: EX.color.teal, alignItems: 'center', justifyContent: 'center' }}>
                  <Ic.check size={13} color="#fff" strokeWidth={3.4} />
                </View>
              ) : current ? (
                <View style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
                  {/* 5px coral-tint ring (box-shadow 0 0 0 5px rgba(244,81,108,0.16)) */}
                  <View style={{ position: 'absolute', top: -5, left: -5, width: 36, height: 36, borderRadius: 18, backgroundColor: EX.color.primaryTint16 }} />
                  <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: EX.color.primary, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#fff' }} />
                  </View>
                </View>
              ) : (
                <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'rgba(23,19,38,0.14)', backgroundColor: '#fff' }} />
              )}

              {/* Connector: teal when this step is complete, else rgba(23,19,38,0.1) */}
              {!last ? (
                <View style={{ width: 2, flex: 1, minHeight: 24, marginTop: 2, borderRadius: 1, backgroundColor: done ? EX.color.teal : 'rgba(23,19,38,0.1)' }} />
              ) : null}
            </View>

            {/* Step content (paddingTop 2) */}
            <View style={{ flex: 1, paddingTop: 2 }}>
              <Text style={{ fontSize: 14.5, fontWeight: current ? '700' : '600', color: step.s === 'next' ? EX.color.muted : EX.color.ink }} numberOfLines={1}>
                {step.t}
              </Text>
              <Text style={{ fontSize: 12.5, color: current ? EX.color.primary : EX.color.muted, fontWeight: current ? '600' : '500', marginTop: 1 }} numberOfLines={1}>
                {step.d}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function AppDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const app = appById(id);
  const dest = destById(app?.destId);
  const agent = agentById(app?.agentId);
  // Find the agent's conversation (matched by agentId) for the message actions.
  const convo = app ? CONVOS.find((c) => c.agentId === app.agentId) : undefined;

  // Parallax: hero translates up at py * -0.3 (source transform translateY).
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });
  const heroStyle = useAnimatedStyle(() => ({ transform: [{ translateY: scrollY.value * -0.3 }] }));

  if (!app || !dest) {
    return (
      <View style={{ flex: 1, backgroundColor: EX.color.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: EX.color.muted }}>Application not found.</Text>
      </View>
    );
  }

  const pct = Math.round(app.progress * 100);
  const actionable = app.next.cta != null;
  // Agent-raised payment requests on this application (empty → section hidden).
  const payReqs = paymentRequestsForApp(app.id);

  // Open (or fall back to) an agent's conversation for a payment-request message.
  const messageAgent = (agentId: string) => {
    const c = convoForAgent(agentId);
    if (c) router.push(`/(explorer)/messages/${c.id}`);
    else router.push(`/(explorer)/agent/${agentId}`);
  };

  // Sticky / nudge action: perform the next step (self-service flow) when
  // actionable, otherwise open the agent conversation.
  const openConvo = () => { if (convo) router.push(`/(explorer)/messages/${convo.id}`); };
  const onNext = () => {
    if (actionable) router.push(`/(explorer)/self-service/${dest.id}`);
    else openConvo();
  };

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      {/* HERO (240) — fixed behind, parallaxes up at py * -0.3 as the sheet rises */}
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: HERO, overflow: 'hidden', backgroundColor: dest.tone }, heroStyle]}>
        <Image source={{ uri: dest.img }} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, width: '100%', height: '100%' }} contentFit="cover" transition={200} />
        {/* Scrim to top: rgba(12,10,8, .8 @0% → .2 @50% → .36 @100%) */}
        <LinearGradient
          colors={['rgba(12,10,8,0.8)', 'rgba(12,10,8,0.2)', 'rgba(12,10,8,0.36)']}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 1 }}
          end={{ x: 0.5, y: 0 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />

        {/* Hero caption (left/right 22, bottom 50) */}
        <View style={{ position: 'absolute', left: 22, right: 22, bottom: 50 }}>
          <View style={{ marginBottom: 9 }}>
            <StatusPill status={app.status} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Flag code={dest.flag} size={20} radius={5} />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', opacity: 0.95 }} numberOfLines={1}>
              {dest.country} · Ref {app.ref}
            </Text>
          </View>
          {/* Visa 28 Space Grotesk (600), letterSpacing -0.01em, marginTop 5 */}
          <Text
            style={{
              color: '#fff', fontFamily: EX.font.display.semibold, fontSize: 28, lineHeight: 32, letterSpacing: -0.28,
              marginTop: 5, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 14,
            }}
          >
            {dest.visa}
          </Text>
        </View>
      </Animated.View>

      {/* Top glass controls: back + message (source top 54 → insets.top + 6) */}
      <View style={{ position: 'absolute', top: insets.top + 6, left: 0, right: 0, zIndex: 50, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18 }}>
        <GlassButton icon={Ic.chevL} onPress={() => router.back()} />
        <GlassButton icon={Ic.msg} onPress={openConvo} />
      </View>

      {/* Scrolling content sheet */}
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* spacer revealing the hero (HERO - 26) */}
        <View style={{ height: HERO - 26 }} pointerEvents="none" />

        <View
          style={{
            backgroundColor: EX.color.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, minHeight: 600,
            paddingTop: 20, paddingHorizontal: 22, paddingBottom: EX.space.ctaClear,
            // Source boxShadow: 0 -8px 30px -14px rgba(23,19,38,0.26).
            shadowColor: '#171326', shadowOpacity: 0.26, shadowRadius: 15, shadowOffset: { width: 0, height: -8 },
          }}
        >
          {/* ── Dark "Next step" card (only when actionable) ────────────────── */}
          {actionable ? (
            <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: EX.color.ink, borderRadius: 18, padding: 15, marginBottom: 18 }, EXShadow.darkNudge]}>
              <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' }}>
                <Ic.upload size={19} color="#fff" strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '600' }}>Next step</Text>
                <Text style={{ fontSize: 14.5, color: '#fff', fontWeight: '700' }} numberOfLines={2}>{app.next.label}</Text>
              </View>
            </View>
          ) : null}

          {/* ── Progress header (marginBottom 14) ───────────────────────────── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: EX.color.ink, letterSpacing: -0.18 }}>Progress</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: EX.color.primary }}>{pct}% complete</Text>
          </View>

          {/* ── Timeline card (radius 22, padding 20, border rgba(23,19,38,0.07)) ── */}
          <View style={[{ backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(23,19,38,0.07)', borderRadius: 22, padding: 20 }, EXShadow.card]}>
            <Timeline steps={app.steps} />
          </View>

          {/* ── Payment requests (only when the agent has raised one) ────────── */}
          {payReqs.length > 0 ? (
            <>
              <Text style={{ fontSize: 18, fontWeight: '700', color: EX.color.ink, letterSpacing: -0.18, marginTop: 26, marginBottom: 12, marginHorizontal: 2 }}>Payment requests</Text>
              <View style={{ gap: 12 }}>
                {payReqs.map((req) => (
                  <View
                    key={req.id}
                    style={[
                      { backgroundColor: '#fff', borderWidth: 1, borderColor: EX.color.line06, borderRadius: 20, padding: 16 },
                      EXShadow.card,
                    ]}
                  >
                    {/* Header: coral chip + title, amount on the right */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: EX.color.primaryTint10 }}>
                        <Ic.cards size={18} color={EX.color.primary} strokeWidth={1.8} />
                      </View>
                      <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: EX.color.ink }} numberOfLines={2}>{req.title}</Text>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: EX.color.ink, letterSpacing: -0.16 }}>{NAIRA(req.amount)}</Text>
                    </View>

                    {/* Note + due line */}
                    <Text style={{ fontSize: 13, lineHeight: 19, color: EX.color.muted, marginTop: 12 }}>{req.note}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                      <Ic.clock size={13} color={EX.color.muted} strokeWidth={1.8} />
                      <Text style={{ fontSize: 12.5, color: EX.color.muted, fontWeight: '500' }}>{req.due}</Text>
                    </View>

                    {/* Actions: coral Pay now + outline Message */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
                      <Pressable
                        onPress={() => router.push({
                          pathname: '/(explorer)/pay',
                          params: {
                            type: 'application', agentId: req.agentId, dateIso: '', time: '',
                            topic: req.title, mode: '', dur: '', fee: String(req.amount),
                          },
                        })}
                        style={{ flex: 1, height: 46, borderRadius: 14, backgroundColor: EX.color.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, shadowColor: EX.color.primary, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 5 }}
                      >
                        <Text style={{ color: '#fff', fontSize: 14.5, fontWeight: '700' }}>Pay now</Text>
                        <Ic.arrow size={16} color="#fff" strokeWidth={1.8} />
                      </Pressable>
                      <Pressable
                        onPress={() => messageAgent(req.agentId)}
                        style={{ flex: 1, height: 46, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: EX.color.line12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }}
                      >
                        <Ic.msg size={16} color={EX.color.ink} strokeWidth={1.8} />
                        <Text style={{ color: EX.color.ink, fontSize: 14.5, fontWeight: '700' }}>Message</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {/* ── Your agent ───────────────────────────────────────────────────── */}
          <Text style={{ fontSize: 18, fontWeight: '700', color: EX.color.ink, letterSpacing: -0.18, marginTop: 26, marginBottom: 12, marginHorizontal: 2 }}>Your agent</Text>
          {agent ? (
            <Pressable
              onPress={() => router.push(`/(explorer)/agent/${agent.id}`)}
              style={[
                { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: '#fff', borderWidth: 1, borderColor: EX.color.line08, borderRadius: 20, padding: 14 },
                EXShadow.card,
              ]}
            >
              <Portrait seed={agent.seed} size={48} name={agent.n} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: EX.color.ink }} numberOfLines={1}>{agent.n}</Text>
                <Text style={{ fontSize: 12.5, color: EX.color.muted, marginTop: 2 }} numberOfLines={1}>
                  {agent.spec} · responds in {agent.resp}
                </Text>
              </View>
              {/* Message circle: 38, radius 19, coral tint .10 */}
              <Pressable
                onPress={openConvo}
                hitSlop={8}
                style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: EX.color.primaryTint10, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ic.msg size={18} color={EX.color.primary} strokeWidth={1.8} />
              </Pressable>
            </Pressable>
          ) : null}
        </View>
      </Animated.ScrollView>

      {/* ── Sticky coral CTA (bar padding 15/22, glass rgba(251,247,240,0.8)) ── */}
      <BlurView
        intensity={30}
        tint="light"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 15, paddingHorizontal: 22, paddingBottom: Math.max(insets.bottom, 16) + 8, backgroundColor: 'rgba(251,247,240,0.8)', borderTopWidth: 1, borderTopColor: EX.color.line06 }}
      >
        <Pressable
          onPress={onNext}
          style={{ height: 54, borderRadius: 16, backgroundColor: EX.color.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: EX.color.primary, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 12 }, elevation: 6 }}
        >
          <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '700' }}>{app.next.cta ?? 'Message your agent'}</Text>
          <Ic.arrow size={18} color="#fff" strokeWidth={1.8} />
        </Pressable>
      </BlurView>
    </View>
  );
}
