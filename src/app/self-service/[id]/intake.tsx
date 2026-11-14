// ─────────────────────────────────────────────────────────────────────────────
// Intake question screen (issue #113): /self-service/[id]/intake
//
// A pushed BackHeader form (like change-password) driven ENTIRELY by the
// questions the backend returns from the approved rubric. It has no knowledge
// of any country, route or nationality; every question string is data, and the
// chrome copy here is route-neutral.
//
// Behaviour (design spec):
//  - One Save button that never blocks on missing answers: "Save and finish
//    later" while any visible required question is open, "Save answers" once
//    all are answered.
//  - No autosave. Typed values are kept on every failure; leaving with unsaved
//    changes asks Save / Discard changes / Keep editing.
//  - Saving disables every control, the CTA and Back, so a second submit is
//    impossible.
//  - Validation errors name the question and put a red border on its control.
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
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX } from '@/components/explorer/theme';
import {
  BackHeader,
  InfoNote,
  InlineError,
} from '@/components/explorer/AccountForm';
import { IntakeQuestionList } from '@/components/explorer/intake/IntakeQuestionList';
import {
  openRequired,
  payloadAnswers,
  requiredCount,
  validateAnswers,
} from '@/components/explorer/intake/intakeLogic';
import {
  OutlineButton,
  SolidButton,
} from '@/components/explorer/review/ReviewParts';
import { StickyBar } from '@/components/explorer/StickyBar';
import { useApplication } from '@/hooks/useApplications';
import { useIntake, useSaveIntake } from '@/hooks/useIntake';
import { lastReviewFinishedAt, useAssessment } from '@/hooks/useCaseOfficer';
import type { IntakeAnswer, IntakeAnswers } from '@/types/intake.type';
import { Ic } from '@/components/explorer/icons';
import {
  SHARED_COPY,
  hasLayers,
  hasMissingLayer,
} from '@/components/explorer/sharedRouteLogic';

// Copy fallbacks used when the rubric carries no intake-level strings.
const FALLBACK_TITLE = 'Your details';
const FALLBACK_INTRO =
  'Describe your situation as it is. The review checks your answers against your documents, so accurate answers give you the most useful result.';

/** JSON with sorted keys, so "same answers" compare equal whatever the order. */
function stable(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(
          Object.entries(val).sort(([a], [b]) => a.localeCompare(b)),
        )
      : val,
  );
}

