// ─────────────────────────────────────────────────────────────────────────────
// usePlanForegroundRefresh — re-read the client's plan when the app comes back
// to the foreground (japa#474).
//
// WHY: a subscription can be applied by the Paystack WEBHOOK while the client
// is outside the app (the verify said "not paid" first: they closed the sheet
// a moment before the charge went through). React Query's `focusManager` is
// not wired to `AppState` in React Native, and the plan queries are cached for
// minutes, so without this the app kept showing the old plan until a restart.
//
// WHAT: on every background/inactive → active move, invalidate
// `['subscription','me']` and `['authorization']`. Active queries refetch at
// once (old data stays on screen meanwhile); inactive ones refetch when their
// screen next mounts. Only the plan: the app-wide staleTime and the other
// queries are deliberately left alone (out of scope). Other screens pick a
// change up through their focus refetch or pull-to-refresh.
//
// Mounted once, in the app root (QueryProvider).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { PLAN_QUERY_KEYS } from '@/hooks/usePullToRefresh';

export function usePlanForegroundRefresh() {
  const queryClient = useQueryClient();
  // The previous state, so only a real return to the foreground counts (not
  // the first 'active' report on launch, which already fetched).
  const previous = useRef<AppStateStatus | string | null | undefined>(
    AppState.currentState,
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const was = previous.current;
      previous.current = next;
      if (next === 'active' && was !== 'active') {
        for (const queryKey of PLAN_QUERY_KEYS) {
          void queryClient.invalidateQueries({ queryKey });
        }
      }
    });
    return () => sub.remove();
  }, [queryClient]);
}
