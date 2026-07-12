// ─────────────────────────────────────────────────────────────────────────────
// Explorer AUTH — Reset your password (companion to auth.jsx's AuthLogin.onForgot).
//
// AuthShell with two states:
//   1. Form   — "Reset your password" + an Email field + coral "Send reset link".
//   2. Success — "Check your email" with a coral check-circle, the recipient
//                address, a "Back to login" CTA and a "Try a different email" reset.
// AuthShell supplies the KeyboardAvoidingView.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthShell, CoralButton, Field } from '@/components/explorer/AuthShell';
import { EX } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
// Whitelabeled reset — the store posts to the BACKEND (POST /auth/forgot-password),
// which sends the Seli-branded Resend email, NOT Firebase's stock client-side email.
import { useAuthStore } from '@/stores/auth.store';

export default function AuthForgotPassword() {
  const router = useRouter();
  const resetPassword = useAuthStore((s) => s.resetPassword);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  // Submit + inline error state for the real reset request.
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Send the branded (backend) password-reset email ────────────────────────
  const onSend = async () => {
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const ok = await resetPassword(email.trim());
      if (ok) {
        // Backend accepted the request (enumeration-safe) → show success state.
        setSent(true);
      } else {
        // Store surfaced a validation/network error on the store's `error`.
        const msg =
          useAuthStore.getState().error ?? 'Failed to send reset email.';
        setError(msg);
        Alert.alert('Reset failed', msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success state ──────────────────────────────────────────────────────────
  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        sub={`We sent a reset link to ${email || 'your inbox'}.`}
      >
        <View style={{ gap: 20 }}>
          {/* Coral check-circle badge. */}
          <View style={{ alignItems: 'flex-start' }}>
            <View
              style={{
                width: 58,
                height: 58,
                borderRadius: 29,
                backgroundColor: EX.color.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ic.check2 size={30} color="#fff" strokeWidth={2} />
            </View>
          </View>

          {/* Back to login. */}
          <CoralButton
            label="Back to login"
            withArrow={false}
            onPress={() => router.replace('/(explorer)/(auth)/login')}
          />

          {/* Reset to the form to try another address. */}
          <Pressable
            onPress={() => setSent(false)}
            hitSlop={8}
            style={{ alignSelf: 'center' }}
          >
            <Text
              style={{
                fontSize: 14,
                color: 'rgba(255,255,255,0.72)',
                fontWeight: '600',
              }}
            >
              Try a different email
            </Text>
          </Pressable>
        </View>
      </AuthShell>
    );
  }

  // ── Form state ─────────────────────────────────────────────────────────────
  return (
    <AuthShell title="Reset your password" sub="We'll email you a secure link.">
      <View style={{ gap: 15 }}>
        <Field
          icon={Ic.msg}
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@email.com"
          keyboardType="email-address"
          autoComplete="email"
        />
        {/* Inline error (small danger text) shown above the CTA. */}
        {error ? (
          <Text
            style={{
              color: EX.color.danger,
              fontSize: 13,
              fontWeight: '600',
              marginTop: -4,
            }}
          >
            {error}
          </Text>
        ) : null}

        {/* Primary CTA → sends a real reset email. Disabled + spinner overlay
            while the request is in flight. */}
        <View>
          <CoralButton
            label={submitting ? '' : 'Send reset link'}
            disabled={submitting}
            withArrow={!submitting}
            onPress={onSend}
          />
          {submitting ? (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              pointerEvents="none"
            >
              <ActivityIndicator color="#fff" />
            </View>
          ) : null}
        </View>
      </View>
    </AuthShell>
  );
}
