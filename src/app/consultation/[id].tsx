// ─────────────────────────────────────────────────────────────────────────────
// Consultation detail (prototype messaging.jsx ConsultationDetailView).
//
// Reads the `:id` route param → GET /consultations/:id → the booking's agent via
// GET /agents/:id (japa#145: no demo CONSULTS / AGENTS lookups). Renders a back header ("Consultation") over a ScrollView with:
//   1. a status pill (upcoming / completed / cancelled),
//   2. a "When" card (date · time·dur · mode) styled like the list screen band,
//   3. a "Topic" card,
//   4. an agent card (Pressable → agent page) with a Message shortcut,
//   5. contextual actions (Join call / Reschedule / Cancel · Message / Rebook),
//   6. optional "Your note" and "Session summary" cards.
//
// ── Refunds (japa#356) ──────────────────────────────────────────────────────
//   • Cancel confirm: worded from the server's `cancellationRefund` preview
//     only (refundCopy.ts `cancelConfirmCopy`): the amount back, the fee the
//     payment provider keeps, "we'll confirm the exact amount" while the fee
//     is unknown, or "no refund" inside 24 hours with the cut-off time on the
//     phone's own clock, no zone label (user decision 2026-11-22). The app never decides refundability or amounts.
//   • While cancelling, the cancel link becomes a coral spinner. On success
//     the screen STAYS (it refetches: "Cancelled" plus the refund card), and
//     an alert says what actually happened, from the PUT answer's `refund`.
//   • Refund card (under the status pill): the booking's `refundStatus`, with
//     the figure from its refund row in GET /transactions when there is one.
//
// ── "The meeting didn't happen" (japa#442) ──────────────────────────────────
//   • The action shows only when the server says so (`canReportNoShow`) and
//     there is no report yet. Its confirm step sends POST
//     /consultations/:id/no-show-report. Every tap tries the request; a
//     network failure shows the offline message (never a sticky block).
//   • A booking with a report shows a "Your report" card (under review /
//     resolved), and a resolved-with-refund report also gets the refund card.
// Loading → coral spinner; a failed load → CenteredState with retry; a 404 /
// unknown id → CenteredState "We couldn’t find this consultation".
//
// Native primitives only; matches the (explorer) coral/cream design system and
// the card/pill styling of consultations.tsx.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import type { Consult } from '@/types/explorer.type';
import { CenteredState } from '@/components/explorer/CenteredState';
import { loadErrorCopy } from '@/components/explorer/states';
import { isNotFoundError } from '@/hooks/queryErrors';
import { useAgent } from '@/hooks/useAgents';
import { mapAgent } from '@/components/explorer/liveAgents';
import { useConversations } from '@/hooks/useMessaging';
import {
  useCancelConsultation,
  useReportNoShow,
} from '@/hooks/useConsultations';
import { useTransactions } from '@/hooks/useTransactions';
import { bookingRefundAmount } from '@/components/explorer/liveTransactions';
import {
  CANCEL_ERROR,
  CANCEL_RESULT_TITLE,
  NO_SHOW_ERROR,
  NO_SHOW_OFFLINE,
  cancelConfirmCopy,
  cancelResultMessage,
  noShowReportCopy,
  refundCardCopy,
  wasPaidBooking,
} from '@/components/explorer/refundCopy';
import {
  NoShowReportAction,
  StatusCard,
} from '@/components/explorer/ConsultationRefund';
import { InlineError } from '@/components/explorer/AccountForm';
import { isNetworkError } from '@/utils/networkStatus';
import { hashString } from '@/assets/countries';
import { Ic } from '@/components/explorer/icons';
import { Portrait, Pill, Verified } from '@/components/explorer/primitives';
// Live data: the consultation itself.
import { useConsultation } from '@/hooks/useConsultations';
import { mapConsult } from '@/components/explorer/liveConsultations';

// Lucide-style icon component signature (size/color/strokeWidth props).
type IconType = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

// Status → pill colors. Mirrors the list screen: upcoming = blue, completed =
// green, cancelled = grey. Pill text is 11/700 (via Pill `small`).
const STATUS_PILL: Record<
  Consult['status'],
  { label: string; fg: string; bg: string }
