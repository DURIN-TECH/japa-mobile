// ─────────────────────────────────────────────────────────────────────────────
// Payment (prototype booking flow — step 2 of 3).
//
// Reads the booking params pushed from /book/[agentId]. Shows a
// booking summary card, a selectable payment-method list (Card / Bank transfer /
// Paystack), and a price summary. The sticky glass CTA "Pay {fee}" is disabled
// until a method is chosen; on press it shows a brief processing spinner (~700ms)
// then pushes → /confirmation with the full param contract + method.
//
// japa#145: `type=application` pays an agent-raised payment request for REAL.
// Approving it (application/[id]) already opened the Paystack checkout; this
// screen then confirms the charge with POST /payment-requests/:id/verify and
// pushes /confirmation ONLY when the backend says the request is paid. An
// unpaid / cancelled checkout or a failed call shows an InlineError (never the
// confirmation); "Open checkout" reopens Paystack from the `authorizationUrl`
// param. Nothing here fakes a success.
//
// japa#145: missing or invalid params → CenteredState "We couldn’t find this
// payment". A failed booking (POST /consultations) no longer advances to the
// confirmation anyway: it shows an InlineError above the CTA (the CTA is the
// retry), so the app never confirms a booking the backend doesn't have.
//
// Design system: coral/cream Explorer tokens (EX), Space Grotesk display font.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, parse, parseISO } from 'date-fns';
import { EX, displayText } from '@/components/explorer/theme';
import { NAIRA } from '@/components/explorer/content';
import { CenteredState } from '@/components/explorer/CenteredState';
import { InlineError } from '@/components/explorer/AccountForm';
import { Ic } from '@/components/explorer/icons';
import {
  useCreateConsultation,
  type CreateConsultationInput,
  type ApiConsultation,
} from '@/hooks/useConsultations';
import { useVerifyPaymentRequest } from '@/hooks/usePaymentRequests';
import {
  NOT_PAID_MESSAGE,
  PAYMENT_ERROR_MESSAGE,
  isPaidResult,
} from '@/hooks/paymentRequestFlow';

// Lucide-style icon component signature (size/color/strokeWidth props).
type IconType = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

// ── Payment methods (label + icon; `key` is passed through as `method`) ───────
const METHODS: { key: string; label: string; icon: IconType; hint: string }[] =
  [
    {
      key: 'Card',
      label: 'Card',
      icon: Ic.cards,
      hint: 'Visa · Mastercard · Verve',
    },
    {
      key: 'Bank transfer',
      label: 'Bank transfer',
      icon: Ic.brief,
      hint: 'Pay from any Nigerian bank',
    },
    {
      key: 'Paystack',
      label: 'Paystack',
      icon: Ic.zap,
      hint: 'Fast, secure checkout',
    },
  ];

// ── Booking → backend consultation mapping helpers ────────────────────────────
//
// The Explorer booking UI collects a free-text `topic`, a 12-hour `time`, and a
// "30 min"-style `dur`. The backend `POST /consultations` endpoint expects a
// categorized `type`, a 24-hour `scheduledTime` ("HH:mm"), an integer
// `durationMinutes`, and an IANA `timezone`. These helpers translate between the
// two so we can create a real consultation from the booking params.

/**
 * Map the booking `topic` string to a backend consultation `type`.
 * Falls back to 'general' for anything we can't classify.
 */
function mapTopicToConsultationType(
  topic: string | undefined,
): ApiConsultation['type'] {
  const t = (topic ?? '').toLowerCase();
  if (t.includes('eligibility') || t.includes('application')) return 'initial';
  if (t.includes('document')) return 'document_review';
  if (t.includes('interview')) return 'interview_prep';
  return 'general';
}

/**
 * Convert a 12-hour time label ("10:00 AM") into a 24-hour "HH:mm" string.
 * Uses date-fns `parse` with the `h:mm a` mask; if parsing fails (e.g. missing
 * or malformed input), we fall back to the raw value so the request still sends.
 */
function to24HourTime(time: string | undefined): string {
  if (!time) return '00:00';
  const parsed = parse(time, 'h:mm a', new Date());
  return isNaN(parsed.getTime()) ? time : format(parsed, 'HH:mm');
}

/**
 * Best-effort IANA timezone for the device, defaulting to 'Africa/Lagos' when
 * the Intl API is unavailable or throws (older RN JS engines).
 */
function resolveTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos';
  } catch {
    return 'Africa/Lagos';
  }
}

