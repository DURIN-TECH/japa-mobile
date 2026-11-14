// ─────────────────────────────────────────────────────────────────────────────
// DocumentChecklist (issue #114) — the applicant's personal document list on
// the live self-service screen.
//
// The list is decided on the server, in code, from the approved visa rubric and
// the applicant's visit details; this component only RENDERS it. Items are
// split into "Yours" and "Your sponsor's" (the sponsor group is hidden when
// empty). Each item shows: title, required/optional, state, a reason, an upload
// action, and a "Where this comes from" toggle that reveals the verbatim quote
// and a link to the official page.
//
// Issue #187: an item is either a document (upload) or INFORMATION (a typed
// answer that saves itself, see InformationAnswer). Every item shows one of three
// need labels: Required, "If it applies to you" (+ the verbatim clause), Optional.
//
// A document is never listed twice: the screen filters documents that fulfil a
// checklist item out of its "Other documents" card (see `isChecklistDocument`).
//
// States: loading = coral spinner; empty = icon + one line; error = InlineError
// with retry. Generic: no destination, route or document is named here.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { ActivityIndicator, Linking, Text, View } from 'react-native';
import { PressableStatic } from '@/components/explorer/PressableStatic';
import { EX } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { Pill, SectionTitle } from '@/components/explorer/primitives';
import { InlineError, InfoNote } from '@/components/explorer/AccountForm';
import { Checklist, ChecklistItem } from '@/types/checklist.type';
import type { SavedAnswer } from '@/types/answers.type';
import {
  sentenceCase,
  type AnswerValue,
} from '@/components/explorer/answerTypes';
import { ANSWERS_LOCKED_COPY } from '@/hooks/useAnswers';
import { InformationAnswer } from '@/components/explorer/InformationAnswer';
import { useAnswerDraftsStore, draftKey } from '@/stores/answerDrafts.store';
import {
  appliesWhenText,
  checklistRequirementId,
  isInformationItem,
  itemState,
  latestDocFor,
  needLabel,
  needOf,
  type ItemState,
} from '@/components/explorer/checklistLogic';
import { Document } from '@/types/documents.type';
// Per-upload document check (#115): shown on the item once a document is uploaded.
import { DocumentCheckNotice } from '@/components/explorer/DocumentCheckNotice';
import type { DocumentChecksResponse } from '@/types/documentCheck.type';

/** The document-check data and actions the checklist threads down to each item (#115). */
export interface ChecksProps {
  /** Latest checks for the application (null/undefined until loaded). */
  checks?: DocumentChecksResponse | null;
  checksLoading: boolean;
  checksError: boolean;
  onReloadChecks: () => void;
  /** Run the check again for a document id. */
  onRetryCheck: (documentId: string) => void;
  /** The document id whose retry is in flight, if any. */
  retryingDocId: string | null;
}

/**
 * The answers data and actions the checklist threads down to each information
 * item (#187). Absent = the screen has no answers support (all items as documents).
 */
export interface AnswersProps {
  applicationId: string;
  /** Saved answers by item id; undefined until the fetch succeeds. */
  answers?: Record<string, SavedAnswer>;
  answersLoading: boolean;
  answersError: boolean;
  onRetryAnswers: () => void;
  /** Sends one validated answer value ('' clears; rejects on failure). */
  saveAnswer: (itemId: string, value: AnswerValue | '') => Promise<unknown>;
  /** Read-only: the application is under review (409 ANSWERS_LOCKED). */
  locked: boolean;
  onLocked: () => void;
  /** Opens /subscription (read-only plan error). */
  onSeePlans: () => void;
  /** Refetches the checklist and the answers (list-changed error). */
  onRefreshList: () => void;
}

/** A failed checklist-item upload (japa#174): which request it was and what to say. */
export interface UploadFailure {
  documentRequestId?: string;
  message: string;
}

