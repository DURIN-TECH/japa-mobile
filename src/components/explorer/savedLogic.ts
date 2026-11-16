// ─────────────────────────────────────────────────────────────────────────────
// Saved destinations — pure rules (japa#146).
//
// Everything the hook, the destination heart, the Saved screen and Profile
// need to agree on, kept free of React so it is unit-tested directly:
//   • the identity of a save (country code, any case + visa id)
//   • cleaning a list from the API (guards for missing visa fields)
//   • the optimistic list edits and their exact inverses (rollback)
//   • which of the heart's states applies, and its accessibility label
//   • the failure copy, keyed on status / code (never the server's message)
//   • the Profile count label
// ─────────────────────────────────────────────────────────────────────────────

import type { VisaType } from '@/types/visas.type';
import type {
  SavedDestinationItem,
  SavedDestinationVisa,
} from '@/types/savedDestinations.type';
import { UNKNOWN_VALUE } from './profileLogic';

// ── Identity ─────────────────────────────────────────────────────────────────

/**
 * One key per save: UPPER-CASE country code + visa id, the same as the
 * backend's document id. Routes carry the code lower case (`gb`) and the API
 * answers upper case (`GB`); both give the same key.
 */
export function savedKey(countryCode: string, visaId: string): string {
  return `${(countryCode ?? '').toUpperCase()}_${visaId ?? ''}`;
}

/** The key of a list item. */
export function itemKey(item: SavedDestinationItem): string {
  return savedKey(item.countryCode, item.visaId);
}

/** True when (countryCode, visaId) is in `list`. */
export function isSavedIn(
  list: readonly SavedDestinationItem[],
  countryCode: string,
  visaId: string,
): boolean {
  const key = savedKey(countryCode, visaId);
  return list.some((i) => itemKey(i) === key);
}

// ── Cleaning the API answer ──────────────────────────────────────────────────

/**
 * Keep only items that can draw a tile, and fill the visa fields an older
 * record may lack (backend review: `description` / `processingTime` can be
 * missing on scraped visas, which would otherwise render "undefined").
 */
export function normaliseSavedList(raw: unknown): SavedDestinationItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (i): i is SavedDestinationItem =>
        !!i &&
        typeof i === 'object' &&
        typeof (i as SavedDestinationItem).countryCode === 'string' &&
        typeof (i as SavedDestinationItem).visaId === 'string' &&
        !!(i as SavedDestinationItem).visa &&
        typeof (i as SavedDestinationItem).visa === 'object',
    )
    .map((i) => ({
      ...i,
      countryCode: i.countryCode.toUpperCase(),
      countryName: i.countryName || i.countryCode.toUpperCase(),
      visa: {
        ...i.visa,
        id: i.visa.id ?? i.visaId,
        countryCode: (i.visa.countryCode ?? i.countryCode).toUpperCase(),
        name: i.visa.name ?? '',
        description: i.visa.description ?? '',
        processingTime: i.visa.processingTime ?? '',
        baseCostUsd: i.visa.baseCostUsd ?? 0,
        successRate: i.visa.successRate ?? null,
        totalApplications: i.visa.totalApplications ?? null,
        source: i.visa.source ?? null,
      },
    }));
}

/**
 * The `VisaType` view of a saved item's visa, for `visaTypeToDest`. Only the
 * fields the mapper reads are real; the rest are neutral fillers (the Tile
 * never shows them).
 */
export function savedVisaAsVisaType(v: SavedDestinationVisa): VisaType {
  return {
    id: v.id,
    countryCode: v.countryCode,
    name: v.name,
    code: '',
    description: v.description ?? '',
    category: v.category,
    processingTime: v.processingTime ?? '',
    processingDaysMin: 0,
    processingDaysMax: 0,
    baseCostUsd: v.baseCostUsd ?? 0,
    validityPeriod: '',
    isExtendable: false,
    eligibilityCriteria: [],
    successRate: v.successRate ?? undefined,
    totalApplications: v.totalApplications ?? undefined,
    source: v.source ?? undefined,
    isActive: true,
    agentIds: [],
  };
}

// ── Optimistic edits (and their inverses) ────────────────────────────────────

/**
 * The item a save puts in the cache before the server answers: built from the
 * visa the destination screen already loaded, `savedAt` = now (so it sorts
 * first, as the server will).
 */
export function optimisticItem(
  countryCode: string,
  visaId: string,
  visa: Pick<VisaType, 'name' | 'category'> & Partial<VisaType>,
  countryName: string | undefined,
  now: number = Date.now(),
): SavedDestinationItem {
  const code = countryCode.toUpperCase();
  return {
    countryCode: code,
    visaId,
    savedAt: { _seconds: Math.floor(now / 1000), _nanoseconds: 0 },
    countryName: countryName || code,
    visa: {
      id: visaId,
      countryCode: code,
      name: visa.name,
      description: visa.description ?? '',
      category: visa.category,
      processingTime: visa.processingTime ?? '',
      baseCostUsd: visa.baseCostUsd ?? 0,
      successRate: visa.successRate ?? null,
      totalApplications: visa.totalApplications ?? null,
      source: visa.source ?? null,
    },
  };
}

