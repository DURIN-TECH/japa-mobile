// ─────────────────────────────────────────────────────────────────────────────
// Delete account (Explorer, account security — destructive).
//
// A deliberately friction-full flow: the user must type DELETE and enter their
// current password before the red CTA enables. On submit the store reauthenticates
// and the backend deletes the Firestore profile + Firebase Auth user and emails a
// confirmation; the local session is then cleared and the app returns to the auth
// entry screen. There is no undo.
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
  InlineError,
  LabeledInput,
} from '@/components/explorer/AccountForm';
import { Ic } from '@/components/explorer/icons';
import { useAuthStore } from '@/stores/auth.store';

// The exact word the user must type to arm the delete button.
const CONFIRM_WORD = 'DELETE';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [password, setPassword] = useState('');
  const [confirmWord, setConfirmWord] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Button only arms once the password is present AND the confirm word matches.
  const armed =
    password.length > 0 && confirmWord.trim().toUpperCase() === CONFIRM_WORD;

  // Final OS-level confirmation before the irreversible call.
  const onPressDelete = () => {
    if (!armed) {
      setError(`Enter your password and type ${CONFIRM_WORD} to confirm.`);
      return;
    }
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your account and personal data. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: runDelete },
      ],
    );
  };

  const runDelete = async () => {
    setError(null);
    const ok = await deleteAccount(password);
    if (!ok) {
      setError(
        useAuthStore.getState().error ?? 'Couldn’t delete your account.',
      );
      return;
    }
    // Session already cleared by the store — send the user back to the auth entry.
    router.replace('/(auth)/welcome');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: EX.color.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <BackHeader
        title="Delete account"
        subtitle="Permanently remove your account and data"
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
        {/* ── Danger warning banner ─────────────────────────────────────────── */}
        <View
          style={{
            flexDirection: 'row',
            gap: 10,
            backgroundColor: '#FBE3E1',
            borderWidth: 1,
            borderColor: 'rgba(217,66,91,0.24)',
            borderRadius: 16,
            padding: 14,
          }}
        >
          <Ic.x size={18} color={EX.color.danger} strokeWidth={2.2} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{ fontSize: 13.5, fontWeight: '700', color: '#C0453C' }}
            >
              This can’t be undone
            </Text>
            <Text
              style={{
                fontSize: 12.5,
                lineHeight: 18,
                color: '#C0453C',
                marginTop: 3,
              }}
            >
              Deleting your account removes your profile and personal data.
              We’ll email you a confirmation once it’s done.
            </Text>
          </View>
        </View>

        <LabeledInput
          label="Current password"
          value={password}
          onChangeText={setPassword}
          placeholder="Confirm it’s you"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
        />
        <LabeledInput
          label={`Type ${CONFIRM_WORD} to confirm`}
          value={confirmWord}
          onChangeText={setConfirmWord}
          placeholder={CONFIRM_WORD}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <InlineError message={error} />
      </ScrollView>

      <View
        style={{
          paddingHorizontal: EX.space.screenX,
          paddingBottom: Math.max(insets.bottom, 16) + 6,
          paddingTop: 8,
        }}
      >
        <CoralSubmit
          label="Delete my account"
          onPress={onPressDelete}
          loading={isLoading}
          disabled={!armed}
          danger
        />
      </View>
    </KeyboardAvoidingView>
  );
}
