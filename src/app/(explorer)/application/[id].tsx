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

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, EXShadow, displayText } from '@/components/explorer/theme';
import {
  AppStep,
  CONVOS,
  NAIRA,
  agentById,
  appById,
  convoForAgent,
  destById,
  paymentRequestsForApp,
} from '@/components/explorer/data';
import {
  mapApplication,
  mapTimeline,
} from '@/components/explorer/liveApplications';
import { fmtDate } from '@/components/explorer/liveDate';
import {
  useApplication,
  useApplicationTimeline,
} from '@/hooks/useApplications';
// Live payment-request read + approve/reject mutations (client side of the flow).
import {
  useApprovePaymentRequest,
  usePaymentRequests,
  useRejectPaymentRequest,
} from '@/hooks/usePaymentRequests';
import {
  CATEGORY_LABELS,
  PaymentRequestStatus,
} from '@/types/payment-requests.type';
import { Ic } from '@/components/explorer/icons';
import {
  Flag,
  GlassButton,
  Pill,
  Portrait,
  StatusPill,
} from '@/components/explorer/primitives';

// Preset reasons a client can pick when declining an agent-raised payment request.
const REJECT_REASONS = [
  'Amount is higher than expected',
  'I need more detail on what this covers',
  'I’ve already paid for this',
  'I no longer need this service',
  'Other',
];

const HERO = 240;

// ── Unified payment-request row ──────────────────────────────────────────────
// Demo fixtures and live backend requests are both mapped to this single shape so
// the card renders identically. `live` tells the approve/reject handlers whether
// to fire the real backend mutations (demo rows stay local-only). `amount` is the
// display value in whole naira (live rows are pre-divided from kobo).
type PayReqRow = {
  id: string;
  title: string;
  amount: number;
  agentId: string;
  agentName?: string;
  status: 'pending' | 'approved' | 'rejected';
  due: string;
  note: string;
  live: boolean;
};

