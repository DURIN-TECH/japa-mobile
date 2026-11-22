/**
 * Booking slot helpers (japa#472)
 *
 * The booking screen (`src/app/book/[agentId].tsx`) offers a 14-day date
 * strip and 17 half-hour times, 9:00 AM to 5:00 PM. Before japa#472 every
 * time was offered on every day, so a client could pick 11:00 AM today at
 * 1:00 PM and pay for a meeting that had already started.
 *
 * These helpers decide, on the DEVICE clock and in the device's own zone
 * (the zone the pay screen sends as `timezone`), which times have already
 * started. The backend refuses such a slot anyway (400 SLOT_IN_PAST, the
 * real guard); this only stops the app offering it.
 *
 * "Started" matches the backend rule: a slot that starts exactly now counts
 * as started. There is no minimum lead time (a product decision, japa#477).
 *
 * Pure (no React, no clock of its own): every function takes `now`, so the
 * rules are unit-tested with a fixed time.
 */

import { addDays, addMinutes, format, isSameDay, startOfDay } from 'date-fns';

/** How many days the date strip offers, today included. */
export const BOOKING_DAY_COUNT = 14;

/** First slot of the day (hour, 24-hour clock). */
const FIRST_SLOT_HOUR = 9;
/** Number of half-hour slots: 9:00 AM through 5:00 PM inclusive. */
const SLOT_COUNT = 17;
/** Minutes between two slots. */
const SLOT_STEP_MINUTES = 30;

/**
 * The 17 slot labels as the screen shows them and the pay screen receives
 * them ("9:00 AM" … "5:00 PM", date-fns `h:mm a`). Built from a fixed
 * day so the list never depends on when the module loads.
 */
export const BOOKING_SLOTS: readonly string[] = Array.from(
  { length: SLOT_COUNT },
  (_, i) =>
    format(
      addMinutes(
        new Date(2000, 0, 1, FIRST_SLOT_HOUR, 0),
        i * SLOT_STEP_MINUTES,
      ),
      'h:mm a',
    ),
);

/** One slot label, e.g. "1:30 PM". */
const LABEL = /^(\d{1,2}):(\d{2}) (AM|PM)$/;

/**
 * When the slot `label` starts on the LOCAL calendar day of `day`, or null
 * when the label is not a `h:mm AM/PM` time. 12 AM is hour 0 and 12 PM is
 * hour 12, every other PM hour is 12 later.
 */
export function slotStart(day: Date, label: string): Date | null {
  const m = LABEL.exec(label);
  if (!m) return null;
  const hour = (Number(m[1]) % 12) + (m[3] === 'PM' ? 12 : 0);
  const start = startOfDay(day);
  start.setHours(hour, Number(m[2]), 0, 0);
  return start;
}

/**
 * True when the slot `label` on `day` has already started at `now` (starts
 * at or before it). Only today can have past slots: a later day never does,
 * and an unreadable label is treated as past (never offered).
 */
export function isPastSlot(day: Date, label: string, now: Date): boolean {
  const start = slotStart(day, label);
  if (!start) return true;
  return start.getTime() <= now.getTime();
}

/** One time pill: its label and whether it can still be picked. */
export interface SlotOption {
  label: string;
  /** True when the slot has started (shown disabled, not pressable). */
  past: boolean;
}

/**
 * The time pills for `day` at `now`. With no day picked yet nothing is
 * disabled (the strip starts unselected).
 */
export function slotOptions(day: Date | null, now: Date): SlotOption[] {
  return BOOKING_SLOTS.map((label) => ({
    label,
    past: day ? isPastSlot(day, label, now) : false,
  }));
}

/**
 * True when every slot of `day` has started (after 5:00 PM today): the
 * screen then shows "No times left today. Pick another day." instead of 17
 * disabled pills.
 */
export function noSlotsLeft(day: Date | null, now: Date): boolean {
  if (!day) return false;
  return BOOKING_SLOTS.every((label) => isPastSlot(day, label, now));
}

/**
 * The days the strip offers at `now`: local midnight of today and the next
 * 13 days. Re-computed when the screen regains focus, so a screen left open
 * past midnight does not keep offering yesterday.
 */
export function bookingDays(now: Date): Date[] {
  const today = startOfDay(now);
  return Array.from({ length: BOOKING_DAY_COUNT }, (_, i) => addDays(today, i));
}

/**
 * True when `day` is still one of the strip's days at `now` (today or up to
 * 13 days ahead). A day picked before midnight fails this after it.
 */
export function isBookableDay(day: Date, now: Date): boolean {
  return bookingDays(now).some((d) => isSameDay(d, day));
}

/**
 * What is still valid of a selection at `now` (japa#472): a picked day that
 * dropped off the strip is cleared (and its time with it), and a picked
 * time that has started is cleared. The screen applies this on every tick
 * and on focus, so Continue is disabled again as soon as the pick is gone.
 */
export function validSelection(
  day: Date | null,
  time: string | null,
  now: Date,
): { day: Date | null; time: string | null } {
  if (day && !isBookableDay(day, now)) return { day: null, time: null };
  if (day && time && isPastSlot(day, time, now)) return { day, time: null };
  return { day, time };
}
