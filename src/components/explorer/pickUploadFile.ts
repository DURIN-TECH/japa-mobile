// ─────────────────────────────────────────────────────────────────────────────
// Pick one file for an application document upload (japa#420).
//
// The upload sheet (UploadSourceSheet) asks where the document comes from;
// this helper then opens that source and hands back ONE file in the shape the
// upload code after the pick already uses:
//
//   { uri, name, contentType, size }
//
//   library → the system photo picker (PHPicker on iOS, the Android photo
//             picker). PHPicker needs no permission, so the app never asks
//             for the photo library (no requestMediaLibraryPermissionsAsync).
//   camera  → asks for camera permission just before opening the camera.
//   files   → expo-document-picker, exactly as before (japa#310 checks run
//             on its result in the screens, unchanged).
//
// LIBRARY AND CAMERA PHOTOS ARE ALWAYS CONVERTED (issue decision 4): resized
// so the longest side is at most 3000 px (only when larger), then saved as a
// JPEG at 0.8. That guarantees real JPEG bytes (an iPhone hands over HEIC
// otherwise, which the document review cannot read) and keeps a 48 MP photo
// well under the 7 MB image limit. The picker is also asked for its
// "compatible" (JPEG) representation and quality 0.8, but neither alone is
// enough, so the conversion is the guarantee. The photo is named
// `photo-YYYY-MM-DD-HHmmss.jpg` (local time); the library's own name
// (`IMG_1234.HEIC`) is dropped because its extension would be wrong.
//
// Files picks are NOT converted (decision 7): a HEIC from Files is still
// refused with the wrong-type line by `pickedFileProblem`.
//
// The screens still run `pickedFileProblem` on every result, converted photos
// included, so a photo that somehow ends up over 7 MB or not a JPEG gets the
// existing line and is never uploaded.
// ─────────────────────────────────────────────────────────────────────────────

import { Linking } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { getInfoAsync } from 'expo-file-system/legacy';
import { pickedContentType } from '@/components/explorer/uploadLimits';

// ── Copy (design spec "Copy"; next to the other upload lines) ───────────────
/** Camera permission denied, now or earlier. Shown with the action below. */
export const CAMERA_DENIED_COPY =
  'Seli can’t use your camera. Turn it on in Settings.';
/** The action inside the camera-denied line: opens the app's settings. */
export const CAMERA_DENIED_ACTION = 'Open Settings';
/** Accessibility hint for that action. */
export const CAMERA_DENIED_ACTION_HINT = 'Opens Seli in your phone’s settings';
/** No camera (iOS simulator), or the camera failed to open. No action. */
export const CAMERA_UNAVAILABLE_COPY =
  'We couldn’t open the camera. Try Photo library or Files.';

// ── Conversion settings (issue decision 4) ──────────────────────────────────
/** Longest side of a converted photo, in px (only ever scaled down). */
export const PHOTO_MAX_SIDE = 3000;
/** JPEG quality of a converted photo (0..1). */
export const PHOTO_JPEG_QUALITY = 0.8;

/** Where the person chose to take the document from (the sheet's rows). */
export type UploadSource = 'library' | 'camera' | 'files';

/** One picked file, ready for the upload code (signed URL → PUT → register). */
export type PickedUploadFile = {
  /** Local file URI (a cache copy for Files, the converted JPEG for photos). */
  uri: string;
  /** File name sent to the backend (`photo-….jpg` for photos). */
  name: string;
  /** Content type sent to the backend (`image/jpeg` for photos). */
  contentType: string;
  /** Size in bytes; null/undefined when unknown (the backend checks anyway). */
  size?: number | null;
};

/**
 * What a pick ended in. Only `picked` uploads anything; the screens show
 * the camera lines for `cameraDenied` / `cameraUnavailable` and do nothing
 * at all for `cancelled`.
 */
export type PickResult =
  | { kind: 'picked'; file: PickedUploadFile }
  | { kind: 'cancelled' }
  | { kind: 'cameraDenied' }
  | { kind: 'cameraUnavailable' };

// ── Names ───────────────────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * `photo-2026-11-20-143205.jpg` for a photo taken / picked at `d`, in the
 * device's local time (issue decision 5).
 */
