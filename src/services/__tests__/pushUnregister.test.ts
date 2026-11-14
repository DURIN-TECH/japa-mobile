// ─────────────────────────────────────────────────────────────────────────────
// pushNotificationService.unregisterToken (issue #263).
//
// On the "session ended" path the backend call fails (no Firebase user → 401).
// The LOCAL token must still be deleted (that is what stops the previous
// user's pushes) and the listeners cleaned up. Firebase messaging and the API
// client are spies.
// ─────────────────────────────────────────────────────────────────────────────

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

const mockGetToken = jest.fn(async () => 'tok-A');
const mockDeleteToken = jest.fn(async () => {});
const mockApiDelete = jest.fn(async () => ({ success: true }));
const mockApiPost = jest.fn(async () => ({ success: true }));

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@react-native-firebase/app', () => ({ getApp: () => ({}) }));
jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: () => ({}),
  getToken: (...a: unknown[]) => mockGetToken(...(a as [])),
  deleteToken: (...a: unknown[]) => mockDeleteToken(...(a as [])),
  requestPermission: jest.fn(),
  onMessage: jest.fn(),
  onNotificationOpenedApp: jest.fn(),
  getInitialNotification: jest.fn(),
  onTokenRefresh: jest.fn(),
}));
jest.mock('@/services/api.service', () => ({
  apiService: {
    delete: (...a: unknown[]) => mockApiDelete(...(a as [])),
    post: (...a: unknown[]) => mockApiPost(...(a as [])),
  },
}));

import {
  pushNotificationService,
  PUSH_TEARDOWN_TIMEOUT_MS,
} from '../push-notification.service';

beforeEach(() => {
  jest.clearAllMocks();
  // The failure paths log a __DEV__ warning by design; keep test output clean.
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('unregisterToken', () => {
  it('removes the token on the backend, then deletes it locally', async () => {
    await pushNotificationService.unregisterToken();
    expect(mockApiDelete).toHaveBeenCalledWith('/users/fcm-token', {
      token: 'tok-A',
    });
    expect(mockDeleteToken).toHaveBeenCalledTimes(1);
  });

  it('still deletes the local token when the backend call fails (session ended)', async () => {
    mockApiDelete.mockRejectedValueOnce({ status: 401 });
    await expect(
      pushNotificationService.unregisterToken(),
    ).resolves.toBeUndefined();
    expect(mockDeleteToken).toHaveBeenCalledTimes(1);
  });

  it('runs listener cleanup even when every step fails', async () => {
    const unsub = jest.fn();
    // Simulate a live listener from the previous session.
    (
      pushNotificationService as unknown as { unsubscribers: (() => void)[] }
    ).unsubscribers.push(unsub);
    mockGetToken.mockRejectedValueOnce(new Error('no apns'));
    mockDeleteToken.mockRejectedValueOnce(new Error('no apns'));
    await pushNotificationService.unregisterToken();
    expect(unsub).toHaveBeenCalledTimes(1);
  });

  it('local only: skips getToken and the backend', async () => {
    await pushNotificationService.unregisterToken({ notifyBackend: false });
    expect(mockGetToken).not.toHaveBeenCalled();
    expect(mockApiDelete).not.toHaveBeenCalled();
    expect(mockDeleteToken).toHaveBeenCalledTimes(1);
  });
});

// Review round 1: on a slow or captive network the signed-out launch and the
// session-ended bounce await this teardown, so no step may hang it.
describe('unregisterToken on a slow network', () => {
  const never = () => new Promise<never>(() => {});

  /** Resolve `p` while advancing fake time; returns elapsed fake ms. */
  async function settle(p: Promise<unknown>) {
    let done = false;
    void p.then(() => {
      done = true;
    });
    let elapsed = 0;
    while (!done && elapsed < 60_000) {
      await jest.advanceTimersByTimeAsync(500);
      elapsed += 500;
    }
    return { done, elapsed };
  }

  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('gives up on a hanging backend DELETE and still deletes locally', async () => {
    mockApiDelete.mockImplementationOnce(never);
    const { done, elapsed } = await settle(
      pushNotificationService.unregisterToken(),
    );
    expect(done).toBe(true);
    expect(elapsed).toBeLessThanOrEqual(PUSH_TEARDOWN_TIMEOUT_MS + 500);
    expect(mockDeleteToken).toHaveBeenCalledTimes(1);
  });

  it('gives up on a hanging getToken and deleteToken (bounded, never throws)', async () => {
    mockGetToken.mockImplementationOnce(never);
    mockDeleteToken.mockImplementationOnce(never);
    const { done, elapsed } = await settle(
      pushNotificationService.unregisterToken(),
    );
    expect(done).toBe(true);
    expect(elapsed).toBeLessThanOrEqual(2 * PUSH_TEARDOWN_TIMEOUT_MS + 500);
  });

  it("the next user's registration waits for a slow local delete", async () => {
    let finishDelete: () => void = () => {};
    mockDeleteToken.mockImplementationOnce(
      () =>
        new Promise<void>((r) => {
          finishDelete = r;
        }),
    );
    await settle(
      pushNotificationService.unregisterToken({ notifyBackend: false }),
    );
    // The delete is still running after the timeout. Register the next user:
    const registering = pushNotificationService.registerToken();
    await jest.advanceTimersByTimeAsync(1000);
    expect(mockGetToken).not.toHaveBeenCalled();
    finishDelete();
    await registering;
    expect(mockGetToken).toHaveBeenCalledTimes(1);
    expect(mockApiPost).toHaveBeenCalledWith(
      '/users/fcm-token',
      expect.objectContaining({ token: 'tok-A' }),
    );
  });
});
