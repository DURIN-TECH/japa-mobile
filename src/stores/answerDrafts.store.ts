// ─────────────────────────────────────────────────────────────────────────────
// Unsaved answer text (issue #187).
//
// Each information item's text that has NOT been saved yet is held here, keyed
// by application id + checklist item id, so typing is never lost to a failed or
// offline save, a scroll, leaving the screen, a refetch, or the app being killed.
//
// The store is the LIVE source (the field reads it). Every change is written
// through to an ENCRYPTED vault (expo-secure-store, see services/draftVault.ts),
// debounced, never AsyncStorage: these answers are personal details. The write is
// flushed at once when the app goes to the background or a field loses focus.
//
// Drafts belong to a user (Firebase uid): `loadFromVault(uid)` loads that user's
// drafts (older than 7 days dropped) and removes every other user's. A draft is
// deleted after a successful save; ALL are deleted on sign-out (subscription in
// auth.store.ts). A load that began before a sign-out is discarded (generation
// counter). Never logged.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { secureStoreVault, type DraftVault } from '@/services/draftVault';
import { dropAllSavers, dropSaver } from '@/components/explorer/answerSavers';

/** Write-through delay: typing is not hitting the Keychain on every key. */
export const VAULT_WRITE_DEBOUNCE_MS = 800;

// The backend (swappable for tests).
let vault: DraftVault = secureStoreVault;
export const setDraftVault = (v: DraftVault) => {
  vault = v;
};

/** Bumped by every sign-out, so a load that started earlier can be discarded. */
let generation = 0;

/** Pending debounced vault writes by draft key: the timer and what it will do. */
const pendingWrites = new Map<
  string,
  { timer: ReturnType<typeof setTimeout>; run: () => void }
>();
const cancelWrite = (key: string) => {
  const p = pendingWrites.get(key);
  if (p) clearTimeout(p.timer);
  pendingWrites.delete(key);
};

/** Store key for one item of one application. */
export const draftKey = (applicationId: string, itemId: string) =>
  `${applicationId}:${itemId}`;

interface AnswerDraftsState {
  /** The signed-in user the drafts belong to (null until `loadFromVault`). */
  uid: string | null;
  /** Unsaved text by `draftKey`. An absent key means "no draft". */
  drafts: Record<string, string>;
  setDraft: (applicationId: string, itemId: string, text: string) => void;
  clearDraft: (applicationId: string, itemId: string) => void;
  /** Sign-out: forget every draft (memory and vault) and stop every saver. */
  clearAll: () => void;
  /** Write every pending draft to the vault now (app to background, blur). */
  flushWrites: () => void;
  /**
   * Drop this application's drafts for items not in `validItemIds` (the list
   * changed, or the application is locked: pass an empty list).
   */
  pruneDrafts: (applicationId: string, validItemIds: string[]) => void;
  /**
   * Load `uid`'s drafts from the vault into memory (never over text already
   * typed). Other users' drafts are removed.
   */
  loadFromVault: (uid: string) => Promise<void>;
}

export const useAnswerDraftsStore = create<AnswerDraftsState>()((set, get) => ({
  uid: null,
  drafts: {},
  setDraft: (applicationId, itemId, text) => {
    const key = draftKey(applicationId, itemId);
    set((s) => ({ drafts: { ...s.drafts, [key]: text } }));
    const uid = get().uid;
    if (!uid) return; // no signed-in user known yet: memory only
    // Write through to the vault, debounced per draft.
    cancelWrite(key);
    const run = () => {
      pendingWrites.delete(key);
      void vault.save(uid, applicationId, itemId, text);
    };
    pendingWrites.set(key, {
      timer: setTimeout(run, VAULT_WRITE_DEBOUNCE_MS),
      run,
    });
  },
  clearDraft: (applicationId, itemId) => {
    const key = draftKey(applicationId, itemId);
    // Saved (or dropped): stop a pending write and delete the stored draft.
    cancelWrite(key);
    const uid = get().uid;
    if (uid) void vault.delete(uid, applicationId, itemId);
    set((s) => {
      if (!(key in s.drafts)) return s;
      const rest = { ...s.drafts };
      delete rest[key];
      return { drafts: rest };
    });
  },
  clearAll: () => {
    generation++;
    pendingWrites.forEach((p) => clearTimeout(p.timer));
    pendingWrites.clear();
    dropAllSavers();
    set({ uid: null, drafts: {} });
    void vault.clearAll();
  },
  flushWrites: () => {
    // Copy first: each `run` removes itself from the map.
    [...pendingWrites.values()].forEach((p) => {
      clearTimeout(p.timer);
      p.run();
    });
  },
  pruneDrafts: (applicationId, validItemIds) => {
    const valid = new Set(validItemIds);
    const prefix = `${applicationId}:`;
    for (const key of Object.keys(get().drafts)) {
      if (!key.startsWith(prefix)) continue;
      const itemId = key.slice(prefix.length);
      if (valid.has(itemId)) continue;
      dropSaver(key);
      get().clearDraft(applicationId, itemId);
    }
  },
  loadFromVault: async (uid) => {
    // A different user than the one whose drafts are in memory: forget those.
    if (get().uid && get().uid !== uid) {
      pendingWrites.forEach((p) => clearTimeout(p.timer));
      pendingWrites.clear();
      dropAllSavers();
      set({ drafts: {} });
    }
    set({ uid });
    const startedAt = generation;
    const stored = await vault.load(uid);
    // Signed out while reading: these belong to a session that is over.
    if (startedAt !== generation) return;
    if (stored.length === 0) return;
    set((s) => {
      const drafts = { ...s.drafts };
      for (const d of stored) {
        const key = draftKey(d.applicationId, d.itemId);
        // What is already in memory is newer than what was stored.
        if (!(key in drafts)) drafts[key] = d.text;
      }
      return { drafts };
    });
  },
}));
