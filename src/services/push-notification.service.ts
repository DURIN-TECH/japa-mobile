/**
 * Push Notification Service
 *
 * Handles FCM token registration, permission requests, and
 * notification event handling (foreground, background tap, cold launch tap).
 *
 * Uses the modular Firebase API consistent with auth and analytics services.
 *
 * Flow:
 * 1. On login → requestPermission() + registerToken()
 * 2. On token refresh → re-register with backend
 * 3. On foreground notification → refresh the inbox + bell, show in-app alert
 * 4. On notification tap (background) → deep-link to relevant screen
 * 5. On notification tap (cold start) → deep-link after app loads (once per
 *    app launch)
 * Every tap and the pop-up's "View" use the shared pure router
 * (`notification-router.ts`, #265), the same one the inbox uses.
 * 6. On sign-out (logout, account deletion, a session that ended on its own,
 *    or the signed-in account changing) → unregisterToken(). Wired up in
 *    auth.store.ts (#263).
 */

import { Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  getToken,
  requestPermission,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification,
  onTokenRefresh,
  deleteToken,
} from '@react-native-firebase/messaging';
import { apiService } from './api.service';
import { routeForNotification } from './notification-router';
import { queryClient } from '@/providers/QueryProvider';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

/**
 * Notification data payload from the backend (FCM `data`: string values only).
 * Same shape the shared router reads (type, relatedEntityType,
 * relatedEntityId, conversationId, documentRequestId, deprecated referenceId).
 */
type NotificationData = Record<string, string | undefined>;

// ─────────────────────────────────────────────
// TEARDOWN TIMEOUT (#263, review round 1)
// ─────────────────────────────────────────────

/**
 * Upper bound, per step, on the network-bound push teardown calls (getToken,
 * the backend DELETE, deleteToken). The signed-out cold start and the
 * session-ended bounce to /welcome await the teardown, so on a slow or captive
 * network they must not hang on these calls (the splash stays up until it
 * finishes). A step that times out keeps running in the background; we just
 * stop waiting for it.
 */
export const PUSH_TEARDOWN_TIMEOUT_MS = 3000;

