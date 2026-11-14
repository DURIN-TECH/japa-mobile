// ─────────────────────────────────────────────────────────────────────────────
// Subscription / plans (prototype flows.jsx SubscriptionView).
//
// A pricing screen presented as a bottom-sheet modal (see the stack animation in
// _layout.tsx). A full-bleed coral gradient header with two decorative
// circles sits above a stack of PlanCards:
//   • featured plan (tag "Most popular")  → dark gradient card + crown + coral Upgrade
//   • current plan  (from GET /subscriptions/me) → coral border + "Current" pill + disabled CTA
//   • other plans                          → white card + dark Upgrade (+ optional tag)
//
// Every measurement below is quoted from the prototype (flows.jsx).
//
// japa#145: live only. Plans (names, prices) from GET /plans; the current
// plan from GET /subscriptions/me; feature copy from the static
// `PLAN_FEATURES` / FEATURE_LABEL catalogue. No demo `PLANS`, and never an
// assumed "free" plan: while the subscription is unknown or failed there is
// no "Current plan" badge and the upgrade CTAs are disabled (60%); a failure
// shows an InlineError + "Try again". Plans loading → coral spinner; plans
// failed → error + retry; no plans → "No plans available right now".
//
// japa#252: Upgrade opens Paystack in the in-app auth browser
// (`openAuthSessionAsync`), which closes by itself when Paystack returns
// through the backend's return page (`durintech://payment-return`). The app
// then verifies the checkout's OWN reference with POST /subscriptions/verify;
// only a confirmed verify changes the plan (the hook invalidates
// ['subscription','me'] + ['authorization'] so it shows at once). Closing the
// browser is silent unless the verify finds a payment; not paid after a
// return → InlineError; a failed verify → error + "Try again" (re-verifies).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX } from '@/components/explorer/theme';
import { PLAN_FEATURES, NAIRA } from '@/components/explorer/content';
import type { Plan } from '@/types/explorer.type';
import { InlineError } from '@/components/explorer/AccountForm';
import {
  StateEmpty,
  StateError,
  StateLoading,
  loadErrorCopy,
  queryState,
} from '@/components/explorer/states';
import { Ic } from '@/components/explorer/icons';
import { GlassButton } from '@/components/explorer/primitives';
// ── Live backend wiring — plans, current subscription, checkout ──────────────
import {
  usePlans,
  useMySubscription,
  useStartCheckout,
  useVerifySubscription,
} from '@/hooks/useSubscription';
import {
  OPEN_CHECKOUT_ERROR_MESSAGE,
  SUBSCRIPTION_NOT_PAID_MESSAGE,
  SUBSCRIPTION_VERIFY_ERROR_MESSAGE,
  runPaystackCheckout,
  subscriptionVerifyErrorVerdict,
  type VerifyVerdict,
} from '@/hooks/paystackCheckout';
import { mapPlan } from '@/components/explorer/liveSubscription';

