// ─────────────────────────────────────────────────────────────────────────────
// Shared-route types (japa#237, P8a of #228).
//
// Mirrors the backend reads added in seli-backend PR #191:
//   - `sharedRoute` on every public visa read
//   - GET|POST /shared-routes/:id/apply-through
//   - PUT /applications/:id/through-country
//   - `stackLayers` on the intake, checklist and assessment (`meta`) reads
//
// NOTHING here (or in the screens that use it) names a country, a bloc or a
// nationality. Every name arrives as data.
// ─────────────────────────────────────────────────────────────────────────────

import type { IntakeAnswers, IntakeQuestion } from '@/types/intake.type';

/** One country a shared route covers (only countries the app can offer). */
export interface SharedRouteCountry {
  countryCode: string;
  countryName: string;
}

/** `sharedRoute` on a visa read: the route and the countries it covers. */
export interface PublicSharedRoute {
  id: string;
  name: string;
  covers: SharedRouteCountry[];
}

/** One layer of the rulebook stack (shared rules, or a country's own). */
export interface StackLayer {
  /** Equals the `layerKey` of the items that came from this layer. */
  key: string;
  kind: 'shared' | 'country';
  countryCode?: string;
  countryName?: string;
  /** The shared route's name (shared layers). */
  name?: string;
  /** `missing` = the layer's rules are not published yet. */
  status: 'ready' | 'missing';
}

/** A member country that can be applied through. */
export interface ApplyThroughOption {
  countryCode: string;
  countryName: string;
  visaTypeId: string;
  visaTypeName: string;
  baseCostUsd: number | null;
}

/** The rule's steps, shown under "How the rule decides". */
export interface CompetenceStepView {
  questionId: string;
  restsOn: string;
  quote: string;
  url: string;
}

/** What the competence rule made of the answers so far. */
export type CompetenceResult =
  | {
      status: 'country';
      countryCode: string;
      stepIndex: number;
      restsOn: string;
      quote: string;
      url: string;
    }
  | { status: 'ask'; questionId: string }
  | {
      status: 'unknown';
      reason: string;
      why: string;
      countryCode?: string;
    };

/** The rule's proposal (never forced: the person confirms or picks another). */
export interface ApplyThroughProposal {
  countryCode: string;
  countryName: string;
  stepIndex: number;
  restsOn: string;
  quote: string;
  url: string;
  /** False = the proposed country can't be offered right now. */
  offered: boolean;
}

/** GET|POST /shared-routes/:id/apply-through */
export interface ApplyThroughView {
  sharedRoute: { id: string; name: string; category?: string };
  on?: string;
  available: boolean;
  message: string | null;
  options: ApplyThroughOption[];
  questions: IntakeQuestion[];
  competence: { steps: CompetenceStepView[] } | null;
  result: CompetenceResult;
  proposal: ApplyThroughProposal | null;
  answers: IntakeAnswers;
  rulebookKey?: string;
  rulebookVersion?: number | null;
}

/** PUT /applications/:id/through-country */
export interface ChangeThroughCountryResult {
  changed: boolean;
  application: unknown;
  answersKept: number;
  answersSetAside: number;
}
