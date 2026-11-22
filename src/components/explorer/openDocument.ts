// ─────────────────────────────────────────────────────────────────────────────
// Opening an uploaded document in the in-app viewer (japa#446).
//
// Shared by the self-service checklist (`LiveDocRow`) and My documents
// (`DocRow`) so both screens behave the same:
//
//   tap → fresh `GET /documents/:id/download` (signed read URL, 60 min)
//       → `expo-web-browser` `openBrowserAsync` (iOS: SFSafariViewController
//         with "Done"; Android: a Custom Tab). No new native module.
//
// Rules (design spec on japa#446):
//   • A fresh link per tap. The URL is never cached, stored or logged: it lives
//     only in a local variable for the length of one attempt.
//   • One open at a time per screen (a synchronous ref lock, so a double tap
//     inside one frame can't slip through), nothing queued.
//   • One error per screen. A new attempt clears it; a successful open clears
//     it; a repeat failure shows it again (never silent).
//   • Errors map to one line of Seli copy each (`DOC_OPEN_COPY`), shown in an
//     `InlineError` under the row. Never an `Alert`.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useRef, useState } from 'react';
import { AccessibilityInfo, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import type { InlineErrorAction } from './AccountForm';
import { EX } from './theme';
import { DOC_OPEN_COPY } from './openDocumentCopy';
import { SETTINGS_LINKS, openSettingsLink } from './settingsLogic';
import type { Doc } from '@/types/explorer.type';
import type { DocumentStatus } from '@/types/documents.type';
import { apiService } from '@/services/api.service';

// ── Which rows can be opened ─────────────────────────────────────────────────

/**
 * Self-service rule: a backend document has a file behind it unless it is
 * still waiting for one (`pending_upload`) or mid-upload (`uploading`).
 * Agency-filed and rejected documents are openable too.
 */
export function isDocumentOpenable(status: DocumentStatus): boolean {
  return status !== 'pending_upload' && status !== 'uploading';
}

/**
 * My documents rule (the screen's mapped `Doc` shape): every row except
 * `missing`, which has nothing to open (its Upload button is japa#421).
 */
export function isLibraryDocOpenable(status: Doc['status']): boolean {
  return status !== 'missing';
}

// ── Error mapping ────────────────────────────────────────────────────────────

/** The four failure lines in the spec's error table. */
export type DocOpenErrorKind =
  | 'network'
  | 'badFile'
  | 'notAvailable'
  | 'generic';

/**
 * Map a rejected `GET /documents/:id/download` to a failure kind.
 *
 * `apiService` rejects with an `ApiError` (`{ code, message, status }`):
 *   • status 0 = no response (offline, timeout, request never sent) → network
 *   • 5xx → network (a server blip; trying again may work)
 *   • 409 (INVALID_STORAGE_PATH, or any 409) → badFile
 *   • 403 / 404 → notAvailable (never confirms whose file it is)
 *   • anything else, including a non-ApiError throw → generic
 */
export function classifyOpenError(error: unknown): DocOpenErrorKind {
  const status =
    typeof error === 'object' && error !== null
      ? (error as { status?: unknown }).status
      : undefined;
  if (typeof status !== 'number') return 'generic';
  if (status === 0 || status >= 500) return 'network';
  if (status === 409) return 'badFile';
  if (status === 403 || status === 404) return 'notAvailable';
  return 'generic';
}

/**
 * The message for a failure kind. `onBehalf` (a document the agency filed for
 * the client) swaps the 409 line for the "ask your agency" variant, since the
 * client has no Upload button for those rows.
 */
export function openErrorMessage(
  kind: DocOpenErrorKind,
  onBehalf = false,
): string {
  switch (kind) {
    case 'network':
      return DOC_OPEN_COPY.network;
    case 'badFile':
      return onBehalf ? DOC_OPEN_COPY.badFileAgency : DOC_OPEN_COPY.badFile;
    case 'notAvailable':
      return DOC_OPEN_COPY.notAvailable;
    default:
      return DOC_OPEN_COPY.generic;
  }
}

// ── One attempt (pure, dependencies injected) ────────────────────────────────

/** How long a viewer has to fail before we count it as presented. */
export const VIEWER_PRESENT_MS = 600;

export interface OpenDeps {
  /** Mints a fresh signed URL for the document (GET /documents/:id/download). */
  getUrl: (documentId: string) => Promise<string | undefined | null>;
  /** Presents the in-app viewer (`WebBrowser.openBrowserAsync`). */
  openBrowser: (url: string) => Promise<unknown>;
  /** Waits `ms` (injected so tests needn't use real timers). */
  wait?: (ms: number) => Promise<void>;
}

export type OpenOutcome = { ok: true } | { ok: false; kind: DocOpenErrorKind };

const defaultWait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Fetch a fresh link and present the viewer. Never rejects.
 *
 * "Presented" is the earlier of: `openBrowser` resolving (Android resolves
 * once the Custom Tab is up; iOS resolves when "Done" closes the sheet) or
 * `VIEWER_PRESENT_MS` passing without it rejecting (iOS: the sheet is up and
 * covers the screen). That is when the spinner goes back to the chevron and
 * the lock lifts, as the spec asks. A rejection inside that window (another
 * browser already open, no browser on the device) is the generic error.
 */
export async function fetchAndOpenDocument(
  documentId: string,
  deps: OpenDeps,
): Promise<OpenOutcome> {
  // 1. A fresh signed link. The URL stays in this local only.
  let url: string | undefined | null;
  try {
    url = await deps.getUrl(documentId);
  } catch (error) {
    return { ok: false, kind: classifyOpenError(error) };
  }
  if (!url) return { ok: false, kind: 'generic' };

  // 2. Present the viewer; a quick rejection is a failure, anything else is
  //    an open. A late rejection after the window is swallowed (the sheet was
  //    shown) so it can't surface as an unhandled promise.
  const shown = deps.openBrowser(url);
  shown.catch(() => {});
  const wait = deps.wait ?? defaultWait;
  try {
    await Promise.race([shown, wait(VIEWER_PRESENT_MS)]);
    return { ok: true };
  } catch {
    return { ok: false, kind: 'generic' };
  }
}

// ── The hook both screens use ────────────────────────────────────────────────

/** Props for the row's `InlineError`, or null when the row has no error. */
export interface DocOpenErrorView {
  message: string;
  action?: InlineErrorAction;
  selectable?: boolean;
}

interface ErrorState extends DocOpenErrorView {
  documentId: string;
}

export interface DocumentOpener {
  /** The row whose link is being fetched (spinner), else null. */
  openingId: string | null;
  /** True while any row is opening: every row ignores taps. */
  locked: boolean;
  /** Start an open for this row (ignored while locked). */
  open: (documentId: string, opts?: { onBehalf?: boolean }) => void;
  /** The error to show under this row, if it is the screen's one error. */
  errorFor: (documentId: string) => DocOpenErrorView | null;
}

/** Viewer options: the system sheet as is, with Seli's coral controls. */
const VIEWER_OPTIONS: WebBrowser.WebBrowserOpenOptions = {
  dismissButtonStyle: 'done',
  controlsColor: EX.color.primary,
};

/**
 * One instance per screen. `deps` is for tests; screens call it bare and get
 * the real download hook and `expo-web-browser`.
 */
export function useOpenDocument(deps?: Partial<OpenDeps>): DocumentOpener {
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);
  // The synchronous lock: state updates land on the next render, a ref does
  // not, so two taps in the same frame still see the first one's lock.
  const lockRef = useRef(false);

  // Kept in refs so `open` is stable and always uses the latest deps.
  const depsRef = useRef<OpenDeps | null>(null);
  depsRef.current = {
    // Fetched straight through apiService, not the react-query mutation, so
    // the signed link lives only in this call's local scope and never sits in
    // the query cache as mutation data.
    getUrl:
      deps?.getUrl ??
      (async (id) =>
        (
          await apiService.get<{ downloadUrl: string }>(
            `/documents/${id}/download`,
          )
        ).data?.downloadUrl),
    openBrowser:
      deps?.openBrowser ??
      ((url) => WebBrowser.openBrowserAsync(url, VIEWER_OPTIONS)),
    wait: deps?.wait,
  };

  /** Show one error (replacing any other) and announce it to VoiceOver. */
  const showError = useCallback((next: ErrorState) => {
    setError(next);
    AccessibilityInfo.announceForAccessibility(next.message);
  }, []);

  const open = useCallback(
    (documentId: string, opts?: { onBehalf?: boolean }) => {
      if (lockRef.current) return; // single flight: ignore, don't queue
      lockRef.current = true;
      setOpeningId(documentId);
      // The new attempt clears the screen's error the moment it starts.
      setError(null);

      void fetchAndOpenDocument(documentId, depsRef.current!).then((res) => {
        lockRef.current = false;
        setOpeningId(null);
        if (res.ok) return;

        const onBehalf = !!opts?.onBehalf;
        const message = openErrorMessage(res.kind, onBehalf);
        // Action per the spec's table: retry for network / generic, contact
        // support for a 409, nothing for 403 / 404.
        let action: InlineErrorAction | undefined;
        if (res.kind === 'network' || res.kind === 'generic') {
          action = {
            label: DOC_OPEN_COPY.retry,
            hint: DOC_OPEN_COPY.retryHint,
            onPress: () => open(documentId, opts),
          };
        } else if (res.kind === 'badFile') {
          action = {
            label: DOC_OPEN_COPY.contactSupport,
            hint: DOC_OPEN_COPY.contactSupportHint,
            onPress: () => {
              void openSettingsLink(Linking, SETTINGS_LINKS.contact.url).then(
                (opened) => {
                  if (opened) return;
                  // No mail app: the line becomes the copyable address.
                  showError({
                    documentId,
                    message: SETTINGS_LINKS.contact.failure,
                    selectable: true,
                  });
                },
              );
            },
          };
        }
        showError({ documentId, message, action });
      });
    },
    [showError],
  );

  const errorFor = useCallback(
    (documentId: string): DocOpenErrorView | null => {
      if (!error || error.documentId !== documentId) return null;
      return {
        message: error.message,
        action: error.action,
        selectable: error.selectable,
      };
    },
    [error],
  );

  return { openingId, locked: openingId !== null, open, errorFor };
}
