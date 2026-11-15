// ─────────────────────────────────────────────────────────────────────────────
// Seli Explorer — static product content (japa#145).
//
// What used to be explorer/data.ts, minus every demo fixture. data.ts shipped
// a whole fake persona with destinations, agents,
// agencies, applications, messages, payments and more, which screens fell back
// to whenever a query was empty or failing. Those are gone: screens now render
// backend data or a loading / empty / error state (see states.tsx).
//
// What stays is product content, not data:
//   • formatMoney / aboutUsd /  the ONE money formatter set (japa#183): any
//     priceParts / priceInline  { amountMinor, currency } in its own symbol
//                               and decimals; the "about $X" dollar line
//   • NAIRA                     legacy whole-naira formatter, kept ONLY for
//                               subscription.tsx until #184 moves plan prices
//   • STATUS / DOC_STATUS /     display maps (label + colours) for application,
//     PAY_STATUS                document and payment statuses
//   • CATS                      Explore category chips
//   • CONSULT_TOPICS            topics offered when booking a consultation
//   • PLAN_FEATURES             plan feature copy, keyed by catalogue key
//   • ONBOARD                   the welcome carousel slides
// View-model types live in src/types/explorer.type.ts; country / location
// imagery lives in src/assets/countries.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { IMG } from '@/assets/countries';
import type { OnboardSlide } from '@/types/explorer.type';
import type { LocalPriceQuote, Money } from '@/types/money.type';

// ── Currency (legacy) ────────────────────────────────────────────────────────
// Whole naira → "₦12,500". ONLY subscription.tsx still uses this (plan prices
// move to dollars under #184). Everything else formats real backend money
// through `formatMoney` below. Do not add new callers.
export const NAIRA = (n: number) => '₦' + n.toLocaleString();

// ── Money formatting (japa#183) ──────────────────────────────────────────────
//
// The app never computes a rate or converts a currency: the server sends the
// dollar price AND its local figure (or the locked charge), and these helpers
// only turn `{ amountMinor, currency }` into text.
//
// Decimals come from the currency's own exponent (NGN kobo and USD cents are
// 2; UGX / XOF are 0, their minor unit IS the major unit). The table mirrors
// seli-backend `money/currencies.ts`; an unknown code still formats, with
// its ISO code as the prefix ("ABC 12.50") and 2 decimals, so a new currency
// enabled on the server never crashes or mislabels as "₦".

/** One currency the app knows how to print. */
interface CurrencyDisplay {
  /** Decimal places of the major unit (USD 2 → 100 cents; UGX 0). */
  exponent: number;
  /** Printed before the amount. */
  symbol: string;
}

/** Mirror of the backend currency table (symbols + exponents only). */
const CURRENCY_DISPLAY: Record<string, CurrencyDisplay> = {
  USD: { exponent: 2, symbol: '$' },
  NGN: { exponent: 2, symbol: '₦' },
  GBP: { exponent: 2, symbol: '£' },
  EUR: { exponent: 2, symbol: '€' },
  CAD: { exponent: 2, symbol: 'CA$' },
  GHS: { exponent: 2, symbol: 'GH₵' },
  KES: { exponent: 2, symbol: 'KSh' },
  ZAR: { exponent: 2, symbol: 'R' },
  UGX: { exponent: 0, symbol: 'USh' },
  XOF: { exponent: 0, symbol: 'CFA' },
};

/**
 * Display info for a code: the table row, or the ISO code + a space with 2
 * decimals for a code the app does not list yet.
 */
function currencyDisplay(currency: string): CurrencyDisplay {
  const code = (currency ?? '').trim().toUpperCase();
  return CURRENCY_DISPLAY[code] ?? { exponent: 2, symbol: `${code} ` };
}

/**
 * How many minor units make one major unit (100 for NGN/USD, 1 for UGX).
 * The ONLY place the app applies a minor-unit factor; analytics uses it to
 * report a `value` in major units.
 */
export function minorUnitFactor(currency: string): number {
  return 10 ** currencyDisplay(currency).exponent;
}

/** "1234567" → "1,234,567" (no Intl: Hermes and Node agree on this). */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** True when `m` is a usable amount (integer-ish finite number + a code). */
function isMoney(m: unknown): m is Money {
  if (!m || typeof m !== 'object') return false;
  const { amountMinor, currency } = m as Partial<Money>;
  return (
    typeof amountMinor === 'number' &&
    Number.isFinite(amountMinor) &&
    typeof currency === 'string' &&
    currency.trim().length > 0
  );
}

