// ─────────────────────────────────────────────────────────────────────────────
// Pure intake logic (issue #113): visibility, open-required, validation and
// display formatting. No React, no network. Generic: it reads only the
// question data the backend returned.
// ─────────────────────────────────────────────────────────────────────────────

import { format } from 'date-fns';
import {
  KNOWN_INTAKE_TYPES,
  type IntakeAnswer,
  type IntakeAnswers,
  type IntakeCondition,
  type IntakeQuestion,
} from '@/types/intake.type';

// ── Dates ────────────────────────────────────────────────────────────────────

/** YYYY-MM-DD for a local Date (the wire format for date answers). */
export const toIsoDate = (d: Date): string => format(d, 'yyyy-MM-dd');

/** Parse YYYY-MM-DD as a LOCAL date (never via UTC, which can shift a day). */
export function fromIsoDate(s: string | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "12 Mar 2027" */
export function displayDate(s: string | undefined): string {
  const d = fromIsoDate(s);
  return d ? format(d, 'd MMM yyyy') : '';
}

/** Whole days between two YYYY-MM-DD dates (to - from). */
export function daysBetween(from: string, to: string): number {
  const a = fromIsoDate(from);
  const b = fromIsoDate(to);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

// ── Question helpers ─────────────────────────────────────────────────────────

/** True when this app version can render the question's type. */
export const isKnownType = (q: IntakeQuestion): boolean =>
  (KNOWN_INTAKE_TYPES as readonly string[]).includes(q.answerType);

function conditionHolds(c: IntakeCondition, answers: IntakeAnswers): boolean {
  const actual = answers[c.questionId] as unknown;
  switch (c.op) {
    case 'eq':
      return actual === c.value;
    case 'neq':
      return actual !== undefined && actual !== null && actual !== c.value;
    case 'in':
      return (
        Array.isArray(c.value) &&
        typeof actual === 'string' &&
        c.value.includes(actual)
      );
    default:
      return false;
  }
}

/**
 * Ids of the questions that are visible for these answers. Evaluated in
 * order, and a hidden question's answer does not count for later conditions
 * (same rule as the server, so both sides agree on what is "required").
 */
export function visibleIds(
  questions: IntakeQuestion[],
  answers: IntakeAnswers,
): Set<string> {
  const visible = new Set<string>();
  const effective: IntakeAnswers = {};
  for (const q of questions) {
    const any = q.showWhen?.anyOf;
    const show =
      !any || any.length === 0 || any.some((c) => conditionHolds(c, effective));
    if (show) {
      visible.add(q.id);
      if (answers[q.id] !== undefined) effective[q.id] = answers[q.id];
    }
  }
  return visible;
}

/** True when an answer counts as "not answered" (partial objects count too). */
export function isBlank(v: IntakeAnswer | undefined): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') {
    return Object.values(v).some(
      (x) => x === undefined || x === null || x === '',
    );
  }
  return false; // booleans (false is an answer)
}

/**
 * Required, visible, open questions in order. A question of an unknown type
 * counts as open when required (the applicant cannot answer it here).
 */
export function openRequired(
  questions: IntakeQuestion[],
  answers: IntakeAnswers,
): IntakeQuestion[] {
  const vis = visibleIds(questions, answers);
  return questions.filter(
    (q) =>
      q.required &&
      vis.has(q.id) &&
      (!isKnownType(q) || isBlank(answers[q.id])),
  );
}

/** Number of visible required questions (the counter's denominator). */
export function requiredCount(
  questions: IntakeQuestion[],
  answers: IntakeAnswers,
): number {
  const vis = visibleIds(questions, answers);
  return questions.filter((q) => q.required && vis.has(q.id)).length;
}

/**
 * Hidden questions that still hold an answer, keyed by the question whose
 * answer hides them (so the form can say "will be removed when you save"
 * under the question that was changed).
 */
export function hiddenAnsweredBy(
  questions: IntakeQuestion[],
  answers: IntakeAnswers,
): Set<string> {
  const vis = visibleIds(questions, answers);
  const controllers = new Set<string>();
  for (const q of questions) {
    if (vis.has(q.id) || isBlank(answers[q.id])) continue;
    for (const c of q.showWhen?.anyOf ?? []) controllers.add(c.questionId);
  }
  return controllers;
}

