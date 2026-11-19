// ─────────────────────────────────────────────────────────────────────────────
// DateField / DateRangeField (japa#407) — the ONE date picker of the app.
//
// Replaces three inline copies (intake questions, requirement answers, Holdings
// › Add document › Valid until). A tappable field opens the native picker:
//
//   iOS      an inline calendar under the field (or under the From/To row),
//            forced light (`themeVariant="light"`): the app is always light,
//            but `userInterfaceStyle: "automatic"` made the calendar follow the
//            phone's dark mode, which drew near-white text on cream.
//   Android  the system date dialog, unchanged: it closes itself on OK or
//            cancel, and only OK ("set") sets a value.
//
// Behaviour (iOS):
//   - One calendar open at a time in the whole app (so on every screen): the
//     open field's key lives in a tiny module store, and opening any field
//     replaces it. Tapping the open field again closes it and changes nothing.
//   - Tapping a day commits it and closes. Browsing months with the `<` `>`
//     arrows fires nothing. The header's month/year selector DOES fire a change
//     (see `isBrowseChange`), so it is told apart and leaves the calendar open,
//     including when iOS moves the day for it (short month, min/max clamp).
//   - "Done" commits the date the calendar is highlighting (clamped to the
//     min/max) and closes. It is the only way to pick the date that is already
//     highlighted (today, or the From date for To): tapping it fires no change.
//
// Each place keeps its own field look through `look` (see FieldLook).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useId, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { create } from 'zustand';
import { PressableStatic } from '@/components/explorer/PressableStatic';
import { EX } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';

// ── One-open-at-a-time ───────────────────────────────────────────────────────
// The key of the field whose calendar is open, or null. Module-wide on purpose:
// a screen never shows two calendars, and nothing has to wrap the screens in a
// provider (the requirement-answer items render deep inside DocumentChecklist).

interface OpenDateState {
  openKey: string | null;
  setOpenKey: (key: string | null) => void;
}

export const useOpenDateField = create<OpenDateState>((set) => ({
  openKey: null,
  setOpenKey: (openKey) => set({ openKey }),
}));

// ── Pure helpers (exported for tests) ────────────────────────────────────────

/** `d` limited to [min, max]; either bound may be missing. */
export function clampToRange(d: Date, min?: Date, max?: Date): Date {
  if (min && d < min) return new Date(min);
  if (max && d > max) return new Date(max);
  return d;
}

/**
 * Was this iOS change the header's month/year selector ("browsing"), not a day
 * tap ("picked")?
 *
 * The library's iOS `onChange` fires on UIControlEventValueChanged only, with
 * nothing that says where the change came from. The `<` `>` arrows page the
 * view without changing the value, so they fire nothing. The month/year
 * selector does change the value: it keeps the day of the month and moves the
 * month or year. So: same day of the month, different month or year → browsing
 * (stay open); anything else → a day was picked (commit and close).
 *
 * Checked on the iOS simulator by QA in japa#407: the selector does fire
 * `onChange` (same day of the month, new month/year), this rule counts it as
 * browsing and the calendar stays open, and Done then sets that date.
 *
 * iOS also moves the day itself in two cases, and those count as browsing too
 * (so we never save a date the person did not tap):
 *   - the new month is shorter than the old day (31 Jan → Feb gives 28 Feb, or
 *     29 Feb in a leap year): the new date is the LAST day of its month and
 *     earlier in the month than the old one;
 *   - the new month/year is outside min/max: iOS clamps to the bound, so the
 *     new date EQUALS `min` or `max` (same calendar day).
 * Browsing leaves that date highlighted, so Done sets it.
 *
 * What the rule cannot tell apart (the native event says nothing more):
 *   - a real tap on exactly the last day of a month, or on the min/max day,
 *     after the month changed (e.g. 31 Jan highlighted, arrows to Feb, tap
 *     28 Feb) looks like the selector moving the day: it counts as browsing
 *     and stays open, with that day highlighted; the person presses Done;
 *   - likewise picking the same day number in a month reached with the arrows
 *     counts as browsing and stays open; Done or a tap on the field closes it.
 * Both fail safe: the calendar stays open and nothing is saved.
 */
