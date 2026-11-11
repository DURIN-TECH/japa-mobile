// ─────────────────────────────────────────────────────────────────────────────
// CenteredState — full-screen not-found / load-error state (japa#106).
//
// The EmptyState pattern (saved.tsx: icon 40 muted at 50%, title 15/600 ink,
// body 13/19 ink-muted, a button) centred on `bg`, with the back GlassButton
// top-left so the user is never stuck. Used by the visa breakdown
// (`/visa/[id]`) and the case view (`/application/[id]`):
//   • for the backend 404, whose copy must not confirm the item exists
//     (the same message for an unknown and a hidden visa);
//   • with `onRetry` + `errorMessage`, for a network / server failure with
//     nothing cached (InlineError + a coral "Try again" link).
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX } from './theme';
import { Ic } from './icons';
import { GlassButton } from './primitives';
import { InlineError } from './AccountForm';

export function CenteredState({
  icon: Icon,
  title,
  body,
  actionLabel,
  onAction,
  onRetry,
  retrying,
  errorMessage,
}: {
  /** The EmptyState icon (40, muted, 50%), e.g. Ic.globe or Ic.docs. */
  icon: React.ComponentType<{
    size?: number;
    color?: string;
    strokeWidth?: number;
    style?: StyleProp<ViewStyle>;
  }>;
  title: string;
  /** One line under the title; omitted when empty. */
  body?: string;
  /** Secondary button, e.g. "Back to explore". */
  actionLabel: string;
  onAction: () => void;
  /** When set, a coral "Try again" link (load errors only). */
  onRetry?: () => void;
  retrying?: boolean;
  /** InlineError above the retry link (load errors only). */
  errorMessage?: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      <View
        style={{
          position: 'absolute',
          top: insets.top + 6,
          left: 18,
          zIndex: 50,
        }}
      >
        <GlassButton icon={Ic.chevL} onPress={() => router.back()} />
      </View>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 40,
          gap: 12,
        }}
      >
        <Icon
          size={40}
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
        {errorMessage ? (
          <View style={{ alignSelf: 'stretch' }}>
            <InlineError message={errorMessage} />
          </View>
        ) : null}
        {onRetry ? (
          retrying ? (
            <ActivityIndicator color={EX.color.primary} />
          ) : (
            <Pressable onPress={onRetry} accessibilityRole="button">
              <Text
                style={{
                  fontSize: 13.5,
                  fontWeight: '600',
                  color: EX.color.primary,
                }}
              >
                Try again
              </Text>
            </Pressable>
          )
        ) : null}
        {/* Secondary button: white, line08 border, ink label. */}
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={({ pressed }) => ({
            marginTop: 6,
            backgroundColor: EX.color.cardWhite,
            borderWidth: 1,
            borderColor: EX.color.line08,
            borderRadius: EX.radius.button,
            paddingHorizontal: 20,
            paddingVertical: 12,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text
            style={{ color: EX.color.ink, fontSize: 14, fontWeight: '700' }}
          >
            {actionLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