// Re-exported: callers import it from here (it lives in checklistLogic.ts).
export { checklistRequirementId };

/**
 * True when `doc` was uploaded against one of the checklist's items, so the
 * screen can leave it out of "Other documents" (no document listed twice).
 */
export function isChecklistDocument(
  doc: Document,
  checklist?: Checklist | null,
) {
  if (!checklist) return false;
  return checklist.items.some(
    (i) =>
      i.documentRequestId &&
      doc.requirementId === checklistRequirementId(i.documentRequestId),
  );
}

const STATE_STYLE: Record<
  ItemState,
  { label: string; fg: string; bg: string }
> = {
  answered: { label: 'Answered', fg: '#1E8E55', bg: '#D6F2E2' },
  waiting: { label: 'Waiting', fg: '#8B8499', bg: 'rgba(23,19,38,0.06)' },
  uploaded: { label: 'Uploaded', fg: '#B26A14', bg: '#FCEAC8' },
  accepted: { label: 'Accepted', fg: '#1E8E55', bg: '#D6F2E2' },
  needs_another: { label: 'Needs another', fg: '#C0453C', bg: '#FBE3E1' },
  not_needed: { label: 'Not needed', fg: '#8B8499', bg: 'rgba(23,19,38,0.06)' },
};

// ── One item ──────────────────────────────────────────────────────────────────
function ChecklistRow({
  item,
  docs,
  first,
  uploading,
  onUpload,
  checksProps,
  uploadError,
  answersProps,
}: {
  item: ChecklistItem;
  docs: Document[];
  first: boolean;
  uploading: boolean;
  onUpload: (item: ChecklistItem) => void;
  checksProps: ChecksProps;
  /** japa#174: message of a failed upload made from THIS item (shown in its card). */
  uploadError?: string | null;
  /** #187: answers data for information items. */
  answersProps?: AnswersProps;
}) {
  const [open, setOpen] = useState(false);
  // #187: a typed-detail item has no upload; a `kindReview` item is a document.
  const info = isInformationItem(item) && !!answersProps;
  const answers = answersProps?.answers;
  const state = itemState(item, docs, info ? answers : null);
  const clause = appliesWhenText(item);
  // Unsaved text for this item (a draft is newer than anything from the server).
  const hasDraft = useAnswerDraftsStore(
    (st) =>
      answersProps &&
      draftKey(answersProps.applicationId, item.checklistItemId) in st.drafts,
  );
  const s = STATE_STYLE[state];
  // Upload is offered while waiting or when another file is needed. A request
  // not yet stored (no id) cannot be uploaded against.
  const canUpload =
    !info &&
    !!item.documentRequestId &&
    (state === 'waiting' || state === 'needs_another');
  // The latest document uploaded against this item (#115): the check is about it.
  const latestDoc = info ? undefined : latestDocFor(item, docs);
  // The check for THAT document; a check of an older file is not shown for it.
  const itemCheck =
    checksProps.checks?.tier === 'full' && latestDoc
      ? checksProps.checks.checks.find(
          (c) =>
            c.checklistItemId === item.checklistItemId &&
            c.documentId === latestDoc.id,
        )
      : undefined;

  return (
    <View
      style={{
        borderTopWidth: first ? 0 : 1,
        borderTopColor: EX.color.line06,
        paddingVertical: 13,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{ fontSize: 14, fontWeight: '600', color: EX.color.ink }}
          >
            {sentenceCase(item.title)}
          </Text>
          {/* Need label (#187): ink-muted, because it can carry a condition the
              person must read (`muted` is 3.58:1 on white). */}
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: EX.color.inkMuted,
              marginTop: 1,
            }}
          >
            {needLabel(needOf(item))}
          </Text>
          {clause ? (
            <Text
              style={{
                fontSize: 12.5,
                lineHeight: 18,
                fontStyle: 'italic',
                color: EX.color.inkMuted,
                marginTop: 2,
              }}
            >
              “{clause}”
            </Text>
          ) : null}
        </View>
        <Pill label={s.label} fg={s.fg} bg={s.bg} small />
      </View>

      {/* Reason: always present (a template filled from the published rule). */}
      {item.reason ? (
        <Text
          style={{
            fontSize: 13,
            lineHeight: 19,
            color: EX.color.inkMuted,
            marginTop: 6,
          }}
        >
          {item.reason}
        </Text>
      ) : null}

      {/* Source: the verbatim quote and a link to the official page. */}
      <PressableStatic
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          marginTop: 6,
        }}
      >
        <Text
          style={{ fontSize: 12.5, fontWeight: '700', color: EX.color.primary }}
        >
          {open ? 'Hide source' : 'Where this comes from'}
        </Text>
        <Ic.chevR size={13} color={EX.color.primary} strokeWidth={2} />
      </PressableStatic>
      {open ? (
        <View
          style={{
            marginTop: 8,
            padding: 12,
            borderRadius: 12,
            backgroundColor: EX.color.cream,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              lineHeight: 19,
              color: EX.color.ink,
              fontStyle: 'italic',
            }}
          >
            “{item.citation.quote}”
          </Text>
          {item.citation.ruleRef ? (
            <Text style={{ fontSize: 12, color: EX.color.muted, marginTop: 4 }}>
              {item.citation.ruleRef}
            </Text>
          ) : null}
          <PressableStatic
            onPress={() => Linking.openURL(item.citation.url)}
            style={{ marginTop: 8 }}
          >
            <Text
              style={{
                fontSize: 12.5,
                fontWeight: '700',
                color: EX.color.primary,
              }}
            >
              Read the official page
            </Text>
          </PressableStatic>
        </View>
      ) : null}

      {/* Information item (#187): the answer field, in place of upload. */}
      {info && answersProps && item.status !== 'waived' ? (
        answersProps.answers || hasDraft ? (
          <InformationAnswer
            applicationId={answersProps.applicationId}
            itemId={item.checklistItemId}
            title={item.title}
            answerType={item.answerType}
            currencyHint={[item.title, item.appliesWhen].join(' ')}
            savedValue={answersProps.answers?.[item.checklistItemId]?.value}
            save={(value) =>
              answersProps.saveAnswer(item.checklistItemId, value)
            }
            locked={answersProps.locked}
            onLocked={answersProps.onLocked}
            onSeePlans={answersProps.onSeePlans}
            onRefreshList={answersProps.onRefreshList}
          />
        ) : answersProps.answersLoading ? (
          // Same size as the field, not editable, so nothing jumps when it loads.
          <View
            style={{
              marginTop: 10,
              minHeight: 92,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: EX.color.cardWhite,
              borderWidth: 1,
              borderColor: EX.color.line10,
              borderRadius: 18,
            }}
          >
            <ActivityIndicator size="small" color={EX.color.primary} />
          </View>
        ) : (
          // Fetch failed: no field, so a blank one can never overwrite a saved answer.
          <Text
            style={{
              fontSize: 13,
              lineHeight: 19,
              color: EX.color.inkMuted,
              marginTop: 10,
            }}
          >
            Your answer will show here once it loads.
          </Text>
        )
      ) : null}

      {/* Document check result (#115): only once a document is uploaded. */}
      {latestDoc ? (
        <DocumentCheckNotice
          check={itemCheck}
          loading={checksProps.checksLoading && !checksProps.checks}
          error={checksProps.checksError && !checksProps.checks}
          upgradeRequired={checksProps.checks?.tier === 'free'}
          onReload={checksProps.onReloadChecks}
          onRetryCheck={() => checksProps.onRetryCheck(latestDoc.id)}
          retrying={checksProps.retryingDocId === latestDoc.id}
        />
      ) : null}

      {/* Failed upload from this item: error above its button (#174). */}
      {uploadError ? (
        <View style={{ marginTop: 10 }}>
          <InlineError message={uploadError} />
        </View>
      ) : null}

      {canUpload ? (
        <PressableStatic
          onPress={() => onUpload(item)}
          disabled={uploading}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            backgroundColor: EX.color.primary,
            borderRadius: 13,
            height: 42,
            marginTop: 10,
            opacity: uploading ? 0.7 : 1,
          }}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ic.upload size={15} color="#fff" strokeWidth={2} />
          )}
          <Text style={{ color: '#fff', fontSize: 13.5, fontWeight: '700' }}>
            {uploading
              ? 'Uploading…'
              : uploadError
                ? 'Try again'
                : state === 'needs_another'
                  ? 'Upload another'
                  : 'Upload'}
          </Text>
        </PressableStatic>
      ) : null}
    </View>
  );
}

