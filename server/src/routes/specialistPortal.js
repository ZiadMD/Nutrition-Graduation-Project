// specialistPortal.js — Specialist portal routes.
//
// Guarded with requireAuth and requireRole('specialist').
// Allows specialists (trainers, nutritionists, physical therapists) to:
// 1. View their assigned clients with pain flags and trends.
// 2. View a client's full medical/training history, plans, progress, and notes.
// 3. Edit and activate plans matching their clinical specialty.
// 4. Record session notes.
// 5. View their schedule and booking requests.

import { Router } from 'express'
import { z } from 'zod'
import db from '../db/connection.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { validate } from '../middleware/validate.js'

const router = Router()

// All routes here strictly require an authenticated specialist
router.use(requireAuth, requireRole('specialist'))

// Mapping between specialist type in database and service category
const SPECIALIST_SERVICE_MAP = {
  trainer: 'move',
  nutritionist: 'eat',
  physical_therapist: 'recover',
}

// Helpers
function getInitials(name = '') {
  return name
    .replace(/^(Dr\.|Coach)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

function calculateProgramWeek(planStartDate, programWeeks = 8) {
  if (!planStartDate) return { week: 1, of: programWeeks }
  const today = new Date().toISOString().slice(0, 10)
  const diffMs = new Date(today) - new Date(planStartDate)
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  let week = Math.floor(diffDays / 7) + 1
  if (week < 1) week = 1
  return { week, of: programWeeks }
}

function formatRelativeCheckin(dateStr) {
  if (!dateStr) return 'Never'
  const today = new Date().toISOString().slice(0, 10)
  if (dateStr === today) return 'Today'

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (dateStr === yesterday) return 'Yesterday'

  const diffMs = new Date(today) - new Date(dateStr)
  const days = Math.floor(diffMs / 86400000)
  if (days <= 0) return 'Today'
  return `${days} days ago`
}

function resolveClientId(param) {
  const num = Number(param)
  if (!Number.isNaN(num)) return num
  const row = db
    .prepare(
      `SELECT u.id FROM users u
       WHERE LOWER(u.email) LIKE ? OR LOWER(u.name) LIKE ?`
    )
    .get(`${param.toLowerCase()}%`, `%${param.toLowerCase()}%`)
  return row ? row.id : null
}

/**
 * GET /api/specialist/clients
 * Returns clients under this specialist's care team.
 * Supports ?q= query param to search by name or goal.
 */
router.get('/clients', (req, res) => {
  const specialistId = req.user.id
  const q = req.query.q?.trim().toLowerCase() || ''

  const rows = db
    .prepare(
      `SELECT 
        u.id, u.name, u.email,
        cp.goal, cp.days_per_week, cp.age, cp.phone,
        cp.plan_start_date, cp.program_weeks,
        u.created_at, u.last_active_at
      FROM care_team ct
      JOIN users u ON u.id = ct.client_id
      LEFT JOIN client_profiles cp ON cp.user_id = u.id
      WHERE ct.specialist_id = ?
      ORDER BY u.name ASC`
    )
    .all(specialistId)

  const clients = rows
    .filter((row) => {
      if (!q) return true
      const target = `${row.name} ${row.goal || ''}`.toLowerCase()
      return target.includes(q)
    })
    .map((row) => {
      // 1. Calculate week of program
      const { week, of } = calculateProgramWeek(row.plan_start_date, row.program_weeks)

      // 2. Fetch progress logs for pain history
      const logs = db
        .prepare(
          `SELECT date, pain_level, workout_done, weight_kg
           FROM progress_logs
           WHERE client_id = ?
           ORDER BY date ASC`
        )
        .all(row.id)

      const painLogs = logs.filter((l) => l.pain_level !== null && l.pain_level !== undefined)
      let pain = []
      let latestPain = 0

      if (painLogs.length > 0) {
        pain = painLogs.map((l) => l.pain_level)
        latestPain = pain[pain.length - 1]
      } else {
        const injury = db
          .prepare(`SELECT MAX(pain_level) AS pain FROM injuries WHERE client_id = ?`)
          .get(row.id)
        latestPain = injury?.pain ?? 0
        pain = [latestPain]
      }

      // Pain trend: current, delta vs previous, direction
      const prevPain = pain.length >= 2 ? pain[pain.length - 2] : latestPain
      const delta = latestPain - prevPain
      const dir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'

      // 3. Safe pain limit: lowest pain_limit across active plan items (default 4)
      const limitRow = db
        .prepare(
          `SELECT MIN(pi.pain_limit) AS safe_limit
           FROM plan_items pi
           JOIN plans p ON p.id = pi.plan_id
           WHERE p.client_id = ? AND p.status = 'active' AND pi.pain_limit IS NOT NULL`
        )
        .get(row.id)
      const safeLimit = limitRow?.safe_limit ?? 4

      // 4. Flagged condition: latest pain exceeds safe limit
      const flagged = latestPain > safeLimit

      // 5. Last checkin
      const lastCheckinRow = db
        .prepare(
          `SELECT MAX(date) AS last_date FROM (
             SELECT date FROM progress_logs WHERE client_id = ?
             UNION ALL
             SELECT date FROM item_completions WHERE client_id = ?
           )`
        )
        .get(row.id, row.id)

      const lastCheckin = formatRelativeCheckin(lastCheckinRow?.last_date)

      return {
        id: row.id,
        name: row.name,
        initials: getInitials(row.name),
        email: row.email,
        phone: row.phone || '',
        age: row.age,
        goal: row.goal || '',
        week,
        of,
        pain,
        latestPain,
        painTrend: {
          now: latestPain,
          delta,
          dir,
        },
        limit: safeLimit,
        safeLimit,
        flagged,
        lastCheckin,
      }
    })
    // Sort flagged clients first
    .sort((a, b) => Number(b.flagged) - Number(a.flagged))

  res.json({
    data: {
      clients,
    },
  })
})

/**
 * GET /api/specialist/clients/:clientId
 * Returns full clinical and workout details for a client in the specialist's care team.
 */
router.get('/clients/:clientId', (req, res) => {
  const specialistId = req.user.id
  const clientId = resolveClientId(req.params.clientId)
  if (!clientId) {
    return res.status(404).json({ error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found.' } })
  }

  // Enforce care team membership
  const care = db
    .prepare(`SELECT 1 FROM care_team WHERE client_id = ? AND specialist_id = ?`)
    .get(clientId, specialistId)

  if (!care) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: "This client is not in your care team." },
    })
  }

  const user = db
    .prepare(`SELECT id, name, email, role, status, created_at, last_active_at FROM users WHERE id = ?`)
    .get(clientId)

  if (!user) {
    return res.status(404).json({
      error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found.' },
    })
  }

  const profile = db.prepare(`SELECT * FROM client_profiles WHERE user_id = ?`).get(clientId) || {}
  const { week, of } = calculateProgramWeek(profile.plan_start_date, profile.program_weeks)

  // Injuries
  const injuries = db
    .prepare(`SELECT id, body_area, pain_level, duration, doctor_seen, note FROM injuries WHERE client_id = ?`)
    .all(clientId)

  // Care team
  const careTeam = db
    .prepare(
      `SELECT u.id, u.name, u.email, sp.type, sp.credentials, sp.photo_url
       FROM care_team ct
       JOIN users u ON u.id = ct.specialist_id
       JOIN specialists sp ON sp.user_id = u.id
       WHERE ct.client_id = ?`
    )
    .all(clientId)

  // All plans for this client (active, draft, archived, AI)
  const plans = db
    .prepare(
      `SELECT p.*, u.name AS author_name
       FROM plans p
       LEFT JOIN users u ON u.id = p.author_id
       WHERE p.client_id = ?
       ORDER BY 
         CASE p.status WHEN 'active' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,
         p.created_at DESC`
    )
    .all(clientId)
    .map((p) => {
      const items = db
        .prepare(`SELECT * FROM plan_items WHERE plan_id = ? ORDER BY day_of_week ASC, position ASC`)
        .all(p.id)
      return {
        id: p.id,
        clientId: p.client_id,
        service: p.service,
        authorId: p.author_id,
        authorName: p.author_name || (p.source === 'ai' ? 'AI Planner' : 'Specialist'),
        source: p.source,
        status: p.status,
        title: p.title,
        summary: p.summary,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        items,
      }
    })

  // Progress logs
  const progressLogs = db
    .prepare(`SELECT date, weight_kg, workout_done, pain_level, note FROM progress_logs WHERE client_id = ? ORDER BY date ASC`)
    .all(clientId)

  const painValues = progressLogs.map((l) => l.pain_level).filter((p) => p !== null && p !== undefined)
  const latestPain = painValues.length > 0 ? painValues[painValues.length - 1] : 0
  const prevPain = painValues.length >= 2 ? painValues[painValues.length - 2] : latestPain
  const delta = latestPain - prevPain

  // Safe limit
  const limitRow = db
    .prepare(
      `SELECT MIN(pi.pain_limit) AS safe_limit
       FROM plan_items pi
       JOIN plans p ON p.id = pi.plan_id
       WHERE p.client_id = ? AND p.status = 'active' AND pi.pain_limit IS NOT NULL`
    )
    .get(clientId)
  const safeLimit = limitRow?.safe_limit ?? 4

  // Notes
  const notes = db
    .prepare(
      `SELECT n.id, n.client_id, n.author_id, n.body, n.visible_to_client, n.created_at,
              u.name AS author_name, u.role AS author_role
       FROM notes n
       JOIN users u ON u.id = n.author_id
       WHERE n.client_id = ?
       ORDER BY n.created_at DESC`
    )
    .all(clientId)

  res.json({
    data: {
      client: {
        id: user.id,
        name: user.name,
        initials: getInitials(user.name),
        email: user.email,
        phone: profile.phone || '',
        age: profile.age,
        goal: profile.goal,
        daysPerWeek: profile.days_per_week,
        heightCm: profile.height_cm,
        weightKg: profile.weight_kg,
        activityLevel: profile.activity_level,
        dietStyle: profile.diet_style,
        allergies: profile.allergies ? profile.allergies.split(',').map((s) => s.trim()) : [],
        dislikedFoods: profile.disliked_foods ? profile.disliked_foods.split(',').map((s) => s.trim()) : [],
        week,
        of,
      },
      injuries,
      careTeam,
      plans,
      progress: {
        logs: progressLogs,
        latestPain,
        safeLimit,
        flagged: latestPain > safeLimit,
        painTrend: {
          now: latestPain,
          delta,
          dir: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
        },
      },
      notes,
    },
  })
})

