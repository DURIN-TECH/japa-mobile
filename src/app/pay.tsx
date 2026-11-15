// ─────────────────────────────────────────────────────────────────────────────
// Payment (booking flow — step 2 of 3).
//
// Reads the booking params pushed from /book/[agentId]. Shows a booking
// summary card, a selectable payment-method list (Card / Bank transfer /
// Paystack), and a price summary. The sticky glass CTA "Pay {amount}" is
// disabled until a method is chosen.
//
// ── Consultation booking: the server's locked quote (japa#183) ─────────────
// The screen BOOKS FIRST, on arrival: POST /consultations with the slot only
// (agentId, type, scheduledDate, scheduledTime, durationMinutes, timezone;
// never a fee, amount, currency or rate). The server prices the booking in
// the client's currency, stores the snapshot and locks it for 30 minutes.
//   • free (`requiresPayment: false`) → straight to /confirmation, "Free";
//   • paid → the summary shows the LOCKED `chargedAmountMinor` in
//     `chargedCurrency`, "$35.00 at ₦1,353.97 per $1" (the server's dollar
//     price and rate, verbatim) and a live countdown from `quoteExpiresAt`
//     (measured against the server clock via `quoteLockedAt`). The amount
//     never changes on screen after that, whatever the rate does;
//   • "Pay ₦…" opens `authorizationUrl` in the auth browser
//     (`runPaystackCheckout`) and verifies with POST /consultations/public/
//     verify { reference } (our own reference, never the deep link's).
//     Paid → /confirmation with the locked amount. Not completed → stays,
//     the CTA becomes "Open checkout"; reopening resumes through POST
//     /consultations/:id/checkout (same checkout inside the lock, a FRESH
//     quote after it, shown before Paystack opens);
//   • countdown hits 0:00 → "Your price has expired…" + "Refresh price"
//     (re-prices the SAME booking through the checkout route);
//   • 503 PRICING_UNAVAILABLE → dollar price only, "We can’t price this
//     booking right now…", CTA "Pay" disabled, "Try again" link. 400 / 404
//     / 409 / 502 never crash: a message + the retry;
//   • errors are mapped by the backend's CODE, per call (never by a bare
//     status): a refused booking says "couldn’t book"; only a genuinely
//     unpaid checkout says "we haven’t received your payment yet"; a 400
//     PAYMENT_MISMATCH (they PAID, the amount is wrong) and the 402 monthly
//     plan limit END the screen ('blocked': message only, no Pay, no retry),
//     so nobody who paid is ever asked to pay again.
//
// ── One booking per slot: the server resumes (japa#288) ────────────────────
// Coming back to this screen (back, then Continue again) calls POST
// /consultations again, but the server no longer books the slot twice: when
// this client already has an UNPAID pending booking with this agent at this
// date and time it answers 200 with THAT booking and `resumed: true`, in the
// create shape. The screen treats it exactly like a 201 (same code path).
//   • The server matches on agent + date + time only (not topic / length),
//     and the app follows it: the summary card then shows the RESUMED
//     booking's own type, duration and locked price, with a one-line note
//     when they differ from what was just picked (`bookingDisplay`);
//   • resumed with `requiresPayment: false` = paid meanwhile → confirmation
//     with the paid amount (never "Free");
//   • 409 CHECKOUT_OPENING on create names the booking in
//     `data.consultation`: the id is kept, so "Try again" goes through POST
//     /consultations/:id/checkout for that booking, never a second create;
//   • 409 PAYMENT_IN_PROGRESS on create (a payment may still land on the
//     earlier checkout): #183's in-progress message, the booking's locked
//     amount, and "Check again" (re-verify that reference; opens nothing).
//
// Return to the app (backend #285): the hooks send `returnTo: 'app'` on POST
// /consultations and /:id/checkout, so Paystack lands on the backend's app
// return page, which redirects to `durintech://payment-return`; the auth
// browser closes by itself and verify runs. A booking whose checkout was
// first opened on the WEB keeps its web confirm URL inside the 30-minute
// lock: that browser does not close by itself, the user closes it, and
// verify runs exactly the same. Closing the browser is never a failure on
// its own; only the backend's verify answer decides paid / not paid.
//
// ── Payment request (`type=application`, japa#145 / #252) ──────────────────
// Approving it (application/[id]) already opened the Paystack checkout; this
// screen confirms the charge with POST /payment-requests/:id/verify and
// pushes /confirmation ONLY when the backend says the request is paid. The
// amount comes from the request itself (GET /payment-requests, by
// `applicationId` + `requestId`), never from a route param: dollars while
// pending, the local charge once approve priced it. `autoOpen=1` opens the
// checkout once on arrival.
//
// Missing or invalid params → CenteredState "We couldn’t find this payment"
// (never a ₦0 checkout).
//
// Design system: coral/cream Explorer tokens (EX), Space Grotesk display font.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, parse, parseISO } from 'date-fns';
import { EX, displayText } from '@/components/explorer/theme';
import { formatMoney, type PriceParts } from '@/components/explorer/content';
import { CenteredState } from '@/components/explorer/CenteredState';
import { InfoNote, InlineError } from '@/components/explorer/AccountForm';
import { Ic } from '@/components/explorer/icons';
import {
  getConsultationTypeLabel,
  useConsultation,
  useConsultationCheckout,
  useCreateConsultation,
  useVerifyConsultation,
  type ApiConsultation,
  type BookingSummary,
  type CreateConsultationInput,
} from '@/hooks/useConsultations';
import { useAgent } from '@/hooks/useAgents';
import {
  usePaymentRequests,
  useVerifyPaymentRequest,
} from '@/hooks/usePaymentRequests';
import {
  NOT_PAID_MESSAGE,
  PAYMENT_ERROR_MESSAGE,
  isPaidResult,
  paymentRequestParts,
} from '@/hooks/paymentRequestFlow';
import {
  OPEN_CHECKOUT_ERROR_MESSAGE,
  runPaystackCheckout,
  type VerifyVerdict,
} from '@/hooks/paystackCheckout';
import {
  COUNTDOWN_WARN_SECONDS,
  PAY_COPY,
  bookingDisplay,
  chargeChanged,
  classifyConsultationPayError,
  formatCountdown,
  isBookingPaidResult,
  isResumedBooking,
  lockedQuoteFrom,
  lockedRateLine,
  quoteSecondsLeft,
  type ActualBooking,
  type LockedQuote,
  type PayErrorVerdict,
  type PayStage,
} from '@/hooks/consultationPayFlow';
import { analyticsService } from '@/services/analytics.service';
import type { Money } from '@/types/money.type';
import type { VerifyPaymentRequestResult } from '@/types/payment-requests.type';

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

