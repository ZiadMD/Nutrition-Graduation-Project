// profile.js — Client profile and onboarding routes.
//
// Endpoints:
// - GET  /api/profile          (client only) -> profile + injuries
// - PUT  /api/profile          (client only) -> partial update per step, replaces injuries if provided
// - POST /api/profile/complete (client only) -> marks onboarding_completed = 1 and sets plan_start_date

import { Router } from 'express'
import { z } from 'zod'
import db from '../db/connection.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { validate } from '../middleware/validate.js'
import { toCamelCase } from '../utils/case.js'

const router = Router()

// All profile endpoints require an authenticated client
router.use(requireAuth, requireRole('client'))

// ── Value Normalization Helpers ─────────────────────────────────────────────

const GOAL_MAP = {
  'lose fat': 'lose_fat',
  'lose_fat': 'lose_fat',
  'build muscle': 'build_muscle',
  'build_muscle': 'build_muscle',
  'recover from injury': 'recover_injury',
  'recover_injury': 'recover_injury',
  'stay healthy': 'stay_healthy',
  'stay_healthy': 'stay_healthy',
}

const ACTIVITY_MAP = {
  'mostly sitting': 'sedentary',
  'sedentary': 'sedentary',
  'lightly active': 'light',
  'light': 'light',
  'active': 'moderate',
  'moderate': 'moderate',
  'very active': 'active',
}

const BODY_AREA_MAP = {
  'neck': 'neck',
  'shoulder': 'shoulder',
  'upper back': 'upper_back',
  'upper_back': 'upper_back',
  'lower back': 'lower_back',
  'lower_back': 'lower_back',
  'elbow or wrist': 'elbow_wrist',
  'elbow_wrist': 'elbow_wrist',
  'hip': 'hip',
  'knee': 'knee',
  'ankle or foot': 'ankle_foot',
  'ankle_foot': 'ankle_foot',
}

const DURATION_MAP = {
  'less than 2 weeks': 'days',
  'days': 'days',
  '2 to 6 weeks': 'weeks',
  'weeks': 'weeks',
  '2 to 6 months': 'months',
  'months': 'months',
  'more than 6 months': 'years',
  'years': 'years',
}

function normalizeGoal(val) {
  if (!val) return null
  const key = String(val).toLowerCase().trim()
  return GOAL_MAP[key] ?? val
}

function normalizeActivity(val) {
  if (!val) return null
  const key = String(val).toLowerCase().trim()
  return ACTIVITY_MAP[key] ?? val
}

function normalizeBodyArea(val) {
  if (!val) return null
  const key = String(val).toLowerCase().trim()
  return BODY_AREA_MAP[key] ?? null
}

function normalizeDuration(val) {
  if (!val) return null
  const key = String(val).toLowerCase().trim()
  return DURATION_MAP[key] ?? 'weeks'
}

function normalizeDoctorSeen(val) {
  if (val === true || val === 1 || val === '1' || String(val).toLowerCase() === 'yes') {
    return 1
  }
  return 0
}

// ── Formatters ──────────────────────────────────────────────────────────────

function formatProfileResponse(profileRow, injuryRows) {
  const profile = toCamelCase(profileRow)
  profile.onboardingCompleted = Boolean(profileRow.onboarding_completed)

  // Convert comma-separated string back to array for front end
  if (typeof profile.allergies === 'string') {
    profile.allergies = profile.allergies ? profile.allergies.split(',').map((s) => s.trim()).filter(Boolean) : []
  } else if (!Array.isArray(profile.allergies)) {
    profile.allergies = []
  }

  const injuries = injuryRows.map((row) => ({
    id: row.id,
    bodyArea: row.body_area,
    painLevel: row.pain_level,
    duration: row.duration,
    doctorSeen: Boolean(row.doctor_seen),
    note: row.note || '',
  }))

  return { profile, injuries }
}

// ── Validation Schema ───────────────────────────────────────────────────────

const updateProfileSchema = z.object({
  goal: z.string().optional(),
  daysPerWeek: z.coerce.number().int().min(1).max(7).optional(),
  age: z.coerce.number().int().min(16).max(100).optional(),
  heightCm: z.coerce.number().min(100).max(250).optional(),
  weightKg: z.coerce.number().min(30).max(300).optional(),
  activityLevel: z.string().optional(),
  dietStyle: z.string().optional(),
  allergies: z.union([z.array(z.string()), z.string()]).optional(),
  mealsPerDay: z.coerce.number().int().min(1).max(8).optional(),
  dislikedFoods: z.string().optional(),
  phone: z.string().optional(),
  programWeeks: z.coerce.number().int().min(1).max(52).optional(),
  injuries: z
    .array(
      z.object({
        bodyArea: z.string(),
        painLevel: z.coerce.number().min(0).max(10),
        duration: z.string().optional().nullable(),
        doctorSeen: z.union([z.boolean(), z.number(), z.string()]).optional().default(false),
        note: z.string().optional().nullable(),
      })
    )
    .optional(),
})

// ── Route Handlers ──────────────────────────────────────────────────────────

