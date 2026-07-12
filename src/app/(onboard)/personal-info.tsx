// ─────────────────────────────────────────────────────────────────────────────
// Onboarding — Step 3 of 4 · Personal info
//
// Collects the user's first + last name in two white input cards (small muted
// labels above each field). A sticky glass CTA ("Complete setup") stays disabled
// until both names have at least 2 characters, then pushes to the completion
// step. Wrapped in KeyboardAvoidingView so the CTA rides above the keyboard.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';

// ── OnboardTopBar — 4-segment progress bar + back button (see passport step) ──
function OnboardTopBar({
  step,
  insets,
  onBack,
}: {
  step: number;
  insets: { top: number };
  onBack: () => void;
}) {
  return (
    <View
      style={{
        paddingTop: insets.top + 10,
        paddingHorizontal: EX.space.screenX,
        paddingBottom: 4,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
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
        <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 5,
                borderRadius: 999,
                backgroundColor: i < step ? EX.color.primary : EX.color.line12,
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ── NameField — labelled white input card ─────────────────────────────────────
function NameField({
  label,
  value,
  placeholder,
  autoFocus,
  onChangeText,
}: {
  label: string;
  value: string;
  placeholder: string;
  autoFocus?: boolean;
  onChangeText: (t: string) => void;
}) {
  return (
    <View
      style={{
        backgroundColor: EX.color.cardWhite,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: EX.color.line10,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 14,
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
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={EX.color.faint}
        autoCapitalize="words"
        autoCorrect={false}
        autoFocus={autoFocus}
        style={{
          fontSize: 16.5,
          fontWeight: '600',
          color: EX.color.ink,
          paddingVertical: 0,
        }}
      />
    </View>
  );
}

export default function PersonalInfoStep() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Onboarding values collected so far (hasPassport + country). Forwarded
  // unchanged to the final step, which performs the backend submit.
  const params = useLocalSearchParams<{
    hasPassport?: string;
    country?: string;
  }>();

  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');

  // CTA gate: both names need at least 2 non-space characters.
  const ready = first.trim().length >= 2 && last.trim().length >= 2;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: EX.color.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ── Progress + back ─────────────────────────────────────────────────── */}
      <OnboardTopBar step={3} insets={insets} onBack={() => router.back()} />

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: EX.space.screenX,
          paddingTop: 18,
          paddingBottom: 24,
        }}
      >
        {/* ── Heading + subtitle ─────────────────────────────────────────────── */}
        <Text style={displayText(27)}>Tell us your name</Text>
        <Text
          style={{
            fontSize: 14.5,
            lineHeight: 21,
            color: EX.color.inkMuted,
            marginTop: 10,
            maxWidth: 300,
          }}
        >
          This is how agents and your documents will address you.
        </Text>

        {/* ── Name fields ────────────────────────────────────────────────────── */}
        <View style={{ gap: 12, marginTop: 26 }}>
          <NameField
            label="First name"
            value={first}
            placeholder="e.g. Alex"
            autoFocus
            onChangeText={setFirst}
          />
          <NameField
            label="Last name"
            value={last}
            placeholder="e.g. Kayode"
            onChangeText={setLast}
          />
        </View>
      </ScrollView>

      {/* ── Sticky glass CTA — Complete setup (rides above the keyboard) ────── */}
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
          // Add the entered names and carry all onboarding params to the final
          // step, which submits them to POST /users/onboarding.
          onPress={() =>
            router.push({
              pathname: '/(onboard)/complete',
              params: {
                ...params,
                firstName: first.trim(),
                lastName: last.trim(),
              },
            })
          }
          disabled={!ready}
          style={{
            height: 54,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: ready ? EX.color.primary : 'rgba(244,81,108,0.35)',
            shadowColor: EX.color.primary,
            shadowOpacity: ready ? 0.45 : 0,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 10 },
            elevation: ready ? 6 : 0,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '700' }}>
            Complete setup
          </Text>
        </Pressable>
      </BlurView>
    </KeyboardAvoidingView>
  );
}
