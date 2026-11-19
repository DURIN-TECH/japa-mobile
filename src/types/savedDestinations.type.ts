// ─────────────────────────────────────────────────────────────────────────────
// Saved destinations (japa#146) — mirrors the backend's SavedDestinationItem
// (seli-backend functions/src/services/saved-destinations.service.ts).
//
// GET    /users/me/saved-destinations                       → SavedDestinationItem[]
// PUT    /users/me/saved-destinations/:countryCode/:visaId  → SavedDestinationItem
// DELETE /users/me/saved-destinations/:countryCode/:visaId  → SavedDestinationRemoved
// ─────────────────────────────────────────────────────────────────────────────

import type { VisaCategory } from './visas.type';

/** Firestore Timestamp as the API serialises it. */
export interface ApiTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

/**
 * The visa fields a saved item carries: an allow-list of `VisaType` fields,
 * with the same names, so `visaTypeToDest(item.visa, item.countryName)` can
 * draw a tile without another call. `description` / `processingTime` may be
 * missing on older scraped records (backend review note), so they are
 * optional here and the hook fills them with ''.
 */
export interface SavedDestinationVisa {
  id: string;
  countryCode: string;
  name: string;
  description?: string;
  category: VisaCategory;
  processingTime?: string;
  baseCostUsd?: number;
  successRate: number | null;
  totalApplications: number | null;
  source: string | null;
}

/** One saved destination, newest first in the list. */
export interface SavedDestinationItem {
  /** Always UPPER CASE ("GB"), whatever case was sent. */
  countryCode: string;
  visaId: string;
  savedAt: ApiTimestamp;
  /** "United Kingdom"; the code if the country record is missing. */
  countryName: string;
  visa: SavedDestinationVisa;
}

/** DELETE answer (also when nothing was saved: the call is idempotent). */
export interface SavedDestinationRemoved {
  countryCode: string;
  visaId: string;
  saved: false;
}
