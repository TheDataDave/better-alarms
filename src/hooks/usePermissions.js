import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';

import * as AlarmEngine from '../../modules/alarm-engine';
import { parseKeywords } from '../logic/schedule.js';
import { hasCalendarPermission, requestCalendarPermission } from '../services/calendar';

const needsNotificationPermission = Platform.OS === 'android' && Platform.Version >= 33;

export const PERMISSION_TEXT = {
  notifications: ['Notifications', 'Needed to show the ringing alarm.'],
  exactAlarms: ['Exact alarms', 'Lets alarms ring on the minute.'],
  fullScreen: ['Full-screen alarms', 'Shows the alarm over the lock screen.'],
  calendar: ['Calendar access', 'Needed for calendar schedules, days off and holidays.'],
};

/** Permissions still missing; calendar only counts if something uses it. */
export function missingPermissions(status, state) {
  const usesCalendar =
    state.rules.some((r) => r.type === 'calendar') || parseKeywords(state.settings.offKeywords).length > 0;
  return Object.keys(PERMISSION_TEXT).filter((k) => !status[k] && (k !== 'calendar' || usesCalendar));
}

async function checkAll() {
  return {
    notifications: needsNotificationPermission
      ? await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)
      : true,
    calendar: await hasCalendarPermission(),
    exactAlarms: AlarmEngine.canScheduleExactAlarms(),
    fullScreen: AlarmEngine.canUseFullScreenIntent(),
  };
}

/** Current permission status, re-checked whenever the app comes back to the foreground. */
export function usePermissions({ onCalendarGranted } = {}) {
  const [status, setStatus] = useState({ notifications: true, calendar: true, exactAlarms: true, fullScreen: true });
  const calendarGranted = useRef(null);
  const onGranted = useRef(onCalendarGranted);
  useEffect(() => {
    onGranted.current = onCalendarGranted;
  }, [onCalendarGranted]);

  const refresh = useCallback(
    () =>
      checkAll().then((next) => {
        // The first check only records the starting point.
        if (calendarGranted.current === false && next.calendar) onGranted.current?.();
        calendarGranted.current = next.calendar;
        setStatus(next);
      }),
    [],
  );

  useEffect(() => {
    refresh();
    // Settings screens are outside the app; re-check when the user comes back.
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  const fix = useMemo(
    () => ({
      notifications: () => PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).then(refresh),
      calendar: () => requestCalendarPermission().then(refresh),
      exactAlarms: AlarmEngine.openExactAlarmSettings,
      fullScreen: AlarmEngine.openFullScreenIntentSettings,
    }),
    [refresh],
  );

  return useMemo(() => ({ status, fix, refresh }), [status, fix, refresh]);
}