// ── SummaryRow — icon + label row inside the booking summary card ─────────────
function SummaryRow({
  icon: IconCmp,
  label,
}: {
  icon: IconType;
  label: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
      {/* Bare coral icon (matches detail-screen fact rows). */}
      <IconCmp size={17} color={EX.color.primary} strokeWidth={1.8} />
      <Text
        style={{
          flex: 1,
          fontSize: 14,
          fontWeight: '600',
          color: EX.color.ink2,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

export default function PayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // All nav params arrive as strings (Expo Router serialises them).
  const {
    type,
    requestId,
    reference,
    authorizationUrl,
    agentId,
    dateIso,
    time,
    topic,
    mode,
    dur,
    fee,
  } = useLocalSearchParams<{
    type?: string;
    requestId?: string;
    reference?: string;
    authorizationUrl?: string;
    agentId: string;
    dateIso: string;
    time: string;
    topic: string;
    mode: string;
    dur: string;
    fee: string;
  }>();

  // A payment request is always paid through Paystack, so there is no method
  // choice for it; a booking picks one below.
  const [method, setMethod] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Mutation used by the consultation (booking) path to create a real
  // consultation on the backend so it shows up in the Consultations list.
  // Declared here (top of component) — never inside the onPay handler.
  const createConsultation = useCreateConsultation();
  // Verify a payment request's Paystack charge (application path).
  const verifyRequest = useVerifyPaymentRequest();

  // `application` = paying an agent-raised payment request (no date/time/mode);
  // `consultation` (default) = the booking flow with a scheduled slot.
  const isApp = type === 'application';
  const feeNum = Number(fee) || 0;
  const isVideo = (mode ?? '').toLowerCase().includes('video');
  const dateLabel = dateIso
    ? format(parseISO(dateIso), 'EEEE, MMMM d, yyyy')
    : '';

  // Params are valid when the flow has what it needs: an agent and an amount,
  // plus (for a booking) the chosen slot. Anything else is a broken link.
  const validParams =
    !!agentId &&
    Number.isFinite(Number(fee)) &&
    Number(fee) >= 0 &&
    (isApp
      ? // A payment request needs its id + Paystack reference to be verified.
        !!topic && !!requestId && !!reference
      : !!dateIso && !!time && !!dur);

  // Advance to the confirmation screen with the full param contract + chosen
  // method. Shared by both the application and consultation paths.
  const goToConfirmation = () => {
    router.push({
      pathname: '/confirmation',
      params: {
        type: type ?? 'consultation',
        agentId,
        dateIso,
        time,
        topic,
        mode,
        dur,
        fee,
        method: isApp ? 'Paystack' : method,
      },
    });
  };

  // Reopen the Paystack checkout (application path), e.g. after cancelling.
  const onOpenCheckout = async () => {
    if (!authorizationUrl) return;
    setPayError(null);
    try {
      await Linking.openURL(authorizationUrl);
    } catch {
      setPayError('We couldn’t open checkout. Try again in a moment.');
    }
  };

  const onPay = async () => {
    // A booking needs a chosen method; a payment request doesn't.
    if ((!isApp && !method) || processing) return;
    setPayError(null);
    setProcessing(true);

    // ── Payment request path — verify the REAL Paystack charge ───────────────
    // The checkout was opened on approve. Confirm it with the backend and show
    // the confirmation only when it says `paid`. A cancelled/abandoned
    // checkout comes back as a success response that is NOT paid, so we check
    // the status, not just that the call worked.
    if (isApp) {
      try {
        const result = await verifyRequest.mutateAsync({
          requestId: requestId!,
          reference: reference!,
        });
        setProcessing(false);
        if (isPaidResult(result)) goToConfirmation();
        else setPayError(NOT_PAID_MESSAGE);
      } catch {
        setProcessing(false);
        setPayError(PAYMENT_ERROR_MESSAGE);
      }
      return;
    }

    // ── Consultation (booking) path — create a REAL consultation ─────────────
    // Build the CreateConsultationInput from the booking params, converting
    // units the backend expects (24-hour time, integer minutes, kobo fee).
    const input: CreateConsultationInput = {
      agentId,
      type: mapTopicToConsultationType(topic),
      scheduledDate: dateIso, // already 'yyyy-MM-dd'
      scheduledTime: to24HourTime(time), // "10:00 AM" → "10:00"
      durationMinutes: parseInt(dur, 10) || 30, // "30 min" → 30
      timezone: resolveTimezone(),
      fee: feeNum * 100, // naira → kobo/cents
    };

    try {
      // Keep the spinner visible for the duration of the network call.
      await createConsultation.mutateAsync(input);
      setProcessing(false);
      goToConfirmation();
    } catch {
      // Stay here; the CTA is the retry.
      setProcessing(false);
      setPayError(
        'Your payment didn’t go through. Nothing was charged. Try again.',
      );
    }
  };

  // CTA is live once a booking has a method; a payment request always is.
  const ready = isApp || !!method;

  // Broken link (missing / invalid params): not-found, never a ₦0 checkout.
  if (!validParams) {
    return (
      <CenteredState
        icon={Ic.cards}
        title="We couldn’t find this payment"
        actionLabel="Back"
        onAction={() => router.back()}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      {/* ── Back header ─────────────────────────────────────────────────────── */}
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
        <Text style={displayText(24, 'semibold')}>Payment</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: EX.space.screenX,
          paddingTop: 14,
          paddingBottom: EX.space.ctaClear,
        }}
      >
        {/* ── Booking summary card ─────────────────────────────────────────── */}
        <View
          style={{
            backgroundColor: EX.color.cardWhite,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: EX.color.line08,
            padding: 16,
            gap: 13,
            shadowColor: '#171326',
            shadowOpacity: 0.04,
            shadowRadius: 2,
            shadowOffset: { width: 0, height: 1 },
            elevation: 1,
          }}
        >
          {isApp ? (
            <>
              <SummaryRow icon={Ic.cards} label={topic} />
              <SummaryRow icon={Ic.zap} label="One-time payment" />
            </>
          ) : (
            <>
              <SummaryRow icon={Ic.cal} label={dateLabel} />
              <SummaryRow icon={Ic.clock} label={`${time} · ${dur}`} />
              <SummaryRow icon={isVideo ? Ic.video : Ic.phone} label={mode} />
              <SummaryRow icon={Ic.msg} label={topic} />
            </>
          )}
        </View>

        {/* ── Payment method (bookings only) ───────────────────────────────── */}
        {isApp ? null : (
          <>
            <Text
              style={{
                fontSize: 16.5,
                fontWeight: '700',
                color: EX.color.ink,
                letterSpacing: -0.18,
                marginTop: 26,
                marginBottom: 12,
              }}
            >
              Payment method
            </Text>
            <View style={{ gap: 10 }}>
              {METHODS.map((m) => {
                const on = method === m.key;
                const Icon = m.icon;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => setMethod(m.key)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 13,
                      backgroundColor: on
                        ? EX.color.primaryTint05
                        : EX.color.cardWhite,
                      borderRadius: 18,
                      borderWidth: on ? 1.5 : 1,
                      borderColor: on ? EX.color.primary : EX.color.line10,
                      padding: 14,
                    }}
                  >
                    {/* Method icon in a cream square. */}
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        backgroundColor: EX.color.cream,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon
                        size={19}
                        color={EX.color.primary}
                        strokeWidth={1.8}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={{
                          fontSize: 14.5,
                          fontWeight: '700',
                          color: EX.color.ink,
                        }}
                        numberOfLines={1}
                      >
                        {m.label}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: EX.color.muted,
                          marginTop: 1,
                        }}
                        numberOfLines={1}
                      >
                        {m.hint}
                      </Text>
                    </View>
                    {/* Radio — coral filled dot when selected. */}
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor: on ? EX.color.primary : EX.color.line16,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {on ? (
                        <View
                          style={{
                            width: 11,
                            height: 11,
                            borderRadius: 6,
                            backgroundColor: EX.color.primary,
                          }}
                        />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* ── Price summary card ───────────────────────────────────────────── */}
        <View
          style={{
            backgroundColor: EX.color.cardWhite,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: EX.color.line08,
            padding: 16,
            marginTop: 22,
            shadowColor: '#171326',
            shadowOpacity: 0.04,
            shadowRadius: 2,
            shadowOffset: { width: 0, height: 1 },
            elevation: 1,
          }}
        >
          {/* Consultation fee */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 14, color: EX.color.inkMuted }}>
              {isApp ? 'Amount' : 'Consultation fee'}
            </Text>
            <Text
              style={{ fontSize: 14, fontWeight: '600', color: EX.color.ink }}
            >
              {NAIRA(feeNum)}
            </Text>
          </View>
          {/* Service fee (₦0) */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 10,
            }}
          >
            <Text style={{ fontSize: 14, color: EX.color.inkMuted }}>
              Service fee
            </Text>
            <Text
              style={{ fontSize: 14, fontWeight: '600', color: EX.color.ink }}
            >
              ₦0
            </Text>
          </View>
          {/* Divider */}
          <View
            style={{
              height: 1,
              backgroundColor: EX.color.line08,
              marginVertical: 13,
            }}
          />
          {/* Total (bold) */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text
              style={{ fontSize: 15.5, fontWeight: '700', color: EX.color.ink }}
            >
              Total
            </Text>
            <Text
              style={{
                fontSize: 19,
                fontWeight: '700',
                color: EX.color.ink,
                letterSpacing: -0.2,
              }}
            >
              {NAIRA(feeNum)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ── Sticky glass CTA — Pay {fee} ────────────────────────────────────── */}
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
        {/* Payment failure above the CTA (the CTA is the retry). */}
        {payError ? (
          <View style={{ marginBottom: 12 }}>
            <InlineError message={payError} />
          </View>
        ) : null}
        {/* Payment request: reopen Paystack (e.g. after cancelling). */}
        {isApp && authorizationUrl ? (
          <Pressable
            onPress={onOpenCheckout}
            style={{
              height: 46,
              borderRadius: 14,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: EX.color.line12,
              backgroundColor: '#fff',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{ color: EX.color.ink, fontSize: 14.5, fontWeight: '700' }}
            >
              Open checkout
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onPay}
          disabled={(!isApp && !method) || processing}
          style={{
            height: 54,
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: ready ? EX.color.primary : 'rgba(244,81,108,0.35)',
            shadowColor: EX.color.primary,
            shadowOpacity: ready ? 0.45 : 0,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 10 },
            elevation: ready ? 6 : 0,
          }}
        >
          {processing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '700' }}>
              {isApp ? 'I’ve paid — confirm' : `Pay ${NAIRA(feeNum)}`}
            </Text>
          )}
        </Pressable>
      </BlurView>
    </View>
  );
}
