// ─────────────────────────────────────────────────────────────────────────────
// Application document uploads: what the backend takes, and the in-card lines
// for a file it would refuse (japa#310).
//
// The backend (`POST /documents`) reads the stored file's REAL size and refuses
// one over the limit with 413 FILE_TOO_LARGE (and deletes it). It picks the
// limit from the file's real first bytes, not its declared type: a real PDF
// gets 10 MB, everything else 7 MB (the most the model that reads documents
// can take for an image), including a file with no type. The app checks the
// picked file's size first, with the same numbers (10 MB only for a PDF by
// type, or by a `.pdf` name when the picker gives no type), so an oversized
// file is never uploaded at all. The 413 is the backstop (a picker that gave
// no size, or a "PDF" whose bytes are not one) and its number always wins.
//
// The signed upload URL (`POST /documents/upload-url`) only takes the types in
// `UPLOAD_CONTENT_TYPES`; anything else is a 400 VALIDATION_ERROR. The picker
// offers `image/*`, so a WebP or GIF used to end in "Check your connection",
// which was wrong. The app now says the type is not supported before asking.
//
// Pure helpers only, so they are unit-tested without the screen.
// ─────────────────────────────────────────────────────────────────────────────

const MiB = 1024 * 1024;
/** Largest PDF the backend accepts (10 MB, its `maxFileBytes`). */
export const PDF_MAX_BYTES = 10 * MiB;
/** Largest file of any other kind (7 MB, its `MODEL_IMAGE_MAX_BYTES`). */
export const OTHER_MAX_BYTES = 7 * MiB;

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

/**
 * True for a PDF as far as the app can tell: `application/pdf`, or a `.pdf`
 * name when the picker gave no type (empty or `application/octet-stream`).
 */
export function isPdfFile(f: { contentType: string; name?: string }): boolean {
  const t = f.contentType.toLowerCase();
  if (t === 'application/pdf') return true;
  if (t && t !== 'application/octet-stream') return false;
  return /\.pdf$/i.test(f.name ?? '');
}

/** The size limit for a picked file, in bytes: 10 MB for a PDF, else 7 MB. */
export const maxUploadBytes = (f: { contentType: string; name?: string }) =>
  isPdfFile(f) ? PDF_MAX_BYTES : OTHER_MAX_BYTES;

/**
 * "This file is larger than 7 MB. Upload a smaller copy." for a limit in
 * bytes (a whole number of MB, else one decimal).
 */
export function tooLargeCopy(maxBytes: number): string {
  const mb = maxBytes / MiB;
  const shown = Number.isInteger(mb) ? String(mb) : mb.toFixed(1);
  return `This file is larger than ${shown} MB. Upload a smaller copy.`;
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
  const max = maxUploadBytes(f);
  if (typeof f.size === 'number' && f.size > max) return tooLargeCopy(max);
  return null;
}

/**
 * The in-card line for a failed upload. `err` is what apiService rejects with
 * (`{ code, status, body }`) or anything else (a storage PUT error).
 *   413 FILE_TOO_LARGE  → the size line. The number is the server's own, so
 *                         the app never disagrees with it: `details.maxBytes`
 *                         when present, else `details.isPdf` (true = 10 MB,
 *                         false = 7 MB), else the picked file's type and name
 *   400 "Invalid content type" from the upload URL → the wrong-type line
 *   anything else       → the generic line
 */
export function uploadFailureCopy(
  err: unknown,
  fileName: string,
  contentType: string,
): string {
  // The picked file's name doubles as the `.pdf` hint for the fallback limit.
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
    const details = (
      e.body as
        | { details?: { maxBytes?: unknown; isPdf?: unknown } }
        | undefined
    )?.details;
    const maxBytes =
      typeof details?.maxBytes === 'number' && details.maxBytes > 0
        ? details.maxBytes
        : typeof details?.isPdf === 'boolean'
          ? details.isPdf
            ? PDF_MAX_BYTES
            : OTHER_MAX_BYTES
          : maxUploadBytes({ contentType, name: fileName });
    return tooLargeCopy(maxBytes);
  }
  if (
    e?.status === 400 &&
    typeof e.message === 'string' &&
    e.message.startsWith('Invalid content type')
  )
    return WRONG_TYPE_COPY;
  return uploadErrorCopy(fileName);
}
