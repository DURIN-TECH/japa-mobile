// ─────────────────────────────────────────────────────────────────────────────
// Current plan + upgrade target (japa#346).
//
// Pure helpers shared by the Profile tab and the Settings screen, so both work
// out the user's plan from the same two queries in the same way:
//
//   • `resolveCurrentPlan` — GET /subscriptions/me + GET /plans?audience=client
//     → the plan the user is on (the subscription's plan, or the zero-price
//     plan when there is no subscription).
//   • `upgradeTarget`      — the cheapest MONTHLY plan priced above the user's
//     plan (yearly subscribers are ranked by their monthly twin).
//   • `upgradeBenefits`    — the target's features the current plan lacks,
//     worded with the plan cards' labels, joined into one line.
//
// No React here: the hook that feeds these lives in `hooks/useCurrentPlan.ts`.
// ─────────────────────────────────────────────────────────────────────────────

import { featureLabel, SELF_SERVICE_PLAN_FEATURES } from './liveSubscription';
import type { MySubscription, PlanDTO } from '@/hooks/useSubscription';

// ── Current plan ─────────────────────────────────────────────────────────────

/**
 * The plan the user is on, or undefined while either source is missing.
 *
 * • A subscription → its `planId` looked up in the plan list. A plan id the
 *   list doesn't have (e.g. a retired, inactive plan) → undefined: the screens
 *   then show "–" rather than guess a name.
 * • A loaded `subscription: null` → no paid plan, so the zero-price plan.
 */
export function resolveCurrentPlan(
  mine: MySubscription | null | undefined,
  plans: PlanDTO[] | undefined,
): PlanDTO | undefined {
  if (!mine || !plans) return undefined;
  const planId = mine.subscription?.planId;
  return planId
    ? plans.find((p) => p.id === planId)
    : plans.find((p) => p.priceKobo === 0);
}

// ── Upgrade target ───────────────────────────────────────────────────────────

/**
 * The price a plan is ranked at when looking for an upgrade.
 *
 * Upgrades are compared on MONTHLY plans only (orchestrator decision on the
 * design spec, japa#346): a yearly plan is ranked at the price of the monthly
 * plan in its `billingGroup`. Without that, a ₦2,500/month Pro user would be
 * offered "Client Standard (Yearly)" at ₦10,800 — fewer features, "higher"
 * price.
 *
 * A yearly plan with NO monthly twin in the list (no billing group, or the
 * monthly plan is inactive) can't be ranked → undefined, and the banner hides.
 * Its per-month price is not a safe stand-in: yearly plans are discounted
 * (seeded at 10.8 months for 12), so ÷12 ranks it BELOW its own monthly tier
 * and would offer the user the plan they already have (review note, japa#346).
 */
function rankPrice(plan: PlanDTO, plans: PlanDTO[]): number | undefined {
  if (plan.interval !== 'year') return plan.priceKobo;
  const twin = plan.billingGroup
    ? plans.find(
        (p) => p.interval === 'month' && p.billingGroup === plan.billingGroup,
      )
    : undefined;
  return twin?.priceKobo;
}

/**
 * The plan the upgrade banner offers: the cheapest active monthly plan priced
 * above the user's current plan. Undefined when there is none (the user is on
 * the top plan), when the current plan is unknown, or when it is a yearly plan
 * that can't be ranked (see `rankPrice`).
 *
 * `plans` is already filtered to active plans by `usePlans`.
 */
export function upgradeTarget(
  current: PlanDTO | undefined,
  plans: PlanDTO[] | undefined,
): PlanDTO | undefined {
  if (!current || !plans) return undefined;
  const floor = rankPrice(current, plans);
  if (floor === undefined) return undefined;
  return plans
    .filter((p) => p.interval === 'month' && p.id !== current.id)
    .filter((p) => p.priceKobo > floor)
    .sort((a, b) => a.priceKobo - b.priceKobo)[0];
}

// ── Benefit line ─────────────────────────────────────────────────────────────

/**
 * Join labels into one sentence: the first label as written, later ones with a
 * lower-cased first letter, ", " between them and " & " before the last.
 *   ['Book consultations', 'Priority support', 'Full AI review']
 *     → 'Book consultations, priority support & full AI review'
 * Empty list → '' (the caller leaves the line out).
 */
export function joinLabels(labels: string[]): string {
  const parts = labels.map((l, i) =>
    i === 0 ? l : l.charAt(0).toLowerCase() + l.slice(1),
  );
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} & ${parts[parts.length - 1]}`;
}

/**
 * The banner's benefit line: features of `target` that `current` doesn't
 * have, in the order the target lists them, worded like the plan cards.
 *
 * In a self-service-only build only SELF_SERVICE_PLAN_FEATURES survive — the
 * same allow-list the plan cards on /subscription use, so the banner never
 * offers agent chat or consultation booking there. '' when nothing is left.
 */
export function upgradeBenefits(
  target: PlanDTO,
  current: PlanDTO,
  opts: { selfServiceOnly?: boolean } = {},
): string {
  const have = new Set<string>(current.features);
  const labels = target.features
    .filter((f) => !have.has(f))
    .filter((f) => !opts.selfServiceOnly || SELF_SERVICE_PLAN_FEATURES.has(f))
    .map(featureLabel);
  return joinLabels(labels);
}

// ── Banner view model ────────────────────────────────────────────────────────

export interface UpgradeBanner {
  /** "Upgrade to <plan name>". */
  title: string;
  /** Joined benefit labels; '' → leave the second line out. */
  benefits: string;
}

/**
 * What the Profile upgrade banner shows, or null to hide it: hidden until both
 * queries have answered (`current` resolves only then), and for a user with no
 * higher plan to move to.
 */
export function upgradeBanner(
  current: PlanDTO | undefined,
  plans: PlanDTO[] | undefined,
  opts: { selfServiceOnly?: boolean } = {},
): UpgradeBanner | null {
  const target = upgradeTarget(current, plans);
  if (!current || !target) return null;
  return {
    title: `Upgrade to ${target.name}`,
    benefits: upgradeBenefits(target, current, opts),
  };
}
