// ─────────────────────────────────────────────────────────────────────────────
// IntakeQuestionList (issue #113) — the GENERIC intake renderer.
//
// Maps the ordered question array the backend returned to controls by
// `answerType`, applies `showWhen`, and renders follow-ups and groups. It has
// no knowledge of any country, route or nationality: every question string
// comes from the rubric; the only copy here is route-neutral app chrome.
//
// Built from the Explorer tokens (`EX`) only. Local building blocks proposed
// by the design spec live in this file: QuestionBlock, OptionCard (with the
// square multi-choice indicator), YesNo, DateField, FilterChip and the
// text/amount controls.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import {
  daysBetween,
  daysLabel,
  displayDate,
  fromIsoDate,
  groupDigits,
  hiddenAnsweredBy,
  isBlank,
  isKnownType,
  toIsoDate,
  visibleIds,
} from './intakeLogic';
import { PressableStatic } from '@/components/explorer/PressableStatic';
import { EX } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import type {
  IntakeAnswer,
  IntakeAnswers,
  IntakeQuestion,
} from '@/types/intake.type';

// Reveal animation: 300ms on the system's one curve. Reanimated honours the
// OS "reduce motion" setting, so these become instant when it is on.
const CURVE = Easing.bezier(0.2, 0.8, 0.2, 1);
const reveal = FadeIn.duration(300).easing(CURVE);
const conceal = FadeOut.duration(200);
const relayout = LinearTransition.duration(300).easing(CURVE);

// Error border colour (field at fault) — the system's status-error-fg.
const ERROR_FG = '#C0453C';

// ── Shared chrome ────────────────────────────────────────────────────────────

/** Card-style surface used by inputs and date fields (radius-card-sm). */
const fieldSurface = (hasError: boolean) => ({
  backgroundColor: EX.color.cardWhite,
  borderRadius: EX.radius.cardSm,
  borderWidth: hasError ? 1.5 : 1,
  borderColor: hasError ? ERROR_FG : EX.color.line10,
  shadowColor: '#171326',
  shadowOpacity: 0.04,
  shadowRadius: 2,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
});

// ── OptionCard — one tappable option; `multi` swaps the round check for a square ──
function OptionCard({
  label,
  description,
  selected,
  multi,
  disabled,
  onPress,
}: {
  label: string;
  description?: string;
  selected: boolean;
  multi: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableStatic
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ selected, checked: selected, disabled }}
      style={({ pressed }) => ({
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 15,
        borderRadius: EX.radius.card,
        backgroundColor: selected ? EX.color.primaryTint07 : EX.color.cardWhite,
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? EX.color.primary : EX.color.line16,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontSize: 15.5, fontWeight: '700', color: EX.color.ink }}
        >
          {label}
        </Text>
        {description ? (
          <Text
            style={{
              fontSize: 13,
              lineHeight: 18,
              color: EX.color.inkMuted,
              marginTop: 2,
            }}
          >
            {description}
          </Text>
        ) : null}
      </View>
      {/* Indicator: round (single) or square radius-6 (multi); filled coral when selected */}
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: multi ? 6 : 10,
          borderWidth: selected ? 0 : 1.5,
          borderColor: EX.color.line24,
          backgroundColor: selected ? EX.color.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? <Ic.check size={13} color="#fff" strokeWidth={3} /> : null}
      </View>
    </PressableStatic>
  );
}

// ── YesNo — two equal tiles; selected label stays `ink` (coral fails contrast) ──
function YesNo({
  value,
  disabled,
  label,
  onChange,
}: {
  value: boolean | undefined;
  disabled?: boolean;
  label: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', gap: 10 }}
    >
      {[true, false].map((opt) => {
        const selected = value === opt;
        return (
          <PressableStatic
            key={String(opt)}
            onPress={() => onChange(opt)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 44,
              paddingVertical: 16,
              alignItems: 'center',
              borderRadius: EX.radius.button,
              backgroundColor: selected
                ? EX.color.primaryTint07
                : EX.color.cardWhite,
              borderWidth: selected ? 1.5 : 1,
              borderColor: selected ? EX.color.primary : EX.color.line16,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: selected ? EX.color.ink : EX.color.inkMuted,
              }}
            >
              {opt ? 'Yes' : 'No'}
            </Text>
          </PressableStatic>
        );
      })}
    </View>
  );
}

