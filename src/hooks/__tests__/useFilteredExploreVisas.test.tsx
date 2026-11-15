// useFilteredExploreVisas (japa#347): a filtered Explore grid fetches the
// COMPLETE candidate set, not the pages the browse grid happened to load:
//   • a chosen country → GET /countries/:code/visas (unpaged, full list);
//   • only categories → GET /visas?category=… every page of 60 until total;
//   • no filters → no request;
//   • data only once every part is in; a failed part is an error.
// Mocked API.

jest.mock('@/services/api.service', () => ({
  apiService: { get: jest.fn() },
}));

import React from 'react';
import { act, create } from 'react-test-renderer';
import {
  describe,
  expect,
  it,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type FilteredVisasPlan,
  useFilteredExploreVisas,
} from '../useVisaTypes';
import { apiService } from '@/services/api.service';

const api = apiService as unknown as Record<
  'get',
  jest.Mock<(...a: unknown[]) => Promise<unknown>>
>;

const renderers: ReturnType<typeof create>[] = [];
function mount<T>(useHook: () => T, qc: QueryClient) {
  const ref: { current: T | null } = { current: null };
  function Probe() {
    ref.current = useHook();
    return null;
  }
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  act(() => {
    renderers.push(
      create(
        <QueryClientProvider client={qc}>
          <Probe />
        </QueryClientProvider>,
      ),
    );
  });
  return ref as { current: T };
}

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });

let qc: QueryClient;
beforeEach(() => {
  jest.resetAllMocks();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  act(() => renderers.splice(0).forEach((r) => r.unmount()));
  qc.clear();
});

describe('useFilteredExploreVisas', () => {
  it('no filters: sends nothing', async () => {
    const h = mount(() => useFilteredExploreVisas({ kind: 'none' }), qc);
    await flush();
    expect(api.get).not.toHaveBeenCalled();
    expect(h.current.data).toBeUndefined();
  });

  it('countries: every visa of each chosen country, unpaged', async () => {
    api.get.mockImplementation(async (...args: unknown[]) => {
      const url = args[0] as string;
      const code = /\/countries\/(\w+)\/visas/.exec(url)?.[1];
      return {
        success: true,
        data: [
          { id: `${code}-1`, countryCode: code },
          { id: `${code}-2`, countryCode: code },
        ],
      };
    });
    const plan: FilteredVisasPlan = { kind: 'countries', codes: ['CA', 'IE'] };
    const h = mount(() => useFilteredExploreVisas(plan), qc);
    await flush();
    expect(api.get).toHaveBeenCalledWith('/countries/CA/visas');
    expect(api.get).toHaveBeenCalledWith('/countries/IE/visas');
    expect(h.current.data?.map((v) => v.id)).toEqual([
      'CA-1',
      'CA-2',
      'IE-1',
      'IE-2',
    ]);
  });

  it('categories: pages of 60 until total (a match past page one shows)', async () => {
    // 70 work visas: two pages, 60 + 10.
    api.get.mockImplementation(async (...args: unknown[]) => {
      const url = args[0] as string;
      const offset = Number(/[?&]offset=(\d+)/.exec(url)?.[1] ?? 0);
      const all = Array.from({ length: 70 }, (_, i) => ({
        id: `w${i}`,
        countryCode: 'GB',
        category: 'work',
      }));
      return {
        success: true,
        data: { visaTypes: all.slice(offset, offset + 60), total: 70 },
      };
    });
    const plan: FilteredVisasPlan = { kind: 'categories', categories: ['work'] };
    const h = mount(() => useFilteredExploreVisas(plan), qc);
    await flush();
    expect(api.get).toHaveBeenCalledWith(
      '/visas?category=work&limit=60&offset=0',
    );
    expect(api.get).toHaveBeenCalledWith(
      '/visas?category=work&limit=60&offset=60',
    );
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(h.current.data).toHaveLength(70);
    expect(h.current.data?.some((v) => v.id === 'w65')).toBe(true);
  });

  it('a failed country is an error with no data, never a shorter grid', async () => {
    api.get.mockImplementation(async (...args: unknown[]) => {
      const url = args[0] as string;
      if (url.includes('/IE/')) throw new Error('offline');
      return { success: true, data: [{ id: 'CA-1', countryCode: 'CA' }] };
    });
    const plan: FilteredVisasPlan = { kind: 'countries', codes: ['CA', 'IE'] };
    const h = mount(() => useFilteredExploreVisas(plan), qc);
    await flush();
    expect(h.current.data).toBeUndefined();
    expect(h.current.isError).toBe(true);
    expect(h.current.isLoading).toBe(false);
  });
});
