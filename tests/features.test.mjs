import { test } from 'node:test';
import assert from 'node:assert/strict';

import { addDays, hhmmOf, toKey } from '../src/logic/dates.js';
import { usHolidays } from '../src/logic/holidays.js';
import { detectPattern } from '../src/logic/patterns.js';
import { computeAlarms, isRotationOnDay, planDays, PRESETS } from '../src/logic/schedule.js';

const at = (y, mo, d, h = 0, m = 0) => new Date(y, mo - 1, d, h, m).getTime();
const PANAMA = PRESETS.find((p) => p.label.startsWith('2-2-3')).pattern;

const calRule = (extra = {}) => ({
  id: 'c1', name: 'Work', enabled: true, type: 'calendar',
  keywords: 'work', calendarIds: [], leadMinutes: 60, allDayTime: '05:00', ...extra,
});
const shiftsOf = (alarms) => alarms.map((a) => [a.dateKey, hhmmOf(a.time)]);

test('a multi-day block (Fri 06:30 - Sun 18:45) is a shift on each day', () => {
  const events = [{ title: 'Work', start: at(2026, 11, 6, 6, 30), end: at(2026, 11, 8, 18, 45) }];
  const alarms = computeAlarms({ rules: [calRule()], events, now: at(2026, 11, 2), days: 14 });
  assert.deepEqual(shiftsOf(alarms), [
    ['2026-11-06', '05:30'],
    ['2026-11-07', '05:30'],
    ['2026-11-08', '05:30'],
  ]);
});

test('an overnight shift is one shift, and so is a 24h shift', () => {
  const events = [
    { title: 'Work nights', start: at(2026, 11, 6, 22), end: at(2026, 11, 7, 6) },
    { title: 'Work 24', start: at(2026, 11, 10, 7), end: at(2026, 11, 11, 7) },
  ];
  const alarms = computeAlarms({ rules: [calRule()], events, now: at(2026, 11, 2), days: 14 });
  assert.deepEqual(shiftsOf(alarms), [
    ['2026-11-06', '21:00'],
    ['2026-11-10', '06:00'],
  ]);
});

test('a block of night shifts (Fri 22:00 - Mon 06:00) is three shifts', () => {
  const events = [{ title: 'Work', start: at(2026, 11, 6, 22), end: at(2026, 11, 9, 6) }];
  const alarms = computeAlarms({ rules: [calRule()], events, now: at(2026, 11, 2), days: 14 });
  assert.deepEqual(alarms.map((a) => a.dateKey), ['2026-11-06', '2026-11-07', '2026-11-08']);
});

test('a rotation keeps its cycle years after the anchor', () => {
  const rule = { id: 'r', name: 'P', enabled: true, type: 'rotation', pattern: PANAMA, anchorDate: '2026-11-02', time: '05:00' };
  for (const offset of [0, 14 * 26, 14 * 26 * 3 + 5, 1000]) {
    const day = addDays('2026-11-02', offset);
    assert.equal(isRotationOnDay(rule, day), PANAMA[offset % 14], `offset ${offset}`);
  }
  // And the planner produces alarms that far out too.
  const plan = planDays({ rules: [rule], fromKey: '2029-03-01', days: 14, now: at(2029, 3, 1) });
  assert.equal(plan.filter((d) => d.alarms.length).length, 7);
});

// Panama shifts written into the calendar as multi-day blocks for Nov 2026 only.
function panamaCalendar(fromKey, toKeyExclusive) {
  const events = [];
  for (let k = fromKey; k < toKeyExclusive; k = addDays(k, 1)) {
    const on = PANAMA[(Math.round((new Date(k) - new Date(fromKey)) / 86400000) % 14 + 14) % 14];
    if (!on) continue;
    const [y, m, d] = k.split('-').map(Number);
    events.push({ title: 'Work', start: at(y, m, d, 6, 30), end: at(y, m, d, 18, 45) });
  }
  return events;
}

