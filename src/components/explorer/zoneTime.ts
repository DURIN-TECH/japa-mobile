// ─────────────────────────────────────────────────────────────────────────────
// Booking times on the phone's own clock (japa#356, japa#392).
//
// DECISION (user, 2026-11-22, after the #356 QA round): times are shown in
// the PHONE'S OWN time zone, with NO zone label. Two places use this:
//   • the cancel confirm, case E: "Refunds closed at 5:00 AM on Sat, 21 Nov."
//     (`refundableUntil`, an ISO instant from the server);
//   • the pay screen's "Your consultation moved" card and the confirmation
//     after it: the new date and time.
//
// (The first build showed the booking's own wall clock plus a short zone
// name. On Hermes, `formatToParts` splits "GMT+1" into "GMT" + literals, so
// the label read "GMT" and looked an hour off. Zone labels are gone now.)
//
// A booking stores its slot as WALL-CLOCK parts in its own zone
// (seli-backend consultations/slot-time.ts): `scheduledDate`'s UTC calendar
// day is the day picked, `scheduledTime` the 24-hour `HH:mm` in `timezone`.
// So the slot's INSTANT is worked out from those three, exactly as the
// backend's `slotStartsAt` does, and then shown on the phone's clock: its
// wall clock in the device's zone (read with `Intl.DateTimeFormat` numeric
// parts only, never zone names) formatted by date-fns. In the app the device
// zone is the phone's own; tests pass one in (`device`), because Jest cannot
// change the process time zone from inside a test. Every
// function is pure and never throws: an unknown zone, or an Intl without
// zone support, falls back to reading the stored wall clock as UTC.
// ─────────────────────────────────────────────────────────────────────────────

import { format } from 'date-fns';
import { toDate } from './liveDate';

/** The wall-clock fields of an instant in a zone. */
interface WallClock {
  year: number;
  month: number; // 0-based, like Date
  day: number;
  hour: number;
  minute: number;
}

/**
 * The wall clock of instant `at` in `zone`, or null when the zone is not one
 * this runtime knows (Intl throws a RangeError for it). Numeric parts only.
 */
function wallClockIn(at: Date, zone: string): WallClock | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(at);
    const get = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value);
    const out: WallClock = {
      year: get('year'),
      month: get('month') - 1,
      day: get('day'),
      // Some engines print midnight as "24" even with h23: fold it to 0.
      hour: get('hour') % 24,
      minute: get('minute'),
    };
    return Object.values(out).every(Number.isFinite) ? out : null;
  } catch {
    return null;
  }
}

/**
 * Offset of `zone` from UTC at instant `at`, in minutes (Lagos: +60), or
 * null for an unknown zone.
 */
function offsetMinutes(at: Date, zone: string): number | null {
  const w = wallClockIn(at, zone);
  if (!w) return null;
  const asUtc = Date.UTC(w.year, w.month, w.day, w.hour, w.minute);
  // Instants are compared to the minute (the wall clock has no seconds).
  const atMinute = Math.floor(at.getTime() / 60000) * 60000;
  return Math.round((asUtc - atMinute) / 60000);
}

/** The phone's IANA zone, or null when the runtime cannot tell. */
function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/**
 * Instant `at` as a Date whose LOCAL fields are the wall clock in `device`
 * (the phone's zone by default), so date-fns prints the phone's clock. When
 * the zone cannot be read, `at` itself (date-fns then uses the runtime's own
 * zone, which on a phone is the same thing).
 */
function onPhoneClock(at: Date, device: string | null | undefined): Date {
  const zone = device === undefined ? deviceTimeZone() : device;
  const w = zone ? wallClockIn(at, zone) : null;
  return w ? new Date(w.year, w.month, w.day, w.hour, w.minute) : at;
}

/** "15:00" (or a legacy "3:00 PM") → hours and minutes, or null. */
function parseClock(value: unknown): { hour: number; minute: number } | null {
  if (typeof value !== 'string') return null;
  const h24 = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (h24) return { hour: Number(h24[1]), minute: Number(h24[2]) };
  const h12 = /^(0?[1-9]|1[0-2]):([0-5]\d) ?(AM|PM)$/i.exec(value.trim());
  if (!h12) return null;
  const pm = h12[3].toUpperCase() === 'PM';
  return {
    hour: (Number(h12[1]) % 12) + (pm ? 12 : 0),
    minute: Number(h12[2]),
  };
}

