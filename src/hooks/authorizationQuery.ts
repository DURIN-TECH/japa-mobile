// ─────────────────────────────────────────────────────────────────────────────
// authorizationQuery — key + fetcher for `GET /users/me/authorization`
// (japa#474 fix round 1).
//
// Shared by `useAuthorization` and by pull-to-refresh, which re-reads the plan
// even on a cold start (before any screen cached it), so it needs the fetcher
// itself and not just the key. Kept in its own small module so the pull hook
// doesn't pull in the auth store (and Firebase) through `useAuthorization`.
// ─────────────────────────────────────────────────────────────────────────────

import type { Entitlements, Role } from '@durin-tech/authz';
import { apiService } from '@/services/api.service';

/** What `/users/me/authorization` answers: role, entitlements, CASL rules. */
export interface AuthorizationData {
  role: Role;
  agencyId: string | null;
  entitlements: Entitlements | null;
  rules: unknown;
}

export const authorizationQuery = {
  queryKey: ['authorization'] as const,
  queryFn: async (): Promise<AuthorizationData | null> => {
    const res = await apiService.get<AuthorizationData>(
      '/users/me/authorization',
    );
    return res.data ?? null;
  },
};
