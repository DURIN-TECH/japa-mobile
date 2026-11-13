/**
 * Start a self-service application (japa#174)
 *
 * Shared by `visa/[id]` and `destination/[id]`. One tap = one
 * `POST /applications` (mode 'self'); on success the screen opens
 * `/self-service/<application.id>` (always a real application id, never a visa
 * id or a country code). A failure is classified so the screen can show the
 * right state instead of landing on a checklist for an application that does
 * not exist:
 *
 *   402            → 'upgrade'     (plan limit / read-only plan → UpgradePrompt)
 *   404 or 403     → 'unavailable' (the visa can't be started; retry can't help)
 *   anything else  → 'retry'       (offline, timeout, 5xx; the CTA is the retry)
 */
import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useCreateApplication } from '@/hooks/useApplications';
import { isUnavailableError } from '@/hooks/queryErrors';

export type StartFailure = 'upgrade' | 'unavailable' | 'retry';

/** Pure: map a rejected create call (an `ApiError` with `status`) to a state. */
export function classifyStartError(error: unknown): StartFailure {
  const status =
    typeof error === 'object' && error !== null
      ? (error as { status?: unknown }).status
      : undefined;
  if (status === 402) return 'upgrade';
  if (isUnavailableError(error)) return 'unavailable';
  return 'retry';
}

export function useStartApplication(visaTypeId: string, countryCode: string) {
  const router = useRouter();
  const createApp = useCreateApplication();
  const [creating, setCreating] = useState(false);
  const [failure, setFailure] = useState<StartFailure | null>(null);
  // A ref (not state) so two quick taps in the same frame can't both pass the
  // guard: state updates are async, a ref is read synchronously.
  const inFlight = useRef(false);

  const start = useCallback(async () => {
    // One tap = one application. Also stays blocked once the visa is known to
    // be unavailable (the CTA is disabled for this visit).
    if (inFlight.current || failure === 'unavailable') return;
    inFlight.current = true;
    setFailure(null);
    setCreating(true);
    try {
      const app = await createApp.mutateAsync({
        visaTypeId,
        countryCode: countryCode.toUpperCase(),
        mode: 'self',
      });
      // Never push without a real application id.
      if (!app?.id) throw new Error('No application id');
      router.push(`/self-service/${app.id}`);
    } catch (e) {
      setFailure(classifyStartError(e));
    } finally {
      inFlight.current = false;
      setCreating(false);
    }
  }, [createApp, visaTypeId, countryCode, router, failure]);

  return {
    start,
    creating,
    failure,
    /** "Not now" on the upgrade card: back to the default bar. */
    dismissUpgrade: () => setFailure(null),
  };
}
