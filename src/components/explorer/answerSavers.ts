// ─────────────────────────────────────────────────────────────────────────────
// Saver registry (issue #187): ONE answer saver per application + item, shared by
// every mount of that item's field.
//
// Why: the "one save in flight per item" rule lives inside a saver. If each
// mount made its own, leaving the screen mid-save and coming back would let two
// savers PUT at once (responses could land out of order, leaving an older text on
// the server while the field says "Saved"), and the first one's success could
// delete a newer draft. A shared saver also keeps its status, so a remounted
// field shows "Saving…" or the error that is still true.
//
// The mounted field plugs its callbacks into the entry's `holder`; on unmount it
// unplugs them and the saver carries on (an in-flight or pending save finishes).
// Entries are dropped on sign-out, when the application is locked, and when the
// item leaves the list. Never logs text.
// ─────────────────────────────────────────────────────────────────────────────

import {
  createAnswerSaver,
  type AnswerSaver,
  type SaverStatus,
} from '@/components/explorer/answerSaver';

/** Callbacks of the currently mounted field (or no-ops when none is mounted). */
export interface SaverHolder {
  save: (trimmed: string) => Promise<unknown>;
  onStatus: (s: SaverStatus) => void;
  onSaved: (trimmed: string, latest: string) => void;
}

interface Entry {
  saver: AnswerSaver;
  holder: SaverHolder;
  /** The latest status, for a field that mounts mid-save. */
  status: SaverStatus;
}

const registry = new Map<string, Entry>();

/** The shared saver for `key`, created on first use with `savedText` as baseline. */
export function acquireSaver(key: string, savedText: string): Entry {
  let entry = registry.get(key);
  if (!entry) {
    const holder: SaverHolder = {
      save: async () => {},
      onStatus: () => {},
      onSaved: () => {},
    };
    const created: Entry = {
      holder,
      status: { phase: 'idle' },
      saver: createAnswerSaver({
        saved: savedText,
        save: async (trimmed) => {
          await holder.save(trimmed);
        },
        onStatus: (s) => {
          created.status = s;
          holder.onStatus(s);
        },
        onSaved: (trimmed, latest) => holder.onSaved(trimmed, latest),
      }),
    };
    registry.set(key, created);
    entry = created;
  }
  return entry;
}

/** Stop and forget one item's saver, sending nothing more. */
export function dropSaver(key: string) {
  const e = registry.get(key);
  if (!e) return;
  e.saver.cancel();
  registry.delete(key);
}

/** Stop and forget every saver (sign-out). */
export function dropAllSavers() {
  registry.forEach((e) => e.saver.cancel());
  registry.clear();
}

/** Test helper: is there a saver for `key`? */
export const hasSaver = (key: string) => registry.has(key);
