import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Action,
  AppAbility,
  Entitlements,
  FeatureKey,
  LimitKey,
  Role,
  SubjectType,
  abilityFromPackedRules,
  getLimit as getLimitFn,
  hasFeature as hasFeatureFn,
  subject as caslSubject,
} from '@durin-tech/authz';
import { apiService } from '@/services/api.service';
import { useAuthStore } from '@/stores/auth.store';

interface AuthorizationData {
  role: Role;
  agencyId: string | null;
  entitlements: Entitlements | null;
  rules: unknown;
}

export interface AuthorizationApi {
  role: Role | null;
  entitlements: Entitlements | null;
  ability: AppAbility | null;
  isLoading: boolean;
  /** CASL check; pass a typed resource object for ownership rules. */
  can: (
    action: Action,
    subjectType: SubjectType,
    resource?: Record<string, unknown>,
  ) => boolean;
  /** True if the plan unlocks `feature` (admins/ungated always true). */
  hasFeature: (feature: FeatureKey) => boolean;
  /** Numeric limit for `key` (-1 = unlimited). */
  getLimit: (key: LimitKey) => number;
}

/**
 * Client-side authorization for mobile. Fetches `/users/me/authorization` (role +
 * entitlements + packed CASL rules), rebuilds the same ability the backend uses,
 * and exposes `can`/`hasFeature`/`getLimit` for paywalling features. The backend
 * remains the authoritative enforcer; this only gates the UI.
 */
export function useAuthorization(): AuthorizationApi {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data, isLoading } = useQuery({
    queryKey: ['authorization'],
    queryFn: async () => {
      const res = await apiService.get<AuthorizationData>(
        '/users/me/authorization',
      );
      return res.data ?? null;
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5,
  });

  return useMemo<AuthorizationApi>(() => {
    const role = data?.role ?? null;
    const entitlements = data?.entitlements ?? null;
    const ability: AppAbility | null = data
      ? abilityFromPackedRules(data.rules)
      : null;
    const isAdmin = role === 'admin';

    return {
      role,
      entitlements,
      ability,
      isLoading,
      can: (action, subjectType, resource) => {
        if (!ability) return false;
        return ability.can(
          action,
          resource
            ? (caslSubject(subjectType, resource) as never)
            : (subjectType as never),
        );
      },
      // Matches the backend's safe-rollout semantics: ungated until entitlements
      // are populated (admin / pre-seed) → no premature paywalls.
      hasFeature: (feature) =>
        isAdmin || entitlements === null || hasFeatureFn(entitlements, feature),
      getLimit: (key) =>
        isAdmin || entitlements === null ? -1 : getLimitFn(entitlements, key),
    };
  }, [data, isLoading]);
}

/** Convenience: is a single feature unlocked? */
export function useFeature(feature: FeatureKey): boolean {
  return useAuthorization().hasFeature(feature);
}
