/**
 * useMe Hook (japa#145)
 *
 * The signed-in user's profile from `GET /users/me`, as a React Query query,
 * so the Home greeting and the Profile header show the REAL name and city
 * (they used to show a hard-coded demo persona).
 *
 * The auth store also caches the profile (`useAuthStore().profile`, filled by
 * `fetchProfile`); this hook seeds from it so a screen has the name at once,
 * then keeps it fresh. A 404 (new user, onboarding not finished) is final:
 * the screens render without a name rather than retrying.
 */

import { useQuery } from '@tanstack/react-query';
import { retryUnlessNotFound } from './queryErrors';
import { apiService } from '@/services/api.service';
import { useAuthStore } from '@/stores/auth.store';
import type { UserProfile } from '@/types/user.type';

export function useMe() {
  // Cached profile from the auth store, if it already loaded.
  const cached = useAuthStore((s) => s.profile);
  const signedIn = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['users', 'me'],
    queryFn: async () => {
      const response = await apiService.get<UserProfile>('/users/me');
      return response.data ?? null;
    },
    enabled: signedIn,
    initialData: cached ?? undefined,
    // Treat the store copy as stale so a fresh read still happens.
    initialDataUpdatedAt: 0,
    retry: retryUnlessNotFound,
    staleTime: 1000 * 60 * 5,
  });
}
