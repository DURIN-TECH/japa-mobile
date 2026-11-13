// ─────────────────────────────────────────────────────────────────────────────
// Unsaved answer text (issue #187).
//
// Each information item's text that has NOT been saved yet is held here, keyed
// by application id + checklist item id, so typing is never lost to a failed or
// offline save, a scroll, leaving the screen, or a refetch.
//
// IN MEMORY ONLY, by decision: these answers are personal details (dates,
// addresses, earnings) and AsyncStorage is not encrypted. So there is no
// `persist` middleware here, and the whole store is emptied on sign-out (see the
// subscription in auth.store.ts). Never log the text.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';

/** Store key for one item of one application. */
export const draftKey = (applicationId: string, itemId: string) =>
  `${applicationId}:${itemId}`;

interface AnswerDraftsState {
  /** Unsaved text by `draftKey`. An absent key means "no draft". */
  drafts: Record<string, string>;
  setDraft: (applicationId: string, itemId: string, text: string) => void;
  clearDraft: (applicationId: string, itemId: string) => void;
  /** Sign-out: forget every draft. */
  clearAll: () => void;
}

export const useAnswerDraftsStore = create<AnswerDraftsState>()((set) => ({
  drafts: {},
  setDraft: (applicationId, itemId, text) =>
    set((s) => ({
      drafts: { ...s.drafts, [draftKey(applicationId, itemId)]: text },
    })),
  clearDraft: (applicationId, itemId) =>
    set((s) => {
      const key = draftKey(applicationId, itemId);
      if (!(key in s.drafts)) return s;
      const rest = { ...s.drafts };
      delete rest[key];
      return { drafts: rest };
    }),
  clearAll: () => set({ drafts: {} }),
}));
