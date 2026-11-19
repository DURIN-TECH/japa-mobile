// ─────────────────────────────────────────────────────────────────────────────
// Answer inputs (issue #187, regroomed): one input per answer type, built from
// the design system's own pieces (LabeledInput, the shared DateField, EX
// tokens). Each is a controlled view: it shows `form` and reports the next form
// through `onChange`. Saving, drafts and errors live in InformationAnswer.
// Answers are personal: nothing here logs them.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { PressableStatic } from '@/components/explorer/PressableStatic';
import { EX } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { LabeledInput } from '@/components/explorer/AccountForm';
import { DateField, DateRangeField } from '@/components/explorer/DateField';
import {
  fromIsoDate,
  toIsoDate,
} from '@/components/explorer/intake/intakeLogic';
import {
  CURRENCY_CHOICES,
  ADDRESS_FIELD_MAX,
  ADDRESS_NOTE_MAX,
  LIST_ENTRY_MAX,
  LIST_MAX_ENTRIES,
  type AddressForm,
  type DateRangeValue,
  type MoneyForm,
} from '@/components/explorer/answerTypes';

/** Props every input shares. */
interface BaseProps {
  /** The item title: accessibility label prefix. */
  title: string;
  editable: boolean;
  /** Fires when the person finishes with the input (blur / picker choice). */
  onCommit: (field: string) => void;
}

const inputText = {
  fontSize: 14.5,
  lineHeight: 21,
  fontWeight: '400' as const,
};

// ── Dates: the shared DateField (japa#407) in its 'answer' look ───────────────
// One calendar open at a time across the screen, closes when a day is picked,
// Done commits the highlighted date. From/To share one calendar slot below them.

export function DateAnswerInput({
  form,
  onChange,
  ...base
}: BaseProps & { form: string; onChange: (f: string) => void }) {
  return (
    <DateField
      look="answer"
      value={fromIsoDate(form)}
      accessibilityLabel={base.title}
      disabled={!base.editable}
      onChange={(d) => {
        onChange(toIsoDate(d));
        base.onCommit('date');
      }}
    />
  );
}

export function DateRangeAnswerInput({
  form,
  onChange,
  ...base
}: BaseProps & {
  form: DateRangeValue;
  onChange: (f: DateRangeValue) => void;
}) {
  const fromDate = fromIsoDate(form.from);
  return (
    <DateRangeField
      look="answer"
      // Stacked, as this input always was.
      stacked
      disabled={!base.editable}
      from={{
        value: fromDate,
        innerLabel: 'From',
        accessibilityLabel: `${base.title}, from`,
        onChange: (d) => {
          onChange({ ...form, from: toIsoDate(d) });
          base.onCommit('from');
        },
      }}
      to={{
        value: fromIsoDate(form.to),
        innerLabel: 'To',
        accessibilityLabel: `${base.title}, to`,
        // Opens on the From date and cannot go before it.
        minimumDate: fromDate ?? undefined,
        initialDate: fromDate ?? undefined,
        onChange: (d) => {
          onChange({ ...form, to: toIsoDate(d) });
          base.onCommit('to');
        },
      }}
    />
  );
}

// ── Money: amount + currency chip ─────────────────────────────────────────────

