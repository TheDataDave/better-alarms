package com.betteralarms.alarmengine

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build

object AlarmScheduler {
  const val EXTRA_ALARM = "com.betteralarms.alarmengine.ALARM"

  private fun alarmManager(c: Context) = c.getSystemService(AlarmManager::class.java)

  fun canScheduleExact(c: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager(c).canScheduleExactAlarms()

  /** Cancels everything JS scheduled last time and registers the new list. */
  fun replaceAlarms(c: Context, alarms: List<AlarmSpec>) {
    AlarmStore.alarms(c).forEach { cancel(c, it.id) }
    AlarmStore.setAlarms(c, alarms)
    alarms.forEach { schedule(c, it) }
  }

  fun rescheduleAll(c: Context) {
    AlarmStore.all(c).forEach { schedule(c, it) }
  }

  fun schedule(c: Context, spec: AlarmSpec) {
    if (spec.time <= System.currentTimeMillis()) return
    val operation = PendingIntent.getBroadcast(
      c,
      0,
      fireIntent(c, spec.id).putExtra(EXTRA_ALARM, spec.toJson().toString()),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val am = alarmManager(c)
    try {
      // setAlarmClock is exempt from Doze and shows the alarm icon in the status bar.
      am.setAlarmClock(AlarmManager.AlarmClockInfo(spec.time, showAppIntent(c)), operation)
    } catch (e: SecurityException) {
      // Exact-alarm access was revoked; ring late rather than not at all.
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, spec.time, operation)
    }
  }

  fun startTimer(c: Context, timer: AlarmSpec) {
    AlarmStore.putTimer(c, timer)
    schedule(c, timer)
    Notifier.timerRunning(c, timer)
  }

  fun cancelTimer(c: Context, id: String) {
    cancel(c, id)
    AlarmStore.removeTimer(c, id)
    Notifier.cancel(c, Notifier.timerNotificationId(id))
  }

  /** Cancels a pending snooze or backup alarm. */
  fun cancelPending(c: Context, id: String) {
    cancel(c, id)
    AlarmStore.setPending(c, id, null)
    if (id == AlarmStore.BACKUP_ID) Notifier.cancel(c, Notifier.BACKUP_NOTIFICATION_ID)
  }

  fun cancel(c: Context, id: String) {
    val pending = PendingIntent.getBroadcast(
      c,
      0,
      fireIntent(c, id),
      PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
    ) ?: return
    alarmManager(c).cancel(pending)
    pending.cancel()
  }

  // The data URI makes each alarm's PendingIntent unique (extras don't count).
  private fun fireIntent(c: Context, id: String) =
    Intent(c, AlarmReceiver::class.java).setData(Uri.parse("betteralarms://alarm/" + Uri.encode(id)))

  private fun showAppIntent(c: Context): PendingIntent {
    val launch = c.packageManager.getLaunchIntentForPackage(c.packageName) ?: Intent()
    return PendingIntent.getActivity(
      c,
      0,
      launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }
}
