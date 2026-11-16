// ─────────────────────────────────────────────────────────────────────────────
// Seli Destination Explorer — shared primitives
//
// Native re-implementations of the prototype's kit.jsx / shell.jsx components,
// plus a few widgets used across multiple screens (StatusPill, Progress, Tile).
// Everything uses proper RN primitives: expo-image, expo-blur, expo-linear-
// gradient, react-native-svg and react-native-reanimated — no web elements.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  Text,
  TextStyle,
  View,
  ViewStyle,
  type AccessibilityState,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { EX, EXScrim, displayText } from './theme';
import { STATUS } from './content';
// Flag art comes from the reusable country assets module (japa#145).
import { Ic } from './icons';
import { PressableStatic } from './PressableStatic';
import { countryFlag } from '@/assets/countries';
// japa#146: GlassButton's press feedback (function-style style, safely).

// ── Flag — round flag image (flagcdn), matches native app ────────────────────
export function Flag({
  code,
  size = 28,
  radius,
  style,
}: {
  code: string;
  size?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius ?? size / 2,
          overflow: 'hidden',
          backgroundColor: EX.color.flagBg,
          borderWidth: 1,
          borderColor: 'rgba(0,0,0,0.06)',
        },
        style,
      ]}
    >
      <Image
        source={{ uri: countryFlag(code) }}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
      />
    </View>
  );
}

// ── Portrait — procedural gradient avatar with initials ──────────────────────
const PORTRAIT_G: [string, string][] = [
  ['#FFD7C2', '#E2603F'],
  ['#CFE8E2', '#1F6E63'],
  ['#FBE7B0', '#C98A22'],
  ['#D9CDF5', '#7B5CD6'],
  ['#CDE6F2', '#3C7DA8'],
  ['#F6D6E2', '#C25C84'],
];
export function Portrait({
  seed = 0,
  size = 44,
  name = 'A B',
  style,
}: {
  seed?: number;
  size?: number;
  name?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const g = PORTRAIT_G[seed % PORTRAIT_G.length];
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');
  return (
    <LinearGradient
      colors={g}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: '#fff',
          fontWeight: '700',
          fontSize: size * 0.36,
          letterSpacing: 0.4,
          textShadowColor: 'rgba(0,0,0,0.22)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 2,
        }}
      >
        {initials}
      </Text>
    </LinearGradient>
  );
}

// ── Verified — teal check badge ──────────────────────────────────────────────
export function Verified({ size = 16 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: EX.color.teal,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ic.check size={size * 0.66} color="#fff" strokeWidth={3.2} />
    </View>
  );
}

// ── Stars — 5-star rating row ────────────────────────────────────────────────
export function Stars({ r, size = 13 }: { r: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1.5 }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const on = i < Math.round(r);
        return (
          <Ic.star
            key={i}
            size={size}
            color={on ? EX.color.gold : 'rgba(23,19,38,0.14)'}
            fill={on ? EX.color.gold : 'rgba(23,19,38,0.14)'}
            strokeWidth={0}
          />
        );
      })}
    </View>
  );
}

// ── SectionTitle — heading + optional trailing action link ───────────────────
export function SectionTitle({
  children,
  action,
  onAction,
  style,
}: {
  children: React.ReactNode;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginTop: 26,
          marginBottom: 13,
          marginHorizontal: 2,
        },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: 18,
          fontWeight: '700',
          color: EX.color.ink,
          letterSpacing: -0.18,
        }}
      >
        {children}
      </Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text
            style={{
              color: EX.color.primary,
              fontSize: 13.5,
              fontWeight: '600',
            }}
          >
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ── ScreenHeader — big root-tab title block ──────────────────────────────────
export function ScreenHeader({
  eyebrow,
  title,
  sub,
  right,
  topInset = 0,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  right?: React.ReactNode;
  topInset?: number;
}) {
  return (
    <View
      style={{
        paddingTop: topInset + 18,
        paddingHorizontal: EX.space.screenX,
        paddingBottom: 8,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flex: 1 }}>
          {eyebrow ? (
            <Text
              style={{
                fontSize: 12.5,
                color: EX.color.muted,
                fontWeight: '600',
                marginBottom: 3,
              }}
            >
              {eyebrow}
            </Text>
          ) : null}
          <Text style={displayText(29, 'semibold')}>{title}</Text>
          {sub ? (
            <Text
              style={{
                marginTop: 8,
                fontSize: 13.5,
                lineHeight: 19.5,
                color: EX.color.inkMuted,
                maxWidth: 280,
              }}
            >
              {sub}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );
}

// ── GlassButton — floating blurred circular control over imagery ─────────────
// japa#146 adds optional props (all off by default, so existing callers look
// and behave exactly as before):
//   iconFill   — passed to the icon's `fill` (the saved heart: coral)
//   loading    — small white spinner instead of the icon
//   dimmed     — icon at 60% opacity (the heart's "list failed" state)
//   disabled   — no press (and no press feedback)
//   accessibilityLabel / accessibilityState
// With an onPress it has role "button" and press feedback (the circle drops
// to 0.7 opacity while pressed); without one it is decorative, as before. Built on
// PressableStatic, because a function-style `style` on a plain Pressable
// renders unstyled in this build.
export function GlassButton({
  icon: IconCmp,
  onPress,
  style,
  iconFill,
  loading = false,
  dimmed = false,
  disabled = false,
  accessibilityLabel,
  accessibilityState,
}: {
  icon: React.ElementType;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  iconFill?: string;
  loading?: boolean;
  dimmed?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
}) {
  const interactive = !!onPress;
  return (
    <PressableStatic
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      // Only a button with a handler is announced as one and fades on
      // press; a decorative GlassButton (no onPress, e.g. the agency
      // screen's arrow) stays exactly as before.
      accessibilityRole={interactive ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={
        interactive ? { disabled, ...accessibilityState } : accessibilityState
      }
      style={({ pressed }) => [
        style,
        { opacity: pressed && interactive && !disabled ? 0.7 : 1 },
      ]}
    >
      <BlurView
        intensity={30}
        tint="dark"
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.34)',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(20,16,12,0.26)',
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <View style={{ opacity: dimmed ? 0.6 : 1 }}>
            <IconCmp
              size={21}
              color="#fff"
              strokeWidth={1.8}
              {...(iconFill ? { fill: iconFill } : null)}
            />
          </View>
        )}
      </BlurView>
    </PressableStatic>
  );
}

