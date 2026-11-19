// ─────────────────────────────────────────────────────────────────────────────
// Application intake types (issue #113).
//
// Mirrors the backend's `GET /applications/:id/intake` response
// (seli-backend `functions/src/types/intake.ts`). The QUESTIONS are data owned
// by the approved visa rubric: nothing in the app names a country, a visa
// route or a nationality. Dates are strings (ISO-8601 / YYYY-MM-DD).
// ─────────────────────────────────────────────────────────────────────────────

import type { StackLayer } from '@/types/sharedRoute.type';

/** Answer types this app version can render. Others are skipped safely. */
export const KNOWN_INTAKE_TYPES = [
  'single_choice',
  'multi_choice',
  'yes_no',
  'date',
  'date_range',
  'text',
  'amount',
] as const;
export type KnownIntakeType = (typeof KNOWN_INTAKE_TYPES)[number];

export interface IntakeOption {
  value: string;
  label: string;
  description?: string;
}

export interface IntakeCondition {
  questionId: string;
  op: 'eq' | 'neq' | 'in';
  value: string | number | boolean | string[];
}

export interface IntakeQuestion {
  id: string;
  label: string;
  helpText?: string;
  /** A plain string: a newer rubric may carry a type this app doesn't know. */
  answerType: string;
  required: boolean;
  criterionIds?: string[];
  /** Heading the question is listed under (consecutive questions share it). */
  group?: string;
  party?: 'applicant' | 'sponsor';
  options?: IntakeOption[];
  dateLimits?: {
    min?: string;
    max?: string;
    relativeToToday?: 'past_only' | 'future_only';
  };
  textLimits?: { minLength?: number; maxLength?: number };
  showWhen?: { anyOf: IntakeCondition[] };
  /** date_range: longest allowed range in days. */
  maxLengthDays?: number;
  /** amount: ISO currency codes the question allows (any code when absent). */
  currencies?: string[];
  /** japa#237: the rulebook layer the question came from (stacks only). */
  layerKey?: string;
}

export interface IntakeMeta {
  title?: string;
  cardTitle?: string;
  intro?: string;
}

/** An answer value; its shape depends on the question's answerType. */
export type IntakeAnswer =
  | string
  | boolean
  | string[]
  | { from?: string; to?: string }
  | { amount?: number; currency?: string };

export type IntakeAnswers = Record<string, IntakeAnswer>;

export interface IntakeResponse {
  available: boolean;
  /** False once the application is submitted (read-only). */
  editable: boolean;
  routeKey: string | null;
  rubricVersion: number | null;
  meta: IntakeMeta;
  questions: IntakeQuestion[];
  answers: IntakeAnswers;
  updatedAt: string | null;
  savedRubricVersion: number | null;
  openRequiredIds: string[];
  /** Last review's time (#42). Null until the assessment engine ships. */
  lastReviewAt: string | null;
  /** japa#237: the rulebook layers (omitted for a single-layer route). */
  stackLayers?: StackLayer[];
}
