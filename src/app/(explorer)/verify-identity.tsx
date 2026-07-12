// ─────────────────────────────────────────────────────────────────────────────
// Verify identity (profile → identity-verification / KYC secondary destination).
//
// Client identity-verification screen for the Explorer app. The whole screen is
// driven by the live verification status (`useIdentityVerification().data?.status`):
//
//   • verified                → success state (teal check badge + Done, no form)
//   • pending | under_review  → waiting state (clock badge + Done, no form)
//   • unverified | failed      → the submission FORM (failed also shows the reason
//                                in a danger banner, then lets them resubmit)
//
// The form collects a government ID (NIN or BVN) + explicit consent and submits it
// via `useSubmitIdentity()`. On success the hook seeds the query cache, so this
// screen re-renders straight into the verified/under_review state — no manual
// navigation needed. Errors surface both inline and as an Alert; nothing crashes.
//
// Scaffold matches the LIGHT coral/cream secondary screens (documents.tsx): a
// SafeArea-aware back-chevron header over a warm `EX.color.bg`. The form's input +
// sticky bottom CTA follow the onboarding pattern (personal-info.tsx), wrapped in
// KeyboardAvoidingView so the CTA rides above the keyboard.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import {
  useIdentityVerification,
  useSubmitIdentity,
} from '@/hooks/useVerification';

// ── Consent copy ──────────────────────────────────────────────────────────────
// EXACT string the backend expects for identity-verification consent — do not
// paraphrase; it must match the backend contract verbatim.
const CONSENT_TEXT =
  'I consent to Seli verifying my identity by looking up my BVN/NIN with the ' +
  'relevant Nigerian authority (NIBSS / NIMC) for identity-verification (KYC) ' +
  'purposes.';

