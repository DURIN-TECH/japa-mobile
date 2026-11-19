// Unit tests: 404 detection + retry policy (japa#106).
import { describe, expect, it } from '@jest/globals';
import {
  classifyStartError,
  getDuplicateApplication,
  isNotFoundError,
  retryUnlessNotFound,
} from '../queryErrors';

describe('isNotFoundError', () => {
  it('is true only for an ApiError with status 404', () => {
    expect(
      isNotFoundError({ code: 'NOT_FOUND', message: '', status: 404 }),
    ).toBe(true);
    expect(
      isNotFoundError({ code: 'NETWORK_ERROR', message: '', status: 0 }),
    ).toBe(false);
    // 403 (someone else's record) reads as not found (#174).
    expect(isNotFoundError({ status: 403 })).toBe(true);
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

// Start-application failure mapping (japa#174).
describe('classifyStartError', () => {
  it('maps 402 to upgrade, 404/403 to unavailable, the rest to retry', () => {
    expect(classifyStartError({ status: 402 })).toBe('upgrade');
    expect(classifyStartError({ status: 404 })).toBe('unavailable');
    expect(classifyStartError({ status: 403 })).toBe('unavailable');
    expect(classifyStartError({ status: 500 })).toBe('retry');
    expect(classifyStartError({ status: 0 })).toBe('retry');
    expect(classifyStartError(new Error('x'))).toBe('retry');
    expect(classifyStartError(null)).toBe('retry');
  });
});

// Duplicate-application 409 (japa#253).
describe('getDuplicateApplication', () => {
  const dup = {
    status: 409,
    code: 'DUPLICATE_ACTIVE_APPLICATION',
    message: '',
    data: {
      existingApplication: { id: 'app-1', visaTypeName: 'Skilled Worker' },
    },
  };
  it('returns the existing application from the 409', () => {
    expect(getDuplicateApplication(dup)?.id).toBe('app-1');
  });
  it('is null for other 409s, other statuses, and malformed bodies', () => {
    expect(getDuplicateApplication({ ...dup, code: 'CONFLICT' })).toBeNull();
    expect(getDuplicateApplication({ ...dup, status: 400 })).toBeNull();
    expect(getDuplicateApplication({ ...dup, data: undefined })).toBeNull();
    expect(
      getDuplicateApplication({ ...dup, data: { existingApplication: {} } }),
    ).toBeNull();
    expect(getDuplicateApplication(null)).toBeNull();
  });
});
