// ai.js — AI plan generation and specialist review handover routes.
//
// Endpoints:
// - POST /api/ai/plan           (client only) -> generates personalized plan draft
// - POST /api/ai/plan/:id/send   (client only) -> converts draft to 3 draft plans for specialist review

import { Router } from 'express'
import { z } from 'zod'
import db from '../db/connection.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { validate } from '../middleware/validate.js'
import { generatePlan } from '../services/aiPlanner.js'

const router = Router()

router.use(requireAuth, requireRole('client'))

// ── Validation Schema ───────────────────────────────────────────────────────

const generatePlanRequestSchema = z.object({
  goal: z.string().optional(),
  daysPerWeek: z.coerce.number().int().min(1).max(7).optional(),
  injuries: z
    .array(
      z.object({
        bodyArea: z.string(),
        painLevel: z.coerce.number().min(0).max(10),
      })
    )
    .optional(),
  equipment: z.union([z.array(z.string()), z.string()]).optional(),
  diet: z.string().optional(),
  allergies: z.union([z.array(z.string()), z.string()]).optional(),
  dislikedFoods: z.string().optional(),
})

// ── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/ai/plan
 * Generates an injury-aware draft using AI or deterministic fallback.
 * Saves the request and draft in ai_plan_requests.
 */
router.post('/plan', validate(generatePlanRequestSchema), async (req, res) => {
  const clientId = req.user.id
  const input = req.body

  // If injuries weren't explicitly passed in body, fetch client's registered injuries
  if (!input.injuries || input.injuries.length === 0) {
    const existingInjuries = db.prepare('SELECT body_area, pain_level FROM injuries WHERE client_id = ?').all(clientId)
    input.injuries = existingInjuries.map((i) => ({ bodyArea: i.body_area, painLevel: i.pain_level }))
  }

  // If diet / allergies weren't passed, check client profile
  const profile = db.prepare('SELECT diet_style, allergies, disliked_foods, goal, days_per_week FROM client_profiles WHERE user_id = ?').get(clientId)
  if (profile) {
    input.goal = input.goal || profile.goal
    input.daysPerWeek = input.daysPerWeek || profile.days_per_week
    input.diet = input.diet || profile.diet_style
    input.allergies = input.allergies !== undefined ? input.allergies : profile.allergies
    input.dislikedFoods = input.dislikedFoods !== undefined ? input.dislikedFoods : profile.disliked_foods
  }

  const result = await generatePlan(input)

  // Save in ai_plan_requests
  const insertReq = db
    .prepare(
      `INSERT INTO ai_plan_requests (client_id, input_json, output_json, provider, status)
       VALUES (?, ?, ?, ?, 'generated')`
    )
    .run(clientId, JSON.stringify(input), JSON.stringify(result.draft), result.provider)

  const requestId = Number(insertReq.lastInsertRowid)

  res.json({
    data: {
      requestId,
      source: result.source,
      provider: result.provider,
      draft: result.draft,
    },
  })
})

/**
 * POST /api/ai/plan/:id/send
 * Converts the generated draft into 3 pending review plans in the database
 * with source='ai' and status='draft' for specialists to review and activate.
 */
router.post('/plan/:id/send', (req, res) => {
  const clientId = req.user.id
  const requestId = Number(req.params.id)

  if (Number.isNaN(requestId)) {
    return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid AI plan request ID.' } })
  }

  const request = db.prepare('SELECT * FROM ai_plan_requests WHERE id = ? AND client_id = ?').get(requestId, clientId)

  if (!request) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'AI plan request not found.' } })
  }

  if (request.status === 'sent') {
    return res.status(400).json({ error: { code: 'ALREADY_SENT', message: 'This draft has already been sent to specialists.' } })
  }

  const draft = JSON.parse(request.output_json || '{}')
  if (!draft.move || !draft.eat || !draft.recover) {
    return res.status(400).json({ error: { code: 'INVALID_DRAFT', message: 'Draft data is incomplete.' } })
  }

  const planIds = []

  const sendTransaction = db.transaction(() => {
    // 1. Move Plan
    const insertPlan = db.prepare(
      `INSERT INTO plans (client_id, service, author_id, source, status, title, summary)
       VALUES (?, ?, NULL, 'ai', 'draft', ?, ?)`
    )

    const insertPlanItem = db.prepare(
      `INSERT INTO plan_items 
         (plan_id, day_of_week, position, time_of_day, title, instructions, sets, reps, tempo, rest_sec, duration_min, pain_limit, pt_cleared, safety_note, meal_type, kcal, protein_g, carbs_g, fat_g)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )

    // Move Plan
    const moveRes = insertPlan.run(clientId, 'move', 'AI Draft: Movement Plan', draft.summary || 'AI-generated training routine')
    const movePlanId = Number(moveRes.lastInsertRowid)
    planIds.push(movePlanId)

    draft.move.forEach((item, pos) => {
      insertPlanItem.run(
        movePlanId,
        item.dayOfWeek,
        pos,
        item.timeOfDay || '18:00',
        item.title,
        item.instructions || null,
        item.sets || null,
        item.reps ? String(item.reps) : null,
        item.tempo || null,
        item.restSec || null,
        item.durationMin || null,
        item.painLimit || null,
        0,
        item.safetyNote || null,
        null,
        null,
        null,
        null,
        null
      )
    })

    // Eat Plan
    const eatRes = insertPlan.run(clientId, 'eat', 'AI Draft: Nutrition Plan', draft.summary || 'AI-generated meal guidelines')
    const eatPlanId = Number(eatRes.lastInsertRowid)
    planIds.push(eatPlanId)

    draft.eat.forEach((item, pos) => {
      insertPlanItem.run(
        eatPlanId,
        item.dayOfWeek,
        pos,
        item.timeOfDay || '13:00',
        item.title,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        0,
        null,
        item.mealType || 'lunch',
        item.kcal || 400,
        item.proteinG || null,
        item.carbsG || null,
        item.fatG || null
      )
    })

    // Recover Plan
    const recoverRes = insertPlan.run(clientId, 'recover', 'AI Draft: Recovery Plan', draft.summary || 'AI-generated rehab and mobility')
    const recoverPlanId = Number(recoverRes.lastInsertRowid)
    planIds.push(recoverPlanId)

    draft.recover.forEach((item, pos) => {
      insertPlanItem.run(
        recoverPlanId,
        item.dayOfWeek,
        pos,
        item.timeOfDay || '20:00',
        item.title,
        item.instructions || null,
        item.sets || null,
        item.reps ? String(item.reps) : null,
        item.tempo || null,
        item.restSec || null,
        item.durationMin || null,
        item.painLimit || null,
        0,
        item.safetyNote || null,
        null,
        null,
        null,
        null,
        null
      )
    })

    // Update request status to 'sent'
    db.prepare("UPDATE ai_plan_requests SET status = 'sent' WHERE id = ?").run(requestId)
  })

  sendTransaction()

  res.json({
    data: {
      success: true,
      status: 'sent',
      requestId,
      planIds,
    },
  })
})

export default router
