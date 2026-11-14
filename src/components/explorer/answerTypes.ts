// ─────────────────────────────────────────────────────────────────────────────
// Answer types (issue #187, regroomed): the typed shapes of an information
// item's answer, with no React in it so it can be unit-tested.
//
// Contract (backend builds the same rules):
//   date        "YYYY-MM-DD"
//   date_range  { from, to }  both ISO dates, to >= from
//   money       { amount: number >= 0, currency: "GBP" }
//   address     { line1, line2?, city, region?, postcode?, country, note? }
//   list        string[]  (<= 20 entries, <= 500 chars each)
//   text        string    (<= 2000 chars)
// A missing / unknown `answerType` is `text`. A legacy answer may come back as a
// plain string for any type: it is shown (text box / first field / a note), never
// dropped.
//
// How it fits the saver: the saver and the draft vault work on ONE STRING per
// item. For `text` that string is the text itself. For every other type it is the
// canonical JSON of the form value ("the wire string"), or '' when empty. So the
// vault, its chunking and the saver's trim / changed / one-in-flight rules are
// reused unchanged. `toPayload` turns the wire string into the value for the PUT
// (or an error naming the bad field, before anything is sent).
// The answers are personal: never logged.
// ─────────────────────────────────────────────────────────────────────────────

export type AnswerType =
  | 'text'
  | 'date'
  | 'date_range'
  | 'money'
  | 'address'
  | 'list';

const TYPES: AnswerType[] = [
  'text',
  'date',
  'date_range',
  'money',
  'address',
  'list',
];

/** Limits shared with the backend. */
export const ANSWER_TEXT_MAX = 2000;
export const LIST_MAX_ENTRIES = 20;
export const LIST_ENTRY_MAX = 500;

/** Missing or unknown type => text. */
export function normaliseAnswerType(t: unknown): AnswerType {
  return TYPES.includes(t as AnswerType) ? (t as AnswerType) : 'text';
}

export interface DateRangeValue {
  from: string;
  to: string;
}
export interface MoneyValue {
  amount: number;
  currency: string;
}
export interface AddressValue {
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postcode?: string;
  country: string;
  note?: string;
}

/** What the server stores / returns (a plain string is a legacy answer). */
export type AnswerValue =
  | string
  | string[]
  | DateRangeValue
  | MoneyValue
  | AddressValue;

// ── Form values: what the inputs edit (all strings, may be partial) ───────────

export interface MoneyForm {
  amount: string;
  currency: string;
}
export interface AddressForm {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
  note: string;
}
export type FormValue =
  | string // text, date
  | string[] // list (may hold blank rows while editing)
  | DateRangeValue // strings, may be '' while editing
  | MoneyForm
  | AddressForm;

export const ADDRESS_FIELDS: (keyof AddressForm)[] = [
  'line1',
  'line2',
  'city',
  'region',
  'postcode',
  'country',
  'note',
];

export const DEFAULT_CURRENCY = 'GBP';

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

// ── Dates ─────────────────────────────────────────────────────────────────────

/** True for a real calendar date written YYYY-MM-DD (not 2027-02-30). */
export function isRealIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

// ── Currency ──────────────────────────────────────────────────────────────────

/** Currencies offered as chips (the stored one is always offered too). */
export const CURRENCY_CHOICES = ['GBP', 'USD', 'EUR', 'NGN', 'CAD', 'AUD'];

const SYMBOLS: [RegExp, string][] = [
  [/£/, 'GBP'],
  [/€/, 'EUR'],
  [/₦/, 'NGN'],
  [/C\$|CA\$/, 'CAD'],
  [/A\$|AU\$/, 'AUD'],
  [/\$/, 'USD'],
];

/**
 * The currency to start a money field on: a symbol or ISO code in the item text
 * (title, appliesWhen), else GBP. The user can change it; never guessed silently
 * because the chip always shows it.
 */
export function defaultCurrencyFor(...texts: (string | undefined)[]): string {
  const hay = texts.filter(Boolean).join(' ');
  for (const [re, code] of SYMBOLS) if (re.test(hay)) return code;
  const code = CURRENCY_CHOICES.find((c) => new RegExp(`\\b${c}\\b`).test(hay));
  return code ?? DEFAULT_CURRENCY;
}

// ── Empty forms ───────────────────────────────────────────────────────────────

export function emptyForm(type: AnswerType, currency: string): FormValue {
  switch (type) {
    case 'date_range':
      return { from: '', to: '' };
    case 'money':
      return { amount: '', currency };
    case 'address':
      return {
        line1: '',
        line2: '',
        city: '',
        region: '',
        postcode: '',
        country: '',
        note: '',
      };
    case 'list':
      return [''];
    default:
      return '';
  }
}

// ── Server value -> form ──────────────────────────────────────────────────────

/**
 * The inputs' content for a saved server value. A legacy plain string lands in
 * the text box (text), the first address field (line1), or a single list row.
 * For date / date_range / money it cannot fill a picker or amount, so the form
 * is empty and `legacyNote` shows it.
 */
