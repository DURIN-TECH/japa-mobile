// ─────────────────────────────────────────────────────────────────────────────
// Explorer AUTH — Create account (prototype auth.jsx → AuthRegister).
//
// AuthShell ("Create your account") with Full name + Email + Password glass
// fields, an agree-to-terms row (coral check chip), a coral "Create account" CTA
// that advances to OTP, Google / Apple providers and a "Log in" footer.
// AuthShell supplies the KeyboardAvoidingView.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AuthShell,
  CoralButton,
  Field,
  Provider,
} from '@/components/explorer/AuthShell';
import { EX } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
// Real Firebase Auth — createUserWithEmailAndPassword also signs the user in, so
// the root _layout's onAuthStateChanged listener picks them up automatically.
import { authService } from '@/services/auth.service';

export default function AuthRegister() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  // Terms agreement (source rendered it pre-checked; kept toggleable here).
  const [agree, setAgree] = useState(true);
  // Submit + inline error state for real auth.
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Create the account with Firebase email/password ────────────────────────
  const onRegister = async () => {
    // Required fields + terms agreement must be satisfied first.
    if (!name || !email || !pw) {
      setError('Please fill in your name, email, and password.');
      return;
    }
    if (!agree) {
      setError('Please agree to the Terms & Privacy Policy to continue.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // Registration also signs the user in — no OTP step for email auth, so we
      // go straight to onboarding (passport).
      await authService.registerWithEmail(email.trim(), pw);
      router.replace('/(explorer)/(onboard)/passport');
    } catch (e) {
      const msg = authService.getErrorMessage(e);
      setError(msg);
      Alert.alert('Sign up failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      sub="Start your journey in under a minute."
    >
      <View style={{ gap: 15 }}>
        {/* Full name. */}
        <Field
          icon={Ic.user}
          label="Full name"
          value={name}
          onChangeText={setName}
          placeholder="Alex Kayode"
          autoCapitalize="words"
          autoComplete="name"
        />

        {/* Email. */}
        <Field
          icon={Ic.msg}
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@email.com"
          keyboardType="email-address"
          autoComplete="email"
        />

        {/* Password with Show/Hide. */}
        <Field
          icon={Ic.shield}
          label="Password"
          value={pw}
          onChangeText={setPw}
          placeholder="Create a password"
          secureTextEntry={!show}
          autoComplete="password-new"
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

        {/* Agree-to-terms row: 18px coral check chip + copy. */}
        <Pressable
          onPress={() => setAgree((a) => !a)}
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9 }}
        >
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 6,
              marginTop: 1,
              alignItems: 'center',
              justifyContent: 'center',
              // Coral fill when agreed; a hollow glass chip otherwise.
              backgroundColor: agree
                ? EX.color.primary
                : 'rgba(255,255,255,0.08)',
              borderWidth: agree ? 0 : 1,
              borderColor: 'rgba(255,255,255,0.3)',
            }}
          >
            {agree ? (
              <Ic.check size={11} color="#fff" strokeWidth={3.2} />
            ) : null}
          </View>
          <Text
            style={{
              flex: 1,
              fontSize: 12.5,
              lineHeight: 18.75,
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            I agree to Seli&rsquo;s{' '}
            <Text style={{ color: '#fff', fontWeight: '600' }}>Terms</Text> &{' '}
            <Text style={{ color: '#fff', fontWeight: '600' }}>
              Privacy Policy
            </Text>
            .
          </Text>
        </Pressable>

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

        {/* Primary CTA → real Firebase registration, then onboarding (passport).
            Disabled + spinner overlay while the request is in flight. */}
        <View>
          <CoralButton
            label={submitting ? '' : 'Create account'}
            disabled={submitting}
            withArrow={!submitting}
            onPress={onRegister}
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

        {/* Social providers. */}
        <View style={{ flexDirection: 'row', gap: 11 }}>
          <Provider label="Google" glyph="google" />
          <Provider label="Apple" glyph="apple" />
        </View>

        {/* Footer → login. */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            marginTop: 6,
          }}
        >
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
            Already have an account?{' '}
          </Text>
          <Pressable
            onPress={() => router.push('/(explorer)/(auth)/login')}
            hitSlop={6}
          >
            <Text style={{ fontSize: 14, color: '#fff', fontWeight: '700' }}>
              Log in
            </Text>
          </Pressable>
        </View>
      </View>
    </AuthShell>
  );
}