export function isBrowseChange(
  prev: Date,
  next: Date,
  min?: Date,
  max?: Date,
): boolean {
  const monthChanged =
    prev.getMonth() !== next.getMonth() ||
    prev.getFullYear() !== next.getFullYear();
  // A change inside the same month is always a day tap.
  if (!monthChanged) return false;

  // The selector kept the day of the month.
  if (prev.getDate() === next.getDate()) return true;

  // The selector landed on a shorter month and iOS moved the day to its end.
  const lastDayOfNextMonth = new Date(
    next.getFullYear(),
    next.getMonth() + 1,
    0,
  ).getDate();
  if (next.getDate() === lastDayOfNextMonth && next.getDate() < prev.getDate())
    return true;

  // The selector went past a bound and iOS clamped to it.
  if (min && sameDay(next, min)) return true;
  if (max && sameDay(next, max)) return true;

  return false;
}

/** Same calendar day (local), whatever the time of day. */
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ── Field looks ──────────────────────────────────────────────────────────────
// 'intake'  the intake question field (cardSm radius, error border)
// 'answer'  the requirement-answer field (18 radius, value in the a11y label)
// 'pick'    Add document's PickField (label always on, chevron, muted placeholder)

export type FieldLook = 'intake' | 'answer' | 'pick';

// Error border colour (field at fault) — the system's status-error-fg.
const ERROR_FG = '#C0453C';

/** "12 Mar 2027" — the intake / answer display format. */
const defaultFormat = (d: Date) => format(d, 'd MMM yyyy');

/** Props shared by a single field and a From/To range. */
export interface DateFieldCommonProps {
  look?: FieldLook;
  /** Intake: the field at fault gets the error border. */
  hasError?: boolean;
  /** A disabled field never opens (and an open one closes). */
  disabled?: boolean;
  /** How the chosen date is shown in the field. */
  formatValue?: (d: Date) => string;
  /** Shown while nothing is chosen. Default "Choose a date". */
  placeholder?: string;
}

