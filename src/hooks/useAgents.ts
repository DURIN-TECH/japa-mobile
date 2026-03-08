/**
 * useAgents Hook
 *
 * React Query hooks for fetching agent data from the backend API.
 * Replaces the mock `verificationAgents` array from `mock_data/agents.ts`.
 *
 * Backend endpoints used:
 * - GET /agents          → all agents (paginated)
 * - GET /agents/top      → top-rated agents (for home screen carousel)
 * - GET /agents/:id      → single agent detail (for agent profile screen)
 * - GET /agents/visa/:id → agents specializing in a specific visa type
 *
 * The backend stores consultation fees in cents (e.g. 5000_00 = ₦50,000).
 * The `formatAgentForDisplay()` helper converts to the display format
 * expected by existing components (AgentCard, ConsultationCard, etc.).
 */

import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';

/**
 * Agent type matching the backend Agent model.
 * Dates come as ISO strings (not Firestore Timestamps) because
 * the API serializes them before sending.
 */
export interface ApiAgent {
  id: string;
  userId: string;
  agencyId?: string;
  agencyRole?: string; // 'owner' | 'agent'
  displayName: string;
  bio?: string;
  yearsOfExperience: number;
  specializations: string[]; // e.g. ['Study Visa', 'Work Permit']
  languages: string[]; // e.g. ['English', 'Igbo']
  featuredVisas: string[]; // visa type IDs this agent promotes
  verificationStatus: string; // 'pending' | 'verified' | 'rejected' | 'suspended'
  rating: number; // 0-5 star rating
  totalReviews: number;
  totalApplications: number;
  successRate: number; // 0-100 percentage
  responseTime: string; // e.g. '2-4 hours'
  consultationFee: number; // in cents (divide by 100 for display)
  isAvailable: boolean;
  availableSlots?: { dayOfWeek: number; startTime: string; endTime: string }[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Derive initials from a display name.
 * e.g. "Chinedu Eze" → "CE", "Adaeze Okonkwo" → "AO"
 * Used for avatar placeholders when no profile photo exists.
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Convert cents (backend storage format) to display amount.
 * Backend stores all monetary values in cents to avoid floating-point issues.
 * e.g. 5000_00 → 50000 (₦50,000 stored as 5000000 cents → display as 50000)
 * Note: the backend uses kobo (1/100 of Naira), so 500000 kobo = ₦5,000
 */
function centsToDisplay(cents: number): number {
  return Math.round(cents / 100);
}

/**
 * Fetch all available, verified agents.
 * Filters out unverified and unavailable agents on the client side
 * so users only see agents they can actually book.
 *
 * Used on: Agents listing screen (apply/agents/index.tsx)
 */
export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const response = await apiService.get<ApiAgent[]>('/agents');
      // Only show agents who are verified AND currently available
      return (response.data ?? []).filter(
        (a) => a.isAvailable && a.verificationStatus === 'verified',
      );
    },
  });
}

/**
 * Fetch top-rated agents (sorted by rating on the backend).
 * Used on: Home screen agent carousel.
 *
 * @param limit - Max number of agents to return (default 5)
 */
export function useTopAgents(limit = 5) {
  return useQuery({
    queryKey: ['agents', 'top', limit],
    queryFn: async () => {
      const response = await apiService.get<ApiAgent[]>(
        `/agents/top?limit=${limit}`,
      );
      return response.data ?? [];
    },
  });
}

/**
 * Fetch a single agent by ID.
 * Used on: Agent detail/profile screen (apply/agents/[id].tsx)
 *
 * @param id - Agent document ID. Query is disabled if id is undefined.
 */
export function useAgent(id: string | undefined) {
  return useQuery({
    queryKey: ['agents', id],
    queryFn: async () => {
      const response = await apiService.get<ApiAgent>(`/agents/${id}`);
      return response.data!;
    },
    // Don't fetch until we have an ID (prevents firing on initial render)
    enabled: !!id,
  });
}

/**
 * Fetch agents that specialize in a specific visa type.
 * Used on: Visa details screen to show "Agents for this visa".
 *
 * @param visaTypeId - The visa type ID to filter agents by
 */
export function useAgentsByVisa(visaTypeId: string | undefined) {
  return useQuery({
    queryKey: ['agents', 'visa', visaTypeId],
    queryFn: async () => {
      const response = await apiService.get<ApiAgent[]>(
        `/agents/visa/${visaTypeId}`,
      );
      return response.data ?? [];
    },
    enabled: !!visaTypeId,
  });
}

/**
 * Convert an ApiAgent to the legacy display format used by existing components.
 *
 * The mobile app was originally built with a mock `Agent` type (from documents.type.ts)
 * that has fields like `name`, `initials`, `price`, `verificationCount`.
 * This helper maps the real API response to that shape so existing components
 * (AgentCard, ConsultationCard, etc.) work without modification.
 *
 * Over time, components should be updated to use ApiAgent directly,
 * and this helper can be removed.
 */
export function formatAgentForDisplay(agent: ApiAgent) {
  return {
    id: agent.id,
    name: agent.displayName,
    initials: getInitials(agent.displayName),
    rating: agent.rating,
    verificationCount: agent.totalReviews, // "verificationCount" = total reviews in legacy UI
    price: centsToDisplay(agent.consultationFee),
    description: agent.bio ?? '',
    specializations: agent.specializations,
    consultationFee: centsToDisplay(agent.consultationFee),
    availability: agent.isAvailable,
    responseTime: agent.responseTime,
    languages: agent.languages,
    successRate: agent.successRate,
    featuredVisas: agent.featuredVisas,
    yearsOfExperience: agent.yearsOfExperience,
    totalApplications: agent.totalApplications,
  };
}