const planItemSchema = z.object({
  dayOfWeek: z.number().int().min(1).max(7),
  position: z.number().int().optional().default(0),
  timeOfDay: z.string().optional().nullable(),
  title: z.string().min(1, 'Item title is required.'),
  instructions: z.string().optional().nullable(),
  sets: z.number().int().optional().nullable(),
  reps: z.union([z.string(), z.number()]).transform((v) => String(v)).optional().nullable(),
  tempo: z.string().optional().nullable(),
  restSec: z.number().int().optional().nullable(),
  durationMin: z.number().int().optional().nullable(),
  painLimit: z.number().int().min(0).max(10).optional().nullable(),
  ptCleared: z.boolean().optional().default(false),
  safetyNote: z.string().optional().nullable(),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional().nullable(),
  kcal: z.number().int().optional().nullable(),
  proteinG: z.number().int().optional().nullable(),
  carbsG: z.number().int().optional().nullable(),
  fatG: z.number().int().optional().nullable(),
})

const putPlanSchema = z.object({
  title: z.string().min(1).optional(),
  summary: z.string().optional().nullable(),
  status: z.enum(['draft', 'active']).default('active'),
  planId: z.number().int().optional(),
  items: z.array(planItemSchema).default([]),
})

/**
 * PUT /api/specialist/clients/:clientId/plans/:service
 * Creates or updates a plan for a client.
 * Enforces:
 * 1. Specialist is in client's care team.
 * 2. Specialist's type matches the service (trainer -> move, nutritionist -> eat, physical_therapist -> recover).
 * 3. Activating archives any previous active plan in the same transaction.
 */