/**
 * The answers to send: visible, known-type, non-blank only. Hidden answers
 * stay in local state (so switching back restores them) but are never sent.
 */
export function payloadAnswers(
  questions: IntakeQuestion[],
  answers: IntakeAnswers,
): IntakeAnswers {
  const vis = visibleIds(questions, answers);
  const out: IntakeAnswers = {};
  for (const q of questions) {
    if (!vis.has(q.id) || !isKnownType(q)) continue;
    const v = answers[q.id];
    if (!isBlank(v)) out[q.id] = v as IntakeAnswer;
  }
  return out;
}

// ── Validation (things pickers can't prevent) ────────────────────────────────

export interface IntakeProblem {
  questionId: string;
  message: string;
}

/**
 * Client-side checks mirroring the server's. Returns the problems in
 * question order; empty means OK to send. Missing required answers are NOT
 * problems (a draft may be saved).
 */
export function validateAnswers(
  questions: IntakeQuestion[],
  answers: IntakeAnswers,
): IntakeProblem[] {
  const vis = visibleIds(questions, answers);
  const problems: IntakeProblem[] = [];
  const today = toIsoDate(new Date());

  for (const q of questions) {
    if (!vis.has(q.id) || !isKnownType(q)) continue;
    const v = answers[q.id] as unknown;
    if (v === undefined) continue;
    const bad = (message: string) =>
      problems.push({ questionId: q.id, message: `${q.label}: ${message}` });

    if (q.answerType === 'date_range') {
      const r = v as { from?: string; to?: string };
      // A half-filled range is "not answered" (blank), not an error, unless
      // the other end is set to something unusable.
      if (r.from && r.to) {
        if (r.to < r.from) {
          bad(
            'the end date is before the start date. Choose a later end date.',
          );
        } else if (
          q.maxLengthDays &&
          daysBetween(r.from, r.to) > q.maxLengthDays
        ) {
          bad(
            `these dates are more than ${q.maxLengthDays} days apart. Choose dates closer together.`,
          );
        }
        for (const d of [r.from, r.to]) {
          if (q.dateLimits?.relativeToToday === 'future_only' && d < today) {
            bad('that date has passed. Choose today or a later date.');
            break;
          }
        }
      }
    } else if (q.answerType === 'date') {
      if (
        typeof v === 'string' &&
        q.dateLimits?.relativeToToday === 'future_only' &&
        v < today
      ) {
        bad('that date has passed. Choose today or a later date.');
      }
    } else if (q.answerType === 'amount') {
      const a = v as { amount?: number; currency?: string };
      const started = a.amount !== undefined || !!a.currency;
      const complete =
        typeof a.amount === 'number' && a.amount >= 0 && !!a.currency;
      if (started && !complete) {
        bad('enter the amount in numbers and choose a currency.');
      }
    }
  }
  return problems;
}

// ── Display ──────────────────────────────────────────────────────────────────

/** "2,500" with thousands separators, from a number. */
export const groupDigits = (n: number): string =>
  n.toLocaleString('en-US', { maximumFractionDigits: 2 });

/** A saved answer as one human line (summary card rows). */
export function displayAnswer(
  q: IntakeQuestion,
  v: IntakeAnswer | undefined,
): string {
  if (v === undefined || isBlank(v)) return '';
  const optionLabel = (val: string) =>
    q.options?.find((o) => o.value === val)?.label ?? val;
  switch (q.answerType) {
    case 'single_choice':
      return optionLabel(v as string);
    case 'multi_choice':
      return (v as string[]).map(optionLabel).join(', ');
    case 'yes_no':
      return v === true ? 'Yes' : 'No';
    case 'date':
      return displayDate(v as string);
    case 'date_range': {
      const r = v as { from: string; to: string };
      return `${displayDate(r.from)} to ${displayDate(r.to)}`;
    }
    case 'amount': {
      // Always with the ISO code the applicant picked; never converted.
      const a = v as { amount: number; currency: string };
      return `${a.currency} ${groupDigits(a.amount)}`;
    }
    default:
      return String(v);
  }
}

/** Plain "n day(s)" for a range. */
export const daysLabel = (n: number): string =>
  n === 1 ? '1 day' : `${n} days`;
