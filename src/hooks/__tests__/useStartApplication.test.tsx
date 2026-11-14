// useStartApplication duplicate flow (japa#253): 409 -> prompt state, continue
// opens the existing application, start-anyway re-sends with confirmNew.
// Mocked API + router, no network.

jest.mock('@/services/api.service', () => ({
  apiService: { post: jest.fn() },
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
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
import { useStartApplication } from '../useStartApplication';
import { apiService } from '@/services/api.service';

const post = (
  apiService as unknown as {
    post: jest.Mock<(...a: unknown[]) => Promise<unknown>>;
  }
).post;

const renderers: ReturnType<typeof create>[] = [];
function mount() {
  const ref: { current: ReturnType<typeof useStartApplication> | null } = {
    current: null,
  };
  function Probe() {
    ref.current = useStartApplication('visa-1', 'gb');
    return null;
  }
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  act(() => {
    renderers.push(
      create(
        <QueryClientProvider client={qc}>
          <Probe />
        </QueryClientProvider>,
      ),
    );
  });
  return ref as { current: ReturnType<typeof useStartApplication> };
}

const DUP_ERROR = {
  status: 409,
  code: 'DUPLICATE_ACTIVE_APPLICATION',
  message: 'dup',
  data: { existingApplication: { id: 'existing-1' } },
};

beforeEach(() => {
  post.mockReset();
  mockPush.mockReset();
});
afterEach(() => {
  renderers.splice(0).forEach((r) => act(() => r.unmount()));
});

describe('useStartApplication duplicate flow', () => {
  it('a 409 sets `duplicate` (not a failure) and navigates nowhere', async () => {
    post.mockRejectedValueOnce(DUP_ERROR);
    const h = mount();
    await act(async () => {
      await h.current.start();
    });
    expect(h.current.duplicate?.id).toBe('existing-1');
    expect(h.current.failure).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
    // The first request carried no confirmNew.
    expect(post.mock.calls[0][1]).toEqual({
      visaTypeId: 'visa-1',
      countryCode: 'GB',
      mode: 'self',
    });
  });

  it('continueExisting opens the existing application and closes the prompt', async () => {
    post.mockRejectedValueOnce(DUP_ERROR);
    const h = mount();
    await act(async () => {
      await h.current.start();
    });
    act(() => h.current.continueExisting());
    expect(mockPush).toHaveBeenCalledWith('/application/existing-1');
    expect(h.current.duplicate).toBeNull();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('startAnyway re-sends with confirmNew: true and opens the new application', async () => {
    post.mockRejectedValueOnce(DUP_ERROR);
    post.mockResolvedValueOnce({ data: { id: 'new-1' } });
    const h = mount();
    await act(async () => {
      await h.current.start();
    });
    await act(async () => {
      await h.current.startAnyway();
    });
    expect(post.mock.calls[1][1]).toMatchObject({ confirmNew: true });
    expect(mockPush).toHaveBeenCalledWith('/self-service/new-1');
    expect(h.current.duplicate).toBeNull();
  });

  it('dismissDuplicate creates nothing', async () => {
    post.mockRejectedValueOnce(DUP_ERROR);
    const h = mount();
    await act(async () => {
      await h.current.start();
    });
    act(() => h.current.dismissDuplicate());
    expect(h.current.duplicate).toBeNull();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('other errors still classify as before (402 -> upgrade)', async () => {
    post.mockRejectedValueOnce({
      status: 402,
      code: 'PAYMENT_REQUIRED',
      message: '',
    });
    const h = mount();
    await act(async () => {
      await h.current.start();
    });
    expect(h.current.failure).toBe('upgrade');
    expect(h.current.duplicate).toBeNull();
  });
});
