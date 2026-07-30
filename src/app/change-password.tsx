// ─────────────────────────────────────────────────────────────────────────────
// Change password (Explorer, account security).
//
// Collects the current password (to reauthenticate) plus a new password + its
// confirmation. On submit the auth store reauthenticates with Firebase, updates
// the password client-side, and fires the branded "your password was changed"
// security notice from the backend (email + in-app + push). Light coral/cream
// design; KeyboardAvoidingView keeps the CTA above the keyboard.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

// Small Show/Hide toggle rendered inside a password field's `right` slot.
function ShowToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle} hitSlop={8}>
      <Text
        style={{ color: EX.color.muted, fontSize: 12.5, fontWeight: '700' }}
      >
        {on ? 'Hide' : 'Show'}
      </Text>
    </Pressable>
  );
}

export default function ChangePasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const changePassword = useAuthStore((s) => s.changePassword);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);

    // Client-side validation mirrors the register screen's rules.
    if (!current || !next || !confirm) {
      setError('Please fill in every field.');
      return;
    }
    if (next.length < 6) {
      setError('Your new password must be at least 6 characters.');
      return;
    }
    if (next !== confirm) {
      setError('The new passwords don’t match.');
      return;
    }
    if (next === current) {
      setError('Your new password must be different from the current one.');
      return;
    }

    const ok = await changePassword(current, next);
    if (!ok) {
      setError(
        useAuthStore.getState().error ?? 'Couldn’t change your password.',
      );
      return;
    }
    // Success — confirm and return to settings.
    Alert.alert(
      'Password changed',
      'Your password was updated. We’ve emailed you a confirmation.',
      [{ text: 'Done', onPress: () => router.back() }],
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: EX.color.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <BackHeader
        title="Change password"
        subtitle="Choose a new password for your account"
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
        <LabeledInput
          label="Current password"
          value={current}
          onChangeText={setCurrent}
          placeholder="Enter your current password"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
        />
        <LabeledInput
          label="New password"
          value={next}
          onChangeText={setNext}
          placeholder="At least 6 characters"
          secureTextEntry={!showNew}
          autoCapitalize="none"
          autoComplete="password-new"
          right={
            <ShowToggle on={showNew} onToggle={() => setShowNew((s) => !s)} />
          }
        />
        <LabeledInput
          label="Confirm new password"
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Re-enter your new password"
          secureTextEntry={!showNew}
          autoCapitalize="none"
          autoComplete="password-new"
        />

        <InlineError message={error} />

        <InfoNote>
          For your security we’ll ask you to confirm your current password, then
          email you when the change is complete.
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
          label="Update password"
          onPress={onSubmit}
          loading={isLoading}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
