/**
 * "Start application" for a visa screen (japa#237, P8a of #228).
 *
 * Wraps `useStartApplication`: an ordinary visa starts straight away, exactly
 * as before. A visa that belongs to a SHARED route opens the "Which country
 * will you apply through?" sheet instead, because the application is sent
 * through one of the route's countries and the person must confirm which.
 *
 * The result has the same shape as `useStartApplication`, so the screens'
 * `StartApplicationBar` wiring is unchanged.
 */
import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useStartApplication } from '@/hooks/useStartApplication';
import type { PublicSharedRoute } from '@/types/sharedRoute.type';

export function useStartVisa(
  visaTypeId: string,
  countryCode: string,
  sharedRoute?: PublicSharedRoute | null,
) {
  const router = useRouter();
  const base = useStartApplication(visaTypeId, countryCode);
  const routeId = sharedRoute?.id;

  const start = useCallback(() => {
    if (routeId) {
      router.push({
        pathname: '/apply-through/[visaId]',
        params: {
          visaId: visaTypeId,
          code: countryCode,
          routeId,
          mode: 'start',
        },
      });
      return;
    }
    base.start();
  }, [routeId, router, visaTypeId, countryCode, base]);

  return { ...base, start };
}