/**
 * Format money in its own currency.
 *
 *   formatMoney({ amountMinor: 5_000_000, currency: 'NGN' }) → "₦50,000.00"
 *   formatMoney({ amountMinor: 3500, currency: 'USD' })      → "$35.00"
 *   formatMoney({ amountMinor: 50000, currency: 'UGX' })     → "USh50,000"
 *   formatMoney(x, { whole: true })                          → "₦50,000"
 *
 * @param m       the amount; null / malformed gives '' (callers decide the
 *                fallback copy, e.g. "Contact for pricing")
 * @param opts.whole round to whole major units (half up) and print no
 *                decimals: for INDICATIVE prices that can still move
 *                (list rows, the agent bar). Exact amounts that were locked
 *                or paid keep their decimals.
 */
export function formatMoney(
  m: Money | null | undefined,
  opts: { whole?: boolean } = {},
): string {
  if (!isMoney(m)) return '';
  const { exponent, symbol } = currencyDisplay(m.currency);
  const negative = m.amountMinor < 0;
  // Minor units are integers by contract; round defensively once.
  const abs = Math.round(Math.abs(m.amountMinor));
  const factor = 10 ** exponent;
  let body: string;
  if (opts.whole || exponent === 0) {
    // Half-up to the nearest major unit.
    body = groupThousands(String(Math.floor((abs + factor / 2) / factor)));
  } else {
    const major = Math.floor(abs / factor);
    const minor = String(abs % factor).padStart(exponent, '0');
    body = `${groupThousands(String(major))}.${minor}`;
  }
  return `${negative ? '-' : ''}${symbol}${body}`;
}

/** A dollar `Money` from integer US cents (e.g. a booking's `priceUsdCents`). */
export function usdCents(cents: number | null | undefined): Money | null {
  return typeof cents === 'number' && Number.isFinite(cents)
    ? { amountMinor: cents, currency: 'USD' }
    : null;
}

/**
 * The dollar side as "about $35" (whole dollars). For a price whose local
 * figure can still move with the rate. Takes no rate: the dollar figure is
 * the server's. Null when there is no dollar price.
 */
export function aboutUsd(usd: Money | null | undefined): string | null {
  if (!isMoney(usd)) return null;
  return `about ${formatMoney(usd, { whole: true })}`;
}

/**
 * The local figure of a read quote, or null when the server could not price
 * it (`available: false`, a null amount, or no quote at all).
 */
export function formatLocalQuote(
  quote: LocalPriceQuote | null | undefined,
  opts: { whole?: boolean } = {},
): string | null {
  if (!quote || !quote.available || quote.amountMinor === null) return null;
  const text = formatMoney(
    { amountMinor: quote.amountMinor, currency: quote.currency },
    opts,
  );
  return text || null;
}

/** What a screen renders for one price (see `priceParts`). */
export interface PriceParts {
  /** The big line: the local amount, the dollar price, or "Free". */
  primary: string;
  /** The small line under / after it ("about $35", "$35.00"), or null. */
  secondary: string | null;
  /** True for a $0 / missing dollar price (the backend books it free). */
  free: boolean;
  /**
   * True when a local figure was expected (non-USD viewer) but the server
   * could not price it: the screen shows the dollar price only and may say
   * "Naira price unavailable". Never an error state.
   */
  localUnavailable: boolean;
}

/**
 * THE price pattern (design spec, japa#183): primary = local amount,
 * secondary = the dollar price. Never the other way round.
 *
 * @param local     the local figure: a read quote (`LocalPriceQuote`) or a
 *                  locked / paid charge (`Money`)
 * @param usd       the dollar price (`Money` in USD), null = no price
 * @param opts.locked the amount was locked or paid: show it exactly and the
 *                  dollar line as "$35.00" (no "about": the rate can't move)
 * @param opts.freeWhenNoUsd a null / $0 dollar price reads "Free" (agent
 *                  consultation fees). Off: a null price gives primary ''
 *                  so the caller shows its own copy ("Contact for pricing").
 */
