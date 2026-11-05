const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

// Lets Better Alarms answer Android's standard clock requests ("set an alarm
// for 7", "set a 10 minute timer") from voice assistants and other apps, so it
// can stand in for the built-in Clock app.
const ACTIONS = [
  'android.intent.action.SET_ALARM',
  'android.intent.action.SET_TIMER',
  'android.intent.action.SHOW_ALARMS',
  'android.intent.action.SHOW_TIMERS',
];

module.exports = function withClockIntents(config) {
  return withAndroidManifest(config, (c) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(c.modResults);
    activity['intent-filter'] = activity['intent-filter'] ?? [];
    const has = (action) =>
      activity['intent-filter'].some((f) => f.action?.some((a) => a.$['android:name'] === action));
    for (const action of ACTIONS) {
      if (has(action)) continue;
      activity['intent-filter'].push({
        action: [{ $: { 'android:name': action } }],
        category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
      });
    }
    return c;
  });
};