// ── One group card ("Yours" / "Your sponsor's") ───────────────────────────────
function Group({
  title,
  note,
  items,
  ...rest
}: {
  title: string;
  note?: string;
  items: ChecklistItem[];
  docs: Document[];
  uploadingId: string | null;
  onUpload: (item: ChecklistItem) => void;
  checksProps: ChecksProps;
  uploadFailure?: UploadFailure | null;
  answersProps?: AnswersProps;
}) {
  // Hidden when empty (the sponsor group in particular).
  if (items.length === 0) return null;
  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: EX.radius.card,
        borderWidth: 1,
        borderColor: 'rgba(23,19,38,0.07)',
        paddingHorizontal: 16,
        paddingVertical: 15,
        marginBottom: 13,
      }}
    >
      <Text style={{ fontSize: 15.5, fontWeight: '700', color: EX.color.ink }}>
        {title}
      </Text>
      {note ? (
        <Text
          style={{
            fontSize: 12.5,
            lineHeight: 18,
            color: EX.color.muted,
            marginTop: 3,
          }}
        >
          {note}
        </Text>
      ) : null}
      <View style={{ marginTop: 6 }}>
        {items.map((item, i) => (
          <ChecklistRow
            key={item.checklistItemId}
            item={item}
            docs={rest.docs}
            first={i === 0}
            uploading={rest.uploadingId === item.documentRequestId}
            onUpload={rest.onUpload}
            checksProps={rest.checksProps}
            answersProps={rest.answersProps}
            uploadError={
              rest.uploadFailure &&
              rest.uploadFailure.documentRequestId === item.documentRequestId
                ? rest.uploadFailure.message
                : null
            }
          />
        ))}
      </View>
    </View>
  );
}

