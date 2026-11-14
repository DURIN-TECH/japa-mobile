// ─────────────────────────────────────────────────────────────────────────────
// Agent consultation fee shape (japa#183, was #148).
//
// The backend returns the fee as `consultationFeeUsd` (Money, US cents) next
// to `consultationFeeLocal` (the server's local quote). Neither display mapper
// may convert or scale: both objects are carried through unchanged, and the
// screen formats them with `priceParts`.
// ─────────────────────────────────────────────────────────────────────────────

// The hook module imports the API/analytics services (Firebase); the pure
// mappers under test don't use them, so stub them.
jest.mock('@/services/api.service', () => ({ apiService: {} }));
jest.mock('@/services/analytics.service', () => ({ analyticsService: {} }));

import { describe, expect, it, jest } from '@jest/globals';
import { formatAgentForDisplay, type ApiAgent } from '../useAgents';
import { mapAgent } from '@/components/explorer/liveAgents';
import { priceInline, priceParts } from '@/components/explorer/content';

const USD = { amountMinor: 3500, currency: 'USD' };
const LOCAL = {
  amountMinor: 4_738_940,
  currency: 'NGN',
  rate: 1353.97,
  asOf: '2026-11-13T00:00:00Z',
  available: true,
};

// Minimal agent as the backend returns it ($35 fee, ₦47,389.40 local).
const agent = (over: Partial<ApiAgent> = {}): ApiAgent =>
  ({
    id: 'agent-1',
    displayName: 'Ada Obi',
    rating: 4.8,
    totalReviews: 12,
    totalApplications: 30,
    successRate: 90,
    responseTime: '2-4 hours',
    consultationFeeUsd: USD,
    consultationFeeLocal: LOCAL,
    isAvailable: true,
    specializations: ['Study Visa'],
    languages: ['English'],
    featuredVisas: [],
    yearsOfExperience: 5,
    ...over,
  }) as unknown as ApiAgent;

describe('agent consultation fee carries the server objects, unconverted', () => {
  it('formatAgentForDisplay passes both objects through', () => {
    const out = formatAgentForDisplay(agent());
    expect(out.consultationFeeUsd).toEqual(USD);
    expect(out.consultationFeeLocal).toEqual(LOCAL);
  });

  it('mapAgent carries both, and a missing fee is null (Free)', () => {
    const a = mapAgent(agent());
    expect(a.feeUsd).toEqual(USD);
    expect(a.feeLocal).toEqual(LOCAL);
    expect(priceInline(priceParts(a.feeLocal, a.feeUsd))).toBe(
      '₦47,389 · about $35',
    );

    const free = mapAgent(
      agent({ consultationFeeUsd: null, consultationFeeLocal: null }),
    );
    expect(free.feeUsd).toBeNull();
    expect(priceParts(free.feeLocal, free.feeUsd, { freeWhenNoUsd: true }).primary).toBe(
      'Free',
    );
  });

  it('an unavailable local quote shows the dollar price only', () => {
    const a = mapAgent(
      agent({
        consultationFeeLocal: {
          amountMinor: null,
          currency: 'NGN',
          rate: null,
          asOf: null,
          available: false,
        },
      }),
    );
    const p = priceParts(a.feeLocal, a.feeUsd, { freeWhenNoUsd: true });
    expect(p.primary).toBe('$35.00');
    expect(p.localUnavailable).toBe(true);
  });
});
