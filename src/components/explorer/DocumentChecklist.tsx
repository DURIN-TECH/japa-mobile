// ─────────────────────────────────────────────────────────────────────────────
// DocumentChecklist (issue #114) — the applicant's personal document list on
// the live self-service screen.
//
// The list is decided on the server, in code, from the approved visa rubric
// and the applicant's visit details; this component only RENDERS it.
//
// Issue #256: items are grouped into white cards by holder x kind ("Your
// documents", "Your details", "Your sponsor's documents/details"; empty cards
// are hidden). Inside a card each item is a ROW: icon tile, title, a status line
// ("Required · Not uploaded"), then a coral Upload button (replaces the Waiting
// pill) or a state pill. Every row has a collapsed "Official requirement" with
// the verbatim quote and a link to the official page. The reason line is not shown.
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
import { EX, EXShadow } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { Pill, SectionTitle } from '@/components/explorer/primitives';
import { InlineError } from '@/components/explorer/AccountForm';
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
  groupChecklistItems,
  GROUP_COPY,
  isDoneState,
  isInformationItem,
  itemState,
  latestDocFor,
  statusLine,
  type GroupId,
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
  /** The visa country (ISO alpha-2): the money fields' default currency. */
  countryCode?: string;
  /** Saved answers by item id; undefined until the fetch succeeds. */
  answers?: Record<string, SavedAnswer>;
  answersLoading: boolean;
  answersError: boolean;
  onRetryAnswers: () => void;
  /** Sends one validated answer value ('' clears; rejects on failure). */
  saveAnswer: (
    itemId: string,
    value: AnswerValue | '' | null,
  ) => Promise<unknown>;
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

// State pill colours, from the system's status maps (no hard-coded hex).
const STATE_STYLE: Record<
  ItemState,
  { label: string; fg: string; bg: string }
> = {
  answered: {
    label: 'Answered',
    fg: EX.status.approved.fg,
    bg: EX.status.approved.bg,
  },
  waiting: { label: 'Waiting', fg: EX.status.draft.fg, bg: EX.status.draft.bg },
  uploaded: {
    label: 'Uploaded',
    fg: EX.status.documents.fg,
    bg: EX.status.documents.bg,
  },
  accepted: {
    label: 'Accepted',
    fg: EX.status.approved.fg,
    bg: EX.status.approved.bg,
  },
  needs_another: {
    label: 'Needs another',
    fg: EX.docStatus.rejected.fg,
    bg: EX.docStatus.rejected.bg,
  },
  not_needed: {
    label: 'Not needed',
    fg: EX.status.draft.fg,
    bg: EX.status.draft.bg,
  },
};

/**
 * Tile colours per state (#256): neutral states are quiet, the others borrow
 * the state's status pair. `tone` colours the status line text; neutral uses
 * ink-muted (never `muted`, 3.5:1).
 */
function tileStyle(state: ItemState): { bg: string; fg: string; tone: string } {
  switch (state) {
    case 'uploaded':
      return { ...STATE_STYLE.uploaded, tone: STATE_STYLE.uploaded.fg };
    case 'accepted':
    case 'answered':
      return { ...STATE_STYLE.accepted, tone: STATE_STYLE.accepted.fg };
    case 'needs_another':
      return {
        ...STATE_STYLE.needs_another,
        tone: STATE_STYLE.needs_another.fg,
      };
    default:
      return {
        bg: EX.color.line06,
        fg: EX.color.inkMuted,
        tone: EX.color.inkMuted,
      };
  }
}

