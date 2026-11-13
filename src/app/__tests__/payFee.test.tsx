// ─────────────────────────────────────────────────────────────────────────────
// pay.tsx sends the agent's fee UNSCALED (issue #148): whole naira in, whole
// naira in the POST /consultations body (no `* 100`). Renders the real screen
// with react-test-renderer (no simulator); the router, blur view, safe-area and
// the mutation hook are stubbed so only the screen's own logic runs.
// ─────────────────────────────────────────────────────────────────────────────
const mockMutateAsync = jest.fn<(input: unknown) => Promise<object>>(
  async () => ({}),
);

// The explorer primitives import reanimated, whose native worklets part does
// not exist under Jest: use the library's own JS mock (japa#174).
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);
jest.mock('react-native-worklets', () =>
  require('react-native-worklets/lib/module/mock'),
);
jest.mock('expo-blur', () => ({
  BlurView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({
    agentId: 'agent-1',
    dateIso: '2026-12-01',
    time: '10:00 AM',
    topic: 'Initial consultation',
    mode: 'Video call',
    dur: '30 min',
    fee: '5000',
  }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
// pay.tsx also verifies Paystack returns; stub that hook so the Firebase-backed
// api client is never loaded under Jest.
jest.mock('@/hooks/usePaymentRequests', () => ({
  useVerifyPaymentRequest: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('@/hooks/useConsultations', () => ({
  useCreateConsultation: () => ({ mutateAsync: mockMutateAsync }),
}));

import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import TestRenderer, { act } from 'react-test-renderer';
import PayScreen from '../pay';

describe('pay.tsx booking payload', () => {
  it('sends fee 5000 (naira, unscaled) for a ₦5,000 agent', async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<PayScreen />);
    });

    // Choose a payment method (enables the CTA): the first pressable that is
    // not the back button / CTA is a method row; press them in order until the
    // CTA is enabled.
    const pressables = () =>
      tree.root.findAll(
        (n) =>
          typeof n.type !== 'string' && typeof n.props.onPress === 'function',
      );
    const cta = () => pressables()[pressables().length - 1];
    for (const p of pressables().slice(1, -1)) {
      if (!cta().props.disabled) break;
      await act(async () => {
        p.props.onPress?.();
      });
    }
    expect(cta().props.disabled).toBeFalsy();

    await act(async () => {
      await cta().props.onPress();
    });

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    const sent = mockMutateAsync.mock.calls[0][0] as { fee: number };
    expect(sent.fee).toBe(5000);
  });
});
