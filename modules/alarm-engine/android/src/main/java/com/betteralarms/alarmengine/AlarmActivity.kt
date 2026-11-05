package com.betteralarms.alarmengine

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.text.format.DateFormat
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import java.lang.ref.WeakReference
import kotlin.random.Random

/**
 * Full-screen ringing screen shown over the lock screen. Built natively (no JS)
 * so it appears instantly even if the React Native app isn't running.
 *
 * With a wake-up challenge set, "Turn off" opens a small task (math, typing a
 * code, or tracing a pattern) that must be finished first. Snooze never needs one.
 */
class AlarmActivity : Activity() {
  companion object {
    private var current: WeakReference<AlarmActivity>? = null

    fun finishIfShowing() {
      current?.get()?.finish()
    }
  }

  private lateinit var root: LinearLayout

  @Suppress("DEPRECATION")
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val spec = AlarmService.ringing
    if (spec == null) {
      finish()
      return
    }
    current = WeakReference(this)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
      )
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

    root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(Color.parseColor("#0F1720"))
      setPadding(dp(32), dp(32), dp(32), dp(48))
    }
    setContentView(root)
    showMain(spec)
  }

  override fun onDestroy() {
    if (current?.get() === this) current = null
    super.onDestroy()
  }

  private fun dp(value: Int) =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value.toFloat(), resources.displayMetrics).toInt()

  private fun showMain(spec: AlarmSpec) {
    root.removeAllViews()
    root.addView(text(DateFormat.getTimeFormat(this).format(System.currentTimeMillis()), 72f, "#FFFFFF"))
    root.addView(text(spec.label, 22f, "#B8C4D0").apply { setPadding(0, dp(8), 0, dp(64)) })
    root.addView(button("Snooze ${spec.snoozeMinutes} min", "#2B3A4A") { send(AlarmService.ACTION_SNOOZE) })
    root.addView(button("Turn off", "#E8590C") {
      if (spec.challenge == "none") send(AlarmService.ACTION_DISMISS) else showChallenge(spec)
    })
  }

  private fun showChallenge(spec: AlarmSpec) {
    root.removeAllViews()
    when (spec.challenge) {
      "pattern" -> {
        root.addView(text("Trace the pattern", 24f, "#FFFFFF"))
        root.addView(text("Start at the green dot", 16f, "#B8C4D0").apply { setPadding(0, dp(4), 0, dp(24)) })
        root.addView(PatternView(this) { send(AlarmService.ACTION_DISMISS) })
      }
      "code" -> {
        val alphabet = "ACDEFHJKMNPRTUVWXY34679"
        val code = (1..6).map { alphabet[Random.nextInt(alphabet.length)] }.joinToString("")
        root.addView(text("Type this code", 24f, "#FFFFFF"))
        root.addView(text(code.toCharArray().joinToString(" "), 40f, "#FF8A3D").apply { setPadding(0, dp(16), 0, dp(16)) })
        root.addView(answerField(InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS) {
          it.trim().equals(code, ignoreCase = true)
        })
      }
      else -> {
        val a = Random.nextInt(12, 90)
        val b = Random.nextInt(12, 90)
        root.addView(text("Solve to turn off", 24f, "#FFFFFF"))
        root.addView(text("$a + $b = ?", 44f, "#FF8A3D").apply { setPadding(0, dp(16), 0, dp(16)) })
        root.addView(answerField(InputType.TYPE_CLASS_NUMBER) { it.trim() == (a + b).toString() })
      }
    }
    root.addView(button("Back", "#2B3A4A") { showMain(spec) })
  }

  private fun answerField(inputType: Int, isCorrect: (String) -> Boolean) = EditText(this).apply {
    this.inputType = inputType
    setTextColor(Color.WHITE)
    setTextSize(TypedValue.COMPLEX_UNIT_SP, 28f)
    gravity = Gravity.CENTER
    setBackgroundColor(Color.parseColor("#203040"))
    layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(64))
    addTextChangedListener(object : TextWatcher {
      override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
      override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
      override fun afterTextChanged(s: Editable?) {
        if (isCorrect(s.toString())) send(AlarmService.ACTION_DISMISS)
      }
    })
    requestFocus()
    post {
      getSystemService(InputMethodManager::class.java).showSoftInput(this, 0)
    }
  }

  private fun text(value: String, sizeSp: Float, color: String) = TextView(this).apply {
    text = value
    setTextColor(Color.parseColor(color))
    setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
    gravity = Gravity.CENTER
  }

  private fun button(label: String, color: String, onClick: (View) -> Unit) = Button(this).apply {
    text = label
    setTextColor(Color.WHITE)
    setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
    setBackgroundColor(Color.parseColor(color))
    layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(64)).apply {
      topMargin = dp(16)
    }
    setOnClickListener(onClick)
  }

  private fun send(action: String) {
    startService(Intent(this, AlarmService::class.java).setAction(action))
    finish()
  }
}
