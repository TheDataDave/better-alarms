import { addDays, atTime, describeDay, diffDays, displayHHMM, fromKey, hhmmOf, toKey } from './dates.js';
import { eventDays, eventShifts } from './events.js';
import { holidayMap } from './holidays.js';
import { detectPattern, mostCommon } from './patterns.js';

export { eventDays, eventShifts };

/*
 * Rule shapes:
 *
 * Rotation: rings at `time` on the "on" days of a repeating cycle, forever.
 *   { id, name, enabled, type: 'rotation', pattern: [true, true, false, ...],
 *     anchorDate: 'YYYY-MM-DD' (day 1 of the cycle), time: 'HH:MM' }
 *
 * Calendar: rings before each shift found in calendar events whose title matches.
 *   { id, name, enabled, type: 'calendar', keywords: 'work, shift',
 *     calendarIds: [] (empty = every calendar), leadMinutes: 90,
 *     allDayTime: 'HH:MM' (for all-day events, which have no start time),
 *     continuePattern: true (after the last shift in the calendar, keep the
 *     detected rotation going) }
 *
 * Custom alarms, like a regular clock app:
 *   { id, name, enabled, type: 'single', date: 'YYYY-MM-DD', time: 'HH:MM' }   rings once
 *   { id, name, enabled, type: 'weekly', days: [7 booleans, Sunday first], time } repeats weekly
 *
 * Every rule may set `followDaysOff`: whether days-off events and holidays the
 * user marked "off" silence it. Work schedules default to true, custom alarms
 * to false (a personal alarm usually should ring regardless).
 *
 * Events are plain objects: { title, start, end (epoch ms), allDay, calendarId,
 * status, holiday (true if from a holiday calendar) }.
 */

export const CUSTOM_TYPES = ['single', 'weekly'];
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function followsDaysOff(rule) {
  return rule.followDaysOff ?? !CUSTOM_TYPES.includes(rule.type);
}

export const PRESETS = [
  { label: '2 on / 2 off', pattern: [1, 1, 0, 0] },
  { label: '2-2-3 (Panama)', pattern: [1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0] },
  { label: '3 on / 3 off', pattern: [1, 1, 1, 0, 0, 0] },
  { label: '4 on / 4 off', pattern: [1, 1, 1, 1, 0, 0, 0, 0] },
  { label: '4 on / 3 off', pattern: [1, 1, 1, 1, 0, 0, 0] },
  { label: '5 on / 2 off', pattern: [1, 1, 1, 1, 1, 0, 0] },
].map((p) => ({ ...p, pattern: p.pattern.map(Boolean) }));

export function parseKeywords(text) {
  return (text ?? '')
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
}

