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
 * 3. On foreground notification → show in-app alert
 * 4. On notification tap (background) → deep-link to relevant screen
 * 5. On notification tap (cold start) → deep-link after app loads
 * 6. On logout → unregisterToken()
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

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

/** Notification data payload from the backend */
interface NotificationData {
  type?: string;
  referenceId?: string;
  [key: string]: string | undefined;
}

// ─────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────

class PushNotificationService {
  // Lazy-initialized — avoids calling getApp() at import time
  // before the native Firebase module is ready.
  private _messaging: ReturnType<typeof getMessaging> | null = null;
  private unsubscribers: (() => void)[] = [];

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
  async initialize(): Promise<void> {
    try {
      // Request permission — returns authorization status
      const authStatus = await requestPermission(this.messaging);
      // authStatus: -1 = not determined, 0 = denied, 1 = authorized, 2 = provisional
      if (authStatus < 1) {
        if (__DEV__) console.warn('Push notification permission denied');
        return;
      }

      // Get and register the FCM token
      await this.registerToken();

      // Set up notification listeners
      this.setupListeners();
    } catch (error) {
      if (__DEV__) console.warn('Push notification init error:', error);
    }
  }

  /**
   * Get the FCM token and register it with the backend.
   * The backend stores it in the user's document for targeted pushes.
   */
  async registerToken(): Promise<void> {
    try {
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
   * Unregister the FCM token on logout.
   * Prevents push notifications from being sent to a logged-out device.
   */
  async unregisterToken(): Promise<void> {
    try {
      const token = await getToken(this.messaging);
      if (token) {
        // Tell backend to remove this token — DELETE /users/fcm-token
        await apiService.delete('/users/fcm-token', { token });
      }
      // Delete the token locally so Firebase generates a new one next time
      await deleteToken(this.messaging);
    } catch (error) {
      if (__DEV__) console.warn('FCM token unregister error:', error);
    }

    // Clean up listeners
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

    // 2. Foreground notification — show an in-app alert
    const unsubMessage = onMessage(this.messaging, (remoteMessage) => {
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
   * Routes to the appropriate screen based on notification type.
   */
  private handleNotificationPress(data?: NotificationData): void {
    if (!data?.type || !data?.referenceId) return;

    switch (data.type) {
      case 'application_update':
      case 'payment_request':
      case 'payment_request_rejected':
      case 'document_status':
        router.push({
          pathname: '/me/applications/[id]',
          params: { id: data.referenceId },
        });
        break;
      case 'consultation_reminder':
        router.push({
          pathname: '/me/consultations/[id]',
          params: { id: data.referenceId },
        });
        break;
      case 'message_received':
        router.push({
          pathname: '/me/chat/[conversationId]',
          params: { conversationId: data.referenceId },
        });
        break;
      default:
        // For system notifications or unknown types, go to notifications list
        router.push('/me/notifications');
        break;
    }
  }

  /**
   * Clean up all listeners. Called on logout.
   */
  private cleanup(): void {
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
