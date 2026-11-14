// ─────────────────────────────────────────────────────────────────────────────
// Shared building blocks for "What you already hold" (japa#234).
//
//   useCountryNames()   code → country name, from GET /countries (no names in code)
//   TextLink            coral-dark text action (decision 5: AA contrast)
//   Caption             `label` text in ink-muted
//   RemoveButton        44x44 touch target with a 18px X; spinner while saving
//   HoldingRow          Card row: leading visual, name, optional sub, trailing slot
//   SheetFrame          full-screen "sheet": grabber, close button, display title
//   CountryPickerList   searchable country list used by onboarding AND the picker
//
// Pressables get STATIC style objects (the function form renders unstyled under
// NativeWind css-interop, see PressableStatic).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  View,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { Flag } from '@/components/explorer/primitives';
import { InlineError } from '@/components/explorer/AccountForm';
import {
  StateError,
  StateLoading,
  loadErrorCopy,
  queryState,
} from '@/components/explorer/states';
import { useCountries } from '@/hooks/useCountries';
import { HOLDINGS_COPY } from '@/components/explorer/holdingsLogic';

// ── Country names from the app's own country data ────────────────────────────
export function useCountryNames() {
  const q = useCountries(true);
  const map = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of q.data ?? []) m.set(c.code.toUpperCase(), c.name);
    return m;
  }, [q.data]);
  /** Name for a code, or undefined while loading / unknown (never a raw code). */
  const nameOf = (code?: string | null) =>
    code ? map.get(code.toUpperCase()) : undefined;
  return { nameOf, query: q };
}

// ── Text link (coral-dark, 600) ──────────────────────────────────────────────
export function TextLink({
  label,
  onPress,
  disabled,
  icon: IconCmp,
  size = 15,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: React.ElementType;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minHeight: 44,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {IconCmp ? (
        <IconCmp size={18} color={EX.color.primaryDark} strokeWidth={2} />
      ) : null}
      <Text
        style={{
          fontSize: size,
          fontWeight: '600',
          color: EX.color.primaryDark,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ── Caption: `label` 12.5/600 in ink-muted ───────────────────────────────────
export function Caption({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      <Text
        style={{
          fontSize: 12.5,
          fontWeight: '600',
          lineHeight: 18,
          color: EX.color.inkMuted,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

// ── Expired pill: the system's error pair (fg on bg) + dot + the word ────────
export function ExpiredPill() {
  const fg = '#C0453C';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        backgroundColor: '#FBE3E1',
        borderRadius: 999,
        paddingHorizontal: 9,
        paddingVertical: 4,
      }}
    >
      <View
        style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fg }}
      />
      <Text style={{ color: fg, fontWeight: '700', fontSize: 12 }}>
        Expired
      </Text>
    </View>
  );
}

// ── Remove X (44x44) with a coral spinner while its save runs ────────────────
export function RemoveButton({
  label,
  busy,
  disabled,
  onPress,
}: {
  label: string;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled && !busy ? 0.6 : 1,
      }}
    >
      {busy ? (
        <ActivityIndicator size="small" color={EX.color.primary} />
      ) : (
        <Ic.x size={18} color={EX.color.muted} strokeWidth={1.8} />
      )}
    </Pressable>
  );
}

// ── HoldingRow: leading visual + text + trailing slot, hairline divider ──────
export function HoldingRow({
  leading,
  title,
  sub,
  subColor = EX.color.inkMuted,
  note,
  trailing,
  divider = false,
  onPress,
  disabled,
  paddingV = 8,
}: {
  leading: React.ReactNode;
  title: string;
  sub?: string;
  subColor?: string;
  note?: string;
  trailing?: React.ReactNode;
  divider?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  paddingV?: number;
}) {
  const body = (
    <>
      {leading}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 15, fontWeight: '600', color: EX.color.ink }}
        >
          {title}
        </Text>
        {sub ? (
          <Text
            style={{
              fontSize: 13.5,
              lineHeight: 19,
              color: subColor,
              marginTop: 2,
            }}
          >
            {sub}
          </Text>
        ) : null}
        {note ? (
          <Text
            numberOfLines={2}
            style={{
              fontSize: 13.5,
              lineHeight: 19,
              color: EX.color.inkMuted,
              marginTop: 2,
            }}
          >
            {note}
          </Text>
        ) : null}
      </View>
      {trailing}
    </>
  );
  const rowStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: paddingV,
    paddingLeft: 16,
    paddingRight: 4,
    borderTopWidth: divider ? 1 : 0,
    borderTopColor: EX.color.line06,
  };
  return onPress ? (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={rowStyle}
    >
      {body}
    </Pressable>
  ) : (
    <View style={rowStyle}>{body}</View>
  );
}