export function valueToForm(
  type: AnswerType,
  value: unknown,
  currency: string,
): FormValue {
  const empty = emptyForm(type, currency);
  if (value === undefined || value === null) return empty;
  switch (type) {
    case 'text':
      return typeof value === 'string' ? value : '';
    case 'date':
      return isRealIsoDate(value) ? value : '';
    case 'date_range':
      return isObj(value)
        ? { from: str(value.from), to: str(value.to) }
        : (empty as DateRangeValue);
    case 'money':
      if (isObj(value) && typeof value.amount === 'number')
        return {
          amount: String(value.amount),
          currency: str(value.currency) || currency,
        };
      return empty;
    case 'address': {
      const a = empty as AddressForm;
      if (typeof value === 'string') return { ...a, line1: value };
      if (isObj(value)) {
        const out = { ...a };
        for (const f of ADDRESS_FIELDS) out[f] = str(value[f]);
        return out;
      }
      return a;
    }
    case 'list':
      if (typeof value === 'string') return value.trim() ? [value] : [''];
      if (Array.isArray(value)) {
        const rows = value.filter((x): x is string => typeof x === 'string');
        return rows.length ? rows : [''];
      }
      return [''];
  }
}

/** A legacy plain-string answer that cannot fill this type's input. */
export function legacyNote(type: AnswerType, value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  if (type === 'date' && isRealIsoDate(value)) return null;
  return type === 'date' || type === 'date_range' || type === 'money'
    ? value
    : null;
}

// ── Money amount ──────────────────────────────────────────────────────────────

/** "1,200.50" -> 1200.5 ; null when not a non-negative finite number. */
export function parseAmount(s: string): number | null {
  const t = s.trim().replace(/,/g, '');
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// ── Emptiness ─────────────────────────────────────────────────────────────────

/**
 * True when a form value has no content for its type (so saving it clears the
 * answer). Money needs an amount (a currency alone is not an answer); an address
 * is empty only when every field is blank.
 */
export function isFormEmpty(type: AnswerType, form: FormValue): boolean {
  switch (type) {
    case 'text':
    case 'date':
      return str(form).trim() === '';
    case 'date_range': {
      const r = form as DateRangeValue;
      return str(r.from).trim() === '' && str(r.to).trim() === '';
    }
    case 'money':
      return str((form as MoneyForm).amount).trim() === '';
    case 'address':
      return ADDRESS_FIELDS.every(
        (f) => str((form as AddressForm)[f]).trim() === '',
      );
    case 'list':
      return (
        !Array.isArray(form) ||
        form.every((x) => typeof x !== 'string' || x.trim() === '')
      );
  }
}

/**
 * Does a SAVED server answer count as answered (progress card, "Answered" pill)?
 * Non-empty for its type: a range needs both dates, an address its required
 * fields (line1, city, country), money a number. A legacy plain string counts
 * when it has text, whatever the type, because it is still the person's answer.
 */
export function isAnswerValueNonEmpty(
  type: AnswerType,
  value: unknown,
): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  switch (type) {
    case 'text':
    case 'date':
      return false; // a non-string for a string type is not an answer
    case 'date_range':
      return (
        isObj(value) && isRealIsoDate(value.from) && isRealIsoDate(value.to)
      );
    case 'money':
      return (
        isObj(value) &&
        typeof value.amount === 'number' &&
        Number.isFinite(value.amount)
      );
    case 'address':
      return (
        isObj(value) &&
        str(value.line1).trim() !== '' &&
        str(value.city).trim() !== '' &&
        str(value.country).trim() !== ''
      );
    case 'list':
      return (
        Array.isArray(value) &&
        value.some((x) => typeof x === 'string' && x.trim() !== '')
      );
  }
}

// ── Form <-> wire string (what the saver and the vault hold) ──────────────────

/**
 * The canonical string for a form value: '' when empty, the trimmed text for
 * `text`, otherwise JSON with a fixed key order (so an unchanged value always
 * encodes the same and is never re-saved).
 */
export function encodeForm(type: AnswerType, form: FormValue): string {
  if (isFormEmpty(type, form)) return '';
  switch (type) {
    case 'text':
      return str(form).trim();
    case 'date':
      return JSON.stringify(str(form).trim());
    case 'date_range': {
      const r = form as DateRangeValue;
      return JSON.stringify({ from: str(r.from).trim(), to: str(r.to).trim() });
    }
    case 'money': {
      const m = form as MoneyForm;
      const n = parseAmount(m.amount);
      return JSON.stringify({
        amount: n === null ? m.amount.trim() : String(n),
        currency: str(m.currency).trim().toUpperCase(),
      });
    }
    case 'address': {
      const a = form as AddressForm;
      const o: Record<string, string> = {};
      for (const f of ADDRESS_FIELDS) o[f] = str(a[f]).trim();
      return JSON.stringify(o);
    }
    case 'list':
      return JSON.stringify(
        (form as string[]).map((x) => x.trim()).filter((x) => x !== ''),
      );
  }
}

