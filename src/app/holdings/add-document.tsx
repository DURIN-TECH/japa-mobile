// ─────────────────────────────────────────────────────────────────────────────
// Add a visa or permit (japa#234) — a sheet that slides up from the holdings
// screen. One document per submit:
//
//   1. What is it?   three radio cards (visa / residence permit / travel auth.)
//   2. Issued by     a country, chosen on the country picker pushed over this
//                    sheet (the picker hands it back through holdings-pick.store).
//                    Country only in this change; groups of countries come later.
//   3. Valid until   platform date picker, 1 Jan 1990 – 31 Dec 2100. A past date
//                    is fine: the server marks it expired.
//   4. Note          optional, up to 200 characters, with a counter.
//
// The coral CTA is disabled until kind, issuer and date are set. On press:
// POST /users/me/holdings/documents; all inputs lock and the CTA spins. Success
// closes the sheet (the list updates from the returned view). Failure keeps the
// sheet open with every value kept and a plain-words error above the CTA.
// Offline: the same line shows above the CTA and the CTA is disabled.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import {
  CoralSubmit,
  InlineError,
  LabeledInput,
} from '@/components/explorer/AccountForm';
import { Flag } from '@/components/explorer/primitives';
import {
  Caption,
  SheetFrame,
  useCountryNames,
} from '@/components/explorer/HoldingsParts';
import {
  HOLDINGS_COPY as C,
  KIND_COPY,
  KIND_ORDER,
  MAX_NOTE_CHARS,
  MAX_VALID_UNTIL,
  MIN_VALID_UNTIL,
  buildNewDocument,
  canSubmitDocument,
  clampDate,
  formatDay,
  saveErrorMessage,
  type DocumentDraft,
} from '@/components/explorer/holdingsLogic';
import { useAddHeldDocument } from '@/hooks/useHoldings';
import { useHoldingsPick } from '@/stores/holdings-pick.store';
import { useIsOffline } from '@/utils/networkStatus';
import { analyticsService } from '@/services/analytics.service';

