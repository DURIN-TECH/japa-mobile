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
 */

import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import type { ApiAgent } from './useAgents';

/**
 * Public agency type matching the backend `PublicAgency` model.
 *
 * IMPORTANT: these are the ONLY fields the backend returns — there is no
 * city/cover/rating/reviewCount/successRate/badges/flag on this model. The
 * Explorer's richer `Agency` shape is synthesised by `mapAgency()` in
 * `src/components/explorer/liveAgencies.ts`.
 *
 * `consultationFee` is in cents (divide by 100 for the ₦ value).
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
  consultationFee?: number; // in cents (divide by 100 for display)
  services: { id: string; name: string; price: number }[];
  agentCount: number;
  totalCases: number;
  status: 'approved';
  verified: boolean;
  createdAt: { _seconds: number; _nanoseconds: number } | string;
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
    queryFn: async () => {
      const response = await apiService.get<ApiAgency>(
        `/agencies/browse/${id}`,
      );
      return response.data;
    },
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
