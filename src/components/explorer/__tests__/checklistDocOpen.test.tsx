// ─────────────────────────────────────────────────────────────────────────────
// japa#446: the uploaded file on a checklist item opens in the in-app viewer.
// The item's latest document (`latestDocFor`) gets a tappable file line with
// the spec's chevron / spinner slot, screen-wide lock, error line and testIDs
// (`doc-row-<documentId>`, `-opening`, `-error`), driven by the screen's
// shared opener (stubbed here).
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('expo-router', () => ({ useFocusEffect: () => {} }));
jest.mock('expo-secure-store', () => ({}));
// primitives.tsx pulls in reanimated, whose native part is absent under jest.
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'View', createAnimatedComponent: (c: unknown) => c },
  useAnimatedStyle: () => ({}),
  useSharedValue: (v: unknown) => ({ value: v }),
  withTiming: (v: unknown) => v,
  Easing: { bezier: () => ({}) },
}));
jest.mock('@/services/api.service', () => ({
  apiService: { get: jest.fn(), put: jest.fn() },
}));

import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, jest } from '@jest/globals';
import { DocumentChecklist } from '@/components/explorer/DocumentChecklist';
import { InlineError } from '@/components/explorer/AccountForm';
import type { DocumentOpener } from '@/components/explorer/openDocument';
import { DOC_OPEN_COPY } from '@/components/explorer/openDocumentCopy';
import type { Checklist, ChecklistItem } from '@/types/checklist.type';
import type { Document, DocumentStatus } from '@/types/documents.type';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const item = (over: Partial<ChecklistItem> = {}): ChecklistItem => ({
  checklistItemId: 'i1',
  title: 'bank statement',
  holder: 'applicant',
  required: true,
  reason: 'r',
  citation: { quote: 'Q', url: 'https://example.gov' },
  documentRequestId: 'r1',
  status: 'pending',
  current: true,
  ...over,
});
const checklist = (items: ChecklistItem[]): Checklist => ({
  state: 'ready',
  rubricVersion: 1,
  items,
});
const checksProps = {
  checksLoading: false,
  checksError: false,
  onReloadChecks: () => {},
  onRetryCheck: () => {},
  retryingDocId: null,
};

/** A document uploaded against item i1's request (requirementId docreq:r1). */
const doc = (status: DocumentStatus, over: Partial<Document> = {}) =>
  ({
    id: 'd1',
    applicationId: 'a1',
    requirementId: 'docreq:r1',
    userId: 'u1',
    fileName: 'statement.pdf',
    fileType: 'application/pdf',
    fileSizeMb: 1,
    storageUrl: 'documents/u1/a1/statement.pdf',
    status,
    ...over,
  }) as Document;

const stubOpener = (over: Partial<DocumentOpener> = {}): DocumentOpener => ({
  openingId: null,
  locked: false,
  open: jest.fn(),
  errorFor: () => null,
  ...over,
});

async function render(docs: Document[], opener?: DocumentOpener) {
  let r!: ReturnType<typeof create>;
  await act(async () => {
    r = create(
      <DocumentChecklist
        checklist={checklist([item()])}
        loading={false}
        error={false}
        onRetry={() => {}}
        docs={docs}
        uploadingId={null}
        onUpload={jest.fn()}
        checksProps={checksProps}
        opener={opener}
      />,
    );
  });
  return r;
}

/** The pressable (has onPress) with this testID, if any. */
const pressable = (r: ReturnType<typeof create>, id: string) =>
  r.root.findAll(
    (n) => n.props.testID === id && typeof n.props.onPress === 'function',
  )[0];
const byId = (r: ReturnType<typeof create>, id: string) =>
  r.root.findAll((n) => n.props.testID === id)[0];

describe('checklist item: uploaded file opens', () => {
  it.each(['uploaded', 'under_review', 'verified', 'rejected'] as const)(
    'a %s file is a button that opens through the shared opener',
    async (status) => {
      const o = stubOpener();
      const r = await render([doc(status)], o);
      const row = pressable(r, 'doc-row-d1');
      expect(row).toBeTruthy();
      expect(row.props.accessibilityRole).toBe('button');
      expect(row.props.accessibilityHint).toBe(DOC_OPEN_COPY.rowHint);
      expect(row.props.accessibilityLabel).toBe(
        'statement.pdf, bank statement',
      );
      await act(async () => row.props.onPress());
      expect(o.open).toHaveBeenCalledWith('d1', { onBehalf: false });
    },
  );

  it('an agency-filed file passes onBehalf (for the 409 line)', async () => {
    const o = stubOpener();
    const r = await render([doc('verified', { uploadedOnBehalf: true })], o);
    await act(async () => pressable(r, 'doc-row-d1').props.onPress());
    expect(o.open).toHaveBeenCalledWith('d1', { onBehalf: true });
  });

  it('no file line while the file is still uploading or pending', async () => {
    const r1 = await render([doc('uploading')], stubOpener());
    expect(byId(r1, 'doc-row-d1')).toBeUndefined();
    const r2 = await render([doc('pending_upload')], stubOpener());
    expect(byId(r2, 'doc-row-d1')).toBeUndefined();
  });

  it('no file line on an item with nothing uploaded, or without an opener', async () => {
    const r1 = await render([], stubOpener());
    expect(byId(r1, 'doc-row-d1')).toBeUndefined();
    const r2 = await render([doc('uploaded')]);
    expect(byId(r2, 'doc-row-d1')).toBeUndefined();
  });

  it('opening: coral spinner in the slot, row busy', async () => {
    const r = await render(
      [doc('uploaded')],
      stubOpener({ openingId: 'd1', locked: true }),
    );
    expect(byId(r, 'doc-row-d1-opening').props.color).toBe('#F4516C');
    expect(pressable(r, 'doc-row-d1').props.accessibilityState).toEqual({
      busy: true,
      disabled: false,
    });
  });

  it('another row opening locks this one', async () => {
    const r = await render(
      [doc('uploaded')],
      stubOpener({ openingId: 'other', locked: true }),
    );
    expect(byId(r, 'doc-row-d1-opening')).toBeUndefined();
    expect(byId(r, 'doc-row-d1').props.disabled).toBe(true);
  });

  it('the error line sits under the file line, outside the button', async () => {
    const r = await render(
      [doc('uploaded')],
      stubOpener({
        errorFor: (id) =>
          id === 'd1' ? { message: DOC_OPEN_COPY.network } : null,
      }),
    );
    const err = byId(r, 'doc-row-d1-error');
    expect(err.props.style).toEqual({ marginTop: 8 });
    expect(err.findByType(InlineError).props.message).toBe(
      DOC_OPEN_COPY.network,
    );
    expect(
      pressable(r, 'doc-row-d1').findAll(
        (n) => n.props.testID === 'doc-row-d1-error',
      ),
    ).toHaveLength(0);
  });
});