// ── Empty / loading / error shells ────────────────────────────────────────────
function Empty({
  line,
  actionLabel,
  onAction,
}: {
  line: string;
  /** Optional link under the line (the empty-state pattern: icon + line + action). */
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 22, gap: 8 }}>
      <Ic.docs size={22} color={EX.color.muted} strokeWidth={1.8} />
      <Text
        style={{
          fontSize: 13.5,
          lineHeight: 19,
          color: EX.color.inkMuted,
          textAlign: 'center',
        }}
      >
        {line}
      </Text>
      {actionLabel && onAction ? (
        <PressableStatic
          onPress={onAction}
          accessibilityRole="link"
          hitSlop={6}
        >
          <Text
            style={{
              fontSize: 13.5,
              fontWeight: '700',
              color: EX.color.primary,
            }}
          >
            {actionLabel}
          </Text>
        </PressableStatic>
      ) : null}
    </View>
  );
}

/**
 * The checklist section. `checklist` is the query result; `docs` the
 * application's documents (to show each item's state); `uploadingId` the
 * documentRequestId currently uploading.
 */
export function DocumentChecklist({
  checklist,
  loading,
  error,
  onRetry,
  docs,
  uploadingId,
  onUpload,
  onOpenIntake,
  checksProps,
  uploadFailure,
  answersProps,
}: {
  checklist?: Checklist | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  docs: Document[];
  uploadingId: string | null;
  onUpload: (item: ChecklistItem) => void;
  /**
   * Opens the visit-details questions (#113). When given, the "answer your visit
   * details" empty state links there; without it (a route with no intake) the
   * line stays plain.
   */
  onOpenIntake?: () => void;
  /** Per-upload check data and actions (#115). */
  checksProps: ChecksProps;
  /** The last failed upload; shown inside the item it came from (#174). */
  uploadFailure?: UploadFailure | null;
  /** Answers for information items (#187). */
  answersProps?: AnswersProps;
}) {
  let body: React.ReactNode;
  if (loading) {
    body = (
      <View style={{ paddingVertical: 24, alignItems: 'center' }}>
        <ActivityIndicator color={EX.color.primary} />
      </View>
    );
  } else if (error) {
    body = (
      <View style={{ gap: 10 }}>
        <InlineError message="We couldn't load your document list." />
        <PressableStatic
          onPress={onRetry}
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
            Try again
          </Text>
        </PressableStatic>
      </View>
    );
  } else if (!checklist || checklist.items.length === 0) {
    // Before the visit details are answered, or when the route has no list.
    body = (
      <Empty
        line={
          checklist?.state === 'intake_needed'
            ? 'Answer your visit details and your document list will appear here.'
            : (checklist?.emptyReason ??
              'There is no document list for this visa yet.')
        }
        actionLabel={
          checklist?.state === 'intake_needed' && onOpenIntake
            ? 'Answer your visit details'
            : undefined
        }
        onAction={onOpenIntake}
      />
    );
  } else {
    const yours = checklist.items.filter((i) => i.holder === 'applicant');
    const sponsors = checklist.items.filter((i) => i.holder === 'sponsor');
    // #187: the list holds typed details as well as documents.
    const hasInfo = !!answersProps && checklist.items.some(isInformationItem);
    body = (
      <>
        {hasInfo ? (
          <View style={{ gap: 10, marginBottom: 13 }}>
            <InfoNote>
              Some items are details, not documents. Type them here so they’re
              ready when you fill in the official application.
            </InfoNote>
            {/* Answers could not be loaded: one error for the list; documents
                still render and upload normally. */}
            {answersProps?.answersError && !answersProps.answers ? (
              <View style={{ gap: 8 }}>
                <InlineError message="We couldn’t load your saved answers. Check your connection and try again." />
                <PressableStatic
                  onPress={answersProps.onRetryAnswers}
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
                    Try again
                  </Text>
                </PressableStatic>
              </View>
            ) : null}
            {answersProps?.locked ? (
              <Text
                style={{
                  fontSize: 13,
                  lineHeight: 19,
                  color: EX.color.inkMuted,
                }}
              >
                {ANSWERS_LOCKED_COPY}
              </Text>
            ) : null}
          </View>
        ) : null}
        <Group
          title="Yours"
          items={yours}
          docs={docs}
          uploadingId={uploadingId}
          onUpload={onUpload}
          checksProps={checksProps}
          uploadFailure={uploadFailure}
          answersProps={answersProps}
        />
        <Group
          title="Your sponsor's"
          note="Your sponsor has no account here. You upload their documents for them."
          items={sponsors}
          docs={docs}
          uploadingId={uploadingId}
          onUpload={onUpload}
          checksProps={checksProps}
          uploadFailure={uploadFailure}
          answersProps={answersProps}
        />
      </>
    );
  }

  // #187: the inner title follows the step title when typed details are listed.
  const titleHasInfo =
    !!answersProps &&
    !!checklist &&
    checklist.items.length > 0 &&
    checklist.items.some(isInformationItem);
  return (
    <>
      <SectionTitle>
        {titleHasInfo ? 'Your documents and details' : 'Your documents'}
      </SectionTitle>
      {body}
    </>
  );
}
