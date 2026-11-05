package com.betteralarms.alarmengine

import android.content.Context
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Handler
import android.os.Looper
import org.json.JSONArray
import org.json.JSONObject

/** Lists the phone's alarm sounds and plays short previews of them. */
object SoundPreview {
  private const val PREVIEW_MS = 8_000L
  private var player: MediaPlayer? = null
  private val handler = Handler(Looper.getMainLooper())
  private val autoStop = Runnable { stop() }

  fun listAlarmSounds(c: Context): String {
    val out = JSONArray()
    val manager = RingtoneManager(c).apply { setType(RingtoneManager.TYPE_ALARM) }
    val cursor = manager.cursor
    while (cursor.moveToNext()) {
      out.put(
        JSONObject()
          .put("title", cursor.getString(RingtoneManager.TITLE_COLUMN_INDEX))
          .put("uri", manager.getRingtoneUri(cursor.position).toString()),
      )
    }
    return out.toString()
  }

  fun play(c: Context, uri: String?) {
    handler.post {
      stop()
      for (candidate in AlarmService.soundCandidates(c, uri)) {
        val mp = MediaPlayer()
        try {
          mp.setAudioAttributes(AlarmService.alarmAudio)
          mp.setDataSource(c, candidate)
          mp.prepare()
          mp.start()
          player = mp
          handler.postDelayed(autoStop, PREVIEW_MS)
          return@post
        } catch (e: Exception) {
          mp.release()
        }
      }
    }
  }

  fun stop() {
    handler.removeCallbacks(autoStop)
    player?.let {
      try {
        it.stop()
      } catch (_: IllegalStateException) {
      }
      it.release()
    }
    player = null
  }
}
