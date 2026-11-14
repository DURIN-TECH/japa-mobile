// ─────────────────────────────────────────────────────────────────────────────
// Application detail (prototype applications.jsx AppDetail).
//
// Parallax photo hero (240) + rounded content sheet + sticky coral CTA. The hero
// translates up at py * -0.3 (Reanimated stands in for the source's scroll
// listener). Sheet holds: a dark "Next step" nudge (when actionable), a Progress
// header, a vertical Timeline stepper, and a "Your agent" row. The sticky CTA
// performs the next step or messages the agent.
//
// japa#106: a case on an agency-only visa shows the visa's real name (the
// backend's denormalised `visaTypeName`, else the visa detail, which the
// applicant may read because they have a case on it) and a "Visa details"
// link row. A 404 shows the not-found EmptyState; other load failures show
// an InlineError with "Try again".
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
import { NAIRA } from '@/components/explorer/content';
import type { AppStep } from '@/types/explorer.type';
// japa#145: the case's agent and their conversation come from the backend
// (GET /agents/:id, GET /conversations), never the demo AGENTS / CONVOS.
import { mapAgent } from '@/components/explorer/liveAgents';
import { useAgent } from '@/hooks/useAgents';
import { useConversations } from '@/hooks/useMessaging';
import {
  mapApplication,
  mapTimeline,
} from '@/components/explorer/liveApplications';
import { fmtDate } from '@/components/explorer/liveDate';
import {
  useApplication,
  useApplicationTimeline,
} from '@/hooks/useApplications';
import { isNotFoundError } from '@/hooks/queryErrors';
import { useVisaType } from '@/hooks/useVisaTypes';
import { CenteredState } from '@/components/explorer/CenteredState';
import { InlineError } from '@/components/explorer/AccountForm';
import {
  PAYMENT_ERROR_MESSAGE,
  getAuthorizationUrl,
  getPaystackReference,
} from '@/hooks/paymentRequestFlow';
// Live payment-request read + approve/reject mutations (client side of the flow).
// Approve starts a Paystack charge; the pay screen verifies it (japa#145).
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
import { PressableStatic } from '@/components/explorer/PressableStatic';
import { dedupeSteps, trimSteps } from '@/components/explorer/timelineTrim';
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

// Copy of a keyed record without one key (rollback of per-request state).
function omitKey<T>(rec: Record<string, T>, key: string): Record<string, T> {
  const next = { ...rec };
  delete next[key];
  return next;
}

