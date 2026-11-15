// ─────────────────────────────────────────────────────────────────────────────
// Money shapes the backend returns (japa#178 / #183).
//
// Mirrors seli-backend `functions/src/types/money.ts`. Product rule: prices are
// SET and STORED in US dollars; a client SEES the price in their local
// currency at the server's current rate and PAYS that local amount.
//
// Hard rules for the app:
//  - Currency always travels with the amount. A bare number is never money.
//  - Amounts are INTEGER minor units (cents, kobo; a zero-decimal currency's
//    minor unit IS its major unit).
//  - The app never supplies an amount, a currency or a rate, and never
//    converts one currency into another. It only formats what it is given.
// ─────────────────────────────────────────────────────────────────────────────

/** ISO 4217 alphabetic code, upper case ("NGN", "USD"). */
export type CurrencyCode = string;

/** An amount of money in integer minor units of `currency`. */
export interface Money {
  amountMinor: number;
  currency: CurrencyCode;
}

/**
 * A dollar price's local-currency figure, as the public reads return it next
 * to the stored dollar `Money` (backend `LocalPriceQuote`, issue #179).
 *
 * When the server has no usable rate the read still succeeds with
 * `available: false` and null amount / rate / asOf: the app then shows the
 * dollar price only. `currency` is always set.
 */
export interface LocalPriceQuote {
  /** Minor units of `currency` (kobo for NGN); null when unavailable. */
  amountMinor: number | null;
  currency: CurrencyCode;
  /** Local units per 1 USD used for this figure; null when unavailable. */
  rate: number | null;
  /** When the rate was published (ISO 8601); null when unavailable. */
  asOf: string | null;
  available: boolean;
}
