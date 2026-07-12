/**
 * useVerification Hook
 *
 * React Query hooks for the applicant identity-verification (KYC) flow.
 *
 * Backend endpoints used:
 * - GET  /users/me/verification          → current identity-verification status
 * - POST /users/me/verification/identity → submit a NIN/BVN (+ explicit consent)
 *
 * The applicant submits a government ID (NIN or BVN) with explicit consent; the
 * backend runs an automated Dojah lookup and returns the resulting status. When the
 * provider isn't yet configured the backend records the submission as `under_review`.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { IdentityVerification } from '@/types/user.type';

/** Query key for the current user's identity-verification status. */
export const VERIFICATION_QUERY_KEY = ['verification', 'me'] as const;

/** Body for an identity submission. */
export interface SubmitIdentityInput {
  idType: 'nin' | 'bvn';
  idNumber: string;
  consent: boolean;
}

/**
 * Fetch the current identity-verification status. Returns a safe default
 * (`{ status: 'unverified' }`) if the backend has no record yet.
 */
export function useIdentityVerification() {
  return useQuery<IdentityVerification>({
    queryKey: VERIFICATION_QUERY_KEY,
    queryFn: async () => {
      const res = await apiService.get<IdentityVerification>(
        '/users/me/verification',
      );
      return res.data ?? { status: 'unverified' };
    },
    // Verification status changes rarely; keep it fresh for 5 minutes.
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Submit a NIN/BVN for verification. On success, refresh both the verification
 * status and the cached profile (which embeds `identityVerification`).
 */
export function useSubmitIdentity() {
  const queryClient = useQueryClient();
  return useMutation<IdentityVerification, Error, SubmitIdentityInput>({
    mutationFn: async (input) => {
      const res = await apiService.post<IdentityVerification>(
        '/users/me/verification/identity',
        input,
      );
      if (!res.success || !res.data) {
        throw new Error(res.message || 'Verification failed');
      }
      return res.data;
    },
    onSuccess: (data) => {
      // Seed the query cache with the fresh status and invalidate the profile.
      queryClient.setQueryData(VERIFICATION_QUERY_KEY, data);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
    },
  });
}
