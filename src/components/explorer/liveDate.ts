// ─────────────────────────────────────────────────────────────────────────────
// Safe date parsing for live backend data.
//
// The backend serializes dates inconsistently: some come as ISO strings, others
// as raw Firestore Timestamps (`{ _seconds, _nanoseconds }` or `{ seconds, ... }`),
// and occasionally as epoch numbers. `parseISO` throws on anything non-string
// ("dateString.split is not a function" → Hermes "undefined is not a function"),
// which crashes the live adapters. Normalize everything through `toDate` first.
// ─────────────────────────────────────────────────────────────────────────────

import { format, formatDistanceToNow, parseISO } from 'date-fns';

export function toDate(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'string') {
    const d = parseISO(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'object') {
    const o = v as { _seconds?: number; seconds?: number; toDate?: () => Date };
    const secs = o._seconds ?? o.seconds;
    if (typeof secs === 'number') return new Date(secs * 1000);
    if (typeof o.toDate === 'function') {
      try {
        const d = o.toDate();
        return d instanceof Date && !isNaN(d.getTime()) ? d : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

// Relative "3 hours ago" (empty string if the date is missing/unparseable).
export function agoFrom(v: unknown, opts?: { addSuffix?: boolean }): string {
  const d = toDate(v);
  return d ? formatDistanceToNow(d, opts) : '';
}

// Compact relative time ("3h", "2d") — used by the conversations list.
export function agoShort(v: unknown): string {
  return agoFrom(v)
    .replace(/^about /, '')
    .replace(/^less than a minute$/, 'now')
    .replace(/ minutes?$/, 'm')
    .replace(/ hours?$/, 'h')
    .replace(/ days?$/, 'd')
    .replace(/ months?$/, 'mo')
    .replace(/ years?$/, 'y');
}

// Format via a date-fns pattern (fallback string if missing/unparseable).
export function fmtDate(v: unknown, pattern: string, fallback = ''): string {
  const d = toDate(v);
  return d ? format(d, pattern) : fallback;
}
