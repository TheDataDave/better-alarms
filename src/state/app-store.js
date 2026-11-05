import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import * as AlarmEngine from '../../modules/alarm-engine';
import { atTime, formatDuration, nextDateFor } from '../logic/dates.js';
import { usePermissions } from '../hooks/usePermissions';
import { registerBackgroundSync } from '../services/background';
import { loadState, newId, saveState } from '../services/storage';
import { cachedEvents, syncAlarms } from '../services/sync';

const AppContext = createContext(null);

/**
 * Holds the saved state (schedules, alarms, timers, settings), the computed
 * upcoming alarms, and the actions every screen uses. Changes that affect
 * alarms re-sync them with Android; timers and world clocks just save.
 */
export function AppStoreProvider({ children }) {
  const [state, setState] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [pending, setPending] = useState([]); // snooze / backup alarms waiting to ring
  const [warnings, setWarnings] = useState([]);
  const [syncing, setSyncing] = useState(false);

  const resync = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await syncAlarms();
      if (result.ok) setUpcoming(result.alarms);
      setWarnings(result.warnings);
      setState(await loadState());
    } catch (e) {
      setWarnings([`Sync failed: ${e.message}`]);
    } finally {
      setPending(AlarmEngine.getScheduledAlarms().filter((a) => a.id === 'snooze' || a.id === 'backup'));
      setSyncing(false);
    }
  }, []);

  const save = useCallback(async (mutate) => {
    const next = mutate(await loadState());
    await saveState(next);
    setState(next);
    return next;
  }, []);

  const update = useCallback(
    async (mutate) => {
      await save(mutate);
      await resync();
    },
    [save, resync],
  );

  // Granting calendar access re-syncs so calendar alarms show up immediately.
  const permissions = usePermissions({ onCalendarGranted: resync });

  useEffect(() => {
    loadState().then((saved) => {
      setState(saved);
      resync();
    });
    registerBackgroundSync().catch(() => {});
    // Calendar may have changed (or an alarm rung) while we were away.
    const sub = AppState.addEventListener('change', (s) => s === 'active' && resync());
    return () => sub.remove();
  }, [resync]);

  const value = useMemo(() => {
    // Applies `change(timer, now)` to one timer and keeps Android in step with it.
    const changeTimer = (id, change) =>
      save((s) => {
        const now = Date.now();
        const timers = s.timers.map((t) => (t.id === id ? change(t, now) : t));
        const t = timers.find((x) => x.id === id);
        if (t?.endAt) AlarmEngine.startTimer(t, s.settings);
        else AlarmEngine.cancelTimer(id);
        return { ...s, timers };
      });

    return {
      state,
      upcoming,
      pending,
      warnings,
      syncing,
      permissions,
      events: cachedEvents(),
      resync,
      update,
      saveRule: (rule) =>
        update((s) => {
          const exists = s.rules.some((r) => r.id === rule.id);
          return { ...s, rules: exists ? s.rules.map((r) => (r.id === rule.id ? rule : r)) : [...s.rules, rule] };
        }),
      deleteRule: (id) => update((s) => ({ ...s, rules: s.rules.filter((r) => r.id !== id) })),
      setRuleEnabled: (id, enabled) =>
        update((s) => ({
          ...s,
          rules: s.rules.map((r) => {
            if (r.id !== id) return r;
            // Re-enabling a one-time alarm that already rang moves it to its next occurrence.
            const stale = enabled && r.type === 'single' && atTime(r.date, r.time) <= Date.now();
            return { ...r, enabled, ...(stale && { date: nextDateFor(r.time) }) };
          }),
        })),
      updateSettings: (patch) => update((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
      updateAlarmSettings: (patch) =>
        update((s) => ({ ...s, settings: { ...s.settings, alarm: { ...s.settings.alarm, ...patch } } })),
      updateTimerSettings: (patch) =>
        save((s) => ({ ...s, settings: { ...s.settings, timer: { ...s.settings.timer, ...patch } } })),
      toggleSkip: (alarmId) =>
        update((s) => ({
          ...s,
          skipped: s.skipped.includes(alarmId) ? s.skipped.filter((x) => x !== alarmId) : [...s.skipped, alarmId],
        })),
      decideHoliday: (dateKey, decision) =>
        update((s) => {
          const holidayDecisions = { ...s.holidayDecisions };
          if (decision) holidayDecisions[dateKey] = decision;
          else delete holidayDecisions[dateKey];
          return { ...s, holidayDecisions };
        }),
      cancelPending: (id) => {
        AlarmEngine.cancelPending(id);
        resync();
      },

      startTimer: (durationMs, label) =>
        save((s) => {
          const timer = {
            id: newId(),
            label: label?.trim() || `${formatDuration(durationMs)} timer`,
            durationMs,
            endAt: Date.now() + durationMs,
          };
          AlarmEngine.startTimer(timer, s.settings);
          return { ...s, timers: [...s.timers, timer] };
        }),
      pauseTimer: (id) => changeTimer(id, (t, now) => ({ ...t, endAt: null, remainingMs: Math.max(0, t.endAt - now) })),
      resumeTimer: (id) => changeTimer(id, (t, now) => ({ ...t, endAt: now + t.remainingMs, remainingMs: null })),
      addMinute: (id) =>
        changeTimer(id, (t, now) =>
          t.endAt ? { ...t, endAt: Math.max(t.endAt, now) + 60000 } : { ...t, remainingMs: t.remainingMs + 60000 },
        ),
      resetTimer: (id) => changeTimer(id, (t) => ({ ...t, endAt: null, remainingMs: t.durationMs })),
      restartTimer: (id) => changeTimer(id, (t, now) => ({ ...t, endAt: now + t.durationMs, remainingMs: null })),
      removeTimer: (id) => {
        AlarmEngine.cancelTimer(id);
        return save((s) => ({ ...s, timers: s.timers.filter((t) => t.id !== id) }));
      },

      addWorldClock: (cityId) =>
        save((s) => ({ ...s, worldClocks: s.worldClocks.includes(cityId) ? s.worldClocks : [...s.worldClocks, cityId] })),
      removeWorldClock: (cityId) => save((s) => ({ ...s, worldClocks: s.worldClocks.filter((c) => c !== cityId) })),
    };
  }, [state, upcoming, pending, warnings, syncing, permissions, resync, update, save]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
