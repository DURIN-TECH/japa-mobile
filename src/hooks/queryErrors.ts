/**
 * Query error helpers (japa#106)
 *
 * `apiService` rejects with an `ApiError` (`{ code, message, status }`, see
 * src/services/api.service.ts). These helpers let a screen tell a backend
 * 404 (show the "not found" state) from a network or server failure (show
 * an error with a retry), and stop React Query retrying a 404, which can
 * never succeed and would only keep the spinner up for several seconds.
 *
 * Pure (no imports), so it's unit-tested directly.
 */

/**
 * True when `error` is the backend's 404 OR 403 (`ApiError.status`).
 * japa#174: a record that belongs to someone else (another account's
 * application, a visa id passed as an application id) answers 403, and the
 * screen must show the same not-found state as for a 404 so it never confirms
 * the record exists. Retrying either can never succeed.
 */
export function isNotFoundError(error: unknown): boolean {
  const status =
    typeof error === 'object' && error !== null
      ? (error as { status?: unknown }).status
      : undefined;
  return status === 404 || status === 403;
}

/**
 * React Query `retry` option: never retry a 404 or 403, otherwise retry up to
 * twice (the app default in src/providers/QueryProvider.tsx).
 */
export function retryUnlessNotFound(
  failureCount: number,
  error: unknown,
): boolean {
  if (isNotFoundError(error)) return false;
  return failureCount < 2;
}

/** Same check, kept under its earlier name (eligibility, messages). */
export const isUnavailableError = isNotFoundError;

/** React Query `retry` option: never retry a 404 or 403, else up to twice. */
export const retryUnlessUnavailable = retryUnlessNotFound;

export type StartFailure = 'upgrade' | 'unavailable' | 'retry';

/** Pure: map a rejected create call (an `ApiError` with `status`) to a state. */
export function classifyStartError(error: unknown): StartFailure {
  const status =
    typeof error === 'object' && error !== null
      ? (error as { status?: unknown }).status
      : undefined;
  if (status === 402) return 'upgrade';
  if (isNotFoundError(error)) return 'unavailable';
  return 'retry';
}

/** Slim summary the 409 carries (#253): no notes, contact or cost fields. */
export interface DuplicateApplicationSummary {
  id: string;
  visaTypeName?: string;
  countryName?: string;
  status?: string;
  /** 0-100. */
  progress?: number;
  mode?: string;
  lastUpdated?: unknown;
}

/**
 * #253: the backend's 409 `DUPLICATE_ACTIVE_APPLICATION` carries the user's
 * existing application in `data.existingApplication`. Returns it (id is what
 * the prompt needs to open it), or null for any other error / a malformed body.
 * Pure, so it is unit-tested directly.
 */
export function getDuplicateApplication(
  error: unknown,
): DuplicateApplicationSummary | null {
  if (typeof error !== 'object' || error === null) return null;
  const e = error as { status?: unknown; code?: unknown; data?: unknown };
  if (e.status !== 409 || e.code !== 'DUPLICATE_ACTIVE_APPLICATION')
    return null;
  const existing = (
    e.data as { existingApplication?: { id?: unknown } } | undefined
  )?.existingApplication;
  if (!existing || typeof existing.id !== 'string' || !existing.id) return null;
  return existing as DuplicateApplicationSummary;
}
