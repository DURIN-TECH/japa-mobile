// ─────────────────────────────────────────────────────────────────────────────
// Answer saver (issue #187): the save rules of one information item, with no
// React in it so they can be tested with fake timers.
//
//   • `change(text)`   every keystroke; (re)starts the 1.5 s debounce.
//   • `flush()`        save right away (blur, screen blur, app to background,
//                      "Try again"). Used by the debounce timer too.
//   • Only the TRIMMED text is sent, and only when it differs from the last
//     saved text.
//   • One save in flight at a time. Typing during a save makes the newest text
//     save right after it.
//   • A failed save keeps everything: the caller's text is untouched, and the
//     next keystroke / flush / retry sends it again.
// The text is personal: it is never logged.
// ─────────────────────────────────────────────────────────────────────────────

/** Debounce after the last keystroke (ms). */
export const SAVE_DEBOUNCE_MS = 1500;

export type SaverStatus =
  | { phase: 'idle' }
  | { phase: 'saving' }
  | { phase: 'saved' }
  | { phase: 'error'; error: unknown; text: string };

export interface AnswerSaver {
  /** The input's text changed. */
  change: (text: string) => void;
  /** Save now if there is anything unsaved. */
  flush: () => void;
  /** The server's saved text (initial load, or a refetch while nothing is dirty). */
  setSaved: (text: string) => void;
  /** Stop timers and callbacks (unmount). An in-flight save still completes. */
  dispose: () => void;
  /** Undo `dispose` (a remount that reuses the saver, e.g. React StrictMode). */
  resume: () => void;
}

export function createAnswerSaver(opts: {
  /** Initial saved text (trimmed). */
  saved: string;
  /** Sends the trimmed text. Rejects on failure. */
  save: (trimmed: string) => Promise<void>;
  /** Status changes, for the SaveStatus line / InlineError. */
  onStatus: (s: SaverStatus) => void;
  /** After a successful save of `trimmed`; `latest` is the current raw text. */
  onSaved: (trimmed: string, latest: string) => void;
  delayMs?: number;
}): AnswerSaver {
  let saved = opts.saved.trim();
  let latest: string | null = null; // null = nothing typed since open
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let disposed = false;

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  let phase: SaverStatus['phase'] = 'idle';
  const status = (s: SaverStatus) => {
    phase = s.phase;
    if (!disposed) opts.onStatus(s);
  };

  const run = async (): Promise<void> => {
    if (latest === null || inFlight) return;
    const text = latest;
    const trimmed = text.trim();
    if (trimmed === saved) {
      // Edited back to the saved text after a failed save: nothing left to send.
      if (phase === 'error') status({ phase: 'idle' });
      return;
    }
    inFlight = true;
    status({ phase: 'saving' });
    try {
      await opts.save(trimmed);
      saved = trimmed;
      inFlight = false;
      // Called even after dispose: it only clears the in-memory draft.
      opts.onSaved(trimmed, latest ?? '');
      // Typed during the save: the newest text goes next.
      if ((latest ?? '').trim() !== saved) {
        status({ phase: 'saving' });
        void run();
      } else {
        status({ phase: 'saved' });
      }
    } catch (error) {
      inFlight = false;
      status({ phase: 'error', error, text: trimmed });
    }
  };

  return {
    change(text) {
      latest = text;
      clearTimer();
      if (disposed) return;
      timer = setTimeout(() => {
        timer = null;
        void run();
      }, opts.delayMs ?? SAVE_DEBOUNCE_MS);
    },
    flush() {
      clearTimer();
      void run();
    },
    setSaved(text) {
      // Never let the server's text stand in for something not yet saved.
      if (latest !== null && latest.trim() !== saved) return;
      saved = text.trim();
    },
    dispose() {
      // Unmount: send what is pending once more, then go quiet.
      clearTimer();
      void run();
      disposed = true;
    },
    resume() {
      disposed = false;
    },
  };
}
