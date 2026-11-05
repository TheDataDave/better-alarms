package com.betteralarms.alarmengine

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * One alarm plus how it should behave when it rings.
 * `challenge` is "none", "math", "code" or "pattern" (a task needed to dismiss).
 * `backupMinutes` > 0 rings again that long after a dismiss, as a safety net.
 */
data class AlarmSpec(
  val id: String,
  val time: Long,
  val label: String,
  val snoozeMinutes: Int = 10,
  val soundUri: String? = null,
  val vibrate: Boolean = true,
  val rampUp: Boolean = false,
  val backupMinutes: Int = 0,
  val challenge: String = "none",
  val isBackup: Boolean = false,
) {
  fun toJson(): JSONObject = JSONObject()
    .put("id", id)
    .put("time", time)
    .put("label", label)
    .put("snoozeMinutes", snoozeMinutes)
    .put("soundUri", soundUri ?: JSONObject.NULL)
    .put("vibrate", vibrate)
    .put("rampUp", rampUp)
    .put("backupMinutes", backupMinutes)
    .put("challenge", challenge)
    .put("isBackup", isBackup)

  companion object {
    fun fromJson(o: JSONObject) = AlarmSpec(
      id = o.getString("id"),
      time = o.getLong("time"),
      label = o.optString("label", "Alarm"),
      snoozeMinutes = o.optInt("snoozeMinutes", 10),
      // optString turns JSON null into the string "null", so check explicitly.
      soundUri = if (o.isNull("soundUri")) null else o.optString("soundUri").ifEmpty { null },
      vibrate = o.optBoolean("vibrate", true),
      rampUp = o.optBoolean("rampUp", false),
      backupMinutes = o.optInt("backupMinutes", 0),
      challenge = o.optString("challenge", "none"),
      isBackup = o.optBoolean("isBackup", false),
    )
  }
}

/**
 * Persists alarms so they can be re-registered after a reboot, when Android
 * forgets every AlarmManager alarm. A pending snooze and backup alarm are kept
 * separately so a calendar re-sync from JS never wipes them out.
 */
object AlarmStore {
  const val SNOOZE_ID = "snooze"
  const val BACKUP_ID = "backup"
  const val TIMER_PREFIX = "timer:"
  private const val PREFS = "better_alarms"
  private const val KEY_ALARMS = "alarms"
  private const val KEY_TIMERS = "timers"

  private fun prefs(c: Context) = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun parse(json: String?): List<AlarmSpec> {
    if (json.isNullOrEmpty()) return emptyList()
    val arr = JSONArray(json)
    return (0 until arr.length()).map { AlarmSpec.fromJson(arr.getJSONObject(it)) }
  }

  fun alarms(c: Context): List<AlarmSpec> = parse(prefs(c).getString(KEY_ALARMS, null))

  /** The pending snooze or backup alarm (`id` is SNOOZE_ID or BACKUP_ID). */
  fun pending(c: Context, id: String): AlarmSpec? =
    prefs(c).getString(id, null)?.let { AlarmSpec.fromJson(JSONObject(it)) }

  fun all(c: Context): List<AlarmSpec> =
    alarms(c) + listOfNotNull(pending(c, SNOOZE_ID), pending(c, BACKUP_ID)) + timers(c)

  /** Running countdown timers; each is an alarm whose id starts with TIMER_PREFIX. */
  fun timers(c: Context): List<AlarmSpec> = parse(prefs(c).getString(KEY_TIMERS, null))

  fun putTimer(c: Context, spec: AlarmSpec) = saveTimers(c, timers(c).filter { it.id != spec.id } + spec)

  fun removeTimer(c: Context, id: String) = saveTimers(c, timers(c).filter { it.id != id })

  private fun saveTimers(c: Context, timers: List<AlarmSpec>) {
    prefs(c).edit().putString(KEY_TIMERS, JSONArray(timers.map { it.toJson() }).toString()).commit()
  }

  fun setAlarms(c: Context, alarms: List<AlarmSpec>) {
    prefs(c).edit().putString(KEY_ALARMS, JSONArray(alarms.map { it.toJson() }).toString()).commit()
  }

  fun setPending(c: Context, id: String, spec: AlarmSpec?) {
    prefs(c).edit().apply {
      if (spec == null) remove(id) else putString(id, spec.toJson().toString())
    }.commit()
  }
}
