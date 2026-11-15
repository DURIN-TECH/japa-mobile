import { useCallback, useState } from 'react';
import {
  type InfiniteData,
  useInfiniteQuery,
  useQuery,
  useQueries,
  useQueryClient,
} from '@tanstack/react-query';
import { retryUnlessNotFound } from './queryErrors';
import { EXPLORE_PAGE_SIZE, nextVisaOffset } from './visaPaging';
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

// ── Explore grid: paged browse list (japa#341) ───────────────────────────────

/** Query key of the paged Explore list (own key: never shares the plain one). */
export const EXPLORE_VISAS_KEY = ['visaTypes', 'explorePaged'] as const;

/**
 * GET one Explore page. Normalised so a response without `visaTypes` or
 * `total` can never crash the paging rule (review of japa#341): a missing list
 * is an empty page, which ends paging.
 */
async function fetchExplorePage(offset: number): Promise<GetAllVisasResponse> {
  const endpoint = `/visas?limit=${EXPLORE_PAGE_SIZE}&offset=${offset}`;
  const response = await apiService.get<GetAllVisasResponse>(endpoint);
  return {
    visaTypes: response.data?.visaTypes ?? [],
    total: response.data?.total ?? 0,
  };
}

/**
 * Every active, visible visa for the Explore grid, fetched in pages of
 * `EXPLORE_PAGE_SIZE` (60) with `limit` + `offset` until `total` is reached.
 *
 * A separate hook rather than a mode of `useVisaTypes`, so Home's
 * `useVisaTypes({ limit: 30 })` keeps its exact behaviour and cache entry.
 *
 * Returns the TanStack infinite query plus:
 *
 * • `loadNextPage()`: the ONLY way the screen should ask for the next page.
 *   Two guards against requesting the same offset twice (review of japa#341):
 *     1. it reads the query's LIVE fetch status from the cache, not the
 *        `isFetching` captured at render time, so several callers firing
 *        from one render (scroll, content-size, effect) cannot slip through;
 *     2. it passes `cancelRefetch: false`. TanStack's default (`true`) makes
 *        a second call cancel the fetch in flight and start it again
 *        (query-core `queryObserver.fetch` → `query.fetch`); the cancelled
 *        request still runs on the server, since `apiService` gets no abort
 *        signal. With `false`, a second call just joins the one in flight.
 *   It also backs the footer's "Try again": after a failure the status is
 *   idle again, so the retry goes through and re-requests that offset only.
 *
 * • `refreshFromFirstPage()` + `isRefreshing`: pull-to-refresh starts over
 *   (criterion: "reloads from the first page and drops the later pages"). A
 *   plain `refetch()` would re-fetch EVERY loaded page. So we fetch page one
 *   on its own and only on SUCCESS replace the cache with it; if the refresh
 *   fails (offline), every loaded page stays as it was. Any next-page fetch
 *   in flight is cancelled first, so it cannot append to the old pages after
 *   we replace them.
 */
export function useExploreVisaPages() {
  const queryClient = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: EXPLORE_VISAS_KEY,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchExplorePage(pageParam),
    // The stop / next-offset rule lives in a pure, tested helper.
    getNextPageParam: (_last, allPages) => nextVisaOffset(allPages),
    staleTime: 1000 * 60 * 5, // 5 minutes, as the plain list
  });
  // `refetch` / `fetchNextPage` are stable; the whole `query` object is not.
  const { refetch, fetchNextPage } = query;
  const [isRefreshing, setRefreshing] = useState(false);

  const loadNextPage = useCallback(() => {
    const live = queryClient.getQueryState(EXPLORE_VISAS_KEY);
    if (live?.fetchStatus === 'fetching') return;
    fetchNextPage({ cancelRefetch: false });
  }, [queryClient, fetchNextPage]);

  const refreshFromFirstPage = useCallback(async () => {
    const cached = queryClient.getQueryData(EXPLORE_VISAS_KEY);
    // Nothing loaded yet (first page failed / pending): an ordinary refetch
    // IS a first-page load.
    if (!cached) {
      await refetch();
      return;
    }
    setRefreshing(true);
    try {
      const first = await fetchExplorePage(0);
      await queryClient.cancelQueries({ queryKey: EXPLORE_VISAS_KEY });
      queryClient.setQueryData<InfiniteData<GetAllVisasResponse, number>>(
        EXPLORE_VISAS_KEY,
        { pages: [first], pageParams: [0] },
      );
    } catch {
      // Silent, as any background refetch with cached rows: keep them all.
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, refetch]);

  return { ...query, loadNextPage, refreshFromFirstPage, isRefreshing };
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
