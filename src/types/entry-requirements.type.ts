// ─────────────────────────────────────────────────────────────────────────────
// "Do I need a visa?" (japa#237, P8b) — shapes of GET /entry-requirements.
// Mirrors the backend `types/entry-requirements.ts`. No country, bloc or
// nationality name is ever written here: every name shown comes from API data.
// ─────────────────────────────────────────────────────────────────────────────

/** The six outcomes an answer can have. */
export type EntryOutcome =
  | 'visa_required'
  | 'visa_free'
  | 'visa_on_arrival'
  | 'travel_authorisation'
  | 'transit_visa'
  | 'transit_free';

/** The purposes the endpoint accepts, exactly. */
export type EntryPurpose =
  | 'tourism'
  | 'business'
  | 'work'
  | 'study'
  | 'family'
  | 'transit'
  | 'other';

/** Why an answer is unknown. */
export type EntryUnknownCode =
  | 'no_rule'
  | 'missing_fact'
  | 'stale'
  | 'stay_not_covered'
  | 'purpose_not_covered';

/** One official source behind an answer. */
export interface EntrySource {
  quote: string;
  url: string;
  /** ISO-8601: when we last read the official page. */
  fetchedAt: string;
  listItems?: string[];
}

export interface EntryCondition {
  kind: 'max_stay' | 'purposes' | 'holds' | 'source_condition';
  text: string;
  /** Verbatim passage (only for a source condition). */
  quote?: string;
}

export interface EntryStay {
  maxDays: number;
  periodDays: number | null;
}

/** A rule that could change the answer if the person told us more. */
export interface EntryPossibleRule {
  ruleId: string;
  outcome: EntryOutcome;
  /** Plain words from the backend ("which visas or permits you hold"). */
  needs: string;
  source: EntrySource;
}

export interface EntryAuthorisation {
  name: string | null;
  /** The source's own statement that it is not a visa, with its page. */
  notAVisa: { quote: string; url: string } | null;
  applyUrl: string;
  seliApplies: false;
}

export interface EntryAnswer {
  status: 'answer';
  destination: string;
  outcome: EntryOutcome;
  message: string;
  stay: EntryStay | null;
  conditions: EntryCondition[];
  sources: EntrySource[];
  disagree: boolean;
  mightAlsoApply: EntryPossibleRule[];
  authorisation: EntryAuthorisation | null;
}

export interface EntryUnknown {
  status: 'unknown';
  destination: string;
  code: EntryUnknownCode;
  reason: string;
  /** Plain words, NOT keys ("your nationality and which country you live in"). */
  needs?: string;
  destinationAuthorityPage?: string;
  mightApply?: EntryPossibleRule[];
}

export type EntryResult = EntryAnswer | EntryUnknown;

/** What the app saves per set of inputs, for offline. */
export interface SavedEntryResult {
  result: EntryResult;
  /** ISO-8601: when the app saved it. */
  savedAt: string;
}
