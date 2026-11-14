// ─────────────────────────────────────────────────────────────────────────────
// Feedback — pure logic (issue #257)
//
// Everything the feedback button and sheet decide that does not need React:
// when the button shows, what the route looks like, whether Send is enabled,
// the character counter, and which message an error becomes. Kept free of
// native imports so it is unit-tested directly.
// ─────────────────────────────────────────────────────────────────────────────

/** What the tester is reporting. Mirrors the backend's `kind`. */
export type FeedbackKind = 'bug' | 'idea';

/** Longest message the backend accepts. */
export const MAX_MESSAGE_LENGTH = 2000;

/** The counter appears from this many characters. */
export const COUNTER_FROM = 1800;

/** The success view closes itself after this long (ms). */
export const SUCCESS_CLOSE_MS = 1800;

// ── Copy (one place, so the sheet and the tests agree) ──────────────────────
export const FEEDBACK_COPY = {
  title: 'Send feedback',
  subtitle: 'Tell us what went wrong or what you’d like to see.',
  messageLabel: 'Your message',
  placeholder: {
    none: 'Tell us in your own words.',
    bug: 'What happened, and what did you expect?',
    idea: 'What would make Seli better for you?',
  },
  kinds: {
    bug: { name: 'Bug', line: 'Something isn’t working' },
    idea: { name: 'Idea', line: 'Something you’d like to see' },
  },
  screenshotTitle: 'Screenshot of this screen',
  screenshotNote:
    'Included so we can see what you saw. Remove it if it shows anything private.',
  screenshotRemoved: 'No screenshot will be sent.',
  addItBack: 'Add it back',
  captureFailed:
    'We couldn’t capture this screen. Your feedback will send without it.',
  autoInfo:
    'We’ll also include the screen you’re on, your app version and your device. This helps us fix things faster.',
  send: 'Send feedback',
  sending: 'Sending…',
  tryAgain: 'Try again',
  cancel: 'Cancel',
  done: 'Done',
  errorGeneric:
    'We couldn’t send your feedback. Check your connection and try again.',
  errorRateLimited:
    'You’ve sent a lot of feedback in the last hour. Please try again a little later.',
  successTitle: 'Thanks, we’ve got it',
  successLine: 'Your note is with the Seli team.',
  discardTitle: 'Discard this feedback?',
  discardMessage: 'What you wrote won’t be saved.',
  keepWriting: 'Keep writing',
  discard: 'Discard',
  buttonLabel: 'Send feedback',
  buttonHint: 'Opens a form to report a bug or share an idea',
  removeScreenshot: 'Remove screenshot',
  settingsLabel: 'Show feedback button',
  settingsCaption: 'A small button for sending bugs and ideas from any screen.',
} as const;

// ── Visibility ──────────────────────────────────────────────────────────────

/** Top-level route segments where the button never shows (auth, onboarding, dead routes). */
const HIDDEN_FIRST_SEGMENTS = ['(auth)', '(onboard)', '+not-found'];

/** Inputs to the "show the floating button?" decision. */
export interface ButtonVisibilityInput {
  /** Build flag (EXPO_PUBLIC_FEEDBACK_ENABLED). */
  buildEnabled: boolean;
  /** Settings toggle. */
  userEnabled: boolean;
  isAuthenticated: boolean;
  /** Router segments of the current screen (`useSegments()`). */
  segments: readonly string[];
  keyboardOpen: boolean;
  sheetOpen: boolean;
  /** True while the screenshot is being taken (button must not be in it). */
  capturing: boolean;
}

/** True when the floating button should be on screen. */
export function shouldShowFeedbackButton(i: ButtonVisibilityInput): boolean {
  if (!i.buildEnabled || !i.userEnabled || !i.isAuthenticated) return false;
  if (i.keyboardOpen || i.sheetOpen || i.capturing) return false;
  const first = i.segments[0];
  // `undefined` = the "/" index redirect, not a real screen yet.
  if (first === undefined || HIDDEN_FIRST_SEGMENTS.includes(first))
    return false;
  return true;
}

/**
 * The screen the tester is on, WITHOUT params: the route pattern built from
 * the segments ("/application/[id]", "/home"; route groups dropped), so no record id or
 * query string ever leaves the device. Capped at the backend's 200 characters.
 */
export function routeFromSegments(segments: readonly string[]): string {
  // Route groups like "(tabs)" are layout detail, not screens: drop them.
  const route = '/' + segments.filter((s) => !/^\(.*\)$/.test(s)).join('/');
  return route.slice(0, 200);
}

// ── Form ────────────────────────────────────────────────────────────────────

/** Send is enabled once a kind is chosen and the trimmed message is 1..2000 chars. */
export function canSend(kind: FeedbackKind | null, message: string): boolean {
  if (!kind) return false;
  const n = message.trim().length;
  return n >= 1 && n <= MAX_MESSAGE_LENGTH;
}

/** Format a count with a thousands comma: 1850 -> "1,850". */
function fmt(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Counter text, shown only from 1,800 characters (null before that). */
export function counterText(length: number): string | null {
  if (length < COUNTER_FROM) return null;
  const base = `${fmt(length)} / ${fmt(MAX_MESSAGE_LENGTH)}`;
  return length >= MAX_MESSAGE_LENGTH ? `${base} · That’s the limit` : base;
}

/** Placeholder for the message box, by chosen kind. */
export function placeholderFor(kind: FeedbackKind | null): string {
  return FEEDBACK_COPY.placeholder[kind ?? 'none'];
}

/** What a failed send becomes on screen: 429 gets its own line, everything else the generic one. */
export function sendErrorMessage(error: unknown): string {
  const status =
    typeof error === 'object' && error !== null
      ? (error as { status?: unknown }).status
      : undefined;
  return status === 429
    ? FEEDBACK_COPY.errorRateLimited
    : FEEDBACK_COPY.errorGeneric;
}
