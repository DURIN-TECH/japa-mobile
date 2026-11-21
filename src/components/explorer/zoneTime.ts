// ─────────────────────────────────────────────────────────────────────────────
// Times in a booking's own time zone (japa#356, japa#392).
//
// A consultation is booked in the zone it was made in (`timezone`, e.g.
// "Africa/Lagos"). Two screens must show a time in THAT zone, not the
// device's:
//   • the cancel confirm: "Refunds closed at 3:00 PM on Tue, 25 Nov."
//     (`refundableUntil`, an ISO instant from the server);
//   • the pay screen's "Your consultation moved" state: the new date and time
//     (`scheduledDate` + `scheduledTime`, stored as the booking's wall clock).
// When the booking's zone differs from the device's, the short zone name is
// added after the time ("3:00 PM GMT+1"), so a client abroad is never misled.
//
// The app has no time-zone library (date-fns 4 alone formats in the device's
// zone), so this reads the wall clock in a zone through `Intl.DateTimeFormat`
// (`timeZone` option, supported by Hermes and Node) and then formats those
// wall-clock parts with date-fns. Every function is pure and never throws:
// an unknown zone, or an Intl without zone support, falls back to the
// device's own reading with no zone name.
//
// How a booking stores its slot (seli-backend consultations/slot-time.ts):
// `scheduledDate`'s UTC calendar day IS the day picked, and `scheduledTime`
// is the 24-hour `HH:mm` wall clock in `timezone`.
// ─────────────────────────────────────────────────────────────────────────────

import { format } from 'date-fns';
import { toDate } from './liveDate';

/** The device's IANA zone, or null when the runtime cannot tell. */
export function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

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
 * this runtime knows (Intl throws a RangeError for it).
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
 * The short name of `zone` at instant `at` ("GMT+1", "WAT", "EST": whatever
 * the runtime's English locale data says), or null when it cannot tell.
 */
export function shortZoneName(at: Date, zone: string): string | null {
  try {
    const part = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      timeZoneName: 'short',
    })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName');
    return part?.value || null;
  } catch {
    return null;
  }
}

/**
 * Offset of `zone` from UTC at instant `at`, in minutes (Lagos: +60), or
 * null for an unknown zone. Two zones "differ" when this differs.
 */
function offsetMinutes(at: Date, zone: string): number | null {
  const w = wallClockIn(at, zone);
  if (!w) return null;
  const asUtc = Date.UTC(w.year, w.month, w.day, w.hour, w.minute);
  // Instants are compared to the minute (the wall clock has no seconds).
  const atMinute = Math.floor(at.getTime() / 60000) * 60000;
  return Math.round((asUtc - atMinute) / 60000);
}

/**
 * The zone suffix to show after a time: " GMT+1" when `zone` reads a
 * different clock than the device at `at`; '' when they agree, or when
 * either cannot be read. The device's zone is passed in for tests.
 */
export function zoneSuffix(
  at: Date,
  zone: string | null | undefined,
  device: string | null = deviceTimeZone(),
): string {
  if (!zone || !device || zone === device) return '';
  const a = offsetMinutes(at, zone);
  const b = offsetMinutes(at, device);
  if (a === null || b === null || a === b) return '';
  const name = shortZoneName(at, zone);
  return name ? ` ${name}` : '';
}

/**
 * A device-local Date whose fields are the wall clock of `at` in `zone`, so
 * date-fns can format it as that zone's time. Falls back to `at` itself
 * (the device's reading) when the zone is unknown.
 */
function asZoneLocal(at: Date, zone: string | null | undefined): Date {
  const w = zone ? wallClockIn(at, zone) : null;
  return w ? new Date(w.year, w.month, w.day, w.hour, w.minute) : at;
}

/**
 * japa#356: the refund cut-off, e.g. "3:00 PM on Tue, 25 Nov", in the
 * booking's zone, with " GMT+1" after the time when that zone differs from
 * the device's ("3:00 PM GMT+1 on Tue, 25 Nov"). '' when the instant cannot
 * be read (the caller then leaves the sentence out).
 *
 * @param iso    the server's `refundableUntil` (ISO instant)
 * @param zone   the booking's `timezone`
 * @param device the device's zone (defaults to the real one; for tests)
 */
