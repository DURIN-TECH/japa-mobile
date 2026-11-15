// ─────────────────────────────────────────────────────────────────────────────
// mapPlan in a self-service-only build (japa#334): agent messaging and
// consultation booking are left off the plan's feature list; nothing else
// about the plan changes. Flag off: every feature, as before.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from '@jest/globals';
import { FEATURE_KEYS } from '@durin-tech/authz';
import { mapPlan } from '../liveSubscription';
import type { PlanDTO } from '@/hooks/useSubscription';

const PLAN: PlanDTO = {
  id: 'plus',
  name: 'Seli Plus',
  audience: 'client' as PlanDTO['audience'],
  priceKobo: 500000,
  interval: 'month' as PlanDTO['interval'],
  features: [
    'applications.create',
    'messaging',
    'consultations.book',
    'documents.upload',
    'self_service',
    'priority_support',
  ],
};

describe('mapPlan', () => {
  it('flag off (default): every feature, in order', () => {
    const expected = [
      'Create applications',
      'Agent messaging',
      'Book consultations',
      'Document uploads',
      'Self-service flow',
      'Priority support',
    ];
    expect(mapPlan(PLAN, 'plus').features).toEqual(expected);
    expect(mapPlan(PLAN, 'plus', { selfServiceOnly: false }).features).toEqual(
      expected,
    );
  });

  it('flag on: no agent messaging or consultation booking', () => {
    expect(mapPlan(PLAN, 'plus', { selfServiceOnly: true }).features).toEqual([
      'Create applications',
      'Document uploads',
      'Self-service flow',
      'Priority support',
    ]);
  });

  it('flag on: the plan itself (name, price, interval, tag) is unchanged', () => {
    const on = mapPlan(PLAN, 'plus', { selfServiceOnly: true });
    const off = mapPlan(PLAN, 'plus');
    expect({ ...on, features: [] }).toEqual({ ...off, features: [] });
    expect(on.price).toBe(5000);
    expect(on.tag).toBe('Most popular');
  });
});

// QA round 1 (japa#334): the Free plan still listed "Invite agents" and
// "Payment requests". Flag on, no agent / agency feature in the whole
// authz catalogue reaches a plan card.
describe('mapPlan, every catalogue feature', () => {
  const ALL: PlanDTO = { ...PLAN, id: 'free', features: [...FEATURE_KEYS] };

  it('flag on: only the self-service features, in catalogue order', () => {
    expect(mapPlan(ALL, undefined, { selfServiceOnly: true }).features).toEqual(
      [
        'Create applications',
        'Document uploads',
        'Self-service flow',
        'Priority support',
        'Visa news alerts',
      ],
    );
  });

  it('flag on: none of the agent-side labels', () => {
    const labels = mapPlan(ALL, undefined, { selfServiceOnly: true }).features;
    for (const hidden of [
      'Agent messaging',
      'Book consultations',
      'Invite agents',
      'Payment requests',
      'Bulk applications',
      'Analytics dashboard',
    ]) {
      expect(labels).not.toContain(hidden);
    }
  });

  it('flag on: a key the catalogue adds later stays off the card', () => {
    const future = {
      ...PLAN,
      features: ['agents.new_thing'],
    } as unknown as PlanDTO;
    expect(
      mapPlan(future, undefined, { selfServiceOnly: true }).features,
    ).toEqual([]);
  });

  it('flag off: every catalogue feature, as before', () => {
    expect(mapPlan(ALL).features).toHaveLength(FEATURE_KEYS.length);
  });
});
