// Unit tests: Paystack checkout that returns to the app (japa#252).
// Pure orchestrator: the auth browser and the verify call are injected fakes.
import { describe, expect, it, jest } from '@jest/globals';
import {
  APP_PAYMENT_RETURN_URL,
  paymentReturnLeaveAction,
  runPaystackCheckout,
  subscriptionVerifyErrorVerdict,
  type AuthSessionResult,
  type VerifyVerdict,
} from '../paystackCheckout';

const CHECKOUT = 'https://checkout.paystack.com/abc';

/** An auth browser that closes with `result`. */
function browser(result: AuthSessionResult) {
  // Arguments are read back through `toHaveBeenCalledWith`.
  return jest.fn(async (...args: [string, string]) => {
    void args;
    return result;
  });
}

describe('runPaystackCheckout', () => {
  it('opens the checkout with the app return URL as the redirect', async () => {
    const open = browser({ type: 'success', url: APP_PAYMENT_RETURN_URL });
    await runPaystackCheckout({
      authorizationUrl: CHECKOUT,
      openAuthSession: open,
      verify: async () => 'paid',
    });
    expect(open).toHaveBeenCalledWith(CHECKOUT, 'durintech://payment-return');
  });

  it('success redirect + verify paid → paid (returned)', async () => {
    const verify = jest.fn(async (): Promise<VerifyVerdict> => 'paid');
    const out = await runPaystackCheckout({
      authorizationUrl: CHECKOUT,
      openAuthSession: browser({
        type: 'success',
        url: `${APP_PAYMENT_RETURN_URL}?reference=ref_1`,
      }),
      verify,
    });
    expect(out).toEqual({ kind: 'paid', returned: true });
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('a success redirect is NOT trusted: verify not paid → not_paid', async () => {
    // e.g. a forged durintech://payment-return?reference=x
    const out = await runPaystackCheckout({
      authorizationUrl: CHECKOUT,
      openAuthSession: browser({
        type: 'success',
        url: `${APP_PAYMENT_RETURN_URL}?reference=forged`,
      }),
      verify: async () => 'not_paid',
    });
    expect(out).toEqual({ kind: 'not_paid', returned: true });
  });

  it.each(['cancel', 'dismiss'])(
    'user %s → still verifies once (paid just before closing?)',
    async (type) => {
      const verify = jest.fn(async (): Promise<VerifyVerdict> => 'not_paid');
      const out = await runPaystackCheckout({
        authorizationUrl: CHECKOUT,
        openAuthSession: browser({ type }),
        verify,
      });
      expect(verify).toHaveBeenCalledTimes(1);
      expect(out).toEqual({ kind: 'not_paid', returned: false });
    },
  );

  it('cancel but the payment went through → paid', async () => {
    const out = await runPaystackCheckout({
      authorizationUrl: CHECKOUT,
      openAuthSession: browser({ type: 'cancel' }),
      verify: async () => 'paid',
    });
    expect(out).toEqual({ kind: 'paid', returned: false });
  });

  it('verify call failing → error (never paid)', async () => {
    const out = await runPaystackCheckout({
      authorizationUrl: CHECKOUT,
      openAuthSession: browser({ type: 'success' }),
      verify: async () => {
        throw new Error('network');
      },
    });
    expect(out).toEqual({ kind: 'error', returned: true });
  });

  it('browser failing to open / locked / non-https url → open_failed, no verify', async () => {
    const verify = jest.fn(async (): Promise<VerifyVerdict> => 'paid');
    const throwing = jest.fn(async () => {
      throw new Error('no browser');
    });
    expect(
      await runPaystackCheckout({
        authorizationUrl: CHECKOUT,
        openAuthSession: throwing,
        verify,
      }),
    ).toEqual({ kind: 'open_failed' });
    expect(
      await runPaystackCheckout({
        authorizationUrl: CHECKOUT,
        openAuthSession: browser({ type: 'locked' }),
        verify,
      }),
    ).toEqual({ kind: 'open_failed' });
    const open = browser({ type: 'success' });
    expect(
      await runPaystackCheckout({
        authorizationUrl: 'javascript:alert(1)',
        openAuthSession: open,
        verify,
      }),
    ).toEqual({ kind: 'open_failed' });
    expect(open).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });
});

describe('subscriptionVerifyErrorVerdict', () => {
  it('400 (not paid / not yours) → not_paid', () => {
    expect(subscriptionVerifyErrorVerdict({ status: 400 })).toBe('not_paid');
  });
  it('network / 5xx errors are rethrown', () => {
    const err = { status: 500 };
    expect(() => subscriptionVerifyErrorVerdict(err)).toThrow();
    expect(() => subscriptionVerifyErrorVerdict(new Error('x'))).toThrow();
  });
});

describe('paymentReturnLeaveAction (Android /payment-return landing)', () => {
  it('never steps back while another screen (e.g. /confirmation) is on top', () => {
    expect(paymentReturnLeaveAction(false, true)).toBe('stay');
    expect(paymentReturnLeaveAction(false, false)).toBe('stay');
  });
  it('on top: back to the checkout screen, or home with no history', () => {
    expect(paymentReturnLeaveAction(true, true)).toBe('back');
    expect(paymentReturnLeaveAction(true, false)).toBe('home');
  });
});
