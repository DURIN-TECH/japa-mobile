// ─────────────────────────────────────────────────────────────────────────────
// "What you already hold" (japa#234) — shapes of /users/me/holdings.
// Mirrors the backend HoldingsView. Dates are plain "YYYY-MM-DD" strings
// (no time, no timezone); `expired` is computed by the SERVER, so the app and
// the rules engine always agree on what "doesn't count".
// ─────────────────────────────────────────────────────────────────────────────

/** The three kinds of document a person can say they already hold. */
export type HeldDocumentKind =
  | 'visa'
  | 'residence_permit'
  | 'travel_authorisation';

/** One document as the API returns it. */
export interface HeldDocumentView {
  id: string;
  kind: HeldDocumentKind;
  /** Uppercase ISO2 code of the issuing country (exactly one of the two issuers). */
  issuerCountryCode?: string;
  /** Issuing group of countries. Not offered in the app yet (country only). */
  issuerAuthorityId?: string;
  /** "YYYY-MM-DD". */
  validUntil: string;
  note?: string;
  expired: boolean;
}

/** GET/PUT/POST/DELETE all answer with this view. */
export interface HoldingsView {
  /** Uppercase ISO2 codes, at most 5. */
  nationalities: string[];
  residentialCountry: string | null;
  /**
   * null  = never stated.
   * []    = said they hold none.
   * The rules treat these two differently, so the UI must too.
   */
  heldDocuments: HeldDocumentView[] | null;
  updatedAt: string | null;
}

/** Body of PUT /users/me/holdings: each field sent replaces what is stored. */
export interface HoldingsPatch {
  nationalities?: string[];
  residentialCountry?: string | null;
  heldDocuments?: Array<Omit<HeldDocumentView, 'id' | 'expired'>>;
}

/** Body of POST /users/me/holdings/documents. */
export interface NewHeldDocument {
  kind: HeldDocumentKind;
  issuerCountryCode: string;
  validUntil: string;
  note?: string;
}
