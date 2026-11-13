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
// A document is never listed twice: the screen filters documents that fulfil a
// checklist item out of its "Other documents" card (see `isChecklistDocument`).
//
// States: loading = coral spinner; empty = icon + one line; error = InlineError
// with retry. Generic: no destination, route or document is named here.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Text,
  View,
} from 'react-native';
import { PressableStatic } from '@/components/explorer/PressableStatic';
import { EX } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { Pill, SectionTitle } from '@/components/explorer/primitives';
import { InlineError } from '@/components/explorer/AccountForm';
import { Checklist, ChecklistItem } from '@/types/checklist.type';
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

/** The `requirementId` the backend gives an upload made against a request. */
export const checklistRequirementId = (documentRequestId: string) =>
  `docreq:${documentRequestId}`;

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

// What the applicant sees for an item: waiting, uploaded, accepted, needs another.
type ItemState =
  | 'waiting'
  | 'uploaded'
  | 'accepted'
  | 'needs_another'
  | 'not_needed';

const STATE_STYLE: Record<
  ItemState,
  { label: string; fg: string; bg: string }
> = {
  waiting: { label: 'Waiting', fg: '#8B8499', bg: 'rgba(23,19,38,0.06)' },
  uploaded: { label: 'Uploaded', fg: '#B26A14', bg: '#FCEAC8' },
  accepted: { label: 'Accepted', fg: '#1E8E55', bg: '#D6F2E2' },
  needs_another: { label: 'Needs another', fg: '#C0453C', bg: '#FBE3E1' },
  not_needed: { label: 'Not needed', fg: '#8B8499', bg: 'rgba(23,19,38,0.06)' },
};

/** Derive the state from the request status and the latest document on it. */
function itemState(item: ChecklistItem, docs: Document[]): ItemState {
  if (item.status === 'waived') return 'not_needed';
  if (!item.documentRequestId) return 'waiting';
  // Latest document uploaded against this item (the list is newest first).
  const doc = docs.find(
    (d) => d.requirementId === checklistRequirementId(item.documentRequestId!),
  );
  if (!doc) return 'waiting';
  if (doc.status === 'verified') return 'accepted';
  if (doc.status === 'rejected' || doc.status === 'resubmission_required')
    return 'needs_another';
  return 'uploaded';
}

// ── One item ──────────────────────────────────────────────────────────────────
function ChecklistRow({
  item,
  docs,
  first,
  uploading,
  onUpload,
  checksProps,
}: {
  item: ChecklistItem;
  docs: Document[];
  first: boolean;
  uploading: boolean;
  onUpload: (item: ChecklistItem) => void;
  checksProps: ChecksProps;
}) {
  const [open, setOpen] = useState(false);
  const state = itemState(item, docs);
  const s = STATE_STYLE[state];
  // Upload is offered while waiting or when another file is needed. A request
  // not yet stored (no id) cannot be uploaded against.
  const canUpload =
    !!item.documentRequestId &&
    (state === 'waiting' || state === 'needs_another');
  // The latest document uploaded against this item (#115): the check is about it.
  const latestDoc = item.documentRequestId
    ? docs.find(
        (d) =>
          d.requirementId === checklistRequirementId(item.documentRequestId!),
      )
    : undefined;
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
            {item.title}
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: EX.color.muted,
              marginTop: 1,
            }}
          >
            {item.required ? 'Required' : 'Optional'}
          </Text>
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
    body = (
      <>
        <Group
          title="Yours"
          items={yours}
          docs={docs}
          uploadingId={uploadingId}
          onUpload={onUpload}
          checksProps={checksProps}
        />
        <Group
          title="Your sponsor's"
          note="Your sponsor has no account here. You upload their documents for them."
          items={sponsors}
          docs={docs}
          uploadingId={uploadingId}
          onUpload={onUpload}
          checksProps={checksProps}
        />
      </>
    );
  }

  return (
    <>
      <SectionTitle>Your documents</SectionTitle>
      {body}
    </>
  );
}
