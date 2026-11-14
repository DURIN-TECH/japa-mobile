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
export const ADDRESS_FIELD_MAX = 200;
export const ADDRESS_NOTE_MAX = 500;

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

/** Fallback when neither the item text nor the visa country gives one. */
export const DEFAULT_CURRENCY = 'USD';

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

/** The visa country's currency (ISO 3166 alpha-2 -> ISO 4217). */
const COUNTRY_CURRENCY: Record<string, string> = {
  GB: 'GBP',
  US: 'USD',
  CA: 'CAD',
  AU: 'AUD',
  NZ: 'NZD',
  NG: 'NGN',
  CH: 'CHF',
  ...Object.fromEntries(
    'IE DE FR ES IT NL PT BE AT FI GR LU MT CY SK SI EE LV LT HR'
      .split(' ')
      .map((c) => [c, 'EUR']),
  ),
};

/**
 * The currency to start a money field on: a symbol or ISO code in the item text
 * (title, appliesWhen), else the visa country's currency, else USD. The user can
 * change it; never guessed silently because the chip always shows it.
 */
export function defaultCurrencyFor(
  text?: string,
  countryCode?: string,
): string {
  const hay = text ?? '';
  for (const [re, code] of SYMBOLS) if (re.test(hay)) return code;
  const code = CURRENCY_CHOICES.find((c) => new RegExp(`\\b${c}\\b`).test(hay));
  return (
    code ??
    COUNTRY_CURRENCY[(countryCode ?? '').toUpperCase()] ??
    DEFAULT_CURRENCY
  );
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
  dec = deviceDecimalSeparator(),
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
          amount: formatAmountForField(value.amount, dec),
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

/** The device's decimal separator ("." or ","). */
export function deviceDecimalSeparator(): string {
  try {
    const d = new Intl.NumberFormat(undefined)
      .formatToParts(1.1)
      .find((p) => p.type === 'decimal');
    return d?.value === ',' ? ',' : '.';
  } catch {
    return '.';
  }
}

export type AmountParse =
  | { ok: true; amount: number }
  | { ok: false; reason: 'ambiguous' | 'invalid' };

/**
 * Parse a typed amount using the device's decimal separator `dec`; the OTHER
 * mark is grouping. "850,50" -> 850.5 (comma locale), "1.200,50" -> 1200.5,
 * "1,200.50" -> 1200.5 (dot locale). Ambiguous input is rejected, never guessed:
 * both marks in the wrong order, a grouping mark not followed by exactly 3
 * digits ("850,50" on a dot device), or a lone decimal mark followed by exactly
 * 3 digits after a non-zero integer ("1.200").
 */
export function parseAmountDetailed(s: string, dec = '.'): AmountParse {
  const t = s.replace(/[\s\u00a0\u202f']/g, '');
  if (!/^[\d.,]+$/.test(t)) return { ok: false, reason: 'invalid' };
  const grp = dec === ',' ? '.' : ',';
  const parts = t.split(dec);
  if (parts.length > 2) return { ok: false, reason: 'ambiguous' };
  const [intPart, decPart] = parts;
  if (decPart !== undefined && (!/^\d+$/.test(decPart) || /\D/.test(decPart)))
    return {
      ok: false,
      reason: decPart.includes(grp) ? 'ambiguous' : 'invalid',
    };
  // Integer part: plain digits, or digits grouped as 1-3 then groups of 3.
  const grouped = intPart.includes(grp);
  if (grouped && !new RegExp(`^\\d{1,3}(\\${grp}\\d{3})+$`).test(intPart))
    return { ok: false, reason: 'ambiguous' };
  if (!grouped && !/^\d*$/.test(intPart))
    return { ok: false, reason: 'invalid' };
  if (intPart === '' && decPart === undefined)
    return { ok: false, reason: 'invalid' };
  if (
    !grouped &&
    decPart !== undefined &&
    decPart.length === 3 &&
    /^[1-9]\d{0,2}$/.test(intPart)
  )
    return { ok: false, reason: 'ambiguous' };
  const digits = intPart.split(grp).join('') || '0';
  const n = Number(decPart !== undefined ? `${digits}.${decPart}` : digits);
  return Number.isFinite(n) && n >= 0
    ? { ok: true, amount: n }
    : { ok: false, reason: 'invalid' };
}

/** Amount or null (see parseAmountDetailed). */
export function parseAmount(s: string, dec = '.'): number | null {
  const r = parseAmountDetailed(s, dec);
  return r.ok ? r.amount : null;
}

/** A number as the field shows it on a device with decimal mark `dec`. */
export const formatAmountForField = (n: number, dec: string): string =>
  String(n).replace('.', dec);

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
export function encodeForm(
  type: AnswerType,
  form: FormValue,
  dec = deviceDecimalSeparator(),
): string {
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
      // A readable amount is stored canonically ("." decimal); anything else
      // is kept as typed with the device's mark, so it is never altered.
      const n = parseAmount(m.amount, dec);
      return JSON.stringify({
        amount: n === null ? m.amount.trim() : String(n),
        currency: str(m.currency).trim().toUpperCase(),
        dec: n === null ? dec : '.',
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
 * of a saved value), or null when it cannot be read for this type. A plain
 * non-JSON string is a list entry (list) or the first field (address), as legacy
 * text is. Null means "show it, keep it, send nothing": see `toPayload`.
 */
export function tryDecodeForm(
  type: AnswerType,
  wire: string,
  currency: string,
  dec = deviceDecimalSeparator(),
): FormValue | null {
  if (type === 'text') return wire;
  if (wire.trim() === '') return emptyForm(type, currency);
  let v: unknown;
  try {
    v = JSON.parse(wire);
  } catch {
    // Not JSON: plain text.
    if (type === 'list') return [wire];
    if (type === 'address')
      return {
        ...(emptyForm('address', currency) as AddressForm),
        line1: wire,
      };
    if (type === 'date' && isRealIsoDate(wire.trim())) return wire.trim();
    return null;
  }
  switch (type) {
    case 'date':
      return typeof v === 'string' ? v : null;
    case 'list':
      if (typeof v === 'string') return [v];
      if (Array.isArray(v)) {
        // A non-empty draft must keep its content: "[]" or "[1,2]" has no text
        // entries, so it is unreadable (kept and shown), never an empty list.
        const rows = v.filter((x): x is string => typeof x === 'string');
        return rows.length ? rows : null;
      }
      return null;
    case 'money': {
      if (!isObj(v)) return null;
      const amount = str(v.amount);
      const n = parseAmount(amount, str(v.dec) || '.');
      return {
        amount: n === null ? amount : formatAmountForField(n, dec),
        currency: str(v.currency) || currency,
      };
    }
    case 'date_range':
      return isObj(v) ? { from: str(v.from), to: str(v.to) } : null;
    case 'address': {
      if (typeof v === 'string')
        return { ...(emptyForm('address', currency) as AddressForm), line1: v };
      if (!isObj(v)) return null;
      const out = emptyForm('address', currency) as AddressForm;
      for (const f of ADDRESS_FIELDS) out[f] = str(v[f]);
      return out;
    }
  }
  return null;
}

/** `tryDecodeForm`, with the empty form when unreadable (display only). */
export function decodeForm(
  type: AnswerType,
  wire: string,
  currency: string,
  dec = deviceDecimalSeparator(),
): FormValue {
  return tryDecodeForm(type, wire, currency, dec) ?? emptyForm(type, currency);
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
  | { ok: true; value: AnswerValue | '' | null }
  | { ok: false; error: AnswerValidationError };

/** Validate a wire string for its type and build the PUT value ('' clears). */
export function toPayload(type: AnswerType, wire: string): PayloadResult {
  // Clearing: text sends '', every structured type sends null.
  if (wire.trim() === '')
    return { ok: true, value: type === 'text' ? '' : null };
  if (type === 'text') {
    return wire.trim().length > ANSWER_TEXT_MAX
      ? invalid('text', 'This answer is over 2,000 characters. Shorten it.')
      : { ok: true, value: wire.trim() };
  }
  // Not empty but unreadable: NEVER an empty payload. Nothing is sent and the
  // draft stays (the caller shows it).
  const f = tryDecodeForm(type, wire, DEFAULT_CURRENCY, '.');
  if (f === null)
    return invalid(
      'draft',
      'We couldn’t read this saved draft, so it hasn’t been sent. It’s still on this device.',
    );
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
      // Parse the amount as the wire holds it (canonical, or as typed with the
      // mark of the device that typed it): one consistent path.
      const w = JSON.parse(wire) as { amount?: unknown; dec?: unknown };
      const dec = str(w.dec) || '.';
      const r = parseAmountDetailed(str(w.amount), dec);
      if (!r.ok) {
        const ex = formatAmountForField(1200.5, dec);
        return invalid(
          'amount',
          r.reason === 'ambiguous'
            ? `We’re not sure what that amount is. Write it like ${ex}, with just one decimal mark.`
            : `Enter an amount, like ${ex} or ${formatAmountForField(850, dec)}.`,
        );
      }
      const n = r.amount;
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

/**
 * Does a saved answer count as answered? A `legacy: true` answer (an old plain
 * text the server re-read into this type's shape) counts only when it really fits
 * the type: a plain string only for `text`, an address needs its required fields,
 * and so on. It is still shown, never lost. Without the flag, see
 * `isAnswerValueNonEmpty`.
 */
export function isSavedAnswerCounted(
  type: AnswerType,
  value: unknown,
  legacy?: boolean,
): boolean {
  if (!legacy) return isAnswerValueNonEmpty(type, value);
  if (typeof value === 'string')
    return (
      value.trim() !== '' &&
      (type === 'text' || (type === 'date' && isRealIsoDate(value)))
    );
  return isAnswerValueNonEmpty(type, value);
}

/** Label for each field a server 400 can name (`"value.to" must …`). */
const FIELD_LABELS: Record<string, string> = {
  from: 'From',
  to: 'To',
  amount: 'Amount',
  currency: 'Currency',
  line1: 'Address line 1',
  line2: 'Address line 2',
  city: 'Town or city',
  region: 'County or region',
  postcode: 'Postcode',
  country: 'Country',
  note: 'Note',
};

/**
 * The input a server 400 names: `"value.country" is required` -> 'country'.
 * Null when it names none.
 */
export function serverErrorField(message: string | undefined): string | null {
  const m = /value\.([A-Za-z0-9_]+)/.exec(message ?? '');
  return m ? m[1] : null;
}

/**
 * The server's message in plain words: `"value.x"` becomes its input's label,
 * `"value[3]"` becomes "Entry 4", and a bare `"value"` becomes "This answer".
 * Length limits get fixed copy.
 */
export function serverErrorMessage(message: string | undefined): string {
  const raw = message ?? '';
  if (!raw) return 'Check this answer and try again.';
  const tooLong = /(length|characters|at most|less than or equal)/i.test(raw);
  const entry = /"value\[(\d+)\]"/.exec(raw);
  if (entry && tooLong)
    return `Entry ${Number(entry[1]) + 1} is too long (${LIST_ENTRY_MAX} characters max).`;
  if (
    /"value"/.test(raw) &&
    /(items|entries|array)/i.test(raw) &&
    /\b20\b/.test(raw)
  )
    return 'You can add up to 20 entries.';
  if (/"value"/.test(raw) && tooLong && /2000/.test(raw))
    return 'This answer is too long (2,000 characters max).';
  return raw
    .replace(
      /"value\.([A-Za-z0-9_]+)"/g,
      (_, k: string) => FIELD_LABELS[k] ?? k,
    )
    .replace(/"value\[(\d+)\]"/g, (_, i: string) => `Entry ${Number(i) + 1}`)
    .replace(/"value"/g, 'This answer');
}

/** The order a type's fields are filled in (for "has the person moved past it"). */
const FIELD_ORDER: Partial<Record<AnswerType, string[]>> = {
  date_range: ['from', 'to'],
  money: ['amount', 'currency'],
  address: ADDRESS_FIELDS as string[],
};

/**
 * Should the inline message for an error on `field` show yet? Only once the
 * person has touched THAT field, or a later one (moved past it). An error on the
 * unreadable draft, or a whole-value error (no field), shows at once. A half-
 * filled form is not an error while they are still getting to the other field.
 */
export function shouldShowFieldError(
  type: AnswerType,
  field: string,
  touched: string[],
): boolean {
  if (field === 'draft') return true;
  const order = FIELD_ORDER[type];
  if (!order || !order.includes(field)) return touched.length > 0;
  const at = order.indexOf(field);
  return touched.some((t) => order.indexOf(t) >= at);
}
