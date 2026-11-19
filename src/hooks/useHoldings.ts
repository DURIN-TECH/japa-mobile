/**
 * useHoldings hooks (japa#234) — "What you already hold".
 *
 * Backend endpoints:
 * - GET    /users/me/holdings                         → the view
 * - PUT    /users/me/holdings                         → replace the fields sent
 * - POST   /users/me/holdings/documents               → add one document
 * - DELETE /users/me/holdings/documents/:documentId   → remove one
 *
 * Rules:
 * - Every write answers with the FULL fresh view, which goes straight into the
 *   cache. NOT optimistic: the lists change only after the server answered, so
 *   nothing is shown as saved that isn't.
 * - Writes replace whole fields (a PUT of `nationalities` replaces the list),
 *   so callers send the full list. See holdingsLogic.withNationality.
 * - Offline: the cached view stays on screen; `tracked` feeds the offline signal.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { tracked } from '@/utils/networkStatus';
import { useAuthStore } from '@/stores/auth.store';
import type {
  HoldingsPatch,
  HoldingsView,
  NewHeldDocument,
} from '@/types/holdings.type';
import { emptyHoldings } from '@/components/explorer/holdingsLogic';

export const HOLDINGS_KEY = ['holdings'] as const;

/** Plain PUT, also used by onboarding's "retry the save" (no React needed). */
export async function putHoldings(patch: HoldingsPatch): Promise<HoldingsView> {
  const res = await tracked(() =>
    apiService.put<HoldingsView>('/users/me/holdings', patch),
  );
  return res.data ?? emptyHoldings();
}

/** The signed-in person's holdings. No profile yet → the empty view (server). */
export function useHoldings() {
  const signedIn = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: HOLDINGS_KEY,
    enabled: signedIn,
    queryFn: async () => {
      const res = await tracked(() =>
        apiService.get<HoldingsView>('/users/me/holdings'),
      );
      return res.data ?? emptyHoldings();
    },
  });
}

/** Put a fresh view into the cache. */
function useStoreView() {
  const qc = useQueryClient();
  return (view?: HoldingsView) => {
    if (view) qc.setQueryData(HOLDINGS_KEY, view);
    else qc.invalidateQueries({ queryKey: HOLDINGS_KEY });
  };
}

/** PUT any of nationalities / residentialCountry / heldDocuments. */
export function useSaveHoldings() {
  const store = useStoreView();
  return useMutation({
    mutationFn: (patch: HoldingsPatch) => putHoldings(patch),
    onSuccess: store,
  });
}

/** Add one document. */
export function useAddHeldDocument() {
  const store = useStoreView();
  return useMutation({
    mutationFn: async (doc: NewHeldDocument) => {
      const res = await tracked(() =>
        apiService.post<HoldingsView>('/users/me/holdings/documents', doc),
      );
      return res.data;
    },
    onSuccess: store,
  });
}

/** Remove one document. A 404 means it is already gone: the screen refetches. */
export function useRemoveHeldDocument() {
  const store = useStoreView();
  return useMutation({
    mutationFn: async (documentId: string) => {
      const res = await tracked(() =>
        apiService.delete<HoldingsView>(
          `/users/me/holdings/documents/${encodeURIComponent(documentId)}`,
        ),
      );
      return res.data;
    },
    onSuccess: store,
  });
}
