// ─────────────────────────────────────────────────────────────────────────────
// Explorer AUTH — Log in (prototype auth.jsx → AuthLogin).
//
// AuthShell ("Welcome back") with Email + Password glass fields, a "Forgot
// password?" link, coral "Log in" CTA, an "or continue with" divider, Google /
// Apple providers and a "New to Japa? Create account" footer.
//
// AuthShell already wraps its body in a KeyboardAvoidingView, so the inputs here
// stay clear of the keyboard.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AuthShell,
  CoralButton,
  Field,
  PINK,
  Provider,
} from '@/components/explorer/AuthShell';
import { Ic } from '@/components/explorer/icons';

export default function AuthLogin() {
  const router = useRouter();
  // Prefilled to mirror the prototype's demo state.
  const [email, setEmail] = useState('alex@example.com');
  const [pw, setPw] = useState('••••••••');
  const [show, setShow] = useState(false);

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
          onPress={() => router.push('/(explorer)/(auth)/forgot-password')}
          hitSlop={8}
          style={{ alignSelf: 'flex-end', marginTop: -4 }}
        >
          <Text style={{ color: PINK, fontSize: 13, fontWeight: '600' }}>
            Forgot password?
          </Text>
        </Pressable>

        {/* Primary CTA → straight into the authenticated Explorer home. */}
        <CoralButton
          label="Log in"
          onPress={() => router.replace('/(explorer)/(tabs)/home')}
        />

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
            New to Japa?{' '}
          </Text>
          <Pressable
            onPress={() => router.push('/(explorer)/(auth)/register')}
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
