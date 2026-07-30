// ─────────────────────────────────────────────────────────────────────────────
// Onboarding — Step 2 of 4 · Country / nationality
//
// A searchable single-select country list. A pill search input filters COUNTRIES
// by name; each row shows a round Flag (28) + the country name, and a coral check
// when selected (the whole row tints coral). A sticky glass CTA ("Continue")
// stays disabled until a country is chosen, then pushes to the personal-info
// step. Wrapped in KeyboardAvoidingView so the search keyboard never covers the
// CTA (the footer rides above it).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
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
import { COUNTRIES } from '@/components/explorer/data';
import { Ic } from '@/components/explorer/icons';
import { Flag } from '@/components/explorer/primitives';

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

export default function CountryStep() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Onboarding values collected so far (passed from the passport step). We
  // forward them unchanged so the final step can submit the full body.
  const params = useLocalSearchParams<{ hasPassport?: string }>();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null); // ISO2 code

  // Case-insensitive name filter over the onboarding country list.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q));
  }, [query]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: EX.color.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ── Progress + back ─────────────────────────────────────────────────── */}
      <OnboardTopBar step={2} insets={insets} onBack={() => router.back()} />

      {/* ── Heading + search (fixed above the scrolling list) ───────────────── */}
      <View
        style={{
          paddingHorizontal: EX.space.screenX,
          paddingTop: 18,
          paddingBottom: 12,
        }}
      >
        <Text style={displayText(27)}>Where are you from?</Text>
        <Text
          style={{
            fontSize: 14.5,
            lineHeight: 21,
            color: EX.color.inkMuted,
            marginTop: 10,
            maxWidth: 300,
          }}
        >
          We&apos;ll tailor visa routes and eligibility to your nationality.
        </Text>

        {/* Pill search input — white, with a leading search icon. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginTop: 18,
            height: 48,
            borderRadius: 999,
            paddingHorizontal: 16,
            backgroundColor: EX.color.cardWhite,
            borderWidth: 1,
            borderColor: EX.color.line10,
          }}
        >
          <Ic.search size={18} color={EX.color.muted} strokeWidth={1.8} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search countries"
            placeholderTextColor={EX.color.muted}
            autoCorrect={false}
            style={{
              flex: 1,
              fontSize: 15,
              color: EX.color.ink,
              paddingVertical: 0,
            }}
          />
        </View>
      </View>

      {/* ── Scrollable single-select list ───────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: EX.space.screenX,
          paddingTop: 4,
          paddingBottom: 20,
          gap: 8,
        }}
      >
        {results.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 40, gap: 10 }}>
            <Ic.globe
              size={34}
              color={EX.color.muted}
              strokeWidth={1.8}
              style={{ opacity: 0.5 }}
            />
            <Text style={{ fontSize: 14, color: EX.color.muted }}>
              No countries match “{query.trim()}”
            </Text>
          </View>
        ) : (
          results.map((c) => {
            const on = selected === c.code;
            return (
              <Pressable
                key={c.code}
                onPress={() => setSelected(c.code)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 13,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 16,
                  borderWidth: on ? 1.5 : 1,
                  borderColor: on ? EX.color.primary : EX.color.line08,
                  backgroundColor: on
                    ? EX.color.primaryTint07
                    : EX.color.cardWhite,
                }}
              >
                <Flag code={c.code} size={28} />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 15,
                    fontWeight: '600',
                    color: EX.color.ink,
                  }}
                  numberOfLines={1}
                >
                  {c.name}
                </Text>
                {/* Coral check appears only for the selected row. */}
                {on ? (
                  <Ic.check
                    size={20}
                    color={EX.color.primary}
                    strokeWidth={2.6}
                  />
                ) : null}
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* ── Sticky glass CTA — Continue (rides above the keyboard) ──────────── */}
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
          // Forward prior params + the selected country. The backend stores
          // residentialCountry as an UPPERCASE ISO2 code (e.g. "NG"), while the
          // COUNTRIES data uses lowercase codes — so uppercase here.
          onPress={() =>
            router.push({
              pathname: '/(onboard)/personal-info',
              params: {
                ...params,
                country: (selected ?? '').toUpperCase(),
              },
            })
          }
          disabled={!selected}
          style={{
            height: 54,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: selected
              ? EX.color.primary
              : 'rgba(244,81,108,0.35)',
            shadowColor: EX.color.primary,
            shadowOpacity: selected ? 0.45 : 0,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 10 },
            elevation: selected ? 6 : 0,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '700' }}>
            Continue
          </Text>
        </Pressable>
      </BlurView>
    </KeyboardAvoidingView>
  );
}
