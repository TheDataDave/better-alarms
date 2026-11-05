import { diffDays } from './dates.js';

/**
 * Finds the repeating on/off cycle behind a set of work days, e.g. the 14-day
 * 2-2-3 rotation behind a month of calendar shifts.
 *
 * Returns { pattern, anchorDate, period, confidence, lastWorkDay } or null when
 * there isn't enough history (6+ shifts over 2+ weeks, 1.5+ cycles) to be confident.
 */
export function detectPattern(
  workDays,
  { maxPeriod = 28, minCycles = 1.5, minConfidence = 0.9, minShifts = 6, minSpanDays = 14 } = {},
) {
  const keys = [...new Set(workDays)].sort();
  if (keys.length < minShifts) return null;
  const first = keys[0];
  const last = keys[keys.length - 1];
  const span = diffDays(first, last) + 1;
  if (span < minSpanDays) return null;
  const on = new Array(span).fill(false);
  for (const k of keys) on[diffDays(first, k)] = true;

  // Score each period by how often a day matches the day one period earlier.
  // Multiples of the true period score the same, so only clearly better
  // scores replace a shorter period.
  let best = null;
  for (let p = 1; p <= maxPeriod && span >= p * minCycles; p++) {
    let matches = 0;
    for (let i = p; i < span; i++) if (on[i] === on[i - p]) matches++;
    const score = matches / (span - p);
    if (score >= minConfidence && (!best || score > best.score + 0.02)) best = { p, score };
  }
  if (!best) return null;

  // Majority vote across cycles smooths over a missing or extra shift.
  const pattern = Array.from({ length: best.p }, (_, j) => {
    let yes = 0;
    let n = 0;
    for (let i = j; i < span; i += best.p) {
      n++;
      if (on[i]) yes++;
    }
    return yes * 2 >= n;
  });

  return { pattern, anchorDate: first, period: best.p, confidence: best.score, lastWorkDay: last };
}

/**
 * Event titles that repeat often enough to look like shifts, most frequent
 * first, e.g. ['Work', 'Shift B']. Used to suggest calendar keywords.
 */
export function frequentTitles(events, { minCount = 3, limit = 5 } = {}) {
  const counts = new Map();
  for (const e of events) {
    if (e.holiday || e.allDay || !e.title?.trim()) continue;
    const title = e.title.trim();
    counts.set(title, (counts.get(title) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([title]) => title);
}

// Most common value, ties broken by first seen.
export function mostCommon(values) {
  const counts = new Map();
  let best = null;
  for (const v of values) {
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (best === null || n > counts.get(best)) best = v;
  }
  return best;
}
