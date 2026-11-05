package com.betteralarms.alarmengine

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject

class AlarmEngineModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("AlarmEngine")

    // Another app or a voice assistant asked us to set an alarm/timer while we're open.
    Events("onClockIntent")
    OnNewIntent { intent ->
      ClockIntents.read(intent)?.let { sendEvent("onClockIntent", it) }
    }

    // The clock request (if any) the app was launched with. Returned only once.
    Function("takeLaunchIntent") {
      appContext.currentActivity?.intent?.let { ClockIntents.read(it) }
    }

    // Starts (or replaces) a countdown timer. JSON: AlarmSpec whose id starts with "timer:".
    Function("startTimer") { json: String ->
      AlarmScheduler.startTimer(context, AlarmSpec.fromJson(JSONObject(json)))
    }

    Function("cancelTimer") { id: String ->
      AlarmScheduler.cancelTimer(context, id)
    }

    // Replaces the full set of upcoming alarms. JSON: array of AlarmSpec objects.
    Function("setAlarms") { json: String ->
      AlarmScheduler.replaceAlarms(context, AlarmStore.parse(json))
    }

    Function("getScheduledAlarms") {
      JSONArray(AlarmStore.all(context).map { it.toJson() }).toString()
    }

    // Rings once in `seconds`, with the behaviour in `json` (an AlarmSpec without id/time).
    Function("ringIn") { seconds: Int, json: String ->
      val spec = AlarmSpec.fromJson(
        JSONObject(json).put("id", "test").put("time", System.currentTimeMillis() + seconds * 1000L),
      )
      AlarmScheduler.schedule(context, spec)
    }

    // Cancels a pending "snooze" or "backup" alarm.
    Function("cancelPending") { id: String ->
      AlarmScheduler.cancelPending(context, id)
    }

    Function("listAlarmSounds") {
      SoundPreview.listAlarmSounds(context)
    }

    Function("previewSound") { uri: String? ->
      SoundPreview.play(context, uri)
    }

    Function("stopPreview") {
      SoundPreview.stop()
    }

    Function("notify") { id: Int, title: String, body: String ->
      Notifier.info(context, id, title, body)
    }

    Function("canScheduleExactAlarms") {
      AlarmScheduler.canScheduleExact(context)
    }

    Function("canUseFullScreenIntent") {
      Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE ||
        context.getSystemService(NotificationManager::class.java).canUseFullScreenIntent()
    }

    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        openSettings(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
      }
    }

    Function("openFullScreenIntentSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        openSettings(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT)
      }
    }
  }

  private fun openSettings(action: String) {
    val intent = Intent(action, Uri.parse("package:" + context.packageName))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
  }
}
