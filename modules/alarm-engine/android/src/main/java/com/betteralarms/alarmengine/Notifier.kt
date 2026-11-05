package com.betteralarms.alarmengine

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.os.Build

/** Ordinary (non-ringing) notifications: holiday questions, backup-alarm heads-ups. */
object Notifier {
  private const val CHANNEL_ID = "reminders"
  const val BACKUP_NOTIFICATION_ID = 4343

  private fun ensureChannel(c: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = c.getSystemService(NotificationManager::class.java)
    if (nm.getNotificationChannel(CHANNEL_ID) != null) return
    nm.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "Reminders", NotificationManager.IMPORTANCE_DEFAULT).apply {
        description = "Questions about upcoming alarms and backup-alarm notices"
      },
    )
  }

  private fun openApp(c: Context): PendingIntent {
    val launch = c.packageManager.getLaunchIntentForPackage(c.packageName) ?: Intent()
    return PendingIntent.getActivity(c, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  @Suppress("DEPRECATION")
  private fun builder(c: Context): Notification.Builder {
    ensureChannel(c)
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(c, CHANNEL_ID)
    } else {
      Notification.Builder(c)
    }
  }

  fun info(c: Context, id: Int, title: String, body: String) {
    val n = builder(c)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(Notification.BigTextStyle().bigText(body))
      .setContentIntent(openApp(c))
      .setAutoCancel(true)
      .build()
    c.getSystemService(NotificationManager::class.java).notify(id, n)
  }

  fun backupScheduled(c: Context, backup: AlarmSpec, timeText: String) {
    val cancel = PendingIntent.getBroadcast(
      c,
      0,
      Intent(c, ActionReceiver::class.java).setAction(ActionReceiver.ACTION_CANCEL_BACKUP),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val n = builder(c)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle("Backup alarm at $timeText")
      .setContentText("Making sure you're up. Tap \"I'm up\" to cancel it.")
      .setContentIntent(openApp(c))
      .setOngoing(true)
      .addAction(Notification.Action.Builder(null as Icon?, "I'm up", cancel).build())
      .build()
    c.getSystemService(NotificationManager::class.java).notify(BACKUP_NOTIFICATION_ID, n)
  }

  fun timerNotificationId(timerId: String) = timerId.hashCode()

  /** Live countdown shown while a timer runs, with a Cancel button. */
  fun timerRunning(c: Context, timer: AlarmSpec) {
    val cancel = PendingIntent.getBroadcast(
      c,
      timerNotificationId(timer.id),
      Intent(c, ActionReceiver::class.java)
        .setAction(ActionReceiver.ACTION_CANCEL_TIMER)
        .putExtra(ActionReceiver.EXTRA_TIMER_ID, timer.id),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val n = builder(c)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle(timer.label)
      .setContentText("Timer running")
      .setUsesChronometer(true)
      .setChronometerCountDown(true)
      .setWhen(timer.time)
      .setShowWhen(true)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setContentIntent(openApp(c))
      .addAction(Notification.Action.Builder(null as Icon?, "Cancel", cancel).build())
      .build()
    c.getSystemService(NotificationManager::class.java).notify(timerNotificationId(timer.id), n)
  }

  fun cancel(c: Context, id: Int) {
    c.getSystemService(NotificationManager::class.java).cancel(id)
  }
}
