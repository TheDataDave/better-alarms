import { eventDays } from './events.js';

const pad = (n) => String(n).padStart(2, '0');
const key = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

// nth (1-based) weekday (0 = Sunday) of a month.
function nthWeekday(year, month, weekday, n) {
  const firstDow = new Date(year, month - 1, 1).getDay();
  return 1 + ((weekday - firstDow + 7) % 7) + (n - 1) * 7;
}

function lastWeekday(year, month, weekday) {
  const lastDate = new Date(year, month, 0).getDate();
  const lastDow = new Date(year, month - 1, lastDate).getDay();
  return lastDate - ((lastDow - weekday + 7) % 7);
}

/** US federal holidays for a year, as { 'YYYY-MM-DD': name }. */
export function usHolidays(year) {
  return {
    [key(year, 1, 1)]: "New Year's Day",
    [key(year, 1, nthWeekday(year, 1, 1, 3))]: 'Martin Luther King Jr. Day',
    [key(year, 2, nthWeekday(year, 2, 1, 3))]: "Presidents' Day",
    [key(year, 5, lastWeekday(year, 5, 1))]: 'Memorial Day',
    [key(year, 6, 19)]: 'Juneteenth',
    [key(year, 7, 4)]: 'Independence Day',
    [key(year, 9, nthWeekday(year, 9, 1, 1))]: 'Labor Day',
    [key(year, 10, nthWeekday(year, 10, 1, 2))]: 'Columbus Day',
    [key(year, 11, 11)]: 'Veterans Day',
    [key(year, 11, nthWeekday(year, 11, 4, 4))]: 'Thanksgiving',
    [key(year, 12, 25)]: 'Christmas Day',
  };
}

/**
 * Holidays falling on the given days, from the built-in US list and/or any
 * holiday calendar synced to the phone (events flagged `holiday: true`).
 */
export function holidayMap(dayKeys, events, settings = {}) {
  const wanted = new Set(dayKeys);
  const found = new Map();
  if (settings.us !== false) {
    const years = new Set(dayKeys.map((k) => Number(k.slice(0, 4))));
    for (const y of years) {
      for (const [k, name] of Object.entries(usHolidays(y))) if (wanted.has(k)) found.set(k, name);
    }
  }
  if (settings.phoneCalendars !== false) {
    for (const e of events) {
      if (!e.holiday) continue;
      for (const k of eventDays(e)) if (wanted.has(k)) found.set(k, e.title);
    }
  }
  return found;
}