test('pattern detection finds the 2-2-3 cycle in calendar shifts', () => {
  const days = panamaCalendar('2026-11-02', '2026-12-01').map((e) => toKey(new Date(e.start)));
  const found = detectPattern(days);
  assert.equal(found.period, 14);
  assert.deepEqual(found.pattern, PANAMA);
  assert.equal(found.anchorDate, '2026-11-02');
});

test('pattern detection tolerates a missing shift and rejects too little data', () => {
  const days = panamaCalendar('2026-10-05', '2026-12-01').map((e) => toKey(new Date(e.start)));
  const withGap = days.filter((d) => d !== '2026-11-10');
  assert.deepEqual(detectPattern(withGap).pattern, PANAMA);
  assert.equal(detectPattern(days.slice(0, 5)), null);
});

test('weekday schedule is detected as a 7-day cycle', () => {
  const days = [];
  for (let k = '2026-10-05'; k < '2026-11-30'; k = addDays(k, 1)) {
    const dow = new Date(`${k}T12:00:00`).getDay();
    if (dow >= 1 && dow <= 5) days.push(k);
  }
  assert.equal(detectPattern(days).period, 7);
});

test('calendar alarms continue the detected cycle after the calendar runs out', () => {
  const events = panamaCalendar('2026-11-02', '2026-12-01');
  const now = at(2026, 11, 25);
  const withCont = computeAlarms({ rules: [calRule()], events, now, days: 21 });
  const expected = [];
  for (let k = '2026-11-25'; k < addDays('2026-11-25', 21); k = addDays(k, 1)) {
    const idx = Math.round((new Date(k) - new Date('2026-11-02')) / 86400000) % 14;
    if (PANAMA[idx]) expected.push(k);
  }
  assert.deepEqual(withCont.map((a) => a.dateKey), expected);
  assert.ok(withCont.some((a) => a.dateKey >= '2026-12-01' && a.fromPattern));
  assert.equal(hhmmOf(withCont.find((a) => a.fromPattern).time), '05:30');

  const without = computeAlarms({ rules: [calRule({ continuePattern: false })], events, now, days: 21 });
  assert.ok(without.every((a) => a.dateKey < '2026-12-01'));
});

test('US holidays land on the right dates', () => {
  const h = usHolidays(2026);
  assert.equal(h['2026-01-19'], 'Martin Luther King Jr. Day');
  assert.equal(h['2026-05-25'], 'Memorial Day');
  assert.equal(h['2026-09-07'], 'Labor Day');
  assert.equal(h['2026-11-26'], 'Thanksgiving');
  assert.equal(usHolidays(2027)['2027-11-25'], 'Thanksgiving');
});

test('alarms on a holiday ask for a decision, and "off" silences them', () => {
  const rule = { id: 'r', name: 'P', enabled: true, type: 'rotation', pattern: [true], anchorDate: '2026-11-01', time: '05:00' };
  const base = { rules: [rule], now: at(2026, 11, 25, 12), days: 3 };

  const undecided = computeAlarms(base);
  assert.deepEqual(undecided.map((a) => [a.dateKey, a.holiday, a.needsHolidayDecision]), [
    ['2026-11-26', 'Thanksgiving', true],
    ['2026-11-27', null, false],
  ]);

  const off = computeAlarms({ ...base, holidayDecisions: { '2026-11-26': 'off' } });
  assert.deepEqual(off.map((a) => a.dateKey), ['2026-11-27']);

  const work = computeAlarms({ ...base, holidayDecisions: { '2026-11-26': 'work' } });
  assert.equal(work[0].needsHolidayDecision, false);

  const ignored = computeAlarms({ ...base, settings: { holidays: { us: false } } });
  assert.equal(ignored[0].holiday, null);
});

test('holiday-calendar events are holidays, never work shifts', () => {
  const events = [
    { title: "Workers' Day", holiday: true, allDay: true, start: Date.UTC(2026, 10, 3), end: Date.UTC(2026, 10, 4) },
  ];
  const plan = planDays({ rules: [calRule()], events, now: at(2026, 11, 2), days: 3 });
  assert.equal(plan[1].holiday, "Workers' Day");
  assert.ok(plan.every((d) => d.alarms.length === 0));
});
