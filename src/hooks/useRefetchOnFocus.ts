// ─────────────────────────────────────────────────────────────────────────────
// Refetch a query whenever the screen regains focus (issue #193).
//
// The app-wide query cache has a 5-minute staleTime and no refetch-on-focus, so
// AI access state changed on another screen (or another device) could show stale
// for minutes. `refetch()` keeps the previous data on screen while it runs, so
// there is no flicker. The first focus is skipped: the query already fetches on
// mount, so refetching then would be a duplicate call.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

export function useRefetchOnFocus(refetch: () => unknown, enabled = true) {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      if (enabled) void refetch();
    }, [refetch, enabled]),
  );
}