export function titleMatches(title, keywords) {
  const lower = (title ?? '').toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

export function isRotationOnDay(rule, key) {
  const { pattern } = rule;
  if (!pattern?.length) return false;
  const n = pattern.length;
  const idx = ((diffDays(rule.anchorDate, key) % n) + n) % n;
  return pattern[idx];
}

function liveEvents(events) {
  return events.filter((e) => e.status !== 'canceled');
}

/** Every shift a calendar rule finds in the events: [{ dateKey, alarmTime, event }]. */
export function calendarShifts(rule, events) {
  const keywords = parseKeywords(rule.keywords);
  if (!keywords.length) return [];
  const ids = rule.calendarIds ?? [];
  const lead = (Number(rule.leadMinutes) || 0) * 60000;

  const out = [];
  for (const e of liveEvents(events)) {
    if (e.holiday) continue;
    if (ids.length && !ids.includes(e.calendarId)) continue;
    if (!titleMatches(e.title, keywords)) continue;
    for (const s of eventShifts(e)) {
      const alarmTime = s.start == null ? atTime(s.dateKey, rule.allDayTime) : s.start - lead;
      if (alarmTime != null) out.push({ dateKey: s.dateKey, alarmTime, event: e.title });
    }
  }
  return out;
}

/**
 * The rotation behind a calendar rule's shifts, used to keep alarms going
 * after the last shift that's actually in the calendar. Null if no clear cycle.
 */
export function patternContinuation(rule, events) {
  const shifts = calendarShifts(rule, events);
  const detected = detectPattern(shifts.map((s) => s.dateKey));
  if (!detected) return null;
  return { ...detected, time: mostCommon(shifts.map((s) => hhmmOf(s.alarmTime))) };
}

function ruleShifts(rule, events, dayKeys) {
  const at = (keys) => keys.map((key) => ({ dateKey: key, alarmTime: atTime(key, rule.time) }));
  if (rule.type === 'single') return at(dayKeys.filter((key) => key === rule.date));
  if (rule.type === 'weekly') return at(dayKeys.filter((key) => rule.days?.[fromKey(key).getDay()]));
  if (rule.type !== 'calendar') return at(dayKeys.filter((key) => isRotationOnDay(rule, key)));

  const shifts = calendarShifts(rule, events);
  if (rule.continuePattern !== false) {
    const cont = patternContinuation(rule, events);
    if (cont) {
      for (const key of dayKeys) {
        if (diffDays(cont.lastWorkDay, key) > 0 && isRotationOnDay(cont, key)) {
          shifts.push({ dateKey: key, alarmTime: atTime(key, cont.time), fromPattern: true });
        }
      }
    }
  }
  return shifts;
}

function offKeywordDays(events, offKeywordsText) {
  const keywords = parseKeywords(offKeywordsText);
  const days = new Map();
  if (!keywords.length) return days;
  for (const e of events) {
    if (e.holiday || !titleMatches(e.title, keywords)) continue;
    for (const k of eventDays(e)) days.set(k, e.title);
  }
  return days;
}

/**
 * Day-by-day plan for [fromKey, fromKey + days): holidays, days off, and every
 * alarm with a status:
 *   active       will ring
 *   skipped      the user skipped this one
 *   past         already happened
 *   day-off      a days-off calendar event covers the day
 *   holiday-off  the user said this holiday is a day off
 *
 * Alarm ids (`ruleId@YYYY-MM-DD`) are stable, so skips survive re-syncs.
 */
export function planDays({
  rules,
  events = [],
  settings = {},
  skipped = [],
  holidayDecisions = {},
  now = Date.now(),
  fromKey,
  days = 14,
}) {
  const start = fromKey ?? toKey(new Date(now));
  const dayKeys = Array.from({ length: days }, (_, i) => addDays(start, i));
  const live = liveEvents(events);
  const offDays = offKeywordDays(live, settings.offKeywords);
  const holidays = holidayMap(dayKeys, live, settings.holidays);
  const skippedSet = new Set(skipped);

  const plan = new Map(
    dayKeys.map((k) => [
      k,
      {
        dateKey: k,
        holiday: holidays.get(k) ?? null,
        holidayDecision: holidayDecisions[k] ?? null,
        offEvent: offDays.get(k) ?? null,
        alarms: [],
      },
    ]),
  );

  for (const rule of rules) {
    if (!rule.enabled) continue;

    // One alarm per rule per day: the earliest wins (e.g. a split shift).
    const earliest = new Map();
    for (const s of ruleShifts(rule, live, dayKeys)) {
      if (!plan.has(s.dateKey)) continue;
      const prev = earliest.get(s.dateKey);
      if (!prev || s.alarmTime < prev.alarmTime) earliest.set(s.dateKey, s);
    }

    const followsOff = followsDaysOff(rule);
    for (const s of earliest.values()) {
      const day = plan.get(s.dateKey);
      const id = `${rule.id}@${s.dateKey}`;
      let status = 'active';
      if (s.alarmTime <= now) status = 'past';
      else if (followsOff && day.offEvent) status = 'day-off';
      else if (followsOff && day.holiday && day.holidayDecision === 'off') status = 'holiday-off';
      else if (skippedSet.has(id)) status = 'skipped';
      const name = rule.name || 'Alarm';
      // "Work · Night shift", but not "Work · Work".
      const addEvent = s.event && !name.toLowerCase().includes(s.event.toLowerCase());
      day.alarms.push({
        id,
        ruleId: rule.id,
        dateKey: s.dateKey,
        time: s.alarmTime,
        label: addEvent ? `${name} · ${s.event}` : name,
        fromPattern: !!s.fromPattern,
        followsDaysOff: followsOff,
        status,
      });
    }
  }

  const result = [...plan.values()];
  for (const day of result) day.alarms.sort((a, b) => a.time - b.time);
  return result;
}

/**
 * Upcoming alarms (active or skipped) in the window [today, today + days),
 * sorted by time. Each carries its day's holiday and whether the user still
 * needs to say if they're working it.
 */
export function computeAlarms(options) {
  return planDays(options)
    .flatMap((day) =>
      day.alarms
        .filter((a) => a.status === 'active' || a.status === 'skipped')
        .map((a) => ({
          ...a,
          skipped: a.status === 'skipped',
          holiday: a.followsDaysOff ? day.holiday : null,
          needsHolidayDecision: a.followsDaysOff && !!day.holiday && !day.holidayDecision,
        })),
    )
    .sort((a, b) => a.time - b.time);
}

export function describePattern(pattern) {
  const preset = PRESETS.find(
    (p) => p.pattern.length === pattern.length && p.pattern.every((v, i) => v === pattern[i]),
  );
  if (preset) return preset.label;
  // Run-length summary, e.g. "2 on, 2 off, 3 on, ..."
  const runs = [];
  for (const v of pattern) {
    const last = runs[runs.length - 1];
    if (last && last.on === v) last.n++;
    else runs.push({ on: v, n: 1 });
  }
  return runs.map((r) => `${r.n} ${r.on ? 'on' : 'off'}`).join(', ');
}

/** "Once · Fri Nov 6", "Every day", "Weekdays", "Mon, Wed, Fri". */
export function describeRepeat(rule) {
  if (rule.type === 'single') return `Once · ${describeDay(rule.date)}`;
  const days = rule.days ?? [];
  const picked = WEEKDAY_NAMES.filter((_, i) => days[i]);
  if (picked.length === 7) return 'Every day';
  if (picked.length === 5 && !days[0] && !days[6]) return 'Weekdays';
  if (picked.length === 2 && days[0] && days[6]) return 'Weekends';
  return picked.join(', ') || 'Never';
}

export function describeRule(rule) {
  if (CUSTOM_TYPES.includes(rule.type)) return `${displayHHMM(rule.time)} · ${describeRepeat(rule)}`;
  if (rule.type === 'calendar') {
    const kw = parseKeywords(rule.keywords).join(', ') || '(no keywords)';
    return `Calendar: "${kw}" · ${rule.leadMinutes} min before start`;
  }
  return `${describePattern(rule.pattern)} · ${displayHHMM(rule.time)}`;
}
