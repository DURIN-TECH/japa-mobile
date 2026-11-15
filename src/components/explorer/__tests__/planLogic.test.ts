// ─────────────────────────────────────────────────────────────────────────────
// planLogic (japa#346): the current plan Profile and Settings both name, and
// the Profile upgrade banner (shown / hidden, title, benefit line). Fixtures
// mirror the backend seed (seli-backend scripts/seed-plans.ts), yearly
// variants included.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from '@jest/globals';
import {
  joinLabels,
  resolveCurrentPlan,
  upgradeBanner,
  upgradeTarget,
} from '../planLogic';
import type { MySubscription, PlanDTO } from '@/hooks/useSubscription';

// ── Fixtures ────────────────────────────────────────────────────────────────
function plan(p: Partial<PlanDTO> & Pick<PlanDTO, 'id'>): PlanDTO {
  return {
    name: p.id,
    audience: 'client',
    priceKobo: 0,
    interval: 'month',
    features: [],
    ...p,
  } as PlanDTO;
}

// The free plan grants every catalogue feature except the paid AI review.
const FREE = plan({
  id: 'client_free',
  name: 'Client Free',
  interval: 'none' as PlanDTO['interval'],
  features: [
    'applications.create',
    'applications.bulk',
    'messaging',
    'consultations.book',
    'documents.upload',
    'self_service',
    'priority_support',
    'news.alerts',
  ] as PlanDTO['features'],
});
const STANDARD = plan({
  id: 'client_standard',
  name: 'Client Standard',
  priceKobo: 100000,
  billingGroup: 'client_standard',
  features: [
    'applications.create',
    'documents.upload',
    'messaging',
    'news.alerts',
    'ai.case_officer',
  ] as PlanDTO['features'],
});
const PRO = plan({
  id: 'client_pro',
  name: 'Client Pro',
  priceKobo: 250000,
  billingGroup: 'client_pro',
  features: [
    'applications.create',
    'documents.upload',
    'messaging',
    'consultations.book',
    'news.alerts',
    'priority_support',
    'ai.case_officer',
  ] as PlanDTO['features'],
});
const STANDARD_YEARLY = plan({
  ...STANDARD,
  id: 'client_standard_yearly',
  name: 'Client Standard (Yearly)',
  priceKobo: 1080000,
  interval: 'year' as PlanDTO['interval'],
});
const PRO_YEARLY = plan({
  ...PRO,
  id: 'client_pro_yearly',
  name: 'Client Pro (Yearly)',
  priceKobo: 2700000,
  interval: 'year' as PlanDTO['interval'],
});
// The order GET /plans returns (priceKobo ascending).
const PLANS = [FREE, STANDARD, PRO, STANDARD_YEARLY, PRO_YEARLY];

function subscribedTo(planId: string | null): MySubscription {
  return {
    subscription: planId
      ? ({ planId } as unknown as MySubscription['subscription'])
      : null,
    entitlements: null,
  };
}

// ── Current plan (shared by Profile + Settings) ─────────────────────────────
describe('resolveCurrentPlan', () => {
  it('a subscription → its plan', () => {
    expect(resolveCurrentPlan(subscribedTo('client_pro'), PLANS)?.name).toBe(
      'Client Pro',
    );
  });

  it('no subscription → the zero-price plan', () => {
    expect(resolveCurrentPlan(subscribedTo(null), PLANS)?.name).toBe(
      'Client Free',
    );
  });

  it('either source missing (loading / failed) → unknown', () => {
    expect(resolveCurrentPlan(undefined, PLANS)).toBeUndefined();
    expect(resolveCurrentPlan(null, PLANS)).toBeUndefined();
    expect(resolveCurrentPlan(subscribedTo(null), undefined)).toBeUndefined();
  });

  it('a plan id the list does not have → unknown, never a guess', () => {
    expect(
      resolveCurrentPlan(subscribedTo('retired_plan'), PLANS),
    ).toBeUndefined();
  });
});

