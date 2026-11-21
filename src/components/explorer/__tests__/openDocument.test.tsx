// ─────────────────────────────────────────────────────────────────────────────
// japa#446: the shared "open an uploaded document" helper. Covers the
// openable-status rule, the error mapping (offline / 5xx, 409, 403 / 404,
// anything else), the per-tap fresh link into `openBrowserAsync`, the
// single-flight lock, the one-error-per-screen rule, the Contact support
// fallback, and that the signed URL is never logged.
// ─────────────────────────────────────────────────────────────────────────────

const mockGetUrl = jest.fn<(id: string) => Promise<string | undefined>>();
const mockOpenBrowser =
  jest.fn<(url: string, opts?: unknown) => Promise<unknown>>();
const mockOpenURL = jest.fn<(url: string) => Promise<unknown>>();

jest.mock('@/hooks/useDocuments', () => ({
  useGetDownloadUrl: () => ({ mutateAsync: mockGetUrl }),
}));
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: (url: string, opts?: unknown) => mockOpenBrowser(url, opts),
}));

import React from 'react';
import { AccessibilityInfo, Linking } from 'react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import TestRenderer, { act } from 'react-test-renderer';
import {
  classifyOpenError,
  fetchAndOpenDocument,
  isDocumentOpenable,
  isLibraryDocOpenable,
  openErrorMessage,
  useOpenDocument,
  type DocumentOpener,
  type OpenDeps,
} from '../openDocument';
import { DOC_OPEN_COPY } from '../openDocumentCopy';
import { SETTINGS_LINKS } from '../settingsLogic';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const SIGNED = 'https://storage.example/signed?X-Goog-Signature=secret';

/** An `ApiError` as `apiService` rejects with it. */
const apiError = (status: number, code = 'X') => ({
  status,
  code,
  message: 'm',
});

/** A promise plus its resolve / reject handles. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Let pending promise callbacks run inside act. */
const flush = () => act(async () => {});

beforeEach(() => {
  mockGetUrl.mockReset();
  mockOpenBrowser.mockReset();
  mockOpenURL.mockReset();
  jest
    .spyOn(Linking, 'openURL')
    .mockImplementation((u: string) => mockOpenURL(u) as Promise<true>);
  jest
    .spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockImplementation(() => {});
});

// ── Status rules ─────────────────────────────────────────────────────────────

describe('isDocumentOpenable (self-service)', () => {
  it.each([
    'uploaded',
    'under_review',
    'verified',
    'rejected',
    'resubmission_required',
  ] as const)('%s has a file and opens', (status) => {
    expect(isDocumentOpenable(status)).toBe(true);
  });

  it.each(['pending_upload', 'uploading'] as const)(
    '%s has nothing to open',
    (status) => {
      expect(isDocumentOpenable(status)).toBe(false);
    },
  );
});

describe('isLibraryDocOpenable (My documents)', () => {
  it('opens every row except missing', () => {
    expect(isLibraryDocOpenable('verified')).toBe(true);
    expect(isLibraryDocOpenable('uploaded')).toBe(true);
    expect(isLibraryDocOpenable('rejected')).toBe(true);
    expect(isLibraryDocOpenable('missing')).toBe(false);
  });
});

// ── Error mapping ────────────────────────────────────────────────────────────

describe('classifyOpenError', () => {
  it('no response (offline, timeout) is network', () => {
    expect(classifyOpenError(apiError(0, 'NETWORK_ERROR'))).toBe('network');
  });
  it('a 5xx is network', () => {
    expect(classifyOpenError(apiError(500))).toBe('network');
    expect(classifyOpenError(apiError(503))).toBe('network');
  });
  it('a 409 (INVALID_STORAGE_PATH or any) is badFile', () => {
    expect(classifyOpenError(apiError(409, 'INVALID_STORAGE_PATH'))).toBe(
      'badFile',
    );
    expect(classifyOpenError(apiError(409, 'OTHER'))).toBe('badFile');
  });
  it('403 and 404 are notAvailable', () => {
    expect(classifyOpenError(apiError(403))).toBe('notAvailable');
    expect(classifyOpenError(apiError(404))).toBe('notAvailable');
  });
  it('anything else is generic', () => {
    expect(classifyOpenError(apiError(400))).toBe('generic');
    expect(classifyOpenError(new Error('boom'))).toBe('generic');
    expect(classifyOpenError(undefined)).toBe('generic');
  });
});

describe('openErrorMessage', () => {
  it('maps each kind to its spec line', () => {
    expect(openErrorMessage('network')).toBe(DOC_OPEN_COPY.network);
    expect(openErrorMessage('badFile')).toBe(DOC_OPEN_COPY.badFile);
    expect(openErrorMessage('notAvailable')).toBe(DOC_OPEN_COPY.notAvailable);
    expect(openErrorMessage('generic')).toBe(DOC_OPEN_COPY.generic);
  });
  it('agency-filed rows get the "ask your agency" 409 line', () => {
    expect(openErrorMessage('badFile', true)).toBe(DOC_OPEN_COPY.badFileAgency);
    // Only the 409 line changes.
    expect(openErrorMessage('network', true)).toBe(DOC_OPEN_COPY.network);
  });
});