export function formatCutoff(
  iso: unknown,
  zone: string | null | undefined,
  device: string | null = deviceTimeZone(),
): string {
  const at = toDate(iso);
  if (!at) return '';
  const local = asZoneLocal(at, zone);
  const time = format(local, 'h:mm a') + zoneSuffix(at, zone, device);
  return `${time} on ${format(local, 'EEE, d MMM')}`;
}

/**
 * The instant a booking's slot starts: `scheduledDate`'s UTC calendar day +
 * `scheduledTime` as wall clock in `zone` (the backend's `slotStartsAt`
 * rule). Null when the date cannot be read. An unknown zone reads the wall
 * clock as UTC (it is only used to pick the zone suffix).
 */
function slotInstant(
  scheduledDate: unknown,
  hour: number,
  minute: number,
  zone: string | null | undefined,
): Date | null {
  const day = toDate(scheduledDate);
  if (!day) return null;
  const naive = Date.UTC(
    day.getUTCFullYear(),
    day.getUTCMonth(),
    day.getUTCDate(),
    hour,
    minute,
  );
  if (!zone) return new Date(naive);
  // Two passes, as the backend does, so a DST change lands right.
  const first = offsetMinutes(new Date(naive), zone);
  if (first === null) return new Date(naive);
  const guess = naive - first * 60000;
  const second = offsetMinutes(new Date(guess), zone);
  return new Date(
    second === null || second === first ? guess : naive - second * 60000,
  );
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
 * japa#392: a booking's date and time as its own wall clock, for the
 * "New time" card: `{ date: "Tuesday, November 25, 2026", time: "3:00 PM" }`,
 * with " GMT+1" after the time when the booking's zone differs from the
 * device's. Null when the date cannot be read.
 */
export function bookingWhen(
  booking: {
    scheduledDate: unknown;
    scheduledTime?: string | null;
    timezone?: string | null;
  },
  device: string | null = deviceTimeZone(),
): { date: string; time: string } | null {
  const day = toDate(booking.scheduledDate);
  if (!day) return null;
  // The day picked is the stored date's UTC calendar day.
  const dateLocal = new Date(
    day.getUTCFullYear(),
    day.getUTCMonth(),
    day.getUTCDate(),
  );
  const clock = parseClock(booking.scheduledTime);
  if (!clock) {
    // No readable time: the date alone (never a made-up "12:00 AM").
    return { date: format(dateLocal, 'EEEE, MMMM d, yyyy'), time: '' };
  }
  const shown = new Date(
    day.getUTCFullYear(),
    day.getUTCMonth(),
    day.getUTCDate(),
    clock.hour,
    clock.minute,
  );
  const at = slotInstant(
    booking.scheduledDate,
    clock.hour,
    clock.minute,
    booking.timezone,
  );
  const suffix = at ? zoneSuffix(at, booking.timezone, device) : '';
  return {
    date: format(dateLocal, 'EEEE, MMMM d, yyyy'),
    time: format(shown, 'h:mm a') + suffix,
  };
}

/**
 * japa#392: a booking's day and time as the pay / confirmation route params
 * carry them (`dateIso` "yyyy-MM-dd", `time` "3:00 PM"), so a booking paid
 * after it moved confirms with its NEW slot, not the one first picked. Null
 * when the date cannot be read; `time` is '' when the time cannot.
 */
export function bookingRouteParams(booking: {
  scheduledDate: unknown;
  scheduledTime?: string | null;
}): { dateIso: string; time: string } | null {
  const day = toDate(booking.scheduledDate);
  if (!day) return null;
  const local = new Date(
    day.getUTCFullYear(),
    day.getUTCMonth(),
    day.getUTCDate(),
  );
  const clock = parseClock(booking.scheduledTime);
  const time = clock
    ? format(new Date(2000, 0, 1, clock.hour, clock.minute), 'h:mm a')
    : '';
  return { dateIso: format(local, 'yyyy-MM-dd'), time };
}
