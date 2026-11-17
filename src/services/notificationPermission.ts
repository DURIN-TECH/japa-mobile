// ─────────────────────────────────────────────────────────────────────────────
// Push notification permission (japa#399)
//
// RNFB 25 deprecated messaging's `requestPermission` / `hasPermission` and
// names react-native-permissions (or expo-notifications, which this app does
// not use: RNFB messaging is the push stack) as the replacement. This module
// is the one place the app asks for push permission, so the push service does
// not depend on the deprecated API.
//
// Behaviour is kept exactly as it was with RNFB's `requestPermission`:
//   - iOS: the system prompt for alert + badge + sound (no provisional
//     request). "Allow" (or an earlier provisional grant, reported as
//     `limited`) counts as permitted; "Don't Allow" / blocked does not. APNs
//     registration needs no extra call: RNFB auto-registers at launch, and
//     the push service calls getToken() straight after (as on dev).
//   - Android: RNFB's `requestPermission` never prompted and always resolved
//     "authorized", so this does the same. Asking for Android 13's
//     POST_NOTIFICATIONS at runtime would be a new prompt users never saw
//     before; that is a product change, out of scope here.
// ─────────────────────────────────────────────────────────────────────────────
import { Platform } from 'react-native';
import { RESULTS, requestNotifications } from 'react-native-permissions';

/**
 * Ask for push permission. Resolves true when the app may show
 * notifications (and so should register its FCM token).
 */
export async function requestPushPermission(): Promise<boolean> {
  // Android: unchanged from RNFB (no prompt, treated as authorized).
  if (Platform.OS !== 'ios') return true;

  // iOS: the same alert + badge + sound request RNFB made by default.
  const { status } = await requestNotifications(['alert', 'badge', 'sound']);
  return status === RESULTS.GRANTED || status === RESULTS.LIMITED;
}
