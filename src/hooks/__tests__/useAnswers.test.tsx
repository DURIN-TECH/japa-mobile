// useAnswers / useSaveAnswer (issue #187): the calls they make against the
// contract, and that a save lands in the cached answers (mocked API, no network).

jest.mock('@/services/api.service', () => ({
  apiService: { get: jest.fn(), put: jest.fn() },
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
  answersKey,
  classifySaveError,
  useAnswers,
  useSaveAnswer,
} from '../useAnswers';
import { apiService } from '@/services/api.service';

const api = apiService as unknown as Record<
  'get' | 'put',
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

let qc: QueryClient;
beforeEach(() => {
  jest.resetAllMocks();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  act(() => renderers.splice(0).forEach((r) => r.unmount()));
});

describe('useAnswers', () => {
  it('GETs /applications/:id/answers and unwraps the answers map', async () => {
    api.get.mockResolvedValue({
      success: true,
      data: { answers: { i1: { value: 'hi', updatedAt: 't' } } },
    });
    const h = mount(() => useAnswers('app1'), qc);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(api.get).toHaveBeenCalledWith('/applications/app1/answers');
    expect(h.current.data).toEqual({ i1: { value: 'hi', updatedAt: 't' } });
  });

  it('does not fetch while disabled', async () => {
    mount(() => useAnswers('app1', false), qc);
    await act(async () => {});
    expect(api.get).not.toHaveBeenCalled();
  });
});

describe('useSaveAnswer', () => {
  it('PUTs the text and merges the saved answer into the cache; "" removes it', async () => {
    qc.setQueryData(answersKey('app1'), {
      i2: { value: 'keep', updatedAt: 't' },
    });
    const h = mount(() => useSaveAnswer('app1'), qc);
    api.put.mockResolvedValueOnce({
      success: true,
      data: { itemId: 'i1', value: 'dates', updatedAt: 'u1' },
    });
    await act(async () => {
      await h.current.mutateAsync({ itemId: 'i1', value: 'dates' });
    });
    expect(api.put).toHaveBeenCalledWith('/applications/app1/answers/i1', {
      value: 'dates',
    });
    expect(qc.getQueryData(answersKey('app1'))).toEqual({
      i2: { value: 'keep', updatedAt: 't' },
      i1: { value: 'dates', updatedAt: 'u1' },
    });
    api.put.mockResolvedValueOnce({
      success: true,
      data: { itemId: 'i1', value: '', updatedAt: 'u2' },
    });
    await act(async () => {
      await h.current.mutateAsync({ itemId: 'i1', value: '' });
    });
    expect(qc.getQueryData(answersKey('app1'))).toEqual({
      i2: { value: 'keep', updatedAt: 't' },
    });
  });

  it('leaves the cache alone when the save fails', async () => {
    qc.setQueryData(answersKey('app1'), {});
    const h = mount(() => useSaveAnswer('app1'), qc);
    api.put.mockRejectedValueOnce({ code: 'NETWORK_ERROR', status: 0 });
    await act(async () => {
      await h.current.mutateAsync({ itemId: 'i1', value: 'x' }).catch(() => {});
    });
    expect(qc.getQueryData(answersKey('app1'))).toEqual({});
  });
});

describe('classifySaveError', () => {
  it('402 UPGRADE_REQUIRED is the read-only plan; 403 is a generic failure', () => {
    expect(
      classifySaveError({ status: 402, code: 'UPGRADE_REQUIRED' }, 'a'),
    ).toBe('read_only_plan');
    expect(classifySaveError({ status: 402 }, 'a')).toBe('read_only_plan');
    expect(classifySaveError({ status: 403 }, 'a')).toBe('other');
  });
  it('409 ANSWERS_LOCKED is locked; a network error is offline', () => {
    expect(
      classifySaveError({ status: 409, code: 'ANSWERS_LOCKED' }, 'a'),
    ).toBe('locked');
    expect(classifySaveError({ status: 0, code: 'NETWORK_ERROR' }, 'a')).toBe(
      'offline',
    );
  });
});

describe('typed values and server 400s', () => {
  it('PUTs { value } as given and caches the typed value', async () => {
    qc.setQueryData(answersKey('app1'), {});
    const h = mount(() => useSaveAnswer('app1'), qc);
    api.put.mockResolvedValueOnce({
      success: true,
      data: { itemId: 'i9', updatedAt: 'u1' },
    });
    const value = { from: '2027-03-01', to: '2027-03-10' };
    await act(async () => {
      await h.current.mutateAsync({ itemId: 'i9', value });
    });
    expect(api.put).toHaveBeenCalledWith('/applications/app1/answers/i9', {
      value,
    });
    expect(qc.getQueryData(answersKey('app1'))).toEqual({
      i9: { value, updatedAt: 'u1' },
    });
  });
  it('classifies our own validation and a server 400 that names a field', () => {
    expect(
      classifySaveError({ code: 'INVALID_ANSWER', message: 'x' }, '{}'),
    ).toBe('invalid');
    expect(
      classifySaveError(
        { status: 400, message: 'address.city is required' },
        '{}',
      ),
    ).toBe('invalid');
    expect(
      classifySaveError(
        { status: 400, message: 'Unknown checklist item' },
        'a',
      ),
    ).toBe('list_changed');
  });
});