router.put('/clients/:clientId/plans/:service', validate(putPlanSchema), (req, res) => {
  const specialistId = req.user.id
  const clientId = resolveClientId(req.params.clientId)
  if (!clientId) {
    return res.status(404).json({ error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found.' } })
  }
  const service = req.params.service

  if (!['move', 'eat', 'recover'].includes(service)) {
    return res.status(400).json({
      error: { code: 'INVALID_SERVICE', message: "service must be 'move', 'eat', or 'recover'." },
    })
  }

  // 1. Care team check
  const care = db
    .prepare(`SELECT 1 FROM care_team WHERE client_id = ? AND specialist_id = ?`)
    .get(clientId, specialistId)

  if (!care) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: "This client is not in your care team." },
    })
  }

  // 2. Specialty check
  const specialist = db.prepare(`SELECT type FROM specialists WHERE user_id = ?`).get(specialistId)
  const allowedService = SPECIALIST_SERVICE_MAP[specialist?.type]

  if (service !== allowedService) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: `As a ${specialist?.type}, you can only edit ${allowedService} plans.`,
      },
    })
  }

  const { title, summary, status, planId, items } = req.body

  // 3. Database transaction: Archive old active plan (if activating) and update/insert new plan items
  const executePlanUpdate = db.transaction(() => {
    let targetPlanId = planId

    if (targetPlanId) {
      const existing = db
        .prepare(`SELECT * FROM plans WHERE id = ? AND client_id = ? AND service = ?`)
        .get(targetPlanId, clientId, service)

      if (!existing) {
        throw new Error('PLAN_NOT_FOUND')
      }

      if (status === 'active') {
        // Archive any OTHER active plan for this client and service
        db.prepare(
          `UPDATE plans
           SET status = 'archived', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
           WHERE client_id = ? AND service = ? AND status = 'active' AND id != ?`
        ).run(clientId, service, targetPlanId)
      }

      db.prepare(
        `UPDATE plans
         SET status = ?,
             author_id = ?,
             title = COALESCE(?, title),
             summary = COALESCE(?, summary),
             updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
         WHERE id = ?`
      ).run(status, specialistId, title || null, summary, targetPlanId)
    } else {
      if (status === 'active') {
        // Archive previous active plan
        db.prepare(
          `UPDATE plans
           SET status = 'archived', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
           WHERE client_id = ? AND service = ? AND status = 'active'`
        ).run(clientId, service)
      }

      const defaultTitle = `${(req.user?.name || 'Specialist').split(' ')[0]}'s ${service.toUpperCase()} plan`
      const info = db
        .prepare(
          `INSERT INTO plans (client_id, service, author_id, source, status, title, summary)
           VALUES (?, ?, ?, 'specialist', ?, ?, ?)`
        )
        .run(clientId, service, specialistId, status, title || defaultTitle, summary || null)

      targetPlanId = info.lastInsertRowid
    }

    // Replace items
    db.prepare(`DELETE FROM plan_items WHERE plan_id = ?`).run(targetPlanId)

    const insertItem = db.prepare(
      `INSERT INTO plan_items
        (plan_id, day_of_week, position, time_of_day, title, instructions,
         sets, reps, tempo, rest_sec, duration_min, pain_limit, pt_cleared, safety_note,
         meal_type, kcal, protein_g, carbs_g, fat_g)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )

    items.forEach((item, idx) => {
      insertItem.run(
        targetPlanId,
        item.dayOfWeek,
        item.position ?? idx,
        item.timeOfDay || null,
        item.title,
        item.instructions || null,
        item.sets ?? null,
        item.reps || null,
        item.tempo || null,
        item.restSec ?? null,
        item.durationMin ?? null,
        item.painLimit ?? null,
        item.ptCleared ? 1 : 0,
        item.safetyNote || null,
        item.mealType || null,
        item.kcal ?? null,
        item.proteinG ?? null,
        item.carbsG ?? null,
        item.fatG ?? null
      )
    })

    return targetPlanId
  })

  let savedPlanId
  try {
    savedPlanId = executePlanUpdate()
  } catch (err) {
    if (err.message === 'PLAN_NOT_FOUND') {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Target plan not found.' },
      })
    }
    throw err
  }

  const updatedPlan = db.prepare(`SELECT * FROM plans WHERE id = ?`).get(savedPlanId)
  const updatedItems = db
    .prepare(`SELECT * FROM plan_items WHERE plan_id = ? ORDER BY day_of_week, position`)
    .all(savedPlanId)

  res.json({
    data: {
      plan: {
        id: updatedPlan.id,
        clientId: updatedPlan.client_id,
        service: updatedPlan.service,
        authorId: updatedPlan.author_id,
        status: updatedPlan.status,
        title: updatedPlan.title,
        summary: updatedPlan.summary,
        createdAt: updatedPlan.created_at,
        updatedAt: updatedPlan.updated_at,
        items: updatedItems,
      },
    },
  })
})

const noteSchema = z.object({
  body: z.string().min(1, 'Note body is required.'),
  visibleToClient: z.boolean().default(true),
})

/**
 * POST /api/specialist/clients/:clientId/notes
 * Records a clinical or progress note for a client.
 */
router.post('/clients/:clientId/notes', validate(noteSchema), (req, res) => {
  const specialistId = req.user.id
  const clientId = resolveClientId(req.params.clientId)
  if (!clientId) {
    return res.status(404).json({ error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found.' } })
  }

  const care = db
    .prepare(`SELECT 1 FROM care_team WHERE client_id = ? AND specialist_id = ?`)
    .get(clientId, specialistId)

  if (!care) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: "This client is not in your care team." },
    })
  }

  const { body, visibleToClient } = req.body

  const info = db
    .prepare(
      `INSERT INTO notes (client_id, author_id, body, visible_to_client)
       VALUES (?, ?, ?, ?)`
    )
    .run(clientId, specialistId, body, visibleToClient ? 1 : 0)

  const note = db
    .prepare(
      `SELECT n.*, u.name AS author_name, u.role AS author_role
       FROM notes n
       JOIN users u ON u.id = n.author_id
       WHERE n.id = ?`
    )
    .get(info.lastInsertRowid)

  res.status(201).json({
    data: {
      note: {
        id: note.id,
        clientId: note.client_id,
        authorId: note.author_id,
        authorName: note.author_name,
        authorRole: note.author_role,
        body: note.body,
        visibleToClient: Boolean(note.visible_to_client),
        createdAt: note.created_at,
      },
    },
  })
})

/**
 * GET /api/specialist/schedule
 * Returns this specialist's slots and bookings.
 * Optional query parameters: ?from=&to=
 */
router.get('/schedule', (req, res) => {
  const specialistId = req.user.id
  const { from, to } = req.query

  let query = `
    SELECT
      s.id,
      s.starts_at,
      s.ends_at,
      s.is_booked,
      b.id AS booking_id,
      b.session_type,
      b.status AS booking_status,
      b.price_egp,
      b.notes AS booking_notes,
      u.id AS client_id,
      u.name AS client_name,
      u.email AS client_email,
      cp.goal AS client_goal
    FROM availability_slots s
    LEFT JOIN bookings b ON b.slot_id = s.id AND b.status IN ('confirmed', 'pending')
    LEFT JOIN users u ON u.id = b.client_id
    LEFT JOIN client_profiles cp ON cp.user_id = u.id
    WHERE s.specialist_id = ?
  `
  const params = [specialistId]

  if (from) {
    query += ` AND s.starts_at >= ?`
    params.push(from)
  }
  if (to) {
    query += ` AND s.starts_at <= ?`
    params.push(to)
  }

  query += ` ORDER BY s.starts_at ASC`

  const rows = db.prepare(query).all(...params)

  const slots = rows.map((r) => ({
    id: r.id,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    isBooked: Boolean(r.is_booked),
    booking: r.booking_id
      ? {
          id: r.booking_id,
          sessionType: r.session_type,
          status: r.booking_status,
          priceEgp: r.price_egp,
          notes: r.booking_notes,
          client: {
            id: r.client_id,
            name: r.client_name,
            email: r.client_email,
            goal: r.client_goal,
          },
        }
      : null,
  }))

  res.json({
    data: {
      slots,
    },
  })
})

export default router
