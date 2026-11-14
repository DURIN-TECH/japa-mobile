// ─────────────────────────────────────────────────────────────────────────────
// useFeedback (issue #257) — send a feedback note to the backend.
//
// Flow (design spec, "Sending"):
//   1. POST /feedback/screenshot-url  → { uploadUrl, storagePath }   (if a screenshot is kept)
//   2. PUT the image to uploadUrl
//   3. POST /feedback with the note, device info and the storagePath
// A failed screenshot upload never blocks the note: it is sent without the image.
// A failed POST /feedback rejects, so the sheet keeps the text and offers a retry.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback } from 'react';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiService } from '@/services/api.service';
import { uploadToStorage } from '@/hooks/useDocuments';
import { APP_ENV } from '@/config/env';
import type { FeedbackKind } from '@/components/feedback/feedbackLogic';

/** The tester's own input. */
export interface FeedbackInput {
  kind: FeedbackKind;
  message: string;
  /** Route pattern of the screen they were on (no params). */
  route: string;
  /** Local file uri of the screenshot, or null when none is sent. */
  screenshotUri: string | null;
}

/**
 * Remembers the storage path of a screenshot that already uploaded, so a
 * retry after a failed POST does not upload the same image again.
 */
export interface UploadCache {
  uri: string;
  storagePath: string;
}

/** Screenshots are captured as JPEG (smaller than PNG; legible for a UI). */
export const SCREENSHOT_FILE = { name: 'feedback.jpg', type: 'image/jpeg' };

/** Device and build facts sent with every note. Not editable by the tester. */
export function collectDeviceInfo(): {
  appVersion: string;
  platform: string;
  osVersion: string;
  appEnv: string;
} {
  return {
    appVersion: Constants.expoConfig?.version ?? 'unknown',
    platform: Platform.OS,
    osVersion: String(Platform.Version),
    appEnv: APP_ENV,
  };
}

/**
 * Send one note. Resolves with the new feedback id; rejects with the
 * ApiError from POST /feedback (so the caller can read `status`).
 * `cache` carries an already-uploaded screenshot across retries.
 */
export async function submitFeedback(
  input: FeedbackInput,
  cache?: { current: UploadCache | null },
): Promise<string | undefined> {
  // ── Step 1 + 2: the screenshot, best effort ───────────────────────────────
  let screenshotPath: string | undefined;
  if (input.screenshotUri) {
    if (cache?.current?.uri === input.screenshotUri) {
      // Uploaded on an earlier attempt of this same send.
      screenshotPath = cache.current.storagePath;
    } else {
      try {
        const up = await apiService.post<{
          uploadUrl: string;
          storagePath: string;
        }>('/feedback/screenshot-url', {
          fileName: SCREENSHOT_FILE.name,
          contentType: SCREENSHOT_FILE.type,
        });
        if (!up.data) throw new Error('No upload URL returned');
        await uploadToStorage(up.data.uploadUrl, {
          uri: input.screenshotUri,
          type: SCREENSHOT_FILE.type,
          name: SCREENSHOT_FILE.name,
        });
        screenshotPath = up.data.storagePath;
        if (cache) {
          cache.current = {
            uri: input.screenshotUri,
            storagePath: up.data.storagePath,
          };
        }
      } catch {
        // Do not block the tester: the note goes without the image.
        screenshotPath = undefined;
      }
    }
  }

  // ── Step 3: the note ──────────────────────────────────────────────────────
  const res = await apiService.post<{ id: string }>('/feedback', {
    kind: input.kind,
    message: input.message.trim(),
    route: input.route,
    ...collectDeviceInfo(),
    ...(screenshotPath ? { screenshotPath } : {}),
  });
  return res.data?.id;
}

/** Hook wrapper so components import a hook, like the other API hooks. */
export function useFeedback() {
  const send = useCallback(
    (input: FeedbackInput, cache?: { current: UploadCache | null }) =>
      submitFeedback(input, cache),
    [],
  );
  return { send };
}