// ── BackHeader — 40px back chevron + title (mirrors documents.tsx) ────────────
function BackHeader({
  title,
  subtitle,
  insets,
  onBack,
}: {
  title: string;
  subtitle?: string;
  insets: { top: number };
  onBack: () => void;
}) {
  return (
    <View
      style={{
        paddingTop: insets.top + 10,
        paddingHorizontal: 18,
        paddingBottom: 6,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable
          onPress={onBack}
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
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={displayText(24, 'semibold')}>{title}</Text>
          {subtitle ? (
            <Text
              style={{ fontSize: 12.5, color: EX.color.muted, marginTop: 2 }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ── StatusBadge — big circular icon chip for the success/waiting states ───────
function StatusBadge({
  icon: IconCmp,
  fg,
  bg,
}: {
  icon: React.ElementType;
  fg: string;
  bg: string;
}) {
  return (
    <View
      style={{
        width: 96,
        height: 96,
        borderRadius: 48,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
      }}
    >
      <IconCmp size={44} color={fg} strokeWidth={1.8} />
    </View>
  );
}

// ── DoneButton — coral CTA that pops back to the profile ──────────────────────
function DoneButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        height: 54,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: EX.color.primary,
        shadowColor: EX.color.primary,
        shadowOpacity: 0.45,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
        elevation: 6,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '700' }}>
        Done
      </Text>
    </Pressable>
  );
}

export default function VerifyIdentityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── Live verification status ────────────────────────────────────────────────
  // Drives which of the three states we render. Defaults to `unverified` while the
  // query is pending so we never flash a blank screen (the form is a safe default).
  const { data: verification, isLoading } = useIdentityVerification();
  const status = verification?.status ?? 'unverified';

  // ── Submit mutation ─────────────────────────────────────────────────────────
  const submit = useSubmitIdentity();

  // ── Form state (only used in the unverified/failed branch) ──────────────────
  const [idType, setIdType] = useState<'nin' | 'bvn'>('nin');
  const [idNumber, setIdNumber] = useState('');
  const [consent, setConsent] = useState(false);
  // Inline error message shown above the CTA when a submission fails.
  const [error, setError] = useState<string | null>(null);

  // Submit gate: consent ticked AND exactly 11 digits entered.
  const ready = consent && idNumber.length === 11;

  // Human-readable label for the selected ID type (used in the input label +
  // helper copy).
  const typeLabel = idType === 'nin' ? 'NIN' : 'BVN';
  const typeHelper =
    idType === 'nin'
      ? 'Your 11-digit National Identity Number'
      : 'Your 11-digit Bank Verification Number';

  // ── Handlers ─────────────────────────────────────────────────────────────────
  // Strip everything but digits so the field only ever holds a numeric ID.
  const onChangeNumber = (t: string) => {
    setIdNumber(t.replace(/\D/g, ''));
    if (error) setError(null); // clear a stale error as the user edits
  };

  // Submit the ID + consent. On success the hook seeds the cache and the screen
  // re-renders into the waiting/verified state automatically. On failure we show
  // the message both inline and as an Alert, and never throw past this handler.
  const onSubmit = async () => {
    if (!ready || submit.isPending) return;
    setError(null);
    try {
      await submit.mutateAsync({ idType, idNumber, consent: true });
      // No navigation needed — the seeded cache flips this screen to the
      // waiting/verified state on the next render.
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : 'Something went wrong. Please try again.';
      setError(message);
      Alert.alert('Verification failed', message);
    }
  };

  // ── Loading — centered spinner over the warm background ─────────────────────
  if (isLoading && !verification) {
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

  // ── VERIFIED — success state, no form ───────────────────────────────────────
  if (status === 'verified') {
    return (
      <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
        <BackHeader
          title="Verify identity"
          insets={insets}
          onBack={() => router.back()}
        />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
            gap: 20,
          }}
        >
          <StatusBadge
            icon={Ic.check2}
            fg={EX.color.tealDeep}
            bg={EX.color.tealTint14}
          />
          <Text style={[displayText(24, 'semibold'), { textAlign: 'center' }]}>
            Your identity is verified
          </Text>
          <Text
            style={{
              fontSize: 14.5,
              lineHeight: 21,
              color: EX.color.inkMuted,
              textAlign: 'center',
              maxWidth: 300,
            }}
          >
            You&apos;re all set. Agents can trust that your identity has been
            confirmed with the relevant Nigerian authority.
          </Text>
        </View>
        <View
          style={{
            paddingHorizontal: EX.space.screenX,
            paddingBottom: Math.max(insets.bottom, 16) + 6,
            paddingTop: 8,
          }}
        >
          <DoneButton onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  // ── PENDING / UNDER_REVIEW — waiting state, no form ─────────────────────────
  if (status === 'pending' || status === 'under_review') {
    return (
      <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
        <BackHeader
          title="Verify identity"
          insets={insets}
          onBack={() => router.back()}
        />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
            gap: 20,
          }}
        >
          <StatusBadge icon={Ic.clock} fg="#2F62A0" bg="#DCEBF7" />
          <Text style={[displayText(24, 'semibold'), { textAlign: 'center' }]}>
            Verification in progress
          </Text>
          <Text
            style={{
              fontSize: 14.5,
              lineHeight: 21,
              color: EX.color.inkMuted,
              textAlign: 'center',
              maxWidth: 300,
            }}
          >
            We&apos;re reviewing your identity — this usually takes a moment.
            We&apos;ll update your status as soon as it&apos;s confirmed.
          </Text>
        </View>
        <View
          style={{
            paddingHorizontal: EX.space.screenX,
            paddingBottom: Math.max(insets.bottom, 16) + 6,
            paddingTop: 8,
          }}
        >
          <DoneButton onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  // ── UNVERIFIED / FAILED — the submission form ───────────────────────────────
  const failed = status === 'failed';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: EX.color.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <BackHeader
        title="Verify identity"
        subtitle="Confirm who you are to unlock the full Seli experience"
        insets={insets}
        onBack={() => router.back()}
      />

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: EX.space.screenX,
          paddingTop: 14,
          paddingBottom: 24,
        }}
      >
        {/* ── Failed banner — shows the backend reason + a nudge to resubmit ──── */}
        {failed ? (
          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              backgroundColor: '#FBE3E1',
              borderWidth: 1,
              borderColor: 'rgba(217,66,91,0.24)',
              borderRadius: 16,
              padding: 14,
              marginBottom: 18,
            }}
          >
            <Ic.x size={18} color={EX.color.danger} strokeWidth={2} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontSize: 13.5,
                  fontWeight: '700',
                  color: '#C0453C',
                }}
              >
                Verification didn&apos;t pass — please check your details.
              </Text>
              {verification?.reason ? (
                <Text
                  style={{
                    fontSize: 12.5,
                    lineHeight: 18,
                    color: '#C0453C',
                    marginTop: 3,
                  }}
                >
                  {verification.reason}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* ── Intro copy ──────────────────────────────────────────────────────── */}
        <Text
          style={{
            fontSize: 14.5,
            lineHeight: 21,
            color: EX.color.inkMuted,
            marginBottom: 22,
            maxWidth: 320,
          }}
        >
          Choose an ID type and enter your number. We&apos;ll confirm your
          identity with the relevant Nigerian authority.
        </Text>

        {/* ── ID-type segmented selector (NIN / BVN) ──────────────────────────── */}
        <Text
          style={{
            fontSize: 12.5,
            fontWeight: '600',
            color: EX.color.muted,
            marginBottom: 8,
          }}
        >
          ID type
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {(['nin', 'bvn'] as const).map((t) => {
            const on = idType === t;
            return (
              <Pressable
                key={t}
                onPress={() => {
                  setIdType(t);
                  if (error) setError(null);
                }}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: on ? EX.color.primary : EX.color.line12,
                  backgroundColor: on ? EX.color.primary : EX.color.cream,
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '700',
                    color: on ? '#fff' : EX.color.ink2,
                  }}
                >
                  {t.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {/* One-line helper reflecting the selected type. */}
        <Text
          style={{
            fontSize: 12.5,
            color: EX.color.muted,
            marginTop: 8,
          }}
        >
          {typeHelper}
        </Text>

        {/* ── ID number input (numeric, 11 digits) ────────────────────────────── */}
        <View
          style={{
            backgroundColor: EX.color.cardWhite,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: EX.color.line10,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 14,
            marginTop: 22,
            shadowColor: '#171326',
            shadowOpacity: 0.04,
            shadowRadius: 2,
            shadowOffset: { width: 0, height: 1 },
            elevation: 1,
          }}
        >
          <Text
            style={{
              fontSize: 12.5,
              fontWeight: '600',
              color: EX.color.muted,
              marginBottom: 4,
            }}
          >
            {typeLabel} number
          </Text>
          <TextInput
            value={idNumber}
            onChangeText={onChangeNumber}
            placeholder="Enter your 11-digit number"
            placeholderTextColor={EX.color.faint}
            keyboardType="number-pad"
            maxLength={11}
            autoCorrect={false}
            style={{
              fontSize: 16.5,
              fontWeight: '600',
              color: EX.color.ink,
              letterSpacing: 1.5,
              paddingVertical: 0,
            }}
          />
        </View>

        {/* ── Consent chip — tappable checkbox + exact consent text ───────────── */}
        <Pressable
          onPress={() => {
            setConsent((v) => !v);
            if (error) setError(null);
          }}
          style={{
            flexDirection: 'row',
            gap: 12,
            backgroundColor: consent ? EX.color.primaryTint07 : EX.color.cream,
            borderWidth: 1,
            borderColor: consent ? EX.color.primary : EX.color.line10,
            borderRadius: 16,
            padding: 14,
            marginTop: 18,
          }}
        >
          {/* Checkbox — coral fill + check when consented, outline otherwise. */}
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 1,
              borderWidth: consent ? 0 : 1.5,
              borderColor: EX.color.line24,
              backgroundColor: consent ? EX.color.primary : 'transparent',
            }}
          >
            {consent ? (
              <Ic.check size={15} color="#fff" strokeWidth={2.6} />
            ) : null}
          </View>
          <Text
            style={{
              flex: 1,
              fontSize: 13,
              lineHeight: 19,
              color: EX.color.ink2,
            }}
          >
            {CONSENT_TEXT}
          </Text>
        </Pressable>

        {/* ── Privacy reassurance line ────────────────────────────────────────── */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            marginTop: 12,
            paddingHorizontal: 2,
          }}
        >
          <Ic.shield size={15} color={EX.color.tealDeep} strokeWidth={1.8} />
          <Text
            style={{
              flex: 1,
              fontSize: 12.5,
              lineHeight: 18,
              color: EX.color.muted,
            }}
          >
            We never store your raw NIN/BVN — only a match result.
          </Text>
        </View>

        {/* ── Inline error (also alerted) ─────────────────────────────────────── */}
        {error ? (
          <Text
            style={{
              fontSize: 13,
              color: EX.color.danger,
              marginTop: 16,
            }}
          >
            {error}
          </Text>
        ) : null}
      </ScrollView>

      {/* ── Sticky glass CTA — Verify identity (rides above the keyboard) ─────── */}
      <BlurView
        intensity={30}
        tint="light"
        style={{
          paddingTop: 15,
          paddingHorizontal: EX.space.screenX,
          paddingBottom: Math.max(insets.bottom, 16) + 6,
          backgroundColor: EX.color.glassWarmSoft,
          borderTopWidth: 1,
          borderTopColor: EX.color.line06,
        }}
      >
        <Pressable
          onPress={onSubmit}
          disabled={!ready || submit.isPending}
          style={{
            height: 54,
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            backgroundColor: ready ? EX.color.primary : 'rgba(244,81,108,0.35)',
            shadowColor: EX.color.primary,
            shadowOpacity: ready ? 0.45 : 0,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 10 },
            elevation: ready ? 6 : 0,
          }}
        >
          {submit.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '700' }}>
              Verify identity
            </Text>
          )}
        </Pressable>
      </BlurView>
    </KeyboardAvoidingView>
  );
}