// ── Unified payment-request row ──────────────────────────────────────────────
// Backend payment requests (GET /payment-requests) mapped to the card's shape.
// `amount` is the display value in whole naira (pre-divided from kobo).
type PayReqRow = {
  id: string;
  title: string;
  amount: number;
  agentId: string;
  agentName?: string;
  status: 'pending' | 'approved' | 'rejected';
  // Backend status is 'paid' (settled): show it as paid, no checkout button.
  paid: boolean;
  // Paystack reference minted at approve time; needed to verify the charge.
  reference?: string;
  due: string;
  note: string;
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

  // ── The case (GET /applications/:id) and its timeline ─────────────────────
  // japa#145: live only; an unknown id is the backend 404 → not-found.
  const liveQ = useApplication(id ?? '');
  const tl = useApplicationTimeline(id ?? '');
  // japa#106: when the case has no denormalised visa name, fetch the visa
  // detail for it (allowed: the user has a case on this visa, #102). The
  // query stays disabled otherwise (empty ids).
  const needsVisaName = !!liveQ.data && !liveQ.data.visaTypeName;
  const visaNameQ = useVisaType(
    needsVisaName ? (liveQ.data?.countryCode ?? '') : '',
    needsVisaName ? (liveQ.data?.visaTypeId ?? '') : '',
  );
  const app = liveQ.data
    ? mapApplication(liveQ.data, undefined, visaNameQ.data?.visaType?.name)
    : undefined;
  // Mapped cases carry a self-contained `dest` (assets-module art).
  const dest = app?.dest;
  // The assigned agent (none for a self-service case → the row's empty copy).
  const agentQ = useAgent(app?.agentId || undefined);
  const agent = agentQ.data ? mapAgent(agentQ.data) : undefined;
  // The user's conversation with that agent, for the message actions.
  const { data: conversations } = useConversations();
  const convo = app?.agentId
    ? conversations?.find((c) => c.agentId === app.agentId)
    : undefined;

  // Parallax: hero translates up at py * -0.3 (source transform translateY).
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const heroStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scrollY.value * -0.3 }],
  }));

  // Optimistic approve / reject decision per request (keyed by id). The backend
  // mutation fires too; on FAILURE the entry is rolled back (see rollbackReq)
  // and an InlineError is shown, so the card never states a decision the
  // server doesn't have. The list refetches on success.
  const [reqOverride, setReqOverride] = useState<
    Record<string, 'pending' | 'approved' | 'rejected'>
  >({});
  // Reason captured when the client declines a request (id → reason).
  const [reqReason, setReqReason] = useState<Record<string, string>>({});
  // Failure copy per request (shown as an InlineError under the card actions).
  const [reqError, setReqError] = useState<Record<string, string>>({});
  // Request currently being approved (disables a second tap mid-flight).
  const [approvingId, setApprovingId] = useState<string | null>(null);
  // japa#274: Timeline "Show all (N)" / "Show less" (collapsed by default).
  const [timelineOpen, setTimelineOpen] = useState(false);
  // Reject-reason modal: which request is being declined, + the picked reason.
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reasonSel, setReasonSel] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState('');

  // ── Payment requests (GET /payment-requests?role=client&applicationId=…) ────
  // Mutation hooks are created here (top level, before any early return) so
  // approve/reject fire the real backend calls. None → the block is hidden.
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

    // Real requests for this application (defensively re-filtered by id).
    if (app) {
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
          paid: r.status === 'paid',
          reference: r.paystackReference,
          due: r.expiresAt ? `Due ${fmtDate(r.expiresAt, 'MMM d')}` : '',
          note: r.description,
        }));
    }
    return [];
  }, [app, payReqQ.data]);

  // Spinner while the case is loading with nothing cached.
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

  // Load failure that isn't a 404 (offline, server error) with nothing
  // cached: say so and offer a retry instead of claiming it doesn't exist.
  if (liveQ.isError && !liveQ.data && !isNotFoundError(liveQ.error)) {
    return (
      <CenteredState
        icon={Ic.docs}
        title="We couldn’t load this application"
        errorMessage="Check your connection and try again."
        onRetry={() => liveQ.refetch()}
        retrying={liveQ.isRefetching}
        actionLabel="Back to your journey"
        onAction={() => router.replace('/(tabs)/tracker')}
      />
    );
  }

  // Not found: the backend 404 (closed, or another account's), or no data.
  if (!app || !dest) {
    return (
      <CenteredState
        icon={Ic.docs}
        title="We couldn’t find this application"
        body="It may have been closed, or it belongs to another account."
        actionLabel="Back to your journey"
        onAction={() => router.replace('/(tabs)/tracker')}
      />
    );
  }

  // Timeline: the case's live events ([] while loading or when none).
  // japa#274: identical consecutive entries collapse, then only the newest 3
  // show until the user taps "Show all (N)".
  const steps: AppStep[] = dedupeSteps(
    tl.data?.length ? mapTimeline(tl.data) : app.steps,
  );
  const {
    visible: shownSteps,
    total: totalSteps,
    canToggle,
  } = trimSteps(steps, timelineOpen);

  const pct = Math.round(app.progress * 100);
  const actionable = app.next.cta != null;

  // Open the agent's live conversation, else their profile.
  const messageAgent = (agentId: string) => {
    const c = conversations?.find((x) => x.agentId === agentId);
    if (c) router.push(`/messages/${c.id}`);
    else router.push(`/agent/${agentId}`);
  };

  // Reject-reason modal controls.
  const closeReject = () => {
    setRejectId(null);
    setReasonSel(null);
    setReasonText('');
  };
  // Undo an optimistic decision for one request after a failed write.
  const rollbackReq = (reqId: string, message: string) => {
    setReqOverride((s) => {
      return omitKey(s, reqId);
    });
    setReqReason((r) => {
      return omitKey(r, reqId);
    });
    setReqError((e) => ({ ...e, [reqId]: message }));
  };
  const clearReqError = (reqId: string) =>
    setReqError((e) => {
      return omitKey(e, reqId);
    });

  const confirmReject = async () => {
    if (!rejectId) return;
    const reqId = rejectId;
    const reason = reasonSel === 'Other' ? reasonText.trim() : reasonSel;
    if (!reason) return; // guarded by the disabled button, but keep it safe
    clearReqError(reqId);
    // Optimistic: show Declined at once, roll back if the backend refuses.
    setReqOverride((s) => ({ ...s, [reqId]: 'rejected' }));
    setReqReason((r) => ({ ...r, [reqId]: reason }));
    closeReject();
    try {
      // Reject on the backend (auto-creates a chat with the reason).
      await rejectReq.mutateAsync({ requestId: reqId, reason });
    } catch {
      rollbackReq(
        reqId,
        'We couldn’t decline this request. Nothing changed. Try again.',
      );
    }
  };

  // Approve = client consent. The backend marks the request approved and
  // returns a Paystack `authorizationUrl` + `paystackReference`; NO money has
  // moved yet. We hand off to /pay, which opens the checkout and verifies the
  // charge (POST /payment-requests/:id/verify) before it shows a confirmation.
  const approveRequest = async (req: PayReqRow) => {
    if (approvingId) return;
    clearReqError(req.id);
    setApprovingId(req.id);
    // Optimistic: show Approved at once, roll back if the backend refuses.
    setReqOverride((s) => ({ ...s, [req.id]: 'approved' }));
    let result: Awaited<ReturnType<typeof approveReq.mutateAsync>>;
    try {
      result = await approveReq.mutateAsync(req.id);
    } catch {
      setApprovingId(null);
      rollbackReq(
        req.id,
        'We couldn’t approve this request. Nothing changed. Try again.',
      );
      return;
    }
    setApprovingId(null);
    const url = getAuthorizationUrl(result);
    const reference = getPaystackReference(result);
    // The server DID approve, so the row stays Approved. Without a checkout
    // URL / reference the payment can't start; say so (never fake success).
    if (!url || !reference) {
      setReqError((e) => ({ ...e, [req.id]: PAYMENT_ERROR_MESSAGE }));
      return;
    }
    // japa#252: /pay opens the checkout itself (autoOpen) in the in-app
    // auth browser, which returns to the app after paying, then verifies.
    toPay(req, reference, url, true);
  };

  // Open the pay screen for an approved request: it verifies the Paystack
  // charge by `reference`, and can reopen checkout via `authorizationUrl`.
  // `autoOpen` (japa#252): open Paystack as soon as /pay mounts (right after
  // approve); a later "Complete payment" lands on /pay without opening it.
  const toPay = (
    req: PayReqRow,
    reference?: string,
    authorizationUrl?: string,
    autoOpen = false,
  ) =>
    router.push({
      pathname: '/pay',
      params: {
        type: 'application',
        requestId: req.id,
        reference: reference ?? req.reference ?? '',
        authorizationUrl: authorizationUrl ?? '',
        autoOpen: autoOpen ? '1' : '',
        agentId: req.agentId,
        dateIso: '',
        time: '',
        topic: req.title,
        mode: '',
        dur: '',
        fee: String(req.amount),
      },
    });

  // Sticky / nudge action: perform the next step (self-service flow) when
  // actionable, otherwise open the agent conversation.
  const openConvo = () => {
    if (convo) router.push(`/messages/${convo.id}`);
  };
  const onNext = () => {
    // self-service/[id] takes the APPLICATION id (japa#145).
    if (actionable) router.push(`/self-service/${app.id}`);
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

          {/* ── Visa details link (japa#106) ─────────────────────────────────
              Reuses destination/[id].tsx's "Full visa breakdown" row. Opens
              the visa breakdown, which works for an agency-only visa because
              the user has a case on it (#102). */}
          {dest.id ? (
            <PressableStatic
              onPress={() =>
                router.push({
                  pathname: '/visa/[id]',
                  params: { id: dest.id, code: dest.flag.toUpperCase() },
                })
              }
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 13,
                padding: 15,
                borderRadius: 20,
                marginBottom: 18,
                backgroundColor: '#fff',
                borderWidth: 1,
                borderColor: EX.color.line08,
                opacity: pressed ? 0.7 : 1,
              })}
            >
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
                <Ic.docs size={20} color={EX.color.primary} strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '700',
                    color: EX.color.ink,
                  }}
                >
                  Visa details
                </Text>
                <Text
                  style={{
                    fontSize: 12.5,
                    color: EX.color.inkMuted,
                    marginTop: 1,
                  }}
                >
                  Requirements, processing time and fees
                </Text>
              </View>
              <Ic.chevR size={20} color={EX.color.muted} strokeWidth={1.8} />
            </PressableStatic>
          ) : null}

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
                        seed={agent?.id === req.agentId ? agent.seed : 0}
                        size={22}
                        name={
                          req.agentName ??
                          (agent?.id === req.agentId ? agent.n : 'Agent')
                        }
                      />
                      <Text
                        style={{
                          fontSize: 12.5,
                          color: EX.color.muted,
                          fontWeight: '500',
                        }}
                      >
                        Requested by{' '}
                        {req.agentName ??
                          (agent?.id === req.agentId ? agent.n : 'your agent')}
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
                                      // Approve on the backend (consent only; the
                                      // Paystack charge follows, see approveRequest).
                                      onPress: () => void approveRequest(req),
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
                              {req.paid
                                ? 'Paid — thank you.'
                                : 'Approved, awaiting payment — complete payment to continue.'}
                            </Text>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 10,
                                marginTop: 12,
                              }}
                            >
                              {req.paid ? null : (
                                <Pressable
                                  onPress={() => toPay(req)}
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
                              )}
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
                    {/* Failed approve / reject / checkout (spec 1.3). */}
                    {reqError[req.id] ? (
                      <View style={{ marginTop: 12 }}>
                        <InlineError message={reqError[req.id]} />
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {/* japa#145: no assigned agent (self-service case) → no section. */}
          {agent ? (
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
                Your agent
              </Text>
              <Pressable
                onPress={() => router.push(`/agent/${agent.id}`)}
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
                  <Ic.msg
                    size={18}
                    color={EX.color.primary}
                    strokeWidth={1.8}
                  />
                </Pressable>
              </Pressable>
            </>
          ) : null}

          {/* ── Timeline: LAST section, below everything else (japa#274) ───── */}
          {/* ── Progress header (marginBottom 14) ───────────────────────────── */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
              marginTop: 26,
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
            <Timeline steps={shownSteps} />
            {/* Show all (N) / Show less — only when entries are hidden (japa#274) */}
            {canToggle ? (
              <PressableStatic
                onPress={() => setTimelineOpen((o) => !o)}
                accessibilityRole="button"
                // Announce expanded / collapsed to VoiceOver (japa#274 review).
                accessibilityState={{ expanded: timelineOpen }}
                // ~30pt tall visually; hitSlop lifts the tap area past 44pt.
                hitSlop={8}
                accessibilityLabel={
                  timelineOpen
                    ? 'Show fewer timeline entries'
                    : `Show all ${totalSteps} timeline entries`
                }
                style={({ pressed }) => ({
                  alignSelf: 'flex-start',
                  marginTop: 16,
                  paddingVertical: 6,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: EX.color.primary,
                  }}
                >
                  {timelineOpen ? 'Show less' : `Show all (${totalSteps})`}
                </Text>
              </PressableStatic>
            ) : null}
          </View>
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
