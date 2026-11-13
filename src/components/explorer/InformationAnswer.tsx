// ─────────────────────────────────────────────────────────────────────────────
// InformationAnswer (issue #187): the typed answer of one "information" item on
// the self-service checklist. A multiline field that saves itself, a SaveStatus
// line, and an InlineError with an action when a save fails.
//
// Save rules live in `answerSaver.ts`: 1.5 s after the last keystroke, right
// away on blur / screen blur / app to background, trimmed text only, only when
// it changed, one save in flight. Unsaved text lives in the in-memory draft
// store (answerDrafts.store.ts), so a failed or offline save never loses it.
// A refetched server answer never overwrites a draft.
//
// The answer text is personal: it is never logged.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { PressableStatic } from '@/components/explorer/PressableStatic';
import { EX } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { InlineError, LabeledInput } from '@/components/explorer/AccountForm';
import {
  createAnswerSaver,
  type AnswerSaver,
  type SaverStatus,
} from '@/components/explorer/answerSaver';
import {
  SAVE_ERROR_COPY,
  classifySaveError,
  type SaveErrorKind,
} from '@/hooks/useAnswers';
import { useAnswerDraftsStore, draftKey } from '@/stores/answerDrafts.store';
import { ANSWER_MAX_LENGTH } from '@/types/answers.type';

/** The counter appears from this many characters. */
export const COUNTER_FROM = 1800;

/** "1,850 / 2,000", or the limit line at the limit. Null below COUNTER_FROM. */
export function counterText(length: number): string | null {
  if (length < COUNTER_FROM) return null;
  const n = length.toLocaleString('en-US');
  const max = ANSWER_MAX_LENGTH.toLocaleString('en-US');
  return length >= ANSWER_MAX_LENGTH
    ? `${n} / ${max} · That’s the limit`
    : `${n} / ${max}`;
}

/**
 * The field's state and handlers. Exported separately from the view so the
 * screen logic is one hook.
 */
export function useAnswerField({
  applicationId,
  itemId,
  savedText,
  save,
  onLocked,
}: {
  applicationId: string;
  itemId: string;
  /** The server's saved text for this item ('' when none). */
  savedText: string;
  /** Sends the trimmed text (rejects on failure). */
  save: (trimmed: string) => Promise<unknown>;
  /** A 409 ANSWERS_LOCKED came back. */
  onLocked: () => void;
}) {
  const draft = useAnswerDraftsStore(
    (s) => s.drafts[draftKey(applicationId, itemId)],
  );
  // `null` until the person types: until then the field shows the draft, else
  // the server text. Once they type, their text is the truth while mounted.
  const [typed, setTyped] = useState<string | null>(null);
  const value = typed ?? draft ?? savedText;
  const [status, setStatus] = useState<SaverStatus>({ phase: 'idle' });

  // Latest callbacks, so the saver (created once) never goes stale.
  const saveRef = useRef(save);
  saveRef.current = save;
  const lockedRef = useRef(onLocked);
  lockedRef.current = onLocked;

  const saverRef = useRef<AnswerSaver | null>(null);
  if (!saverRef.current) {
    saverRef.current = createAnswerSaver({
      saved: savedText,
      save: async (trimmed) => {
        await saveRef.current(trimmed);
      },
      onStatus: (s) => {
        if (
          s.phase === 'error' &&
          classifySaveError(s.error, s.text) === 'locked'
        )
          lockedRef.current();
        setStatus(s);
      },
      // A successful save of what is in the field: the draft is no longer needed.
      onSaved: (trimmed, latest) => {
        if (latest.trim() === trimmed)
          useAnswerDraftsStore.getState().clearDraft(applicationId, itemId);
      },
    });
  }
  const saver = saverRef.current;

  // Server text arrives or changes (load, refetch): tell the saver, but only
  // while there is nothing unsaved (the saver enforces it).
  useEffect(() => {
    saver.setSaved(savedText);
  }, [saver, savedText]);

  // A draft left from earlier (offline, left the screen): save it on open.
  useEffect(() => {
    if (draft !== undefined && typed === null) {
      saver.change(draft);
    }
    // Only on first mount with a draft.
  }, []);

  // Save right away when the screen loses focus, the app goes to the
  // background, and on unmount (the saver finishes an in-flight save quietly).
  useFocusEffect(
    useCallback(() => {
      return () => saver.flush();
    }, [saver]),
  );
  useEffect(() => {
    saver.resume();
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') saver.flush();
    });
    return () => {
      sub.remove();
      saver.dispose();
    };
  }, [saver]);

  const onChangeText = (text: string) => {
    setTyped(text);
    // Unsaved text is held in memory the moment it is typed.
    useAnswerDraftsStore.getState().setDraft(applicationId, itemId, text);
    saver.change(text);
  };

  return {
    value,
    status,
    onChangeText,
    onBlur: () => saver.flush(),
    retry: () => saver.flush(),
  };
}

