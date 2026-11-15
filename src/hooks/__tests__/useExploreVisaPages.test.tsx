// useExploreVisaPages (japa#341): the Explore grid's paged GET /visas calls —
// page one is limit=60&offset=0, the next page starts at the count loaded,
// paging stops at total, and pull-to-refresh drops the later pages. Also that
// the plain useVisaTypes({ limit: 30 }) Home call is unchanged. Mocked API.

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
import { useExploreVisaPages, useVisaTypes } from '../useVisaTypes';
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

/** Fake GET /visas: `total` visas, sliced by the request's limit/offset. */
function serveVisas(total: number) {
  api.get.mockImplementation(async (...args: unknown[]) => {
    // Parse by hand: React Native's URL polyfill has no `searchParams`.
    const url = args[0] as string;
    const param = (k: string, dflt: number) =>
      Number(new RegExp(`[?&]${k}=(\\d+)`).exec(url)?.[1] ?? dflt);
    const limit = param('limit', 20);
    const offset = param('offset', 0);
    const all = Array.from({ length: total }, (_, i) => ({
      id: `v${i}`,
      countryCode: 'GB',
    }));
    return {
      success: true,
      data: { visaTypes: all.slice(offset, offset + limit), total },
    };
  });
}

// Let the query resolve and the probe re-render (same settle as useAnswers).
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
  // Drop the cache so no garbage-collection timer keeps Jest alive.
  qc.clear();
});

describe('useExploreVisaPages', () => {
  it('pages limit=60 from offset 0, then 60, and stops at total', async () => {
    serveVisas(68);
    const h = mount(() => useExploreVisaPages(), qc);
    await flush();
    expect(api.get).toHaveBeenLastCalledWith('/visas?limit=60&offset=0');
    expect(h.current.hasNextPage).toBe(true);

    await act(async () => {
      await h.current.fetchNextPage();
    });
    await flush();
    expect(api.get).toHaveBeenLastCalledWith('/visas?limit=60&offset=60');
    const pages = h.current.data!.pages;
    expect(pages.flatMap((p) => p.visaTypes)).toHaveLength(68);
    // All 68 loaded: no next page, so no further request is sent.
    expect(h.current.hasNextPage).toBe(false);
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('pull-to-refresh reloads page one only and drops later pages', async () => {
    serveVisas(68);
    const h = mount(() => useExploreVisaPages(), qc);
    await flush();
    await act(async () => {
      await h.current.fetchNextPage();
    });
    await flush();
    api.get.mockClear();

    await act(async () => {
      await h.current.refreshFromFirstPage();
    });
    await flush();
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith('/visas?limit=60&offset=0');
    expect(h.current.data!.pages).toHaveLength(1);
    // Scrolling can load page two again.
    expect(h.current.hasNextPage).toBe(true);
  });

  it('a failed next page keeps page one and retries that page only', async () => {
    serveVisas(68);
    const h = mount(() => useExploreVisaPages(), qc);
    await flush();
    api.get.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      await h.current.fetchNextPage();
    });
    await flush();
    expect(h.current.isFetchNextPageError).toBe(true);
    expect(h.current.data!.pages).toHaveLength(1);

    api.get.mockClear();
    await act(async () => {
      await h.current.fetchNextPage();
    });
    await flush();
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith('/visas?limit=60&offset=60');
    expect(h.current.data!.pages).toHaveLength(2);
  });
});

describe('useVisaTypes (Home, unchanged)', () => {
  it('still makes one plain GET /visas?limit=30', async () => {
    serveVisas(68);
    const h = mount(() => useVisaTypes({ limit: 30 }), qc);
    await flush();
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith('/visas?limit=30');
    expect(h.current.data!.visaTypes).toHaveLength(30);
  });
});