/** One date: what a field shows, its bounds, and where a choice goes. */
export interface DateFieldSide {
  value: Date | null;
  onChange: (d: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Highlighted when nothing is chosen yet (e.g. To opens on From). */
  initialDate?: Date;
  /** Label inside the field ("From" / "To", or the PickField label). */
  innerLabel?: string;
  /** The field's spoken label; Done is this plus ", done". */
  accessibilityLabel: string;
  hint?: string;
  /** e2e (Maestro): the field gets this id, its Done `<id>.done`, its calendar `<id>.calendar`. */
  testID?: string;
}

// ── useDateSide — open state + highlighted date of one field ─────────────────
function useDateSide(side: DateFieldSide, key: string, disabled?: boolean) {
  // Watch only "is the open key mine" (a boolean), not the key itself, so
  // opening a calendar re-renders just the field that opens and the one that
  // closes, not every date field in the app.
  const isMine = useOpenDateField((s) => s.openKey === key);
  const setOpenKey = useOpenDateField((s) => s.setOpenKey);
  const open = isMine && !disabled;

  // The date the calendar shows. Set on opening; moved by the month/year
  // selector; what Done commits.
  const start = () =>
    clampToRange(
      side.value ?? side.initialDate ?? new Date(),
      side.minimumDate,
      side.maximumDate,
    );
  const [highlighted, setHighlighted] = useState<Date>(start);

  // An open field that becomes disabled (e.g. busy) closes.
  useEffect(() => {
    if (disabled && useOpenDateField.getState().openKey === key)
      setOpenKey(null);
  }, [disabled, key, setOpenKey]);

  // A field that goes away while open must not leave a stale key behind.
  useEffect(
    () => () => {
      if (useOpenDateField.getState().openKey === key)
        useOpenDateField.getState().setOpenKey(null);
    },
    [key],
  );

  const toggle = () => {
    if (disabled) return;
    if (open) {
      // Today's toggle: closing by the field changes nothing.
      setOpenKey(null);
      return;
    }
    setHighlighted(start());
    setOpenKey(key); // replaces (closes) any other open calendar
  };

  const commit = (d: Date) => {
    side.onChange(clampToRange(d, side.minimumDate, side.maximumDate));
    setOpenKey(null);
  };

  /** The picker's onChange, for both platforms. */
  const onPickerChange = (type: string, date: Date | undefined) => {
    if (Platform.OS !== 'ios') {
      // Android's dialog closes itself on any answer; only OK sets a value.
      setOpenKey(null);
      if (type === 'set' && date) commit(date);
      return;
    }
    if (type !== 'set' || !date) return;
    if (isBrowseChange(highlighted, date, side.minimumDate, side.maximumDate)) {
      // The month/year selector (or iOS moving the day for it): stay open,
      // save nothing, keep that date highlighted for Done.
      setHighlighted(date);
      return;
    }
    commit(date);
  };

  return {
    open,
    highlighted,
    toggle,
    onPickerChange,
    done: () => commit(highlighted),
  };
}

// ── FieldButton — the tappable field, in one of the three looks ──────────────
function FieldButton({
  side,
  look,
  hasError,
  disabled,
  formatValue,
  placeholder,
  onPress,
  inRow,
}: {
  side: DateFieldSide;
  look: FieldLook;
  hasError?: boolean;
  disabled?: boolean;
  formatValue: (d: Date) => string;
  placeholder: string;
  onPress: () => void;
  /** Side by side in a From/To row: share the width. */
  inRow?: boolean;
}) {
  const shown = side.value ? formatValue(side.value) : null;

  // Spoken label per look (as each place had it before japa#407).
  const label =
    look === 'answer'
      ? `${side.accessibilityLabel}${shown ? `, ${shown}` : ', not chosen'}`
      : look === 'pick'
        ? `${side.accessibilityLabel}, ${shown ?? placeholder}`
        : side.accessibilityLabel;

  const rowFlex = inRow ? { flex: 1, minWidth: 0 } : null;

  if (look === 'pick') {
    return (
      <PressableStatic
        testID={side.testID}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={side.hint}
        style={{
          ...rowFlex,
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
        {side.innerLabel ? (
          <Text
            style={{
              fontSize: 12.5,
              fontWeight: '600',
              color: EX.color.inkMuted,
              marginBottom: 4,
            }}
          >
            {side.innerLabel}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: 16.5,
              fontWeight: '600',
              // `muted` is allowed for placeholders only.
              color: shown ? EX.color.ink : EX.color.muted,
            }}
          >
            {shown ?? placeholder}
          </Text>
          <Ic.chevR size={18} color={EX.color.muted} strokeWidth={1.8} />
        </View>
      </PressableStatic>
    );
  }

  // 'intake' and 'answer' share one layout; they differ in surface and label colour.
  const surface =
    look === 'intake'
      ? {
          backgroundColor: EX.color.cardWhite,
          borderRadius: EX.radius.cardSm,
          borderWidth: hasError ? 1.5 : 1,
          borderColor: hasError ? ERROR_FG : EX.color.line10,
          shadowColor: '#171326',
          shadowOpacity: 0.04,
          shadowRadius: 2,
          shadowOffset: { width: 0, height: 1 },
          elevation: 1,
          paddingVertical: 14,
        }
      : {
          backgroundColor: EX.color.cardWhite,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: EX.color.line10,
          paddingVertical: 12,
        };

  return (
    <PressableStatic
      testID={side.testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={side.hint}
      style={({ pressed }) => ({
        ...rowFlex,
        ...surface,
        minHeight: 44,
        paddingHorizontal: 16,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {side.innerLabel ? (
        <Text
          style={{
            fontSize: 12.5,
            fontWeight: '600',
            color: look === 'intake' ? EX.color.inkMuted : EX.color.muted,
            marginBottom: 4,
          }}
        >
          {side.innerLabel}
        </Text>
      ) : null}
      <Text
        style={{
          fontSize: 16.5,
          fontWeight: shown ? '600' : '400',
          // The empty prompt is an instruction, so `inkMuted` (readable), not `faint`.
          color: shown ? EX.color.ink : EX.color.inkMuted,
        }}
      >
        {shown ?? placeholder}
      </Text>
    </PressableStatic>
  );
}

// ── Calendar — the native picker, plus Done on iOS ───────────────────────────
function Calendar({
  side,
  state,
}: {
  side: DateFieldSide;
  state: ReturnType<typeof useDateSide>;
}) {
  if (!state.open) return null;
  const ios = Platform.OS === 'ios';
  return (
    <View testID={side.testID ? `${side.testID}.calendar` : undefined}>
      <DateTimePicker
        value={state.highlighted}
        mode="date"
        // iOS shows the calendar inline; Android opens its dialog.
        display={ios ? 'inline' : 'default'}
        minimumDate={side.minimumDate}
        maximumDate={side.maximumDate}
        accentColor={EX.color.primary}
        // Readable whatever the phone's appearance (iOS only; Android unchanged).
        themeVariant={ios ? 'light' : undefined}
        onChange={(event, date) => state.onPickerChange(event.type, date)}
      />
      {ios ? (
        <PressableStatic
          testID={side.testID ? `${side.testID}.done` : undefined}
          onPress={state.done}
          accessibilityRole="button"
          accessibilityLabel={`${side.accessibilityLabel}, done`}
          style={{
            alignSelf: 'flex-end',
            minHeight: 44,
            minWidth: 44,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 8,
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
        </PressableStatic>
      ) : null}
    </View>
  );
}

// ── Public: one date field ───────────────────────────────────────────────────
export function DateField({
  look = 'intake',
  hasError,
  disabled,
  formatValue = defaultFormat,
  placeholder = 'Choose a date',
  ...side
}: DateFieldCommonProps & DateFieldSide) {
  const key = useId();
  const state = useDateSide(side, key, disabled);
  return (
    <View style={{ gap: 8 }}>
      <FieldButton
        side={side}
        look={look}
        hasError={hasError}
        disabled={disabled}
        formatValue={formatValue}
        placeholder={placeholder}
        onPress={state.toggle}
      />
      <Calendar side={side} state={state} />
    </View>
  );
}

// ── Public: a From/To pair with ONE calendar slot under the row ──────────────
// The open calendar (From's or To's) sits below both fields at the row's full
// width, whether the row is side by side or stacked.
export function DateRangeField({
  look = 'intake',
  hasError,
  disabled,
  formatValue = defaultFormat,
  placeholder = 'Choose a date',
  from,
  to,
  stacked,
  children,
}: DateFieldCommonProps & {
  from: DateFieldSide;
  to: DateFieldSide;
  /** Fields one above the other (narrow screens, requirement answers). */
  stacked?: boolean;
  /** Rendered under the row, above the calendar (e.g. the "61 days" line). */
  children?: React.ReactNode;
}) {
  const key = useId();
  const fromState = useDateSide(from, `${key}:from`, disabled);
  const toState = useDateSide(to, `${key}:to`, disabled);
  const common = { look, hasError, disabled, formatValue, placeholder };
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: stacked ? 'column' : 'row', gap: 10 }}>
        <FieldButton
          {...common}
          side={from}
          inRow={!stacked}
          onPress={fromState.toggle}
        />
        <FieldButton
          {...common}
          side={to}
          inRow={!stacked}
          onPress={toState.toggle}
        />
      </View>
      {children}
      <Calendar side={from} state={fromState} />
      <Calendar side={to} state={toState} />
    </View>
  );
}
