// ─────────────────────────────────────────────────────────────────────────────
// confirmation.tsx (japa#332): the line under the paid amount.
//
// With the server's `effectiveRate` (passed on by /pay as a route param) it
// reads "$6.00 at ₦1,353.97 per $1". With no rate (a legacy record), a
// malformed one, or a free booking, the screen falls back to what it showed
// before and never throws. Renders the real screen with react-test-renderer;
// router, gradient and safe-area are stubbed.
// ─────────────────────────────────────────────────────────────────────────────

// Route params for the next render (name starts with `mock` so the
// jest.mock factory below may read it).
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import TestRenderer, { act } from 'react-test-renderer';
import ConfirmationScreen from '../confirmation';

/** Params as /pay sends them for a paid consultation ($6.00 → ₦8,123.84). */
function consultParams(extra: Record<string, string> = {}) {
  return {
    type: 'consultation',
    agentId: 'agent-1',
    dateIso: '2026-12-01',
    time: '10:00 AM',
    topic: 'Initial consultation',
    mode: 'Video call',
    dur: '30 min',
    method: 'Card',
    paidAmountMinor: '812384',
    paidCurrency: 'NGN',
    priceUsdCents: '600',
    effectiveRate: '1353.973333',
    free: '',
    ...extra,
  };
}

/** Render the screen with `params` and return all its text, joined. */
function textFor(params: Record<string, string>) {
  mockParams = params;
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<ConfirmationScreen />);
  });
  const out = tree.root
    .findAll((n) => typeof n.props.children === 'string')
    .map((n) => n.props.children as string)
    .join(' | ');
  act(() => tree.unmount());
  return out;
}

describe('confirmation.tsx rate line (japa#332)', () => {
  it('a paid consultation shows "$6.00 at ₦1,353.97 per $1"', () => {
    const t = textFor(consultParams());
    expect(t).toContain('Paid · ₦8,123.84 · Card');
    expect(t).toContain('$6.00 at ₦1,353.97 per $1');
  });

  it('a paid payment request shows the same line', () => {
    const t = textFor(
      consultParams({ type: 'application', method: 'Paystack' }),
    );
    expect(t).toContain('$6.00 at ₦1,353.97 per $1');
  });

  it('no effectiveRate (legacy record): the dollar price only, no crash', () => {
    for (const rate of ['', 'abc', '0', '-3', 'NaN']) {
      const t = textFor(consultParams({ effectiveRate: rate }));
      expect(t).toContain('Paid · ₦8,123.84 · Card');
      expect(t).toContain('$6.00 consultation price');
      expect(t).not.toContain('per $1');
    }
    // The param missing altogether (an older /pay) behaves the same.
    const older: Record<string, string> = consultParams();
    delete older.effectiveRate;
    expect(textFor(older)).toContain('$6.00 consultation price');
  });

  it('a free booking shows "Free booking" and no price or rate line', () => {
    const t = textFor(
      consultParams({
        free: '1',
        paidAmountMinor: '',
        paidCurrency: '',
        priceUsdCents: '',
        effectiveRate: '',
      }),
    );
    expect(t).toContain('Free booking');
    expect(t).not.toContain('per $1');
    expect(t).not.toContain('consultation price');
  });

  it('a USD charge shows neither a second dollar line nor a rate', () => {
    const t = textFor(
      consultParams({
        paidAmountMinor: '600',
        paidCurrency: 'USD',
        effectiveRate: '1',
      }),
    );
    expect(t).toContain('Paid · $6.00 · Card');
    expect(t).not.toContain('per $1');
  });
});