// ── Timeline — detailed activity stepper ─────────────────────────────────────
// Each event carries a title, a description, and a "date · actor" line. The dot
// colour encodes the actor / state: green = you, blue = agent, teal = system,
// grey (hollow) = upcoming. The `current` step gets a soft ring highlight.
const ACTOR_LABEL: Record<string, string> = {
  you: 'You',
  agent: 'agent',
  system: 'system',
};
function Timeline({ steps }: { steps: AppStep[] }) {
  return (
    <View>
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        const isNext = step.s === 'next';
        const isCurrent = step.s === 'current';
        // Dot colour by actor (upcoming steps are neutral grey).
        const dot = isNext
          ? 'rgba(23,19,38,0.22)'
          : step.by === 'you'
            ? EX.color.success
            : step.by === 'agent'
              ? '#2F62A0'
              : EX.color.tealDeep;
        const actor = ACTOR_LABEL[step.by ?? 'system'] ?? 'system';

        return (
          <View
            key={`${step.t}-${i}`}
            style={{
              flexDirection: 'row',
              gap: 14,
              paddingBottom: last ? 0 : 20,
            }}
          >
            {/* Marker + connector column */}
            <View style={{ alignItems: 'center', width: 14 }}>
              <View
                style={{
                  width: 14,
                  height: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 3,
                }}
              >
                {/* soft ring on the in-progress step */}
                {isCurrent ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: -4,
                      left: -4,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: `${dot}22`,
                    }}
                  />
                ) : null}
                <View
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: 6.5,
                    backgroundColor: isNext ? '#fff' : dot,
                    borderWidth: isNext ? 2 : 0,
                    borderColor: dot,
                  }}
                />
              </View>
              {/* faint connector line */}
              {!last ? (
                <View
                  style={{
                    width: 2,
                    flex: 1,
                    minHeight: 22,
                    marginTop: 4,
                    borderRadius: 1,
                    backgroundColor: 'rgba(23,19,38,0.1)',
                  }}
                />
              ) : null}
            </View>

            {/* Event content */}
            <View style={{ flex: 1, paddingBottom: 2 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '700',
                  color: isNext ? EX.color.muted : EX.color.ink,
                  letterSpacing: -0.1,
                }}
              >
                {step.t}
              </Text>
              {step.desc ? (
                <Text
                  style={{
                    fontSize: 13.5,
                    lineHeight: 19.5,
                    color: EX.color.inkMuted,
                    marginTop: 3,
                  }}
                >
                  {step.desc}
                </Text>
              ) : null}
              <Text
                style={{
                  fontSize: 12.5,
                  color: EX.color.muted,
                  fontWeight: '500',
                  marginTop: 5,
                }}
              >
                {step.d} · {actor}
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

  // ── Resolve demo-first, else fetch live (GET /applications/:id) ─────────────
  // The single-item hooks are disabled (empty id) on the demo path so we never
  // hit the backend for a static application.
  const demo = appById(id);
  const liveQ = useApplication(demo ? '' : id);
  const tl = useApplicationTimeline(demo ? '' : id);
  const app = demo ?? (liveQ.data ? mapApplication(liveQ.data) : undefined);
  // Live apps carry a resolved `dest`; demo apps resolve from static DESTS.
  const dest = app?.dest ?? destById(app?.destId);
  const agent = agentById(app?.agentId);
  // Find the agent's conversation (matched by agentId) for the message actions.
  const convo = app ? CONVOS.find((c) => c.agentId === app.agentId) : undefined;

  // Parallax: hero translates up at py * -0.3 (source transform translateY).
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const heroStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scrollY.value * -0.3 }],
  }));

  // Local approve / reject decision per agent-raised payment request (demo state,
  // keyed by request id; falls back to the request's own status).
  const [reqOverride, setReqOverride] = useState<
    Record<string, 'pending' | 'approved' | 'rejected'>
  >({});
  // Reason captured when the client declines a request (id → reason).
  const [reqReason, setReqReason] = useState<Record<string, string>>({});
  // Reject-reason modal: which request is being declined, + the picked reason.
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reasonSel, setReasonSel] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState('');

  // ── Payment requests (live-with-demo-fallback) ──────────────────────────────
  // For a live application, fetch this client's requests scoped to the route id
  // (GET /payment-requests?role=client&applicationId=…). Demo apps keep the static
  // PAYMENT_REQUESTS fixtures. Mutation hooks are created here (top level, before
  // any early return) so approve/reject can fire the real backend calls.
  const payReqQ = usePaymentRequests(id);
  const approveReq = useApprovePaymentRequest();
  const rejectReq = useRejectPaymentRequest();

  const payReqs = useMemo<PayReqRow[]>(() => {
    // Backend PaymentRequestStatus → the card's 3-state badge/action model.
    const toRowStatus = (
      s: PaymentRequestStatus,
    ): 'pending' | 'approved' | 'rejected' =>
      s === 'approved' || s === 'paid'
        ? 'approved'
        : s === 'rejected' || s === 'cancelled' || s === 'expired'
          ? 'rejected'
          : 'pending';

    // Live path: real requests for this application (defensively re-filtered by id).
    if (!demo && app) {
      return (payReqQ.data ?? [])
        .filter((r) => r.applicationId === app.id)
        .map<PayReqRow>((r) => ({
          id: r.id,
          title: CATEGORY_LABELS[r.category] ?? 'Payment request',
          // Backend amount is in kobo → divide by 100 for the ₦ display value.
          amount: Math.round(r.amount / 100),
          agentId: r.agentId,
          // Backend request carries no agent name; card falls back gracefully.
          agentName: undefined,
          status: toRowStatus(r.status),
          due: r.expiresAt ? `Due ${fmtDate(r.expiresAt, 'MMM d')}` : '',
          note: r.description,
          live: true,
        }));
    }

    // Demo path: static fixtures keep their existing display fields verbatim.
    if (app) {
      return paymentRequestsForApp(app.id).map<PayReqRow>((r) => ({
        id: r.id,
        title: r.title,
        amount: r.amount,
        agentId: r.agentId,
        agentName: undefined,
        // Demo status is 'pending' | 'paid' — both render as Pending (unchanged).
        status: r.status === 'paid' ? 'pending' : r.status,
        due: r.due,
        note: r.note,
        live: false,
      }));
    }
    return [];
  }, [demo, app, payReqQ.data]);

  // Spinner while the live application is still loading (demo path is instant).
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

  if (!app || !dest) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: EX.color.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: EX.color.muted }}>Application not found.</Text>
      </View>
    );
  }

  // Timeline: live events (mapped) when present, else the demo app's own steps.
  const steps: AppStep[] =
    !demo && tl.data?.length ? mapTimeline(tl.data) : app.steps;

  const pct = Math.round(app.progress * 100);
  const actionable = app.next.cta != null;

  // Open (or fall back to) an agent's conversation for a payment-request message.
  const messageAgent = (agentId: string) => {
    const c = convoForAgent(agentId);
    if (c) router.push(`/(explorer)/messages/${c.id}`);
    else router.push(`/(explorer)/agent/${agentId}`);
  };

  // Reject-reason modal controls.
  const closeReject = () => {
    setRejectId(null);
    setReasonSel(null);
    setReasonText('');
  };
  const confirmReject = () => {
    if (!rejectId) return;
    const reason = reasonSel === 'Other' ? reasonText.trim() : reasonSel;
    if (!reason) return; // guarded by the disabled button, but keep it safe
    // For a live request, reject on the backend (auto-creates a chat with the
    // reason). Demo requests only update local state.
    const target = payReqs.find((r) => r.id === rejectId);
    if (target?.live) rejectReq.mutate({ requestId: rejectId, reason });
    setReqOverride((s) => ({ ...s, [rejectId]: 'rejected' }));
    setReqReason((r) => ({ ...r, [rejectId]: reason }));
    closeReject();
  };

  // Sticky / nudge action: perform the next step (self-service flow) when
  // actionable, otherwise open the agent conversation.
  const openConvo = () => {
    if (convo) router.push(`/(explorer)/messages/${convo.id}`);
  };
  const onNext = () => {
    if (actionable) router.push(`/(explorer)/self-service/${dest.id}`);
    else openConvo();
  };

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      {/* HERO (240) — fixed behind, parallaxes up at py * -0.3 as the sheet rises */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: HERO,
            overflow: 'hidden',
            backgroundColor: dest.tone,
          },
          heroStyle,
        ]}
      >
        <Image
          source={{ uri: dest.img }}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
          }}
          contentFit="cover"
          transition={200}
        />
        {/* Scrim to top: rgba(12,10,8, .8 @0% → .2 @50% → .36 @100%) */}
        <LinearGradient
          colors={[
            'rgba(12,10,8,0.8)',
            'rgba(12,10,8,0.2)',
            'rgba(12,10,8,0.36)',
          ]}
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
            <Text
              style={{
                color: '#fff',
                fontSize: 13,
                fontWeight: '600',
                opacity: 0.95,
              }}
              numberOfLines={1}
            >
              {dest.country} · Ref {app.ref}
            </Text>
          </View>
          {/* Visa 28 Space Grotesk (600), letterSpacing -0.01em, marginTop 5 */}
          <Text
            style={{
              color: '#fff',
              fontFamily: EX.font.display.semibold,
              fontSize: 28,
              lineHeight: 32,
              letterSpacing: -0.28,
              marginTop: 5,
              textShadowColor: 'rgba(0,0,0,0.3)',
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 14,
            }}
          >
            {dest.visa}
          </Text>
        </View>
      </Animated.View>

      {/* Top glass controls: back + message (source top 54 → insets.top + 6) */}
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
            backgroundColor: EX.color.bg,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            minHeight: 600,
            paddingTop: 20,
            paddingHorizontal: 22,
            paddingBottom: EX.space.ctaClear,
            // Source boxShadow: 0 -8px 30px -14px rgba(23,19,38,0.26).
            shadowColor: '#171326',
            shadowOpacity: 0.26,
            shadowRadius: 15,
            shadowOffset: { width: 0, height: -8 },
          }}
        >
          {/* ── Dark "Next step" card (only when actionable) ────────────────── */}
          {actionable ? (
            <View
              style={[
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: EX.color.ink,
                  borderRadius: 18,
                  padding: 15,
                  marginBottom: 18,
                },
                EXShadow.darkNudge,
              ]}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.12)',
                }}
              >
                <Ic.upload size={19} color="#fff" strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.6)',
                    fontWeight: '600',
                  }}
                >
                  Next step
                </Text>
                <Text
                  style={{ fontSize: 14.5, color: '#fff', fontWeight: '700' }}
                  numberOfLines={2}
                >
                  {app.next.label}
                </Text>
              </View>
            </View>
          ) : null}

          {/* ── Progress header (marginBottom 14) ───────────────────────────── */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
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
              Timeline
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: EX.color.primary,
              }}
            >
              {pct}% complete
            </Text>
          </View>

          {/* ── Timeline card (radius 22, padding 20, border rgba(23,19,38,0.07)) ── */}
          <View
            style={[
              {
                backgroundColor: '#fff',
                borderWidth: 1,
                borderColor: 'rgba(23,19,38,0.07)',
                borderRadius: 22,
                padding: 20,
              },
              EXShadow.card,
            ]}
          >
            <Timeline steps={steps} />
          </View>

          {/* ── Payment requests (only when the agent has raised one) ────────── */}
          {payReqs.length > 0 ? (
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
                Payment requests
              </Text>
              <View style={{ gap: 12 }}>
                {payReqs.map((req) => (
                  <View
                    key={req.id}
                    style={[
                      {
                        backgroundColor: '#fff',
                        borderWidth: 1,
                        borderColor: EX.color.line06,
                        borderRadius: 20,
                        padding: 16,
                      },
                      EXShadow.card,
                    ]}
                  >
                    {/* Header: coral chip + title, amount on the right */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 12,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: EX.color.primaryTint10,
                        }}
                      >
                        <Ic.cards
                          size={18}
                          color={EX.color.primary}
                          strokeWidth={1.8}
                        />
                      </View>
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 15,
                          fontWeight: '700',
                          color: EX.color.ink,
                        }}
                        numberOfLines={2}
                      >
                        {req.title}
                      </Text>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: '700',
                          color: EX.color.ink,
                          letterSpacing: -0.16,
                        }}
                      >
                        {NAIRA(req.amount)}
                      </Text>
                    </View>

                    {/* Attribution — this is an agent-raised request awaiting the client's approval */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 7,
                        marginTop: 12,
                      }}
                    >
                      <Portrait
                        seed={agentById(req.agentId)?.seed ?? 0}
                        size={22}
                        name={req.agentName ?? agentById(req.agentId)?.n ?? 'Agent'}
                      />
                      <Text
                        style={{
                          fontSize: 12.5,
                          color: EX.color.muted,
                          fontWeight: '500',
                        }}
                      >
                        Requested by{' '}
                        {req.agentName ?? agentById(req.agentId)?.n ?? 'your agent'}
                      </Text>
                    </View>

                    {/* Note */}
                    <Text
                      style={{
                        fontSize: 13,
                        lineHeight: 19,
                        color: EX.color.muted,
                        marginTop: 10,
                      }}
                    >
                      {req.note}
                    </Text>

                    {/* Due + decision status badge */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 10,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Ic.clock
                          size={13}
                          color={EX.color.muted}
                          strokeWidth={1.8}
                        />
                        <Text
                          style={{
                            fontSize: 12.5,
                            color: EX.color.muted,
                            fontWeight: '500',
                          }}
                        >
                          {req.due}
                        </Text>
                      </View>
                      {(() => {
                        const st = reqOverride[req.id] ?? req.status;
                        const b =
                          st === 'approved'
                            ? {
                                label: 'Approved',
                                fg: '#1E8E55',
                                bg: '#D6F2E2',
                              }
                            : st === 'rejected'
                              ? {
                                  label: 'Declined',
                                  fg: EX.color.muted,
                                  bg: 'rgba(23,19,38,0.06)',
                                }
                              : {
                                  label: 'Pending',
                                  fg: '#B26A14',
                                  bg: '#FCEAC8',
                                };
                        return (
                          <Pill label={b.label} fg={b.fg} bg={b.bg} small />
                        );
                      })()}
                    </View>

                    {/* Actions by decision state */}
                    {(() => {
                      const st = reqOverride[req.id] ?? req.status;
                      const setSt = (v: 'pending' | 'approved' | 'rejected') =>
                        setReqOverride((s) => ({ ...s, [req.id]: v }));
                      const toPay = () =>
                        router.push({
                          pathname: '/(explorer)/pay',
                          params: {
                            type: 'application',
                            agentId: req.agentId,
                            dateIso: '',
                            time: '',
                            topic: req.title,
                            mode: '',
                            dur: '',
                            fee: String(req.amount),
                          },
                        });
                      if (st === 'pending') {
                        return (
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 10,
                              marginTop: 14,
                            }}
                          >
                            {/* Approve — confirm, then move to the approved state */}
                            <Pressable
                              onPress={() =>
                                Alert.alert(
                                  'Approve request',
                                  `Approve ${NAIRA(req.amount)} for “${req.title}”?`,
                                  [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                      text: 'Approve',
                                      onPress: () => {
                                        // Live request → approve on the backend
                                        // (releases escrow); demo stays local.
                                        if (req.live) approveReq.mutate(req.id);
                                        setSt('approved');
                                      },
                                    },
                                  ],
                                )
                              }
                              style={{
                                flex: 1,
                                height: 46,
                                borderRadius: 14,
                                backgroundColor: EX.color.primary,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 7,
                                shadowColor: EX.color.primary,
                                shadowOpacity: 0.4,
                                shadowRadius: 12,
                                shadowOffset: { width: 0, height: 8 },
                                elevation: 5,
                              }}
                            >
                              <Ic.check
                                size={16}
                                color="#fff"
                                strokeWidth={2.2}
                              />
                              <Text
                                style={{
                                  color: '#fff',
                                  fontSize: 14.5,
                                  fontWeight: '700',
                                }}
                              >
                                Approve
                              </Text>
                            </Pressable>
                            {/* Reject — confirm, then move to the declined state */}
                            <Pressable
                              onPress={() => {
                                setRejectId(req.id);
                                setReasonSel(null);
                                setReasonText('');
                              }}
                              style={{
                                flex: 1,
                                height: 46,
                                borderRadius: 14,
                                backgroundColor: '#fff',
                                borderWidth: 1,
                                borderColor: EX.color.line12,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 7,
                              }}
                            >
                              <Ic.x
                                size={16}
                                color={EX.color.danger}
                                strokeWidth={2}
                              />
                              <Text
                                style={{
                                  color: EX.color.danger,
                                  fontSize: 14.5,
                                  fontWeight: '700',
                                }}
                              >
                                Reject
                              </Text>
                            </Pressable>
                          </View>
                        );
                      }
                      if (st === 'approved') {
                        return (
                          <>
                            <Text
                              style={{
                                fontSize: 12.5,
                                color: EX.color.inkMuted,
                                marginTop: 12,
                              }}
                            >
                              You approved this request — complete payment to
                              continue.
                            </Text>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 10,
                                marginTop: 12,
                              }}
                            >
                              <Pressable
                                onPress={toPay}
                                style={{
                                  flex: 1,
                                  height: 46,
                                  borderRadius: 14,
                                  backgroundColor: EX.color.primary,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 7,
                                  shadowColor: EX.color.primary,
                                  shadowOpacity: 0.4,
                                  shadowRadius: 12,
                                  shadowOffset: { width: 0, height: 8 },
                                  elevation: 5,
                                }}
                              >
                                <Text
                                  style={{
                                    color: '#fff',
                                    fontSize: 14.5,
                                    fontWeight: '700',
                                  }}
                                >
                                  Complete payment
                                </Text>
                                <Ic.arrow
                                  size={16}
                                  color="#fff"
                                  strokeWidth={1.8}
                                />
                              </Pressable>
                              <Pressable
                                onPress={() => messageAgent(req.agentId)}
                                style={{
                                  width: 46,
                                  height: 46,
                                  borderRadius: 14,
                                  backgroundColor: '#fff',
                                  borderWidth: 1,
                                  borderColor: EX.color.line12,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Ic.msg
                                  size={17}
                                  color={EX.color.ink}
                                  strokeWidth={1.8}
                                />
                              </Pressable>
                            </View>
                          </>
                        );
                      }
                      // rejected
                      return (
                        <>
                          <Text
                            style={{
                              fontSize: 12.5,
                              color: EX.color.inkMuted,
                              marginTop: 12,
                            }}
                          >
                            You declined this request
                            {reqReason[req.id]
                              ? ` — “${reqReason[req.id]}”`
                              : ''}
                            .
                          </Text>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 10,
                              marginTop: 12,
                            }}
                          >
                            <Pressable
                              onPress={() => setSt('pending')}
                              style={{
                                flex: 1,
                                height: 46,
                                borderRadius: 14,
                                backgroundColor: '#fff',
                                borderWidth: 1,
                                borderColor: EX.color.line12,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Text
                                style={{
                                  color: EX.color.ink,
                                  fontSize: 14.5,
                                  fontWeight: '700',
                                }}
                              >
                                Undo
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() => messageAgent(req.agentId)}
                              style={{
                                flex: 1,
                                height: 46,
                                borderRadius: 14,
                                backgroundColor: '#fff',
                                borderWidth: 1,
                                borderColor: EX.color.line12,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 7,
                              }}
                            >
                              <Ic.msg
                                size={16}
                                color={EX.color.ink}
                                strokeWidth={1.8}
                              />
                              <Text
                                style={{
                                  color: EX.color.ink,
                                  fontSize: 14.5,
                                  fontWeight: '700',
                                }}
                              >
                                Message
                              </Text>
                            </Pressable>
                          </View>
                        </>
                      );
                    })()}
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {/* ── Your agent ───────────────────────────────────────────────────── */}
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
            Your agent
          </Text>
          {agent ? (
            <Pressable
              onPress={() => router.push(`/(explorer)/agent/${agent.id}`)}
              style={[
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 13,
                  backgroundColor: '#fff',
                  borderWidth: 1,
                  borderColor: EX.color.line08,
                  borderRadius: 20,
                  padding: 14,
                },
                EXShadow.card,
              ]}
            >
              <Portrait seed={agent.seed} size={48} name={agent.n} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '700',
                    color: EX.color.ink,
                  }}
                  numberOfLines={1}
                >
                  {agent.n}
                </Text>
                <Text
                  style={{
                    fontSize: 12.5,
                    color: EX.color.muted,
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  {agent.spec} · responds in {agent.resp}
                </Text>
              </View>
              {/* Message circle: 38, radius 19, coral tint .10 */}
              <Pressable
                onPress={openConvo}
                hitSlop={8}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: EX.color.primaryTint10,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
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
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingTop: 15,
          paddingHorizontal: 22,
          paddingBottom: Math.max(insets.bottom, 16) + 8,
          backgroundColor: 'rgba(251,247,240,0.8)',
          borderTopWidth: 1,
          borderTopColor: EX.color.line06,
        }}
      >
        <Pressable
          onPress={onNext}
          style={{
            height: 54,
            borderRadius: 16,
            backgroundColor: EX.color.primary,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            shadowColor: EX.color.primary,
            shadowOpacity: 0.5,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 12 },
            elevation: 6,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '700' }}>
            {app.next.cta ?? 'Message your agent'}
          </Text>
          <Ic.arrow size={18} color="#fff" strokeWidth={1.8} />
        </Pressable>
      </BlurView>

      {/* ── Reject-reason modal (agent request → client must give a reason) ───── */}
      <Modal
        visible={!!rejectId}
        transparent
        animationType="fade"
        onRequestClose={closeReject}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={closeReject}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              backgroundColor: 'rgba(12,10,8,0.45)',
            }}
          />
          <View
            style={{
              backgroundColor: EX.color.bg,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingTop: 10,
              paddingHorizontal: 22,
              paddingBottom: Math.max(insets.bottom, 16) + 12,
            }}
          >
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
            <Text style={[displayText(20, 'semibold'), { marginBottom: 4 }]}>
              Reason for declining
            </Text>
            <Text
              style={{
                fontSize: 13.5,
                color: EX.color.inkMuted,
                marginBottom: 16,
              }}
            >
              Your agent will see this so they can follow up.
            </Text>

            {REJECT_REASONS.map((r) => {
              const on = reasonSel === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => setReasonSel(r)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 13,
                    paddingHorizontal: 15,
                    borderRadius: 14,
                    marginBottom: 9,
                    borderWidth: 1.5,
                    borderColor: on ? EX.color.primary : EX.color.line12,
                    backgroundColor: on ? EX.color.primaryTint07 : '#fff',
                  }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderWidth: 2,
                      borderColor: on ? EX.color.primary : 'rgba(23,19,38,0.2)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {on ? (
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: EX.color.primary,
                        }}
                      />
                    ) : null}
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 14.5,
                      fontWeight: '600',
                      color: EX.color.ink,
                    }}
                  >
                    {r}
                  </Text>
                </Pressable>
              );
            })}

            {reasonSel === 'Other' ? (
              <TextInput
                value={reasonText}
                onChangeText={setReasonText}
                placeholder="Tell your agent more…"
                placeholderTextColor={EX.color.muted}
                multiline
                maxLength={300}
                style={{
                  minHeight: 72,
                  borderWidth: 1,
                  borderColor: EX.color.line12,
                  borderRadius: 14,
                  padding: 14,
                  fontSize: 14.5,
                  color: EX.color.ink,
                  backgroundColor: '#fff',
                  textAlignVertical: 'top',
                  marginBottom: 4,
                }}
              />
            ) : null}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <Pressable
                onPress={closeReject}
                style={{
                  flex: 1,
                  height: 52,
                  borderRadius: 16,
                  backgroundColor: '#fff',
                  borderWidth: 1,
                  borderColor: EX.color.line12,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    color: EX.color.ink,
                    fontSize: 15,
                    fontWeight: '700',
                  }}
                >
                  Cancel
                </Text>
              </Pressable>
              {(() => {
                const ok =
                  !!reasonSel &&
                  (reasonSel !== 'Other' || reasonText.trim().length > 0);
                return (
                  <Pressable
                    onPress={confirmReject}
                    disabled={!ok}
                    style={{
                      flex: 1,
                      height: 52,
                      borderRadius: 16,
                      backgroundColor: ok
                        ? EX.color.danger
                        : 'rgba(217,66,91,0.4)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}
                    >
                      Decline request
                    </Text>
                  </Pressable>
                );
              })()}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