/**
 * GET /api/profile
 * Returns the client profile and all associated injuries.
 */
router.get('/', (req, res) => {
  const userId = req.user.id

  // Ensure client profile exists
  let profile = db.prepare('SELECT * FROM client_profiles WHERE user_id = ?').get(userId)
  if (!profile) {
    db.prepare('INSERT INTO client_profiles (user_id) VALUES (?)').run(userId)
    profile = db.prepare('SELECT * FROM client_profiles WHERE user_id = ?').get(userId)
  }

  const injuries = db.prepare('SELECT * FROM injuries WHERE client_id = ? ORDER BY id ASC').all(userId)

  res.json({
    data: formatProfileResponse(profile, injuries),
  })
})

/**
 * PUT /api/profile
 * Partial update for client profile. If an `injuries` array is provided,
 * it replaces the existing list of injuries in a single transaction.
 */
router.put('/', validate(updateProfileSchema), (req, res) => {
  const userId = req.user.id
  const body = req.body

  // Ensure row exists
  const existing = db.prepare('SELECT user_id FROM client_profiles WHERE user_id = ?').get(userId)
  if (!existing) {
    db.prepare('INSERT INTO client_profiles (user_id) VALUES (?)').run(userId)
  }

  const updateProfileTransaction = db.transaction(() => {
    // 1. Build profile column updates
    const updates = []
    const params = []

    if (body.goal !== undefined) {
      updates.push('goal = ?')
      params.push(normalizeGoal(body.goal))
    }
    if (body.daysPerWeek !== undefined) {
      updates.push('days_per_week = ?')
      params.push(body.daysPerWeek)
    }
    if (body.age !== undefined) {
      updates.push('age = ?')
      params.push(body.age)
    }
    if (body.heightCm !== undefined) {
      updates.push('height_cm = ?')
      params.push(body.heightCm)
    }
    if (body.weightKg !== undefined) {
      updates.push('weight_kg = ?')
      params.push(body.weightKg)
    }
    if (body.activityLevel !== undefined) {
      updates.push('activity_level = ?')
      params.push(normalizeActivity(body.activityLevel))
    }
    if (body.dietStyle !== undefined) {
      updates.push('diet_style = ?')
      params.push(body.dietStyle)
    }
    if (body.allergies !== undefined) {
      updates.push('allergies = ?')
      const allergyVal = Array.isArray(body.allergies) ? body.allergies.join(',') : body.allergies
      params.push(allergyVal)
    }
    if (body.mealsPerDay !== undefined) {
      updates.push('meals_per_day = ?')
      params.push(body.mealsPerDay)
    }
    if (body.dislikedFoods !== undefined) {
      updates.push('disliked_foods = ?')
      params.push(body.dislikedFoods)
    }
    if (body.phone !== undefined) {
      updates.push('phone = ?')
      params.push(body.phone)
    }
    if (body.programWeeks !== undefined) {
      updates.push('program_weeks = ?')
      params.push(body.programWeeks)
    }

    if (updates.length > 0) {
      updates.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')")
      params.push(userId)
      db.prepare(`UPDATE client_profiles SET ${updates.join(', ')} WHERE user_id = ?`).run(...params)
    }

    // 2. Handle injuries replacement if provided
    if (Array.isArray(body.injuries)) {
      db.prepare('DELETE FROM injuries WHERE client_id = ?').run(userId)

      const insertInjury = db.prepare(
        `INSERT INTO injuries (client_id, body_area, pain_level, duration, doctor_seen, note)
         VALUES (?, ?, ?, ?, ?, ?)`
      )

      for (const item of body.injuries) {
        const area = normalizeBodyArea(item.bodyArea)
        if (area) {
          insertInjury.run(
            userId,
            area,
            item.painLevel,
            normalizeDuration(item.duration),
            normalizeDoctorSeen(item.doctorSeen),
            item.note || null
          )
        }
      }
    }
  })

  updateProfileTransaction()

  const updatedProfile = db.prepare('SELECT * FROM client_profiles WHERE user_id = ?').get(userId)
  const updatedInjuries = db.prepare('SELECT * FROM injuries WHERE client_id = ? ORDER BY id ASC').all(userId)

  res.json({
    data: formatProfileResponse(updatedProfile, updatedInjuries),
  })
})

/**
 * POST /api/profile/complete
 * Marks onboarding as completed and sets plan_start_date to today if not yet set.
 */
router.post('/complete', (req, res) => {
  const userId = req.user.id

  const today = new Date().toISOString().slice(0, 10)

  db.prepare(
    `UPDATE client_profiles
     SET onboarding_completed = 1,
         plan_start_date = COALESCE(plan_start_date, ?),
         updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
     WHERE user_id = ?`
  ).run(today, userId)

  const updated = db.prepare('SELECT onboarding_completed, plan_start_date FROM client_profiles WHERE user_id = ?').get(userId)

  res.json({
    data: {
      success: true,
      onboardingCompleted: Boolean(updated.onboarding_completed),
      planStartDate: updated.plan_start_date,
    },
  })
})

export default router

