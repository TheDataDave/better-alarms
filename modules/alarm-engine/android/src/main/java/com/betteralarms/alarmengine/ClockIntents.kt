package com.betteralarms.alarmengine

import android.content.Intent
import android.provider.AlarmClock

/**
 * Android's standard "clock app" requests (AlarmClock.ACTION_SET_ALARM etc.),
 * sent by voice assistants and other apps. Converted to a plain map for JS.
 */
object ClockIntents {
  private const val HANDLED = "com.betteralarms.alarmengine.HANDLED"

  private val ACTIONS = mapOf(
    AlarmClock.ACTION_SET_ALARM to "SET_ALARM",
    AlarmClock.ACTION_SET_TIMER to "SET_TIMER",
    AlarmClock.ACTION_SHOW_ALARMS to "SHOW_ALARMS",
    AlarmClock.ACTION_SHOW_TIMERS to "SHOW_TIMERS",
  )

  fun read(intent: Intent): Map<String, Any?>? {
    val action = ACTIONS[intent.action] ?: return null
    // The launch intent stays attached to the activity; only hand it out once.
    if (intent.getBooleanExtra(HANDLED, false)) return null
    intent.putExtra(HANDLED, true)

    fun int(key: String) = if (intent.hasExtra(key)) intent.getIntExtra(key, 0) else null
    return mapOf(
      "action" to action,
      "hour" to int(AlarmClock.EXTRA_HOUR),
      "minutes" to int(AlarmClock.EXTRA_MINUTES),
      "message" to intent.getStringExtra(AlarmClock.EXTRA_MESSAGE),
      // java.util.Calendar days: 1 = Sunday ... 7 = Saturday.
      "days" to intent.getIntegerArrayListExtra(AlarmClock.EXTRA_DAYS)?.toList(),
      "lengthSeconds" to int(AlarmClock.EXTRA_LENGTH),
      "skipUi" to intent.getBooleanExtra(AlarmClock.EXTRA_SKIP_UI, false),
    )
  }
}
