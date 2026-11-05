import { requireOptionalNativeModule } from 'expo';

// Missing in Expo Go and on non-Android platforms; calls become no-ops there
// so the UI can still be previewed.
const native = requireOptionalNativeModule('AlarmEngine');

export const isAvailable = native != null;

// How an alarm behaves when it rings, from the user's wake-up settings.
export function ringBehavior(settings) {
  const a = settings.alarm;
  return {
    snoozeMinutes: settings.snoozeMinutes,
    soundUri: a.soundUri,
    vibrate: a.vibrate,
    rampUp: a.rampUp,
    backupMinutes: a.backupMinutes,
    challenge: a.challenge,
  };
}

// Timers ring with their own sound and turn-off settings; no ramp or backup.
export function timerBehavior(settings) {
  const t = settings.timer;
  return {
    snoozeMinutes: 1,
    soundUri: t.soundUri,
    vibrate: t.vibrate,
    rampUp: false,
    backupMinutes: 0,
    challenge: t.challenge,
  };
}

export const timerNativeId = (id) => `timer:${id}`;

export function startTimer({ id, endAt, label }, settings) {
  native?.startTimer(JSON.stringify({ id: timerNativeId(id), time: endAt, label, ...timerBehavior(settings) }));
}

export const cancelTimer = (id) => native?.cancelTimer(timerNativeId(id));

/** The "set alarm / set timer" request the app was opened with, if any (once). */
export const takeLaunchIntent = () => native?.takeLaunchIntent() ?? null;

/** Requests that arrive while the app is already open. Returns an unsubscribe function. */
export function addClockIntentListener(listener) {
  const sub = native?.addListener('onClockIntent', listener);
  return () => sub?.remove();
}

export function setAlarms(alarms, settings) {
  const behavior = ringBehavior(settings);
  const payload = alarms.map(({ id, time, label }) => ({ id, time, label, ...behavior }));
  native?.setAlarms(JSON.stringify(payload));
}

export function getScheduledAlarms() {
  return native ? JSON.parse(native.getScheduledAlarms()) : [];
}

export function ringIn(seconds, settings, label = 'Test alarm') {
  native?.ringIn(seconds, JSON.stringify({ label, ...ringBehavior(settings) }));
}

export const cancelPending = (id) => native?.cancelPending(id);

export function listAlarmSounds() {
  return native ? JSON.parse(native.listAlarmSounds()) : [];
}

export const previewSound = (uri) => native?.previewSound(uri ?? null);
export const stopPreview = () => native?.stopPreview();
export const notify = (id, title, body) => native?.notify(id, title, body);

export const canScheduleExactAlarms = () => native?.canScheduleExactAlarms() ?? true;
export const canUseFullScreenIntent = () => native?.canUseFullScreenIntent() ?? true;
export const openExactAlarmSettings = () => native?.openExactAlarmSettings();
export const openFullScreenIntentSettings = () => native?.openFullScreenIntentSettings();