// ── One attempt ──────────────────────────────────────────────────────────────

describe('fetchAndOpenDocument', () => {
  const deps = (over: Partial<OpenDeps>): OpenDeps => ({
    getUrl: async () => SIGNED,
    openBrowser: async () => ({ type: 'opened' }),
    wait: () => new Promise<void>(() => {}), // never: the browser decides
    ...over,
  });

  it('opens the viewer with the returned URL', async () => {
    const openBrowser = jest.fn(async () => ({ type: 'opened' }));
    const res = await fetchAndOpenDocument('d1', deps({ openBrowser }));
    expect(res).toEqual({ ok: true });
    expect(openBrowser).toHaveBeenCalledWith(SIGNED);
  });

  it('counts the sheet as presented once the window passes (iOS)', async () => {
    // iOS: openBrowserAsync only resolves on "Done", so the wait wins.
    const res = await fetchAndOpenDocument(
      'd1',
      deps({
        openBrowser: () => new Promise(() => {}),
        wait: async () => {},
      }),
    );
    expect(res).toEqual({ ok: true });
  });

  it('a viewer that fails to present is generic', async () => {
    const res = await fetchAndOpenDocument(
      'd1',
      deps({ openBrowser: async () => Promise.reject(new Error('busy')) }),
    );
    expect(res).toEqual({ ok: false, kind: 'generic' });
  });

  it('an empty URL is generic and never opens the viewer', async () => {
    const openBrowser = jest.fn(async () => ({}));
    const res = await fetchAndOpenDocument(
      'd1',
      deps({ getUrl: async () => '', openBrowser }),
    );
    expect(res).toEqual({ ok: false, kind: 'generic' });
    expect(openBrowser).not.toHaveBeenCalled();
  });

  it.each([
    [apiError(0), 'network'],
    [apiError(502), 'network'],
    [apiError(409, 'INVALID_STORAGE_PATH'), 'badFile'],
    [apiError(403), 'notAvailable'],
    [apiError(404), 'notAvailable'],
  ])('a failed link fetch maps to its kind (%j)', async (err, kind) => {
    const openBrowser = jest.fn(async () => ({}));
    const res = await fetchAndOpenDocument(
      'd1',
      deps({ getUrl: async () => Promise.reject(err), openBrowser }),
    );
    expect(res).toEqual({ ok: false, kind });
    expect(openBrowser).not.toHaveBeenCalled();
  });
});

// ── The hook ─────────────────────────────────────────────────────────────────

/** Mount the hook and hand back a getter for its latest value. */
function mountHook() {
  let latest: DocumentOpener | null = null;
  function Probe() {
    latest = useOpenDocument();
    return null;
  }
  act(() => {
    TestRenderer.create(<Probe />);
  });
  return () => latest!;
}

