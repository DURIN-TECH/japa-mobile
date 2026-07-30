// ─────────────────────────────────────────────────────────────────────────────
// Explorer AUTH — Log in (prototype auth.jsx → AuthLogin).
//
// AuthShell ("Welcome back") with Email + Password glass fields, a "Forgot
// password?" link, coral "Log in" CTA, an "or continue with" divider, Google /
// Apple providers and a "New to Seli? Create account" footer.
//
// AuthShell already wraps its body in a KeyboardAvoidingView, so the inputs here
// stay clear of the keyboard.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AuthShell,
  CoralButton,
  Field,
  PINK,
  Provider,
} from '@/components/explorer/AuthShell';
import { EX } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
// Real Firebase Auth — the root _layout listens to onAuthStateChanged and syncs
// the auth store/profile, so this screen just calls the service and navigates.
import { authService } from '@/services/auth.service';

export default function AuthLogin() {
  const router = useRouter();
  // Credentials start EMPTY (no demo prefill) so the user types real values.
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  // Submit + inline error state for real auth.
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Log in with Firebase email/password ────────────────────────────────────
  const onLogin = async () => {
    // Client-side required-field validation before hitting Firebase.
    if (!email || !pw) {
      setError('Please enter your email and password.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await authService.loginWithEmail(email.trim(), pw);
      // Success → straight into the authenticated Explorer home.
      router.replace('/(tabs)/home');
    } catch (e) {
      // Friendly, mapped message shown inline + as an alert.
      const msg = authService.getErrorMessage(e);
      setError(msg);
      Alert.alert('Login failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      sub="Log in to pick up right where you left off."
    >
      <View style={{ gap: 15 }}>
        {/* Email. */}
        <Field
          icon={Ic.user}
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@email.com"
          keyboardType="email-address"
          autoComplete="email"
        />

        {/* Password with Show/Hide toggle in the right slot. */}
        <Field
          icon={Ic.shield}
          label="Password"
          value={pw}
          onChangeText={setPw}
          placeholder="Your password"
          secureTextEntry={!show}
          autoComplete="password"
          right={
            <Pressable onPress={() => setShow((s) => !s)} hitSlop={8}>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: 12.5,
                  fontWeight: '700',
                }}
              >
                {show ? 'Hide' : 'Show'}
              </Text>
            </Pressable>
          }
        />

        {/* Forgot password? (pink link, right-aligned). */}
        <Pressable
          onPress={() => router.push('/(auth)/forgot-password')}
          hitSlop={8}
          style={{ alignSelf: 'flex-end', marginTop: -4 }}
        >
          <Text style={{ color: PINK, fontSize: 13, fontWeight: '600' }}>
            Forgot password?
          </Text>
        </Pressable>

        {/* Inline error (small pink/danger text) shown above the CTA. */}
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

        {/* Primary CTA → real Firebase login, then Explorer home.
            Disabled + spinner overlay while the request is in flight. The CTA
            keeps its coral styling; the ActivityIndicator sits centered on top. */}
        <View>
          <CoralButton
            label={submitting ? '' : 'Log in'}
            disabled={submitting}
            withArrow={!submitting}
            onPress={onLogin}
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

        {/* "or continue with" divider. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginVertical: 4,
          }}
        >
          <View
            style={{
              flex: 1,
              height: 1,
              backgroundColor: 'rgba(255,255,255,0.16)',
            }}
          />
          <Text
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.5)',
              fontWeight: '600',
            }}
          >
            or continue with
          </Text>
          <View
            style={{
              flex: 1,
              height: 1,
              backgroundColor: 'rgba(255,255,255,0.16)',
            }}
          />
        </View>

        {/* Social providers. */}
        <View style={{ flexDirection: 'row', gap: 11 }}>
          <Provider label="Google" glyph="google" />
          <Provider label="Apple" glyph="apple" />
        </View>

        {/* Footer → register. */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            marginTop: 6,
          }}
        >
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
            New to Seli?{' '}
          </Text>
          <Pressable
            onPress={() => router.push('/(auth)/register')}
            hitSlop={6}
          >
            <Text style={{ fontSize: 14, color: '#fff', fontWeight: '700' }}>
              Create account
            </Text>
          </Pressable>
        </View>
      </View>
    </AuthShell>
  );
}