// ── GlassBar — reusable warm glass surface (headers, CTA bars) ────────────────
export function GlassBar({
  children,
  style,
  intensity = 26,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
}) {
  return (
    <BlurView
      intensity={intensity}
      tint="light"
      style={[
        { backgroundColor: EX.color.glassWarm, overflow: 'hidden' },
        style,
      ]}
    >
      {children}
    </BlurView>
  );
}

// ── StatusPill — colored dot + label from STATUS map ─────────────────────────
export function StatusPill({
  status,
  small = false,
}: {
  status: string;
  small?: boolean;
}) {
  const s = STATUS[status] ?? {
    label: status,
    fg: EX.color.muted,
    bg: EX.color.line06,
  };
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        backgroundColor: s.bg,
        borderRadius: 999,
        paddingHorizontal: small ? 9 : 11,
        paddingVertical: small ? 4 : 5,
      }}
    >
      <View
        style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: s.fg }}
      />
      <Text
        style={{ color: s.fg, fontWeight: '700', fontSize: small ? 11 : 12 }}
      >
        {s.label}
      </Text>
    </View>
  );
}

// ── Pill — generic tinted label pill (fg on bg) ──────────────────────────────
export function Pill({
  label,
  fg,
  bg,
  small = false,
  style,
}: {
  label: string;
  fg: string;
  bg: string;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: 999,
          paddingHorizontal: small ? 9 : 11,
          paddingVertical: small ? 4 : 5,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text style={{ color: fg, fontWeight: '700', fontSize: small ? 11 : 12 }}>
        {label}
      </Text>
    </View>
  );
}

// ── Progress — animated fill bar (width animates on mount / change) ───────────
export function Progress({
  value,
  color = EX.color.primary,
  height = 6,
  track = EX.color.track,
  style,
}: {
  value: number;
  color?: string;
  height?: number;
  track?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [w, setW] = useState(0);
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withTiming(Math.max(0, Math.min(1, value)) * w, {
      duration: 600,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
    });
  }, [value, w, fill]);
  const animStyle = useAnimatedStyle(() => ({ width: fill.value }));
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[
        {
          height,
          borderRadius: 999,
          backgroundColor: track,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          { height, borderRadius: 999, backgroundColor: color },
          animStyle,
        ]}
      />
    </View>
  );
}

// ── Chip — pill label (specialisation tags, etc.) ────────────────────────────
export function Chip({
  label,
  style,
  textStyle,
}: {
  label: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: EX.color.cream,
          borderRadius: 999,
          paddingHorizontal: 13,
          paddingVertical: 7,
          borderWidth: 1,
          borderColor: EX.color.line08,
        },
        style,
      ]}
    >
      <Text
        style={[
          { color: EX.color.ink2, fontWeight: '600', fontSize: 12.5 },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

// ── IconChip — rounded-square tinted icon container ──────────────────────────
export function IconChip({
  icon: IconCmp,
  size = 38,
  radius = 12,
  bg = EX.color.cream,
  color = EX.color.primary,
  iconSize,
}: {
  icon: React.ElementType;
  size?: number;
  radius?: number;
  bg?: string;
  color?: string;
  iconSize?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <IconCmp size={iconSize ?? size * 0.46} color={color} strokeWidth={1.8} />
    </View>
  );
}

// ── Card — white rounded surface with hairline + soft shadow ─────────────────
export function Card({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: EX.color.cardWhite,
          borderRadius: EX.radius.cardLg,
          borderWidth: 1,
          borderColor: EX.color.line06,
          padding: padded ? 15 : 0,
          shadowColor: '#171326',
          shadowOpacity: 0.04,
          shadowRadius: 2,
          shadowOffset: { width: 0, height: 1 },
          elevation: 1,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ── Scrim — photographic gradient overlay presets (absolute fill) ────────────
export function Scrim({
  variant = 'tile',
  diagonal = false,
  style,
}: {
  variant?: keyof typeof EXScrim;
  diagonal?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const s = EXScrim[variant];
  return (
    <LinearGradient
      colors={s.colors as unknown as [string, string, ...string[]]}
      locations={s.locations as unknown as [number, number, ...number[]]}
      // Tile/detail scrims go bottom→top; home hero is diagonal (120deg).
      start={diagonal ? { x: 0.1, y: 0 } : { x: 0.5, y: 1 }}
      end={diagonal ? { x: 0.9, y: 1 } : { x: 0.5, y: 0 }}
      style={[
        { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
        style,
      ]}
    />
  );
}
