// ─────────────────────────────────────────────────────────────────────────────
// Explorer AUTH — Verify OTP (prototype auth.jsx → AuthOtp).
//
// AuthShell ("Verify it's you") with four single-digit glass boxes that
// auto-advance as you type (and step back on Backspace), a "Resend code" link and
// a coral "Verify & continue" CTA that stays disabled until all 4 digits are in.
// On success it replaces into the Explorer onboarding (passport) flow.
// AuthShell supplies the KeyboardAvoidingView.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useState } from 'react';
import {
  NativeSyntheticEvent,
  Pressable,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { AuthShell, CoralButton, PINK } from '@/components/explorer/AuthShell';
import { EX } from '@/components/explorer/theme';

export default function AuthOtp() {
  const router = useRouter();
  const [code, setCode] = useState(['', '', '', '']);
  // Refs to each box so a filled digit can auto-focus the next one.
  const refs = useRef<Array<TextInput | null>>([null, null, null, null]);

  const full = code.every(Boolean);

  // Set a digit, then advance focus forward (source behaviour).
  const setDigit = (i: number, v: string) => {
    const digit = v.slice(-1); // keep only the last typed character
    if (!/^\d?$/.test(digit)) return; // digits only
    setCode((c) => {
      const n = [...c];
      n[i] = digit;
      return n;
    });
    if (digit && i < 3) refs.current[i + 1]?.focus();
  };

  // Backspace on an empty box steps focus back (UX nicety beyond the source).
  const onKeyPress = (
    i: number,
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) => {
    if (e.nativeEvent.key === 'Backspace' && !code[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  };

  return (
    <AuthShell
      title="Verify it's you"
      sub="We sent a 4-digit code to your email."
    >
      <View style={{ gap: 20 }}>
        {/* Four digit boxes. */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {code.map((d, i) => (
            <BlurView
              key={i}
              intensity={20}
              tint="dark"
              style={{
                flex: 1,
                height: 66,
                borderRadius: 16,
                overflow: 'hidden',
                borderWidth: 1,
                // Filled boxes brighten their fill + border (source d ? .55/.16 : .16/.08).
                borderColor: d
                  ? 'rgba(255,255,255,0.55)'
                  : 'rgba(255,255,255,0.16)',
                backgroundColor: d
                  ? 'rgba(255,255,255,0.16)'
                  : 'rgba(255,255,255,0.08)',
              }}
            >
              <TextInput
                ref={(el) => {
                  refs.current[i] = el;
                }}
                value={d}
                onChangeText={(v) => setDigit(i, v)}
                onKeyPress={(e) => onKeyPress(i, e)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                style={{
                  flex: 1,
                  textAlign: 'center',
                  textAlignVertical: 'center',
                  color: '#fff',
                  fontSize: 26,
                  fontFamily: EX.font.display.bold,
                }}
              />
            </BlurView>
          ))}
        </View>

        {/* Resend code (centered, pink link). */}
        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
          <Text style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.65)' }}>
            Didn&rsquo;t get it?{' '}
          </Text>
          <Pressable hitSlop={8}>
            <Text style={{ fontSize: 13.5, color: PINK, fontWeight: '700' }}>
              Resend code
            </Text>
          </Pressable>
        </View>

        {/* Primary CTA — disabled until all 4 digits are entered.
            COSMETIC ONLY: email registration has no real OTP, so this does NOT
            verify anything — the register flow now goes straight to onboarding,
            and this screen simply advances to passport if reached. */}
        <CoralButton
          label="Verify & continue"
          disabled={!full}
          onPress={() => router.replace('/(onboard)/passport')}
        />
      </View>
    </AuthShell>
  );
}
