// dashboard.js — Today dashboard endpoint.
//
// GET /api/dashboard/today (client only)
// Returns current date, weekOfProgram, weekly summary (workouts, streak, pain),
// today's plan items with completion statuses, next upcoming session, and latest specialist note.

import { Router } from 'express'
import db from '../db/connection.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'

const router = Router()

// ── Helpers ─────────────────────────────────────────────────────────────────

function getMondayToSunday(d = new Date()) {
  const date = new Date(d)
  const day = date.getDay() // 0 = Sun, 1 = Mon...
  const diffToMon = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diffToMon)
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const toDateStr = (dt) => dt.toISOString().slice(0, 10)
  return { mondayStr: toDateStr(monday), sundayStr: toDateStr(sunday) }
}

function calculateStreak(clientId) {
  // Query distinct dates with a 'done' completion, ordered descending
  const rows = db
    .prepare(
      `SELECT DISTINCT date FROM item_completions
       WHERE client_id = ? AND status = 'done'
       ORDER BY date DESC`
    )
    .all(clientId)

  if (rows.length === 0) return 0

  const dates = new Set(rows.map((r) => r.date))
  const today = new Date()
  const toDateStr = (dt) => dt.toISOString().slice(0, 10)
  const todayStr = toDateStr(today)

  // Start checking from today; if not done today yet, start from yesterday
  const checkDate = new Date(today)
  if (!dates.has(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1)
  }

  let streak = 0
  while (dates.has(toDateStr(checkDate))) {
    streak++
    checkDate.setDate(checkDate.getDate() - 1)
  }

  return streak
}

function formatMeta(item) {
  if (item.service === 'eat') {
    const parts = []
    if (item.kcal) parts.push(`${item.kcal} kcal`)
    if (item.protein_g) parts.push(`${item.protein_g} g protein`)
    return parts.join(' · ') || 'Healthy meal'
  }

  if (item.duration_min) {
    return `${item.duration_min} min`
  }
  if (item.sets && item.reps) {
    return `${item.sets} sets × ${item.reps}`
  }
  return 'Exercise'
}

// ── Route ───────────────────────────────────────────────────────────────────

/**
 * GET /api/dashboard/today
 * Client overview dashboard.
 */
router.get('/today', requireAuth, requireRole('client'), (req, res) => {
  const clientId = req.user.id
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  // 1. Client profile for weekOfProgram and goals
  const profile = db.prepare('SELECT * FROM client_profiles WHERE user_id = ?').get(clientId)

  const programWeeks = profile?.program_weeks ?? 8
  let currentWeek = 1
  if (profile?.plan_start_date) {
    const start = new Date(profile.plan_start_date + 'T00:00:00Z')
    const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    currentWeek = Math.max(1, Math.min(programWeeks, Math.floor(diffDays / 7) + 1))
  }

  // 2. Weekly workouts
  const { mondayStr, sundayStr } = getMondayToSunday(now)

  const completionWorkouts = db
    .prepare(
      `SELECT COUNT(DISTINCT c.date) AS count
       FROM item_completions c
       JOIN plan_items pi ON pi.id = c.plan_item_id
       JOIN plans p ON p.id = pi.plan_id
       WHERE c.client_id = ?
         AND c.status = 'done'
         AND p.service = 'move'
         AND c.date >= ? AND c.date <= ?`
    )
    .get(clientId, mondayStr, sundayStr).count

  const logWorkouts = db
    .prepare(
      `SELECT COUNT(DISTINCT date) AS count
       FROM progress_logs
       WHERE client_id = ? AND workout_done = 1 AND date >= ? AND date <= ?`
    )
    .get(clientId, mondayStr, sundayStr).count

  const workoutsThisWeek = Math.max(completionWorkouts, logWorkouts)
  const workoutsTarget = profile?.days_per_week ?? 4

  // 3. Streak
  const streakDays = calculateStreak(clientId)

  // 4. Latest pain level
  const latestLog = db
    .prepare(
      `SELECT pain_level FROM progress_logs
       WHERE client_id = ? AND pain_level IS NOT NULL
       ORDER BY date DESC LIMIT 1`
    )
    .get(clientId)

  let latestPain = latestLog?.pain_level
  if (latestPain === undefined) {
    const injuryMax = db.prepare('SELECT MAX(pain_level) AS pain FROM injuries WHERE client_id = ?').get(clientId)
    latestPain = injuryMax?.pain ?? 0
  }

  // 5. Today's plan items
  const jsDow = now.getDay()
  const dbDow = jsDow === 0 ? 7 : jsDow // 1=Mon ... 7=Sun

  const planRows = db
    .prepare(
      `SELECT 
        pi.id AS item_id,
        p.service,
        pi.time_of_day,
        pi.title,
        pi.duration_min,
        pi.kcal,
        pi.protein_g,
        pi.sets,
        pi.reps,
        pi.meal_type,
        c.status
      FROM plan_items pi
      JOIN plans p ON p.id = pi.plan_id
      LEFT JOIN item_completions c ON c.plan_item_id = pi.id AND c.date = ? AND c.client_id = ?
      WHERE p.client_id = ? AND p.status = 'active' AND pi.day_of_week = ?
      ORDER BY pi.time_of_day ASC, pi.position ASC`
    )
    .all(todayStr, clientId, clientId, dbDow)

  const plan = planRows.map((row) => ({
    itemId: row.item_id,
    service: row.service,
    time: row.time_of_day || '18:00',
    title: row.title,
    meta: formatMeta(row),
    status: row.status || 'pending',
  }))

  // 6. Next upcoming session
  const nextSessionRow = db
    .prepare(
      `SELECT 
        b.id AS booking_id,
        s.starts_at,
        u.id AS specialist_id,
        u.name AS specialist_name,
        sp.type AS specialist_type
      FROM bookings b
      JOIN availability_slots s ON s.id = b.slot_id
      JOIN users u ON u.id = b.specialist_id
      JOIN specialists sp ON sp.user_id = b.specialist_id
      WHERE b.client_id = ? AND b.status = 'confirmed' AND s.starts_at >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      ORDER BY s.starts_at ASC LIMIT 1`
    )
    .get(clientId)

  const nextSession = nextSessionRow
    ? {
        bookingId: nextSessionRow.booking_id,
        startsAt: nextSessionRow.starts_at,
        specialist: {
          id: nextSessionRow.specialist_id,
          name: nextSessionRow.specialist_name,
          type: nextSessionRow.specialist_type,
        },
      }
    : null

  // 7. Latest specialist note visible to client
  const latestNoteRow = db
    .prepare(
      `SELECT n.body, n.created_at, u.name AS author_name, sp.type AS author_type
       FROM notes n
       JOIN users u ON u.id = n.author_id
       LEFT JOIN specialists sp ON sp.user_id = n.author_id
       WHERE n.client_id = ? AND n.visible_to_client = 1
       ORDER BY n.created_at DESC LIMIT 1`
    )
    .get(clientId)

  const latestNote = latestNoteRow
    ? {
        from: latestNoteRow.author_name,
        body: latestNoteRow.body,
        createdAt: latestNoteRow.created_at,
      }
    : null

  res.json({
    data: {
      date: todayStr,
      weekOfProgram: {
        current: currentWeek,
        total: programWeeks,
      },
      summary: {
        workoutsThisWeek,
        workoutsTarget,
        streakDays,
        latestPain,
      },
      plan,
      nextSession,
      latestNote,
    },
  })
})

export default router

