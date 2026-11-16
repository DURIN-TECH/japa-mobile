/**
 * useSavedDestinations hooks (japa#146) — the user's saved destinations.
 *
 * Backend endpoints (all signed-in, the user is always the token's uid):
 * - GET    /users/me/saved-destinations                       → newest first
 * - PUT    /users/me/saved-destinations/:countryCode/:visaId  → the item
 *          402 UPGRADE_REQUIRED · 404 NOT_FOUND · 409 SAVED_LIMIT_REACHED
 * - DELETE /users/me/saved-destinations/:countryCode/:visaId  → { saved: false }
 *          402 UPGRADE_REQUIRED (idempotent otherwise)
 *
 * Rules:
 * - ONE query key (`SAVED_DESTINATIONS_KEY`) feeds the destination heart, the
 *   Saved screen and the Profile count, so all three always agree.
 * - Writes are OPTIMISTIC (the heart changes at once). A failure applies the
 *   exact inverse edit (not a whole-list snapshot), so a concurrent write on
 *   another destination is not undone, and the list is never left wrong.
 * - After the last pending write settles, the list is refetched so the cache
 *   ends on the server's truth (order, hidden visas).
 * - Each write carries a per-destination mutation key, so a screen can tell a
 *   write for ITS destination is in flight (`useSavedDestinationPending`).
 */

import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { tracked } from '@/utils/networkStatus';
import { useAuthStore } from '@/stores/auth.store';
import type { VisaType } from '@/types/visas.type';
import type {
  SavedDestinationItem,
  SavedDestinationRemoved,
} from '@/types/savedDestinations.type';
import {
  itemKey,
  normaliseSavedList,
  optimisticItem,
  savedKey,
  withRestored,
  withSaved,
  withServerItem,
  withoutSaved,
} from '@/components/explorer/savedLogic';

/** The one list key. */
export const SAVED_DESTINATIONS_KEY = ['savedDestinations'] as const;

/** Prefix of every write's mutation key. */
const WRITE_KEY = [...SAVED_DESTINATIONS_KEY, 'write'] as const;

/** Mutation key of the writes for one destination. */
function writeKey(countryCode: string, visaId: string) {
  return [...WRITE_KEY, savedKey(countryCode, visaId)] as const;
}

/** API path of one saved destination (both segments encoded). */
function itemPath(countryCode: string, visaId: string): string {
  return `/users/me/saved-destinations/${encodeURIComponent(
    countryCode.toUpperCase(),
  )}/${encodeURIComponent(visaId)}`;
}

/**
 * Refetch the list, but only once no other saved-destination write is still
 * running (`isMutating` counts this one too until it fully settles). A refetch
 * mid-flight could overwrite another write's optimistic change.
 */
function refreshWhenIdle(qc: QueryClient) {
  if (qc.isMutating({ mutationKey: WRITE_KEY }) <= 1) {
    void qc.invalidateQueries({ queryKey: SAVED_DESTINATIONS_KEY });
  }
}

// ── List ─────────────────────────────────────────────────────────────────────

/** The signed-in user's saved destinations, newest first. */
export function useSavedDestinations() {
  const signedIn = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: SAVED_DESTINATIONS_KEY,
    enabled: signedIn,
    queryFn: async () => {
      const res = await tracked(() =>
        apiService.get<SavedDestinationItem[]>('/users/me/saved-destinations'),
      );
      return normaliseSavedList(res.data);
    },
  });
}

/** True while a save / remove for this destination is in flight. */
export function useSavedDestinationPending(
  countryCode: string,
  visaId: string,
): boolean {
  return useIsMutating({ mutationKey: writeKey(countryCode, visaId) }) > 0;
}

// ── Save ─────────────────────────────────────────────────────────────────────

/** What a save needs to draw its optimistic tile. */
export interface SaveDestinationInput {
  visa: Pick<VisaType, 'name' | 'category'> & Partial<VisaType>;
  countryName?: string;
}

/** Save (countryCode, visaId). Optimistic; reverts on failure. */
export function useSaveDestination(countryCode: string, visaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: writeKey(countryCode, visaId),
    // The PUT has no body; the input only feeds the optimistic tile below.
    mutationFn: async (input: SaveDestinationInput) => {
      void input;
      const res = await tracked(() =>
        apiService.put<SavedDestinationItem>(itemPath(countryCode, visaId)),
      );
      return res.data;
    },
    onMutate: async (input) => {
      // Stop an in-flight GET from landing on top of the optimistic list.
      await qc.cancelQueries({ queryKey: SAVED_DESTINATIONS_KEY });
      const list = qc.getQueryData<SavedDestinationItem[]>(
        SAVED_DESTINATIONS_KEY,
      );
      // Already saved (e.g. saved on another device): nothing to undo later.
      const wasSaved =
        !!list &&
        list.some((i) => itemKey(i) === savedKey(countryCode, visaId));
      if (list && !wasSaved) {
        qc.setQueryData<SavedDestinationItem[]>(
          SAVED_DESTINATIONS_KEY,
          withSaved(
            list,
            optimisticItem(countryCode, visaId, input.visa, input.countryName),
          ),
        );
      }
      return { added: !!list && !wasSaved };
    },
    onError: (_e, _input, ctx) => {
      // Inverse of onMutate: take out only what this save added.
      if (!ctx?.added) return;
      qc.setQueryData<SavedDestinationItem[]>(SAVED_DESTINATIONS_KEY, (l) =>
        l ? withoutSaved(l, countryCode, visaId) : l,
      );
    },
    onSuccess: (item) => {
      // Swap in the server's item (real savedAt, server visa data) in place.
      if (!item) return;
      const [clean] = normaliseSavedList([item]);
      if (!clean) return;
      qc.setQueryData<SavedDestinationItem[]>(SAVED_DESTINATIONS_KEY, (l) =>
        l ? withServerItem(l, clean) : l,
      );
    },
    onSettled: () => refreshWhenIdle(qc),
  });
}

// ── Remove ───────────────────────────────────────────────────────────────────

/** Remove (countryCode, visaId). Optimistic; reverts on failure. */
export function useRemoveDestination(countryCode: string, visaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: writeKey(countryCode, visaId),
    mutationFn: async () => {
      const res = await tracked(() =>
        apiService.delete<SavedDestinationRemoved>(
          itemPath(countryCode, visaId),
        ),
      );
      return res.data;
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: SAVED_DESTINATIONS_KEY });
      const list = qc.getQueryData<SavedDestinationItem[]>(
        SAVED_DESTINATIONS_KEY,
      );
      const key = savedKey(countryCode, visaId);
      const index = list ? list.findIndex((i) => itemKey(i) === key) : -1;
      const removed = index >= 0 && list ? list[index] : undefined;
      if (list && removed) {
        qc.setQueryData<SavedDestinationItem[]>(
          SAVED_DESTINATIONS_KEY,
          withoutSaved(list, countryCode, visaId),
        );
      }
      // Remember the item and where it sat, to put it back on failure.
      return { removed, index };
    },
    onError: (_e, _v, ctx) => {
      if (!ctx?.removed) return;
      const item = ctx.removed;
      qc.setQueryData<SavedDestinationItem[]>(SAVED_DESTINATIONS_KEY, (l) =>
        l ? withRestored(l, item, ctx.index) : l,
      );
    },
    onSettled: () => refreshWhenIdle(qc),
  });
}
