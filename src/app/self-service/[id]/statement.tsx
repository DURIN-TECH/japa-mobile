// ─────────────────────────────────────────────────────────────────────────────
// Statement screen — /self-service/[id]/statement (issue #43).
//
// The applicant writes their statement in plain paragraphs. It is saved as a
// DocumentInstance cloned from the `global-sop` template (see useStatement.ts);
// every save is a new version, and the next review reads the newest one.
//
// The editor deliberately starts EMPTY: the template's headings and bracket
// placeholders are study-specific, and this screen must stay route-neutral.
//
// States (design spec): loading spinner · couldn't load (InlineError + retry) ·
// empty (CTA disabled) · saving (spinner, everything disabled) · saved (success
// haptic, pop back) · save failed / offline (InlineError, text kept, CTA becomes
// "Try again") · not allowed / submitted (InlineError + back button) ·
// leaving with unsaved text (native alert).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX } from '@/components/explorer/theme';
import {
  BackHeader,
  InfoNote,
  InlineError,
  LabeledInput,
} from '@/components/explorer/AccountForm';
import {
  OutlineButton,
  SolidButton,
  StickyBar,
} from '@/components/explorer/review/ReviewParts';
import { useApplication } from '@/hooks/useApplications';
import {
  SUBMITTED_STATUSES,
  useSaveStatement,
  useStatement,
  wordCount,
} from '@/hooks/useStatement';
import { isForbidden, isOffline } from '@/hooks/useCaseOfficer';

export default function StatementScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const applicationId = id ?? '';

  const appQ = useApplication(applicationId);
  const stmtQ = useStatement(applicationId);
  const save = useSaveStatement(applicationId);

  // Local draft. `null` = untouched, so the saved text shows until the user types.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? stmtQ.data?.text ?? '';
  const dirty = draft !== null && draft !== (stmtQ.data?.text ?? '');
  // The leave-alert must not fire after a successful save pops the screen.
  const allowLeave = useRef(false);

  const locked =
    !!appQ.data && SUBMITTED_STATUSES.includes(appQ.data.status as string);
  const forbidden = isForbidden(save.error) || isForbidden(stmtQ.error);
  const blocked = locked || forbidden;

  const doSave = useCallback(
    async (then?: () => void) => {
      if (!stmtQ.data) return;
      try {
        await save.mutateAsync({ current: stmtQ.data, text });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => undefined,
        );
        allowLeave.current = true;
        if (then) then();
        else router.back();
      } catch {
        // Surfaced through `save.error` (InlineError below); the text is kept.
      }
    },
    [stmtQ.data, save, text, router],
  );

  // ── Leaving with unsaved text → native alert ─────────────────────────────────
  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', (e) => {
      if (allowLeave.current || !dirty || blocked) return;
      e.preventDefault();
      Alert.alert(
        'Save your changes?',
        'Your statement has changes that aren’t saved yet.',
        [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Discard changes',
            style: 'destructive',
            onPress: () => {
              allowLeave.current = true;
              navigation.dispatch(e.data.action);
            },
          },
          {
            text: 'Save',
            onPress: () => doSave(() => navigation.dispatch(e.data.action)),
          },
        ],
      );
    });
    return sub;
  }, [navigation, dirty, blocked, doSave]);

  const backToApplication = () => router.back();

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (stmtQ.isLoading || appQ.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: EX.color.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={EX.color.primary} />
      </View>
    );
  }

  const header = (
    <BackHeader
      title="Your statement"
      subtitle={appQ.data?.visaTypeName}
      insets={insets}
      onBack={() => !save.isPending && router.back()}
    />
  );

  // ── Couldn't load (not a permission problem) ─────────────────────────────────
  if (stmtQ.isError && !forbidden) {
    return (
      <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
        {header}
        <View style={{ paddingHorizontal: EX.space.screenX, paddingTop: 16, gap: 12 }}>
          <InlineError message="We couldn’t load your statement. Check your connection and try again." />
          <OutlineButton label="Try again" onPress={() => stmtQ.refetch()} />
        </View>
      </View>
    );
  }

  // ── Not allowed / no longer editable ─────────────────────────────────────────
  if (blocked) {
    return (
      <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
        {header}
        <View style={{ paddingHorizontal: EX.space.screenX, paddingTop: 16, gap: 12 }}>
          <InlineError
            message={
              locked
                ? 'This application has been submitted, so your statement can’t be changed.'
                : 'This statement isn’t available on this account.'
            }
          />
          <OutlineButton label="Back to your application" onPress={backToApplication} />
        </View>
      </View>
    );
  }

  // Save-failure line for the CTA bar.
  const saveError = save.isError
    ? isOffline(save.error)
      ? 'You’re offline, so your statement isn’t saved yet. It’s still here. Reconnect and try again.'
      : 'We couldn’t save your statement. It’s still here. Try again in a moment.'
    : null;

  const words = wordCount(text);
  const empty = text.trim().length === 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: EX.color.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {header}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: EX.space.screenX,
          paddingTop: 14,
          paddingBottom: EX.space.ctaClear,
          gap: 12,
        }}
      >
        <InfoNote>
          Write it as it is. The review compares your statement with your
          answers and documents, so an accurate statement gives you the most
          useful result.
        </InfoNote>
        {/* One multiline field, no inner label, grows with its content. */}
        <LabeledInput
          label=""
          multiline
          autoCapitalize="sentences"
          autoCorrect
          editable={!save.isPending}
          value={text}
          onChangeText={setDraft}
          placeholder="Why you’re applying and what you plan to do"
          textAlignVertical="top"
          style={{ minHeight: 280, fontSize: 15, fontWeight: '400', lineHeight: 22 }}
        />
        <Text style={{ fontSize: 12, color: EX.color.inkMuted, textAlign: 'right' }}>
          {words} {words === 1 ? 'word' : 'words'}
        </Text>
      </ScrollView>

      {/* Sticky save bar rides above the keyboard (inside the KAV). */}
      <StickyBar insetBottom={insets.bottom}>
        {saveError ? (
          <View style={{ marginBottom: 10 }}>
            <InlineError message={saveError} />
          </View>
        ) : null}
        <SolidButton
          label={save.isError ? 'Try again' : 'Save statement'}
          onPress={() => doSave()}
          loading={save.isPending}
          disabled={empty}
        />
      </StickyBar>
    </KeyboardAvoidingView>
  );
}
