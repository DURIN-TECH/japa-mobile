// ─────────────────────────────────────────────────────────────────────────────
// usePullToRefresh — the one pull-to-refresh every list / detail screen uses
// (japa#474).
//
// Follows the pattern `notifications.tsx` started (`pulling` / `pullToRefresh`):
//
//   • the spinner follows the client's OWN pull only. Background refetches
//     (focus, polling, invalidation) never show it, so it doesn't flash;
//   • every refetch runs in parallel, and every pull ALSO re-reads the plan
//     (`['subscription','me']` + `['authorization']`), cached or not, so a
//     plan change made elsewhere (the Paystack webhook, another device) shows
//     after one pull;
//   • the data already on screen stays while it runs: TanStack's `refetch()`
//     keeps `data` and never puts the query back into its first-load state, so
//     no screen blanks or shows its full-screen spinner;
//   • a failed refetch (offline, 5xx) is NOT thrown: `refetch()` resolves with
//     the error on the query (old data kept, the screen's existing error /
//     offline line shows), and we wait with `allSettled`, so one failure can't
//     leave the spinner stuck or crash the screen. No toast here.
//   • disabled queries (`isEnabled === false`, e.g. agent features in the
//     self-service-only build, or a detail query waiting for an id) are
//     skipped: `refetch()` would otherwise fetch them anyway.
//
// Usage:
//   const pull = usePullToRefresh([appsQ, meQ]);
//   <ScrollView refreshControl={pull.control}> … </ScrollView>
//
// `control` is a ready coral `RefreshControl` element (the design system's
// loading colour, `EX.color.primary`, with `colors` for Android). Screens that
// need to change it (e.g. a header offset) can build their own from
// `refreshing` / `onRefresh`.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl } from 'react-native';
import {
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { EX } from '@/components/explorer/theme';

/**
 * Something a pull can refresh:
 * - a query result (anything with `refetch`; `isEnabled: false` is skipped),
 * - a plain function (e.g. an infinite list's "start from page one"),
 * - or a falsy value, so screens can list conditional sources inline.
 */
export type RefetchSource =
  | { refetch: () => Promise<unknown>; isEnabled?: boolean }
  | (() => unknown)
  | null
  | undefined
  | false;

/** The plan queries every pull (and the app foreground) re-reads. */
export const PLAN_QUERY_KEYS: QueryKey[] = [
  ['subscription', 'me'],
  ['authorization'],
];

/**
 * The fetcher React Query knows for `queryKey`: the client-wide default
 * (`QueryProvider` registers one for each plan key, japa#474 fix round 1), or
 * else the one a cached query was created with. `undefined` when neither.
 */
function knownQueryFn(queryClient: QueryClient, queryKey: QueryKey) {
  const fromDefaults = queryClient.getQueryDefaults(queryKey).queryFn;
  if (typeof fromDefaults === 'function') return fromDefaults;
  const cached = queryClient.getQueryCache().find({ queryKey, exact: true })
    ?.options.queryFn;
  return typeof cached === 'function' ? cached : undefined;
}

/**
 * Re-read the client's plan. Exported for explore's own pull and tests.
 *
 * japa#474 fix round 1: this uses `fetchQuery` (not `refetchQueries`, which
 * only touches queries already in the cache), so a pull re-reads the plan on
 * a cold start too, before any screen has asked for it. The fetcher comes
 * from the client's defaults (see `QueryProvider`), so this module never
 * imports the API client itself. `staleTime: 0` forces a real request. A
 * failure keeps the old data on the query, and `allSettled` swallows it.
 *
 * `fetchQuery` joins a request for the same key that is already in flight
 * rather than cancelling it, so a screen that also lists a plan query as its
 * own source never sends a second, aborted request.
 */
export function refetchPlanQueries(queryClient: QueryClient) {
  return Promise.allSettled(
    PLAN_QUERY_KEYS.map((queryKey) => {
      const queryFn = knownQueryFn(queryClient, queryKey);
      // No fetcher known (a bare test client): nothing to re-read.
      if (!queryFn) return Promise.resolve();
      return queryClient.fetchQuery({ queryKey, queryFn, staleTime: 0 });
    }),
  );
}

/** Run one source; resolves when it settles (never throws synchronously). */
function runSource(source: RefetchSource): Promise<unknown> {
  if (!source) return Promise.resolve();
  if (typeof source === 'function') {
    return Promise.resolve().then(source);
  }
  if (source.isEnabled === false) return Promise.resolve();
  return Promise.resolve().then(() => source.refetch());
}

/** Options for the ready-made control. */
export interface PullToRefreshOptions {
  /**
   * Android only: how far down the spinner appears. Screens whose content
   * starts under a hero image / floating header (the collapsing-header
   * screens) push it below their top controls so it isn't hidden.
   */
  progressViewOffset?: number;
}

export function usePullToRefresh(
  sources: RefetchSource[],
  options: PullToRefreshOptions = {},
) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // Latest sources (screens pass a new array each render; no re-subscribe).
  const latest = useRef(sources);
  latest.current = sources;

  // One pull at a time: a second pull while one runs is ignored.
  const inFlight = useRef(false);
  // Don't set state after the screen went away mid-pull.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const onRefresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      // Everything in parallel: the screen's own queries + the plan. The plan
      // read is queued AFTER the sources (microtasks run in order), so if a
      // source is itself a plan query its `refetch()` starts first and the
      // plan read joins it instead of cancelling it (japa#474 fix round 1).
      await Promise.allSettled([
        ...latest.current.map(runSource),
        Promise.resolve().then(() => refetchPlanQueries(queryClient)),
      ]);
    } finally {
      inFlight.current = false;
      if (mounted.current) setRefreshing(false);
    }
  }, [queryClient]);

  const control = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      // Coral spinner: the design system's loading state (iOS / Android).
      tintColor={EX.color.primary}
      colors={[EX.color.primary]}
      progressViewOffset={options.progressViewOffset}
    />
  );

  return { refreshing, onRefresh, control };
}
