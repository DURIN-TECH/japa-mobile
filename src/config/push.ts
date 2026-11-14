/**
 * Push-notification constants shared by the app code.
 *
 * ANDROID_PUSH_CHANNEL_ID is written in three places that must agree:
 *   1. here (JS side),
 *   2. plugins/withAndroidPushSetup.js (manifest default + native channel),
 *   3. the backend's ANDROID_PUSH_CHANNEL_ID (japa#267), sent as
 *      `android.notification.channelId` in every push payload.
 * The channel itself is created natively at app start by the config plugin;
 * this constant is for any JS that needs to name it.
 */
export const ANDROID_PUSH_CHANNEL_ID = 'default';
