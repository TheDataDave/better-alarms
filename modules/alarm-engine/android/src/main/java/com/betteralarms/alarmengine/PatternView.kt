package com.betteralarms.alarmengine

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.view.MotionEvent
import android.view.View
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.min
import kotlin.random.Random

/**
 * 3x3 dot grid that shows a random path faintly; the user has to trace it.
 * Paths only step to neighbouring dots, so there's no ambiguity about which
 * dots a line passes over.
 */
@SuppressLint("ViewConstructor")
class PatternView(context: Context, private val onSolved: () -> Unit) : View(context) {
  private val target: List<Int> = randomPath(5)
  private val traced = mutableListOf<Int>()
  private var fingerX = -1f
  private var fingerY = -1f
  private var failed = false
  private var cell = 0f

  private val density = resources.displayMetrics.density
  private val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#5B6B7C") }
  private val targetPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.parseColor("#33FFFFFF")
    strokeWidth = 22 * density
    strokeCap = Paint.Cap.ROUND
  }
  private val startPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#3DD68C") }
  private val tracePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    strokeWidth = 10 * density
    strokeCap = Paint.Cap.ROUND
  }

  private fun cx(i: Int) = cell * (i % 3) + cell / 2
  private fun cy(i: Int) = cell * (i / 3) + cell / 2

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    val w = MeasureSpec.getSize(widthMeasureSpec)
    setMeasuredDimension(w, w)
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    cell = min(w, h) / 3f
  }

  override fun onDraw(canvas: Canvas) {
    for (i in 0 until target.size - 1) {
      canvas.drawLine(cx(target[i]), cy(target[i]), cx(target[i + 1]), cy(target[i + 1]), targetPaint)
    }
    for (i in 0 until 9) canvas.drawCircle(cx(i), cy(i), 9 * density, dotPaint)
    canvas.drawCircle(cx(target[0]), cy(target[0]), 16 * density, startPaint)

    tracePaint.color = Color.parseColor(if (failed) "#FF6B6B" else "#FF8A3D")
    for (i in 0 until traced.size - 1) {
      canvas.drawLine(cx(traced[i]), cy(traced[i]), cx(traced[i + 1]), cy(traced[i + 1]), tracePaint)
    }
    traced.lastOrNull()?.let { last ->
      if (fingerX >= 0) canvas.drawLine(cx(last), cy(last), fingerX, fingerY, tracePaint)
    }
    for (i in traced) canvas.drawCircle(cx(i), cy(i), 14 * density, tracePaint)
  }

  @SuppressLint("ClickableViewAccessibility")
  override fun onTouchEvent(event: MotionEvent): Boolean {
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        traced.clear()
        failed = false
        track(event.x, event.y)
      }
      MotionEvent.ACTION_MOVE -> track(event.x, event.y)
      MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
        fingerX = -1f
        if (traced == target) {
          onSolved()
        } else {
          failed = traced.isNotEmpty()
          postDelayed({ traced.clear(); failed = false; invalidate() }, 600)
        }
      }
    }
    invalidate()
    return true
  }

  private fun track(x: Float, y: Float) {
    fingerX = x
    fingerY = y
    for (i in 0 until 9) {
      if (i !in traced && hypot(x - cx(i), y - cy(i)) < cell * 0.32f) traced.add(i)
    }
  }

  private fun randomPath(length: Int): List<Int> {
    while (true) {
      val path = mutableListOf(Random.nextInt(9))
      while (path.size < length) {
        val here = path.last()
        val next = (0 until 9).filter {
          it !in path && abs(it % 3 - here % 3) <= 1 && abs(it / 3 - here / 3) <= 1
        }
        if (next.isEmpty()) break
        path.add(next.random())
      }
      if (path.size == length) return path
    }
  }
}