// ── Official requirement (footer of every item) ──────────────────────────────
// Collapsed by default; reveals the verbatim quote, the rule reference and a
// link to the official page. No animation (reduced motion; LayoutAnimation can't
// use the system curve). Text is ink-2, only the chevron is coral (contrast).
function OfficialRequirement({ item }: { item: ChecklistItem }) {
  const [open, setOpen] = useState(false);
  const { quote, ruleRef, url } = item.citation;
  return (
    <View>
      <PressableStatic
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Official requirement for ${item.title}`}
        accessibilityHint="Shows the official wording"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: 4,
          minHeight: 44,
        }}
      >
        <Text
          style={{ fontSize: 12.5, fontWeight: '700', color: EX.color.ink2 }}
        >
          Official requirement
        </Text>
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          <Ic.chevR size={14} color={EX.color.primary} strokeWidth={2} />
        </View>
      </PressableStatic>
      {open ? (
        <View
          style={{
            marginBottom: 4,
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
            “{quote}”
          </Text>
          {ruleRef ? (
            <Text
              style={{ fontSize: 12, color: EX.color.inkMuted, marginTop: 4 }}
            >
              {ruleRef}
            </Text>
          ) : null}
          {/* Link row only when there is a page: no empty gap otherwise. */}
          {url ? (
            <PressableStatic
              onPress={() => Linking.openURL(url)}
              accessibilityRole="link"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                alignSelf: 'flex-start',
                gap: 4,
                minHeight: 44,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: EX.color.ink,
                  textDecorationLine: 'underline',
                }}
              >
                Read the official page
              </Text>
              <Ic.arrowUR size={14} color={EX.color.primary} strokeWidth={2} />
            </PressableStatic>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ── Coral upload button (38px) ────────────────────────────────────────────────
function UploadButton({
  label,
  uploading,
  onPress,
}: {
  label: string;
  uploading: boolean;
  onPress: () => void;
}) {
  return (
    <PressableStatic
      onPress={onPress}
      disabled={uploading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: EX.color.primary,
        borderRadius: 13,
        height: 38,
        paddingHorizontal: 14,
        opacity: uploading ? 0.7 : 1,
      }}
    >
      {uploading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Ic.upload size={15} color="#fff" strokeWidth={2} />
      )}
      <Text style={{ color: '#fff', fontSize: 13.5, fontWeight: '700' }}>
        {label}
      </Text>
    </PressableStatic>
  );
}

// ── One item row inside a group card ─────────────────────────────────────────
// Header: tile, text column (title, status line, clause, notice, buttons),
// right slot (Upload button while waiting, else the state pill). A detail's
// answer field sits under the header at full card width.
function ItemRow({
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
  /** japa#174: message of a failed upload made from THIS item (shown in its row). */
  uploadError?: string | null;
  /** #187: answers data for information items. */
  answersProps?: AnswersProps;
}) {
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
  const tile = tileStyle(state);
  // Upload is offered while waiting or when another file is needed. A request
  // not yet stored (no id) cannot be uploaded against.
  const canUpload =
    !info &&
    !!item.documentRequestId &&
    (state === 'waiting' || state === 'needs_another');
  // Plain "Upload" sits in the right slot (it replaces the Waiting pill). A retry
  // or "Upload another" is longer, so it goes under the status line instead.
  const uploadInSlot = canUpload && state === 'waiting' && !uploadError;
  const uploadBelow = canUpload && !uploadInSlot;
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
  const waived = state === 'not_needed';
  // Neutral tile icon by kind; accepted / needs-another swap in a check / X.
  const TileIcon =
    state === 'accepted' || state === 'answered'
      ? Ic.check
      : state === 'needs_another'
        ? Ic.x
        : info
          ? Ic.edit
          : Ic.docs;

  return (
    <View
      style={{
        borderTopWidth: first ? 0 : 1,
        borderTopColor: EX.color.line06,
        paddingVertical: 14,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        {/* Leading tile: decorative, the status line carries the meaning. */}
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tile.bg,
          }}
        >
          <TileIcon size={20} color={tile.fg} strokeWidth={1.8} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: '600',
              color: waived ? EX.color.inkMuted : EX.color.ink,
            }}
          >
            {sentenceCase(item.title)}
          </Text>
          {/* Status line: need label first (it carries the condition), state
              second. Neutral = ink-muted, never `muted` (3.58:1 on white). */}
          <Text
            style={{
              fontSize: 12.5,
              fontWeight: '600',
              color: tile.tone,
              marginTop: 2,
            }}
          >
            {statusLine(item, state, info)}
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

          {uploadBelow ? (
            <View style={{ marginTop: 10, alignSelf: 'flex-start' }}>
              <UploadButton
                label={
                  uploading
                    ? 'Uploading…'
                    : uploadError
                      ? 'Try again'
                      : 'Upload another'
                }
                uploading={uploading}
                onPress={() => onUpload(item)}
              />
            </View>
          ) : null}

          {/* Documents: the official wording sits in the text column. */}
          {!info ? <OfficialRequirement item={item} /> : null}
        </View>

        {/* Right slot: never shrinks below its content. */}
        <View style={{ flexShrink: 0 }}>
          {uploadInSlot ? (
            <UploadButton
              label={uploading ? 'Uploading…' : 'Upload'}
              uploading={uploading}
              onPress={() => onUpload(item)}
            />
          ) : (
            <Pill label={s.label} fg={s.fg} bg={s.bg} small />
          )}
        </View>
      </View>

      {/* Information item (#187): the answer field, full card width. */}
      {info && answersProps && !waived ? (
        answersProps.answers || hasDraft ? (
          <InformationAnswer
            applicationId={answersProps.applicationId}
            itemId={item.checklistItemId}
            title={item.title}
            answerType={item.answerType}
            currencyHint={[item.title, item.appliesWhen].join(' ')}
            countryCode={answersProps.countryCode}
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
              marginTop: 12,
              minHeight: 92,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: EX.color.cardWhite,
              borderWidth: 1,
              borderColor: EX.color.line10,
              borderRadius: EX.radius.cardSm,
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
              marginTop: 12,
            }}
          >
            Your answer will show here once it loads.
          </Text>
        )
      ) : null}

      {/* Details: the official wording sits under the field, full width. */}
      {info ? <OfficialRequirement item={item} /> : null}
    </View>
  );
}

// ── One group card ("Your documents", "Your details", ...) ───────────────────
function GroupCard({
  groupId,
  items,
  ...rest
}: {
  groupId: GroupId;
  items: ChecklistItem[];
  docs: Document[];
  uploadingId: string | null;
  onUpload: (item: ChecklistItem) => void;
  checksProps: ChecksProps;
  uploadFailure?: UploadFailure | null;
  answersProps?: AnswersProps;
}) {
  // Hidden when empty (the caller already drops empty groups).
  if (items.length === 0) return null;
  const { title, note } = GROUP_COPY[groupId];
  // "2 of 3 done": accepted / answered / not needed count as done.
  const done = items.filter((i) =>
    isDoneState(
      itemState(
        i,
        rest.docs,
        isInformationItem(i) && rest.answersProps
          ? rest.answersProps.answers
          : null,
      ),
    ),
  ).length;
  const allDone = done === items.length;
  return (
    <View
      style={{
        backgroundColor: EX.color.cardWhite,
        borderRadius: EX.radius.card,
        borderWidth: 1,
        borderColor: EX.color.line08,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 6,
        marginBottom: 13,
        ...EXShadow.card,
      }}
    >
      {/* Header: status circle (decorative), title, count (the accessible text). */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: allDone ? EX.color.teal : EX.color.line06,
          }}
        >
          {allDone ? (
            <Ic.check size={13} color="#fff" strokeWidth={2.4} />
          ) : null}
        </View>
        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            fontSize: 18,
            fontWeight: '700',
            color: EX.color.ink,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: 12.5,
            fontWeight: '600',
            color: EX.color.inkMuted,
          }}
        >
          {`${done} of ${items.length} done`}
        </Text>
      </View>
      <Text
        style={{
          fontSize: 13.5,
          lineHeight: 20,
          color: EX.color.inkMuted,
          marginTop: 4,
          marginBottom: 8,
        }}
      >
        {note}
      </Text>
      <View>
        {items.map((item, i) => (
          <ItemRow
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
    const groups = groupChecklistItems(checklist.items, !!answersProps);
    // #187: the list holds typed details as well as documents.
    const hasInfo = !!answersProps && checklist.items.some(isInformationItem);
    body = (
      <>
        {hasInfo ? (
          <View style={{ gap: 10, marginBottom: 13 }}>
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
        {/* #256: one card per holder x kind; empty cards are left out. */}
        {groups.map((g) => (
          <GroupCard
            key={g.id}
            groupId={g.id}
            items={g.items}
            docs={docs}
            uploadingId={uploadingId}
            onUpload={onUpload}
            checksProps={checksProps}
            uploadFailure={uploadFailure}
            answersProps={answersProps}
          />
        ))}
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