// ── FeatureRow — 20px check circle + label for one plan feature ──────────────
// `dark` switches the palette so features read on the featured dark card.
function FeatureRow({ label, dark }: { label: string; dark?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: dark ? 'rgba(63,184,175,0.22)' : '#D6F2E2',
        }}
      >
        <Ic.check
          size={11}
          color={dark ? '#5BE0D3' : EX.color.success}
          strokeWidth={3.2}
        />
      </View>
      <Text
        style={{
          flex: 1,
          fontSize: 13.5,
          fontWeight: '600',
          color: dark ? 'rgba(255,255,255,0.92)' : EX.color.ink2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// ── PlanCard — one pricing tier ──────────────────────────────────────────────
// `currentId` marks the active plan (null while unknown → no badge);
// `disabled` greys the upgrade CTA (60%) while the subscription is unknown;
// `onUpgrade` launches Paystack checkout for a paid, non-current tier.
function PlanCard({
  plan,
  currentId,
  disabled,
  onUpgrade,
}: {
  plan: Plan;
  currentId: string | null;
  disabled?: boolean;
  onUpgrade: (plan: Plan) => void;
}) {
  const featured = plan.tag === 'Most popular';
  const current = plan.id === currentId;

  // Card chrome: featured is a dark gradient; current gets a coral border; the
  // rest are plain white cards.
  const Container: React.ElementType = featured ? LinearGradient : View;
  const containerProps = featured
    ? {
        colors: [EX.color.dark1, EX.color.dark2] as const, // 158deg #241B33 → #14101F
        start: { x: 0.1, y: 0 },
        end: { x: 0.9, y: 1 },
      }
    : {};

  return (
    <Container
      {...containerProps}
      style={{
        position: 'relative',
        borderRadius: EX.radius.cardLg, // 24
        padding: 20,
        marginBottom: 15,
        backgroundColor: featured ? undefined : '#fff',
        borderWidth: featured ? 0 : 1,
        borderColor: current ? EX.color.primary : EX.color.line08,
        // Featured card floats on a soft shadow; the rest sit flat.
        shadowColor: '#171326',
        shadowOpacity: featured ? 0.4 : 0.04,
        shadowRadius: featured ? 24 : 2,
        shadowOffset: { width: 0, height: featured ? 16 : 1 },
        elevation: featured ? 8 : 1,
      }}
    >
      {/* Trailing pill (absolute top-right): coral tag, else "Current" */}
      {plan.tag ? (
        <View
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: 11,
            paddingVertical: 5,
            borderRadius: 999,
            backgroundColor: EX.color.primary,
          }}
        >
          <Ic.spark size={12} color="#fff" strokeWidth={1.8} />
          <Text
            style={{
              fontSize: 10.5,
              fontWeight: '700',
              letterSpacing: 0.42,
              textTransform: 'uppercase',
              color: '#fff',
            }}
          >
            {plan.tag}
          </Text>
        </View>
      ) : current ? (
        <View
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
            paddingHorizontal: 11,
            paddingVertical: 5,
            borderRadius: 999,
            backgroundColor: EX.color.primaryTint12,
          }}
        >
          <Text
            style={{ fontSize: 11, fontWeight: '700', color: EX.color.primary }}
          >
            Current
          </Text>
        </View>
      ) : null}

      {/* Header: crown chip (featured) · name */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {featured ? (
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(244,81,108,0.2)',
            }}
          >
            <Ic.crown size={17} color="#FF7D95" strokeWidth={1.8} />
          </View>
        ) : null}
        <Text
          style={{
            fontSize: 16,
            fontWeight: '700',
            color: featured ? '#fff' : EX.color.ink,
          }}
        >
          {plan.name}
        </Text>
      </View>

      {/* Price + interval */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: 3,
          marginTop: 8,
        }}
      >
        <Text
          style={{
            fontFamily: EX.font.display.bold,
            fontSize: 30,
            letterSpacing: -0.6,
            color: featured ? '#fff' : EX.color.ink,
          }}
        >
          {plan.price === 0 ? 'Free' : NAIRA(plan.price)}
        </Text>
        {plan.interval ? (
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: featured ? 'rgba(255,255,255,0.6)' : EX.color.muted,
            }}
          >
            /{plan.interval}
          </Text>
        ) : null}
      </View>

      {/* Blurb */}
      <Text
        style={{
          fontSize: 13,
          lineHeight: 19.5,
          color: featured ? 'rgba(255,255,255,0.72)' : EX.color.inkMuted,
          marginTop: 6,
        }}
      >
        {plan.blurb}
      </Text>

      {/* Feature list */}
      <View style={{ marginTop: 16, gap: 10 }}>
        {plan.features.map((key) => (
          // Catalogue keys map through PLAN_FEATURES; live plans already carry
          // human labels (FEATURE_LABEL), so fall back to the value itself.
          <FeatureRow
            key={key}
            label={PLAN_FEATURES[key] ?? key}
            dark={featured}
          />
        ))}
      </View>

      {/* CTA — current plan is disabled; everyone else can Upgrade */}
      {current ? (
        <View
          style={{
            height: 48,
            borderRadius: 14,
            marginTop: 18,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: EX.color.line12,
          }}
        >
          <Text
            style={{ fontSize: 14, fontWeight: '700', color: EX.color.muted }}
          >
            Your current plan
          </Text>
        </View>
      ) : (
        <Pressable
          onPress={() => onUpgrade(plan)}
          disabled={disabled}
          style={{
            opacity: disabled ? 0.6 : 1,
            height: 48,
            borderRadius: 14,
            marginTop: 18,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            backgroundColor: featured ? EX.color.primary : EX.color.ink,
            // Featured button carries a coral glow; the dark button sits flat.
            shadowColor: EX.color.primary,
            shadowOpacity: featured ? 0.45 : 0,
            shadowRadius: featured ? 16 : 0,
            shadowOffset: { width: 0, height: featured ? 10 : 0 },
            elevation: featured ? 6 : 0,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 14.5, fontWeight: '700' }}>
            {plan.price === 0 ? 'Switch to Free' : 'Upgrade'}
          </Text>
          <Ic.arrow size={17} color="#fff" strokeWidth={2} />
        </Pressable>
      )}
    </Container>
  );
}