/** Put `item` first (newest), dropping any older copy of the same key. */
export function withSaved(
  list: readonly SavedDestinationItem[],
  item: SavedDestinationItem,
): SavedDestinationItem[] {
  const key = itemKey(item);
  return [item, ...list.filter((i) => itemKey(i) !== key)];
}

/** `list` without (countryCode, visaId). */
export function withoutSaved(
  list: readonly SavedDestinationItem[],
  countryCode: string,
  visaId: string,
): SavedDestinationItem[] {
  const key = savedKey(countryCode, visaId);
  return list.filter((i) => itemKey(i) !== key);
}

/**
 * Undo a failed remove: put the removed item back where it was. Inverse
 * edits (rather than restoring a whole snapshot) keep a second, concurrent
 * save/remove on ANOTHER destination intact.
 */
export function withRestored(
  list: readonly SavedDestinationItem[],
  item: SavedDestinationItem,
  index: number,
): SavedDestinationItem[] {
  const key = itemKey(item);
  const rest = list.filter((i) => itemKey(i) !== key);
  const at = Math.max(0, Math.min(index, rest.length));
  return [...rest.slice(0, at), item, ...rest.slice(at)];
}

/**
 * When a save succeeds, swap the optimistic item for the server's (real
 * `savedAt`, server visa data) IN PLACE, so the grid does not jump.
 */
export function withServerItem(
  list: readonly SavedDestinationItem[],
  item: SavedDestinationItem,
): SavedDestinationItem[] {
  const key = itemKey(item);
  if (!list.some((i) => itemKey(i) === key)) return withSaved(list, item);
  return list.map((i) => (itemKey(i) === key ? item : i));
}

// ── Destination heart ────────────────────────────────────────────────────────

/** The heart's visible states (design spec, table A). */
export type HeartState = 'loading' | 'error' | 'saved' | 'notSaved';

/**
 * Which heart state applies. `list` undefined = nothing cached: spinner while
 * the list loads (also while a retry from the dimmed heart runs), dimmed
 * heart once it has failed. Cached data always wins (a background refetch
 * stays silent).
 */
export function heartState(q: {
  list: readonly SavedDestinationItem[] | undefined;
  isFetching: boolean;
  isError: boolean;
  countryCode: string;
  visaId: string;
}): HeartState {
  if (q.list !== undefined) {
    return isSavedIn(q.list, q.countryCode, q.visaId) ? 'saved' : 'notSaved';
  }
  if (q.isFetching) return 'loading';
  if (q.isError) return 'error';
  return 'loading';
}

/** Accessibility label per state: says what a tap will do. */
export const HEART_LABEL: Record<HeartState, string> = {
  notSaved: 'Save destination',
  saved: 'Remove from saved',
  loading: 'Loading your saved destinations',
  error: 'Couldn’t load your saved destinations. Tap to try again.',
};

/** Screen-reader announcements after a successful tap. */
export const HEART_ANNOUNCE = {
  saved: 'Saved',
  removed: 'Removed from saved',
} as const;

// ── Failure copy ─────────────────────────────────────────────────────────────

/** Retry of the list from the dimmed heart failed. */
export const LIST_LOAD_FAILED =
  'We couldn’t load your saved destinations. Check your connection and try again.';

/**
 * The floating message for a failed save / remove. Mapped on HTTP status and
 * error code only (an `ApiError` from api.service). `null` = show nothing:
 * a 401 is left to the app's signed-out handling (the heart still reverts).
 */
export function saveErrorCopy(
  error: unknown,
  action: 'save' | 'remove',
): string | null {
  const e = (typeof error === 'object' && error !== null ? error : {}) as {
    status?: unknown;
    code?: unknown;
  };
  if (e.status === 401) return null;
  if (e.status === 402) {
    return action === 'save'
      ? 'Your plan is read-only. Renew your subscription to save destinations.'
      : 'Your plan is read-only. Renew your subscription to change your saved list.';
  }
  if (
    action === 'save' &&
    e.status === 409 &&
    e.code === 'SAVED_LIMIT_REACHED'
  ) {
    return 'You’ve saved 200 destinations, the most you can keep. Remove one to save this.';
  }
  if (action === 'save' && e.status === 404) {
    return 'This destination isn’t available to save right now.';
  }
  return action === 'save'
    ? 'We couldn’t save this destination. Check your connection and try again.'
    : 'We couldn’t remove this from saved. Check your connection and try again.';
}

// ── Profile ──────────────────────────────────────────────────────────────────

/**
 * The Profile "Saved" stat and "Saved destinations" row value: the number of
 * items in the saved list (the same number of tiles as the Saved screen), or
 * "–" while it is not known (loading or failed with nothing cached; #145).
 */
export function savedCountLabel(
  list: readonly unknown[] | null | undefined,
): string {
  return list ? String(list.length) : UNKNOWN_VALUE;
}
