// Unit tests: 404 detection + retry policy (japa#106).
import { describe, expect, it } from '@jest/globals';
import { isNotFoundError, retryUnlessNotFound } from '../queryErrors';

describe('isNotFoundError', () => {
  it('is true only for an ApiError with status 404', () => {
    expect(
      isNotFoundError({ code: 'NOT_FOUND', message: '', status: 404 }),
    ).toBe(true);
    expect(
      isNotFoundError({ code: 'NETWORK_ERROR', message: '', status: 0 }),
    ).toBe(false);
    expect(isNotFoundError({ status: 500 })).toBe(false);
    expect(isNotFoundError(null)).toBe(false);
    expect(isNotFoundError(new Error('x'))).toBe(false);
  });
});

describe('retryUnlessNotFound', () => {
  it('never retries a 404', () => {
    expect(retryUnlessNotFound(0, { status: 404 })).toBe(false);
  });
  it('retries other errors up to twice', () => {
    expect(retryUnlessNotFound(0, { status: 0 })).toBe(true);
    expect(retryUnlessNotFound(1, { status: 500 })).toBe(true);
    expect(retryUnlessNotFound(2, { status: 500 })).toBe(false);
  });
});
