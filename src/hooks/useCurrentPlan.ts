// ─────────────────────────────────────────────────────────────────────────────
// useCurrentPlan (japa#346) — the signed-in client's plan, worked out ONE way
// for every screen that names it (Profile's Subscription row + upgrade banner,
// Settings' Subscription row), so they can never disagree.
//
// Sources: GET /subscriptions/me (`useMySubscription`) and
// GET /plans?audience=client (`usePlans`). React Query shares the cache, so
// calling this on two screens costs no extra requests.
// ─────────────────────────────────────────────────────────────────────────────

import type { SubscriberType } from '@durin-tech/authz';
import { useMySubscription, usePlans } from '@/hooks/useSubscription';
import { resolveCurrentPlan } from '@/components/explorer/planLogic';

export function useCurrentPlan() {
  const mine = useMySubscription();
  // Mobile users are clients. The pinned @durin-tech/authz has no runtime
  // ROLES / audience constant, so this is a `SubscriberType`-typed literal,
  // as in subscription.tsx.
  const plansQ = usePlans('client' satisfies SubscriberType);

  // Cached data wins over a failed background refetch (same rule Settings
  // used before this hook existed): only "no data yet" counts as loading or
  // failed.
  const loading =
    (mine.isLoading && !mine.data) || (plansQ.isLoading && !plansQ.data);
  const failed =
    (mine.isError && !mine.data) || (plansQ.isError && !plansQ.data);

  return {
    /** The current plan; undefined while loading, on error, or unknown id. */
    plan: resolveCurrentPlan(mine.data, plansQ.data),
    /** Every active client plan (for the upgrade banner). */
    plans: plansQ.data,
    loading,
    failed,
    /** A retry is in flight (Settings swaps its button for a spinner). */
    refetching: mine.isRefetching || plansQ.isRefetching,
    /**
     * japa#474: re-read both (pull-to-refresh). Resolves when both settled;
     * a failure stays on its query (old data kept), never thrown.
     */
    refetch: () => Promise.allSettled([mine.refetch(), plansQ.refetch()]),
    /** Re-run whichever query failed. */
    retry: () => {
      if (mine.isError) mine.refetch();
      if (plansQ.isError) plansQ.refetch();
    },
  };
}
