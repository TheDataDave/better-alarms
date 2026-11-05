import { addDays, atTime, hhmmOf, keysBetween, toKey, toUtcKey } from './dates.js';

// A later day of a multi-day event only counts as a shift if at least this much
// of the event is left after that day's start time.
const MIN_SHIFT_MS = 2 * 3600000;

// Every local day an event touches. All-day events end at an exclusive midnight.
export function eventDays(event) {
  const toDayKey = event.allDay ? toUtcKey : toKey;
  const first = toDayKey(new Date(event.start));
  const last = toDayKey(new Date(Math.max(event.start, event.end - 1)));
  return keysBetween(first, last);
}

/**
 * The work shifts inside one calendar event, as [{ dateKey, start }].
 *
 * A block like "Fri 06:30 - Sun 18:45" is three shifts, each starting at 06:30.
 * An overnight "Fri 22:00 - Sat 06:00" is one shift. All-day events give one
 * shift per day with `start: null` (no start time known).
 */
export function eventShifts(event) {
  if (event.allDay) return eventDays(event).map((dateKey) => ({ dateKey, start: null }));
  const firstKey = toKey(new Date(event.start));
  const lastKey = toKey(new Date(Math.max(event.start, event.end - 1)));
  const startTime = hhmmOf(event.start);
  const shifts = [{ dateKey: firstKey, start: event.start }];
  for (const key of keysBetween(addDays(firstKey, 1), lastKey)) {
    const start = atTime(key, startTime);
    if (event.end - start >= MIN_SHIFT_MS) shifts.push({ dateKey: key, start });
  }
  return shifts;
}
