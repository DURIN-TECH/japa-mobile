// ─────────────────────────────────────────────────────────────────────────────
// requestPushPermission (japa#399): replaces RNFB's deprecated messaging
// requestPermission with the same outcome per platform.
//   iOS: alert + badge + sound prompt; granted or limited (provisional) = true.
//   Android: no prompt, always true (what RNFB's requestPermission did).
// ─────────────────────────────────────────────────────────────────────────────
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Platform } from 'react-native';

const mockRequest =
  jest.fn<(options: string[]) => Promise<{ status: string }>>();

jest.mock('react-native-permissions', () => ({
  RESULTS: {
    GRANTED: 'granted',
    LIMITED: 'limited',
    DENIED: 'denied',
    BLOCKED: 'blocked',
    UNAVAILABLE: 'unavailable',
  },
  requestNotifications: (options: string[]) => mockRequest(options),
}));

import { requestPushPermission } from '../notificationPermission';

const setOS = (os: 'ios' | 'android') => {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
};

beforeEach(() => {
  mockRequest.mockReset();
});

describe('requestPushPermission on iOS', () => {
  beforeEach(() => setOS('ios'));

  it('asks for alert, badge and sound (no provisional)', async () => {
    mockRequest.mockResolvedValue({ status: 'granted' });
    await requestPushPermission();
    expect(mockRequest).toHaveBeenCalledWith(['alert', 'badge', 'sound']);
  });

  it.each([
    ['granted', true],
    ['limited', true],
    ['denied', false],
    ['blocked', false],
    ['unavailable', false],
  ])('status %s → %s', async (status, expected) => {
    mockRequest.mockResolvedValue({ status });
    await expect(requestPushPermission()).resolves.toBe(expected);
  });
});

describe('requestPushPermission on Android', () => {
  beforeEach(() => setOS('android'));

  it('never prompts and resolves true, like RNFB did', async () => {
    await expect(requestPushPermission()).resolves.toBe(true);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});