> = {
  upcoming: { label: 'Upcoming', fg: '#2F62A0', bg: '#DCEBF7' },
  completed: { label: 'Completed', fg: '#1E8E55', bg: '#D6F2E2' },
  cancelled: { label: 'Cancelled', fg: '#8B8499', bg: 'rgba(23,19,38,0.06)' },
};

// ── Row inside the "When" card: leading icon chip + label ─────────────────────
function WhenRow({ icon: IconCmp, label }: { icon: IconType; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
      {/* Cream icon chip (matches IconChip look used across the explorer). */}
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: EX.color.cream,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconCmp size={16} color={EX.color.primary} strokeWidth={1.8} />
      </View>
      <Text style={{ fontSize: 14.5, fontWeight: '600', color: EX.color.ink }}>
        {label}
      </Text>
    </View>
  );
}

// ── Action button (filled coral OR outline), same spec as consultations.tsx ───
// `grow` → flex:1; otherwise fixed width via horizontal padding.
function ActionBtn({
  label,
  icon: IconCmp,
  filled,
  grow,
  onPress,
}: {
  label: string;
  icon?: IconType;
  filled?: boolean;
  grow?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        ...(grow ? { flex: 1 } : { paddingHorizontal: 18 }),
        height: 48,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: filled ? EX.color.primary : '#fff',
        borderWidth: filled ? 0 : 1,
        borderColor: EX.color.line12,
        shadowColor: EX.color.primary,
        shadowOpacity: filled ? 0.4 : 0,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: filled ? 4 : 0,
      }}
    >
      {IconCmp ? (
        <IconCmp
          size={17}
          color={filled ? '#fff' : EX.color.ink}
          strokeWidth={1.8}
        />
      ) : null}
      <Text
        style={{
          fontSize: 14.5,
          fontWeight: '700',
          color: filled ? '#fff' : EX.color.ink,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ── Labelled text card (Topic / Your note / Session summary) ──────────────────
function LabelCard({ label, body }: { label: string; body: string }) {
  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: EX.color.line06,
        padding: 16,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '600',
          color: EX.color.muted,
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 15,
          fontWeight: '600',
          color: EX.color.ink,
          lineHeight: 21,
        }}
      >
        {body}
      </Text>
    </View>
  );
}