export function MoneyAnswerInput({
  form,
  onChange,
  ...base
}: BaseProps & { form: MoneyForm; onChange: (f: MoneyForm) => void }) {
  const [choosing, setChoosing] = useState(false);
  const choices = CURRENCY_CHOICES.includes(form.currency)
    ? CURRENCY_CHOICES
    : [form.currency, ...CURRENCY_CHOICES];
  return (
    <View style={{ gap: 8 }}>
      <LabeledInput
        label="Amount"
        focusRing
        keyboardType="decimal-pad"
        placeholder="0"
        accessibilityLabel={`${base.title}, amount`}
        editable={base.editable}
        value={form.amount}
        onChangeText={(amount) => onChange({ ...form, amount })}
        onBlur={() => base.onCommit('amount')}
        style={inputText}
        right={
          <PressableStatic
            onPress={() => setChoosing((c) => !c)}
            disabled={!base.editable}
            accessibilityRole="button"
            accessibilityLabel={`Currency, ${form.currency}. Change`}
            style={{
              backgroundColor: EX.color.primaryTint10,
              borderRadius: EX.radius.chipSm,
              paddingHorizontal: 12,
              paddingVertical: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Text
              style={{
                fontSize: 13.5,
                fontWeight: '700',
                color: EX.color.primaryDark,
              }}
            >
              {form.currency}
            </Text>
          </PressableStatic>
        }
      />
      {choosing ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {choices.map((c) => {
            const on = c === form.currency;
            return (
              <PressableStatic
                key={c}
                onPress={() => {
                  onChange({ ...form, currency: c });
                  setChoosing(false);
                  base.onCommit('currency');
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={c}
                style={{
                  backgroundColor: on ? EX.color.primary : EX.color.cardWhite,
                  borderWidth: 1,
                  borderColor: on ? EX.color.primary : EX.color.line10,
                  borderRadius: EX.radius.chipSm,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 13.5,
                    fontWeight: '700',
                    color: on ? EX.color.cardWhite : EX.color.ink,
                  }}
                >
                  {c}
                </Text>
              </PressableStatic>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

// ── Address ───────────────────────────────────────────────────────────────────

const ADDRESS_ROWS: {
  key: keyof AddressForm;
  label: string;
  required: boolean;
  autoCapitalize: 'words' | 'characters' | 'sentences';
}[] = [
  {
    key: 'line1',
    label: 'Address line 1',
    required: true,
    autoCapitalize: 'words',
  },
  {
    key: 'line2',
    label: 'Address line 2 (optional)',
    required: false,
    autoCapitalize: 'words',
  },
  {
    key: 'city',
    label: 'Town or city',
    required: true,
    autoCapitalize: 'words',
  },
  {
    key: 'region',
    label: 'County or region (optional)',
    required: false,
    autoCapitalize: 'words',
  },
  {
    key: 'postcode',
    label: 'Postcode (optional)',
    required: false,
    autoCapitalize: 'characters',
  },
  { key: 'country', label: 'Country', required: true, autoCapitalize: 'words' },
  {
    key: 'note',
    label: 'Anything to add, like how long (optional)',
    required: false,
    autoCapitalize: 'sentences',
  },
];

export function AddressAnswerInput({
  form,
  onChange,
  ...base
}: BaseProps & { form: AddressForm; onChange: (f: AddressForm) => void }) {
  return (
    <View style={{ gap: 8 }}>
      {ADDRESS_ROWS.map((r) => (
        <LabeledInput
          key={r.key}
          label={r.label}
          focusRing
          autoCapitalize={r.autoCapitalize}
          accessibilityLabel={`${base.title}, ${r.label}`}
          editable={base.editable}
          value={form[r.key]}
          onChangeText={(t) => onChange({ ...form, [r.key]: t })}
          maxLength={r.key === 'note' ? ADDRESS_NOTE_MAX : ADDRESS_FIELD_MAX}
          onBlur={() => base.onCommit(r.key)}
          style={inputText}
        />
      ))}
    </View>
  );
}

// ── List: repeatable rows ─────────────────────────────────────────────────────

export function ListAnswerInput({
  form,
  onChange,
  ...base
}: BaseProps & { form: string[]; onChange: (f: string[]) => void }) {
  const rows = form.length ? form : [''];
  // A stable id per row, so removing a middle row never hands its focus and
  // native input state to the next one.
  const ids = useRef<string[]>([]);
  const next = useRef(0);
  while (ids.current.length < rows.length)
    ids.current.push(`r${next.current++}`);
  if (ids.current.length > rows.length) ids.current.length = rows.length;
  const atMax = rows.length >= LIST_MAX_ENTRIES;
  return (
    <View style={{ gap: 8 }}>
      {rows.map((row, i) => (
        <View
          key={ids.current[i]}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <LabeledInput
              label=""
              focusRing
              multiline
              textAlignVertical="top"
              autoCapitalize="sentences"
              autoCorrect
              maxLength={LIST_ENTRY_MAX}
              placeholder={`Entry ${i + 1}`}
              accessibilityLabel={`${base.title}, entry ${i + 1}`}
              editable={base.editable}
              value={row}
              onChangeText={(t) =>
                onChange(rows.map((r, j) => (j === i ? t : r)))
              }
              onBlur={() => base.onCommit('list')}
              style={{ ...inputText, minHeight: 44, maxHeight: 120 }}
            />
          </View>
          {rows.length > 1 && base.editable ? (
            <PressableStatic
              onPress={() => {
                ids.current.splice(i, 1);
                onChange(rows.filter((_, j) => j !== i));
                base.onCommit('list');
              }}
              accessibilityRole="button"
              accessibilityLabel={`Remove entry ${i + 1}`}
              hitSlop={8}
              style={{
                width: 44,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ic.x size={18} color={EX.color.inkMuted} strokeWidth={2} />
            </PressableStatic>
          ) : null}
        </View>
      ))}
      {base.editable ? (
        <PressableStatic
          onPress={() => {
            ids.current.push(`r${next.current++}`);
            onChange([...rows, '']);
          }}
          disabled={atMax}
          accessibilityRole="button"
          accessibilityLabel="Add another"
          style={{
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            minHeight: 44,
            opacity: atMax ? 0.5 : 1,
          }}
        >
          <Ic.plus size={16} color={EX.color.primary} strokeWidth={2.2} />
          <Text
            style={{
              fontSize: 13.5,
              fontWeight: '700',
              color: EX.color.primary,
            }}
          >
            {atMax ? 'You’ve added the most you can (20)' : 'Add another'}
          </Text>
        </PressableStatic>
      ) : null}
    </View>
  );
}