// ── SummaryLine — "label ........ amount" row in the price summary card ───────
function SummaryLine({
  label,
  value,
  first = false,
}: {
  label: string;
  value: string;
  /** No top margin on the first row. */
  first?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: first ? 0 : 10,
      }}
    >
      <Text style={{ fontSize: 14, color: EX.color.inkMuted }}>{label}</Text>
      {/* row-label 15/600 ink */}
      <Text style={{ fontSize: 15, fontWeight: '600', color: EX.color.ink }}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Where the booking quote stands (consultation path only):
 *  - `loading`     the booking / re-price call is running;
 *  - `locked`      a quote is on screen and can be paid;
 *  - `unavailable` the server could not price it: dollars only + "Try again";
 *  - `failed`      no usable booking: message + "Try again" (books anew);
 *  - `blocked`     terminal: message only, NO Pay and NO "Try again" (a
 *                  mismatched payment under review, or the plan's monthly
 *                  limit). Retrying could only charge someone twice or fail.
 */
type QuotePhase = 'loading' | 'locked' | 'unavailable' | 'failed' | 'blocked';

/**
 * Verify verdicts after which the checkout that was just open is NOT the
 * thing to reopen, so the CTA must not become "Open checkout": the server
 * issued a new one, the booking closed, or the screen is in a terminal state.
 */
const VERIFY_ENDS_CHECKOUT: ReadonlySet<PayErrorVerdict['kind']> = new Set([
  'new_checkout',
  'not_payable',
  'payment_review',
  'limit_reached',
  'pricing_unavailable',
]);

