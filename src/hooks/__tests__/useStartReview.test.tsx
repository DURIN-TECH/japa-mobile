// useStartReview outcome mapping (japa#309): a 422 NOT_ENOUGH_TO_REVIEW is its
// own outcome carrying the backend's "still needed" parts, never a generic
// error and never the upgrade path. Mocked API, no network.

jest.mock('@/services/api.service', () => ({
  apiService: { post: jest.fn() },
}));
jest.mock('@/services/analytics.service', () => ({
  analyticsService: { trackReviewEvent: jest.fn() },
}));

import React from 'react';
import { act, create } from 'react-test-renderer';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStartReview, isNotEnoughToReview } from '../useCaseOfficer';
import { apiService } from '@/services/api.service';

const post = (
  apiService as unknown as {
    post: jest.Mock<(...a: unknown[]) => Promise<unknown>>;
  }
).post;

const renderers: ReturnType<typeof create>[] = [];
const clients: QueryClient[] = [];
function mount() {
  const ref: { current: ReturnType<typeof useStartReview> | null } = {
    current: null,
  };
  function Probe() {
    ref.current = useStartReview('app-1');
    return null;
  }
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Infinity } },
  });
  clients.push(qc);
  act(() => {
    renderers.push(
      create(
        <QueryClientProvider client={qc}>
          <Probe />
        </QueryClientProvider>,
      ),
    );
  });
  return ref as { current: ReturnType<typeof useStartReview> };
}

// What api.service rejects with for the backend's 422 (body kept whole).
const body = {
  success: false,
  error: 'NOT_ENOUGH_TO_REVIEW',
  message: 'Your application needs a little more before it can be reviewed.',
  missing: ['intake', 'documents'],
  openRequiredCount: 2,
};
const NOT_ENOUGH = {
  status: 422,
  code: 'NOT_ENOUGH_TO_REVIEW',
  message: body.message,
  body,
};

beforeEach(() => {
  post.mockReset();
});
afterEach(() => {
  renderers.splice(0).forEach((r) => act(() => r.unmount()));
  clients.splice(0).forEach((c) => c.clear());
});

describe('useStartReview 422 NOT_ENOUGH_TO_REVIEW', () => {
  it('maps to not_enough with the parts from the body', async () => {
    post.mockRejectedValueOnce(NOT_ENOUGH);
    const h = mount();
    let out: string | undefined;
    await act(async () => {
      out = await h.current.start('cta');
    });
    expect(out).toBe('not_enough');
    expect(h.current.notEnough).toEqual({
      missing: ['intake', 'documents'],
      openRequiredCount: 2,
    });
  });

  it('a body with nothing usable still maps to not_enough, without parts', async () => {
    post.mockRejectedValueOnce({ ...NOT_ENOUGH, body: { error: 'x' } });
    const h = mount();
    let out: string | undefined;
    await act(async () => {
      out = await h.current.start('cta');
    });
    expect(out).toBe('not_enough');
    expect(h.current.notEnough).toBeNull();
  });

  it('a later start clears the parts, and other answers are unchanged', async () => {
    post.mockRejectedValueOnce(NOT_ENOUGH);
    const h = mount();
    await act(async () => {
      await h.current.start('cta');
    });
    post.mockRejectedValueOnce({
      status: 402,
      code: 'UPGRADE_REQUIRED',
      message: 'x',
    });
    let out: string | undefined;
    await act(async () => {
      out = await h.current.start('cta');
    });
    expect(out).toBe('upgrade');
    expect(h.current.notEnough).toBeNull();

    post.mockRejectedValueOnce({ status: 422, code: 'OTHER', message: 'x' });
    await act(async () => {
      out = await h.current.start('cta');
    });
    expect(out).toBe('error');

    post.mockResolvedValueOnce({ success: true, data: {} });
    await act(async () => {
      out = await h.current.start('cta');
    });
    expect(out).toBe('started');
  });

  it('isNotEnoughToReview needs both the status and the code', () => {
    expect(isNotEnoughToReview(NOT_ENOUGH)).toBe(true);
    expect(isNotEnoughToReview({ ...NOT_ENOUGH, status: 400 })).toBe(false);
    expect(isNotEnoughToReview({ status: 422, code: 'X', message: '' })).toBe(
      false,
    );
    expect(isNotEnoughToReview(new Error('x'))).toBe(false);
  });
});
