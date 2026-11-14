// ─────────────────────────────────────────────────────────────────────────────
// Timeline trimming helpers (japa#274) — pure, so they are unit-tested.
//
// The application screen's Timeline can get very long. Two things keep it short:
//   1. dedupeSteps  — collapse CONSECUTIVE identical entries into one.
//   2. trimSteps    — show only the first TIMELINE_PREVIEW entries until the
//                     user taps "Show all (N)".
//
// Order: the list arrives newest-first from the API (the screen shows it as
// given), so "the most recent 3" is the head of the list.
// ─────────────────────────────────────────────────────────────────────────────
import type { AppStep } from '@/types/explorer.type';

/** How many entries the collapsed timeline shows. */
export const TIMELINE_PREVIEW = 3;

/**
 * Collapse consecutive entries that are identical in title + description +
 * date + actor into a single entry. Only ADJACENT repeats collapse: the same
 * title legitimately recurs later in a journey, so non-adjacent entries stay.
 * `s` (state) is intentionally not part of the key; the first one wins.
 */
export function dedupeSteps(steps: AppStep[]): AppStep[] {
  const out: AppStep[] = [];
  for (const step of steps) {
    const prev = out[out.length - 1];
    const same =
      prev &&
      prev.t === step.t &&
      (prev.desc ?? '') === (step.desc ?? '') &&
      prev.d === step.d &&
      (prev.by ?? 'system') === (step.by ?? 'system');
    if (!same) out.push(step);
  }
  return out;
}

/**
 * The entries to render. `expanded` shows everything; otherwise the first
 * `limit` entries. `canToggle` says whether a Show all / Show less control is
 * needed at all (only when there is more than `limit` to hide).
 */
export function trimSteps(
  steps: AppStep[],
  expanded: boolean,
  limit: number = TIMELINE_PREVIEW,
): { visible: AppStep[]; total: number; canToggle: boolean } {
  const canToggle = steps.length > limit;
  return {
    visible: expanded || !canToggle ? steps : steps.slice(0, limit),
    total: steps.length,
    canToggle,
  };
}