// A tappable field styled like LabeledInput: label, value or placeholder, chevron.
function PickField({
  label,
  value,
  placeholder,
  leading,
  disabled,
  onPress,
}: {
  label: string;
  value?: string;
  placeholder: string;
  leading?: React.ReactNode;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value ?? placeholder}`}
      style={{
        backgroundColor: EX.color.cardWhite,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: EX.color.line10,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 14,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Text
        style={{
          fontSize: 12.5,
          fontWeight: '600',
          color: EX.color.inkMuted,
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {value ? leading : null}
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: 16.5,
            fontWeight: '600',
            // `muted` is allowed for placeholders only.
            color: value ? EX.color.ink : EX.color.muted,
          }}
        >
          {value ?? placeholder}
        </Text>
        <Ic.chevR size={18} color={EX.color.muted} strokeWidth={1.8} />
      </View>
    </Pressable>
  );
}

export default function AddDocumentSheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const offline = useIsOffline();
  const add = useAddHeldDocument();
  const { nameOf } = useCountryNames();

  const [draft, setDraft] = useState<DocumentDraft>({
    kind: null,
    issuerCountryCode: null,
    validUntil: null,
    note: '',
  });
  const [dateOpen, setDateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = add.isPending;

  // Pick up the issuer chosen on the picker; start clean so a country picked
  // for an earlier document is never carried over.
  const pickedIssuer = useHoldingsPick((s) => s.issuer);
  const setPickedIssuer = useHoldingsPick((s) => s.setIssuer);
  useEffect(() => {
    setPickedIssuer(null);
    return () => setPickedIssuer(null);
  }, [setPickedIssuer]);
  useEffect(() => {
    if (pickedIssuer)
      setDraft((d) => ({ ...d, issuerCountryCode: pickedIssuer }));
  }, [pickedIssuer]);

  const body = buildNewDocument(draft);
  const ready = canSubmitDocument(draft) && !!body;
  const issuerName = nameOf(draft.issuerCountryCode);

  const submit = async () => {
    if (!body || busy || offline) return;
    setError(null);
    try {
      await add.mutateAsync(body);
      analyticsService.trackHoldingsEvent('holdings_document_added');
      router.back();
    } catch (e) {
      // Stay open, keep every value.
      setError(saveErrorMessage(e, 'document'));
    }
  };

  return (
    <SheetFrame title={C.addTitle} onClose={() => router.back()}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            // Clear the sticky CTA bar.
            paddingBottom: EX.space.ctaClear,
            gap: 14,
          }}
        >
          {/* 1. What is it? */}
          <View style={{ gap: 10 }}>
            <Text
              style={{
                fontSize: 12.5,
                fontWeight: '600',
                color: EX.color.inkMuted,
              }}
            >
              {C.addKindLabel}
            </Text>
            {KIND_ORDER.map((k) => {
              const on = draft.kind === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => setDraft((d) => ({ ...d, kind: k }))}
                  disabled={busy}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on, disabled: busy }}
                  accessibilityLabel={`${KIND_COPY[k].label}. ${KIND_COPY[k].sub}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 14,
                    borderRadius: 16,
                    borderWidth: on ? 1.5 : 1,
                    borderColor: on ? EX.color.primary : EX.color.line08,
                    backgroundColor: on
                      ? EX.color.primaryTint07
                      : EX.color.cardWhite,
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  {/* Radio dot */}
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderWidth: 1.5,
                      borderColor: on ? EX.color.primary : EX.color.line24,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {on ? (
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: EX.color.primary,
                        }}
                      />
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '600',
                        color: EX.color.ink,
                      }}
                    >
                      {KIND_COPY[k].label}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13.5,
                        lineHeight: 19,
                        color: EX.color.inkMuted,
                      }}
                    >
                      {KIND_COPY[k].sub}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* 2. Issued by (country only for now) */}
          <PickField
            label={C.addIssuerLabel}
            value={issuerName}
            placeholder={C.addIssuerPlaceholder}
            disabled={busy}
            leading={
              draft.issuerCountryCode ? (
                <Flag code={draft.issuerCountryCode.toLowerCase()} size={24} />
              ) : null
            }
            onPress={() =>
              router.push({
                pathname: '/holdings/pick-country',
                params: { mode: 'issuer' },
              })
            }
          />

          {/* 3. Valid until */}
          <View style={{ gap: 8 }}>
            <PickField
              label={C.addDateLabel}
              value={draft.validUntil ? formatDay(draft.validUntil) : undefined}
              placeholder={C.addDatePlaceholder}
              disabled={busy}
              onPress={() => setDateOpen((o) => !o)}
            />
            {dateOpen ? (
              <DateTimePicker
                value={draft.validUntil ?? clampDate(new Date())}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                accentColor={EX.color.primary}
                minimumDate={MIN_VALID_UNTIL}
                maximumDate={MAX_VALID_UNTIL}
                onChange={(event, date) => {
                  // Android shows a dialog: close it on any answer.
                  if (Platform.OS !== 'ios') setDateOpen(false);
                  if (event.type === 'set' && date)
                    setDraft((d) => ({ ...d, validUntil: clampDate(date) }));
                }}
              />
            ) : null}
            {dateOpen && Platform.OS === 'ios' ? (
              <Pressable
                onPress={() => {
                  // Commit today when the calendar was never touched.
                  setDraft((d) => ({
                    ...d,
                    validUntil: d.validUntil ?? clampDate(new Date()),
                  }));
                  setDateOpen(false);
                }}
                accessibilityRole="button"
                accessibilityLabel="Valid until, done"
                style={{
                  alignSelf: 'flex-end',
                  minHeight: 44,
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: EX.color.primaryDark,
                  }}
                >
                  Done
                </Text>
              </Pressable>
            ) : null}
            <Caption>{C.addDateHelper}</Caption>
          </View>

          {/* 4. Note (optional) */}
          <View style={{ gap: 6 }}>
            <LabeledInput
              label={C.addNoteLabel}
              value={draft.note}
              onChangeText={(t) => setDraft((d) => ({ ...d, note: t }))}
              placeholder={C.addNotePlaceholder}
              maxLength={MAX_NOTE_CHARS}
              multiline
              editable={!busy}
              focusRing
              style={{ minHeight: 44, textAlignVertical: 'top' }}
            />
            <Text
              style={{
                alignSelf: 'flex-end',
                fontSize: 12.5,
                fontWeight: '600',
                color: EX.color.inkMuted,
              }}
            >
              {draft.note.length}/{MAX_NOTE_CHARS}
            </Text>
          </View>

          <Caption>{C.addCaption}</Caption>
        </ScrollView>

        {/* Sticky CTA bar */}
        <BlurView
          intensity={30}
          tint="light"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingTop: 15,
            paddingHorizontal: 20,
            paddingBottom: Math.max(insets.bottom, 16) + 6,
            backgroundColor: EX.color.glassWarmSoft,
            borderTopWidth: 1,
            borderTopColor: EX.color.line06,
            gap: 10,
          }}
        >
          <InlineError message={offline ? C.offline : error} />
          <CoralSubmit
            label={C.addCta}
            onPress={submit}
            loading={busy}
            disabled={!ready || offline}
          />
        </BlurView>
      </KeyboardAvoidingView>
    </SheetFrame>
  );
}