export function photoFileName(d: Date): string {
  const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const time = `${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
  return `photo-${date}-${time}.jpg`;
}

/**
 * The resize for a photo of `width` × `height`: the longest side scaled to
 * PHOTO_MAX_SIDE (the other side follows, aspect kept), or null when it
 * already fits or the size is unknown.
 */
export function photoResize(
  width: number,
  height: number,
): { width: number } | { height: number } | null {
  if (!(width > 0) || !(height > 0)) return null;
  if (Math.max(width, height) <= PHOTO_MAX_SIDE) return null;
  return width >= height
    ? { width: PHOTO_MAX_SIDE }
    : { height: PHOTO_MAX_SIDE };
}

// ── Photo conversion ────────────────────────────────────────────────────────
/**
 * Convert a picked photo to a JPEG (resized when needed) and return it as an
 * upload file. Uses the SDK 58 context API (`ImageManipulator.manipulate`),
 * not the deprecated `manipulateAsync`. The native objects are released once
 * the file is saved so a few large photos do not pile up in memory.
 */
export async function convertPhoto(
  asset: { uri: string; width?: number; height?: number },
  now: Date = new Date(),
): Promise<PickedUploadFile> {
  // Size from the picker when it gave one (the usual case).
  let resize = photoResize(asset.width ?? 0, asset.height ?? 0);
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (resize) ctx.resize(resize);
  let image = await ctx.renderAsync();
  ctx.release();

  // No size from the picker: check the rendered image instead and scale it
  // down in a second pass when it is still too large.
  if (!asset.width || !asset.height) {
    resize = photoResize(image.width, image.height);
    if (resize) {
      const again = ImageManipulator.manipulate(image).resize(resize);
      const smaller = await again.renderAsync();
      again.release();
      image.release();
      image = smaller;
    }
  }

  const saved = await image.saveAsync({
    format: SaveFormat.JPEG,
    compress: PHOTO_JPEG_QUALITY,
  });
  image.release();

  return {
    uri: saved.uri,
    name: photoFileName(now),
    contentType: 'image/jpeg',
    size: await fileSize(saved.uri),
  };
}

/**
 * Size of a local file in bytes, or null when it cannot be read (the backend
 * reads the real size anyway and its 413 is the backstop).
 */
async function fileSize(uri: string): Promise<number | null> {
  try {
    const info = await getInfoAsync(uri);
    return info.exists && typeof info.size === 'number' ? info.size : null;
  } catch {
    return null;
  }
}

// ── Picker options (issue decision 3 + 4) ───────────────────────────────────
/**
 * Shared by the library and the camera: one image, no video, no editing, the
 * JPEG ("compatible") representation on iOS and quality 0.8.
 */
export const PHOTO_PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsMultipleSelection: false,
  allowsEditing: false,
  quality: PHOTO_JPEG_QUALITY,
  preferredAssetRepresentationMode:
    ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
};

// ── Sources ─────────────────────────────────────────────────────────────────
/** Photo library: the system photo picker, then the JPEG conversion. */
async function pickFromLibrary(now: () => Date): Promise<PickResult> {
  const res = await ImagePicker.launchImageLibraryAsync(PHOTO_PICKER_OPTIONS);
  const asset = res.canceled ? undefined : res.assets?.[0];
  if (!asset) return { kind: 'cancelled' };
  return { kind: 'picked', file: await convertPhoto(asset, now()) };
}

/**
 * Camera: ask for permission (the system prompt shows only while asking is
 * still allowed), then open the camera. A refusal now or earlier is
 * `cameraDenied`; a camera that cannot open (the iOS simulator has none, or
 * the native call throws) is `cameraUnavailable`, never a crash. A failed
 * conversion after a photo was taken throws like any upload failure.
 */
async function pickFromCamera(now: () => Date): Promise<PickResult> {
  let res: ImagePicker.ImagePickerResult;
  try {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return { kind: 'cameraDenied' };
    res = await ImagePicker.launchCameraAsync(PHOTO_PICKER_OPTIONS);
  } catch {
    return { kind: 'cameraUnavailable' };
  }
  const asset = res.canceled ? undefined : res.assets?.[0];
  if (!asset) return { kind: 'cancelled' };
  return { kind: 'picked', file: await convertPhoto(asset, now()) };
}

/** Files: the same document picker and options as before japa#420. */
async function pickFromFiles(): Promise<PickResult> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*'],
    copyToCacheDirectory: true,
  });
  const f = res.canceled ? undefined : res.assets?.[0];
  if (!f) return { kind: 'cancelled' };
  // Passed through unchanged: same name, type (or the type from its
  // extension when the picker gave none) and size as before.
  return {
    kind: 'picked',
    file: {
      uri: f.uri,
      name: f.name,
      contentType: pickedContentType(f),
      size: f.size,
    },
  };
}

/**
 * Open `source` and return what came back. `now` is injectable so tests can
 * pin the photo name. Errors other than the camera ones (a picker or the
 * conversion failing) are thrown for the screen's usual upload-failure line.
 */
export function pickUploadFile(
  source: UploadSource,
  now: () => Date = () => new Date(),
): Promise<PickResult> {
  if (source === 'library') return pickFromLibrary(now);
  if (source === 'camera') return pickFromCamera(now);
  return pickFromFiles();
}

/** The in-card line for a pick that ended without a file, or null. */
export function pickResultCopy(r: PickResult): string | null {
  if (r.kind === 'cameraDenied') return CAMERA_DENIED_COPY;
  if (r.kind === 'cameraUnavailable') return CAMERA_UNAVAILABLE_COPY;
  return null;
}

/**
 * The InlineError action for an upload line: "Open Settings" for the
 * camera-denied line only (opens the app's page in the phone's settings),
 * nothing for every other line. Keyed on the line itself so the screens keep
 * storing one string per failure, as they already do.
 */
export function uploadErrorAction(
  message: string | null | undefined,
): { label: string; hint: string; onPress: () => void } | undefined {
  if (message !== CAMERA_DENIED_COPY) return undefined;
  return {
    label: CAMERA_DENIED_ACTION,
    hint: CAMERA_DENIED_ACTION_HINT,
    onPress: () => {
      Linking.openSettings().catch(() => undefined);
    },
  };
}
