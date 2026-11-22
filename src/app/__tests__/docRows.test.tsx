// ─────────────────────────────────────────────────────────────────────────────
// japa#446: tappable document rows.
//
//   • Self-service `LiveDocRow`, rendered on its own with a stub opener: which
//     statuses are buttons, the chevron / spinner slot, the screen-wide lock,
//     the a11y label, agency-filed rows, and the error line under the
//     rejection band (band bottom margin 13, or 0 when an error follows).
//   • My documents (`documents.tsx`), rendered for real over stubbed data
//     hooks and a mocked `expo-web-browser`: a tap opens the in-app viewer
//     (never Linking / Safari), missing rows are inert, and a failure shows an
//     InlineError under the row instead of an Alert.
// ─────────────────────────────────────────────────────────────────────────────

const mockGetUrl = jest.fn<(id: string) => Promise<string | undefined>>();
const mockOpenBrowser =
  jest.fn<(url: string, opts?: unknown) => Promise<unknown>>();
let mockMyDocs: unknown[] = [];

jest.mock('react-native-reanimated', () =>
  jest.requireActual('react-native-reanimated/mock'),
);
jest.mock('react-native-worklets', () =>
  jest.requireActual('react-native-worklets/lib/module/mock'),
);
// RNGH (pulled in by the screen's sheets): inert stand-ins.
jest.mock('react-native-gesture-handler', () => {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const k of [
    'runOnJS',
    'activeOffsetY',
    'onUpdate',
    'onFinalize',
    'onStart',
  ])
    chain[k] = self;
  return {
    Gesture: { Pan: () => chain },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    GestureHandlerRootView: ({ children }: { children: React.ReactNode }) =>
      children,
  };
});
jest.mock('expo-blur', () => ({
  BlurView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: () => {},
}));
jest.mock('expo-haptics', () => ({ selectionAsync: async () => {} }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: (url: string, opts?: unknown) => mockOpenBrowser(url, opts),
}));
// The self-service screen module imports every data hook; none of them run in
// LiveDocRow, so the network and Firebase layers are stubbed out.
// The opener fetches the link via apiService.get('/documents/:id/download').
jest.mock('@/services/api.service', () => ({
  apiService: {
    get: async (path: string) => ({
      data: {
        downloadUrl: await mockGetUrl(
          path.replace(/^\/documents\//, '').replace(/\/download$/, ''),
        ),
      },
    }),
  },
}));
jest.mock('@react-native-firebase/app', () => ({ getApp: () => ({}) }));
jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: () => ({}),
  logEvent: async () => {},
  setUserId: async () => {},
  setUserProperties: async () => {},
  logScreenView: async () => {},
}));
jest.mock('@react-native-firebase/auth', () => ({ getAuth: () => ({}) }));
jest.mock('@react-native-firebase/crashlytics', () => ({
  getCrashlytics: () => ({}),
}));
jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: () => ({}),
}));
jest.mock('@/stores/auth.store', () => ({ useAuthStore: () => ({}) }));
jest.mock('@/config/env', () => ({ isSelfServiceOnly: () => true }));
jest.mock('@/hooks/useDocuments', () => ({
  useMyDocuments: () => ({
    data: mockMyDocs,
    isLoading: false,
    isError: false,
    isSuccess: true,
    refetch: jest.fn(),
  }),
  useSharedDocuments: () => ({
    data: [],
    isLoading: false,
    isError: false,
    isSuccess: true,
    refetch: jest.fn(),
  }),
  // Imported by the self-service screen module; unused by LiveDocRow.
  useApplicationDocuments: () => ({ data: [] }),
  useUploadDocument: () => ({}),
  useGetUploadUrl: () => ({}),
  useCreateDocument: () => ({}),
}));

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ActivityIndicator, Alert, Linking, Text } from 'react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import TestRenderer, { act } from 'react-test-renderer';
import { LiveDocRow } from '../self-service/[id]';
import DocumentsView from '../documents';
import type { DocumentOpener } from '@/components/explorer/openDocument';
import { DOC_OPEN_COPY } from '@/components/explorer/openDocumentCopy';
import { InlineError } from '@/components/explorer/AccountForm';
import type { Document, DocumentStatus } from '@/types/documents.type';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/** A backend document with the given status. */
function doc(status: DocumentStatus, over: Partial<Document> = {}): Document {
  return {
    id: 'doc1',
    applicationId: 'app1',
    requirementId: 'req1',
    userId: 'u1',
    fileName: 'passport.pdf',
    fileType: 'application/pdf',
    fileSizeMb: 1.2,
    storageUrl: 'documents/u1/passport.pdf',
    status,
    ...over,
  } as Document;
}

