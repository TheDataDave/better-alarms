package com.betteralarms.alarmengine

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.drawable.Icon
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.text.format.DateFormat
import org.json.JSONObject

/**
 * Foreground service that owns a ringing alarm: loops the alarm sound, vibrates,
 * and posts a full-screen notification with Snooze / Dismiss.
 */
class AlarmService : Service() {
  companion object {
    const val ACTION_RING = "com.betteralarms.alarmengine.RING"
    const val ACTION_SNOOZE = "com.betteralarms.alarmengine.SNOOZE"
    const val ACTION_DISMISS = "com.betteralarms.alarmengine.DISMISS"
    private const val CHANNEL_ID = "ringing_alarms"
    private const val NOTIFICATION_ID = 4242
    private const val AUTO_STOP_MS = 10 * 60 * 1000L
    private const val RAMP_MS = 30_000L
    private const val RAMP_STEP_MS = 1_000L

    @Volatile
    var ringing: AlarmSpec? = null
      private set

    val alarmAudio: AudioAttributes = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()

    /** The chosen sound first, then the system defaults, so something always plays. */
    fun soundCandidates(c: Context, chosen: String?): List<Uri> = listOfNotNull(
      chosen?.let { Uri.parse(it) },
      RingtoneManager.getActualDefaultRingtoneUri(c, RingtoneManager.TYPE_ALARM),
      RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
      RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
      RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
    )
  }

  private var player: MediaPlayer? = null
  private var vibrator: Vibrator? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private val handler = Handler(Looper.getMainLooper())
  private val autoStop = Runnable { stopRinging() }
  private var rampStartedAt = 0L
  private val ramp = object : Runnable {
    override fun run() {
      val volume = ((System.currentTimeMillis() - rampStartedAt).toFloat() / RAMP_MS).coerceIn(0.05f, 1f)
      player?.setVolume(volume, volume)
      if (volume < 1f) handler.postDelayed(this, RAMP_STEP_MS)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_RING -> {
        val spec = intent.getStringExtra(AlarmScheduler.EXTRA_ALARM)
          ?.let { AlarmSpec.fromJson(JSONObject(it)) }
          ?: AlarmSpec("unknown", System.currentTimeMillis(), "Alarm")
        startRinging(spec)
      }
      ACTION_SNOOZE -> snooze()
      ACTION_DISMISS -> dismiss()
      else -> stopRinging()
    }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    releaseResources()
    super.onDestroy()
  }

  private fun startRinging(spec: AlarmSpec) {
    ringing = spec
    if (spec.id == AlarmStore.SNOOZE_ID || spec.id == AlarmStore.BACKUP_ID) {
      AlarmStore.setPending(this, spec.id, null)
    }
    if (spec.id == AlarmStore.BACKUP_ID) Notifier.cancel(this, Notifier.BACKUP_NOTIFICATION_ID)
    if (spec.id.startsWith(AlarmStore.TIMER_PREFIX)) {
      AlarmStore.removeTimer(this, spec.id)
      Notifier.cancel(this, Notifier.timerNotificationId(spec.id))
    }

    ensureChannel()
    val notification = buildNotification(spec)
    // Must be called promptly after startForegroundService(), before anything slow.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }

    if (wakeLock == null) {
      wakeLock = getSystemService(PowerManager::class.java)
        .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "BetterAlarms:ringing")
        .apply { acquire(AUTO_STOP_MS + 60_000) }
    }
    if (player == null) startSound(spec)
    if (vibrator == null && spec.vibrate) startVibration()

