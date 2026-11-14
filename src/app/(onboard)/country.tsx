// ─────────────────────────────────────────────────────────────────────────────
// Onboarding — Step 2 of 4 · Country / nationality
//
// A searchable single-select country list, loaded from GET /countries
// (japa#145: replaces the static COUNTRIES list). A pill search input filters
// it by name; each row shows a round Flag (28) + the country name, and a coral check
// when selected (the whole row tints coral). A sticky glass CTA ("Continue")
// stays disabled until a country is chosen, then pushes to the personal-info
// step. Wrapped in KeyboardAvoidingView so the search keyboard never covers the
// CTA (the footer rides above it).
//
// States (japa#145 spec, onboarding row): the header and search stay visible;
// the list area shows the coral spinner while loading and an InlineError with
// an Outline "Try again" when the load fails with nothing cached.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding — Step 2 of 4 · Nationalities (japa#234)
//
// A searchable MULTI-select (max 5) of the countries the person is a citizen
// of, from GET /countries (shared list: CountryPickerList). A tap toggles a row;
// a counter line under the search reads "0 chosen" … "5 of 5 chosen. Remove one
// to pick another." and at 5 the unchosen rows fade and ignore taps.
//
//   • Preselects from GET /users/me/holdings (someone signing back in mid-flow).
//   • Continue (needs at least one) saves `nationalities` with
//     PUT /users/me/holdings, then pushes to personal-info as before.
//   • The FIRST country picked is forwarded as `country`, which complete.tsx
//     submits as residentialCountry (decision 1; correctable later in
//     Settings → What you already hold).
//   • Save fails: InlineError + Continue stays enabled for a retry. Offline: the
//     offline line replaces it. "Skip for now" carries on without blocking
//     onboarding; the picks travel as `pendingNationalities` and complete.tsx
//     retries the save. A 404 (profile not created yet) takes the same path.
//
// Wrapped in KeyboardAvoidingView so the search keyboard never covers the CTA.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { InlineError } from '@/components/explorer/AccountForm';
import {
  CountryPickerList,
  Caption,
} from '@/components/explorer/HoldingsParts';
import {
  HOLDINGS_COPY,
  MAX_NATIONALITIES,
  counterLine,
  isNotFound,
  saveErrorMessage,
  toggleSelection,
} from '@/components/explorer/holdingsLogic';
import { useHoldings, useSaveHoldings } from '@/hooks/useHoldings';
import { useIsOffline } from '@/utils/networkStatus';

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

  // Chosen countries, UPPERCASE ISO2, in the order picked (first = "home").
  const [selected, setSelected] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const offline = useIsOffline();

  // Preselect once from what is already saved. `touched` stops a late reply
  // from overwriting what the person has already tapped.
  const holdingsQ = useHoldings();
  const touched = useRef(false);
  useEffect(() => {
    const saved = holdingsQ.data?.nationalities;
    if (!touched.current && saved && saved.length > 0) setSelected(saved);
  }, [holdingsQ.data]);

  const save = useSaveHoldings();
  const atCap = selected.length >= MAX_NATIONALITIES;

  // Move on to personal-info. `pending` = the save did not happen: hand the
  // picks forward so complete.tsx can retry it. `country` is the first pick.
  const goNext = (pending: boolean) =>
    router.push({
      pathname: '/(onboard)/personal-info',
      params: {
        ...params,
        country: (selected[0] ?? '').toUpperCase(),
        ...(pending ? { pendingNationalities: selected.join(',') } : {}),
      },
    });

  const onContinue = async () => {
    if (selected.length === 0 || save.isPending) return;
    setSaveError(null);
    try {
      await save.mutateAsync({ nationalities: selected });
      goNext(false);
    } catch (e) {
      // No profile yet (404): not an error the person can fix; carry on.
      if (isNotFound(e)) return goNext(true);
      setSaveError(saveErrorMessage(e, 'nationalities'));
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: EX.color.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ── Progress + back ─────────────────────────────────────────────────── */}
      <OnboardTopBar step={2} insets={insets} onBack={() => router.back()} />

      {/* ── Heading ─────────────────────────────────────────────────────────── */}
      <View
        style={{
          paddingHorizontal: EX.space.screenX,
          paddingTop: 18,
          paddingBottom: 12,
        }}
      >
        <Text style={displayText(27)}>{HOLDINGS_COPY.onbTitle}</Text>
        <Text
          style={{
            fontSize: 14.5,
            lineHeight: 21,
            color: EX.color.inkMuted,
            marginTop: 10,
          }}
        >
          {HOLDINGS_COPY.onbSubtitle}
        </Text>
      </View>

      {/* ── Search + counter + scrolling multi-select list ──────────────────── */}
      <CountryPickerList
        selected={selected}
        capped={atCap}
        disabled={save.isPending}
        onPick={(code) => {
          touched.current = true;
          setSelected((cur) => toggleSelection(cur, code));
        }}
        belowSearch={
          <View accessibilityLiveRegion="polite" style={{ marginTop: 10 }}>
            <Caption>{counterLine(selected.length)}</Caption>
          </View>
        }
        footer={
          // Points to the full screen, which is not part of onboarding.
          <View style={{ paddingTop: 10 }}>
            <Caption>{HOLDINGS_COPY.onbHint}</Caption>
          </View>
        }
      />

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
          gap: 10,
        }}
      >
        {/* The offline line replaces the save error. */}
        {offline ? (
          <InlineError message={HOLDINGS_COPY.offline} />
        ) : (
          <InlineError message={saveError} />
        )}
        <Pressable
          onPress={onContinue}
          disabled={selected.length === 0 || save.isPending || offline}
          accessibilityRole="button"
          accessibilityLabel={HOLDINGS_COPY.onbContinue}
          style={{
            height: 54,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor:
              selected.length > 0 && !offline
                ? EX.color.primary
                : 'rgba(244,81,108,0.35)',
            shadowColor: EX.color.primary,
            shadowOpacity: selected.length > 0 && !offline ? 0.45 : 0,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 10 },
            elevation: selected.length > 0 ? 6 : 0,
          }}
        >
          {save.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '700' }}>
              {HOLDINGS_COPY.onbContinue}
            </Text>
          )}
        </Pressable>
        {/* Never block onboarding on a network drop (needs a pick to carry). */}
        {selected.length > 0 ? (
          <Pressable
            onPress={() => goNext(true)}
            disabled={save.isPending}
            accessibilityRole="button"
            accessibilityLabel={HOLDINGS_COPY.onbSkip}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 44,
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: EX.color.inkMuted,
              }}
            >
              {HOLDINGS_COPY.onbSkip}
            </Text>
          </Pressable>
        ) : null}
      </BlurView>
    </KeyboardAvoidingView>
  );
}