export function priceParts(
  local: LocalPriceQuote | Money | null | undefined,
  usd: Money | null | undefined,
  opts: { locked?: boolean; freeWhenNoUsd?: boolean } = {},
): PriceParts {
  const hasUsd = isMoney(usd);
  // ── Free / no price ────────────────────────────────────────────────────
  if (!hasUsd || usd.amountMinor === 0) {
    // A local charge can exist without a dollar price only on odd legacy
    // rows: still show what was charged rather than "Free".
    if (!hasUsd && isMoney(local) && !('available' in local)) {
      return {
        primary: formatMoney(local),
        secondary: null,
        free: false,
        localUnavailable: false,
      };
    }
    const free = hasUsd || !!opts.freeWhenNoUsd;
    return {
      primary: free ? 'Free' : '',
      secondary: null,
      free,
      localUnavailable: false,
    };
  }

  // ── The local figure, if the server gave one ────────────────────────────
  let localText: string | null = null;
  let localCurrency: string | null = null;
  if (local && 'available' in local) {
    localCurrency = local.currency;
    localText = formatLocalQuote(local, { whole: !opts.locked });
  } else if (isMoney(local)) {
    localCurrency = local.currency;
    localText = formatMoney(local, { whole: !opts.locked }) || null;
  }

  // A USD viewer: "$35.00" only, no second line.
  if (localCurrency?.toUpperCase() === 'USD' && localText) {
    return {
      primary: formatMoney(usd),
      secondary: null,
      free: false,
      localUnavailable: false,
    };
  }

  // No local figure: dollar price only (exact), flag it when one was expected.
  if (!localText) {
    return {
      primary: formatMoney(usd),
      secondary: null,
      free: false,
      localUnavailable:
        !!localCurrency && localCurrency.toUpperCase() !== 'USD',
    };
  }

  return {
    primary: localText,
    secondary: opts.locked ? formatMoney(usd) : aboutUsd(usd),
    free: false,
    localUnavailable: false,
  };
}

/**
 * "$6.00 at ₦1,353.97 per $1" (japa#332): the dollar price and the rate the
 * payer EFFECTIVELY pays, on the pay screen, the confirmation and a priced
 * payment request.
 *
 * `effectiveRate` is the server's `effectiveRate` field: local units per
 * 1 USD, amount charged ÷ dollar price, Seli's markup already included. It
 * is the ONLY rate a client is sent (the raw mid-market rate and the markup
 * stay on the server), and the only rate that agrees with the amount on
 * screen. It is only FORMATTED here (`formatRate`: "₦1,353.97", "£0.7883"):
 * nothing is multiplied by it and the app never works a rate out itself.
 *
 * Falls back to the dollar price alone ("$6.00") when there is no usable
 * rate: a free booking, a legacy record priced before rates were stored, a
 * malformed value, or a charge in USD (where "per $1" says nothing).
 *
 * @param usd           the dollar price (`Money` in USD); null gives ''
 * @param currency      the currency the client is charged in, e.g. "NGN"
 * @param effectiveRate the server's `effectiveRate`; anything that is not a
 *                      finite number above zero counts as "no rate"
 */
export function usdAtRateLine(
  usd: Money | null | undefined,
  currency: string | null | undefined,
  effectiveRate: unknown,
): string {
  const usdText = formatMoney(usd);
  if (
    !usdText ||
    !currency ||
    currency.toUpperCase() === 'USD' ||
    !isUsableRate(effectiveRate)
  ) {
    return usdText;
  }
  return `${usdText} at ${formatRate(effectiveRate, currency)} per $1`;
}

/**
 * A rate in `currency`, with enough decimals that "dollar price × rate"
 * gives back the amount charged:
 *  - below 10 (GBP, EUR, CAD...): 4 decimals, "£0.7883". Money's usual 2
 *    would print "£0.79", which turns $100.00 into £79.00 instead of the
 *    £78.83 really charged;
 *  - 10 and above (NGN, KES, UGX...): 2 decimals, "₦1,353.97".
 *
 * A rate is NOT an amount of money, so the currency's own decimals do not
 * apply (a zero-decimal currency still shows 2). Rounded half up, once, on
 * the server's figure; thousands grouped like `formatMoney`.
 */
function formatRate(rate: number, currency: string): string {
  const decimals = rate < 10 ? 4 : 2;
  const factor = 10 ** decimals;
  // Whole "rate units" at the chosen precision, then split like money.
  const scaled = Math.round(rate * factor);
  const whole = Math.floor(scaled / factor);
  const fraction = String(scaled % factor).padStart(decimals, '0');
  const { symbol } = currencyDisplay(currency);
  return `${symbol}${groupThousands(String(whole))}.${fraction}`;
}