export default function PayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // All nav params arrive as strings (Expo Router serialises them). No
  // amount param (japa#183): prices come from the server only.
  const {
    type,
    requestId,
    applicationId,
    reference,
    authorizationUrl,
    autoOpen,
    agentId,
    dateIso,
    time,
    topic,
    mode,
    dur,
  } = useLocalSearchParams<{
    type?: string;
    requestId?: string;
    /** The request's application (to read its amount from the list). */
    applicationId?: string;
    reference?: string;
    authorizationUrl?: string;
    /** '1' → open the checkout once on arrival (right after approve). */
    autoOpen?: string;
    agentId: string;
    dateIso: string;
    time: string;
    topic: string;
    mode: string;
    dur: string;
  }>();

  // A payment request is always paid through Paystack, so there is no method
  // choice for it; a booking picks one below.
  const [method, setMethod] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Mutations, declared at the top of the component (never in a handler).
  const createConsultation = useCreateConsultation();
  const checkoutConsultation = useConsultationCheckout();
  const verifyConsultation = useVerifyConsultation();
  const verifyRequest = useVerifyPaymentRequest();

  // `application` = paying an agent-raised payment request (no date/time/mode);
  // `consultation` (default) = the booking flow with a scheduled slot.
  const isApp = type === 'application';
  const isVideo = (mode ?? '').toLowerCase().includes('video');
  const dateLabel = dateIso
    ? format(parseISO(dateIso), 'EEEE, MMMM d, yyyy')
    : '';

  // Params are valid when the flow has what it needs: an agent, plus the
  // request ids (payment request) or the chosen slot (booking).
  const validParams =
    !!agentId &&
    (isApp
      ? // A payment request needs its id + Paystack reference to be verified.
        !!topic && !!requestId && !!reference
      : !!dateIso && !!time && !!dur);

  // ── Payment request: its amount, from the request itself ──────────────────
  const payReqQ = usePaymentRequests(applicationId, { enabled: isApp });
  const request = isApp
    ? (payReqQ.data ?? []).find((r) => r.id === requestId)
    : undefined;
  const requestParts: PriceParts | null = request
    ? paymentRequestParts(request)
    : null;

  // ── Booking: the agent's dollar fee (shown only when the quote failed) ─────
  const agentQ = useAgent(isApp ? undefined : agentId);
  const agentUsd: Money | null = agentQ.data?.consultationFeeUsd ?? null;

  // ── Booking: the server's locked quote ─────────────────────────────────────
  const [phase, setPhase] = useState<QuotePhase>('loading');
  const [quote, setQuote] = useState<LockedQuote | null>(null);
  // True after a checkout came back unpaid: CTA reads "Open checkout".
  const [attempted, setAttempted] = useState(false);
  // True while a payment still needs checking: the verify CALL failed
  // (network / 5xx) once Paystack closed, or verify answered "in progress" /
  // "couldn’t confirm". The person may have paid, so the CTA reads "Check
  // again" and only re-verifies the same reference. It never opens a checkout.
  const [recheck, setRecheck] = useState(false);
  // Device clock, ticked once a second while a quote is locked.
  const [now, setNow] = useState(() => Date.now());
  // Refs mirror the latest values for async handlers (no stale closures).
  const quoteRef = useRef<LockedQuote | null>(null);
  const bookingIdRef = useRef<string | null>(null);
  // Reopening after an unpaid attempt goes through /checkout first (it may
  // hand back a fresh quote); cleared when verify itself handed a new one.
  const resumeRef = useRef(false);
  // True while a booking / re-price call is running (see requestQuote).
  const quoteBusyRef = useRef(false);
  // Side results of a verify call (read after runPaystackCheckout returns).
  const verifyNoteRef = useRef<string | null>(null);
  // How the last verify failed (null = it did not fail, or was not paid on
  // a 2xx): decides whether "Open checkout" is offered afterwards.
  const verifyKindRef = useRef<PayErrorVerdict['kind'] | null>(null);
  const paidSummaryRef = useRef<BookingSummary | null>(null);
  const paidRequestRef = useRef<VerifyPaymentRequestResult | null>(null);

  // ── What is ACTUALLY booked (japa#288) ─────────────────────────────────────
  // The server may hand back an earlier booking of this slot whose type or
  // length differs from the pick. `actual` holds the server's values (state
  // for rendering, a ref for async handlers that navigate before a render).
  const [actual, setActual] = useState<ActualBooking | null>(null);
  const actualRef = useRef<ActualBooking | null>(null);
  /** Merge in what a response says about the booking (unknown fields stay). */
  const noteActual = (part: ActualBooking | null) => {
    const next: ActualBooking | null = part
      ? {
          type: part.type ?? actualRef.current?.type,
          durationMinutes:
            part.durationMinutes ?? actualRef.current?.durationMinutes,
        }
      : null;
    actualRef.current = next;
    setActual(next);
  };
  // A booking this screen learned about from a 409 (CHECKOUT_OPENING /
  // PAYMENT_IN_PROGRESS on create). The 409's summary has no duration, so
  // the full booking is fetched (GET /consultations/:id) to show its real
  // length. Null (query disabled) for a booking a 200 / 201 described fully.
  const [adoptedId, setAdoptedId] = useState<string | null>(null);
  const adoptedQ = useConsultation(adoptedId ?? undefined);
  const adopted = adoptedQ.data;
  useEffect(() => {
    // Only for the booking still on screen (a reset clears `adoptedId`).
    if (!adopted || adopted.id !== adoptedId) return;
    noteActual({
      type: adopted.type,
      durationMinutes: adopted.durationMinutes,
    });
    // `noteActual` only touches a ref and a setter: safe to leave out.
  }, [adopted, adoptedId]);

  /** The topic / duration to show: the pick, or the server's booking. */
  const displayFor = (a: ActualBooking | null) =>
    bookingDisplay(
      {
        topic: topic ?? '',
        type: mapTopicToConsultationType(topic),
        durLabel: dur ?? '',
      },
      a,
      getConsultationTypeLabel,
    );
  const display = displayFor(actual);
  // The "earlier booking" note: when its details differ from the pick, and
  // ALSO when the fetch of a 409-named booking failed. Then its length is
  // not known (the card keeps the 409 summary's type and the picked
  // duration), so the note still says these are not simply the fresh pick.
  const showResumedNote =
    display.differs || (!!adoptedId && adoptedQ.isError === true);

  /** Show a newly locked quote (and remember which booking it belongs to). */
  const applyQuote = (q: LockedQuote) => {
    quoteRef.current = q;
    bookingIdRef.current = q.consultationId;
    setQuote(q);
    setRecheck(false);
    setPhase('locked');
    setNow(Date.now());
  };

  /** Forget the booking: the next try books (and prices) a new one. */
  const resetBooking = () => {
    quoteRef.current = null;
    bookingIdRef.current = null;
    resumeRef.current = false;
    setQuote(null);
    setAttempted(false);
    setRecheck(false);
    // The next booking is a new one: back to showing the user's own pick.
    noteActual(null);
    setAdoptedId(null);
  };

  /**
   * End the flow on this screen (terminal `blocked` phase): drop the quote
   * so nothing can be opened or paid, and show no retry. Used when a
   * payment that does not match is under review (paying again would charge
   * twice) and when the plan's monthly limit is reached (a retry can never
   * succeed).
   */
  const blockBooking = () => {
    quoteRef.current = null;
    resumeRef.current = false;
    setQuote(null);
    setAttempted(false);
    setRecheck(false);
    setPhase('blocked');
  };

  // Seconds left on the lock (null before a quote / without an expiry).
  const secondsLeft = quote ? quoteSecondsLeft(quote, now) : null;
  // While a payment still needs checking (`recheck`) the quote is NOT treated
  // as expired: "Refresh price" would re-price a booking that may be paid.
  const expired = phase === 'locked' && secondsLeft === 0 && !recheck;

  // Tick the countdown once a second while a quote is locked.
  useEffect(() => {
    if (phase !== 'locked' || !quote || quote.expiresAtMs === null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase, quote]);

  // ── Confirmation ──────────────────────────────────────────────────────────
  // Advance with the slot params, the chosen method and the amount that was
  // LOCKED / paid (display only; confirmation never refetches it).
  // `replace: true` swaps this screen out of the stack instead of pushing
  // on top of it (free bookings: there is nothing left to do here, so going
  // back from the confirmation must not land on a dead pay screen).
  const goToConfirmation = (paid: {
    charged?: Money | null;
    usdCents?: number | null;
    free?: boolean;
    replace?: boolean;
  }) => {
    // japa#288: the confirmation shows what was BOOKED (a resumed booking's
    // own topic / length), read from the ref so a response handled in this
    // same tick is already counted.
    const shown = displayFor(actualRef.current);
    const target = {
      pathname: '/confirmation' as const,
      params: {
        type: type ?? 'consultation',
        agentId,
        dateIso,
        time,
        topic: isApp ? topic : shown.topic,
        mode,
        dur: isApp ? dur : shown.dur,
        method: isApp ? 'Paystack' : (method ?? ''),
        paidAmountMinor: paid.charged ? String(paid.charged.amountMinor) : '',
        paidCurrency: paid.charged?.currency ?? '',
        priceUsdCents:
          typeof paid.usdCents === 'number' ? String(paid.usdCents) : '',
        free: paid.free ? '1' : '',
      },
    };
    if (paid.replace) router.replace(target);
    else router.push(target);
  };

  /** A booking the server confirmed as paid: analytics + confirmation. */
  const bookingPaid = (
    summary: BookingSummary | null,
    fallback: LockedQuote | null,
  ) => {
    // Prefer the server's summary; fall back to the quote that was shown.
    const charged: Money | null =
      typeof summary?.chargedAmountMinor === 'number' && summary.chargedCurrency
        ? {
            amountMinor: summary.chargedAmountMinor,
            currency: summary.chargedCurrency,
          }
        : (fallback?.charged ?? null);
    const usdCents =
      summary?.priceUsdCents ?? fallback?.usd.amountMinor ?? null;
    if (charged) {
      void analyticsService.trackConsultationBooked({
        agentId,
        // The booked type (a resumed booking may differ from the pick).
        type: actualRef.current?.type ?? mapTopicToConsultationType(topic),
        charged,
      });
    }
    // REPLACE, not push (as the free path does): the booking is paid, so
    // this screen must not stay under the confirmation with a live "Pay".
    // Going back returns to the slot picker, and the booking analytics
    // above can only ever fire once per booking.
    goToConfirmation({ charged, usdCents, replace: true });
  };

  /** A free booking (`requiresPayment: false`): no checkout at all. */
  const bookingFree = () => {
    void analyticsService.trackConsultationBooked({
      agentId,
      type: mapTopicToConsultationType(topic),
      charged: { amountMinor: 0, currency: 'USD' },
    });
    // REPLACE, not push: the booking is already made and there is nothing
    // to pay, so this screen (still in its "Getting your price…" state) must
    // not stay under the confirmation. Back from there returns to the slot
    // picker instead of an endless spinner.
    goToConfirmation({ free: true, usdCents: 0, replace: true });
  };

  /**
   * React to a failed create / checkout / verify. Never throws. A quote that
   * is still on screen stays there unless the error says the booking is gone.
   *
   * @param stage which call failed: the same backend code (VALIDATION_ERROR)
   *              means "couldn’t book" on create and something else on verify.
   */
  const handleFlowError = (err: unknown, stage: PayStage) => {
    const v = classifyConsultationPayError(err, stage);
    const prev = quoteRef.current;
    switch (v.kind) {
      case 'pricing_unavailable':
        // Nothing was written / charged: dollars only, "Try again" retries.
        setPhase('unavailable');
        break;
      case 'new_checkout': {
        // The server re-priced: show the NEW amount before anything opens.
        const q = lockedQuoteFrom(
          v.consultation,
          v,
          Date.now(),
          prev?.clockOffsetMs ?? 0,
        );
        if (q) {
          applyQuote(q);
          resumeRef.current = false;
          setAttempted(false);
        } else setPhase(prev ? 'locked' : 'failed');
        break;
      }
      case 'not_payable':
        // The booking is closed (e.g. cancelled): the retry books anew.
        resetBooking();
        setPhase('failed');
        break;
      case 'payment_review':
      case 'limit_reached':
        // Terminal: a mismatched payment is being checked (never ask to pay
        // again), or the plan limit is reached (a retry cannot succeed).
        blockBooking();
        break;
      case 'opening':
      case 'in_progress': {
        // japa#288: with NO quote on screen, this 409 came from the create
        // (or its retry) and names an EARLIER booking of this slot in
        // `data.consultation`. Adopt it: every later call goes through
        // /consultations/:id/checkout for that booking, never a new create
        // (which would only resume the same booking, or book a duplicate).
        const found = v.consultation;
        if (!prev && found) {
          bookingIdRef.current = found.id;
          setAdoptedId(found.id); // fetch its real duration for the summary
          noteActual({ type: found.type });
          if (v.kind === 'in_progress') {
            // A payment may still land on its current checkout. Show the
            // booking's locked amount and offer ONLY "Check again", which
            // re-verifies that reference and opens nothing (as #183 does
            // after a verify that answered "in progress").
            const q = lockedQuoteFrom(found, v, Date.now());
            if (q?.reference) {
              applyQuote(q);
              // If the check finds it unpaid, reopen through /checkout.
              resumeRef.current = true;
              setRecheck(true); // after applyQuote, which clears it
              break;
            }
          }
        }
        // Opening (no checkout to show yet), or nothing usable in `data`:
        // keep the quote when there is one, else message + "Try again".
        setPhase(prev ? 'locked' : 'failed');
        break;
      }
      default:
        // Booking refused / any other failure: keep the quote on screen
        // when there is one, else offer the retry.
        setPhase(prev ? 'locked' : 'failed');
    }
    setPayError(v.message);
  };

  // ── Get (or refresh) the locked quote ──────────────────────────────────────
  // First call books: POST /consultations (no fee). Later calls (refresh
  // after expiry, or "Try again" once a 409 named the booking, japa#288)
  // go to the SAME booking: POST /consultations/:id/checkout.
  const requestQuote = async () => {
    // In-flight guard (a ref, so it holds before the next render): a double
    // tap on "Try again" / "Refresh price" must not send two create calls,
    // which would book the slot twice.
    if (quoteBusyRef.current) return;
    quoteBusyRef.current = true;
    try {
      await runQuoteRequest();
    } finally {
      quoteBusyRef.current = false;
    }
  };
  const runQuoteRequest = async () => {
    setPayError(null);
    setPhase('loading');
    const prev = quoteRef.current;
    // Which call is about to run, for the error mapping in the catch.
    const stage: PayStage = bookingIdRef.current ? 'checkout' : 'create';
    try {
      if (!bookingIdRef.current) {
        const input: CreateConsultationInput = {
          agentId,
          type: mapTopicToConsultationType(topic),
          scheduledDate: dateIso, // already 'yyyy-MM-dd'
          scheduledTime: to24HourTime(time), // "10:00 AM" → "10:00"
          durationMinutes: parseInt(dur, 10) || 30, // "30 min" → 30
          timezone: resolveTimezone(),
        };
        // 201 (new) and 200 `resumed: true` (the client's earlier unpaid
        // booking of this slot, japa#288) arrive here alike and take the
        // same path below: nothing is created twice, nothing is an error.
        const res = await createConsultation.mutateAsync(input);
        // What is booked, as the server holds it. For a resumed booking the
        // type / length may differ from `input`; the summary shows these.
        noteActual({
          type: res.type,
          durationMinutes: res.durationMinutes,
        });
        if (!res.requiresPayment) {
          if (isResumedBooking(res)) {
            // The earlier booking was PAID meanwhile (free bookings are
            // never resumed): confirmation with what it charged, not "Free".
            // Leave 'loading' first, as the checkout branch below does.
            setPhase('unavailable');
            bookingPaid(res, null);
            return;
          }
          bookingFree();
          return;
        }
        bookingIdRef.current = res.id;
        const q = lockedQuoteFrom(
          res,
          {
            authorizationUrl: res.authorizationUrl ?? res.checkoutUrl ?? null,
            reference: res.reference,
          },
          Date.now(),
          0,
          // A RESUMED booking was locked earlier, so its `quoteLockedAt` is
          // not "now": the countdown must continue to its real expiry (and
          // read "Refresh price" at once if that has passed), not restart
          // at 30:00. A new booking's lock IS now and measures the clock.
          !isResumedBooking(res),
        );
        if (!q) {
          // Paid booking without a usable snapshot: never a ₦0 checkout.
          setPhase('unavailable');
          setPayError(PAY_COPY.pricingUnavailable);
          return;
        }
        applyQuote(q);
        return;
      }

      const res = await checkoutConsultation.mutateAsync(bookingIdRef.current);
      if (!res.requiresPayment) {
        // Paid meanwhile (e.g. a late webhook): it's done. Leave 'loading'
        // first, so going back from the confirmation never shows "Getting
        // your price…" forever.
        setPhase(prev ? 'locked' : 'unavailable');
        bookingPaid(res.consultation, prev);
        return;
      }
      const q = lockedQuoteFrom(
        res.consultation,
        res,
        Date.now(),
        prev?.clockOffsetMs ?? 0,
      );
      if (!q) {
        setPhase('unavailable');
        setPayError(PAY_COPY.pricingUnavailable);
        return;
      }
      applyQuote(q);
      resumeRef.current = false;
      setAttempted(false);
    } catch (err) {
      handleFlowError(err, stage);
    }
  };

  // Book on arrival, ONCE per mount (the ref stops a re-render rebooking).
  const booked = useRef(false);
  useEffect(() => {
    if (isApp || !validParams || booked.current) return;
    booked.current = true;
    void requestQuote();
    // Runs once on mount by design (guarded by the ref).
  }, []);

  // ── Verify a booking's checkout (consultation path) ────────────────────────
  // 'paid' ONLY when the response body says so (`isBookingPaidResult`), never
  // on a bare 2xx. A classified 4xx is "not paid" with a note for the screen:
  //  - 409 QUOTE_EXPIRED / CHECKOUT_REPLACED hand over the new checkout,
  //    shown at once;
  //  - 409 BOOKING_NOT_PAYABLE closes the booking → 'failed' + "Try again";
  //  - 400 PAYMENT_MISMATCH → 'blocked' (they paid; never "pay again").
  // Anything unclassified throws → the generic error.
  const verifyBooking = async (q: LockedQuote): Promise<VerifyVerdict> => {
    if (!q.reference) throw new Error('No payment reference');
    try {
      const r = await verifyConsultation.mutateAsync(q.reference);
      if (!isBookingPaidResult(r)) {
        // A 2xx that does not say "paid" must never reach the confirmation.
        verifyKindRef.current = 'not_completed';
        verifyNoteRef.current = PAY_COPY.notCompleted;
        return 'not_paid';
      }
      paidSummaryRef.current = r.consultation ?? null;
      return 'paid';
    } catch (err) {
      const v = classifyConsultationPayError(err, 'verify');
      verifyKindRef.current = v.kind;
      if (v.kind === 'error') throw err;
      verifyNoteRef.current = v.message;
      if (v.kind === 'new_checkout') {
        const nq = lockedQuoteFrom(
          v.consultation,
          v,
          Date.now(),
          q.clockOffsetMs,
        );
        if (nq) {
          applyQuote(nq);
          // The new checkout is ready: the next Pay opens it directly.
          resumeRef.current = false;
          return 'not_paid';
        }
      }
      if (v.kind === 'not_payable') {
        // The booking closed while Paystack was open (e.g. cancelled). Drop
        // it AND leave 'locked': in 'failed' the dead "Pay" is disabled and
        // "Try again" books a new slot. (Staying 'locked' with no quote left
        // a live-looking "Pay" that did nothing.)
        resetBooking();
        setPhase('failed');
      }
      if (v.kind === 'payment_review' || v.kind === 'limit_reached') {
        blockBooking();
      }
      if (v.kind === 'pricing_unavailable') setPhase('unavailable');
      return 'not_paid';
    }
  };

  // ── Pay a booking ─────────────────────────────────────────────────────────
  /**
   * After a verify call that failed outright (network / 5xx): settle what
   * happened to the checkout that was open, WITHOUT opening anything. Used
   * by both the first failure's follow-up and every "Check again" press.
   *
   * @param q the quote whose reference was (or is being) verified
   */
  const finishVerify = (verdict: VerifyVerdict, q: LockedQuote) => {
    if (verdict === 'paid') {
      setRecheck(false);
      bookingPaid(paidSummaryRef.current, q);
      return;
    }
    const verifyKind = verifyKindRef.current;
    if (verifyKind === 'in_progress' || verifyKind === 'unconfirmed') {
      // A payment may still land (in progress), or may already have been
      // made (unconfirmed): the only safe control is "Check again", which
      // re-verifies and opens nothing. Never "Open checkout" here.
      setRecheck(true);
      setPayError(verifyNoteRef.current ?? PAY_COPY.unconfirmed);
      return;
    }
    // Verify answered: we now know it is not paid (or what else is up).
    setRecheck(false);
    setAttempted(!(verifyKind && VERIFY_ENDS_CHECKOUT.has(verifyKind)));
    setPayError(verifyNoteRef.current ?? PAY_COPY.notCompleted);
  };

  // ── "Check again": re-verify the SAME reference ────────────────────────────
  // No browser, no /checkout, no new booking: only POST /consultations/
  // public/verify with the reference that was just used. If the call fails
  // again the screen stays as it is (still "Check again").
  const onCheckAgain = async () => {
    const q = quoteRef.current;
    if (processing || !q) return;
    setPayError(null);
    setProcessing(true);
    verifyNoteRef.current = null;
    verifyKindRef.current = null;
    paidSummaryRef.current = null;
    try {
      const verdict = await verifyBooking(q);
      setProcessing(false);
      finishVerify(verdict, q);
    } catch {
      setProcessing(false);
      setPayError(PAY_COPY.verifyFailed);
    }
  };

  const onPayBooking = async () => {
    if (processing) return;
    // A payment is waiting to be checked: check it, never open a checkout.
    if (recheck) {
      await onCheckAgain();
      return;
    }
    // Expired: the CTA is "Refresh price" (no method needed to re-price).
    if (expired) {
      await requestQuote();
      return;
    }
    const current = quoteRef.current;
    if (!method || phase !== 'locked' || !current) return;
    setPayError(null);
    setProcessing(true);

    let q = current;
    // After an unpaid attempt (or with no URL yet), resume through
    // /checkout: same checkout inside the lock, a FRESH quote after it.
    if (resumeRef.current || !q.authorizationUrl) {
      try {
        const res = await checkoutConsultation.mutateAsync(q.consultationId);
        if (!res.requiresPayment) {
          setProcessing(false);
          bookingPaid(res.consultation, q);
          return;
        }
        const nq = lockedQuoteFrom(
          res.consultation,
          res,
          Date.now(),
          q.clockOffsetMs,
        );
        if (!nq) {
          setProcessing(false);
          setPhase('unavailable');
          setPayError(PAY_COPY.pricingUnavailable);
          return;
        }
        applyQuote(nq);
        resumeRef.current = false;
        if (chargeChanged(q, nq)) {
          // A new amount: let the user see it before Paystack opens.
          setProcessing(false);
          setAttempted(false);
          setPayError(PAY_COPY.newPrice);
          return;
        }
        q = nq;
      } catch (err) {
        setProcessing(false);
        handleFlowError(err, 'checkout');
        return;
      }
    }

    verifyNoteRef.current = null;
    verifyKindRef.current = null;
    paidSummaryRef.current = null;
    resumeRef.current = true; // whatever happens next, reopen via /checkout
    const outcome = await runPaystackCheckout({
      authorizationUrl: q.authorizationUrl ?? '',
      openAuthSession: WebBrowser.openAuthSessionAsync,
      verify: () => verifyBooking(q),
    });
    setProcessing(false);
    if (outcome.kind === 'paid') {
      bookingPaid(paidSummaryRef.current, q);
      return;
    }
    if (outcome.kind === 'open_failed') {
      setPayError(OPEN_CHECKOUT_ERROR_MESSAGE);
      return;
    }
    if (outcome.kind === 'error') {
      // The verify CALL failed after Paystack closed (network / 5xx). They
      // may have paid: never "Nothing was charged", never "pay again". The
      // CTA becomes "Check again" (re-verify, same reference). Without a
      // reference there is nothing to re-check: the plain error + reopen.
      if (q.reference) {
        setRecheck(true);
        setPayError(PAY_COPY.verifyFailed);
      } else {
        setAttempted(true);
        setPayError(PAY_COPY.error);
      }
      return;
    }
    // Not paid: stay, with "Open checkout" as the retry. NOT when verify
    // ended that checkout (a new price reads "Pay {new amount}"; a closed
    // booking shows "Try again"; a blocked screen shows no control): setting
    // `attempted` there would mislabel the CTA for the next quote.
    finishVerify('not_paid', q);
  };

  // ── Payment request (application path) ────────────────────────────────────
  // Verify THIS request's charge with the backend: 'paid' only when it says
  // the request is settled; throws when the call itself failed. The
  // reference is the one from approve (route param), never one read from the
  // return deep link.
  const verifyThisRequest = async (): Promise<VerifyVerdict> => {
    const result = await verifyRequest.mutateAsync({
      requestId: requestId!,
      reference: reference!,
    });
    paidRequestRef.current = result ?? null;
    return isPaidResult(result) ? 'paid' : 'not_paid';
  };

  /** A paid request → confirmation with what it charged (display only). */
  const requestPaid = () => {
    const r = paidRequestRef.current ?? request ?? null;
    const charged: Money | null = r?.charge
      ? r.charge
      : typeof r?.chargedAmountMinor === 'number' && r.chargedCurrency
        ? { amountMinor: r.chargedAmountMinor, currency: r.chargedCurrency }
        : r
          ? { amountMinor: r.amount, currency: r.currency }
          : null;
    goToConfirmation({
      charged,
      usdCents: r?.priceUsd?.amountMinor ?? r?.priceUsdCents ?? null,
    });
  };

  // Open (or reopen) the Paystack checkout in the auth browser, then verify
  // once however it closed (japa#252). Paid → confirmation; anything else
  // stays on this screen with a message and "Open checkout" as the retry.
  const onOpenCheckout = async () => {
    if (!authorizationUrl || !requestId || !reference || processing) return;
    setPayError(null);
    setProcessing(true);
    const outcome = await runPaystackCheckout({
      authorizationUrl,
      openAuthSession: WebBrowser.openAuthSessionAsync,
      verify: verifyThisRequest,
    });
    setProcessing(false);
    if (outcome.kind === 'paid') requestPaid();
    else if (outcome.kind === 'not_paid') setPayError(NOT_PAID_MESSAGE);
    else if (outcome.kind === 'error') setPayError(PAYMENT_ERROR_MESSAGE);
    else setPayError(OPEN_CHECKOUT_ERROR_MESSAGE);
  };

  // Right after approve (application/[id] passes autoOpen=1) open checkout
  // straight away, ONCE per mount: the ref stops re-renders reopening it.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpen !== '1' || !isApp || autoOpened.current) return;
    autoOpened.current = true;
    void onOpenCheckout();
    // Runs once on mount by design (guarded by the ref).
  }, []);

  // "I’ve paid — confirm" (payment request): verify the REAL Paystack charge.
  // A cancelled / abandoned checkout comes back as a success response that
  // is NOT paid, so we check the status, not just that the call worked.
  const onConfirmRequest = async () => {
    if (processing) return;
    setPayError(null);
    setProcessing(true);
    try {
      const verdict = await verifyThisRequest();
      setProcessing(false);
      if (verdict === 'paid') requestPaid();
      else setPayError(NOT_PAID_MESSAGE);
    } catch {
      setProcessing(false);
      setPayError(PAYMENT_ERROR_MESSAGE);
    }
  };

  // ── CTA state ─────────────────────────────────────────────────────────────
  // Booking: live once a method is chosen and a quote is locked; "Refresh
  // price" is always live. Payment request: always live.
  const bookingQuoteDown = phase === 'unavailable' || phase === 'failed';
  const ctaEnabled = isApp
    ? !processing
    : !processing && (expired || (phase === 'locked' && (recheck || !!method)));
  const ctaLabel = isApp
    ? 'I’ve paid — confirm'
    : expired
      ? 'Refresh price'
      : phase === 'locked' && quote
        ? recheck
          ? 'Check again'
          : attempted
            ? 'Open checkout'
            : `Pay ${formatMoney(quote.charged)}`
        : 'Pay';
  // Loading the quote shows a white spinner in place of the label.
  const ctaBusy = processing || (!isApp && phase === 'loading');
  // Countdown turns status-error-fg in the last five minutes.
  const countdownWarn =
    secondsLeft !== null && secondsLeft <= COUNTDOWN_WARN_SECONDS;
  // Dim the locked amounts once the quote has expired.
  const amountOpacity = expired ? 0.6 : 1;

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
              {/* Duration and topic are the BOOKED ones (japa#288): the
                  user's pick, or a resumed booking's own values. */}
              <SummaryRow icon={Ic.clock} label={`${time} · ${display.dur}`} />
              <SummaryRow icon={isVideo ? Ic.video : Ic.phone} label={mode} />
              <SummaryRow icon={Ic.msg} label={display.topic} />
            </>
          )}
        </View>

        {/* ── Resumed booking differs from the pick (japa#288) ─────────────── */}
        {/* Says why the card above does not match what was chosen. */}
        {!isApp && showResumedNote ? (
          <View style={{ marginTop: 12 }}>
            <InfoNote icon={Ic.cal}>{PAY_COPY.resumedDetails}</InfoNote>
          </View>
        ) : null}

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
          {isApp ? (
            // ── Payment request: the request's own price ───────────────────
            // Dollars while pending; the local charge once approve priced it.
            <>
              <SummaryLine
                first
                label="Amount"
                value={requestParts?.primary ?? '—'}
              />
              <View
                style={{
                  height: 1,
                  backgroundColor: EX.color.line06,
                  marginVertical: 13,
                }}
              />
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <Text
                  style={{
                    fontSize: 15.5,
                    fontWeight: '700',
                    color: EX.color.ink,
                  }}
                >
                  Total
                </Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={displayText(18, 'bold')}>
                    {requestParts?.primary ?? '—'}
                  </Text>
                  {requestParts?.secondary ? (
                    <Text
                      style={{
                        fontSize: 12.5,
                        fontWeight: '600',
                        color: EX.color.inkMuted,
                        marginTop: 2,
                      }}
                    >
                      {requestParts.secondary}
                    </Text>
                  ) : null}
                </View>
              </View>
            </>
          ) : phase === 'loading' ? (
            // ── Booking: getting the locked price ───────────────────────────
            <View
              style={{ alignItems: 'center', paddingVertical: 18, gap: 10 }}
            >
              <ActivityIndicator color={EX.color.primary} />
              <Text style={{ fontSize: 14, color: EX.color.inkMuted }}>
                Getting your price…
              </Text>
            </View>
          ) : phase === 'locked' && quote ? (
            // ── Booking: the LOCKED quote, exactly as the server stored it ──
            <View style={{ opacity: amountOpacity }}>
              <SummaryLine
                first
                label="Consultation fee"
                value={formatMoney(quote.charged)}
              />
              <SummaryLine
                label="Service fee"
                value={formatMoney({
                  amountMinor: 0,
                  currency: quote.charged.currency,
                })}
              />
              <View
                style={{
                  height: 1,
                  backgroundColor: EX.color.line06,
                  marginVertical: 13,
                }}
              />
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 15.5,
                    fontWeight: '700',
                    color: EX.color.ink,
                  }}
                >
                  Total
                </Text>
                {/* section-title 18/700 ink */}
                <Text style={displayText(18, 'bold')}>
                  {formatMoney(quote.charged)}
                </Text>
              </View>
              {/* "$35.00 at ₦1,353.97 per $1" — the server's figures, verbatim. */}
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: '600',
                  color: EX.color.inkMuted,
                  textAlign: 'right',
                  marginTop: 4,
                }}
              >
                {lockedRateLine(quote)}
              </Text>
            </View>
          ) : (
            // ── Booking: no quote (pricing unavailable / failed) ────────────
            // Dollar price only, no rate line, no lock note.
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 15.5,
                  fontWeight: '700',
                  color: EX.color.ink,
                }}
              >
                Total
              </Text>
              <Text style={displayText(18, 'bold')}>
                {agentUsd ? formatMoney(agentUsd) : '—'}
              </Text>
            </View>
          )}
        </View>

        {/* ── Lock note + live countdown (booking, locked, not expired) ─────── */}
        {/* InfoNote anatomy (cream panel, shield) with the countdown on the
            right; tabular numerals so the digits don't jitter. */}
        {/* Hidden while a payment check is pending (`recheck`): "locked for
            30 minutes" with 0:00 next to "Check again" would only confuse. */}
        {!isApp && phase === 'locked' && quote && !expired && !recheck ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: EX.color.cream,
              borderWidth: 1,
              borderColor: EX.color.line08,
              borderRadius: 16,
              padding: 14,
              marginTop: 12,
            }}
          >
            <Ic.shield size={17} color={EX.color.primary} strokeWidth={1.9} />
            <Text
              style={{
                flex: 1,
                fontSize: 13,
                lineHeight: 19,
                color: EX.color.ink2,
              }}
            >
              Your price is locked for 30 minutes.
            </Text>
            {secondsLeft !== null ? (
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: '600',
                  fontVariant: ['tabular-nums'],
                  // status-error-fg in the last five minutes.
                  color: countdownWarn
                    ? EX.docStatus.rejected.fg
                    : EX.color.ink,
                }}
              >
                {formatCountdown(secondsLeft)}
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* ── Sticky glass CTA ────────────────────────────────────────────────── */}
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
        {/* Expired quote / payment failure above the CTA (the CTA retries). */}
        {expired || payError ? (
          <View style={{ marginBottom: 12 }}>
            <InlineError message={expired ? PAY_COPY.expired : payError} />
          </View>
        ) : null}
        {/* Payment request: reopen Paystack (e.g. after cancelling). */}
        {isApp && authorizationUrl ? (
          <Pressable
            onPress={onOpenCheckout}
            disabled={processing}
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
          onPress={isApp ? onConfirmRequest : onPayBooking}
          disabled={!ctaEnabled}
          accessibilityLabel={ctaLabel}
          style={{
            height: 54,
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: EX.color.primary,
            // Disabled = 60% opacity (design spec), never a different colour.
            opacity: ctaEnabled || ctaBusy ? 1 : 0.6,
            shadowColor: EX.color.primary,
            shadowOpacity: ctaEnabled ? 0.45 : 0,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 10 },
            elevation: ctaEnabled ? 6 : 0,
          }}
        >
          {ctaBusy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text
              style={{ color: '#fff', fontSize: 15.5, fontWeight: '700' }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.9}
            >
              {ctaLabel}
            </Text>
          )}
        </Pressable>
        {/* No quote (pricing unavailable / failed): "Try again" re-runs it. */}
        {!isApp && bookingQuoteDown ? (
          <Pressable
            onPress={() => void requestQuote()}
            hitSlop={8}
            style={{ alignSelf: 'center', marginTop: 12 }}
          >
            <Text
              style={{
                color: EX.color.primary,
                fontSize: 14.5,
                fontWeight: '700',
              }}
            >
              Try again
            </Text>
          </Pressable>
        ) : null}
      </BlurView>
    </View>
  );
}
