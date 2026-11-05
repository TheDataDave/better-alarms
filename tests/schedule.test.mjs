import { test } from 'node:test';
import assert from 'node:assert/strict';

import { addDays, atTime, diffDays, toKey } from '../src/logic/dates.js';
import { computeAlarms, eventDays, isRotationOnDay, PRESETS } from '../src/logic/schedule.js';

const at = (y, mo, d, h = 0, m = 0) => new Date(y, mo - 1, d, h, m).getTime();
// Android stores all-day events at UTC midnight.
const allDay = (title, y, mo, d, len = 1) => ({
  title,
  allDay: true,
  start: Date.UTC(y, mo - 1, d),
  end: Date.UTC(y, mo - 1, d + len),
});

const rotation = (pattern, anchorDate, extra = {}) => ({
  id: 'r1',
  name: 'Shift',
  enabled: true,
  type: 'rotation',
  pattern: pattern.map(Boolean),
  anchorDate,
  time: '06:00',
  ...extra,
});

test('day math survives DST transitions', () => {
  assert.equal(addDays('2026-03-07', 1), '2026-03-08');
  assert.equal(addDays('2026-03-08', 1), '2026-03-09');
  assert.equal(addDays('2026-11-01', 1), '2026-11-02');
  assert.equal(diffDays('2026-03-01', '2026-03-31'), 30);
  assert.equal(diffDays('2026-12-31', '2026-01-01'), -364);
});

test('rotation cycles forward and backward from the anchor', () => {
  const rule = rotation([1, 1, 0, 0], '2026-11-02');
  const days = ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'];
  assert.deepEqual(
    days.map((d) => isRotationOnDay(rule, d)),
    [true, false, false, true, true, false, false, true],
  );
});

test('2-2-3 preset repeats every 14 days', () => {
  const panama = PRESETS.find((p) => p.label.startsWith('2-2-3'));
  const rule = rotation(panama.pattern, '2026-01-05');
  for (let i = 0; i < 14; i++) {
    const day = addDays('2026-01-05', i);
    assert.equal(isRotationOnDay(rule, day), isRotationOnDay(rule, addDays(day, 14)));
  }
  assert.equal(panama.pattern.filter(Boolean).length, 7);
});

test('rotation alarms land at the wall-clock time and skip past times', () => {
  const now = at(2026, 11, 2, 7, 0); // after today's 06:00
  const alarms = computeAlarms({ rules: [rotation([1, 1, 0, 0], '2026-11-02')], now, days: 8 });
  assert.deepEqual(alarms.map((a) => a.dateKey), ['2026-11-03', '2026-11-06', '2026-11-07']);
  assert.equal(new Date(alarms[0].time).getHours(), 6);
});

test('alarm stays at 06:00 local across the DST change', () => {
  const now = at(2026, 3, 6, 12);
  const alarms = computeAlarms({ rules: [rotation([1], '2026-03-01')], now, days: 4 });
  for (const a of alarms) {
    assert.equal(new Date(a.time).getHours(), 6);
    assert.equal(new Date(a.time).getMinutes(), 0);
  }
});

test('calendar rule rings lead minutes before matching shifts only', () => {
  const rule = {
    id: 'c1', name: 'Work', enabled: true, type: 'calendar',
    keywords: 'work, shift', calendarIds: [], leadMinutes: 90, allDayTime: '05:30',
  };
  const events = [
    { title: 'Work - Store 12', start: at(2026, 11, 3, 8), end: at(2026, 11, 3, 16) },
    { title: 'Dentist', start: at(2026, 11, 4, 8), end: at(2026, 11, 4, 9) },
    { title: 'Night SHIFT', start: at(2026, 11, 5, 22), end: at(2026, 11, 6, 6) },
    { title: 'Work', start: at(2026, 11, 6, 9), end: at(2026, 11, 6, 17), status: 'canceled' },
    allDay('Work', 2026, 11, 7),
  ];
  const alarms = computeAlarms({ rules: [rule], events, now: at(2026, 11, 2, 12), days: 14 });
  assert.deepEqual(
    alarms.map((a) => [a.dateKey, toKey(new Date(a.time)), new Date(a.time).getHours(), new Date(a.time).getMinutes()]),
    [
      ['2026-11-03', '2026-11-03', 6, 30],
      ['2026-11-05', '2026-11-05', 20, 30],
      ['2026-11-07', '2026-11-07', 5, 30],
    ],
  );
});

test('calendar rule can be limited to specific calendars', () => {
  const rule = {
    id: 'c1', name: 'Work', enabled: true, type: 'calendar',
    keywords: 'work', calendarIds: ['job'], leadMinutes: 60, allDayTime: '06:00',
  };
  const events = [
    { title: 'Work', calendarId: 'job', start: at(2026, 11, 3, 8), end: at(2026, 11, 3, 16) },
    { title: 'Work on car', calendarId: 'personal', start: at(2026, 11, 4, 8), end: at(2026, 11, 4, 9) },
  ];
  const alarms = computeAlarms({ rules: [rule], events, now: at(2026, 11, 2), days: 7 });
  assert.deepEqual(alarms.map((a) => a.dateKey), ['2026-11-03']);
});

test('only the earliest shift of a day gets an alarm', () => {
  const rule = {
    id: 'c1', name: 'Work', enabled: true, type: 'calendar',
    keywords: 'work', calendarIds: [], leadMinutes: 60, allDayTime: '06:00',
  };
  const events = [
    { title: 'Work (pm)', start: at(2026, 11, 3, 17), end: at(2026, 11, 3, 21) },
    { title: 'Work (am)', start: at(2026, 11, 3, 7), end: at(2026, 11, 3, 11) },
  ];
  const alarms = computeAlarms({ rules: [rule], events, now: at(2026, 11, 2), days: 7 });
  assert.equal(alarms.length, 1);
  assert.equal(new Date(alarms[0].time).getHours(), 6);
});

test('off-day keywords silence every rule, including multi-day vacations', () => {
  const events = [allDay('Vacation', 2026, 11, 3, 3)]; // Nov 3, 4, 5
  const alarms = computeAlarms({
    rules: [rotation([1], '2026-11-01')],
    events,
    settings: { offKeywords: 'vacation, pto' },
    now: at(2026, 11, 2, 12),
    days: 6,
  });
  assert.deepEqual(alarms.map((a) => a.dateKey), ['2026-11-06', '2026-11-07']);
});

test('all-day events map to the right local day regardless of timezone', () => {
  assert.deepEqual(eventDays(allDay('PTO', 2026, 11, 3)), ['2026-11-03']);
  assert.deepEqual(eventDays(allDay('PTO', 2026, 12, 31, 2)), ['2026-12-31', '2027-01-01']);
});

test('skips are kept by id, and disabled rules produce nothing', () => {
  const now = at(2026, 11, 2, 0, 0);
  const rules = [rotation([1], '2026-11-01'), rotation([1], '2026-11-01', { id: 'r2', enabled: false })];
  const alarms = computeAlarms({ rules, skipped: ['r1@2026-11-03'], now, days: 3 });
  assert.deepEqual(alarms.map((a) => [a.id, a.skipped]), [
    ['r1@2026-11-02', false],
    ['r1@2026-11-03', true],
    ['r1@2026-11-04', false],
  ]);
});

test('atTime rejects bad input', () => {
  assert.equal(atTime('2026-11-02', '25:00'), null);
  assert.equal(atTime('2026-11-02', 'nope'), null);
});
