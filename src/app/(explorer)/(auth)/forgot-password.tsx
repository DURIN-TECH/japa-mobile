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
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthShell, CoralButton, Field } from '@/components/explorer/AuthShell';
import { EX } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';

export default function AuthForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

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
        <CoralButton label="Send reset link" onPress={() => setSent(true)} />
      </View>
    </AuthShell>
  );
}
