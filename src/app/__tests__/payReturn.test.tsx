// ─────────────────────────────────────────────────────────────────────────────
// pay.tsx, payment-request path (japa#252): checkout opens in the in-app auth
// browser and the screen goes to /confirmation ONLY when the backend verify
// says `paid`. Renders the real screen with react-test-renderer (no
// simulator); router, blur, safe-area, the auth browser and the verify hook
// are stubbed so only the screen's own logic runs.
// ─────────────────────────────────────────────────────────────────────────────

// ── Stubs (names start with `mock` so jest.mock factories may use them) ──────
const mockPush = jest.fn();
const mockVerify = jest.fn<(input: unknown) => Promise<unknown>>();
const mockOpenAuth =
  jest.fn<
    (url: string, redirect: string) => Promise<{ type: string; url?: string }>
  >();
// Route params; `autoOpen: '1'` = arriving straight from approve.
let mockParams: Record<string, string> = {};

jest.mock('react-native-reanimated', () =>
  jest.requireActual('react-native-reanimated/mock'),
);
jest.mock('react-native-worklets', () =>
  jest.requireActual('react-native-worklets/lib/module/mock'),
);
jest.mock('expo-blur', () => ({
  BlurView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: (url: string, redirect: string) =>
    mockOpenAuth(url, redirect),
  maybeCompleteAuthSession: jest.fn(),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/hooks/usePaymentRequests', () => ({
  useVerifyPaymentRequest: () => ({
    mutateAsync: mockVerify,
    isPending: false,
  }),
}));
jest.mock('@/hooks/useConsultations', () => ({
  useCreateConsultation: () => ({ mutateAsync: jest.fn() }),
}));

import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import TestRenderer, { act } from 'react-test-renderer';
import PayScreen from '../pay';
import {
  NOT_PAID_MESSAGE,
  PAYMENT_ERROR_MESSAGE,
} from '@/hooks/paymentRequestFlow';

const CHECKOUT = 'https://checkout.paystack.com/abc';

/** Params as application/[id] sends them right after approve. */
function appParams(extra: Record<string, string> = {}) {
  return {
    type: 'application',
    requestId: 'pr1',
    reference: 'ref_own',
    authorizationUrl: CHECKOUT,
    agentId: 'agent-1',
    dateIso: '',
    time: '',
    topic: 'Visa processing fee',
    mode: '',
    dur: '',
    fee: '2500',
    ...extra,
  };
}

/** Mount the screen and let the auto-open + verify settle. */
async function render() {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<PayScreen />);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return tree;
}

/** All rendered text, joined (to look for an InlineError message). */
function text(tree: TestRenderer.ReactTestRenderer) {
  return tree.root
    .findAll((n) => typeof n.props.children === 'string')
    .map((n) => n.props.children as string)
    .join(' | ');
}

beforeEach(() => {
  mockPush.mockReset();
  mockVerify.mockReset();
  mockOpenAuth.mockReset();
  mockParams = appParams({ autoOpen: '1' });
});

describe('pay.tsx return to app', () => {
  it('opens checkout in the auth browser with the app return URL (autoOpen)', async () => {
    mockOpenAuth.mockResolvedValue({ type: 'success' });
    mockVerify.mockResolvedValue({ status: 'paid' });
    await render();
    expect(mockOpenAuth).toHaveBeenCalledTimes(1);
    expect(mockOpenAuth).toHaveBeenCalledWith(
      CHECKOUT,
      'durintech://payment-return',
    );
  });

  it('success redirect + verify paid → confirmation, verifying OUR reference', async () => {
    // The deep link carries a different (forged) reference: it is ignored.
    mockOpenAuth.mockResolvedValue({
      type: 'success',
      url: 'durintech://payment-return?reference=forged',
    });
    mockVerify.mockResolvedValue({ status: 'paid' });
    await render();
    expect(mockVerify).toHaveBeenCalledWith({
      requestId: 'pr1',
      reference: 'ref_own',
    });
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect((mockPush.mock.calls[0][0] as { pathname: string }).pathname).toBe(
      '/confirmation',
    );
  });

  it('success redirect but verify not paid → stays, NOT_PAID_MESSAGE', async () => {
    mockOpenAuth.mockResolvedValue({ type: 'success' });
    mockVerify.mockResolvedValue({
      status: 'approved',
      paymentStatus: 'abandoned',
    });
    const tree = await render();
    expect(mockPush).not.toHaveBeenCalled();
    expect(text(tree)).toContain(NOT_PAID_MESSAGE);
    expect(text(tree)).toContain('Open checkout');
  });

  it('user cancels → verifies once, stays with Open checkout, no confirmation', async () => {
    mockOpenAuth.mockResolvedValue({ type: 'cancel' });
    mockVerify.mockResolvedValue({ status: 'approved' });
    const tree = await render();
    expect(mockVerify).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
    expect(text(tree)).toContain(NOT_PAID_MESSAGE);
    expect(text(tree)).toContain('Open checkout');
  });

  it('verify call fails → PAYMENT_ERROR_MESSAGE, never a confirmation', async () => {
    mockOpenAuth.mockResolvedValue({ type: 'success' });
    mockVerify.mockRejectedValue({ status: 500 });
    const tree = await render();
    expect(mockPush).not.toHaveBeenCalled();
    expect(text(tree)).toContain(PAYMENT_ERROR_MESSAGE);
  });

  it('without autoOpen the checkout is not opened on arrival', async () => {
    mockParams = appParams();
    await render();
    expect(mockOpenAuth).not.toHaveBeenCalled();
  });
});