export default function IntakeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();

  const intakeQ = useIntake(id ?? '');
  const appQ = useApplication(id ?? '');
  const save = useSaveIntake(id ?? '');
  const data = intakeQ.data;
  // The last review's finish time comes from the review query (#43); the
  // intake response's own `lastReviewAt` is not filled in by the backend yet.
  const reviewQ = useAssessment(id ?? '');
  const reviewedAt =
    lastReviewFinishedAt(reviewQ.data) ?? data?.lastReviewAt ?? null;

  // ── Local form state ──────────────────────────────────────────────────────
  // Answers live here until a save succeeds (so hidden answers can be
  // restored by switching back before saving).
  const [answers, setAnswers] = useState<IntakeAnswers>({});
  const initialRef = useRef<string>('{}'); // what the server has, to detect edits
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false); // last save failed -> "Try again"
  const [notEditable, setNotEditable] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);
  const allowLeave = useRef(false);

  // Seed from the server exactly once, when the questions first arrive.
  useEffect(() => {
    if (data && !ready) {
      setAnswers(data.answers);
      initialRef.current = stable(data.answers);
      setReady(true);
    }
  }, [data, ready]);

  const dirty = ready && stable(answers) !== initialRef.current;
  const saving = save.isPending;

  // ── Scrolling to a question (resume + error) ───────────────────────────────
  const scrollRef = useRef<ScrollView>(null);
  const listY = useRef(0);
  const ys = useRef<Record<string, number>>({});
  const scrollToQuestion = useCallback((qid: string) => {
    const y = ys.current[qid];
    if (y !== undefined) {
      scrollRef.current?.scrollTo({
        y: Math.max(0, listY.current + y - 16),
        animated: true,
      });
    }
  }, []);

  // Resume: after the push transition, scroll to the first open required question.
  const scrolledOnce = useRef(false);
  useEffect(() => {
    if (!ready || !data || scrolledOnce.current || data.updatedAt === null)
      return;
    scrolledOnce.current = true;
    const first = openRequired(data.questions, data.answers)[0];
    if (first) setTimeout(() => scrollToQuestion(first.id), 450);
  }, [ready, data, scrollToQuestion]);

  // ── Saving ────────────────────────────────────────────────────────────────
  /** Returns true on success. `leave: 'back'` pops the screen afterwards. */
  const doSave = useCallback(
    async (leave: 'back' | 'none'): Promise<boolean> => {
      if (!data) return false;
      setError(null);
      setErrorId(null);

      // Client-side checks for things the pickers can't prevent.
      const problems = validateAnswers(data.questions, answers);
      if (problems.length > 0) {
        setError(
          problems.length === 1
            ? problems[0].message
            : `${problems.length} answers need another look, starting with “${
                data.questions.find((q) => q.id === problems[0].questionId)
                  ?.label ?? ''
              }”.`,
        );
        setErrorId(problems[0].questionId);
        scrollToQuestion(problems[0].questionId);
        return false;
      }

      try {
        await save.mutateAsync(payloadAnswers(data.questions, answers));
        setFailed(false);
        setSavedOnce(true);
        allowLeave.current = true;
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        if (leave === 'back') router.back();
        return true;
      } catch (e) {
        const err = e as { code?: string; message?: string; status?: number };
        setFailed(true);
        if (err.code === 'NOT_EDITABLE' || err.status === 409) {
          // Submitted meanwhile: no more edits; typed values stay on screen.
          setNotEditable(true);
          setError(
            'This application has been submitted, so these answers can’t be changed.',
          );
        } else if (err.code === 'NETWORK_ERROR') {
          setError(
            'You’re offline, so your answers aren’t saved yet. They’re still here. Reconnect and try again.',
          );
        } else if (err.code === 'VALIDATION_ERROR' && err.message) {
          // The server's message names the question ("<label>: ..."); use it
          // as sent and mark the matching control.
          setError(err.message);
          const hit = data.questions.find((q) =>
            err.message!.startsWith(`${q.label}:`),
          );
          if (hit) {
            setErrorId(hit.id);
            scrollToQuestion(hit.id);
          }
        } else {
          setError(
            'We couldn’t save your answers. They’re still here. Try again in a moment.',
          );
        }
        return false;
      }
    },
    [data, answers, save, router, scrollToQuestion],
  );

  // ── Leaving with unsaved changes (back button and gesture) ─────────────────
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (allowLeave.current || !dirty || notEditable) return;
      e.preventDefault();
      Alert.alert(
        'Save your changes?',
        'You have answers that aren’t saved yet.',
        [
          {
            text: 'Save',
            onPress: async () => {
              // Same save; leave only on success.
              if (await doSave('none')) navigation.dispatch(e.data.action);
            },
          },
          {
            text: 'Discard changes',
            style: 'destructive',
            onPress: () => {
              allowLeave.current = true;
              navigation.dispatch(e.data.action);
            },
          },
          { text: 'Keep editing', style: 'cancel' },
        ],
      );
    });
    return unsub;
  }, [navigation, dirty, notEditable, doSave]);

  // ── Change handler: clears the field's error when its answer changes ───────
  const onChange = (qid: string, value: IntakeAnswer | undefined) => {
    setAnswers((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[qid];
      else next[qid] = value;
      return next;
    });
    if (errorId === qid) {
      setErrorId(null);
      setError(null);
    }
  };

  const title = data?.meta.title ?? FALLBACK_TITLE;
  const header = (
    <BackHeader
      title={data ? title : FALLBACK_TITLE}
      subtitle={appQ.data?.visaTypeName}
      insets={insets}
      onBack={() => !saving && router.back()}
    />
  );

  // ── Loading ───────────────────────────────────────────────────────────────
  if (intakeQ.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
        {header}
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator color={EX.color.primary} />
        </View>
      </View>
    );
  }

  // ── Couldn't load: error + retry, no CTA bar ──────────────────────────────
  if (intakeQ.isError || !data) {
    return (
      <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
        {header}
        <View style={{ padding: EX.space.screenX, gap: 10 }}>
          <InlineError message="We couldn’t load your questions. Check your connection and try again." />
          <OutlineButton label="Try again" onPress={() => intakeQ.refetch()} />
        </View>
      </View>
    );
  }

  // Not reachable normally: the route has no intake, or the card was read-only.
  if (!data.available || !data.editable) {
    return (
      <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
        {header}
        <View style={{ padding: EX.space.screenX, gap: 10 }}>
          {/* japa#174: only say "submitted" when the server says it is read-only;
              a draft with no visit questions gets its own line. */}
          <InlineError
            message={
              data.available
                ? 'This application has been submitted, so these answers can’t be changed.'
                : 'There are no visit questions for this application.'
            }
          />
          <OutlineButton
            label="Back to your application"
            onPress={() => router.back()}
          />
        </View>
      </View>
    );
  }

  // ── Derived values for the bar ────────────────────────────────────────────
  const total = requiredCount(data.questions, answers);
  const open = openRequired(data.questions, answers);
  const answered = total - open.length;
  const anyAnswer =
    Object.keys(payloadAnswers(data.questions, answers)).length > 0;
  const started = data.updatedAt !== null || savedOnce;
  const ctaLabel = failed
    ? 'Try again'
    : open.length > 0
      ? 'Save and finish later'
      : 'Save answers';
  // Nothing to save yet on a fresh form: the CTA stays dimmed (60%).
  const ctaDisabled = saving || (!started && !anyAnswer);
  const questionsChanged =
    data.savedRubricVersion !== null &&
    data.savedRubricVersion !== data.rubricVersion;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: EX.color.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {header}

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: EX.space.screenX,
          paddingTop: 12,
          paddingBottom: EX.space.ctaClear,
          gap: 14,
        }}
      >
        <InfoNote>{data.meta.intro ?? FALLBACK_INTRO}</InfoNote>

        {/* japa#237: a stack's questions arrive merged, each once. */}
        {hasLayers(data.stackLayers) ? (
          <InfoNote>{SHARED_COPY.intakeOnce}</InfoNote>
        ) : null}
        {hasMissingLayer(data.stackLayers) ? (
          <InfoNote icon={Ic.clock}>{SHARED_COPY.intakeMissing}</InfoNote>
        ) : null}

        {questionsChanged ? (
          <InfoNote>
            Some questions have changed since you last answered. We’ve kept the
            answers that still apply. Please check the rest.
          </InfoNote>
        ) : null}

        {reviewedAt ? (
          <InfoNote>
            Your last review used your earlier answers. If you change anything,
            run the review again. Your document checklist may update too.
          </InfoNote>
        ) : null}

        <View
          style={{ marginTop: 8 }}
          onLayout={(e) => {
            listY.current = e.nativeEvent.layout.y;
          }}
        >
          <IntakeQuestionList
            questions={data.questions}
            answers={answers}
            onChange={onChange}
            errorId={errorId}
            showOpenLines={started}
            disabled={saving || notEditable}
            narrow={width < 360}
            onQuestionLayout={(qid, y) => {
              ys.current[qid] = y;
            }}
          />
        </View>
      </ScrollView>

      {/* ── Sticky bar: required counter · coral save button ─────────────────── */}
      <StickyBar insetBottom={insets.bottom} inline>
        {/* One InlineError, announced when it appears */}
        <View
          accessibilityLiveRegion="polite"
          style={error ? { marginBottom: 10 } : undefined}
        >
          <InlineError message={error} />
        </View>

        {notEditable ? (
          <OutlineButton
            label="Back to your application"
            onPress={() => router.back()}
          />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            {total > 0 ? (
              <View>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: EX.color.inkMuted,
                  }}
                >
                  Required
                </Text>
                <Text
                  style={{
                    fontSize: 21,
                    fontWeight: '700',
                    color: EX.color.ink,
                  }}
                >
                  {`${answered} of ${total}`}
                </Text>
              </View>
            ) : null}
            <SolidButton
              label={ctaLabel}
              onPress={() => doSave('back')}
              loading={saving}
              disabled={ctaDisabled}
              style={{ flex: 1 }}
            />
          </View>
        )}
      </StickyBar>
    </KeyboardAvoidingView>
  );
}
