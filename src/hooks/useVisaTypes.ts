import { useQuery, useQueries } from '@tanstack/react-query';
import { retryUnlessNotFound } from './queryErrors';
import { apiService } from '@/services/api.service';
import {
  VisaType,
  VisaRequirement,
  VisaTypeWithRequirements,
  VisaCategory,
} from '@/types/visas.type';
import { Country } from '@/types/country.type';
import { getCountryFlag } from '@/utils/countryFlags';

interface GetAllVisasResponse {
  visaTypes: VisaType[];
  total: number;
}

// ============================================
// HOOKS
// ============================================

/**
 * Get all visa types across all countries
 */
export function useVisaTypes(options?: {
  category?: VisaCategory;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['visaTypes', options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.category) params.append('category', options.category);
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());

      const query = params.toString();
      const endpoint = query ? `/visas?${query}` : '/visas';
      const response = await apiService.get<GetAllVisasResponse>(endpoint);
      return response.data ?? { visaTypes: [], total: 0 };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get visa types for a specific country
 */
export function useVisaTypesByCountry(countryCode: string) {
  return useQuery({
    queryKey: ['visaTypes', 'country', countryCode],
    queryFn: async () => {
      console.log('[useVisaTypesByCountry] Fetching visas for:', countryCode);
      const response = await apiService.get<VisaType[]>(
        `/countries/${countryCode}/visas`,
      );
      console.log('[useVisaTypesByCountry] Response:', response.data);
      return response.data ?? [];
    },
    enabled: !!countryCode,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get a single visa type with its requirements
 */
export function useVisaType(countryCode: string, visaTypeId: string) {
  return useQuery({
    queryKey: ['visaType', countryCode, visaTypeId],
    queryFn: async () => {
      const response = await apiService.get<VisaTypeWithRequirements>(
        `/countries/${countryCode}/visas/${visaTypeId}/full`,
      );
      return response.data;
    },
    enabled: !!countryCode && !!visaTypeId,
    staleTime: 1000 * 60 * 5,
    // japa#106: an agency-only visa 404s for anyone without a case at that
    // agency (#102). That answer is final, so fail fast to the not-found
    // state rather than retrying.
    retry: retryUnlessNotFound,
  });
}

/**
 * Get requirements for a visa type
 */
export function useVisaRequirements(countryCode: string, visaTypeId: string) {
  return useQuery({
    queryKey: ['visaRequirements', countryCode, visaTypeId],
    queryFn: async () => {
      const response = await apiService.get<VisaRequirement[]>(
        `/countries/${countryCode}/visas/${visaTypeId}/requirements`,
      );
      return response.data ?? [];
    },
    enabled: !!countryCode && !!visaTypeId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Search visa types across all countries
 */
export function useVisaSearch(query: string) {
  return useQuery({
    queryKey: ['visaSearch', query],
    queryFn: async () => {
      const response = await apiService.get<VisaType[]>(
        `/visas/search?q=${encodeURIComponent(query)}`,
      );
      return response.data ?? [];
    },
    enabled: query.length >= 2,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Visas of several countries at once (japa#254: the Explore search shows the
 * visas of any country the query resolves to). Uses the same query key and
 * endpoint as `useVisaTypesByCountry`, so results share its cache.
 *
 * A country that fails or has no visas simply contributes nothing — it must
 * show the empty state, never an error.
 */
export function useVisasForCountries(countryCodes: string[]) {
  return useQueries({
    queries: countryCodes.map((code) => ({
      queryKey: ['visaTypes', 'country', code],
      queryFn: async () => {
        const response = await apiService.get<VisaType[]>(
          `/countries/${code}/visas`,
        );
        return response.data ?? [];
      },
      staleTime: 1000 * 60 * 5,
    })),
    combine: (results) => ({
      visas: results.flatMap((r) => r.data ?? []),
      isFetching: results.some((r) => r.isFetching),
    }),
  });
}

/**
 * Get popular visa types
 */
export function usePopularVisaTypes(limit = 10) {
  return useQuery({
    queryKey: ['visaTypes', 'popular', limit],
    queryFn: async () => {
      const response = await apiService.get<VisaType[]>(
        `/visas/popular?limit=${limit}`,
      );
      return response.data ?? [];
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Get countries with their visa counts
 */
export function useCountriesWithVisas() {
  return useQuery({
    queryKey: ['countries', 'withVisas'],
    queryFn: async () => {
      const response = await apiService.get<Country[]>('/countries');
      // Add flag URLs using fallback
      return (response.data ?? []).map((country) => ({
        ...country,
        flagUrl: country.flagUrl || getCountryFlag(country.code),
      }));
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}
