import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formatDuration, hhmmOf, nextDateFor } from '../src/logic/dates.js';
import { computeAlarms, describeRepeat } from '../src/logic/schedule.js';
import { cityTime, describeOffset } from '../src/logic/world-clock.js';

const at = (y, mo, d, h = 0, m = 0) => new Date(y, mo - 1, d, h, m).getTime();
const WEEKDAYS = [false, true, true, true, true, true, false];

test('a one-time alarm rings once, on its date', () => {
  const rule = { id: 'a', name: 'Dentist', enabled: true, type: 'single', date: '2026-11-06', time: '07:15' };
  const alarms = computeAlarms({ rules: [rule], now: at(2026, 11, 2), days: 14 });
  assert.deepEqual(alarms.map((a) => [a.dateKey, hhmmOf(a.time), a.label]), [['2026-11-06', '07:15', 'Dentist']]);
});

test('a weekly alarm rings on its weekdays', () => {
  const rule = { id: 'w', name: '', enabled: true, type: 'weekly', days: WEEKDAYS, time: '06:00' };
  // Nov 2 2026 is a Monday.
  const alarms = computeAlarms({ rules: [rule], now: at(2026, 11, 2), days: 7 });
  assert.deepEqual(alarms.map((a) => a.dateKey), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']);
  assert.equal(alarms[0].label, 'Alarm');
});

test('custom alarms ignore days off unless asked to follow them', () => {
  const events = [{ title: 'Vacation', allDay: true, start: Date.UTC(2026, 10, 3), end: Date.UTC(2026, 10, 4) }];
  const base = { id: 'w', name: 'Gym', enabled: true, type: 'weekly', days: WEEKDAYS, time: '06:00' };
  const opts = { events, settings: { offKeywords: 'vacation' }, now: at(2026, 11, 2, 12), days: 3 };

  const ignoring = computeAlarms({ ...opts, rules: [base] });
  assert.deepEqual(ignoring.map((a) => a.dateKey), ['2026-11-03', '2026-11-04']);

  const following = computeAlarms({ ...opts, rules: [{ ...base, followDaysOff: true }] });
  assert.deepEqual(following.map((a) => a.dateKey), ['2026-11-04']);
});

test('custom alarms are never asked about holidays', () => {
  const rule = { id: 'w', name: 'Gym', enabled: true, type: 'weekly', days: [true, true, true, true, true, true, true], time: '06:00' };
  const [thanksgiving] = computeAlarms({ rules: [rule], now: at(2026, 11, 25, 12), days: 2 });
  assert.equal(thanksgiving.dateKey, '2026-11-26');
  assert.equal(thanksgiving.needsHolidayDecision, false);
});

test('repeat descriptions read naturally', () => {
  assert.equal(describeRepeat({ type: 'weekly', days: WEEKDAYS }), 'Weekdays');
  assert.equal(describeRepeat({ type: 'weekly', days: [true, false, false, false, false, false, true] }), 'Weekends');
  assert.equal(describeRepeat({ type: 'weekly', days: Array(7).fill(true) }), 'Every day');
  assert.equal(describeRepeat({ type: 'weekly', days: [false, true, false, true, false, true, false] }), 'Mon, Wed, Fri');
});

test('next date for a time is today if still ahead, else tomorrow', () => {
  assert.equal(nextDateFor('07:00', at(2026, 11, 2, 6, 59)), '2026-11-02');
  assert.equal(nextDateFor('07:00', at(2026, 11, 2, 7, 0)), '2026-11-03');
  assert.equal(nextDateFor('00:30', at(2026, 12, 31, 23, 0)), '2027-01-01');
});

test('durations format like a timer', () => {
  assert.equal(formatDuration(65000), '1:05');
  assert.equal(formatDuration(3723000), '1:02:03');
  assert.equal(formatDuration(500), '0:01');
  assert.equal(formatDuration(-5), '0:00');
});

test('world clock offsets', () => {
  // 2026-07-01 12:00 UTC: Tokyo is 21:00, Kathmandu 17:45.
  const noonUtc = Date.UTC(2026, 6, 1, 12);
  const tokyo = cityTime('Asia/Tokyo', noonUtc);
  assert.equal(tokyo.time, '9:00 PM');
  const ktm = cityTime('Asia/Kathmandu', noonUtc);
  assert.equal(ktm.time, '5:45 PM');
  assert.equal(cityTime(Intl.DateTimeFormat().resolvedOptions().timeZone, noonUtc).hoursAhead, 0);
  assert.equal(describeOffset({ dayOffset: 1, hoursAhead: 14 }), 'Tomorrow, 14 hr ahead');
  assert.equal(describeOffset({ dayOffset: 0, hoursAhead: -5.5 }), 'Today, 5.5 hrs behind');
});
