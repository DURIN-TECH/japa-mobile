// ─────────────────────────────────────────────────────────────────────────────
// Answer inputs (issue #187, regroomed): one input per answer type, built from
// the design system's own pieces (LabeledInput, the native date picker, EX
// tokens). Each is a controlled view: it shows `form` and reports the next form
// through `onChange`. Saving, drafts and errors live in InformationAnswer.
// Answers are personal: nothing here logs them.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { PressableStatic } from '@/components/explorer/PressableStatic';
import { EX } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { LabeledInput } from '@/components/explorer/AccountForm';
import {
  displayDate,
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

// ── Date picker field ─────────────────────────────────────────────────────────

function DateField({
  value,
  label,
  accessibilityLabel,
  minimumDate,
  editable,
  onChange,
}: {
  value: string;
  label?: string;
  accessibilityLabel: string;
  /** Opens on this date when nothing is chosen (e.g. the range's start). */
  minimumDate?: Date;
  editable: boolean;
  onChange: (iso: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = fromIsoDate(value) ?? minimumDate ?? new Date();
  // iOS inline calendar: the date it shows, so "Done" can commit it. Tapping the
  // date already shown (today, when nothing is chosen) fires no change event.
  const shown = useRef<Date>(current);
  shown.current = fromIsoDate(value) ?? shown.current;
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <PressableStatic
        onPress={() => setOpen((o) => !o)}
        disabled={!editable}
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel}${value ? `, ${displayDate(value)}` : ', not chosen'}`}
        style={({ pressed }) => ({
          backgroundColor: EX.color.cardWhite,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: EX.color.line10,
          minHeight: 44,
          paddingHorizontal: 16,
          paddingVertical: 12,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        {label ? (
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
        ) : null}
        <Text
          style={{
            fontSize: 16.5,
            fontWeight: value ? '600' : '400',
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
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          accentColor={EX.color.primary}
          onChange={(event, date) => {
            if (Platform.OS !== 'ios') setOpen(false);
            if (event.type === 'set' && date) {
              shown.current = date;
              onChange(toIsoDate(date));
            }
          }}
        />
      ) : null}
      {open && Platform.OS === 'ios' ? (
        <PressableStatic
          onPress={() => {
            // Commit the date the calendar shows (picks today when untouched).
            onChange(toIsoDate(shown.current));
            setOpen(false);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${accessibilityLabel}, done`}
          style={{
            alignSelf: 'flex-end',
            minHeight: 44,
            justifyContent: 'center',
            paddingHorizontal: 8,
          }}
        >
          <Text
            style={{ fontSize: 14, fontWeight: '700', color: EX.color.primary }}
          >
            Done
          </Text>
        </PressableStatic>
      ) : null}
    </View>
  );
}

export function DateAnswerInput({
  form,
  onChange,
  ...base
}: BaseProps & { form: string; onChange: (f: string) => void }) {
  return (
    <DateField
      value={form}
      accessibilityLabel={base.title}
      editable={base.editable}
      onChange={(iso) => {
        onChange(iso);
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
  return (
    <View style={{ gap: 10 }}>
      <DateField
        label="From"
        value={form.from}
        accessibilityLabel={`${base.title}, from`}
        editable={base.editable}
        onChange={(iso) => {
          onChange({ ...form, from: iso });
          base.onCommit('from');
        }}
      />
      <DateField
        label="To"
        value={form.to}
        minimumDate={fromIsoDate(form.from) ?? undefined}
        accessibilityLabel={`${base.title}, to`}
        editable={base.editable}
        onChange={(iso) => {
          onChange({ ...form, to: iso });
          base.onCommit('to');
        }}
      />
    </View>
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
          key={i}
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
