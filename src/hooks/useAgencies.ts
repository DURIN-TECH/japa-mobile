/**
 * useAgencies Hook
 *
 * React Query hooks for fetching PUBLIC agency data from the backend API.
 * These power the Explorer's "Top agencies" carousel and the Agency detail
 * screen. All three endpoints are public (no auth required) and return the
 * standard `{ success, data }` envelope, which `apiService.get()` unwraps.
 *
 * Backend endpoints used:
 * - GET /agencies/browse            → PublicAgency[]  (all public agencies)
 * - GET /agencies/browse/:id        → PublicAgency    (404 if not public)
 * - GET /agencies/browse/:id/agents → ApiAgent[]      (verified + available
 *                                                       agents of that agency;
 *                                                       same shape as GET /agents)
 *
 * japa#106: `useAgencyVisaPrices(id)` reads the agency's `visaPrices[]` (the
 * visas it handles, with ITS service price in whole naira). Today it reads
 * the field off the agency detail response above. NOTE: the backend serves
 * `visaPrices[]` on `GET /agencies/public/:slug` (#102/#103); whether the
 * by-id browse endpoint gets the same field, or the app moves to a slug
 * call, is an open backend decision. The data source lives in ONE place
 * (`useAgencyVisaPrices`) so it can be swapped without touching the screen.
 */

import { useQuery } from '@tanstack/react-query';
import type { ApiAgent } from './useAgents';
import { apiService } from '@/services/api.service';
import { normalizeVisaPrices } from '@/components/explorer/liveAgencies';

/**
 * Public agency type matching the backend `PublicAgency` model.
 *
 * IMPORTANT: these are the ONLY fields the backend returns — there is no
 * city/cover/rating/reviewCount/successRate/badges/flag on this model. The
 * Explorer's richer `Agency` shape is synthesised by `mapAgency()` in
 * `src/components/explorer/liveAgencies.ts`.
 *
 * `consultationFee`: the backend stores agency fees in whole NAIRA (see the
 * public agency page, #103). Nothing in the app reads this field today.
 * `createdAt` may arrive either as a Firestore Timestamp serialized to
 * `{ _seconds, _nanoseconds }` OR as an ISO string — the mapper handles both.
 */
export interface ApiAgency {
  id: string;
  name: string;
  ownerName: string;
  state?: string;
  address?: string;
  description?: string;
  logoUrl?: string;
  consultationFee?: number; // whole naira (not read by the app)
  services: { id: string; name: string; price: number }[];
  agentCount: number;
  totalCases: number;
  status: 'approved';
  verified: boolean;
  createdAt: { _seconds: number; _nanoseconds: number } | string;
  /**
   * japa#106: the visas this agency handles (its own approved visas plus the
   * global visas it priced). Optional: older responses don't carry it, and
   * a missing field is treated as [] (see `normalizeVisaPrices`).
   */
  visaPrices?: PublicVisaPrice[];
}

/**
 * One entry of an agency's `visaPrices[]` (backend contract:
 * functions/src/agency-visa-prices/agency-visa-prices.md, "Public agency
 * page"). Applicant-safe: no owner, review or sponsor-licence fields.
 *
 * MONEY: `price` is the agency's SERVICE price in WHOLE NAIRA (₦12,500 is
 * 12500). Never divide by 100. `null` = "Contact for pricing".
 * `baseCostUsd` is the separate GOVERNMENT fee, in USD.
 */
export interface PublicVisaPrice {
  visaTypeId: string;
  countryCode: string;
  visaName: string;
  category: string;
  price: number | null;
  /** True when this agency created the visa (agency-only or made global). */
  isAgencyVisa: boolean;
  /**
   * "agency" = only reachable through this agency: the single-visa endpoints
   * 404 for anyone without a case at the agency (#102). "global" = in the
   * Explorer for everyone.
   */
  visibility: 'global' | 'agency';
  visaCode?: string | null;
  description?: string | null;
  processingTime?: string | null;
  processingDaysMin?: number | null;
  processingDaysMax?: number | null;
  validityPeriod?: string | null;
  baseCostUsd?: number | null;
}

/** GET /agencies/browse/:id: shared by the agency + visa-prices hooks. */
async function fetchPublicAgency(id: string): Promise<ApiAgency | undefined> {
  const response = await apiService.get<ApiAgency>(`/agencies/browse/${id}`);
  return response.data;
}

/**
 * Fetch all public (browseable) agencies.
 * Used on: Explorer Agents tab → "Top agencies" carousel.
 */
export function useBrowseAgencies() {
  return useQuery({
    queryKey: ['agencies', 'browse'],
    queryFn: async () => {
      const response = await apiService.get<ApiAgency[]>('/agencies/browse');
      return response.data ?? [];
    },
  });
}

/**
 * Fetch a single public agency by ID.
 * Used on: Explorer Agency detail screen.
 *
 * @param id - Agency document ID. Query is disabled until an id is present
 *   (so the demo-agency path, which passes `undefined`, never fires a request).
 */
export function usePublicAgency(id?: string) {
  return useQuery({
    queryKey: ['agencies', 'browse', id],
    queryFn: () => fetchPublicAgency(id as string),
    enabled: !!id,
  });
}

/**
 * The visas an agency handles, with its service price (japa#106).
 * Used on: Explorer Agency detail screen → "Visas they handle".
 *
 * DATA SOURCE (swap point): today this shares the agency detail query
 * (same key + fetcher, so there is ONE request) and selects `visaPrices`
 * from it. To move to a slug-based call (`GET /agencies/public/:slug`) or a
 * dedicated endpoint, change only this hook's `queryKey` / `queryFn`; the
 * screen consumes `{ data, isLoading, isError, refetch, isRefetching }`.
 *
 * `select` normalizes the field: missing → [], non-number price → null.
 * Offline: React Query keeps the last good data, so the list renders from
 * cache; with no cache the screen shows its error state.
 *
 * @param id - Agency document ID. Disabled until present (demo agencies
 *   pass `undefined`; their fixtures have no visas).
 */
export function useAgencyVisaPrices(id?: string) {
  return useQuery({
    queryKey: ['agencies', 'browse', id],
    queryFn: () => fetchPublicAgency(id as string),
    select: (agency: ApiAgency | undefined) =>
      normalizeVisaPrices(agency?.visaPrices),
    enabled: !!id,
  });
}

/**
 * Fetch the verified + available agents belonging to a public agency.
 * Same response shape as `GET /agents` (an array of `ApiAgent`).
 * Used on: Explorer Agency detail screen → "N agents here" list.
 *
 * @param id - Agency document ID. Query is disabled until an id is present.
 */
export function usePublicAgencyAgents(id?: string) {
  return useQuery({
    queryKey: ['agencies', 'browse', id, 'agents'],
    queryFn: async () => {
      const response = await apiService.get<ApiAgent[]>(
        `/agencies/browse/${id}/agents`,
      );
      return response.data ?? [];
    },
    enabled: !!id,
  });
}