// ── FilterChip — currency chip (selected = ink fill) ─────────────────────────
function FilterChip({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableStatic
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: 16,
        justifyContent: 'center',
        borderRadius: EX.radius.pill,
        backgroundColor: selected ? EX.color.ink : EX.color.cardWhite,
        borderWidth: 1,
        borderColor: selected ? EX.color.ink : EX.color.line16,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: '700',
          color: selected ? '#fff' : EX.color.ink,
        }}
      >
        {label}
      </Text>
    </PressableStatic>
  );
}

// ── DateField — LabeledInput chrome that opens the native date picker ─────────
function DateField({
  value,
  innerLabel,
  accessibilityLabel,
  hint,
  minimumDate,
  maximumDate,
  initialDate,
  hasError,
  disabled,
  onChange,
}: {
  value?: string;
  innerLabel?: string;
  accessibilityLabel: string;
  hint?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Date the picker opens on when nothing is chosen yet. */
  initialDate?: Date;
  hasError?: boolean;
  disabled?: boolean;
  onChange: (iso: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current =
    fromIsoDate(value) ?? initialDate ?? minimumDate ?? new Date();

  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <PressableStatic
        onPress={() => setOpen((o) => !o)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={hint}
        style={({ pressed }) => ({
          ...fieldSurface(!!hasError),
          minHeight: 44,
          paddingHorizontal: 16,
          paddingVertical: 14,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        {innerLabel ? (
          <Text
            style={{
              fontSize: 12.5,
              fontWeight: '600',
              color: EX.color.inkMuted,
              marginBottom: 4,
            }}
          >
            {innerLabel}
          </Text>
        ) : null}
        <Text
          style={{
            fontSize: 16.5,
            fontWeight: value ? '600' : '400',
            // The empty prompt is an instruction, so `inkMuted` (readable), not `faint`.
            color: value ? EX.color.ink : EX.color.inkMuted,
          }}
        >
          {value ? displayDate(value) : 'Choose a date'}
        </Text>
      </PressableStatic>
      {open ? (
        <DateTimePicker
          value={current}
          mode="date"
          // iOS shows the calendar inline under the field; Android opens its dialog.
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          accentColor={EX.color.primary}
          onChange={(event, date) => {
            // Android fires once ('set' | 'dismissed') and closes itself.
            if (Platform.OS !== 'ios') setOpen(false);
            if (event.type === 'set' && date) onChange(toIsoDate(date));
          }}
        />
      ) : null}
    </View>
  );
}

// ── QuestionBlock — label, help, open-required line, then the control ────────
function QuestionBlock({
  q,
  showOpenLine,
  showOptionalTag,
  hiddenNote,
  children,
  onLayoutY,
}: {
  q: IntakeQuestion;
  showOpenLine: boolean;
  showOptionalTag: boolean;
  hiddenNote: boolean;
  children: React.ReactNode;
  onLayoutY?: (y: number) => void;
}) {
  return (
    <View
      style={{ gap: 10 }}
      onLayout={(e) => onLayoutY?.(e.nativeEvent.layout.y)}
    >
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
          <Text
            style={{
              flex: 1,
              fontSize: 15.5,
              fontWeight: '700',
              color: EX.color.ink,
            }}
          >
            {q.label}
          </Text>
          {showOptionalTag ? (
            <Text
              style={{
                fontSize: 13.5,
                fontWeight: '600',
                color: EX.color.inkMuted,
              }}
            >
              Optional
            </Text>
          ) : null}
        </View>
        {q.helpText ? (
          <Text
            style={{ fontSize: 13, lineHeight: 19, color: EX.color.inkMuted }}
          >
            {q.helpText}
          </Text>
        ) : null}
        {showOpenLine ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              marginTop: 2,
            }}
          >
            {/* amber dot (a dot, not text: amber text fails contrast) */}
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: EX.color.amber,
              }}
            />
            <Text
              style={{
                fontSize: 12.5,
                fontWeight: '600',
                color: EX.color.inkMuted,
              }}
            >
              Required, not answered yet
            </Text>
          </View>
        ) : null}
      </View>
      {children}
      {hiddenNote ? (
        <Text
          style={{ fontSize: 13, lineHeight: 19, color: EX.color.inkMuted }}
        >
          The answers you gave below will be removed when you save.
        </Text>
      ) : null}
    </View>
  );
}

