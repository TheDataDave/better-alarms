package com.betteralarms.alarmengine

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/** Fired by AlarmManager at alarm time; hands off to the ringing service. */
class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val alarm = intent.getStringExtra(AlarmScheduler.EXTRA_ALARM) ?: return
    val service = Intent(context, AlarmService::class.java)
      .setAction(AlarmService.ACTION_RING)
      .putExtra(AlarmScheduler.EXTRA_ALARM, alarm)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(service)
    } else {
      context.startService(service)
    }
  }
}

/** Android drops all alarms on reboot, and clock changes can shift them; re-register. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    AlarmScheduler.rescheduleAll(context)
  }
}

/** Notification buttons that don't need the ringing service, e.g. "I'm up". */
class ActionReceiver : BroadcastReceiver() {
  companion object {
    const val ACTION_CANCEL_BACKUP = "com.betteralarms.alarmengine.CANCEL_BACKUP"
    const val ACTION_CANCEL_TIMER = "com.betteralarms.alarmengine.CANCEL_TIMER"
    const val EXTRA_TIMER_ID = "timerId"
  }

  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      ACTION_CANCEL_BACKUP -> AlarmScheduler.cancelPending(context, AlarmStore.BACKUP_ID)
      ACTION_CANCEL_TIMER -> intent.getStringExtra(EXTRA_TIMER_ID)?.let { AlarmScheduler.cancelTimer(context, it) }
    }
  }
}
