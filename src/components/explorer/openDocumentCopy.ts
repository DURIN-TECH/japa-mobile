// ── Copy for opening an uploaded document (japa#446) ─────────────────────────
// One line each: what went wrong + what to do (design system, "Content
// fundamentals"). Shown in an InlineError on the tapped row, never an Alert.
// Curly apostrophes, sentence case, no emoji. Copy from the design spec.
// ─────────────────────────────────────────────────────────────────────────────

export const DOC_OPEN_COPY = {
  /** Offline, timeout or a server error. */
  network: 'We couldn’t open this file. Check your connection and try again.',
  /** 409 INVALID_STORAGE_PATH: the stored file can't be signed. */
  badFile:
    'This file can’t be opened. Upload it again, or contact support and we’ll sort it out.',
  /**
   * 409 on a document the agency filed for the client (`uploadedOnBehalf`):
   * the client has no Upload button for it, so they ask the agency instead.
   * Orchestrator's answer to the spec's open question.
   */
  badFileAgency:
    'This file can’t be opened. Ask your agency to add it again, or contact support.',
  /** 403 / 404. */
  notAvailable: 'This file isn’t available any more.',
  /** Viewer failed to present, empty URL, anything unexpected. */
  generic: 'We couldn’t open this file. Please try again.',
  /** InlineError action labels. */
  retry: 'Try again',
  contactSupport: 'Contact support',
  /** Accessibility. */
  rowHint: 'Opens the file',
  openingLabel: 'Opening file',
  retryHint: 'Tries to open the file again',
  contactSupportHint: 'Opens your email app to write to Seli support',
} as const;