export default function ConsultationDetailView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  // The consultation (GET /consultations/:id; a 404 is not retried).
  const liveQ = useConsultation(id || undefined);
  const c = liveQ.data ? mapConsult(liveQ.data) : undefined;
  // The agent (GET /agents/:id) for the card's portrait / specialisation.
  const agentQ = useAgent(c?.agentId || undefined);
  const a = agentQ.data ? mapAgent(agentQ.data) : undefined;
  // Name: the agent record, else the name denormalised on the booking.
  const agentName = a?.n ?? c?.agentName ?? 'Agent';
  const agentSeed = a?.seed ?? hashString(c?.agentId ?? '') % 6;
  // Live conversations (Message shortcut) + the cancel mutation.
  const { data: conversations } = useConversations();
  const cancelQ = useCancelConsultation();

  // ── Refund (japa#356) ──────────────────────────────────────────────────────
  // The raw booking keeps the refund fields the `Consult` view model drops.
  const booking = liveQ.data;
  const refundStatus = booking?.refundStatus;
  // The refund's own figure comes from its row in GET /transactions (the
  // shared cache Payments also uses). Only fetched when there is a refund,
  // and never waited for: the card renders without the figure meanwhile.
  const txQ = useTransactions({ enabled: !!refundStatus });
  const refundAmount = booking
    ? bookingRefundAmount(txQ.data, booking.id)
    : null;
  // Why the refund is held: the booking's own field when the backend sends
  // it, else what the cancel answer said in this session (user decision
  // 2026-11-22: a hold where the fee covers the whole payment reads "No
  // refund due" straight away).
  const [cancelHeldReason, setCancelHeldReason] = React.useState<string | null>(
    null,
  );
  const refundCard = refundCardCopy(
    refundStatus,
    refundAmount,
    booking?.refundHeldReason ?? cancelHeldReason,
  );

  // ── "The meeting didn't happen" (japa#442) ─────────────────────────────────
  const reportQ = useReportNoShow();
  // Double-tap guards as REFS (review fix, like "Pay again" on /pay): two
  // taps in the same frame both read a stale `isPending`, a ref is set
  // before the next render. Released when the call settles.
  const cancelBusyRef = React.useRef(false);
  // japa#356 review fix: true while the booking is re-read before the cancel
  // confirm opens (the link shows the spinner meanwhile).
  const [checkingCancel, setCheckingCancel] = React.useState(false);
  const cancelCheckRef = React.useRef(false);
  // Review fix: whether the screen is still mounted. The cancel confirm
  // waits for a re-read of the booking; if the client left meanwhile, no
  // alert may pop up over whatever screen they are on now.
  const mountedRef = React.useRef(true);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const reportBusyRef = React.useRef(false);
  // The last report error, kept here (not in the action) so it stays on
  // screen after a 409 refreshed the booking and the action went away.
  const [reportError, setReportError] = React.useState<string | null>(null);
  const noShowReport = booking?.noShowReport ?? null;
  const reportCard = noShowReportCopy(noShowReport);
  // Only when the SERVER says a report is allowed, and none exists yet.
  const canReport = booking?.canReportNoShow === true && !noShowReport;

  // ── Loading state — first fetch in flight, nothing cached. ─────────────────
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

  // ── Load failed (not a 404) with nothing cached → error + retry ────────────
  if (liveQ.isError && !liveQ.data && !isNotFoundError(liveQ.error)) {
    return (
      <CenteredState
        icon={Ic.cal}
        title="We couldn’t load this consultation"
        errorMessage={loadErrorCopy('this consultation')}
        onRetry={() => liveQ.refetch()}
        retrying={liveQ.isRefetching}
        actionLabel="Back to consultations"
        onAction={() => router.replace('/consultations')}
      />
    );
  }

  // ── Not-found state (404 or no id) ────────────────────────────────────────
  if (!c) {
    return (
      <CenteredState
        icon={Ic.cal}
        title="We couldn’t find this consultation"
        actionLabel="Back to consultations"
        onAction={() => router.replace('/consultations')}
      />
    );
  }

  const pill = STATUS_PILL[c.status];
  const isVideo = c.mode.toLowerCase().includes('video');

  // Message action: open the existing conversation with this agent if one
  // exists, else fall back to the agent's profile page.
  const openChat = () => {
    const convo = conversations?.find((x) => x.agentId === c.agentId);
    if (convo) router.push(`/messages/${convo.id}`);
    else router.push(`/agent/${c.agentId}`);
  };

  // Join call → open a meeting link. The consultation model carries no link
  // yet, so this opens Google Meet. Guarded in case the link can't open.
  const joinCall = async () => {
    try {
      await Linking.openURL('https://meet.google.com/');
    } catch {
      Alert.alert('Unable to open the meeting link.');
    }
  };

  // Cancel → confirm, then PUT /consultations/:id/status { cancelled }.
  // japa#356: the confirm is worded from the server's preview only; the
  // result alert from the PUT answer's `refund` (what actually happened).
  const confirmCancel = async () => {
    // A second tap while a cancel runs, or while the booking is being
    // re-read, does nothing (the link is a spinner).
    if (cancelBusyRef.current || cancelCheckRef.current || cancelQ.isPending) {
      return;
    }
    // Review fix: re-read the booking FIRST, so the preview (and the 24-hour
    // line in it) is the server's current one, not a cached copy up to
    // minutes old. The app still decides nothing itself. If the re-read
    // fails (offline), the cached booking is used: the result alert reads
    // the PUT answer and so still tells the truth.
    cancelCheckRef.current = true;
    setCheckingCancel(true);
    let current = booking;
    try {
      const fresh = await liveQ.refetch();
      current = fresh?.data ?? booking;
    } catch {
      current = booking;
    } finally {
      cancelCheckRef.current = false;
      // No state update on an unmounted screen.
      if (mountedRef.current) setCheckingCancel(false);
    }
    // The screen is gone (back pressed during the re-read): no confirm.
    if (!mountedRef.current) return;
    // Case E's cut-off is shown on the phone's own clock (zoneTime.ts).
    const copy = cancelConfirmCopy(current?.cancellationRefund);
    // Was it paid BEFORE the cancel? Decides how `refund: null` reads.
    const paid = current ? wasPaidBooking(current) : false;
    Alert.alert(copy.title, copy.message, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: copy.destructive,
        style: 'destructive',
        onPress: () => {
          // The confirm's button itself: one cancel call, ever, at a time.
          if (cancelBusyRef.current) return;
          cancelBusyRef.current = true;
          cancelQ.mutate(c.id, {
            onSettled: () => {
              cancelBusyRef.current = false;
            },
            // Stay on this screen: it refetches and shows "Cancelled" plus
            // the refund card. The alert says what the server did.
            onSuccess: (res) => {
              // Keep the hold reason for the refund card (see above).
              setCancelHeldReason(res?.refund?.heldReason ?? null);
              Alert.alert(
                CANCEL_RESULT_TITLE,
                cancelResultMessage(res?.refund, paid),
                [{ text: 'OK' }],
              );
            },
            onError: (err) =>
              Alert.alert(
                // japa#442: a cancel is refused while a report is open; the
                // server's own sentence says why. Otherwise the usual copy.
                (err as { code?: unknown })?.code === 'NO_SHOW_REPORT_OPEN' &&
                  typeof (err as { message?: unknown }).message === 'string'
                  ? (err as { message: string }).message
                  : CANCEL_ERROR,
              ),
          });
        },
      },
    ]);
  };

  // japa#442: send the report. EVERY tap attempts the POST (review fix): the
  // app-wide "offline" flag is sticky (only a later successful tracked call
  // clears it), so gating on it could leave a client who reconnected unable
  // to report while the fee is still held. A network failure is caught in
  // `onError` and shown as the offline message instead. A refusal (409)
  // shows the server's message; the hook refetches the booking, so the
  // screen then shows the matching state (e.g. the existing report).
  const sendReport = (note: string) => {
    if (reportBusyRef.current || reportQ.isPending) return;
    reportBusyRef.current = true;
    setReportError(null);
    reportQ.mutate(
      { consultationId: c.id, note },
      {
        onSettled: () => {
          reportBusyRef.current = false;
        },
        onSuccess: () => setReportError(null),
        onError: (err) => {
          if (isNetworkError(err)) {
            setReportError(NO_SHOW_OFFLINE);
            return;
          }
          const e = err as { code?: unknown; message?: unknown };
          // Already reported: the refetched booking shows the report card,
          // which says it all; no error on top of it.
          if (e.code === 'NO_SHOW_REPORT_EXISTS') {
            setReportError(null);
            return;
          }
          setReportError(
            typeof e.message === 'string' && e.message
              ? e.message
              : NO_SHOW_ERROR,
          );
        },
      },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      {/* ── Back header ───────────────────────────────────────────────────── */}
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingHorizontal: 18,
          paddingBottom: 6,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
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
        <Text style={displayText(24, 'semibold')}>Consultation</Text>
      </View>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 22,
          paddingTop: 12,
          paddingBottom: 40,
          gap: 14,
        }}
      >
        {/* 1 · Status pill (11/700 via `small`). */}
        <Pill label={pill.label} fg={pill.fg} bg={pill.bg} small />

        {/* 1b · Refund card (japa#356): whenever the booking has a
            `refundStatus` (a cancel, or a report resolved with a refund). */}
        {refundCard ? (
          <StatusCard testID="refund-card" label="Refund" copy={refundCard} />
        ) : null}

        {/* 1c · "Your report" card (japa#442): under review / resolved. */}
        {reportCard ? (
          <StatusCard
            testID="no-show-report-card"
            label="Your report"
            copy={reportCard}
          />
        ) : null}

        {/* 2 · "When" card — date, time·dur, mode. */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: EX.color.line06,
            padding: 16,
            gap: 14,
          }}
        >
          <WhenRow icon={Ic.cal} label={c.date} />
          <WhenRow icon={Ic.clock} label={`${c.time} · ${c.dur}`} />
          <WhenRow icon={isVideo ? Ic.video : Ic.phone} label={c.mode} />
        </View>

        {/* 3 · Topic card. */}
        <LabelCard label="Topic" body={c.topic} />

        {/* 4 · Agent card → agent profile; with a Message shortcut. */}
        {a || c.agentName ? (
          <Pressable
            onPress={() => router.push(`/agent/${c.agentId}`)}
            style={{
              backgroundColor: '#fff',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: EX.color.line06,
              padding: 16,
              gap: 14,
            }}
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <Portrait seed={agentSeed} size={48} name={agentName} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: EX.color.ink,
                    }}
                    numberOfLines={1}
                  >
                    {agentName}
                  </Text>
                  <Verified size={16} />
                </View>
                <Text
                  style={{
                    fontSize: 12.5,
                    color: EX.color.muted,
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  {a?.spec ?? 'Visa specialist'}
                </Text>
              </View>
              <Ic.chevR size={20} color={EX.color.muted} strokeWidth={1.8} />
            </View>

            {/* Message button — routes to the conversation (or agent page). */}
            <Pressable
              onPress={openChat}
              style={{
                height: 44,
                borderRadius: 13,
                borderWidth: 1,
                borderColor: EX.color.line12,
                backgroundColor: '#fff',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Ic.msg size={16} color={EX.color.ink} strokeWidth={1.8} />
              <Text
                style={{
                  fontSize: 13.5,
                  fontWeight: '700',
                  color: EX.color.ink,
                }}
              >
                Message
              </Text>
            </Pressable>
          </Pressable>
        ) : null}

        {/* 5 · Actions — vary by status (cancelled shows none). */}
        {c.status === 'upcoming' ? (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <ActionBtn
                label="Join call"
                icon={Ic.video}
                filled
                grow
                onPress={joinCall}
              />
              <ActionBtn
                label="Reschedule"
                grow
                onPress={() => router.push(`/book/${c.agentId}`)}
              />
            </View>
            {/* Danger text — Cancel consultation (with confirm). While
                the cancel runs it is a coral spinner (japa#356) and can't
                be pressed again. Hidden while a "meeting didn't happen"
                report is open: the server refuses a cancel then (#442). */}
            {noShowReport?.status === 'open' ? null : (
              <Pressable
                testID="cancel-consultation"
                onPress={() => void confirmCancel()}
                disabled={cancelQ.isPending || checkingCancel}
                hitSlop={6}
                accessibilityRole="button"
                // Review fix: the label stays when the text is a spinner,
                // so VoiceOver never reads only "button, busy".
                accessibilityLabel="Cancel consultation"
                accessibilityState={{
                  busy: cancelQ.isPending || checkingCancel,
                }}
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 8,
                  minHeight: 36,
                }}
              >
                {cancelQ.isPending || checkingCancel ? (
                  <ActivityIndicator color={EX.color.primary} />
                ) : (
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: EX.color.danger,
                    }}
                  >
                    Cancel consultation
                  </Text>
                )}
              </Pressable>
            )}
          </View>
        ) : c.status === 'completed' ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <ActionBtn
              label="Message agent"
              icon={Ic.msg}
              grow
              onPress={openChat}
            />
            <ActionBtn
              label="Rebook"
              grow
              onPress={() => router.push(`/book/${c.agentId}`)}
            />
          </View>
        ) : null}

        {/* 5b · "The meeting didn't happen" (japa#442): only when the server
            allows it. Once the action is gone (sent, or refused and the
            booking refreshed), its last error still shows on its own. */}
        {canReport ? (
          <NoShowReportAction
            sending={reportQ.isPending}
            error={reportError}
            onSend={sendReport}
            onOpen={() => setReportError(null)}
          />
        ) : reportError ? (
          <InlineError message={reportError} />
        ) : null}

        {/* 6 · Optional note / summary cards. */}
        {c.notes ? <LabelCard label="Your note" body={c.notes} /> : null}
        {c.summary ? (
          <LabelCard label="Session summary" body={c.summary} />
        ) : null}
      </ScrollView>
    </View>
  );
}
