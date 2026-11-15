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

// ── The real seeded plans (japa#334 review) ─────────────────────────────────
// Copied from seli-backend `functions/src/scripts/seed-plans.ts` (origin/dev):
// Free = the backend's whole authz catalogue minus the paid-only
// `ai.case_officer`; each paid client plan lists its keys by hand. Yearly
// variants copy their monthly plan's features, so they are covered too.
// The backend catalogue is this app's FEATURE_KEYS plus `ai.case_officer`.
describe('mapPlan, seeded client plans, flag on', () => {
  const AI = 'ai.case_officer';
  const backendCatalogue = [...FEATURE_KEYS, AI] as string[];
  const seeded = (id: string, priceKobo: number, features: string[]) =>
    ({ ...PLAN, id, name: id, priceKobo, features }) as unknown as PlanDTO;
  const FREE = seeded(
    'client_free',
    0,
    backendCatalogue.filter((k) => k !== AI),
  );
  const PAID = [
    seeded('client_standard', 100000, [
      'applications.create',
      'documents.upload',
      'messaging',
      'news.alerts',
      AI,
    ]),
    seeded('client_pro', 250000, [
      'applications.create',
      'documents.upload',
      'messaging',
      'consultations.book',
      'news.alerts',
      'priority_support',
      AI,
    ]),
  ];
  const on = (p: PlanDTO) =>
    mapPlan(p, undefined, { selfServiceOnly: true }).features;
  const AGENT_ONLY = [
    'Agent messaging',
    'Book consultations',
    'Invite agents',
    'Payment requests',
    'Bulk applications',
    'Analytics dashboard',
  ];

  it('every paid plan lists the AI review', () => {
    for (const p of PAID) expect(on(p)).toContain('Full AI review');
  });

  it('no paid plan is a subset of Free', () => {
    const free = new Set(on(FREE));
    for (const p of PAID) {
      expect(on(p).some((label) => !free.has(label))).toBe(true);
    }
  });

  it('no plan lists an agent-only feature', () => {
    for (const p of [FREE, ...PAID]) {
      for (const label of AGENT_ONLY) expect(on(p)).not.toContain(label);
    }
  });

  it('no seeded key falls back to an auto-generated label', () => {
    // A title-cased fallback ("Ai Case Officer") means a missing label.
    const known = new Set([
      'Create applications',
      'Document uploads',
      'Self-service flow',
      'Priority support',
      'Visa news alerts',
      'Full AI review',
    ]);
    for (const p of [FREE, ...PAID]) {
      for (const label of on(p)) expect(known).toContain(label);
    }
  });

  it('flag off: the AI review reads "Full AI review", the rest as before', () => {
    expect(mapPlan(PAID[0]).features).toEqual([
      'Create applications',
      'Document uploads',
      'Agent messaging',
      'Visa news alerts',
      'Full AI review',
    ]);
  });
});
