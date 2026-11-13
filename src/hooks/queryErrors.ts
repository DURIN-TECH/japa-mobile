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

/** True when `error` is the backend's 404 (`ApiError.status === 404`). */
export function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { status?: unknown }).status === 404
  );
}

/**
 * React Query `retry` option: never retry a 404, otherwise retry up to
 * twice (the app default in src/providers/QueryProvider.tsx).
 */
export function retryUnlessNotFound(
  failureCount: number,
  error: unknown,
): boolean {
  if (isNotFoundError(error)) return false;
  return failureCount < 2;
}

/**
 * True when the backend answered 404 OR 403 (`ApiError.status`). For records
 * that belong to someone else (an eligibility check, a conversation) the
 * backend says 403; retrying can never succeed and the screen must not
 * confirm the record exists, so it shows the same not-found state as a 404.
 */
export function isUnavailableError(error: unknown): boolean {
  const status =
    typeof error === 'object' && error !== null
      ? (error as { status?: unknown }).status
      : undefined;
  return status === 404 || status === 403;
}

/** React Query `retry` option: never retry a 404 or 403, else up to twice. */
export function retryUnlessUnavailable(
  failureCount: number,
  error: unknown,
): boolean {
  if (isUnavailableError(error)) return false;
  return failureCount < 2;
}