// ── SheetFrame: grabber + close button + display title; content scrolls ──────
// A full-screen route shown with `slide_from_bottom`, so it reads as a sheet.
export function SheetFrame({
  title,
  onClose,
  headerRight,
  children,
}: {
  title: string;
  onClose: () => void;
  /** Optional text action at the top right, next to the close button. */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      {/* 40x4 grabber, centred */}
      <View
        style={{ alignItems: 'center', paddingTop: Math.max(insets.top, 10) }}
      >
        <View
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: EX.color.line12,
          }}
        />
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: 8,
        }}
      >
        <Text style={[displayText(24, 'semibold'), { flex: 1 }]}>{title}</Text>
        {headerRight}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: EX.color.line10,
            backgroundColor: EX.color.cardWhite,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ic.x size={18} color={EX.color.ink} strokeWidth={1.8} />
        </Pressable>
      </View>
      {children}
    </View>
  );
}

// ── CountryPickerList ────────────────────────────────────────────────────────
// Pill search + rows (Flag 28, name, coral check). One component for the
// multi-select onboarding step and the single-select picker sheet.
export function CountryPickerList({
  selected,
  onPick,
  disabledCodes = [],
  disabledSub,
  busyCode = null,
  capped = false,
  disabled = false,
  errorMessage,
  belowSearch,
  footer,
  contentBottom = 20,
}: {
  /** Uppercase ISO2 codes shown as chosen. */
  selected: string[];
  onPick: (codeUpper: string) => void;
  /** Rows that cannot be picked (already added), shown with `disabledSub`. */
  disabledCodes?: string[];
  disabledSub?: string;
  /** Row showing its own spinner (its save is running). */
  busyCode?: string | null;
  /** At the cap: unchosen rows fall to 60% and ignore taps. */
  capped?: boolean;
  /** Everything ignores taps (a save is running, or offline). */
  disabled?: boolean;
  errorMessage?: string | null;
  belowSearch?: React.ReactNode;
  footer?: React.ReactNode;
  contentBottom?: number;
}) {
  const [query, setQuery] = useState('');
  const countriesQ = useCountries(true);
  const state = queryState(countriesQ);

  const countries = useMemo(
    () =>
      (countriesQ.data ?? [])
        .map((c) => ({ code: c.code.toUpperCase(), name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [countriesQ.data],
  );
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? countries.filter((c) => c.name.toLowerCase().includes(q))
      : countries;
  }, [query, countries]);

  return (
    <View style={{ flex: 1 }}>
      {/* Pill search */}
      <View style={{ paddingHorizontal: EX.space.screenX, paddingBottom: 8 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
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
            placeholder={HOLDINGS_COPY.searchCountries}
            placeholderTextColor={EX.color.muted}
            autoCorrect={false}
            accessibilityLabel={HOLDINGS_COPY.searchCountries}
            style={{
              flex: 1,
              fontSize: 15,
              color: EX.color.ink,
              paddingVertical: 0,
            }}
          />
        </View>
        {belowSearch}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: EX.space.screenX,
          paddingTop: 4,
          paddingBottom: contentBottom,
          gap: 8,
        }}
      >
        {errorMessage ? <InlineError message={errorMessage} /> : null}
        {state === 'loading' ? (
          <StateLoading section />
        ) : state === 'error' ? (
          <StateError
            section
            message={loadErrorCopy('countries')}
            onRetry={() => countriesQ.refetch()}
            retrying={countriesQ.isRefetching}
          />
        ) : results.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 40, gap: 10 }}>
            <Ic.globe
              size={34}
              color={EX.color.muted}
              strokeWidth={1.8}
              style={{ opacity: 0.5 }}
            />
            <Text style={{ fontSize: 14, color: EX.color.inkMuted }}>
              No countries match “{query.trim()}”
            </Text>
          </View>
        ) : (
          results.map((c) => {
            const on = selected.includes(c.code);
            const already = disabledCodes.includes(c.code);
            const busy = busyCode === c.code;
            // Faded when capped (and not chosen) or while another save runs.
            const blocked =
              already || disabled || (capped && !on) || (!!busyCode && !busy);
            const faded = (capped && !on && !already) || (!!busyCode && !busy);
            return (
              <Pressable
                key={c.code}
                onPress={() => onPick(c.code)}
                disabled={blocked}
                accessibilityRole="button"
                accessibilityLabel={c.name}
                accessibilityState={{
                  selected: on || already,
                  disabled: blocked,
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 13,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 16,
                  borderWidth: on || already ? 1.5 : 1,
                  borderColor:
                    on || already ? EX.color.primary : EX.color.line08,
                  backgroundColor:
                    on || already ? EX.color.primaryTint07 : EX.color.cardWhite,
                  opacity: faded ? 0.6 : 1,
                }}
              >
                <Flag code={c.code.toLowerCase()} size={28} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 15,
                      fontWeight: '600',
                      color: EX.color.ink,
                    }}
                  >
                    {c.name}
                  </Text>
                  {already && disabledSub ? (
                    <Text style={{ fontSize: 13, color: EX.color.inkMuted }}>
                      {disabledSub}
                    </Text>
                  ) : null}
                </View>
                {busy ? (
                  <ActivityIndicator size="small" color={EX.color.primary} />
                ) : on || already ? (
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
        {footer}
      </ScrollView>
    </View>
  );
}
