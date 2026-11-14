/**
 * Paystack checkout that returns to the app (japa#252)
 *
 * Both app checkouts (a subscription upgrade, and paying an agent's payment
 * request) open Paystack in an in-app AUTH browser
 * (`WebBrowser.openAuthSessionAsync`: ASWebAuthenticationSession on iOS, a
 * Custom Tab on Android) instead of handing the URL to Safari / Chrome. The
 * backend (opted in with `returnTo: 'app'`) gives Paystack a `callback_url`
 * on its public return page, which redirects to the fixed deep link
 * `durintech://payment-return?reference=…`; the auth browser sees that URL,
 * closes on its own, and the app is back on the screen that started it.
 *
 * NOTHING HERE TRUSTS THE REDIRECT. Landing on the deep link, or the user
 * closing the browser, only means "the checkout is over, go and ask the
 * backend". The reference verified is the one OUR backend returned when it
 * created the checkout, never one read from the deep link, so a forged
 * `durintech://payment-return?reference=x` cannot point verify at another
 * transaction. The plan / payment changes only if the authenticated verify
 * endpoint (`POST /subscriptions/verify`, `POST /payment-requests/:id/verify`)
 * confirms it with Paystack.
 *
 * Pure apart from the injected functions, so it is unit-tested directly.
 */

/**
 * The deep link the backend return page redirects to. Must match the
 * backend's fixed `APP_RETURN_URL` (seli-backend
 * `services/billing/payment-return.ts`) and the `scheme` in `app.json`
 * (`durintech`). The auth browser closes when it navigates here.
 */
export const APP_PAYMENT_RETURN_URL = 'durintech://payment-return';

/** Body field the app sends so the backend uses the app return page. */
export const RETURN_TO_APP = 'app' as const;

/**
 * What `openAuthSessionAsync` resolves with (the subset we read).
 * `success` = the browser reached `APP_PAYMENT_RETURN_URL`;
 * `cancel` / `dismiss` = the user closed it; `locked` = another auth session
 * is already open, so this one never started.
 */
export interface AuthSessionResult {
  type: string;
  url?: string;
}

/** Opens `url` in the auth browser and waits until it closes. */
export type OpenAuthSession = (
  url: string,
  redirectUrl: string,
) => Promise<AuthSessionResult>;

/** What a verify call concluded: the backend confirmed payment, or did not. */
export type VerifyVerdict = 'paid' | 'not_paid';

/**
 * How a checkout ended, for the screen to render:
 * - `paid`        → backend confirmed: show the result (plan / confirmation);
 * - `not_paid`    → backend says no payment (yet): message + retry;
 * - `error`       → the verify call itself failed (network, 5xx): message + retry;
 * - `open_failed` → checkout never opened (verify was NOT called).
 * `returned` is true when the browser came back through the return page
 * (`success`), false when the user closed it (`cancel` / `dismiss`).
 */
export type CheckoutOutcome =
  | { kind: 'paid' | 'not_paid' | 'error'; returned: boolean }
  | { kind: 'open_failed' };

/**
 * Open the Paystack checkout in the auth browser, then verify ONCE with the
 * backend whatever way the browser closed (the user may have paid just
 * before closing it; the webhook may also have applied it already, which the
 * verify endpoints report as success).
 *
 * @param authorizationUrl Paystack hosted checkout (https, from our backend)
 * @param openAuthSession  `WebBrowser.openAuthSessionAsync` (injected for tests)
 * @param verify           calls the backend verify endpoint with the
 *                         checkout's own reference; resolves the verdict, or
 *                         throws when the call failed
 */
export async function runPaystackCheckout({
  authorizationUrl,
  openAuthSession,
  verify,
}: {
  authorizationUrl: string;
  openAuthSession: OpenAuthSession;
  verify: () => Promise<VerifyVerdict>;
}): Promise<CheckoutOutcome> {
  // Only ever open an https checkout URL (never another scheme).
  if (!/^https:\/\//i.test(authorizationUrl)) return { kind: 'open_failed' };

  let result: AuthSessionResult;
  try {
    result = await openAuthSession(authorizationUrl, APP_PAYMENT_RETURN_URL);
  } catch {
    return { kind: 'open_failed' };
  }
  // Another auth session was already open: this checkout never showed.
  if (result.type === 'locked') return { kind: 'open_failed' };

  // `success` = came back through the return page; anything else = closed.
  const returned = result.type === 'success';
  try {
    return { kind: await verify(), returned };
  } catch {
    return { kind: 'error', returned };
  }
}

/**
 * Map a failed `POST /subscriptions/verify` to a verdict. That endpoint
 * answers 400 ("Could not verify payment") when Paystack has no successful
 * charge for the reference, or it belongs to someone else: that is "not
 * paid", not a broken call. Anything else (network, 5xx) is rethrown so the
 * screen shows the error + retry.
 */
export function subscriptionVerifyErrorVerdict(error: unknown): VerifyVerdict {
  const status =
    typeof error === 'object' && error !== null
      ? (error as { status?: unknown }).status
      : undefined;
  if (status === 400) return 'not_paid';
  throw error;
}

/** Copy: subscription checkout came back but the backend saw no payment. */
export const SUBSCRIPTION_NOT_PAID_MESSAGE =
  'We haven’t received your payment, so your plan hasn’t changed. Try upgrading again.';

/** Copy: the subscription verify call failed (retry re-checks it). */
export const SUBSCRIPTION_VERIFY_ERROR_MESSAGE =
  'We couldn’t confirm your payment. Check your connection and try again.';

/** Copy: the checkout could not be opened at all. */
export const OPEN_CHECKOUT_ERROR_MESSAGE =
  'We couldn’t open checkout. Try again in a moment.';
