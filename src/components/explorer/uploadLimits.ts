// ─────────────────────────────────────────────────────────────────────────────
// Application document uploads: what the backend takes, and the in-card lines
// for a file it would refuse (japa#310).
//
// The backend (`POST /documents`) reads the stored file's REAL size and refuses
// one over the limit with 413 FILE_TOO_LARGE (and deletes it). The limit is
// 10 MB for a PDF or any other file, but 7 MB for an image: the model that
// reads the documents cannot take a larger image. The app checks the picked
// file's size first, with the same numbers, so an oversized file is never
// uploaded at all; the 413 is the backstop (for example a picker that gave no
// size) and shows the same line.
//
// The signed upload URL (`POST /documents/upload-url`) only takes the types in
// `UPLOAD_CONTENT_TYPES`; anything else is a 400 VALIDATION_ERROR. The picker
// offers `image/*`, so a WebP or GIF used to end in "Check your connection",
// which was wrong. The app now says the type is not supported before asking.
//
// Pure helpers only, so they are unit-tested without the screen.
// ─────────────────────────────────────────────────────────────────────────────

/** Largest image the backend accepts (7 MB, same as its `MODEL_IMAGE_MAX_BYTES`). */
export const IMAGE_MAX_BYTES = 7 * 1024 * 1024;
/** Largest PDF or other file the backend accepts (10 MB, its `maxFileBytes`). */
export const FILE_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Content types the app uploads: the backend's upload-URL list
 * (document.controller.ts) WITHOUT HEIC. The backend accepts HEIC, but the
 * model that reads documents takes only JPEG, PNG, GIF and WebP images, so a
 * HEIC photo would be stored and never checked. Until the app converts HEIC
 * before upload (follow-up), it is refused here with the wrong-type line.
 */
export const UPLOAD_CONTENT_TYPES: readonly string[] = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
];

/**
 * HEIC / HEIF (iPhone photos), by type ("image/heic", "image/heif",
 * "image/heic-sequence", ...) or by extension (`.heic`, `.heif`). The
 * extension is checked too because a picker can report a HEIC file with an
 * empty or generic type.
 */
export function isHeic(f: { contentType: string; name?: string }): boolean {
  if (/^image\/hei[cf]/i.test(f.contentType)) return true;
  return /\.hei[cf]$/i.test(f.name ?? '');
}

/** True for an image content type ("image/jpeg", "image/heic", ...). */
export const isImageType = (contentType: string) =>
  contentType.toLowerCase().startsWith('image/');

/** The size limit that applies to a file of this type, in bytes. */
export const maxUploadBytes = (contentType: string) =>
  isImageType(contentType) ? IMAGE_MAX_BYTES : FILE_MAX_BYTES;

/** "This file is larger than 7 MB. Upload a smaller copy." (the number per type). */
export function tooLargeCopy(isImage: boolean): string {
  const mb = (isImage ? IMAGE_MAX_BYTES : FILE_MAX_BYTES) / (1024 * 1024);
  return `This file is larger than ${mb} MB. Upload a smaller copy.`;
}

/** Wrong type, including HEIC/HEIF (the review cannot read it, see above). */
export const WRONG_TYPE_COPY =
  'We can’t take this type of file. Upload a PDF, JPEG or PNG.';

/** The generic upload failure (network, storage, anything else). */
export const uploadErrorCopy = (fileName: string) =>
  `We couldn’t upload ${fileName}. Check your connection and try again.`;

// The picker sometimes leaves `mimeType` empty. The type is then taken from
// the file name's extension, so a plain PDF or JPEG is not refused for it.
const BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

/** The content type to send for a picked file. */
export function pickedContentType(f: {
  mimeType?: string | null;
  name: string;
}): string {
  if (f.mimeType) return f.mimeType;
  const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
  return BY_EXTENSION[ext] ?? 'application/octet-stream';
}

/**
 * The line to show before uploading anything, or null when the file can go.
 * An unknown size (`undefined`) is let through: the backend checks the real
 * size anyway and its 413 shows the same line. `name` is the picked file's
 * name, used to catch a HEIC/HEIF file by its extension.
 */
export function pickedFileProblem(f: {
  size?: number | null;
  contentType: string;
  name?: string;
}): string | null {
  if (isHeic(f) || !UPLOAD_CONTENT_TYPES.includes(f.contentType.toLowerCase()))
    return WRONG_TYPE_COPY;
  if (typeof f.size === 'number' && f.size > maxUploadBytes(f.contentType))
    return tooLargeCopy(isImageType(f.contentType));
  return null;
}

/**
 * The in-card line for a failed upload. `err` is what apiService rejects with
 * (`{ code, status, body }`) or anything else (a storage PUT error).
 *   413 FILE_TOO_LARGE  → the size line, with the number from the backend's
 *                         `details.isImage` (else from the picked type)
 *   400 "Invalid content type" from the upload URL → the wrong-type line
 *   anything else       → the generic line
 */
export function uploadFailureCopy(
  err: unknown,
  fileName: string,
  contentType: string,
): string {
  const e =
    err && typeof err === 'object'
      ? (err as {
          code?: unknown;
          status?: unknown;
          body?: unknown;
          message?: unknown;
        })
      : null;
  if (e?.status === 413 || e?.code === 'FILE_TOO_LARGE') {
    const details = (e.body as { details?: { isImage?: unknown } } | undefined)
      ?.details;
    const isImage =
      typeof details?.isImage === 'boolean'
        ? details.isImage
        : isImageType(contentType);
    return tooLargeCopy(isImage);
  }
  if (
    e?.status === 400 &&
    typeof e.message === 'string' &&
    e.message.startsWith('Invalid content type')
  )
    return WRONG_TYPE_COPY;
  return uploadErrorCopy(fileName);
}
