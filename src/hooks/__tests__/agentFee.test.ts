// ─────────────────────────────────────────────────────────────────────────────
// Agent consultation fee units (issue #148).
//
// The backend stores `Agent.consultationFee` in WHOLE NAIRA, so neither display
// mapper may scale it. These tests pin that: a stored 5000 shows as 5000 (₦5,000),
// never 50 (÷100) and never 500000 (×100).
// ─────────────────────────────────────────────────────────────────────────────

// The hook module imports the API/analytics services (Firebase); the pure
// mappers under test don't use them, so stub them.
jest.mock('@/services/api.service', () => ({ apiService: {} }));
jest.mock('@/services/analytics.service', () => ({ analyticsService: {} }));

import { describe, expect, it, jest } from '@jest/globals';
import { formatAgentForDisplay, type ApiAgent } from '../useAgents';
import { mapAgent } from '@/components/explorer/liveAgents';

// Minimal agent as the backend returns it (seed agent: ₦5,000).
const agent = (consultationFee: number): ApiAgent =>
  ({
    id: 'agent-1',
    displayName: 'Ada Obi',
    rating: 4.8,
    totalReviews: 12,
    totalApplications: 30,
    successRate: 90,
    responseTime: '2-4 hours',
    consultationFee,
    isAvailable: true,
    specializations: ['Study Visa'],
    languages: ['English'],
    featuredVisas: [],
    yearsOfExperience: 5,
  }) as unknown as ApiAgent;

describe('agent consultation fee is whole naira, unscaled', () => {
  it('formatAgentForDisplay returns the fee (and price) equal to the input', () => {
    const out = formatAgentForDisplay(agent(5000));
    expect(out.consultationFee).toBe(5000);
    expect(out.price).toBe(5000);
  });

  it('mapAgent (Explorer adapter) uses the fee as-is and defaults a missing fee to 0', () => {
    expect(mapAgent(agent(2500)).fee).toBe(2500);
    expect(
      mapAgent({
        ...agent(0),
        consultationFee: undefined,
      } as unknown as ApiAgent).fee,
    ).toBe(0);
  });
});
