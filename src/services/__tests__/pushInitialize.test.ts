// ─────────────────────────────────────────────────────────────────────────────
// pushNotificationService.initialize / listeners (issue #265).
// Mocked messaging module and query client; each test gets a fresh service.
// ─────────────────────────────────────────────────────────────────────────────
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Alert } from 'react-native';

const mockPush = jest.fn();
const mockInvalidate = jest.fn();
const mockOnMessage = jest.fn<(...a: unknown[]) => () => void>(() => jest.fn());
const mockOnOpened = jest.fn<(...a: unknown[]) => () => void>(() => jest.fn());
const mockOnRefresh = jest.fn<(...a: unknown[]) => () => void>(() => jest.fn());
const mockInitial = jest.fn<(...a: unknown[]) => Promise<unknown>>(
  async () => null,
);
const mockPermission = jest.fn<(...a: unknown[]) => Promise<number>>(
  async () => 1,
);

jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a) },
}));
jest.mock('@react-native-firebase/app', () => ({ getApp: () => ({}) }));
jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: () => ({}),
  getToken: async () => 'tok',
  deleteToken: async () => {},
  requestPermission: (...a: unknown[]) => mockPermission(...a),
  onMessage: (...a: unknown[]) => mockOnMessage(...a),
  onNotificationOpenedApp: (...a: unknown[]) => mockOnOpened(...a),
  getInitialNotification: (...a: unknown[]) => mockInitial(...a),
  onTokenRefresh: (...a: unknown[]) => mockOnRefresh(...a),
}));
jest.mock('@/services/api.service', () => ({
  apiService: {
    post: jest.fn(async () => ({})),
    delete: jest.fn(async () => ({})),
  },
}));
jest.mock('@/providers/QueryProvider', () => ({
  queryClient: { invalidateQueries: (...a: unknown[]) => mockInvalidate(...a) },
}));

type Svc =
  typeof import('../push-notification.service').pushNotificationService;
let svc: Svc;
let mockAlert: ReturnType<typeof jest.spyOn>;

beforeEach(() => {
  jest.clearAllMocks();
  mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockPermission.mockResolvedValue(1);
  mockInitial.mockResolvedValue(null);
  // Fresh singleton (and fresh once-per-launch cold-start flag) per test.
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    svc = require('../push-notification.service').pushNotificationService;
  });
});

describe('initialize', () => {
  it('two sequential calls give one listener of each kind', async () => {
    await svc.initialize();
    await svc.initialize();
    expect(mockOnMessage).toHaveBeenCalledTimes(1);
    expect(mockOnOpened).toHaveBeenCalledTimes(1);
    expect(mockOnRefresh).toHaveBeenCalledTimes(1);
  });

  it('two concurrent calls give one listener of each kind', async () => {
    await Promise.all([svc.initialize(), svc.initialize()]);
    expect(mockOnMessage).toHaveBeenCalledTimes(1);
    expect(mockOnOpened).toHaveBeenCalledTimes(1);
    expect(mockOnRefresh).toHaveBeenCalledTimes(1);
  });

  it('unregisterToken (logout) resets it so the next login sets up again', async () => {
    await svc.initialize();
    await svc.unregisterToken();
    await svc.initialize();
    expect(mockOnMessage).toHaveBeenCalledTimes(2);
  });

  it('a stale init (sign-out then quick sign-in) attaches no second listener set', async () => {
    // First init stalls on the permission prompt; sign out, sign in again.
    let release!: (v: number) => void;
    mockPermission.mockImplementationOnce(
      () => new Promise<number>((r) => (release = r)),
    );
    const first = svc.initialize();
    await svc.unregisterToken({ notifyBackend: false });
    const second = svc.initialize();
    await second;
    release(1); // the stale init now resumes
    await first;
    expect(mockOnMessage).toHaveBeenCalledTimes(1);
    expect(mockOnOpened).toHaveBeenCalledTimes(1);
    expect(mockOnRefresh).toHaveBeenCalledTimes(1);
  });

  it('a denied permission can be retried later', async () => {
    mockPermission.mockResolvedValueOnce(0);
    await svc.initialize();
    expect(mockOnMessage).not.toHaveBeenCalled();
    await svc.initialize();
    expect(mockOnMessage).toHaveBeenCalledTimes(1);
  });

  it('handles the cold-start message at most once per launch, even across logout/login', async () => {
    jest.useFakeTimers();
    mockInitial.mockResolvedValue({
      data: {
        type: 'application_update',
        relatedEntityType: 'application',
        relatedEntityId: 'a1',
      },
    });
    await svc.initialize();
    await svc.unregisterToken();
    await svc.initialize();
    jest.runAllTimers();
    jest.useRealTimers();
    expect(mockInitial).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/application/a1');
  });
});

describe('foreground push', () => {
  it('invalidates the notifications queries and shows one pop-up whose View uses the shared router', async () => {
    await svc.initialize();
    const handler = mockOnMessage.mock.calls[0][1] as (m: unknown) => void;
    handler({
      notification: { title: 'New message', body: 'Hi' },
      data: {
        type: 'message_received',
        relatedEntityType: 'message',
        relatedEntityId: 'c1',
        conversationId: 'c7',
      },
    });
    expect(mockInvalidate).toHaveBeenCalledWith({
      queryKey: ['notifications'],
    });
    expect(mockAlert).toHaveBeenCalledTimes(1);
    const buttons = mockAlert.mock.calls[0][2] as {
      text: string;
      onPress?: () => void;
    }[];
    buttons.find((b) => b.text === 'View')!.onPress!();
    expect(mockPush).toHaveBeenCalledWith('/messages/c7');
  });

  it('a background tap routes with the shared router', async () => {
    await svc.initialize();
    const handler = mockOnOpened.mock.calls[0][1] as (m: unknown) => void;
    handler({ data: { type: 'payment_request', relatedEntityId: 'a1' } });
    expect(mockPush).toHaveBeenCalledWith('/payments');
  });
});
