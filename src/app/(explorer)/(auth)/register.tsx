// ─────────────────────────────────────────────────────────────────────────────
// Explorer AUTH — Create account (prototype auth.jsx → AuthRegister).
//
// AuthShell ("Create your account") with Full name + Email + Password glass
// fields, an agree-to-terms row (coral check chip), a coral "Create account" CTA
// that advances to OTP, Google / Apple providers and a "Log in" footer.
// AuthShell supplies the KeyboardAvoidingView.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AuthShell,
  CoralButton,
  Field,
  Provider,
} from '@/components/explorer/AuthShell';
import { EX } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';

export default function AuthRegister() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  // Terms agreement (source rendered it pre-checked; kept toggleable here).
  const [agree, setAgree] = useState(true);

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
            I agree to Japa&rsquo;s{' '}
            <Text style={{ color: '#fff', fontWeight: '600' }}>Terms</Text> &{' '}
            <Text style={{ color: '#fff', fontWeight: '600' }}>
              Privacy Policy
            </Text>
            .
          </Text>
        </Pressable>

        {/* Primary CTA → OTP verification. */}
        <CoralButton
          label="Create account"
          onPress={() => router.push('/(explorer)/(auth)/otp')}
        />

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
