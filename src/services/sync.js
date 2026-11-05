import * as AlarmEngine from '../../modules/alarm-engine';
import { addDays, atTime, describeDay, displayTime, toKey } from '../logic/dates.js';
import { computeAlarms } from '../logic/schedule.js';
import { fetchEvents, hasCalendarPermission } from './calendar';
import { loadState, saveState } from './storage';

// History lets us spot the rotation behind calendar shifts; the future window
// lets us see where the calendar's shifts stop.
const HISTORY_DAYS = 120;
const FUTURE_DAYS = 180;
// How far ahead we ask "are you working this holiday?" by notification.
const HOLIDAY_NOTICE_DAYS = 7;

let lastEvents = [];

/** Calendar events from the last sync, for screens that preview schedules. */
export function cachedEvents() {
  return lastEvents;
}

export async function loadEvents() {
  const today = toKey(new Date());
  lastEvents = await fetchEvents(
    new Date(atTime(addDays(today, -HISTORY_DAYS), '00:00')),
    new Date(atTime(addDays(today, FUTURE_DAYS), '00:00')),
  );
  return lastEvents;
}

function notifyHolidayQuestions(alarms, alreadyNotified) {
  const soon = Date.now() + HOLIDAY_NOTICE_DAYS * 86400000;
  const notified = [];
  for (const a of alarms) {
    if (!a.needsHolidayDecision || a.skipped || a.time > soon) continue;
    if (alreadyNotified.includes(a.dateKey) || notified.includes(a.dateKey)) continue;
    AlarmEngine.notify(
      Number(a.dateKey.replace(/-/g, '')),
      `Working on ${a.holiday}?`,
      `You have a ${displayTime(a.time)} alarm ${describeDay(a.dateKey).toLowerCase()}. ` +
        "Open Better Alarms to keep it or take the day off. If you don't answer, it will still ring.",
    );
    notified.push(a.dateKey);
  }
  return notified;
}

/**
 * Recomputes every alarm from the rules + calendar and hands them to Android.
 * If the calendar can't be read, the previously scheduled alarms are left
 * untouched rather than wiped - a missed alarm is worse than an extra one.
 */
export async function syncAlarms() {
  const state = await loadState();

  // Without calendar access, calendar rules simply find no shifts; the setup
  // card on the Alarms screen asks for the permission.
  let events = [];
  if (await hasCalendarPermission()) {
    try {
      events = await loadEvents();
    } catch (e) {
      return { ok: false, alarms: [], warnings: [`Couldn't read calendar, kept existing alarms: ${e.message}`] };
    }
  }

  // One-time alarms switch themselves off once they've rung, like a regular clock.
  const now = Date.now();
  const rules = state.rules.map((r) =>
    r.type === 'single' && r.enabled && atTime(r.date, r.time) <= now ? { ...r, enabled: false } : r,
  );

  const todayKey = toKey(new Date());
  const skipped = state.skipped.filter((id) => id.split('@')[1] >= todayKey);
  const holidayDecisions = Object.fromEntries(
    Object.entries(state.holidayDecisions).filter(([k]) => k >= todayKey),
  );
  const alarms = computeAlarms({
    rules,
    events,
    settings: state.settings,
    skipped,
    holidayDecisions,
    days: state.settings.lookaheadDays,
  });

  AlarmEngine.setAlarms(
    alarms.filter((a) => !a.skipped),
    state.settings,
  );
  const stillRelevant = state.notifiedHolidays.filter((k) => k >= todayKey);
  const newlyNotified = notifyHolidayQuestions(alarms, stillRelevant);

  await saveState({
    ...state,
    rules,
    skipped,
    holidayDecisions,
    notifiedHolidays: [...stillRelevant, ...newlyNotified],
    lastSync: Date.now(),
  });

  return { ok: true, alarms, warnings: [] };
}
