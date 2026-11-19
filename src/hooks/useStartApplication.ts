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
 *
 * #253: when the user already has a live application for this visa, the
 * backend answers 409 DUPLICATE_ACTIVE_APPLICATION. That is NOT a failure: the
 * hook exposes it as `duplicate` so the screen can ask "continue it or start
 * another?". "Start another" re-sends the same request with `confirmNew: true`.
 */
import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useCreateApplication } from '@/hooks/useApplications';
import {
  classifyStartError,
  getDuplicateApplication,
  type StartFailure,
} from '@/hooks/queryErrors';

export type { StartFailure };

/** The user's existing live application for this visa (from the 409). */
export type DuplicateApplication = NonNullable<
  ReturnType<typeof getDuplicateApplication>
>;

export function useStartApplication(visaTypeId: string, countryCode: string) {
  const router = useRouter();
  const createApp = useCreateApplication();
  const [creating, setCreating] = useState(false);
  const [failure, setFailure] = useState<StartFailure | null>(null);
  // #253: set while the "you already have this" prompt is showing.
  const [duplicate, setDuplicate] = useState<DuplicateApplication | null>(null);
  // A ref (not state) so two quick taps in the same frame can't both pass the
  // guard: state updates are async, a ref is read synchronously.
  const inFlight = useRef(false);

  // `confirmNew` is true only from the prompt's "Start another".
  const run = useCallback(
    async (confirmNew: boolean) => {
      // One tap = one application. Also stays blocked once the visa is known to
      // be unavailable (the CTA is disabled for this visit).
      if (inFlight.current || failure === 'unavailable') return;
      inFlight.current = true;
      setFailure(null);
      setDuplicate(null);
      setCreating(true);
      try {
        const app = await createApp.mutateAsync({
          visaTypeId,
          countryCode: countryCode.toUpperCase(),
          mode: 'self',
          // Only included when confirmed, so a normal start sends the same body as before.
          ...(confirmNew ? { confirmNew: true } : {}),
        });
        // Never push without a real application id.
        if (!app?.id) throw new Error('No application id');
        router.push(`/self-service/${app.id}`);
      } catch (e) {
        const existing = getDuplicateApplication(e);
        if (existing) {
          // Not a failure: ask the user what they want (#253).
          setDuplicate(existing);
        } else {
          setFailure(classifyStartError(e));
        }
      } finally {
        inFlight.current = false;
        setCreating(false);
      }
    },
    [createApp, visaTypeId, countryCode, router, failure],
  );

  // Plain no-arg callbacks: screens pass `start` straight to onPress, which
  // would otherwise hand the press event in as `confirmNew`.
  const start = useCallback(() => run(false), [run]);
  const startAnyway = useCallback(() => run(true), [run]);

  return {
    start,
    duplicate,
    /** Prompt "Continue existing": open the application the user already has. */
    continueExisting: () => {
      if (!duplicate) return;
      const id = duplicate.id;
      setDuplicate(null);
      router.push(`/application/${id}`);
    },
    /** Prompt "Start another": same request, confirmed. */
    startAnyway,
    /** Prompt dismissed (backdrop / back): nothing is created. */
    dismissDuplicate: () => setDuplicate(null),
    creating,
    failure,
    /** "Not now" on the upgrade card: back to the default bar. */
    dismissUpgrade: () => setFailure(null),
  };
}
