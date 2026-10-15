// progress.js — Client progress logs and trend analytics.
//
// Endpoints:
// - GET /api/progress?range=4w|8w|all (client only) -> weight, workoutsPerWeek, pain, safeLimit
// - PUT /api/progress                 (client only) -> upsert progress log for a date

import { Router } from 'express'
import { z } from 'zod'
import db from '../db/connection.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { validate } from '../middleware/validate.js'
import { toCamelCase } from '../utils/case.js'

const router = Router()

router.use(requireAuth, requireRole('client'))

// ── Helpers ─────────────────────────────────────────────────────────────────

function getMondayOfDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  const day = d.getUTCDay() // 0=Sun, 1=Mon...
  const diffToMon = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() + diffToMon)
  return monday.toISOString().slice(0, 10)
}

function getRangeStartDate(range) {
  const now = new Date()
  if (range === '8w') {
    now.setUTCDate(now.getUTCDate() - 56)
    return now.toISOString().slice(0, 10)
  }
  if (range === 'all') {
    return '1970-01-01'
  }
  // Default to 4w (28 days)
  now.setUTCDate(now.getUTCDate() - 28)
  return now.toISOString().slice(0, 10)
}

// ── Validation Schema ───────────────────────────────────────────────────────

const progressSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted YYYY-MM-DD.').optional(),
  weightKg: z.coerce.number().min(20).max(300).optional(),
  workoutDone: z
    .union([z.boolean(), z.number(), z.string()])
    .transform((v) => (v === true || v === 1 || v === '1' ? 1 : 0))
    .optional(),
  painLevel: z.coerce.number().int().min(0).max(10).optional(),
  note: z.string().optional(),
})

// ── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /api/progress
 * Returns weight trends, pain history, workouts per week, and safeLimit.
 * Query params: ?range=4w|8w|all
 */
router.get('/', (req, res) => {
  const clientId = req.user.id
  const range = (req.query.range || '4w').toLowerCase()
  const startDate = getRangeStartDate(range)

  // 1. Weight history
  const weightRows = db
    .prepare(
      `SELECT date, weight_kg AS value
       FROM progress_logs
       WHERE client_id = ? AND weight_kg IS NOT NULL AND date >= ?
       ORDER BY date ASC`
    )
    .all(clientId, startDate)

  // 2. Pain history
  const painRows = db
    .prepare(
      `SELECT date, pain_level AS value
       FROM progress_logs
       WHERE client_id = ? AND pain_level IS NOT NULL AND date >= ?
       ORDER BY date ASC`
    )
    .all(clientId, startDate)

  // 3. Workouts per week (group distinct workout dates by Monday-start week)
  const workoutDates = db
    .prepare(
      `SELECT date FROM progress_logs
       WHERE client_id = ? AND workout_done = 1 AND date >= ?
       UNION
       SELECT c.date FROM item_completions c
       JOIN plan_items pi ON pi.id = c.plan_item_id
       JOIN plans p ON p.id = pi.plan_id
       WHERE c.client_id = ? AND c.status = 'done' AND p.service = 'move' AND c.date >= ?
       ORDER BY date ASC`
    )
    .all(clientId, startDate, clientId, startDate)

  const weekMap = new Map()
  for (const row of workoutDates) {
    const monday = getMondayOfDate(row.date)
    weekMap.set(monday, (weekMap.get(monday) || 0) + 1)
  }

  const workoutsPerWeek = Array.from(weekMap.entries())
    .map(([weekStart, count]) => ({ weekStart, count }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))

  // 4. Safe limit calculation
  // Lowest pain_limit among active plan items; defaults to 4 if none set.
  const limitRow = db
    .prepare(
      `SELECT MIN(pi.pain_limit) AS min_limit
       FROM plan_items pi
       JOIN plans p ON p.id = pi.plan_id
       WHERE p.client_id = ? AND p.status = 'active' AND pi.pain_limit IS NOT NULL`
    )
    .get(clientId)

  const safeLimit = limitRow?.min_limit ?? 4

  res.json({
    data: {
      weight: weightRows,
      workoutsPerWeek,
      pain: painRows,
      safeLimit,
    },
  })
})

/**
 * PUT /api/progress
 * Upsert daily progress entry (weight, pain, workoutDone, note).
 */
router.put('/', validate(progressSchema), (req, res) => {
  const clientId = req.user.id
  const date = req.body.date || new Date().toISOString().slice(0, 10)
  const { weightKg, workoutDone, painLevel, note } = req.body

  db.prepare(
    `INSERT INTO progress_logs (client_id, date, weight_kg, workout_done, pain_level, note)
     VALUES (?, ?, ?, COALESCE(?, 0), ?, ?)
     ON CONFLICT (client_id, date) DO UPDATE SET
       weight_kg = COALESCE(excluded.weight_kg, progress_logs.weight_kg),
       workout_done = CASE WHEN excluded.workout_done IS NOT NULL THEN excluded.workout_done ELSE progress_logs.workout_done END,
       pain_level = COALESCE(excluded.pain_level, progress_logs.pain_level),
       note = COALESCE(excluded.note, progress_logs.note)`
  ).run(clientId, date, weightKg ?? null, workoutDone ?? null, painLevel ?? null, note ?? null)

  const updated = db.prepare('SELECT * FROM progress_logs WHERE client_id = ? AND date = ?').get(clientId, date)

  res.json({
    data: {
      progressLog: toCamelCase(updated),
    },
  })
})

export default router

