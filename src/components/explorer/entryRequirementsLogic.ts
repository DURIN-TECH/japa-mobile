// ─────────────────────────────────────────────────────────────────────────────
// "Do I need a visa?" (japa#237, P8b) — pure helpers + copy.
//
// No React / RN imports so everything here is unit-tested directly:
//   • outcome / unknown code → headline, icon key, next step
//   • the query string, built from the person's holdings
//   • "Checked 3 days ago" / date formatting for sources
//   • when the page's Start bar is hidden
//   • the offline cache key
//
// NO country, bloc or nationality names live here: names come from the API.
// Never a bare yes or no: every headline sits beside the backend's `message`
// and its sources.
// ─────────────────────────────────────────────────────────────────────────────

import type { HoldingsView } from '@/types/holdings.type';
import type {
  EntryOutcome,
  EntryPurpose,
  EntryResult,
  EntryUnknownCode,
} from '@/types/entry-requirements.type';

// ── Copy (chrome only; everything else is backend data) ──────────────────────
export const NEED_VISA_COPY = {
  section: 'Do I need a visa?',
  forPassportLiving: (nat: string, res: string) =>
    `For a ${nat} passport, living in ${res}.`,
  forPassport: (nat: string) => `For a ${nat} passport.`,
  change: 'Change',
  whichPassport: 'Which passport?',
  detailsLink: 'Add what you’re travelling for and how long',
  daysLabel: 'How many days?',
  purposeLabel: 'What for?',
  disagreeHeadline: 'Our sources don’t fully agree',
  disagreeNote:
    'Official sources say different things about this. Read each one, and check the official page before you go.',
  notAVisa: 'This isn’t a visa.',
  conditions: 'Conditions',
  seeWording: 'See the wording',
  hideWording: 'Hide the wording',
  source: 'Source',
  couldChange: 'This could change if',
  applyOfficial: 'Apply on the official site',
  seliNotApplying: 'Seli doesn’t apply for this one for you.',
  whyNotVisa: 'Why it isn’t a visa',
  readOfficial: 'Read the official page',
  somethingElse: 'Travelling for something else?',
  openOfficial: 'Open the official page',
  authorityNote: 'This is the destination’s own page, not ours.',
  weNeed: 'To answer this we need:',
  needNationality: 'Your passport country',
  needResidence: 'Where you live',
  needHolds: 'A visa or permit you hold',
  add: 'Add',
  readMore: 'Read more',
  fetchError:
    'We couldn’t check this right now. Check your connection and try again.',
  rateLimited: 'You’ve checked a lot just now. Try again in a minute.',
  tryAgain: 'Try again',
  offlineNothing: 'You’re offline. Reconnect to check this.',
  offlineSaved: (age: string) =>
    `You’re offline. This is the answer we saved ${age}.`,
  checked: (age: string) => `Checked ${age}`,
} as const;

/** Plain labels for the seven purposes (product words, not countries). */
export const PURPOSE_OPTIONS: ReadonlyArray<{
  value: EntryPurpose;
  label: string;
}> = [
  { value: 'tourism', label: 'Tourism' },
  { value: 'business', label: 'Business' },
  { value: 'work', label: 'Work' },
  { value: 'study', label: 'Study' },
  { value: 'family', label: 'Family' },
  { value: 'transit', label: 'Passing through' },
  { value: 'other', label: 'Something else' },
];

/** Icon names from the `Ic` map (the screen resolves them). */
export type OutcomeIcon = 'docs' | 'shield' | 'globe' | 'help';

// ── Outcome → headline / short line / icon / next step ───────────────────────

/** What the card offers after the answer. */
export type NextStep =
  | 'start' // visa_required / transit_visa: the page's own Start bar is the way
  | 'authorisation' // "Apply on the official site"
  | 'official' // "Read the official page"
  | 'none'; // disagreement, or an outcome we don't know: official links only

/** Headline for an outcome. An unrecognised outcome never claims anything. */
export function outcomeHeadline(outcome: EntryOutcome | string): string {
  switch (outcome) {
    case 'visa_required':
      return 'You’ll need a visa';
    case 'visa_free':
      return 'You don’t need a visa';
    case 'visa_on_arrival':
      return 'You can get a visa when you arrive';
    case 'travel_authorisation':
      return 'You’ll need a travel authorisation';
    case 'transit_visa':
      return 'You’ll need a visa to pass through';
    case 'transit_free':
      return 'You don’t need a visa to pass through';
    default:
      return 'Here’s what the official source says';
  }
}

/** The short "what it would mean" line in "This could change if". */
export function outcomeShort(outcome: EntryOutcome | string): string {
  switch (outcome) {
    case 'visa_required':
      return 'You’d need a visa';
    case 'visa_free':
      return 'You wouldn’t need a visa';
    case 'visa_on_arrival':
      return 'You could get a visa on arrival';
    case 'travel_authorisation':
      return 'You’d need a travel authorisation';
    case 'transit_visa':
      return 'You’d need a visa to pass through';
    case 'transit_free':
      return 'You wouldn’t need a visa to pass through';
    default:
      return 'See the official source';
  }
}

/** Icon for an outcome (not a status colour: the card paints it coral on cream). */
export function outcomeIcon(outcome: EntryOutcome | string): OutcomeIcon {
  switch (outcome) {
    case 'visa_required':
    case 'transit_visa':
      return 'docs';
    case 'visa_free':
    case 'transit_free':
      return 'shield';
    case 'visa_on_arrival':
    case 'travel_authorisation':
      return 'globe';
    default:
      return 'help';
  }
}