    handler.removeCallbacks(autoStop)
    handler.postDelayed(autoStop, AUTO_STOP_MS)
  }

  private fun snooze() {
    ringing?.let { spec ->
      val snoozed = spec.copy(
        id = AlarmStore.SNOOZE_ID,
        time = System.currentTimeMillis() + spec.snoozeMinutes * 60_000L,
      )
      AlarmStore.setPending(this, AlarmStore.SNOOZE_ID, snoozed)
      AlarmScheduler.schedule(this, snoozed)
    }
    stopRinging()
  }

  private fun dismiss() {
    val spec = ringing
    stopRinging()
    // Safety net for people who turn alarms off in their sleep. Never chains.
    if (spec != null && spec.backupMinutes > 0 && !spec.isBackup) {
      val backup = spec.copy(
        id = AlarmStore.BACKUP_ID,
        time = System.currentTimeMillis() + spec.backupMinutes * 60_000L,
        label = "Backup: ${spec.label}",
        isBackup = true,
      )
      AlarmStore.setPending(this, AlarmStore.BACKUP_ID, backup)
      AlarmScheduler.schedule(this, backup)
      Notifier.backupScheduled(this, backup, DateFormat.getTimeFormat(this).format(backup.time))
    }
  }

  private fun stopRinging() {
    releaseResources()
    AlarmActivity.finishIfShowing()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun releaseResources() {
    handler.removeCallbacks(autoStop)
    handler.removeCallbacks(ramp)
    player?.let {
      try {
        it.stop()
      } catch (_: IllegalStateException) {
      }
      it.release()
    }
    player = null
    vibrator?.cancel()
    vibrator = null
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
    ringing = null
  }

  private fun startSound(spec: AlarmSpec) {
    for (uri in soundCandidates(this, spec.soundUri)) {
      val mp = MediaPlayer()
      try {
        mp.setAudioAttributes(alarmAudio)
        mp.setDataSource(this, uri)
        mp.isLooping = true
        mp.prepare()
        if (spec.rampUp) mp.setVolume(0.05f, 0.05f)
        mp.start()
        player = mp
        if (spec.rampUp) {
          rampStartedAt = System.currentTimeMillis()
          handler.post(ramp)
        }
        return
      } catch (e: Exception) {
        mp.release()
      }
    }
  }

  @Suppress("DEPRECATION")
  private fun startVibration() {
    val v = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      getSystemService(VibratorManager::class.java).defaultVibrator
    } else {
      getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }
    if (!v.hasVibrator()) return
    val pattern = longArrayOf(0, 800, 800)
    when {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ->
        v.vibrate(
          VibrationEffect.createWaveform(pattern, 0),
          VibrationAttributes.createForUsage(VibrationAttributes.USAGE_ALARM),
        )
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ->
        v.vibrate(VibrationEffect.createWaveform(pattern, 0), alarmAudio)
      else -> v.vibrate(pattern, 0)
    }
    vibrator = v
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(NotificationManager::class.java)
    if (nm.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(CHANNEL_ID, "Ringing alarms", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Shown while an alarm is ringing"
      // The service plays the sound itself on the alarm stream.
      setSound(null, null)
      enableVibration(false)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    }
    nm.createNotificationChannel(channel)
  }

  @Suppress("DEPRECATION")
  private fun buildNotification(spec: AlarmSpec): Notification {
    val showAlarm = PendingIntent.getActivity(
      this,
      0,
      Intent(this, AlarmActivity::class.java)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val needsChallenge = spec.challenge != "none"
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      Notification.Builder(this).setPriority(Notification.PRIORITY_MAX)
    }
    builder
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle(spec.label)
      .setContentText(
        if (needsChallenge) "Tap to open and turn it off"
        else "Alarm · " + DateFormat.getTimeFormat(this).format(spec.time),
      )
      .setCategory(Notification.CATEGORY_ALARM)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(false)
      .setContentIntent(showAlarm)
      .setFullScreenIntent(showAlarm, true)
      .addAction(Notification.Action.Builder(null as Icon?, "Snooze ${spec.snoozeMinutes} min", serviceIntent(ACTION_SNOOZE, 1)).build())
    // With a wake-up challenge, dismissing must go through the alarm screen.
    if (!needsChallenge) {
      builder.addAction(Notification.Action.Builder(null as Icon?, "Dismiss", serviceIntent(ACTION_DISMISS, 2)).build())
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
    }
    return builder.build()
  }

  private fun serviceIntent(action: String, requestCode: Int) = PendingIntent.getService(
    this,
    requestCode,
    Intent(this, AlarmService::class.java).setAction(action),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
  )
}
