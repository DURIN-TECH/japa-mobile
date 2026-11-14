// ─────────────────────────────────────────────────────────────────────────────
// "What you already hold" (japa#234) — pure helpers + copy.
//
// No React / RN imports so everything here is unit-tested directly. It holds:
//   • the limits the backend enforces (mirrored so the UI stops early)
//   • list helpers (toggle, add, remove, "replace the whole list")
//   • document helpers (sort, kind labels, titles, date formatting)
//   • the error → plain-words mapping
//   • every string on the screens, in Seli's voice
//
// NO country, nationality or bloc names live here: names come from
// GET /countries at render time.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  HeldDocumentKind,
  HeldDocumentView,
  HoldingsView,
} from '@/types/holdings.type';

// ── Limits (the backend is the authority; these only stop the UI early) ──────
export const MAX_NATIONALITIES = 5;
export const MAX_DOCUMENTS = 20;
export const MAX_NOTE_CHARS = 200;
/** Earliest / latest `validUntil` the backend accepts. */
export const MIN_VALID_UNTIL = new Date(1990, 0, 1);
export const MAX_VALID_UNTIL = new Date(2100, 11, 31);

// ── Copy ─────────────────────────────────────────────────────────────────────
export const HOLDINGS_COPY = {
  screenTitle: 'What you already hold',
  settingsGroup: 'About you',
  // Decision 6: matches what the backend does (agency on the case + Seli staff).
  // Never says "verified" or "checked".
  privacy:
    'Only you can change this. When you start an application, the agency handling it and Seli’s team can see what you held at that moment.',
  intro:
    'We ask so we can work out which rules apply to you. We don’t check your documents.',
  saveError: 'We couldn’t save that. Check your connection and try again.',
  loadError:
    'We couldn’t load what you hold. Check your connection and try again.',
  offline: 'You’re offline. Reconnect to change what you hold.',
  nationalitiesLimit: 'You can add up to 5 nationalities.',
  documentsLimit: 'You’ve reached the limit of 20. Remove one to add another.',
  validationFallback:
    'Something in that doesn’t look right. Check the date and try again.',
  natTitle: 'Your nationalities',
  natAdd: 'Add a nationality',
  natMax: 'That’s the most you can add (5).',
  natEmptyTitle: 'You haven’t told us your nationality',
  natEmptyBody: 'Rules for a route often depend on it.',
  liveTitle: 'Where you live',
  liveChange: 'Change',
  liveAdd: 'Add where you live',
  liveEmptyTitle: 'You haven’t told us where you live',
  docsTitle: 'Visas and permits you hold',
  docsAdd: 'Add a visa or permit',
  docsNone: 'I don’t hold any',
  docsMax: 'That’s the most you can add (20).',
  docsUnstatedTitle: 'You haven’t told us about any visas or permits',
  docsUnstatedBody:
    'Tell us if you hold one, or that you hold none. Either helps us pick the right rules.',
  docsNoneTitle: 'You’ve told us you hold none',
  expiredCaption:
    'Expired documents stay on your list but don’t count when we work out which rules apply to you.',
  removeTitle: 'Remove this document?',
  removeKeep: 'Keep it',
  removeConfirm: 'Remove',
  // Onboarding
  onbTitle: 'Where are you from?',
  onbSubtitle:
    'Pick every country you’re a citizen of. Most people pick one. We use this to work out which rules apply to you.',
  onbHint:
    'Hold a visa or permit already? You can add it later in Settings, under What you already hold.',
  onbSkip: 'Skip for now',
  onbContinue: 'Continue',
  // Add-document sheet
  addTitle: 'Add a visa or permit',
  addCta: 'Add document',
  addKindLabel: 'What is it?',
  addIssuerLabel: 'Issued by',
  addIssuerPlaceholder: 'Choose',
  addDateLabel: 'Valid until',
  addDatePlaceholder: 'Choose a date',
  addDateHelper: 'A date in the past is fine. We’ll mark it expired.',
  addNoteLabel: 'Note (optional)',
  addNotePlaceholder: 'For example, work visa or multiple entry',
  addCaption: 'We keep what you type. We don’t check it with the issuer.',
  // Pickers
  pickAddNationality: 'Add a nationality',
  pickResidence: 'Where do you live?',
  pickIssuer: 'Issued by',
  pickClear: 'Clear',
  pickAdded: 'Added',
  searchCountries: 'Search countries',
} as const;

/** Copy for the three kinds (label + one-line explainer for the OptionCard). */
export const KIND_COPY: Record<
  HeldDocumentKind,
  { label: string; sub: string }
> = {
  visa: { label: 'Visa', sub: 'Lets you enter or stay for a set purpose' },
  residence_permit: {
    label: 'Residence permit',
    sub: 'Lets you live in a country for a longer time',
  },
  travel_authorisation: {
    label: 'Travel authorisation',
    sub: 'Approved online before you travel, instead of a visa',
  },
};
export const KIND_ORDER: HeldDocumentKind[] = [
  'visa',
  'residence_permit',
  'travel_authorisation',
];

// ── Selection counter ("0 chosen" … "5 of 5 chosen. Remove one …") ───────────
export function counterLine(n: number): string {
  if (n >= MAX_NATIONALITIES)
    return `${MAX_NATIONALITIES} of ${MAX_NATIONALITIES} chosen. Remove one to pick another.`;
  return `${n} chosen`;
}

// ── List helpers (codes are compared case-insensitively) ─────────────────────
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * Tap on a multi-select row: remove it if chosen, add it (at the END, so the
 * first pick stays first) if not. At the cap, an unchosen row is ignored.
 */
