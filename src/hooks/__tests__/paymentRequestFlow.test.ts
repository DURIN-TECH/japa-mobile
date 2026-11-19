// Unit tests: payment-request checkout helpers (japa#145).
import { describe, expect, it } from '@jest/globals';
import {
  getAuthorizationUrl,
  getPaystackReference,
  isPaidResult,
} from '../paymentRequestFlow';
import { isUnavailableError, retryUnlessUnavailable } from '../queryErrors';

describe('getAuthorizationUrl', () => {
  it('returns an https checkout url', () => {
    expect(
      getAuthorizationUrl({
        authorizationUrl: 'https://checkout.paystack.com/x',
      }),
    ).toBe('https://checkout.paystack.com/x');
  });
  it('rejects missing, non-string and non-https values', () => {
    expect(getAuthorizationUrl(undefined)).toBeNull();
    expect(getAuthorizationUrl({})).toBeNull();
    expect(getAuthorizationUrl({ authorizationUrl: 5 })).toBeNull();
    expect(
      getAuthorizationUrl({ authorizationUrl: 'javascript:alert(1)' }),
    ).toBeNull();
    expect(
      getAuthorizationUrl({ authorizationUrl: 'http://x.com' }),
    ).toBeNull();
  });
});

describe('getPaystackReference', () => {
  it('returns a non-empty string reference only', () => {
    expect(getPaystackReference({ paystackReference: 'ref_1' })).toBe('ref_1');
    expect(getPaystackReference({ paystackReference: '' })).toBeNull();
    expect(getPaystackReference(null)).toBeNull();
  });
});

describe('isPaidResult', () => {
  it('is true only when status is paid', () => {
    expect(isPaidResult({ status: 'paid' })).toBe(true);
    // Verify answers 200 with the request still approved when abandoned.
    expect(
      isPaidResult({ status: 'approved', paymentStatus: 'abandoned' }),
    ).toBe(false);
    expect(isPaidResult(undefined)).toBe(false);
  });
});

describe('isUnavailableError / retryUnlessUnavailable', () => {
  it('treats 403 and 404 as final', () => {
    expect(isUnavailableError({ status: 403 })).toBe(true);
    expect(isUnavailableError({ status: 404 })).toBe(true);
    expect(isUnavailableError({ status: 500 })).toBe(false);
    expect(isUnavailableError(null)).toBe(false);
    expect(retryUnlessUnavailable(0, { status: 403 })).toBe(false);
    expect(retryUnlessUnavailable(0, { status: 500 })).toBe(true);
    expect(retryUnlessUnavailable(2, { status: 500 })).toBe(false);
  });
});
