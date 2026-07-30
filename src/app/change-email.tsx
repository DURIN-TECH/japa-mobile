// ─────────────────────────────────────────────────────────────────────────────
// Change email (Explorer, account security).
//
// Shows the current account email (read-only), then collects the new email + the
// current password (to reauthenticate). On submit the store reauthenticates and
// the backend starts a verification-gated change: it emails a branded confirm
// link to the NEW address and a security heads-up to the OLD one. The email only
// actually changes once the user clicks the link in their new inbox — so success
// here means "confirmation sent", not "email changed".
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX } from '@/components/explorer/theme';
import {
  BackHeader,
  CoralSubmit,
  InfoNote,
  InlineError,
  LabeledInput,
} from '@/components/explorer/AccountForm';
import { useAuthStore } from '@/stores/auth.store';

// Basic email shape check (same posture as the register screen).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ChangeEmailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const changeEmail = useAuthStore((s) => s.changeEmail);
  const isLoading = useAuthStore((s) => s.isLoading);
  // Current email comes from the Firebase user (authoritative) with a profile
  // fallback, shown read-only for context.
  const currentEmail = useAuthStore(
    (s) => s.user?.email ?? s.profile?.email ?? '',
  );

  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    const target = newEmail.trim().toLowerCase();

    if (!target || !password) {
      setError('Enter your new email and current password.');
      return;
    }
    if (!EMAIL_RE.test(target)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (target === currentEmail.toLowerCase()) {
      setError('That’s already your email address.');
      return;
    }

    const ok = await changeEmail(password, target);
    if (!ok) {
      setError(
        useAuthStore.getState().error ?? 'Couldn’t start the email change.',
      );
      return;
    }
    Alert.alert(
      'Confirm your new email',
      `We’ve sent a confirmation link to ${target}. Your email changes once you tap it. Your current email stays active until then.`,
      [{ text: 'Got it', onPress: () => router.back() }],
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: EX.color.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <BackHeader
        title="Change email"
        subtitle="Update the email tied to your account"
        insets={insets}
        onBack={() => router.back()}
      />

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: EX.space.screenX,
          paddingTop: 14,
          paddingBottom: 28,
          gap: 14,
        }}
      >
        {/* Current email — read-only context row. */}
        {currentEmail ? (
          <View
            style={{
              backgroundColor: EX.color.cream,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: EX.color.line08,
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          >
            <Text
              style={{
                fontSize: 12.5,
                fontWeight: '600',
                color: EX.color.muted,
                marginBottom: 2,
              }}
            >
              Current email
            </Text>
            <Text
              style={{ fontSize: 15, fontWeight: '600', color: EX.color.ink }}
            >
              {currentEmail}
            </Text>
          </View>
        ) : null}

        <LabeledInput
          label="New email"
          value={newEmail}
          onChangeText={setNewEmail}
          placeholder="you@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <LabeledInput
          label="Current password"
          value={password}
          onChangeText={setPassword}
          placeholder="Confirm it’s you"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
        />

        <InlineError message={error} />

        <InfoNote>
          We’ll send a confirmation link to your new email and a security alert
          to your current one. The change takes effect only after you confirm
          from the new inbox.
        </InfoNote>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: EX.space.screenX,
          paddingBottom: Math.max(insets.bottom, 16) + 6,
          paddingTop: 8,
        }}
      >
        <CoralSubmit
          label="Send confirmation"
          onPress={onSubmit}
          loading={isLoading}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
