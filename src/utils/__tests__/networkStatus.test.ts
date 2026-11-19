// Offline signal (issue #172): the API client's NETWORK_ERROR sets it, the next
// success clears it, and a server answer (4xx/5xx) never counts as offline.

import { describe, expect, it } from '@jest/globals';
import {
  combineOffline,
  isNetworkError,
  lastCallFailedOfflineNow,
  reportApiResult,
  tracked,
} from '../networkStatus';

describe('networkStatus', () => {
  it('recognises the API client network error only', () => {
    expect(isNetworkError({ code: 'NETWORK_ERROR', status: 0 })).toBe(true);
    expect(isNetworkError({ code: 'VALIDATION_ERROR', status: 400 })).toBe(
      false,
    );
    expect(isNetworkError(null)).toBe(false);
  });

  it('offline = React Query offline OR last call failed offline', () => {
    expect(combineOffline(true, false)).toBe(false);
    expect(combineOffline(false, false)).toBe(true);
    expect(combineOffline(true, true)).toBe(true);
  });

  it('tracked: a network failure sets the flag and rethrows; the next success clears it', async () => {
    await expect(
      tracked(() => Promise.reject({ code: 'NETWORK_ERROR', status: 0 })),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(lastCallFailedOfflineNow()).toBe(true);
    await expect(tracked(() => Promise.resolve(1))).resolves.toBe(1);
    expect(lastCallFailedOfflineNow()).toBe(false);
  });

  it('a server answer (4xx/5xx) is not offline and clears the flag', () => {
    reportApiResult({ code: 'NETWORK_ERROR', status: 0 });
    expect(lastCallFailedOfflineNow()).toBe(true);
    reportApiResult({ code: 'INTERNAL_ERROR', status: 500 });
    expect(lastCallFailedOfflineNow()).toBe(false);
  });
});
