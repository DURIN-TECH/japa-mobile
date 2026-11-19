// ─────────────────────────────────────────────────────────────────────────────
// Loading / empty / error states — the one shared set (japa#145).
//
// Once the demo fixtures went, every data screen needed the same three states
// instead of fake rows. The #145 design spec (section 1) defines them once;
// these components are that definition, built from existing tokens only:
//
//   <StateLoading section? />
//       Coral ActivityIndicator. Full screen: centred in the content area.
//       Section: small, paddingVertical 24, where the rows would be.
//       Show it ONLY for a first load with nothing cached (`isLoading`).
//
//   <StateEmpty icon title body? action? section? />
//       The EmptyState pattern: muted icon at 50% (40px full, 38px section),
//       title 15/600 ink, optional body 13/19 ink-MUTED (never `muted`: it
//       fails contrast on bg), optional action button. A `coral` action is
//       the screen's one coral CTA; use `outline` where the screen already
//       has a coral CTA, and always in sections.
//
//   <StateError message onRetry retrying? section? />
//       InlineError stretched to the content width, then an Outline
//       "Try again" button that calls `refetch()`. While refetching, the
//       coral spinner replaces the button. Full screen: centred button;
//       section: left-aligned.
//
//   <OutlineButton /> / <CoralButton />
//       The two button looks the states use, exported for screens that need
//       the same look elsewhere (e.g. CenteredState's back action).
//
// The spec proposed `primitives.tsx` as the home; they live in their own file
// because they depend on `InlineError` (AccountForm.tsx), and importing that
// into primitives.tsx would create an import cycle (CenteredState → primitives).
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  ActivityIndicator,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { EX, EXShadow } from './theme';
import { InlineError } from './AccountForm';
import { PressableStatic } from '@/components/explorer/PressableStatic';

/** Any lucide / `Ic` icon component. */
export type StateIcon = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}>;

/** Copy for the shared "Try again" retry button. */
export const RETRY_LABEL = 'Try again';

/**
 * The spec's error copy template:
 * "We couldn’t load {things}. Check your connection and try again."
 */
export function loadErrorCopy(things: string): string {
  return `We couldn’t load ${things}. Check your connection and try again.`;
}

// ── Buttons ──────────────────────────────────────────────────────────────────

/**
 * Outline button: `surface` (white) fill, 1px line-10 border, 15/700 ink
 * label, radius-button. The secondary action everywhere in the states.
 */
export function OutlineButton({
  label,
  onPress,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <PressableStatic
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          backgroundColor: EX.color.cardWhite,
          borderWidth: 1,
          borderColor: EX.color.line10,
          borderRadius: EX.radius.button,
          paddingHorizontal: 20,
          paddingVertical: 12,
          alignItems: 'center',
          opacity: disabled ? 0.6 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Text style={{ color: EX.color.ink, fontSize: 15, fontWeight: '700' }}>
        {label}
      </Text>
    </PressableStatic>
  );
}

/**
 * Coral button: 46px tall, paddingHorizontal 20, radius-button, coral shadow,
 * cta-label 15.5/700 white. White on coral is the system's own pair (3.37:1,
 * flagged in the README); it's only used at this label size.
 */
export function CoralButton({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <PressableStatic
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          height: 46,
          paddingHorizontal: 20,
          borderRadius: EX.radius.button,
          backgroundColor: EX.color.primary,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.85 : 1,
        },
        EXShadow.primaryBtn,
        style,
      ]}
    >
      <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '700' }}>
        {label}
      </Text>
    </PressableStatic>
  );
}

// ── Loading ──────────────────────────────────────────────────────────────────

/** Coral spinner; `section` = small, inline where a section's rows go. */
export function StateLoading({
  section = false,
  style,
}: {
  section?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      accessibilityLabel="Loading"
      style={[
        section
          ? { paddingVertical: 24, alignItems: 'center' }
          : {
              flex: 1,
              minHeight: 200,
              alignItems: 'center',
              justifyContent: 'center',
            },
        style,
      ]}
    >
      <ActivityIndicator
        size={section ? 'small' : 'large'}
        color={EX.color.primary}
      />
    </View>
  );
}

// ── Empty ────────────────────────────────────────────────────────────────────

/** Optional action under an empty state. */
export interface StateAction {
  label: string;
  onPress: () => void;
  /** 'coral' = the screen's one coral CTA; 'outline' otherwise. */
  variant?: 'coral' | 'outline';
}

/**
 * Icon + one line (+ optional body and action). `section` renders the
 * compact form (paddingVertical 24, 38px icon) for a block inside a screen;
 * wrap it in a `Card` where the section's rows normally sit in one.
 */
export function StateEmpty({
  icon: Icon,
  title,
  body,
  action,
  section = false,
  style,
}: {
  icon: StateIcon;
  title: string;
  body?: string;
  action?: StateAction;
  section?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: section ? 24 : 48,
          paddingHorizontal: section ? 20 : 40,
          gap: 12,
        },
        style,
      ]}
    >
      <Icon
        size={section ? 38 : 40}
        color={EX.color.muted}
        strokeWidth={1.8}
        style={{ opacity: 0.5 }}
      />
      <Text
        style={{
          fontSize: 15,
          fontWeight: '600',
          color: EX.color.ink,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      {body ? (
        <Text
          // ≤ 2 lines at 320pt per the spec; long copy still wraps.
          style={{
            fontSize: 13,
            lineHeight: 19,
            color: EX.color.inkMuted,
            textAlign: 'center',
          }}
        >
          {body}
        </Text>
      ) : null}
      {action ? (
        // Sections always use the outline look (spec 1.2).
        action.variant === 'coral' && !section ? (
          <CoralButton
            label={action.label}
            onPress={action.onPress}
            style={{ marginTop: 6 }}
          />
        ) : (
          <OutlineButton
            label={action.label}
            onPress={action.onPress}
            style={{ marginTop: 6 }}
          />
        )
      ) : null}
    </View>
  );
}

// ── Error ────────────────────────────────────────────────────────────────────

/**
 * Load failed with nothing cached: InlineError + Outline "Try again".
 * Never render rows (cached or fabricated) next to it.
 */
export function StateError({
  message,
  onRetry,
  retrying = false,
  section = false,
  style,
}: {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
  section?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        section
          ? { paddingVertical: 4 }
          : { paddingHorizontal: EX.space.screenX, paddingTop: 16 },
        style,
      ]}
    >
      <InlineError message={message} />
      <View
        style={{
          marginTop: 10,
          alignSelf: section ? 'flex-start' : 'center',
          minHeight: 46,
          justifyContent: 'center',
        }}
      >
        {retrying ? (
          <ActivityIndicator color={EX.color.primary} />
        ) : (
          <OutlineButton label={RETRY_LABEL} onPress={onRetry} />
        )}
      </View>
    </View>
  );
}

// ── Query helpers ────────────────────────────────────────────────────────────

/**
 * Which state a React Query result is in, per spec section 1:
 *   • 'loading' — first load, nothing cached (never show empty while loading)
 *   • 'error'   — failed with nothing cached
 *   • 'ready'   — data present (a background refetch stays silent)
 * Pure so screens can share one rule.
 */
export function queryState(q: {
  isLoading: boolean;
  isError: boolean;
  data: unknown;
}): 'loading' | 'error' | 'ready' {
  if (q.data !== undefined) return 'ready';
  if (q.isLoading) return 'loading';
  if (q.isError) return 'error';
  return 'ready';
}
