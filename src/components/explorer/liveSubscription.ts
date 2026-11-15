// ─────────────────────────────────────────────────────────────────────────────
// Subscription — live backend adapter.
//
// Maps the backend's PlanDTO (GET /plans?audience=client) onto the Explorer's
// static `Plan` shape so the coral/dark pricing screen can render real plans
// (no static fallback plans, japa#145).
//
// The authz feature catalog (`FeatureKey`) is machine-readable
// (e.g. "documents.upload"); this file turns each key into a human sentence for
// the feature-check rows. Unknown keys fall back to a title-cased label.
// ─────────────────────────────────────────────────────────────────────────────

import { FeatureKey } from '@durin-tech/authz';
import { type Plan } from '@/types/explorer.type';
import { PlanDTO } from '@/hooks/useSubscription';

// FeatureKey → human label shown on a plan's check-row. Mirrors the wording of
// the static PLAN_FEATURES copy so every plan reads the same way.
export const FEATURE_LABEL: Record<FeatureKey, string> = {
  'applications.create': 'Create applications',
  'applications.bulk': 'Bulk applications',
  messaging: 'Agent messaging',
  'consultations.book': 'Book consultations',
  'documents.upload': 'Document uploads',
  'analytics.view': 'Analytics dashboard',
  'agency.invite_agents': 'Invite agents',
  self_service: 'Self-service flow',
  priority_support: 'Priority support',
  'news.alerts': 'Visa news alerts',
  'payments.request': 'Payment requests',
};

// Title-case a raw feature key ("documents.upload" → "Documents Upload") as a
// safe fallback for any key not present in FEATURE_LABEL.
function titleCase(key: string): string {
  return key.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Self-service-only build (japa#334) ─────────────────────────────────────
// Features of hidden flows (chat with agents, consultation booking). A
// self-service-only build leaves them off the plan cards; the plans, their
// prices and what the backend grants are unchanged.
export const SELF_SERVICE_HIDDEN_FEATURES: ReadonlySet<string> = new Set([
  'messaging',
  'consultations.book',
]);

/**
 * One backend PlanDTO → the Explorer's `Plan`.
 *
 * • price:    kobo → naira (÷100, rounded).
 * • interval: "none" is treated as no interval (null) so a free plan doesn't
 *             render "/none" under its price — preserves the design where
 *             the Free tier shows a bare "Free" with no interval suffix.
 * • tag:      flagged "Most popular" when its id matches the caller-chosen
 *             `popularId` (the middle-priced paid plan; see subscription.tsx).
 * • features: FeatureKey[] → human labels (fallback: title-cased key).
 * • blurb:    the backend has no marketing blurb, so leave it empty.
 *
 * `opts.selfServiceOnly` (japa#334) drops SELF_SERVICE_HIDDEN_FEATURES from
 * `features`. Off (the default) maps every feature, exactly as before.
 */
export function mapPlan(
  p: PlanDTO,
  popularId?: string,
  opts: { selfServiceOnly?: boolean } = {},
): Plan {
  const interval = p.interval && p.interval !== 'none' ? p.interval : null;
  return {
    id: p.id,
    name: p.name,
    price: Math.round(p.priceKobo / 100),
    interval,
    tag: p.id === popularId ? 'Most popular' : null,
    features: p.features
      .filter(
        (f) => !(opts.selfServiceOnly && SELF_SERVICE_HIDDEN_FEATURES.has(f)),
      )
      .map((f) => FEATURE_LABEL[f] ?? titleCase(f)),
    blurb: '',
  };
}
