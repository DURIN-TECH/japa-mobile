// ─────────────────────────────────────────────────────────────────────────────
// Hands a picked issuer country from the country picker sheet back to the
// add-document sheet that opened it (japa#234). Route params can't travel
// backwards, so the picker writes here and calls router.back(). Not persisted:
// it only lives for the moment between the two screens.
// ─────────────────────────────────────────────────────────────────────────────
import { create } from 'zustand';

interface HoldingsPickState {
  /** Uppercase ISO2 code chosen as the issuer, or null. */
  issuer: string | null;
  setIssuer: (code: string | null) => void;
}

export const useHoldingsPick = create<HoldingsPickState>((set) => ({
  issuer: null,
  setIssuer: (issuer) => set({ issuer }),
}));
