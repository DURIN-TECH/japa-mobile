import { deleteAsync } from 'expo-file-system/legacy';
// ─────────────────────────────────────────────────────────────────────────────
// Screen capture for the feedback button (issue #257).
//
// `react-native-view-shot` is a NATIVE module: a dev build made before it was
// added does not contain it. The module is therefore required lazily inside a
// try/catch, so an older build simply returns `null` (no screenshot) instead of
// crashing, and the sheet shows its "couldn't capture" note.
// ─────────────────────────────────────────────────────────────────────────────

/** Wait for the next frame(s) so a just-hidden button is really gone from the screen. */
function nextFrames(count = 2): Promise<void> {
  return new Promise((resolve) => {
    const step = (left: number) =>
      left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1));
    step(count);
  });
}

/**
 * Capture the whole screen to a temporary JPEG file.
 * Returns the file uri, or null when capture is unavailable or fails.
 * The caller must hide the button and sheet BEFORE calling.
 */
export const CAPTURE_TIMEOUT_MS = 2000;

export async function captureCurrentScreen(
  timeoutMs = CAPTURE_TIMEOUT_MS,
): Promise<string | null> {
  // A capture that hangs must not keep the button hidden: give up after ~2s.
  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), timeoutMs),
  );
  return Promise.race([doCapture(), timeout]);
}

async function doCapture(): Promise<string | null> {
  try {
    await nextFrames();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const viewShot = require('react-native-view-shot') as {
      captureScreen: (o: {
        format: 'jpg';
        quality: number;
        result: 'tmpfile';
      }) => Promise<string>;
    };
    const uri = await viewShot.captureScreen({
      format: 'jpg',
      quality: 0.7,
      result: 'tmpfile',
    });
    return typeof uri === 'string' && uri.length > 0 ? uri : null;
  } catch {
    return null;
  }
}

/** Delete a captured temp file (best effort; a missing file is fine). */
export async function deleteCapture(uri: string | null): Promise<void> {
  if (!uri) return;
  try {
    await deleteAsync(uri, { idempotent: true });
  } catch {
    // Nothing to do: the OS clears the cache directory eventually.
  }
}