export function toggleSelection(
  list: string[],
  code: string,
  max = MAX_NATIONALITIES,
): string[] {
  if (list.some((c) => same(c, code)))
    return list.filter((c) => !same(c, code));
  if (list.length >= max) return list;
  return [...list, code];
}

/** The FULL list to PUT after adding one (the API replaces the whole list). */
export function withNationality(list: string[], code: string): string[] {
  if (list.some((c) => same(c, code))) return list;
  return [...list, code.toUpperCase()];
}

/** The FULL list to PUT after removing one. */
export function withoutNationality(list: string[], code: string): string[] {
  return list.filter((c) => !same(c, code));
}

/** Settings row value: "2 nationalities", "1 nationality", or "Not set". */
export function nationalitiesSummary(list: string[] | undefined): string {
  const n = list?.length ?? 0;
  if (n === 0) return 'Not set';
  return `${n} nationalit${n === 1 ? 'y' : 'ies'}`;
}

// ── Documents ────────────────────────────────────────────────────────────────

/** Which of the three states the visas-and-permits section is in. */
export function documentsState(
  docs: HeldDocumentView[] | null | undefined,
): 'unstated' | 'none' | 'list' {
  if (docs == null) return 'unstated';
  return docs.length === 0 ? 'none' : 'list';
}

/** Valid first (soonest end date first), then expired (most recently ended first). */
export function sortDocuments(docs: HeldDocumentView[]): HeldDocumentView[] {
  const valid = docs
    .filter((d) => !d.expired)
    .sort((a, b) => a.validUntil.localeCompare(b.validUntil));
  const expired = docs
    .filter((d) => d.expired)
    .sort((a, b) => b.validUntil.localeCompare(a.validUntil));
  return [...valid, ...expired];
}

/** "Visa from Canada"; just "Visa" while the name is unknown (never a raw code). */
export function documentTitle(
  kind: HeldDocumentKind,
  issuerName: string | undefined,
): string {
  const label = KIND_COPY[kind]?.label ?? 'Document';
  return issuerName ? `${label} from ${issuerName}` : label;
}

/** Parse "YYYY-MM-DD" as a LOCAL date (new Date("2027-03-14") would be UTC). */
export function parseDay(day: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

/** A Date → "YYYY-MM-DD" in local time. */
export function toApiDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]; // prettier-ignore

/** "14 Mar 2027" ("D MMM YYYY"); '' for an unparseable day. */
export function formatDay(day: string | Date): string {
  const d = typeof day === 'string' ? parseDay(day) : day;
  if (!d) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Second line of a document row: valid vs expired wording. */
export function documentSubline(doc: HeldDocumentView): string {
  const when = formatDay(doc.validUntil);
  return doc.expired ? `Ended ${when}. Doesn’t count.` : `Valid until ${when}`;
}

/** Keep a picked date inside the range the backend accepts. */
export function clampDate(d: Date): Date {
  if (d < MIN_VALID_UNTIL) return MIN_VALID_UNTIL;
  if (d > MAX_VALID_UNTIL) return MAX_VALID_UNTIL;
  return d;
}

/** The add-document form, as held in state. */
export interface DocumentDraft {
  kind: HeldDocumentKind | null;
  issuerCountryCode: string | null;
  validUntil: Date | null;
  note: string;
}

/** The CTA is enabled only when kind, issuer and date are all set. */
export function canSubmitDocument(d: DocumentDraft): boolean {
  return !!d.kind && !!d.issuerCountryCode && !!d.validUntil;
}

/** Build the POST body; the note is trimmed and omitted when empty. */
export function buildNewDocument(d: DocumentDraft) {
  if (!canSubmitDocument(d)) return null;
  const note = d.note.trim().slice(0, MAX_NOTE_CHARS);
  return {
    kind: d.kind!,
    issuerCountryCode: d.issuerCountryCode!.toUpperCase(),
    validUntil: toApiDay(clampDate(d.validUntil!)),
    ...(note ? { note } : {}),
  };
}

/** The held list the screens show, safe for any API reply. */
export function emptyHoldings(): HoldingsView {
  return {
    nationalities: [],
    residentialCountry: null,
    heldDocuments: null,
    updatedAt: null,
  };
}

// ── Errors → plain words ─────────────────────────────────────────────────────
type ErrLike = { code?: string; message?: string; status?: number } | null;

export function isNotFound(e: unknown): boolean {
  const x = e as ErrLike;
  return !!x && (x.code === 'NOT_FOUND' || x.status === 404);
}

/**
 * What to tell the person when a save fails.
 *   'nationalities' — a validation error means too many
 *   'document'      — show a short server message; the limit has its own line
 *   'other'         — the generic line
 */
export function saveErrorMessage(
  e: unknown,
  context: 'nationalities' | 'document' | 'other' = 'other',
): string {
  const x = e as ErrLike;
  const validation = !!x && (x.code === 'VALIDATION_ERROR' || x.status === 400);
  if (!validation) return HOLDINGS_COPY.saveError;
  if (context === 'nationalities') return HOLDINGS_COPY.nationalitiesLimit;
  if (context === 'document') {
    const msg = (x?.message ?? '').trim();
    if (/at most 20/i.test(msg)) return HOLDINGS_COPY.documentsLimit;
    // A plain one-liner from the server is fine to show; anything else is not.
    if (msg && msg.length <= 120 && !msg.includes('\n')) return msg;
    return HOLDINGS_COPY.validationFallback;
  }
  return HOLDINGS_COPY.saveError;
}
