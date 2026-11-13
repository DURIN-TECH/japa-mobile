// ─────────────────────────────────────────────────────────────────────────────
// Unsaved answer text (issue #187).
//
// Each information item's text that has NOT been saved yet is held here, keyed
// by application id + checklist item id, so typing is never lost to a failed or
// offline save, a scroll, leaving the screen, a refetch, or the app being killed.
//
// The store is the LIVE source (the field reads it). Every change is written
// through to an ENCRYPTED vault (expo-secure-store, see services/draftVault.ts),
// debounced, never AsyncStorage: these answers are personal details.
// `loadFromVault()` brings stored drafts back when the screen opens (drafts older
// than 7 days are dropped there). A draft is deleted after a successful save, and
// ALL are deleted on sign-out (subscription in auth.store.ts). Never logged.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { secureStoreVault, type DraftVault } from '@/services/draftVault';

/** Write-through delay: typing is not hitting the Keychain on every key. */
export const VAULT_WRITE_DEBOUNCE_MS = 800;

// The backend (swappable for tests).
let vault: DraftVault = secureStoreVault;
export const setDraftVault = (v: DraftVault) => {
  vault = v;
};

const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>();
const cancelWrite = (key: string) => {
  const t = pendingWrites.get(key);
  if (t) clearTimeout(t);
  pendingWrites.delete(key);
};

/** Store key for one item of one application. */
export const draftKey = (applicationId: string, itemId: string) =>
  `${applicationId}:${itemId}`;

interface AnswerDraftsState {
  /** Unsaved text by `draftKey`. An absent key means "no draft". */
  drafts: Record<string, string>;
  setDraft: (applicationId: string, itemId: string, text: string) => void;
  clearDraft: (applicationId: string, itemId: string) => void;
  /** Sign-out: forget every draft (memory and vault). */
  clearAll: () => void;
  /** Merge drafts from the vault into memory (never over text already typed). */
  loadFromVault: () => Promise<void>;
}

export const useAnswerDraftsStore = create<AnswerDraftsState>()((set) => ({
  drafts: {},
  setDraft: (applicationId, itemId, text) => {
    const key = draftKey(applicationId, itemId);
    set((s) => ({ drafts: { ...s.drafts, [key]: text } }));
    // Write through to the vault, debounced per draft.
    cancelWrite(key);
    pendingWrites.set(
      key,
      setTimeout(() => {
        pendingWrites.delete(key);
        void vault.save(applicationId, itemId, text);
      }, VAULT_WRITE_DEBOUNCE_MS),
    );
  },
  clearDraft: (applicationId, itemId) => {
    // Saved: no draft needed. Stop a pending write and delete the stored one.
    cancelWrite(draftKey(applicationId, itemId));
    void vault.delete(applicationId, itemId);
    set((s) => {
      const key = draftKey(applicationId, itemId);
      if (!(key in s.drafts)) return s;
      const rest = { ...s.drafts };
      delete rest[key];
      return { drafts: rest };
    });
  },
  clearAll: () => {
    pendingWrites.forEach((t) => clearTimeout(t));
    pendingWrites.clear();
    set({ drafts: {} });
    void vault.clearAll();
  },
  loadFromVault: async () => {
    const stored = await vault.load();
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
