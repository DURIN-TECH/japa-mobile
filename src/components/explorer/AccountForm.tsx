// ─────────────────────────────────────────────────────────────────────────────
// Explorer — shared account-management form primitives.
//
// Small building blocks reused by the account-security screens (change password,
// change email, delete account, verify email). They speak the LIGHT coral/cream
// design language (documents.tsx / verify-identity.tsx): a SafeArea-aware back
// header, a labelled white input card, a coral submit button with an inline
// spinner, an inline error line, and a soft info note. Keeping them here avoids
// re-implementing the same boilerplate on every screen.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { EX, displayText } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';

// ── BackHeader — 40px back chevron + display title (mirrors verify-identity.tsx) ─
export function BackHeader({
  title,
  subtitle,
  insets,
  onBack,
}: {
  title: string;
  subtitle?: string;
  insets: { top: number };
  onBack: () => void;
}) {
  return (
    <View
      style={{
        paddingTop: insets.top + 10,
        paddingHorizontal: 18,
        paddingBottom: 6,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable
          onPress={onBack}
          hitSlop={8}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: EX.color.line10,
            backgroundColor: '#fff',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ic.chevL size={21} color={EX.color.ink} strokeWidth={1.8} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={displayText(24, 'semibold')}>{title}</Text>
          {subtitle ? (
            <Text
              style={{ fontSize: 12.5, color: EX.color.muted, marginTop: 2 }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ── LabeledInput — a white input card with a muted label above the field ──────
// `right` lets a caller drop a control into the field row (e.g. a Show/Hide toggle
// for password fields). All standard TextInput props pass straight through.
export function LabeledInput({
  label,
  right,
  style,
  ...inputProps
}: {
  label: string;
  right?: React.ReactNode;
} & TextInputProps) {
  return (
    <View
      style={{
        backgroundColor: EX.color.cardWhite,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: EX.color.line10,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 14,
        shadowColor: '#171326',
        shadowOpacity: 0.04,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
    >
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <TextInput
          placeholderTextColor={EX.color.faint}
          autoCorrect={false}
          style={[
            {
              flex: 1,
              fontSize: 16.5,
              fontWeight: '600',
              color: EX.color.ink,
              paddingVertical: 0,
            },
            style,
          ]}
          {...inputProps}
        />
        {right}
      </View>
    </View>
  );
}

// ── CoralSubmit — the primary coral CTA with an inline spinner while busy ──────
// `danger` swaps the coral fill for the destructive red used by delete flows.
export function CoralSubmit({
  label,
  onPress,
  loading = false,
  disabled = false,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  const bg = danger ? EX.color.danger : EX.color.primary;
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={{
        height: 54,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        opacity: isDisabled ? 0.6 : 1,
        shadowColor: bg,
        shadowOpacity: 0.45,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
        elevation: 6,
      }}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '700' }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// ── InlineError — small danger text shown above the CTA (null when no error) ──
export function InlineError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 8,
        backgroundColor: '#FBE3E1',
        borderWidth: 1,
        borderColor: 'rgba(217,66,91,0.24)',
        borderRadius: 14,
        padding: 12,
      }}
    >
      <Ic.x size={16} color={EX.color.danger} strokeWidth={2.4} />
      <Text
        style={{
          flex: 1,
          fontSize: 13,
          lineHeight: 18,
          fontWeight: '600',
          color: '#C0453C',
        }}
      >
        {message}
      </Text>
    </View>
  );
}

// ── InfoNote — soft cream panel for reassurance / "what happens next" copy ────
export function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 10,
        backgroundColor: EX.color.cream,
        borderWidth: 1,
        borderColor: EX.color.line08,
        borderRadius: 16,
        padding: 14,
      }}
    >
      <Ic.shield size={17} color={EX.color.primary} strokeWidth={1.9} />
      <Text
        style={{ flex: 1, fontSize: 13, lineHeight: 19, color: EX.color.ink2 }}
      >
        {children}
      </Text>
    </View>
  );
}
