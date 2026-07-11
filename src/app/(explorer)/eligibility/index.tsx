// ─────────────────────────────────────────────────────────────────────────────
// Eligibility wizard (prototype eligibility.jsx → EligibilityView).
//
// A short 5-question quiz (ELIG_Q) that steps the user through boolean / single /
// multiple / number inputs, tracks answers locally, and pushes to the result
// screen when finished. Coral/cream Explorer design language.
//
// Layout (matches the prototype 1:1):
//   • Fixed header block = back circle (40px) + "Eligibility check" + destination
//     caption, then the progress row ("Question i of N" + pct + 6px bar), closed
//     off by a hairline bottom border.
//   • Scrolling body = question title (+ help toggle), optional help panel, and
//     the current question's inputs.
//   • Fixed white footer with the Continue / See-my-result CTA.
// The whole screen sits in a KeyboardAvoidingView so the numeric input isn't
// hidden by the keyboard.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import { ELIG_Q, EligQ, destById } from '@/components/explorer/data';
import { Ic } from '@/components/explorer/icons';
import { Progress } from '@/components/explorer/primitives';

// Answers keyed by question id; value type varies per question type.
type Answer = string | number | string[] | boolean | undefined;
type Answers = Record<string, Answer>;

// Unselected indicator ring colour — prototype uses rgba(23,19,38,0.2), which is
// between the line16/line24 tokens, so it's inlined here to match exactly.
const IND_RING = 'rgba(23,19,38,0.2)';

// ── Has the current question been answered? (gates the footer CTA) ────────────
function isAnswered(q: EligQ, answers: Answers): boolean {
  const v = answers[q.id];
  if (q.type === 'multiple') return Array.isArray(v) && v.length > 0;
  if (q.type === 'number') return typeof v === 'number' && !Number.isNaN(v);
  if (q.type === 'boolean') return typeof v === 'boolean';
  return typeof v === 'string' && v.length > 0; // single
}

