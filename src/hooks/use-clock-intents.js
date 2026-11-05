import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ToastAndroid } from 'react-native';

import * as AlarmEngine from '../../modules/alarm-engine';
import { describeDay, displayHHMM, formatTime, nextDateFor } from '../logic/dates.js';
import { newId } from '../services/storage';
import { useApp } from '../state/app-store';

/**
 * Handles Android's standard clock requests from voice assistants and other
 * apps: "set an alarm for 7:30", "set a 10 minute timer", "show my alarms".
 */
export function useClockIntents() {
  const app = useApp();
  const appRef = useRef(app);
  useEffect(() => {
    appRef.current = app;
  });

  useEffect(() => {
    const handle = (req) => {
      if (!req) return;
      const { saveRule, startTimer } = appRef.current;

      if (req.action === 'SET_ALARM') {
        if (req.hour == null) return router.push('/alarm/new');
        const time = formatTime(req.hour, req.minutes ?? 0);
        const days = req.days?.length ? [1, 2, 3, 4, 5, 6, 7].map((d) => req.days.includes(d)) : null;
        const rule = days
          ? { id: newId(), name: req.message ?? '', enabled: true, type: 'weekly', days, time }
          : { id: newId(), name: req.message ?? '', enabled: true, type: 'single', date: nextDateFor(time), time };
        saveRule(rule);
        const when = days ? 'repeating' : describeDay(rule.date).toLowerCase();
        ToastAndroid.show(`Alarm set for ${displayHHMM(time)} ${when}`, ToastAndroid.SHORT);
        return router.navigate('/');
      }
      if (req.action === 'SET_TIMER') {
        if (req.lengthSeconds) {
          startTimer(req.lengthSeconds * 1000, req.message);
          ToastAndroid.show('Timer started', ToastAndroid.SHORT);
        }
        return router.navigate('/timer');
      }
      if (req.action === 'SHOW_TIMERS') return router.navigate('/timer');
      if (req.action === 'SHOW_ALARMS') return router.navigate('/');
    };

    // Wait a beat for saved state to load before acting on a launch request.
    const t = setTimeout(() => handle(AlarmEngine.takeLaunchIntent()), 500);
    const unsubscribe = AlarmEngine.addClockIntentListener(handle);
    return () => {
      clearTimeout(t);
      unsubscribe();
    };
  }, []);
}