/** Reject with a timeout error if `promise` hasn't settled within `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms} ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ─────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────

class PushNotificationService {
  // Lazy-initialized — avoids calling getApp() at import time
  // before the native Firebase module is ready.
  private _messaging: ReturnType<typeof getMessaging> | null = null;
  private unsubscribers: (() => void)[] = [];
  // #263: the last local deleteToken() call, possibly still running after its
  // teardown timeout. registerToken() waits for it first, so a slow delete
  // from the PREVIOUS user's teardown can't kill the token just fetched for
  // the next user.
  private pendingLocalDelete: Promise<unknown> | null = null;

  // #265: initialize() is called from the auth listener (and used to be from
  // the login actions too). This guards it so listeners are added only once:
  //   - `initPromise` is set synchronously on the first call, so a second call
  //     made while the first is still awaiting permission/token joins it.
  //   - It is cleared by unregisterToken() (logout), so the next login sets up
  //     again, and when permission is denied (so a later call can retry).
  private initPromise: Promise<void> | null = null;

  // #265: bumped by cleanup() (every sign-out). An init that began under an
  // older generation is STALE: its awaits (permission, token) may resolve
  // after a sign-out and a quick sign-in started a newer init, and attaching
  // its listeners too would double every pop-up. A stale init attaches
  // nothing and leaves `initPromise` alone (it may belong to the newer init).
  private generation = 0;

  // #265: the cold-start message (getInitialNotification) is handled at most
  // once per app launch. Deliberately NOT reset on logout: it describes how
  // the app was launched, and re-reading it after a re-login would navigate
  // again.
  private coldStartChecked = false;

  private get messaging() {
    if (!this._messaging) {
      this._messaging = getMessaging(getApp());
    }
    return this._messaging;
  }

  /**
   * Initialize push notifications.
   * Call this after the user logs in and auth is ready.
   *
   * 1. Request permission (iOS shows system dialog, Android auto-grants on older versions)
   * 2. Get the FCM token and send it to the backend
   * 3. Set up listeners for incoming notifications
   */
  initialize(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.doInitialize();
    }
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    const gen = this.generation;
    const stale = () => gen !== this.generation;
    try {
      // Request permission — returns authorization status
      const authStatus = await requestPermission(this.messaging);
      if (stale()) return; // signed out meanwhile: do nothing
      // authStatus: -1 = not determined, 0 = denied, 1 = authorized, 2 = provisional
      if (authStatus < 1) {
        if (__DEV__) console.warn('Push notification permission denied');
        this.initPromise = null; // allow a later retry
        return;
      }

      // Get and register the FCM token
      await this.registerToken();
      if (stale()) return; // signed out meanwhile: attach no listeners

      // Set up notification listeners
      this.setupListeners();
    } catch (error) {
      if (__DEV__) console.warn('Push notification init error:', error);
      if (!stale()) this.initPromise = null; // allow a later retry
    }
  }

  /**
   * Get the FCM token and register it with the backend.
   * The backend stores it in the user's document for targeted pushes.
   */
  async registerToken(): Promise<void> {
    try {
      // #263: let a previous user's slow local delete finish first (see
      // pendingLocalDelete). initialize() is fire-and-forget, so this wait
      // never blocks the UI.
      if (this.pendingLocalDelete) await this.pendingLocalDelete;

      const token = await getToken(this.messaging);
      if (!token) return;

      // Send token to backend — POST /users/fcm-token
      await apiService.post('/users/fcm-token', {
        token,
        platform: Platform.OS, // 'ios' or 'android'
      });

      if (__DEV__) console.log('FCM token registered');
    } catch (error) {
      if (__DEV__) console.warn('FCM token registration error:', error);
    }
  }

  /**
   * Unregister the FCM token on sign-out (#263: EVERY sign-out path).
   * Prevents push notifications from being sent to a logged-out device.
   *
   * Three independent steps, each with its own error handling, so one failing
   * never skips the others:
   *
   *   1. Backend removal (DELETE /users/fcm-token). Best-effort, and only
   *      useful while the departing user still holds the Firebase session
   *      (logout, account deletion). Skipped with `{ notifyBackend: false }`,
   *      which the auth listener always passes: when it sees a session end or
   *      an account change, the departing user's session is already gone, so
   *      the call could only 401 or, worse, run with the NEXT user's ID token.
   *   2. Local deletion (deleteToken). This is what actually stops the device
   *      receiving the previous user's pushes: FCM invalidates the token, so a
   *      send to it fails even if the backend still lists it on that user's
   *      doc. The next sign-in gets a NEW token and registers it to the new
   *      user only.
   *   3. Listener cleanup, so no foreground alert / tap handler from the old
   *      session survives.
   *
   * Every network-bound step is capped at PUSH_TEARDOWN_TIMEOUT_MS, so the
   * whole call settles within a few seconds even on a bad network.
   * Never throws.
   */
  async unregisterToken(
    options: { notifyBackend?: boolean } = {},
  ): Promise<void> {
    const { notifyBackend = true } = options;

    // 1. Backend: forget this device's token for the (current) user.
    //    Each network call is capped at PUSH_TEARDOWN_TIMEOUT_MS.
    if (notifyBackend) {
      try {
        const token = await withTimeout(
          getToken(this.messaging),
          PUSH_TEARDOWN_TIMEOUT_MS,
          'getToken',
        );
        if (token) {
          // Tell backend to remove this token — DELETE /users/fcm-token
          await withTimeout(
            apiService.delete('/users/fcm-token', { token }),
            PUSH_TEARDOWN_TIMEOUT_MS,
            'DELETE /users/fcm-token',
          );
        }
      } catch (error) {
        if (__DEV__) console.warn('FCM token backend unregister error:', error);
      }
    }

    // 2. Local: delete the token so Firebase generates a new one next time.
    //    Runs even when step 1 failed (the session-ended case). Remembered in
    //    pendingLocalDelete (errors swallowed) in case it outlives the timeout.
    const localDelete = deleteToken(this.messaging).catch((error) => {
      if (__DEV__) console.warn('FCM token local delete error:', error);
    });
    this.pendingLocalDelete = localDelete;
    void localDelete.finally(() => {
      if (this.pendingLocalDelete === localDelete)
        this.pendingLocalDelete = null;
    });
    try {
      await withTimeout(localDelete, PUSH_TEARDOWN_TIMEOUT_MS, 'deleteToken');
    } catch (error) {
      if (__DEV__) console.warn('FCM token local delete error:', error);
    }

    // 3. Clean up listeners
    this.cleanup();
  }

  /**
   * Set up all notification event listeners.
   */
  private setupListeners(): void {
    // 1. Token refresh — re-register when Firebase rotates the token
    const unsubRefresh = onTokenRefresh(this.messaging, async () => {
      await this.registerToken();
    });
    this.unsubscribers.push(unsubRefresh);

    // 2. Foreground notification — refresh the inbox and bell, then show ONE
    //    in-app alert. Invalidating ['notifications'] covers the list and
    //    ['notifications','unread-count'], so the bell updates without waiting
    //    for the 30 s poll. The shared query client is imported (no React hook
    //    in a service).
    const unsubMessage = onMessage(this.messaging, (remoteMessage) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });

      const { title, body } = remoteMessage.notification ?? {};
      if (title || body) {
        Alert.alert(title ?? 'Notification', body ?? '', [
          { text: 'Dismiss', style: 'cancel' },
          {
            text: 'View',
            onPress: () =>
              this.handleNotificationPress(
                remoteMessage.data as NotificationData,
              ),
          },
        ]);
      }
    });
    this.unsubscribers.push(unsubMessage);

    // 3. Background tap — user tapped notification while app was in background
    const unsubOpened = onNotificationOpenedApp(
      this.messaging,
      (remoteMessage) => {
        this.handleNotificationPress(remoteMessage.data as NotificationData);
      },
    );
    this.unsubscribers.push(unsubOpened);

    // 4. Cold start tap — user tapped notification that launched the app
    this.checkInitialNotification();
  }

  /**
   * Check if the app was opened from a notification tap (cold start).
   * Must be called once during initialization.
   */
  private async checkInitialNotification(): Promise<void> {
    // Once per app launch, however many times initialize() runs.
    if (this.coldStartChecked) return;
    this.coldStartChecked = true;
    try {
      const remoteMessage = await getInitialNotification(this.messaging);
      if (remoteMessage) {
        // Small delay to let the app finish rendering before navigating
        setTimeout(() => {
          this.handleNotificationPress(remoteMessage.data as NotificationData);
        }, 1000);
      }
    } catch (error) {
      if (__DEV__) console.warn('Initial notification check error:', error);
    }
  }

  /**
   * Handle deep-linking when a notification is tapped.
   * The route comes from the shared router (notification-router.ts).
   */
  private handleNotificationPress(data?: NotificationData): void {
    // Shared pure router; in push mode "nothing matched" opens the inbox.
    // It never throws, so a malformed payload cannot crash a tap.
    const to = routeForNotification(data, 'push');
    if (to) router.push(to as never);
  }

  /**
   * Clean up all listeners. Called on logout.
   */
  private cleanup(): void {
    // Logout: let the next login's initialize() set everything up again.
    this.initPromise = null;
    this.generation += 1; // invalidate any init still in flight
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
  }
}

/**
 * Singleton instance — initialize after login, unregister on logout.
 */
export const pushNotificationService = new PushNotificationService();
