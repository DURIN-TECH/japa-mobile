// ─────────────────────────────────────────────────────────────────────────────
// Booking slot helpers (japa#472): the booking screen disables times that
// have already started today, shows "No times left today" after 5:00 PM,
// and drops a pick the clock has passed. All on a fixed device "now" (local
// time: the helpers use the device's own zone, as the pay screen does).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from '@jest/globals';
import {
  BOOKING_DAY_COUNT,
  BOOKING_SLOTS,
  bookingDays,
  isBookableDay,
  isPastSlot,
  noSlotsLeft,
  slotOptions,
  slotStart,
  validSelection,
} from '../bookingSlots';

/** A local date-time (month is 1-based here, for readability). */
const at = (y: number, mo: number, d: number, h = 0, mi = 0) =>
  new Date(y, mo - 1, d, h, mi, 0, 0);

/** "Now" for most tests: Sunday 22 November 2026, 1:00 PM local. */
const NOW = at(2026, 11, 22, 13, 0);
const TODAY = at(2026, 11, 22);
const TOMORROW = at(2026, 11, 23);

describe('BOOKING_SLOTS', () => {
  it('is the 17 half-hour slots from 9:00 AM to 5:00 PM', () => {
    expect(BOOKING_SLOTS).toHaveLength(17);
    expect(BOOKING_SLOTS[0]).toBe('9:00 AM');
    expect(BOOKING_SLOTS[6]).toBe('12:00 PM');
    expect(BOOKING_SLOTS[16]).toBe('5:00 PM');
  });
});

describe('slotStart', () => {
  it('reads a label on the local day', () => {
    expect(slotStart(TODAY, '11:00 AM')).toEqual(at(2026, 11, 22, 11, 0));
    expect(slotStart(TODAY, '1:30 PM')).toEqual(at(2026, 11, 22, 13, 30));
    expect(slotStart(TODAY, '12:00 PM')).toEqual(at(2026, 11, 22, 12, 0));
    expect(slotStart(TODAY, '12:30 AM')).toEqual(at(2026, 11, 22, 0, 30));
  });
  it('ignores the time of day carried by `day`', () => {
    expect(slotStart(at(2026, 11, 22, 18, 45), '9:00 AM')).toEqual(
      at(2026, 11, 22, 9, 0),
    );
  });
  it('is null for anything that is not a slot label', () => {
    expect(slotStart(TODAY, '13:00')).toBeNull();
    expect(slotStart(TODAY, '')).toBeNull();
  });
});

describe('isPastSlot: today vs a future date', () => {
  it('the reported case: 11:00 AM at 1:00 PM is past', () => {
    expect(isPastSlot(TODAY, '11:00 AM', NOW)).toBe(true);
  });
  it('the boundary minute: starting exactly now is past, one minute later is not', () => {
    expect(isPastSlot(TODAY, '1:00 PM', NOW)).toBe(true);
    expect(isPastSlot(TODAY, '1:00 PM', at(2026, 11, 22, 12, 59))).toBe(false);
    expect(isPastSlot(TODAY, '1:30 PM', NOW)).toBe(false);
  });
  it('no slot of a future day is past', () => {
    for (const s of BOOKING_SLOTS) {
      expect(isPastSlot(TOMORROW, s, NOW)).toBe(false);
    }
  });
  it('an unreadable label is never offered', () => {
    expect(isPastSlot(TOMORROW, 'soon', NOW)).toBe(true);
  });
});

describe('slotOptions', () => {
  it('today at 1:00 PM: 9:00 AM–1:00 PM disabled, 1:30 PM onwards open', () => {
    const opts = slotOptions(TODAY, NOW);
    const past = opts.filter((o) => o.past).map((o) => o.label);
    expect(past).toEqual([
      '9:00 AM',
      '9:30 AM',
      '10:00 AM',
      '10:30 AM',
      '11:00 AM',
      '11:30 AM',
      '12:00 PM',
      '12:30 PM',
      '1:00 PM',
    ]);
    expect(opts.find((o) => o.label === '1:30 PM')?.past).toBe(false);
  });
  it('a future day, or no day picked yet: nothing disabled', () => {
    expect(slotOptions(TOMORROW, NOW).some((o) => o.past)).toBe(false);
    expect(slotOptions(null, NOW).some((o) => o.past)).toBe(false);
  });
});

describe('noSlotsLeft (the all-past day)', () => {
  it('today after 5:00 PM has no times left', () => {
    expect(noSlotsLeft(TODAY, at(2026, 11, 22, 17, 0))).toBe(true);
    expect(noSlotsLeft(TODAY, at(2026, 11, 22, 21, 0))).toBe(true);
  });
  it('today just before 5:00 PM still has one', () => {
    expect(noSlotsLeft(TODAY, at(2026, 11, 22, 16, 59))).toBe(false);
  });
  it('tomorrow, and no day, always have times', () => {
    expect(noSlotsLeft(TOMORROW, at(2026, 11, 22, 23, 0))).toBe(false);
    expect(noSlotsLeft(null, NOW)).toBe(false);
  });
});

describe('bookingDays / isBookableDay', () => {
  it('today (at midnight) and the next 13 days', () => {
    const days = bookingDays(NOW);
    expect(days).toHaveLength(BOOKING_DAY_COUNT);
    expect(days[0]).toEqual(TODAY);
    expect(days[13]).toEqual(at(2026, 12, 5));
  });
  it('after midnight, yesterday is no longer bookable', () => {
    const afterMidnight = at(2026, 11, 23, 0, 5);
    expect(isBookableDay(TODAY, afterMidnight)).toBe(false);
    expect(isBookableDay(TOMORROW, afterMidnight)).toBe(true);
    expect(bookingDays(afterMidnight)[0]).toEqual(TOMORROW);
  });
});

describe('validSelection', () => {
  it('keeps a pick that is still in the future', () => {
    expect(validSelection(TODAY, '2:00 PM', NOW)).toEqual({
      day: TODAY,
      time: '2:00 PM',
    });
  });
  it('clears a time the clock has passed (Continue disabled again)', () => {
    expect(validSelection(TODAY, '1:00 PM', NOW)).toEqual({
      day: TODAY,
      time: null,
    });
  });
  it('clears a time that is past on the day just switched to (today)', () => {
    // 10:00 AM was picked on tomorrow, then the date switched to today.
    expect(validSelection(TODAY, '10:00 AM', NOW).time).toBeNull();
    expect(validSelection(TOMORROW, '10:00 AM', NOW).time).toBe('10:00 AM');
  });
  it('clears the day (and its time) once it falls off the strip at midnight', () => {
    expect(validSelection(TODAY, '4:00 PM', at(2026, 11, 23, 0, 1))).toEqual({
      day: null,
      time: null,
    });
  });
  it('nothing picked stays nothing', () => {
    expect(validSelection(null, null, NOW)).toEqual({ day: null, time: null });
  });
});