/** A stub opener whose state the test sets. */
function opener(over: Partial<DocumentOpener> = {}): DocumentOpener {
  return {
    openingId: null,
    locked: false,
    open: jest.fn(),
    errorFor: () => null,
    ...over,
  };
}

/** The host node carrying this testID (first match). */
function byId(tree: TestRenderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((n) => n.props.testID === id)[0];
}

/** The pressable (has onPress) carrying this testID, if any. */
function pressableById(tree: TestRenderer.ReactTestRenderer, id: string) {
  return tree.root.findAll(
    (n) => n.props.testID === id && typeof n.props.onPress === 'function',
  )[0];
}

function renderRow(d: Document, o: DocumentOpener) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<LiveDocRow doc={d} first opener={o} />);
  });
  return tree;
}

// ── Self-service LiveDocRow ──────────────────────────────────────────────────

describe('LiveDocRow', () => {
  it.each([
    'uploaded',
    'under_review',
    'verified',
    'rejected',
    'resubmission_required',
  ] as const)('%s is a button with a chevron that opens the file', (status) => {
    const o = opener();
    const tree = renderRow(doc(status), o);
    const row = pressableById(tree, 'doc-row-doc1');
    expect(row).toBeTruthy();
    expect(row.props.accessibilityRole).toBe('button');
    expect(row.props.accessibilityHint).toBe(DOC_OPEN_COPY.rowHint);
    act(() => row.props.onPress());
    expect(o.open).toHaveBeenCalledWith('doc1', { onBehalf: false });
  });

  it.each(['pending_upload', 'uploading'] as const)(
    '%s is not tappable: no button, no press',
    (status) => {
      const tree = renderRow(doc(status), opener());
      expect(pressableById(tree, 'doc-row-doc1')).toBeUndefined();
      // Still findable by id, but as a plain View without a role.
      const plain = byId(tree, 'doc-row-doc1');
      expect(plain).toBeTruthy();
      expect(plain.props.accessibilityRole).toBeUndefined();
    },
  );

  it('an agency-filed row opens too and says who added it', () => {
    const o = opener();
    const tree = renderRow(
      doc('verified', { uploadedOnBehalf: true, uploadedByName: 'Acme Visas' }),
      o,
    );
    const row = pressableById(tree, 'doc-row-doc1');
    expect(row.props.accessibilityLabel).toBe(
      'passport.pdf, Verified, Added by Acme Visas',
    );
    act(() => row.props.onPress());
    expect(o.open).toHaveBeenCalledWith('doc1', { onBehalf: true });
  });

  it('opening: the spinner replaces the chevron and the row is busy', () => {
    const tree = renderRow(
      doc('uploaded'),
      opener({ openingId: 'doc1', locked: true }),
    );
    const spinner = byId(tree, 'doc-row-doc1-opening');
    expect(spinner).toBeTruthy();
    expect(spinner.props.color).toBe('#F4516C');
    const row = pressableById(tree, 'doc-row-doc1');
    expect(row.props.accessibilityState).toEqual({
      busy: true,
      disabled: false,
    });
  });

  it('another row opening locks this one (disabled, no spinner)', () => {
    const tree = renderRow(
      doc('uploaded'),
      opener({ openingId: 'other', locked: true }),
    );
    expect(byId(tree, 'doc-row-doc1-opening')).toBeUndefined();
    const row = byId(tree, 'doc-row-doc1');
    expect(row.props.disabled).toBe(true);
    expect(row.props.accessibilityState).toEqual({
      busy: false,
      disabled: true,
    });
  });

  it('a rejected row keeps its band inside the button, and the error sits below it', () => {
    const d = doc('rejected', { rejectionReason: 'Scan is blurry' });
    // No error: the band carries the 13 bottom margin.
    let tree = renderRow(d, opener());
    const bandText = () =>
      tree.root.findAll(
        (n) => n.type === Text && n.props.children === 'Scan is blurry',
      )[0];
    expect(bandText()).toBeTruthy();
    const row = pressableById(tree, 'doc-row-doc1');
    expect(row.props.accessibilityLabel).toBe(
      'passport.pdf, Rejected. Scan is blurry',
    );
    const band = () => bandText().parent!.parent!;
    expect(band().props.style.marginBottom).toBe(13);

    // With an error: band margin 0, error 8 above / 13 below, indented 46.
    tree = renderRow(
      d,
      opener({
        errorFor: () => ({ message: DOC_OPEN_COPY.notAvailable }),
      }),
    );
    expect(band().props.style.marginBottom).toBe(0);
    const err = byId(tree, 'doc-row-doc1-error');
    expect(err.props.style).toEqual({
      marginLeft: 46,
      marginTop: 8,
      marginBottom: 13,
    });
    expect(err.findByType(InlineError).props.message).toBe(
      DOC_OPEN_COPY.notAvailable,
    );
    // The error is outside the row button (its action isn't nested in it).
    expect(
      pressableById(tree, 'doc-row-doc1').findAll(
        (n) => n.props.testID === 'doc-row-doc1-error',
      ),
    ).toHaveLength(0);
  });
});

