// ─────────────────────────────────────────────────────────────────────────────
// Pure logic behind the "Cost & timeline", "Eligibility" and "Official source"
// sections of /visa/[id] (japa#255).
//
// Rule for everything here: a field with no value yields NOTHING (null / empty
// list) so the screen hides that row or section. No placeholders, no invented
// data, never the text "undefined".
// ─────────────────────────────────────────────────────────────────────────────

import { formatMoney, minorUnitFactor } from './content';
import type { VisaType } from '@/types/visas.type';

/** Icon keys resolved to `Ic.*` by the component (keeps this file UI-free). */
export type BreakdownIcon = 'cards' | 'clock' | 'cal' | 'layers';

export interface BreakdownRow {
  key: 'cost' | 'processing' | 'validity' | 'extension';
  icon: BreakdownIcon;
  label: string;
  value: string;
  /** Optional line under the value, e.g. "Up to 2 times". */
  hint?: string;
}

// True for a usable positive number (rejects undefined, null, NaN, 0, negatives).
const positive = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0;

// Trimmed text, or '' for anything that is not a string.
const text = (s: unknown): string => (typeof s === 'string' ? s.trim() : '');

/**
 * A GOVERNMENT fee (`baseCostUsd`, whole US dollars) as "$1,200" (japa#183).
 * Government fees are not service prices: they stay in US dollars, never get
 * a naira figure next to them, and are always labelled "government fee" /
 * "Paid in US dollars" (copy below). Formatted through the one money
 * formatter (dollars to cents is the USD exponent, not a conversion).
 */
export function formatCostUsd(n: number): string {
  return formatMoney(
    { amountMinor: Math.round(n) * minorUnitFactor('USD'), currency: 'USD' },
    { whole: true },
  );
}

/** Copy for government fees (japa#183, resolves #177). */
export const GOV_FEE_COPY = {
  /** Bottom bar label (visa + destination), replaces "Starting at". */
  barLabel: 'Government fee from',
  /** Caption under the bar value. */
  caption: 'Paid in US dollars',
  /** Destination stats-row cell label. */
  statLabel: 'Gov. fee from',
  /** Tile / home-card chip prefix: "Fee from $120". */
  chipPrefix: 'Fee from',
  /** Visa breakdown row label. */
  rowLabel: 'Government fee',
} as const;

/**
 * Processing time text: "30 to 60 days" when min and max are both > 0 and
 * differ, "30 days" when equal, otherwise the free-text `processingTime`.
 * Returns '' when nothing is available.
 */
export function processingText(
  v: Pick<
    VisaType,
    'processingDaysMin' | 'processingDaysMax' | 'processingTime'
  >,
): string {
  const { processingDaysMin: min, processingDaysMax: max } = v;
  if (positive(min) && positive(max)) {
    if (min === max) return `${min} ${min === 1 ? 'day' : 'days'}`;
    return `${min} to ${max} days`;
  }
  return text(v.processingTime);
}

/**
 * Rows of the "Cost & timeline" card, in display order. `statStripProcessing`
 * is the text the stat strip already shows for Processing: when the Processing
 * row would repeat it, the row is skipped (no duplicate on screen).
 */
export function costTimelineRows(
  v: VisaType,
  statStripProcessing?: string,
): BreakdownRow[] {
  const rows: BreakdownRow[] = [];

  if (positive(v.baseCostUsd)) {
    rows.push({
      key: 'cost',
      icon: 'cards',
      label: GOV_FEE_COPY.rowLabel,
      value: formatCostUsd(v.baseCostUsd),
      hint: GOV_FEE_COPY.caption,
    });
  }

  const processing = processingText(v);
  // Skip when the stat strip already shows ANY real processing time (not only
  // an identical string): the same fact must not appear twice. '—' / blank is
  // the strip's "no data" placeholder, so it does not count as shown.
  const stripShowsProcessing =
    text(statStripProcessing) !== '' && text(statStripProcessing) !== '—';
  if (processing && !stripShowsProcessing) {
    rows.push({
      key: 'processing',
      icon: 'clock',
      label: 'Processing time',
      value: processing,
    });
  }

  const validity = text(v.validityPeriod);
  if (validity) {
    rows.push({
      key: 'validity',
      icon: 'cal',
      label: 'Valid for',
      value: validity,
    });
  }

  // Only a real boolean counts: a missing flag is "unknown", not "can't".
  if (typeof v.isExtendable === 'boolean') {
    const max = v.maxExtensions;
    rows.push({
      key: 'extension',
      icon: 'layers',
      label: 'Extension',
      value: v.isExtendable ? 'Can be extended' : 'Can’t be extended',
      hint:
        v.isExtendable && typeof max === 'number' && max > 0
          ? `Up to ${max} ${max === 1 ? 'time' : 'times'}`
          : undefined,
    });
  }

  return rows;
}

/** Non-blank eligibility criteria, trimmed. [] hides the Eligibility card. */
export function eligibilityItems(v: Pick<VisaType, 'eligibilityCriteria'>) {
  return Array.isArray(v.eligibilityCriteria)
    ? v.eligibilityCriteria.map(text).filter(Boolean)
    : [];
}

/**
 * The official application link, only when `applicationUrl` is an http(s) URL. `applicationInstructions` is never shown without a URL.
 */
export function officialSource(
  v: Pick<VisaType, 'applicationUrl' | 'applicationInstructions'>,
): { url: string; instructions?: string } | null {
  const url = text(v.applicationUrl);
  // Only http(s) links are opened; anything else (javascript:, tel:, bare text)
  // hides the whole section rather than risking a bad Linking.openURL.
  if (!/^https?:\/\/\S+$/i.test(url)) return null;
  return { url, instructions: text(v.applicationInstructions) || undefined };
}