export default function SubscriptionView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── Live plans (GET /plans?audience=client) ────────────────────────────────
  // The Explorer's subscriber is an individual client → audience "client".
  const plansQ = usePlans('client');
  const plans = useMemo<Plan[]>(() => {
    const dtos = plansQ.data ?? [];
    // Backend doesn't flag a "Most popular" plan, so promote the middle-priced
    // paid tier.
    const paid = dtos
      .filter((p) => p.priceKobo > 0)
      .sort((a, b) => a.priceKobo - b.priceKobo);
    const popularId = paid.length
      ? paid[Math.floor((paid.length - 1) / 2)].id
      : undefined;
    return dtos.map((p) => mapPlan(p, popularId));
  }, [plansQ.data]);
  const plansState = queryState(plansQ);

  // ── Current plan (GET /subscriptions/me) ────────────────────────────────────
  // Known only once the call answered. A loaded `subscription: null` means no
  // paid subscription, so the zero-price plan is the current one (that is the
  // backend's answer, not an assumption). Unknown / failed → null.
  const mine = useMySubscription();
  const subKnown = mine.data !== undefined;
  const currentId: string | null = subKnown
    ? (mine.data?.subscription?.planId ??
      plans.find((p) => p.price === 0)?.id ??
      null)
    : null;
  const subFailed = mine.isError && !subKnown;

  // ── Upgrade → Paystack checkout (japa#252) ─────────────────────────────────
  // The zero-price tier has no checkout (downgrades aren't self-serve), so it
  // is a no-op; paid tiers open the hosted checkout in the auth browser and
  // verify on return. `checkoutError` = plain InlineError (the Upgrade button
  // is the retry); `verifyRetryRef` = a reference whose verify call FAILED, so
  // the error shows a "Try again" that re-verifies it (never reopens checkout).
  const checkout = useStartCheckout();
  const verifySub = useVerifySubscription();
  const [checkoutError, setCheckoutError] = React.useState<string | null>(null);
  const [verifyRetryRef, setVerifyRetryRef] = React.useState<string | null>(
    null,
  );
  // True from Upgrade tap until the verify settles: blocks double checkouts.
  const [busy, setBusy] = React.useState(false);

  // Verify one reference with the backend → 'paid' | 'not_paid', or throws
  // when the call itself failed (network / 5xx). A 400 is "not paid".
  const verifyReference = useCallback(
    async (reference: string): Promise<VerifyVerdict> => {
      try {
        await verifySub.mutateAsync(reference);
        return 'paid';
      } catch (e) {
        return subscriptionVerifyErrorVerdict(e);
      }
    },
    [verifySub],
  );

  const onUpgrade = useCallback(
    async (plan: Plan) => {
      if (plan.price === 0 || busy) return;
      setCheckoutError(null);
      setVerifyRetryRef(null);
      setBusy(true);
      try {
        // 1. Ask the backend for a checkout that returns to the app.
        let started: Awaited<ReturnType<typeof checkout.mutateAsync>>;
        try {
          started = await checkout.mutateAsync(plan.id);
        } catch {
          started = null;
        }
        if (!started) {
          setCheckoutError(OPEN_CHECKOUT_ERROR_MESSAGE);
          return;
        }
        // 2. Pay in the auth browser, then verify OUR reference once.
        const { url, reference } = started;
        const outcome = await runPaystackCheckout({
          authorizationUrl: url,
          openAuthSession: WebBrowser.openAuthSessionAsync,
          verify: () => verifyReference(reference),
        });
        // 3. Render the backend's verdict. `paid` needs nothing: the verify
        //    hook refreshed the subscription, so "Current" moves by itself.
        if (outcome.kind === 'open_failed') {
          setCheckoutError(OPEN_CHECKOUT_ERROR_MESSAGE);
        } else if (outcome.kind === 'error') {
          setVerifyRetryRef(reference);
        } else if (outcome.kind === 'not_paid' && outcome.returned) {
          // Came back through the return page yet nothing was charged.
          setCheckoutError(SUBSCRIPTION_NOT_PAID_MESSAGE);
        }
        // not_paid after the user closed the browser: stay as we were, silently.
      } finally {
        setBusy(false);
      }
    },
    [busy, checkout, verifyReference],
  );

  // "Try again" on a failed verify: re-check the same reference only.
  const onRetryVerify = useCallback(async () => {
    const reference = verifyRetryRef;
    if (!reference || busy) return;
    setBusy(true);
    try {
      const verdict = await verifyReference(reference);
      setVerifyRetryRef(null);
      setCheckoutError(
        verdict === 'paid' ? null : SUBSCRIPTION_NOT_PAID_MESSAGE,
      );
    } catch {
      // Still failing: keep the error + retry up (spinner off).
    } finally {
      setBusy(false);
    }
  }, [busy, verifyReference, verifyRetryRef]);

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 16) + 24,
        }}
      >
        {/* ── Coral gradient header (160deg #F4516C → #C0374F) ──────────────── */}
        <LinearGradient
          colors={[EX.color.primary, EX.color.primaryDark]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{
            paddingTop: insets.top + 14, // prototype 92 → safe-area inset
            paddingHorizontal: EX.space.screenX, // 22
            paddingBottom: 40,
            overflow: 'hidden',
          }}
        >
          {/* Two decorative translucent circles */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -50,
              right: -30,
              width: 190,
              height: 190,
              borderRadius: 95,
              backgroundColor: 'rgba(255,255,255,0.1)',
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: -70,
              left: -40,
              width: 180,
              height: 180,
              borderRadius: 90,
              backgroundColor: 'rgba(255,255,255,0.08)',
            }}
          />

          {/* Glass back button */}
          <View style={{ flexDirection: 'row' }}>
            <GlassButton icon={Ic.chevL} onPress={() => router.back()} />
          </View>

          {/* "Seli Premium" glass badge */}
          <BlurView
            intensity={18}
            tint="light"
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              borderRadius: 999,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.4)',
              backgroundColor: 'rgba(255,255,255,0.2)',
              paddingHorizontal: 12,
              paddingVertical: 6,
              marginTop: 20,
            }}
          >
            <Ic.crown size={14} color="#fff" strokeWidth={1.8} />
            <Text
              style={{
                color: '#fff',
                fontSize: 12,
                fontWeight: '700',
                letterSpacing: 0.3,
              }}
            >
              Seli Premium
            </Text>
          </BlurView>

          {/* H1 — 30 Space Grotesk (semibold), two lines */}
          <Text
            style={{
              fontFamily: EX.font.display.semibold,
              fontSize: 30,
              lineHeight: 32,
              letterSpacing: -0.6,
              color: '#fff',
              marginTop: 14,
            }}
          >
            {'Move faster with\nthe right plan'}
          </Text>

          {/* Sub */}
          <Text
            style={{
              fontSize: 14,
              lineHeight: 21,
              color: 'rgba(255,255,255,0.88)',
              marginTop: 10,
              maxWidth: 290,
            }}
          >
            Unlock agent messaging, document uploads and priority support.
          </Text>
        </LinearGradient>

        {/* ── Plan cards ───────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: EX.space.screenX, paddingTop: 24 }}>
          {/* Current plan unknown because the call failed: say so + retry. */}
          {subFailed && plansState === 'ready' && plans.length ? (
            <StateError
              section
              style={{ marginBottom: 16 }}
              message={loadErrorCopy('your current plan')}
              onRetry={() => mine.refetch()}
              retrying={mine.isRefetching}
            />
          ) : null}
          {checkoutError ? (
            <View style={{ marginBottom: 16 }}>
              <InlineError message={checkoutError} />
            </View>
          ) : null}
          {/* japa#252: verify call failed → error + "Try again" (re-verify). */}
          {verifyRetryRef ? (
            <StateError
              section
              style={{ marginBottom: 16 }}
              message={SUBSCRIPTION_VERIFY_ERROR_MESSAGE}
              onRetry={onRetryVerify}
              retrying={busy}
            />
          ) : null}

          {plansState === 'loading' ? <StateLoading section /> : null}
          {plansState === 'error' ? (
            <StateError
              section
              message={loadErrorCopy('plans')}
              onRetry={() => plansQ.refetch()}
              retrying={plansQ.isRefetching}
            />
          ) : null}
          {plansState === 'ready' && plans.length === 0 ? (
            <StateEmpty
              section
              icon={Ic.crown}
              title="No plans available right now"
              body="Check back soon."
            />
          ) : null}

          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              currentId={currentId}
              // Unknown subscription → no upgrades until we know the plan;
              // also locked while a checkout / verify is in flight (japa#252).
              disabled={!subKnown || busy}
              onUpgrade={onUpgrade}
            />
          ))}

          {/* Paystack footnote — centered, two lines */}
          <Text
            style={{
              textAlign: 'center',
              fontSize: 12,
              lineHeight: 18,
              color: EX.color.muted,
              marginTop: 4,
            }}
          >
            {
              'Upgrades open a secure Paystack checkout.\nCancel anytime — no hidden fees.'
            }
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