// ── Upgrade target ──────────────────────────────────────────────────────────
describe('upgradeTarget (monthly plans only)', () => {
  it('Free → Client Standard', () => {
    expect(upgradeTarget(FREE, PLANS)?.id).toBe('client_standard');
  });
  it('Standard (monthly or yearly) → Client Pro', () => {
    expect(upgradeTarget(STANDARD, PLANS)?.id).toBe('client_pro');
    expect(upgradeTarget(STANDARD_YEARLY, PLANS)?.id).toBe('client_pro');
  });
  it('Pro (monthly or yearly) → none: never a cheaper yearly plan', () => {
    expect(upgradeTarget(PRO, PLANS)).toBeUndefined();
    expect(upgradeTarget(PRO_YEARLY, PLANS)).toBeUndefined();
  });
  it('a yearly plan with no monthly twin is ranked at its per-month price', () => {
    const lone = plan({
      id: 'lone_yearly',
      priceKobo: 1200000, // ₦1,000 a month
      interval: 'year' as PlanDTO['interval'],
    });
    expect(upgradeTarget(lone, [FREE, STANDARD, PRO, lone])?.id).toBe(
      'client_pro',
    );
  });
});

// ── Banner ──────────────────────────────────────────────────────────────────
describe('upgradeBanner', () => {
  it('free plan: Client Standard, offering the full AI review', () => {
    expect(upgradeBanner(FREE, PLANS)).toEqual({
      title: 'Upgrade to Client Standard',
      benefits: 'Full AI review',
    });
  });

  it('middle plan: Client Pro, listing what Standard lacks in Pro order', () => {
    expect(upgradeBanner(STANDARD, PLANS)).toEqual({
      title: 'Upgrade to Client Pro',
      benefits: 'Book consultations & priority support',
    });
  });

  it('top plan: hidden', () => {
    expect(upgradeBanner(PRO, PLANS)).toBeNull();
    expect(upgradeBanner(PRO_YEARLY, PLANS)).toBeNull();
  });

  it('loading or error (plan or plans unknown): hidden', () => {
    expect(upgradeBanner(undefined, PLANS)).toBeNull();
    expect(upgradeBanner(FREE, undefined)).toBeNull();
    expect(upgradeBanner(undefined, undefined)).toBeNull();
  });

  it('self-service-only: never offers consultations or agent chat', () => {
    expect(upgradeBanner(STANDARD, PLANS, { selfServiceOnly: true })).toEqual({
      title: 'Upgrade to Client Pro',
      benefits: 'Priority support',
    });
    const chatPlus = plan({
      id: 'chat_plus',
      name: 'Chat Plus',
      priceKobo: 50000,
      features: ['messaging', 'consultations.book'] as PlanDTO['features'],
    });
    const current = plan({ id: 'basic', priceKobo: 0 });
    // Only agent-side benefits → no benefit line at all.
    expect(
      upgradeBanner(current, [current, chatPlus], { selfServiceOnly: true }),
    ).toEqual({ title: 'Upgrade to Chat Plus', benefits: '' });
  });

  it('nothing new on the target plan: title only', () => {
    const same = plan({ ...STANDARD, id: 'same', name: 'Same', priceKobo: 1 });
    const base = plan({ ...STANDARD, id: 'base', priceKobo: 0 });
    expect(upgradeBanner(base, [base, same])).toEqual({
      title: 'Upgrade to Same',
      benefits: '',
    });
  });
});

describe('joinLabels', () => {
  it('joins with ", " and " & ", lower-casing all but the first', () => {
    expect(
      joinLabels(['Book consultations', 'Priority support', 'Full AI review']),
    ).toBe('Book consultations, priority support & full AI review');
  });
  it('one label as written; none → empty', () => {
    expect(joinLabels(['Priority support'])).toBe('Priority support');
    expect(joinLabels([])).toBe('');
  });
});
