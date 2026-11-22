import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Entitlements,
  FeatureKey,
  PlanInterval,
  Subscription,
  SubscriberType,
} from '@durin-tech/authz';
import { apiService } from '@/services/api.service';
// japa#252: the app opts in to the Paystack return-to-app page.
import { RETURN_TO_APP } from '@/hooks/paystackCheckout';

/** GET /subscriptions/me */
export interface MySubscription {
  subscriberType?: SubscriberType;
  subscription: Subscription | null;
  entitlements: Entitlements | null;
  unlimited?: boolean;
}

/** A plan as returned by GET /plans (subset of the backend StoredPlan). */
export interface PlanDTO {
  id: string;
  name: string;
  audience: SubscriberType;
  priceKobo: number;
  interval: PlanInterval;
  features: FeatureKey[];
  seatPriceKobo?: number;
  isActive?: boolean;
  /**
   * Pairs a monthly plan with its yearly variant (seeded e.g. both
   * "Client Standard" and "Client Standard (Yearly)" carry
   * `client_standard`). Absent on the free plan. Used to rank a yearly
   * subscriber by their monthly plan for the upgrade banner (japa#346).
   */
  billingGroup?: string;
}

/**
 * Key + fetcher for `GET /subscriptions/me`, shared by the hook below and by
 * pull-to-refresh (japa#474 fix round 1), which must be able to read the plan
 * even when no screen has cached it yet (a cold start).
 */
export const mySubscriptionQuery = {
  queryKey: ['subscription', 'me'] as const,
  queryFn: async (): Promise<MySubscription | null> => {
    const res = await apiService.get<MySubscription>('/subscriptions/me');
    return res.data ?? null;
  },
};

/** The current user's subscription + resolved entitlements. */
export function useMySubscription() {
  return useQuery({
    ...mySubscriptionQuery,
    staleTime: 1000 * 60 * 2,
  });
}

/** Plans available to a given audience (mobile clients → "client"). */
export function usePlans(audience?: SubscriberType) {
  return useQuery({
    queryKey: ['plans', audience],
    enabled: !!audience,
    queryFn: async () => {
      const res = await apiService.get<PlanDTO[]>(
        `/plans?audience=${audience}`,
      );
      return (res.data ?? []).filter((p) => p.isActive !== false);
    },
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * A started checkout: the hosted Paystack URL to open and the reference our
 * backend minted for it (the ONLY reference the app ever verifies, japa#252).
 */
export interface StartedCheckout {
  url: string;
  reference: string;
}

/**
 * Start a Paystack checkout to switch plans (app-to-web purchase, avoids store
 * IAP). japa#252: sends `returnTo: 'app'` so Paystack returns to the backend's
 * app return page (→ `durintech://payment-return`) instead of the portal, and
 * resolves `{ url, reference }` so the screen can verify that exact reference
 * afterwards. Resolves null when there is nothing to open (e.g. the backend
 * applied a free-plan switch directly, or the response was malformed). Access
 * is granted only by the backend (verify / webhook), never by the redirect.
 */
export function useStartCheckout() {
  return useMutation({
    mutationFn: async (planId: string): Promise<StartedCheckout | null> => {
      const res = await apiService.post<{ url?: string; reference?: string }>(
        '/subscriptions/checkout',
        { planId, returnTo: RETURN_TO_APP },
      );
      const url = res.data?.url;
      const reference = res.data?.reference;
      // https only, and a reference to verify: otherwise treat as unusable.
      if (typeof url !== 'string' || !/^https:\/\//i.test(url)) return null;
      if (typeof reference !== 'string' || !reference) return null;
      return { url, reference };
    },
  });
}

/**
 * Confirm a subscription checkout with the backend (japa#252):
 * `POST /subscriptions/verify { reference }`. Resolves when the backend
 * verified the charge with Paystack and applied the plan (idempotent: also
 * succeeds when the webhook got there first). Rejects with the `ApiError`
 * otherwise — a 400 means "not paid / not yours" (see
 * `subscriptionVerifyErrorVerdict`).
 *
 * On success (japa#474) the WHOLE query cache is invalidated, not just the
 * plan: most locks are decided by the server inside other responses (the
 * review tier `meta.tier` in the assessment, 402s on starts / chat / document
 * checks / refusal-letter reads), and those caches would otherwise keep the
 * free-plan answer for the 5-minute staleTime. Active queries refetch at once;
 * inactive ones when their screen next mounts.
 *   - The plan (`['subscription','me']`, `['authorization']`) is AWAITED, so
 *     when `mutateAsync` resolves "Current" has already moved and the screen
 *     the client returns to sees the new plan.
 *   - Everything else is fired without waiting: dozens of refetches must not
 *     hold up the plans screen closing (japa#473), and their failures are
 *     kept on each query (old data stays) rather than failing the verify.
 * A failed verify invalidates nothing (TanStack doesn't call onSuccess).
 */
export function useVerifySubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reference: string) => {
      const res = await apiService.post<{ verified?: boolean }>(
        '/subscriptions/verify',
        { reference },
      );
      return res.data ?? null;
    },
    onSuccess: async () => {
      // Everything except the plan: not awaited (see above).
      void queryClient.invalidateQueries({
        predicate: (query) => !isPlanQueryKey(query.queryKey),
      });
      // The plan: awaited.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['subscription', 'me'] }),
        queryClient.invalidateQueries({ queryKey: ['authorization'] }),
      ]);
    },
  });
}

/**
 * True for the two plan queries the verify awaits (japa#474); the rest of the
 * cache is refreshed without waiting. Exported for tests.
 */
export function isPlanQueryKey(queryKey: readonly unknown[]): boolean {
  return (
    (queryKey[0] === 'subscription' && queryKey[1] === 'me') ||
    queryKey[0] === 'authorization'
  );
}
