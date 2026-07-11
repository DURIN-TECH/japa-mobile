// ─────────────────────────────────────────────────────────────────────────────
// Japa / Seli Destination Explorer — immersive AUTH shell + form primitives
//
// Faithful RN port of the prototype's `auth.jsx` shared pieces:
//   • AuthShell   — full-bleed photo background + dark scrim + glass back button
//                   and a bottom-aligned scroll body (title / sub / children).
//   • Field       — dark "glass" text input (BlurView row, translucent white fill,
//                   leading icon, optional right slot).
//   • Provider    — glass social button (Google / Apple SVG glyph + label).
//   • CoralButton — the coral primary CTA used on every auth screen (kept here so
//                   login/register/otp/forgot don't each re-declare it).
//
// Everything is native primitives only: expo-image, expo-blur, expo-linear-
// gradient, react-native-svg. Coral is EX.color.primary (#F4516C); the pink link
// accent used by the screens is #FF9AAC. Because every screen that embeds a text
// input renders through AuthShell, the KeyboardAvoidingView lives here once.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { EX, EXShadow, displayText } from './theme';
import { ONBOARD } from './data';
import { Ic } from './icons';
import { GlassButton } from './primitives';

// Lucide-style icon component signature (used for Field's leading glyph).
type IconType = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

// The pink link/kicker accent (Forgot password?, Resend code, kicker text).
export const PINK = '#FF9AAC';

// ── AuthShell ────────────────────────────────────────────────────────────────
// Photo-backed dark shell. Renders ONBOARD[0].img full-bleed (scaled 1.1), a
// dark to-top gradient scrim, a floating glass back button at the top-left, then
// a bottom-aligned scrolling body with the title + sub + the screen's form.
export function AuthShell({
  title,
  sub,
  children,
  onBack,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
  onBack?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    // Root: dark fallback tone behind the photo (source used #1A1420).
    <View style={{ flex: 1, backgroundColor: '#1A1420' }}>
      {/* Full-bleed hero photo, scaled 1.1 (source transform: scale(1.1)). */}
      <Image
        source={{ uri: ONBOARD[0].img }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          transform: [{ scale: 1.1 }],
        }}
        contentFit="cover"
        transition={200}
      />
      {/* Dark scrim → darkest at the bottom where the form sits.
          Source: linear-gradient(to top, rgba(10,8,12,.96) 30%, .72 70%, .6 100%). */}
      <LinearGradient
        colors={[
          'rgba(10,8,12,0.96)',
          'rgba(10,8,12,0.96)',
          'rgba(10,8,12,0.72)',
          'rgba(10,8,12,0.6)',
        ]}
        locations={[0, 0.3, 0.7, 1]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Floating glass back button, top-left at insets.top + 6 (source top:54,left:18). */}
      <GlassButton
        icon={Ic.chevL}
        onPress={onBack ?? (() => router.back())}
        style={{
          position: 'absolute',
          top: insets.top + 6,
          left: 18,
          zIndex: 10,
        }}
      />

      {/* Keyboard-aware bottom-aligned body. Every input-bearing auth screen goes
          through here, so the KeyboardAvoidingView is declared once. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'flex-end', // bottom-align (source: justifyContent flex-end)
            paddingTop: insets.top + 90, // clear the back button; source padding 120 top
            paddingHorizontal: 24,
            paddingBottom: Math.max(insets.bottom, 16) + 24, // source 40
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title — displayText(32,'semibold') forced white. */}
          <Text
            style={[
              displayText(32, 'semibold'),
              { color: '#fff', lineHeight: 34 },
            ]}
          >
            {title}
          </Text>
          {/* Sub — 15 / rgba(255,255,255,0.72), 10 top / 26 bottom (source). */}
          <Text
            style={{
              marginTop: 10,
              marginBottom: 26,
              fontSize: 15,
              lineHeight: 22.5,
              color: 'rgba(255,255,255,0.72)',
            }}
          >
            {sub}
          </Text>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Field ────────────────────────────────────────────────────────────────────
// Dark glass text input. Label (12.5/600) above a BlurView row that holds the
// leading icon, the TextInput (white, 15) and an optional right slot (Show/Hide).
// Focus lightens the fill (0.08 → 0.16) and the border (0.16 → 0.55).
export function Field({
  icon: IconCmp,
  label,
  value,
  onChangeText,
  placeholder,
  right,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  autoComplete,
}: {
  icon: IconType;
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  right?: React.ReactNode;
  secureTextEntry?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
}) {
  const [focus, setFocus] = useState(false);
  return (
    <View>
      {/* Field label. */}
      <Text
        style={{
          fontSize: 12.5,
          fontWeight: '600',
          color: 'rgba(255,255,255,0.72)',
          marginBottom: 7,
        }}
      >
        {label}
      </Text>
      {/* Glass input row (BlurView over the imagery). */}
      <BlurView
        intensity={20}
        tint="dark"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 11,
          paddingHorizontal: 15,
          borderRadius: 15,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: focus
            ? 'rgba(255,255,255,0.55)'
            : 'rgba(255,255,255,0.16)',
          backgroundColor: focus
            ? 'rgba(255,255,255,0.16)'
            : 'rgba(255,255,255,0.08)',
        }}
      >
        <IconCmp size={19} color="rgba(255,255,255,0.6)" strokeWidth={1.8} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.4)"
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          style={{
            flex: 1,
            minWidth: 0,
            color: '#fff',
            fontSize: 15,
            paddingVertical: 15,
          }}
        />
        {right}
      </BlurView>
    </View>
  );
}

