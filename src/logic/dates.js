// Calendar days are handled as local 'YYYY-MM-DD' keys so that day math is
// immune to DST shifts (a "day" is never 23 or 25 hours here).

const pad = (n) => String(n).padStart(2, '0');

export function toKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// All-day events are stored by Android at UTC midnight, so read them in UTC.
export function toUtcKey(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return toKey(new Date(y, m - 1, d + n));
}

export function diffDays(fromKeyStr, toKeyStr) {
  const [y1, m1, d1] = fromKeyStr.split('-').map(Number);
  const [y2, m2, d2] = toKeyStr.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

// Inclusive list of day keys from `first` to `last` (capped at a year).
export function keysBetween(first, last) {
  const keys = [];
  for (let k = first; diffDays(k, last) >= 0 && keys.length < 366; k = addDays(k, 1)) keys.push(k);
  return keys;
}

// Local wall-clock 'HH:MM' of an epoch ms.
export function hhmmOf(ms) {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseTime(hhmm) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return { h, m };
}

export function formatTime(h, m) {
  return `${pad(h)}:${pad(m)}`;
}

// Epoch ms for a wall-clock time on a given local day.
export function atTime(key, hhmm) {
  const t = parseTime(hhmm);
  if (!t) return null;
  const [y, mo, d] = key.split('-').map(Number);
  return new Date(y, mo - 1, d, t.h, t.m).getTime();
}

/** The next day `hhmm` comes around: today if it's still ahead, else tomorrow. */
export function nextDateFor(hhmm, now = Date.now()) {
  const today = toKey(new Date(now));
  const at = atTime(today, hhmm);
  return at != null && at > now ? today : addDays(today, 1);
}

/** 65000 -> "1:05", 3723000 -> "1:02:03". Rounds up so a timer never shows 0:00 early. */
export function formatDuration(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function describeDay(key, todayKey = toKey(new Date())) {
  const offset = diffDays(todayKey, key);
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  const d = fromKey(key);
  return `${WEEKDAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function displayTime(ms) {
  const d = new Date(ms);
  const h = d.getHours();
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(d.getMinutes())} ${suffix}`;
}

export function displayHHMM(hhmm) {
  const t = parseTime(hhmm);
  if (!t) return hhmm;
  return displayTime(new Date(2000, 0, 1, t.h, t.m).getTime());
}