/**
 * True for a rate that can be shown: a finite number above zero. Takes
 * `unknown` because the value comes straight off an API response or a route
 * param, so absent, null, a string, NaN, 0 and negatives are all "no rate".
 */
export function isUsableRate(rate: unknown): rate is number {
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0;
}

/**
 * The calm note shown when the server could not give a local figure:
 * "Naira price unavailable" for NGN, else "Local price unavailable".
 */
export function localUnavailableNote(
  currency: string | null | undefined,
): string {
  return (currency ?? '').toUpperCase() === 'NGN'
    ? 'Naira price unavailable'
    : 'Local price unavailable';
}

/** One-line form of `priceParts`: "₦47,389 · about $35" (or the primary alone). */
export function priceInline(parts: PriceParts): string {
  return parts.secondary
    ? `${parts.primary} · ${parts.secondary}`
    : parts.primary;
}

// ── Explore category chips ───────────────────────────────────────────────────
export const CATS = ['All', 'Work', 'Study', 'PR', 'Family'];

// ── Status display maps ──────────────────────────────────────────────────────
// Application status (Explorer bucket) → pill label + colours.
export const STATUS: Record<string, { label: string; fg: string; bg: string }> =
  {
    // japa#174: a started, unsubmitted application is a Draft, not "Under review".
    draft: { label: 'Draft', fg: '#8B8499', bg: 'rgba(23,19,38,0.06)' },
    documents: { label: 'Documents required', fg: '#B26A14', bg: '#FCEAC8' },
    review: { label: 'Under review', fg: '#2F62A0', bg: '#DCEBF7' },
    interview: { label: 'Interview scheduled', fg: '#5A49C4', bg: '#ECE9FB' },
    submitted: { label: 'Submitted', fg: '#1F8A7A', bg: '#D6F0EC' },
    approved: { label: 'Approved', fg: '#1E8E55', bg: '#D6F2E2' },
  };

// Document status → chip label + colours.
export const DOC_STATUS: Record<
  string,
  { label: string; fg: string; bg: string }
> = {
  verified: { label: 'Verified', fg: '#1E8E55', bg: '#D6F2E2' },
  uploaded: { label: 'In review', fg: '#2F62A0', bg: '#DCEBF7' },
  rejected: { label: 'Rejected', fg: '#C0453C', bg: '#FBE3E1' },
  missing: { label: 'Not uploaded', fg: '#8B8499', bg: 'rgba(23,19,38,0.06)' },
};

// Payment status → pill label + colours.
export const PAY_STATUS: Record<
  string,
  { label: string; fg: string; bg: string }
> = {
  paid: { label: 'Paid', fg: '#1E8E55', bg: '#D6F2E2' },
  pending: { label: 'Pending', fg: '#B26A14', bg: '#FCEAC8' },
  refunded: { label: 'Refunded', fg: '#8B8499', bg: 'rgba(23,19,38,0.06)' },
};

// ── Consultation topics offered when booking ─────────────────────────────────
export const CONSULT_TOPICS = [
  'Visa eligibility',
  'Document review',
  'Application strategy',
  'Interview prep',
  'General questions',
];

// ── Plan feature copy (catalogue key → sentence) ─────────────────────────────
// Live plans (GET /plans) are the source of names and prices; this is copy.
export const PLAN_FEATURES: Record<string, string> = {
  create: 'Create applications',
  messaging: 'Agent messaging',
  consults: 'Book consultations',
  docs: 'Document uploads',
  self: 'Self-service flow',
  priority: 'Priority support',
  alerts: 'Visa news alerts',
};

// ── Auth onboarding carousel slides ──────────────────────────────────────────
export const ONBOARD: OnboardSlide[] = [
  {
    id: 'o1',
    img: IMG('1436491865332-7a61a109cc05'),
    tone: '#1E2A44',
    kicker: 'Your move, made simple',
    title: 'Every visa,\none clear path',
    body: 'Explore hand-picked routes to 30+ countries with real processing times and costs.',
  },
  {
    id: 'o2',
    img: IMG('1521737604893-d14cc237f11d'),
    tone: '#2A2036',
    kicker: 'Guided by experts',
    title: 'Vetted agents\nby your side',
    body: 'Message government-licensed specialists who’ve done it hundreds of times.',
  },
  {
    id: 'o3',
    img: IMG('1526304640581-d334cdbbf45e'),
    tone: '#243A44',
    kicker: 'Always in the loop',
    title: 'Track it all,\nstart to visa',
    body: 'Live status, document checklists and reminders — from application to approval.',
  },
];
