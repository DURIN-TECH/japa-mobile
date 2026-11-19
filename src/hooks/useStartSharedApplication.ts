/**
 * Start an application through a shared route (japa#237, P8a of #228).
 *
 * The sheet `/apply-through/[visaId]` calls `start(countryCode, answers)` once
 * the person has confirmed a country. One call = one
 * `POST /applications { sharedRouteId, throughCountryCode, mode, ... }`.
 *
 * Outcomes mirror `useStartApplication` so the two flows feel the same:
 *   402            → 'upgrade'    (plan limit → "See plans")
 *   404 / 403      → 'unavailable'
 *   422 COUNTRY_*  → 'country'    (that country can't be used; pick another.
 *                                  The backend's own sentence is shown)
 *   409 duplicate  → `duplicate`  (not a failure: continue it or start another)
 *   anything else  → 'retry'
 *
 * On success the sheet is REPLACED by the self-service step the visa screen
 * opens today, so it is not left under it.
 */
import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useCreateApplication } from '@/hooks/useApplications';
import { getDuplicateApplication } from '@/hooks/queryErrors';
import {
  buildSharedStartInput,
  classifySharedStartError,
  type SharedStartFailure,
} from '@/components/explorer/sharedRouteLogic';
import type { DuplicateApplication } from '@/hooks/useStartApplication';
import type { IntakeAnswers } from '@/types/intake.type';

export type { SharedStartFailure };

export function useStartSharedApplication(sharedRouteId: string | undefined) {
  const router = useRouter();
  const createApp = useCreateApplication();
  const [creating, setCreating] = useState(false);
  const [failure, setFailure] = useState<SharedStartFailure | null>(null);
  /** The backend's sentence for a 'country' failure. */
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateApplication | null>(null);
  // A ref so two taps in one frame can't both pass the guard.
  const inFlight = useRef(false);
  // What the duplicate prompt needs to resend ("Start a new one").
  const last = useRef<{ code: string; answers: IntakeAnswers } | null>(null);

  const run = useCallback(
    async (code: string, answers: IntakeAnswers, confirmNew: boolean) => {
      if (inFlight.current || !sharedRouteId) return;
      inFlight.current = true;
      last.current = { code, answers };
      setFailure(null);
      setFailureMessage(null);
      setDuplicate(null);
      setCreating(true);
      try {
        const app = await createApp.mutateAsync(
          buildSharedStartInput({
            sharedRouteId,
            throughCountryCode: code,
            competenceAnswers: answers,
            confirmNew,
          }),
        );
        if (!app?.id) throw new Error('No application id');
        router.replace(`/self-service/${app.id}`);
      } catch (e) {
        const existing = getDuplicateApplication(e);
        if (existing) {
          setDuplicate(existing);
        } else {
          const kind = classifySharedStartError(e);
          setFailure(kind);
          if (kind === 'country') {
            setFailureMessage((e as { message?: string }).message ?? null);
          }
        }
      } finally {
        inFlight.current = false;
        setCreating(false);
      }
    },
    [createApp, sharedRouteId, router],
  );

  return {
    start: (code: string, answers: IntakeAnswers) => run(code, answers, false),
    creating,
    failure,
    failureMessage,
    duplicate,
    /** "Continue application": open the one they already have. */
    continueExisting: () => {
      if (!duplicate) return;
      const id = duplicate.id;
      setDuplicate(null);
      router.replace(`/application/${id}`);
    },
    /** "Start a new one": same request, confirmed. */
    startAnyway: () => {
      if (last.current) run(last.current.code, last.current.answers, true);
    },
    dismissDuplicate: () => setDuplicate(null),
    clearFailure: () => {
      setFailure(null);
      setFailureMessage(null);
    },
  };
}
