import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'better-alarms/state/v1';

export const DEFAULT_SETTINGS = {
  offKeywords: 'vacation, pto, day off',
  snoozeMinutes: 10,
  lookaheadDays: 14,
  holidays: { us: true, phoneCalendars: true },
  alarm: {
    soundUri: null, // null = the phone's default alarm sound
    soundTitle: 'Phone default',
    vibrate: true,
    rampUp: false,
    backupMinutes: 0,
    challenge: 'none', // 'none' | 'math' | 'code' | 'pattern'
  },
  timer: {
    soundUri: null,
    soundTitle: 'Phone default',
    vibrate: true,
    challenge: 'none',
  },
};

export const DEFAULT_STATE = {
  rules: [],
  settings: DEFAULT_SETTINGS,
  skipped: [],
  holidayDecisions: {}, // { 'YYYY-MM-DD': 'work' | 'off' }
  notifiedHolidays: [], // days we've already sent a "working this holiday?" notification for
  // { id, label, durationMs, endAt (running) | remainingMs (paused) }
  timers: [],
  worldClocks: [], // city ids from src/logic/world-clock.js
  lastSync: null,
};

function withDefaults(saved) {
  const settings = saved.settings ?? {};
  return {
    ...DEFAULT_STATE,
    ...saved,
    settings: {
      ...DEFAULT_SETTINGS,
      ...settings,
      holidays: { ...DEFAULT_SETTINGS.holidays, ...settings.holidays },
      alarm: { ...DEFAULT_SETTINGS.alarm, ...settings.alarm },
      timer: { ...DEFAULT_SETTINGS.timer, ...settings.timer },
    },
  };
}

export async function loadState() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? withDefaults(JSON.parse(raw)) : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

export async function saveState(state) {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}

export function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