/**
 * The form for a wire string (a draft read back from the vault, or the baseline
 * of a saved value). Anything unreadable gives the empty form rather than
 * throwing: a corrupt draft must not crash the screen.
 */
export function decodeForm(
  type: AnswerType,
  wire: string,
  currency: string,
): FormValue {
  if (type === 'text') return wire;
  if (wire.trim() === '') return emptyForm(type, currency);
  try {
    const v: unknown = JSON.parse(wire);
    if (type === 'date') return typeof v === 'string' ? v : '';
    if (type === 'list')
      return Array.isArray(v) && v.length
        ? v.filter((x): x is string => typeof x === 'string')
        : [''];
    if (type === 'money' && isObj(v))
      return {
        amount: str(v.amount),
        currency: str(v.currency) || currency,
      };
    if (type === 'date_range' && isObj(v))
      return { from: str(v.from), to: str(v.to) };
    if (type === 'address' && isObj(v)) {
      const out = emptyForm('address', currency) as AddressForm;
      for (const f of ADDRESS_FIELDS) out[f] = str(v[f]);
      return out;
    }
  } catch {
    /* fall through */
  }
  return emptyForm(type, currency);
}

/** The wire string of a saved server value (the saver's baseline). */
export function valueToWire(
  type: AnswerType,
  value: unknown,
  currency: string,
): string {
  return encodeForm(type, valueToForm(type, value, currency));
}

// ── Validation: wire string -> payload for the PUT ────────────────────────────

/** Thrown (before any request) when the typed value is not valid. */
export interface AnswerValidationError {
  code: 'INVALID_ANSWER';
  /** Which field is wrong, e.g. "city" or "to". */
  field: string;
  /** Plain-words line for the InlineError. */
  message: string;
}

const invalid = (field: string, message: string) => ({
  ok: false as const,
  error: { code: 'INVALID_ANSWER' as const, field, message },
});

export type PayloadResult =
  | { ok: true; value: AnswerValue | '' }
  | { ok: false; error: AnswerValidationError };

/** Validate a wire string for its type and build the PUT value ('' clears). */
export function toPayload(type: AnswerType, wire: string): PayloadResult {
  if (wire.trim() === '') return { ok: true, value: '' };
  if (type === 'text') {
    return wire.trim().length > ANSWER_TEXT_MAX
      ? invalid('text', 'This answer is over 2,000 characters. Shorten it.')
      : { ok: true, value: wire.trim() };
  }
  const f = decodeForm(type, wire, DEFAULT_CURRENCY);
  switch (type) {
    case 'date': {
      const d = str(f).trim();
      return isRealIsoDate(d)
        ? { ok: true, value: d }
        : invalid('date', 'Choose a real date.');
    }
    case 'date_range': {
      const r = f as DateRangeValue;
      if (!isRealIsoDate(r.from))
        return invalid('from', 'Choose a start date.');
      if (!isRealIsoDate(r.to)) return invalid('to', 'Choose an end date.');
      if (r.to < r.from)
        return invalid('to', 'The end date can’t be before the start date.');
      return { ok: true, value: { from: r.from, to: r.to } };
    }
    case 'money': {
      const m = f as MoneyForm;
      const n = parseAmount(m.amount);
      if (n === null)
        return invalid('amount', 'Enter an amount, like 1,200 or 850.50.');
      const cur = m.currency.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(cur))
        return invalid('currency', 'Choose a currency.');
      return { ok: true, value: { amount: n, currency: cur } };
    }
    case 'address': {
      const a = f as AddressForm;
      const need: [keyof AddressForm, string][] = [
        ['line1', 'Add the first line of the address.'],
        ['city', 'Add the town or city.'],
        ['country', 'Add the country.'],
      ];
      for (const [k, msg] of need)
        if (a[k].trim() === '') return invalid(k, msg);
      const value: AddressValue = {
        line1: a.line1.trim(),
        city: a.city.trim(),
        country: a.country.trim(),
      };
      for (const k of ['line2', 'region', 'postcode', 'note'] as const)
        if (a[k].trim() !== '') value[k] = a[k].trim();
      return { ok: true, value };
    }
    case 'list': {
      const rows = (f as string[]).map((x) => x.trim()).filter((x) => x !== '');
      if (rows.length > LIST_MAX_ENTRIES)
        return invalid('list', 'You can add up to 20 entries.');
      if (rows.some((x) => x.length > LIST_ENTRY_MAX))
        return invalid('list', 'Each entry can be up to 500 characters.');
      return { ok: true, value: rows };
    }
  }
}

// ── Sentence case ─────────────────────────────────────────────────────────────

/**
 * Item titles are shown with the first letter capitalised ("the dates you're
 * planning…" -> "The dates you're planning…"). Display only: the stored text,
 * citation quote and appliesWhen stay verbatim.
 */
export function sentenceCase(s: string): string {
  const i = s.search(/\S/);
  if (i < 0) return s;
  return s.slice(0, i) + s.charAt(i).toLocaleUpperCase() + s.slice(i + 1);
}