// ── View ──────────────────────────────────────────────────────────────────────

/** The row under the field: counter on the left, status on the right. */
function SaveStatus({
  length,
  status,
}: {
  length: number;
  status: SaverStatus;
}) {
  const counter = counterText(length);
  const atLimit = length >= ANSWER_MAX_LENGTH;
  const hasStatus = status.phase === 'saving' || status.phase === 'saved';
  if (!counter && !hasStatus) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: counter ? 'space-between' : 'flex-end',
        alignItems: 'center',
        columnGap: 12,
        rowGap: 4,
        marginTop: 6,
      }}
    >
      {counter ? (
        <Text
          style={{
            fontSize: 12,
            fontWeight: '600',
            color: atLimit ? '#C0453C' : EX.color.inkMuted,
          }}
        >
          {counter}
        </Text>
      ) : null}
      {status.phase === 'saving' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <ActivityIndicator size="small" color={EX.color.primary} />
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: EX.color.inkMuted,
            }}
          >
            Saving…
          </Text>
        </View>
      ) : null}
      {status.phase === 'saved' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ic.check size={14} color={EX.color.success} strokeWidth={1.8} />
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: EX.color.inkMuted,
            }}
          >
            Saved
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** One information item's field. */
export function InformationAnswer({
  applicationId,
  itemId,
  title,
  savedText,
  save,
  locked,
  onLocked,
  onSeePlans,
  onRefreshList,
}: {
  applicationId: string;
  itemId: string;
  /** The item title: the field's accessibility label. */
  title: string;
  savedText: string;
  save: (trimmed: string) => Promise<unknown>;
  /** Answers are read-only (409 ANSWERS_LOCKED, or the application is under review). */
  locked: boolean;
  onLocked: () => void;
  /** Opens /subscription (read-only plan error). */
  onSeePlans: () => void;
  /** Refetches the checklist and the answers (list-changed error). */
  onRefreshList: () => void;
}) {
  const field = useAnswerField({
    applicationId,
    itemId,
    savedText,
    save,
    onLocked,
  });
  const errorKind: Exclude<SaveErrorKind, 'locked'> | null =
    field.status.phase === 'error'
      ? (() => {
          const k = classifySaveError(field.status.error, field.status.text);
          return k === 'locked' ? null : k;
        })()
      : null;
  const copy = errorKind ? SAVE_ERROR_COPY[errorKind] : null;

  return (
    <View style={{ marginTop: 10 }}>
      <LabeledInput
        label=""
        focusRing
        multiline
        textAlignVertical="top"
        autoCapitalize="sentences"
        autoCorrect
        maxLength={ANSWER_MAX_LENGTH}
        placeholder="Type your answer"
        accessibilityLabel={title}
        accessibilityHint="Saves as you type"
        editable={!locked}
        value={field.value}
        onChangeText={field.onChangeText}
        onBlur={field.onBlur}
        style={{
          fontSize: 14.5,
          lineHeight: 21,
          fontWeight: '400',
          minHeight: 92,
          maxHeight: 220,
        }}
      />
      {!locked ? (
        <SaveStatus length={field.value.length} status={field.status} />
      ) : null}
      {!locked && copy ? (
        <View style={{ marginTop: 8, gap: 8 }}>
          <InlineError message={copy.message} />
          <PressableStatic
            onPress={
              copy.action === 'plans'
                ? onSeePlans
                : copy.action === 'refresh'
                  ? onRefreshList
                  : field.retry
            }
            accessibilityRole="button"
            style={{ alignSelf: 'flex-start' }}
          >
            <Text
              style={{
                fontSize: 13.5,
                fontWeight: '700',
                color: EX.color.primary,
              }}
            >
              {copy.action === 'plans'
                ? 'See plans'
                : copy.action === 'refresh'
                  ? 'Refresh list'
                  : 'Try again'}
            </Text>
          </PressableStatic>
        </View>
      ) : null}
    </View>
  );
}