describe('useOpenDocument', () => {
  it('fetches a fresh link per tap and opens it in the viewer', async () => {
    mockGetUrl.mockResolvedValue(SIGNED);
    mockOpenBrowser.mockResolvedValue({ type: 'opened' });
    const hook = mountHook();

    act(() => hook().open('d1'));
    await flush();
    act(() => hook().open('d1'));
    await flush();

    // Two taps = two link fetches: nothing is cached.
    expect(mockGetUrl).toHaveBeenCalledTimes(2);
    expect(mockGetUrl).toHaveBeenCalledWith('d1');
    expect(mockOpenBrowser).toHaveBeenCalledTimes(2);
    expect(mockOpenBrowser.mock.calls[0][0]).toBe(SIGNED);
    expect(mockOpenBrowser.mock.calls[0][1]).toEqual(
      expect.objectContaining({ dismissButtonStyle: 'done' }),
    );
    expect(hook().openingId).toBeNull();
    expect(hook().errorFor('d1')).toBeNull();
  });

  it('a second tap while opening is ignored (single flight, no queue)', async () => {
    const link = deferred<string>();
    mockGetUrl.mockReturnValue(link.promise);
    mockOpenBrowser.mockResolvedValue({ type: 'opened' });
    const hook = mountHook();

    // Two taps in the same frame, then a tap on another row.
    act(() => {
      hook().open('d1');
      hook().open('d1');
    });
    act(() => hook().open('d2'));
    expect(hook().openingId).toBe('d1');
    expect(hook().locked).toBe(true);
    expect(mockGetUrl).toHaveBeenCalledTimes(1);

    await act(async () => link.resolve(SIGNED));
    await flush();
    expect(hook().locked).toBe(false);
    expect(hook().openingId).toBeNull();
    // Nothing queued: d2 never ran.
    expect(mockGetUrl).toHaveBeenCalledTimes(1);
    expect(mockOpenBrowser).toHaveBeenCalledTimes(1);
  });

  it('offline: shows the network line under that row with Try again', async () => {
    mockGetUrl.mockRejectedValue(apiError(0, 'NETWORK_ERROR'));
    const hook = mountHook();

    act(() => hook().open('d1'));
    await flush();

    const err = hook().errorFor('d1');
    expect(err?.message).toBe(DOC_OPEN_COPY.network);
    expect(err?.action?.label).toBe(DOC_OPEN_COPY.retry);
    expect(hook().errorFor('d2')).toBeNull();
    expect(mockOpenBrowser).not.toHaveBeenCalled();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      DOC_OPEN_COPY.network,
    );

    // Try again runs the open again and, on success, clears the error.
    mockGetUrl.mockResolvedValue(SIGNED);
    mockOpenBrowser.mockResolvedValue({ type: 'opened' });
    act(() => err!.action!.onPress());
    await flush();
    expect(mockOpenBrowser).toHaveBeenCalledWith(SIGNED, expect.anything());
    expect(hook().errorFor('d1')).toBeNull();
  });

  it('403 / 404: the not-available line, no action', async () => {
    mockGetUrl.mockRejectedValue(apiError(403));
    const hook = mountHook();
    act(() => hook().open('d1'));
    await flush();
    expect(hook().errorFor('d1')).toEqual({
      message: DOC_OPEN_COPY.notAvailable,
      action: undefined,
      selectable: undefined,
    });
  });

  it('409: badFile + Contact support, and shows again on every tap', async () => {
    mockGetUrl.mockRejectedValue(apiError(409, 'INVALID_STORAGE_PATH'));
    const hook = mountHook();

    act(() => hook().open('d1'));
    await flush();
    expect(hook().errorFor('d1')?.message).toBe(DOC_OPEN_COPY.badFile);
    expect(hook().errorFor('d1')?.action?.label).toBe(
      DOC_OPEN_COPY.contactSupport,
    );

    // Tapping again clears it while the attempt runs, then shows it again.
    const again = deferred<string>();
    mockGetUrl.mockReturnValueOnce(again.promise);
    act(() => hook().open('d1'));
    expect(hook().errorFor('d1')).toBeNull();
    await act(async () => again.reject(apiError(409)));
    await flush();
    expect(hook().errorFor('d1')?.message).toBe(DOC_OPEN_COPY.badFile);
  });

  it('409 on an agency-filed row uses the "ask your agency" line', async () => {
    mockGetUrl.mockRejectedValue(apiError(409));
    const hook = mountHook();
    act(() => hook().open('d1', { onBehalf: true }));
    await flush();
    expect(hook().errorFor('d1')?.message).toBe(DOC_OPEN_COPY.badFileAgency);
  });

  it('Contact support opens mail; with no mail app the line becomes the address', async () => {
    mockGetUrl.mockRejectedValue(apiError(409));
    const hook = mountHook();
    act(() => hook().open('d1'));
    await flush();

    mockOpenURL.mockRejectedValue(new Error('no mail app'));
    act(() => hook().errorFor('d1')!.action!.onPress());
    await flush();
    expect(mockOpenURL).toHaveBeenCalledWith(SETTINGS_LINKS.contact.url);
    expect(hook().errorFor('d1')).toEqual({
      message: SETTINGS_LINKS.contact.failure,
      action: undefined,
      selectable: true,
    });
  });

  it('one error per screen: a new error elsewhere replaces it', async () => {
    mockGetUrl.mockRejectedValue(apiError(404));
    const hook = mountHook();
    act(() => hook().open('d1'));
    await flush();
    act(() => hook().open('d2'));
    await flush();
    expect(hook().errorFor('d1')).toBeNull();
    expect(hook().errorFor('d2')?.message).toBe(DOC_OPEN_COPY.notAvailable);
  });

  it('a viewer that refuses to present shows the generic line', async () => {
    mockGetUrl.mockResolvedValue(SIGNED);
    mockOpenBrowser.mockRejectedValue(new Error('Another browser is open'));
    const hook = mountHook();
    act(() => hook().open('d1'));
    await flush();
    expect(hook().errorFor('d1')?.message).toBe(DOC_OPEN_COPY.generic);
    expect(hook().errorFor('d1')?.action?.label).toBe(DOC_OPEN_COPY.retry);
  });

  it('never logs the signed URL', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(
      (m) => jest.spyOn(console, m).mockImplementation(() => {}),
    );
    mockGetUrl.mockResolvedValue(SIGNED);
    mockOpenBrowser.mockRejectedValueOnce(new Error('fail'));
    const hook = mountHook();
    act(() => hook().open('d1'));
    await flush();
    mockOpenBrowser.mockResolvedValue({ type: 'opened' });
    act(() => hook().open('d1'));
    await flush();

    for (const spy of spies) {
      const logged = JSON.stringify(spy.mock.calls);
      expect(logged).not.toContain('X-Goog-Signature');
      expect(logged).not.toContain('storage.example');
      spy.mockRestore();
    }
  });
});