/**
 * The INSTANT a booking's slot starts: `scheduledDate`'s UTC calendar day +
 * `scheduledTime` as wall clock in `timezone` (the backend's `slotStartsAt`
 * rule, two passes so a DST change lands right). Null when the date or the
 * time cannot be read. An unknown or missing zone reads the wall clock as
 * UTC.
 */
export function bookingInstant(booking: {
  scheduledDate: unknown;
  scheduledTime?: string | null;
  timezone?: string | null;
}): Date | null {
  const day = toDate(booking.scheduledDate);
  const clock = parseClock(booking.scheduledTime);
  if (!day || !clock) return null;
  const naive = Date.UTC(
    day.getUTCFullYear(),
    day.getUTCMonth(),
    day.getUTCDate(),
    clock.hour,
    clock.minute,
  );
  const zone = booking.timezone;
  if (!zone) return new Date(naive);
  const first = offsetMinutes(new Date(naive), zone);
  if (first === null) return new Date(naive);
  const guess = naive - first * 60000;
  const second = offsetMinutes(new Date(guess), zone);
  return new Date(
    second === null || second === first ? guess : naive - second * 60000,
  );
}

/**
 * japa#356 case E: the refund cut-off on the phone's own clock, e.g.
 * "5:00 AM on Sat, 21 Nov". No zone label. '' when the instant cannot be
 * read (the caller then leaves the sentence out).
 *
 * @param iso the server's `refundableUntil` (ISO instant)
 */
export function formatCutoff(
  iso: unknown,
  /** The phone's zone; tests only (defaults to the real one). */
  device?: string | null,
): string {
  const at = toDate(iso);
  if (!at) return '';
  const local = onPhoneClock(at, device);
  return `${format(local, 'h:mm a')} on ${format(local, 'EEE, d MMM')}`;
}

/**
 * japa#392: a booking's date and time on the phone's own clock, for the
 * "New time" card: `{ date: "Wednesday, November 25, 2026", time: "2:00 PM" }`
 * (a 3:00 PM Lagos slot seen on a London phone). No zone label. When the
 * time cannot be read, the stored day alone (never a made-up "12:00 AM").
 * Null when the date cannot be read.
 */
export function bookingWhen(
  booking: {
    scheduledDate: unknown;
    scheduledTime?: string | null;
    timezone?: string | null;
  },
  /** The phone's zone; tests only (defaults to the real one). */
  device?: string | null,
): { date: string; time: string } | null {
  const day = toDate(booking.scheduledDate);
  if (!day) return null;
  const at = bookingInstant(booking);
  if (!at) {
    // No readable time: the picked day as stored (its UTC calendar day).
    const local = new Date(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
    );
    return { date: format(local, 'EEEE, MMMM d, yyyy'), time: '' };
  }
  const local = onPhoneClock(at, device);
  return {
    date: format(local, 'EEEE, MMMM d, yyyy'),
    time: format(local, 'h:mm a'),
  };
}

/**
 * japa#392: a booking's day and time as the pay / confirmation route params
 * carry them (`dateIso` "yyyy-MM-dd", `time` "2:00 PM"), on the phone's own
 * clock like the card, so a booking paid after it moved confirms its NEW
 * slot. Null when the date cannot be read; `time` is '' when the time
 * cannot.
 */
export function bookingRouteParams(
  booking: {
    scheduledDate: unknown;
    scheduledTime?: string | null;
    timezone?: string | null;
  },
  /** The phone's zone; tests only (defaults to the real one). */
  device?: string | null,
): { dateIso: string; time: string } | null {
  const day = toDate(booking.scheduledDate);
  if (!day) return null;
  const at = bookingInstant(booking);
  if (!at) {
    const local = new Date(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
    );
    return { dateIso: format(local, 'yyyy-MM-dd'), time: '' };
  }
  const local = onPhoneClock(at, device);
  return {
    dateIso: format(local, 'yyyy-MM-dd'),
    time: format(local, 'h:mm a'),
  };
}