// ── Free text ────────────────────────────────────────────────────────────────
function TextControl({
  q,
  value,
  hasError,
  disabled,
  onChange,
}: {
  q: IntakeQuestion;
  value: string;
  hasError: boolean;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  const max = q.textLimits?.maxLength;
  // A long answer (a generous limit) gets a multiline box; short ones stay one line.
  const long = (max ?? 0) > 120;
  return (
    <View
      style={{
        ...fieldSurface(hasError),
        paddingHorizontal: 16,
        paddingVertical: 15,
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        multiline={long}
        maxLength={max}
        autoCapitalize="sentences"
        accessibilityLabel={q.label}
        accessibilityHint={q.helpText}
        placeholderTextColor={EX.color.inkMuted}
        style={{
          fontSize: 16.5,
          fontWeight: '600',
          color: EX.color.ink,
          paddingVertical: 0,
          minHeight: long ? 96 : undefined,
          textAlignVertical: long ? 'top' : 'center',
        }}
      />
      {/* Counter only once past 80% of the limit */}
      {max && value.length > max * 0.8 ? (
        <Text
          style={{
            alignSelf: 'flex-end',
            fontSize: 12,
            fontWeight: '600',
            color: EX.color.inkMuted,
            marginTop: 6,
          }}
        >
          {value.length}/{max}
        </Text>
      ) : null}
    </View>
  );
}

// ── Amount with currency ─────────────────────────────────────────────────────
function AmountControl({
  q,
  value,
  hasError,
  disabled,
  onChange,
}: {
  q: IntakeQuestion;
  value: { amount?: number; currency?: string } | undefined;
  hasError: boolean;
  disabled?: boolean;
  onChange: (v: { amount?: number; currency?: string }) => void;
}) {
  // Keep what the person typed as text so "12." and "0.5" survive typing.
  const [raw, setRaw] = useState(
    value?.amount !== undefined ? String(value.amount) : '',
  );
  const currencies = q.currencies ?? [];

  const onType = (text: string) => {
    // Digits and one decimal point only; thousands separators are display-only.
    const clean = text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setRaw(clean);
    const n = clean === '' || clean === '.' ? undefined : Number(clean);
    onChange({
      ...value,
      amount: Number.isFinite(n as number) ? n : undefined,
    });
  };

  // Shown grouped ("2,500"), while the decimal part stays as typed.
  const [intPart, decPart] = raw.split('.');
  const shown =
    (intPart ? groupDigits(Number(intPart)) : '') +
    (decPart !== undefined ? `.${decPart}` : '');

  return (
    <View style={{ gap: 10 }}>
      {currencies.length > 0 ? (
        <View
          accessibilityRole="radiogroup"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
        >
          {currencies.map((c) => (
            <FilterChip
              key={c}
              label={c}
              selected={value?.currency === c}
              disabled={disabled}
              onPress={() => onChange({ ...value, currency: c })}
            />
          ))}
        </View>
      ) : (
        // The rubric declared no currency list: a plain ISO-code field.
        <View
          style={{
            ...fieldSurface(hasError),
            paddingHorizontal: 16,
            paddingVertical: 15,
          }}
        >
          <TextInput
            value={value?.currency ?? ''}
            onChangeText={(t) =>
              onChange({
                ...value,
                currency: t
                  .toUpperCase()
                  .replace(/[^A-Z]/g, '')
                  .slice(0, 3),
              })
            }
            editable={!disabled}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="Currency code, for example USD"
            placeholderTextColor={EX.color.inkMuted}
            accessibilityLabel={`${q.label}, currency code`}
            style={{
              fontSize: 16.5,
              fontWeight: '600',
              color: EX.color.ink,
              paddingVertical: 0,
            }}
          />
        </View>
      )}
      <View
        style={{
          ...fieldSurface(hasError),
          paddingHorizontal: 16,
          paddingVertical: 15,
        }}
      >
        <TextInput
          value={shown}
          onChangeText={onType}
          editable={!disabled}
          keyboardType="decimal-pad"
          placeholder="Amount"
          placeholderTextColor={EX.color.inkMuted}
          accessibilityLabel={q.label}
          accessibilityHint={q.helpText}
          style={{
            fontSize: 16.5,
            fontWeight: '600',
            color: EX.color.ink,
            paddingVertical: 0,
          }}
        />
      </View>
    </View>
  );
}

// ── Date bounds from the question's declared limits ──────────────────────────
function dateBounds(q: IntakeQuestion): { min?: Date; max?: Date } {
  const lim = q.dateLimits;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const mins: Date[] = [];
  const maxs: Date[] = [];
  const lo = fromIsoDate(lim?.min);
  const hi = fromIsoDate(lim?.max);
  if (lo) mins.push(lo);
  if (hi) maxs.push(hi);
  if (lim?.relativeToToday === 'future_only') mins.push(today);
  if (lim?.relativeToToday === 'past_only') maxs.push(today);
  return {
    min: mins.length
      ? new Date(Math.max(...mins.map((d) => d.getTime())))
      : undefined,
    max: maxs.length
      ? new Date(Math.min(...maxs.map((d) => d.getTime())))
      : undefined,
  };
}

// ── The control for one question, chosen only by `answerType` ────────────────
function Control({
  q,
  value,
  hasError,
  disabled,
  stackRange,
  onChange,
}: {
  q: IntakeQuestion;
  value: IntakeAnswer | undefined;
  hasError: boolean;
  disabled?: boolean;
  stackRange: boolean;
  onChange: (v: IntakeAnswer | undefined) => void;
}) {
  switch (q.answerType) {
    case 'single_choice':
      return (
        <View style={{ gap: 10 }}>
          {(q.options ?? []).map((o) => {
            const selected = value === o.value;
            return (
              <OptionCard
                key={o.value}
                label={o.label}
                description={o.description}
                selected={selected}
                multi={false}
                disabled={disabled}
                onPress={() => {
                  // Required: tapping the chosen option again does nothing.
                  // Optional: it clears the answer.
                  if (selected) {
                    if (!q.required) onChange(undefined);
                    return;
                  }
                  onChange(o.value);
                }}
              />
            );
          })}
        </View>
      );
    case 'multi_choice': {
      const current = Array.isArray(value) ? value : [];
      return (
        <View style={{ gap: 10 }}>
          {(q.options ?? []).map((o) => {
            const selected = current.includes(o.value);
            return (
              <OptionCard
                key={o.value}
                label={o.label}
                description={o.description}
                selected={selected}
                multi
                disabled={disabled}
                onPress={() =>
                  onChange(
                    selected
                      ? current.filter((v) => v !== o.value)
                      : [...current, o.value],
                  )
                }
              />
            );
          })}
        </View>
      );
    }
    case 'yes_no':
      return (
        <YesNo
          value={typeof value === 'boolean' ? value : undefined}
          label={q.label}
          disabled={disabled}
          onChange={onChange}
        />
      );
    case 'date': {
      const { min, max } = dateBounds(q);
      return (
        <DateField
          value={typeof value === 'string' ? value : undefined}
          accessibilityLabel={q.label}
          hint={q.helpText}
          minimumDate={min}
          maximumDate={max}
          hasError={hasError}
          disabled={disabled}
          onChange={onChange}
        />
      );
    }
    case 'date_range': {
      const r = (value ?? {}) as { from?: string; to?: string };
      const { min, max } = dateBounds(q);
      const fromDate = fromIsoDate(r.from);
      // "To" opens on the From date, cannot go before it, and cannot pass the
      // declared maximum length.
      const toMin = fromDate && (!min || fromDate > min) ? fromDate : min;
      let toMax = max;
      if (fromDate && q.maxLengthDays) {
        const cap = new Date(fromDate);
        cap.setDate(cap.getDate() + q.maxLengthDays);
        toMax = !max || cap < max ? cap : max;
      }
      const length = r.from && r.to ? daysBetween(r.from, r.to) : null;
      return (
        <View style={{ gap: 8 }}>
          <View
            style={{ flexDirection: stackRange ? 'column' : 'row', gap: 10 }}
          >
            <DateField
              value={r.from}
              innerLabel="From"
              accessibilityLabel={`${q.label}, from`}
              hint={q.helpText}
              minimumDate={min}
              maximumDate={max}
              hasError={hasError}
              disabled={disabled}
              onChange={(iso) => onChange({ ...r, from: iso })}
            />
            <DateField
              value={r.to}
              innerLabel="To"
              accessibilityLabel={`${q.label}, to`}
              hint={q.helpText}
              minimumDate={toMin}
              maximumDate={toMax}
              initialDate={fromDate ?? undefined}
              hasError={hasError}
              disabled={disabled}
              onChange={(iso) => onChange({ ...r, to: iso })}
            />
          </View>
          {length !== null && length >= 0 ? (
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: EX.color.inkMuted,
              }}
            >
              {daysLabel(length)}
            </Text>
          ) : null}
        </View>
      );
    }
    case 'text':
      return (
        <TextControl
          q={q}
          value={typeof value === 'string' ? value : ''}
          hasError={hasError}
          disabled={disabled}
          onChange={(t) => onChange(t === '' ? undefined : t)}
        />
      );
    case 'amount':
      return (
        <AmountControl
          q={q}
          value={
            value && typeof value === 'object' && !Array.isArray(value)
              ? (value as { amount?: number; currency?: string })
              : undefined
          }
          hasError={hasError}
          disabled={disabled}
          onChange={onChange}
        />
      );
    default:
      return null;
  }
}

// ── Public component ─────────────────────────────────────────────────────────
export function IntakeQuestionList({
  questions,
  answers,
  onChange,
  errorId,
  showOpenLines,
  disabled,
  narrow,
  onQuestionLayout,
}: {
  questions: IntakeQuestion[];
  answers: IntakeAnswers;
  /** `undefined` clears the answer. */
  onChange: (id: string, value: IntakeAnswer | undefined) => void;
  /** Question whose control takes the error border. */
  errorId?: string | null;
  /** Show "Required, not answered yet" on open required questions. */
  showOpenLines: boolean;
  disabled?: boolean;
  /** Stack date ranges (screens under 360pt). */
  narrow?: boolean;
  /** Reports each block's y (relative to this list) for scroll-to. */
  onQuestionLayout?: (id: string, y: number) => void;
}) {
  const vis = visibleIds(questions, answers);
  const controllers = hiddenAnsweredBy(questions, answers);

  // Walk the FULL list so "the question directly above" is judged on the
  // declared order, then render only what is visible and renderable.
  const rows: React.ReactNode[] = [];
  let hasUnknown = false;
  let lastGroup: string | undefined;

  questions.forEach((q, i) => {
    if (!vis.has(q.id)) return;
    if (!isKnownType(q)) {
      hasUnknown = true; // skipped; one note at the end says so
      return;
    }

    // Follow-up: every condition points at the question directly above.
    const prev = questions[i - 1];
    const isFollowUp =
      !!prev &&
      !!q.showWhen?.anyOf?.length &&
      q.showWhen.anyOf.every((c) => c.questionId === prev.id);

    // Optional group: consecutive questions that share a `group` get a header.
    const groupStarts = !!q.group && q.group !== lastGroup;
    lastGroup = q.group;
    const groupQs = q.group ? questions.filter((x) => x.group === q.group) : [];
    const groupOptional =
      groupQs.length > 0 && groupQs.every((x) => !x.required);

    const open = q.required && isBlank(answers[q.id]);

    rows.push(
      <Animated.View
        key={q.id}
        entering={reveal}
        exiting={conceal}
        layout={relayout}
        style={{ gap: 22 }}
      >
        {groupStarts ? (
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: EX.color.line06,
              paddingTop: 22,
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 18,
                fontWeight: '700',
                color: EX.color.ink,
                letterSpacing: -0.18,
              }}
            >
              {q.group}
            </Text>
            {groupOptional ? (
              <Text
                style={{
                  fontSize: 13.5,
                  fontWeight: '600',
                  color: EX.color.inkMuted,
                }}
              >
                Optional
              </Text>
            ) : null}
          </View>
        ) : null}
        <View
          style={
            isFollowUp
              ? {
                  marginLeft: 14,
                  paddingLeft: 14,
                  borderLeftWidth: 2,
                  borderLeftColor: EX.color.line08,
                }
              : undefined
          }
        >
          <QuestionBlock
            q={q}
            showOpenLine={showOpenLines && open}
            // Optional tag on the label row, except inside a group (the group header says it)
            showOptionalTag={!q.required && !q.group}
            hiddenNote={controllers.has(q.id)}
            onLayoutY={(y) => onQuestionLayout?.(q.id, y)}
          >
            <Control
              q={q}
              value={answers[q.id]}
              hasError={errorId === q.id}
              disabled={disabled}
              stackRange={!!narrow}
              onChange={(v) => onChange(q.id, v)}
            />
          </QuestionBlock>
        </View>
      </Animated.View>,
    );
  });

  return (
    <View style={{ gap: 22 }}>
      {rows}
      {hasUnknown ? (
        <View
          style={{
            flexDirection: 'row',
            gap: 10,
            backgroundColor: EX.color.cream,
            borderWidth: 1,
            borderColor: EX.color.line08,
            borderRadius: EX.radius.button,
            padding: 14,
          }}
        >
          <Ic.shield size={17} color={EX.color.primary} strokeWidth={1.9} />
          <Text
            style={{
              flex: 1,
              fontSize: 13,
              lineHeight: 19,
              color: EX.color.ink2,
            }}
          >
            One question can’t be shown in this version of the app. Update Seli
            to answer it.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