// ── OptRow — a selectable option (radio for single, checkbox for multiple) ────
// Source geometry: gap 13, padding 15×16, radius 16, 1.5px border (coral when
// selected / rgba(23,19,38,0.12) otherwise), bg rgba(244,81,108,0.07) selected.
// Indicator is 24px for BOTH types (radius 7 checkbox / full circle radio) and
// shows a 13px white check on a coral fill when selected. Label is always ink.
function OptRow({
  label,
  selected,
  multiple,
  onPress,
}: {
  label: string;
  selected: boolean;
  multiple?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
        paddingVertical: 15,
        paddingHorizontal: 16,
        borderRadius: EX.radius.button, // 16
        borderWidth: 1.5,
        borderColor: selected ? EX.color.primary : EX.color.line12,
        backgroundColor: selected ? EX.color.primaryTint07 : EX.color.cardWhite,
      }}
    >
      {/* 24px indicator — square (r7) for multi-select, circle for single. */}
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: multiple ? 7 : 12,
          borderWidth: 2,
          alignItems: 'center',
          justifyContent: 'center',
          borderColor: selected ? EX.color.primary : IND_RING,
          backgroundColor: selected ? EX.color.primary : 'transparent',
        }}
      >
        {selected ? (
          <Ic.check size={13} color="#fff" strokeWidth={3.2} />
        ) : null}
      </View>
      <Text
        style={{
          flex: 1,
          fontSize: 15,
          fontWeight: '600',
          color: EX.color.ink,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ── BoolButton — one of the two big Yes/No tiles (text only, no icon) ─────────
// Source: flex 1, padding 18px vertical, radius 16, 1.5px border, text 16/700
// (coral when selected / #5B5468 otherwise).
function BoolButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 18,
        borderRadius: EX.radius.button, // 16
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        borderColor: selected ? EX.color.primary : EX.color.line12,
        backgroundColor: selected ? EX.color.primaryTint07 : EX.color.cardWhite,
      }}
    >
      <Text
        style={{
          fontSize: 16,
          fontWeight: '700',
          color: selected ? EX.color.primary : EX.color.inkMuted,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function EligibilityView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { dest } = useLocalSearchParams<{ dest: string }>();
  const d = destById(dest);

  const N = ELIG_Q.length;
  const [i, setI] = useState(0); // current question index
  const [answers, setAnswers] = useState<Answers>({});
  const [showHelp, setShowHelp] = useState(false);

  const q = ELIG_Q[i];
  const pct = Math.round(((i + 1) / N) * 100);
  const answered = isAnswered(q, answers);
  const last = i === N - 1;

  // Collapse the help panel whenever we move to a new question.
  useEffect(() => {
    setShowHelp(false);
  }, [i]);

  // ── Answer setters ──────────────────────────────────────────────────────────
  const setSingle = (opt: string) => setAnswers((a) => ({ ...a, [q.id]: opt }));
  const setBool = (val: boolean) => setAnswers((a) => ({ ...a, [q.id]: val }));
  const toggleMulti = (opt: string) =>
    setAnswers((a) => {
      const cur = Array.isArray(a[q.id]) ? (a[q.id] as string[]) : [];
      const next = cur.includes(opt)
        ? cur.filter((o) => o !== opt)
        : [...cur, opt];
      return { ...a, [q.id]: next };
    });
  const setNumber = (text: string) => {
    if (text.trim() === '') {
      setAnswers((a) => ({ ...a, [q.id]: undefined }));
      return;
    }
    const n = parseInt(text.replace(/[^0-9]/g, ''), 10);
    if (Number.isNaN(n)) return;
    // Clamp into the question's min..max range.
    const clamped = Math.max(q.min ?? 0, Math.min(q.max ?? n, n));
    setAnswers((a) => ({ ...a, [q.id]: clamped }));
  };

  // ── Advance / finish ────────────────────────────────────────────────────────
  const next = () => {
    if (!answered) return;
    if (last) {
      router.push({
        pathname: '/(explorer)/eligibility/result',
        params: { dest: dest ?? '' },
      });
    } else {
      setI((n) => n + 1);
    }
  };
  // Back circle steps through the wizard, then leaves the screen.
  const back = () => {
    if (i > 0) setI((n) => n - 1);
    else router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* ── Fixed header block (title row + progress row + hairline) ──────── */}
        <View
          style={{
            paddingTop: insets.top + 6,
            backgroundColor: EX.color.bg,
            borderBottomWidth: 1,
            borderBottomColor: EX.color.line06,
          }}
        >
          {/* Title row — back circle + heading + destination caption.
              Source padding: 4px 18px 12px. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingTop: 4,
              paddingHorizontal: 18,
              paddingBottom: 12,
            }}
          >
            <Pressable
              onPress={back}
              hitSlop={8}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: EX.color.cardWhite,
                borderWidth: 1,
                borderColor: EX.color.line10,
              }}
            >
              <Ic.chevL size={21} color={EX.color.ink} strokeWidth={1.8} />
            </Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{ fontSize: 15, fontWeight: '700', color: EX.color.ink }}
              >
                Eligibility check
              </Text>
              {d ? (
                <Text
                  style={{ fontSize: 12, color: EX.color.muted }}
                  numberOfLines={1}
                >
                  {d.country} · {d.visa}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Progress row — label + pct, then the 6px animated bar.
              Source padding: 0 22px 16px, label marginBottom 7. */}
          <View style={{ paddingHorizontal: 22, paddingBottom: 16 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: 7,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: EX.color.muted,
                }}
              >
                Question {i + 1} of {N}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: EX.color.primary,
                }}
              >
                {pct}%
              </Text>
            </View>
            <Progress value={(i + 1) / N} height={6} />
          </View>
        </View>

        {/* ── Scrolling question body — source padding 26px 22px 20px ───────── */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: 26,
            paddingHorizontal: 22,
            paddingBottom: 20,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Question title (24 Space Grotesk 700) + optional coral help toggle */}
          <View
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}
          >
            <Text
              style={[
                displayText(24, 'bold'),
                { flex: 1, lineHeight: 28.8, letterSpacing: -0.24 },
              ]}
            >
              {q.q}
            </Text>
            {q.help ? (
              <Pressable
                onPress={() => setShowHelp((s) => !s)}
                hitSlop={8}
                style={{ marginTop: 2 }}
              >
                <Ic.help size={24} color={EX.color.primary} strokeWidth={1.8} />
              </Pressable>
            ) : null}
          </View>

          {/* Help panel — tinted coral, text only (no icon/border).
              Source: marginTop 14, padding 14, radius 14, bg rgba(244,81,108,0.07),
              fontSize 13.5, lineHeight 1.5, color #5B5468. */}
          {q.help && showHelp ? (
            <View
              style={{
                marginTop: 14,
                padding: 14,
                borderRadius: EX.radius.chip, // 14
                backgroundColor: EX.color.primaryTint07,
              }}
            >
              <Text
                style={{
                  fontSize: 13.5,
                  lineHeight: 20,
                  color: EX.color.inkMuted,
                }}
              >
                {q.help}
              </Text>
            </View>
          ) : null}

          {/* ── Inputs by question type — source marginTop 22, gap 11 ───────── */}
          <View style={{ marginTop: 22, gap: 11 }}>
            {/* boolean → two Yes/No tiles (row gap 12) */}
            {q.type === 'boolean' ? (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <BoolButton
                  label="Yes"
                  selected={answers[q.id] === true}
                  onPress={() => setBool(true)}
                />
                <BoolButton
                  label="No"
                  selected={answers[q.id] === false}
                  onPress={() => setBool(false)}
                />
              </View>
            ) : null}

            {/* single → radio rows */}
            {q.type === 'single'
              ? q.opts?.map((opt) => (
                  <OptRow
                    key={opt}
                    label={opt}
                    selected={answers[q.id] === opt}
                    onPress={() => setSingle(opt)}
                  />
                ))
              : null}

            {/* multiple → checkbox rows */}
            {q.type === 'multiple'
              ? q.opts?.map((opt) => {
                  const arr = Array.isArray(answers[q.id])
                    ? (answers[q.id] as string[])
                    : [];
                  return (
                    <OptRow
                      key={opt}
                      label={opt}
                      multiple
                      selected={arr.includes(opt)}
                      onPress={() => toggleMulti(opt)}
                    />
                  );
                })
              : null}

            {/* number → horizontal numeric field + unit, clamped min..max.
                Source: row, gap 12, white, 1.5px line12 border, radius 16,
                padding 4×16; input 22/700 ink; unit 15/600 #8B8499. */}
            {q.type === 'number' ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: EX.color.cardWhite,
                  borderWidth: 1.5,
                  borderColor: EX.color.line12,
                  borderRadius: EX.radius.button, // 16
                  paddingVertical: 4,
                  paddingHorizontal: 16,
                }}
              >
                <TextInput
                  keyboardType="numeric"
                  value={answers[q.id] != null ? String(answers[q.id]) : ''}
                  onChangeText={setNumber}
                  placeholder={`${q.min}–${q.max}`}
                  placeholderTextColor={EX.color.muted}
                  style={{
                    flex: 1,
                    fontSize: 22,
                    fontWeight: '700',
                    color: EX.color.ink,
                    paddingVertical: 16,
                  }}
                />
                {q.unit ? (
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '600',
                      color: EX.color.muted,
                    }}
                  >
                    {q.unit}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </ScrollView>

        {/* ── Fixed footer CTA — source padding 14px 22px 26px, white bg ────── */}
        <View
          style={{
            paddingHorizontal: 22,
            paddingTop: 14,
            paddingBottom: Math.max(insets.bottom, 16),
            borderTopWidth: 1,
            borderTopColor: EX.color.line06,
            backgroundColor: EX.color.cardWhite,
          }}
        >
          <Pressable
            onPress={next}
            disabled={!answered}
            style={[
              {
                height: 54,
                borderRadius: EX.radius.button, // 16
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                // Disabled = rgba(23,19,38,0.12); enabled = coral.
                backgroundColor: answered ? EX.color.primary : EX.color.line12,
              },
              answered
                ? {
                    shadowColor: EX.color.primary,
                    shadowOpacity: 0.45,
                    shadowRadius: 16,
                    shadowOffset: { width: 0, height: 10 },
                    elevation: 6,
                  }
                : null,
            ]}
          >
            <Text
              style={{
                fontSize: 15.5,
                fontWeight: '700',
                color: answered ? '#fff' : EX.color.muted,
              }}
            >
              {last ? 'See my result' : 'Continue'}
            </Text>
            {last ? (
              <Ic.spark
                size={18}
                color={answered ? '#fff' : EX.color.muted}
                strokeWidth={1.8}
              />
            ) : (
              <Ic.arrow
                size={18}
                color={answered ? '#fff' : EX.color.muted}
                strokeWidth={1.8}
              />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