/** Next step by outcome. A disagreement offers no button, only the links. */
export function nextStepFor(
  outcome: EntryOutcome | string,
  disagree: boolean,
): NextStep {
  if (disagree) return 'none';
  switch (outcome) {
    case 'visa_required':
    case 'transit_visa':
      return 'start';
    case 'travel_authorisation':
      return 'authorisation';
    case 'visa_free':
    case 'visa_on_arrival':
    case 'transit_free':
      return 'official';
    default:
      return 'none';
  }
}

/** Headline for an unknown answer, by code. Never a guess. */
export function unknownHeadline(code: EntryUnknownCode | string): string {
  switch (code) {
    case 'no_rule':
      return 'We don’t have an official source for this yet';
    case 'missing_fact':
      return 'We need a little more to answer this';
    case 'stale':
      return 'This may be out of date';
    case 'stay_not_covered':
      return 'We can’t answer for a stay that long';
    case 'purpose_not_covered':
      return 'We can’t answer for that purpose yet';
    default:
      // A code we don't know: say the safe thing.
      return 'We don’t have an official source for this yet';
  }
}

/** Extra body line for `stale` (after the backend's own `reason`). */
export const STALE_EXTRA = 'We’d rather not guess. Check the official page.';

/** The unknown codes whose fix is in the travel details (opens them). */
export function unknownOpensDetails(code: EntryUnknownCode | string): boolean {
  return code === 'stay_not_covered' || code === 'purpose_not_covered';
}

// ── The page's Start bar ─────────────────────────────────────────────────────

/**
 * Is the page's Start bar hidden? Yes when the answer says no visa application
 * is the route: visa-free, on arrival, transit-free and authorisation. Not on a
 * disagreement (no claim is made), not for unknown, not while loading.
 */
export function startBarHidden(
  result: EntryResult | null | undefined,
): boolean {
  if (!result || result.status !== 'answer') return false;
  const step = nextStepFor(result.outcome, result.disagree);
  return step === 'authorisation' || step === 'official';
}

// ── The query ────────────────────────────────────────────────────────────────

export interface EntryInputs {
  destination: string;
  /** One passport, or null when the person has none on file. */
  nationality: string | null;
  holdings: HoldingsView;
  purpose?: EntryPurpose | null;
  stayDays?: number | null;
}

/**
 * Held documents as `kind:issuer:YYYY-MM-DD`. Expired documents are left out
 * (the server flags `expired`; they never count). A document without an issuer
 * can't be described, so it is left out too.
 */
export function holdsParam(holdings: HoldingsView): string[] {
  return (holdings.heldDocuments ?? [])
    .filter((d) => !d.expired)
    .map((d) => {
      const issuer = d.issuerCountryCode ?? d.issuerAuthorityId;
      return issuer ? `${d.kind}:${issuer}:${d.validUntil}` : null;
    })
    .filter((v): v is string => v !== null);
}

/**
 * The query string for GET /entry-requirements, or null when the endpoint must
 * not be called (no destination, or no nationality: the card then asks for it).
 *
 * `holds`: absent when the person never said (`heldDocuments` null), so the
 * server asks for it; present (possibly empty, `holds=`) once they said.
 */
export function buildEntryQuery(i: EntryInputs): string | null {
  if (!i.destination || !i.nationality) return null;
  const parts: string[] = [
    `destination=${encodeURIComponent(i.destination)}`,
    `nationality=${encodeURIComponent(i.nationality)}`,
  ];
  if (i.holdings.residentialCountry) {
    parts.push(
      `residence=${encodeURIComponent(i.holdings.residentialCountry)}`,
    );
  }
  if (i.holdings.heldDocuments !== null) {
    // Commas and colons are part of the format, so they are not encoded.
    parts.push(`holds=${holdsParam(i.holdings).join(',')}`);
  }
  if (i.purpose) parts.push(`purpose=${encodeURIComponent(i.purpose)}`);
  if (i.stayDays && Number.isInteger(i.stayDays) && i.stayDays > 0) {
    parts.push(`stayDays=${i.stayDays}`);
  }
  return parts.join('&');
}

/** AsyncStorage key for the saved answer: per person, per exact set of inputs. */
export function savedAnswerKey(uid: string, query: string): string {
  return `@seli_entry_req:${uid}:${query}`;
}

/** Stay days from the text field: a whole number 1..3650, else undefined. */
export function parseStayDays(text: string): number | undefined {
  const t = text.trim();
  if (!/^\d{1,4}$/.test(t)) return undefined;
  const n = Number(t);
  return n >= 1 && n <= 3650 ? n : undefined;
}

// ── Source age ───────────────────────────────────────────────────────────────
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]; // prettier-ignore

/** Under this many days an age is words; from here it is a date. */
export const AGE_AS_DATE_AFTER_DAYS = 30;

const plural = (n: number, unit: string) =>
  `${n} ${unit}${n === 1 ? '' : 's'} ago`;

/**
 * "just now", "5 minutes ago", "3 days ago" while under 30 days; a date
 * ("14 Mar 2026") from 30 days on. '' for a missing or unparseable time. A time
 * in the future reads as "just now". `now` is injectable for tests.
 */
export function sourceAge(
  iso: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!iso) return '';
  const t = new Date(iso);
  if (isNaN(t.getTime())) return '';
  const secs = Math.max(0, Math.floor((now.getTime() - t.getTime()) / 1000));
  const days = Math.floor(secs / 86400);
  if (days >= AGE_AS_DATE_AFTER_DAYS) {
    return `on ${t.getDate()} ${MONTHS[t.getMonth()]} ${t.getFullYear()}`;
  }
  if (days >= 1) return plural(days, 'day');
  const hours = Math.floor(secs / 3600);
  if (hours >= 1) return plural(hours, 'hour');
  const mins = Math.floor(secs / 60);
  if (mins >= 1) return plural(mins, 'minute');
  return 'just now';
}