// ── Provider glyphs (react-native-svg, exact source paths) ───────────────────
function GoogleG() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        fill="#fff"
        d="M12 11v3.2h4.5c-.2 1.2-1.5 3.4-4.5 3.4a5 5 0 1 1 0-10c1.4 0 2.4.6 3 1.1l2.1-2A8 8 0 1 0 12 20c4.6 0 7.7-3.2 7.7-7.8 0-.5 0-.9-.1-1.2H12z"
      />
    </Svg>
  );
}
function AppleG() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24">
      <Path
        fill="#fff"
        d="M16 13c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.9-1.4-.1-2.8.9-3.5.9s-1.8-.8-3-.8C6.5 7.7 5 8.6 4.2 10c-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.7 2.5 3 2.4 1.2 0 1.6-.8 3.1-.8s1.9.8 3.1.7c1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.5-1-2.5-3.8-.1-.2-.3-.3-.3-.3zM14.3 5.9c.7-.8 1.1-2 1-3.1-1 0-2.1.6-2.8 1.4-.6.7-1.1 1.8-1 2.9 1.1.1 2.2-.5 2.8-1.2z"
      />
    </Svg>
  );
}

// ── Provider ─────────────────────────────────────────────────────────────────
// Glass social button (height 50, radius 14) with a Google/Apple glyph + label.
export function Provider({
  label,
  glyph,
  onPress,
}: {
  label: string;
  glyph: 'google' | 'apple';
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <BlurView
        intensity={18}
        tint="dark"
        style={{
          height: 50,
          borderRadius: 14,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.18)',
          backgroundColor: 'rgba(255,255,255,0.1)',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {glyph === 'google' ? <GoogleG /> : <AppleG />}
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
          {label}
        </Text>
      </BlurView>
    </Pressable>
  );
}

// ── CoralButton ──────────────────────────────────────────────────────────────
// The coral primary CTA shared across login/register/otp/forgot. Disabled state
// (OTP before 4 digits) dims to translucent white — matches the source exactly.
export function CoralButton({
  label,
  onPress,
  disabled = false,
  withArrow = true,
  style,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  withArrow?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={[
        {
          height: 55,
          borderRadius: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: disabled
            ? 'rgba(255,255,255,0.14)'
            : EX.color.primary,
        },
        // Coral glow only when enabled.
        disabled ? null : EXShadow.primaryBtn,
        style,
      ]}
    >
      <Text
        style={{
          color: disabled ? 'rgba(255,255,255,0.5)' : '#fff',
          fontSize: 16,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
      {withArrow ? (
        <Ic.arrow
          size={18}
          color={disabled ? 'rgba(255,255,255,0.5)' : '#fff'}
          strokeWidth={1.8}
        />
      ) : null}
    </Pressable>
  );
}
