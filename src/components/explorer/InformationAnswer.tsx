// ─────────────────────────────────────────────────────────────────────────────
// InformationAnswer (issue #187): the typed answer of one "information" item on
// the self-service checklist. A multiline field that saves itself, a SaveStatus
// line, and an InlineError with an action when a save fails.
//
// Save rules live in `answerSaver.ts`: 1.5 s after the last keystroke, right
// away on blur / screen blur / app to background, trimmed text only, only when
// it changed, one save in flight. Unsaved text lives in the in-memory draft
// store (answerDrafts.store.ts), so a failed or offline save never loses it.
// A refetched server answer never overwrites a draft. Drafts also survive an app
// kill: they are mirrored to the encrypted vault (services/draftVault.ts).
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
import type { SaverStatus } from '@/components/explorer/answerSaver';
import { acquireSaver, dropSaver } from '@/components/explorer/answerSavers';
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
  locked,
}: {
  applicationId: string;
  itemId: string;
  /** The server's saved text for this item ('' when none). */
  savedText: string;
  /** Sends the trimmed text (rejects on failure). */
  save: (trimmed: string) => Promise<unknown>;
  /** A 409 ANSWERS_LOCKED came back. */
  onLocked: () => void;
  /** Read-only: show the server answer, send nothing, drop any draft. */
  locked: boolean;
}) {
  const key = draftKey(applicationId, itemId);
  const draft = useAnswerDraftsStore((s) => s.drafts[key]);
  // `null` until the person types: until then the field shows the draft, else
  // the server text. Once they type, their text is the truth while mounted.
  const [typed, setTyped] = useState<string | null>(null);
  // Locked: the server's answer, never an unsaved draft.
  const value = locked ? savedText : (typed ?? draft ?? savedText);

  // ONE saver per item, shared by every mount (answerSavers.ts), so a remount
  // never starts a second save while one is in flight.
  const entry = acquireSaver(key, savedText);
  const saver = entry.saver;
  const [status, setStatus] = useState<SaverStatus>(entry.status);

  // Latest callbacks, so the shared saver never calls a stale mount.
  const saveRef = useRef(save);
  saveRef.current = save;
  const lockedRef = useRef(onLocked);
  lockedRef.current = onLocked;

  useEffect(() => {
    // Plug this mount into the saver; unplug on unmount (the saver carries on).
    entry.holder.save = (trimmed) => saveRef.current(trimmed);
    entry.holder.onStatus = (s) => {
      if (
        s.phase === 'error' &&
        classifySaveError(s.error, s.text) === 'locked'
      )
        lockedRef.current();
      setStatus(s);
    };
    // A successful save: the draft goes, but only if it is still THIS text (a
    // newer draft typed meanwhile must survive).
    entry.holder.onSaved = (trimmed, latest) => {
      const store = useAnswerDraftsStore.getState();
      const current = store.drafts[key];
      if (
        latest.trim() === trimmed &&
        (current === undefined || current.trim() === trimmed)
      )
        store.clearDraft(applicationId, itemId);
    };
    setStatus(entry.status);
    return () => {
      entry.holder.onStatus = () => {};
    };
  }, [entry, key, applicationId, itemId]);

  // Server text arrives or changes (load, refetch): tell the saver, but only
  // while there is nothing unsaved (the saver enforces it).
  useEffect(() => {
    saver.setSaved(savedText);
  }, [saver, savedText]);

  // Locked (under review, or a 409): nothing is sent any more and the unsaved
  // text is dropped, so it can never overwrite or linger.
  useEffect(() => {
    if (!locked) return;
    dropSaver(key);
    useAnswerDraftsStore.getState().clearDraft(applicationId, itemId);
  }, [locked, key, applicationId, itemId]);

  // A draft left from earlier (offline, app killed, left the screen) arrives
  // from the vault shortly after the screen opens: save it once, when it shows.
  const restored = useRef(false);
  useEffect(() => {
    if (!locked && draft !== undefined && typed === null && !restored.current) {
      restored.current = true;
      saver.change(draft);
    }
  }, [locked, draft, typed, saver]);

  // Save right away when the screen loses focus or the app goes to the
  // background; the vault write is flushed at the same moments.
  useFocusEffect(
    useCallback(() => {
      return () => {
        saver.flush();
        useAnswerDraftsStore.getState().flushWrites();
      };
    }, [saver]),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') {
        saver.flush();
        useAnswerDraftsStore.getState().flushWrites();
      }
    });
    return () => sub.remove();
  }, [saver]);

  const onChangeText = (text: string) => {
    if (locked) return;
    setTyped(text);
    // Unsaved text is held in memory the moment it is typed.
    useAnswerDraftsStore.getState().setDraft(applicationId, itemId, text);
    saver.change(text);
  };

  return {
    value,
    status,
    onChangeText,
    onBlur: () => {
      saver.flush();
      useAnswerDraftsStore.getState().flushWrites();
    },
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
    locked,
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