// ── My documents ─────────────────────────────────────────────────────────────

function renderLibrary() {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    // japa#474: the screen's pull-to-refresh needs a query client.
    tree = TestRenderer.create(
      <QueryClientProvider client={new QueryClient()}>
        <DocumentsView />
      </QueryClientProvider>,
    );
  });
  return tree;
}

const flush = () => act(async () => {});

describe('My documents rows', () => {
  beforeEach(() => {
    mockGetUrl.mockReset();
    mockOpenBrowser.mockReset();
    mockMyDocs = [
      { doc: doc('verified', { id: 'v1' }), app: { id: 'app1' } },
      { doc: doc('pending_upload', { id: 'm1' }), app: { id: 'app1' } },
    ];
  });

  it('a tap opens the in-app viewer, not Safari', async () => {
    const openURL = jest.spyOn(Linking, 'openURL');
    mockGetUrl.mockResolvedValue('https://signed');
    mockOpenBrowser.mockResolvedValue({ type: 'opened' });
    const tree = renderLibrary();

    act(() => pressableById(tree, 'doc-row-v1').props.onPress());
    await flush();
    expect(mockGetUrl).toHaveBeenCalledWith('v1');
    expect(mockOpenBrowser).toHaveBeenCalledWith(
      'https://signed',
      expect.anything(),
    );
    expect(openURL).not.toHaveBeenCalled();
    openURL.mockRestore();
  });

  it('missing rows cannot be tapped', () => {
    const tree = renderLibrary();
    const row = byId(tree, 'doc-row-m1');
    expect(row.props.disabled).toBe(true);
    expect(row.props.accessibilityRole).toBeUndefined();
  });

  it('shows the spinner while fetching, with no dimming', () => {
    mockGetUrl.mockReturnValue(new Promise(() => {}));
    const tree = renderLibrary();
    act(() => pressableById(tree, 'doc-row-v1').props.onPress());
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(byId(tree, 'doc-row-v1-opening')).toBeTruthy();
    // The resolved (object) style PressableStatic hands to Pressable.
    const card = tree.root.findAll(
      (n) =>
        n.props.testID === 'doc-row-v1' &&
        typeof n.props.style === 'object' &&
        n.props.style !== null &&
        !Array.isArray(n.props.style),
    )[0];
    expect(card.props.style.opacity).toBe(1);
  });

  it('a failure shows an InlineError under the row, never an Alert', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    mockGetUrl.mockRejectedValue({ status: 0, code: 'NETWORK_ERROR' });
    const tree = renderLibrary();
    act(() => pressableById(tree, 'doc-row-v1').props.onPress());
    await flush();

    const err = byId(tree, 'doc-row-v1-error');
    expect(err.findByType(InlineError).props.message).toBe(
      DOC_OPEN_COPY.network,
    );
    expect(err.props.style).toEqual({ marginTop: 8 });
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
  });
});
