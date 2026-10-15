// completions.js — Plan item completion check-offs.
//
// PUT /api/completions (client only)
// Body: { planItemId, date, status: "done" | "skipped" | "pending" }
// "pending" removes the row; item must belong to the client's active plan.

import { Router } from 'express'
import { z } from 'zod'
import db from '../db/connection.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { validate } from '../middleware/validate.js'

const router = Router()

router.use(requireAuth, requireRole('client'))

const completionSchema = z.object({
  planItemId: z.coerce.number().int().positive('Plan item ID is required.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted YYYY-MM-DD.').optional(),
  status: z.enum(['done', 'skipped', 'pending']),
})

/**
 * PUT /api/completions
 * Checks off or resets a plan item for a specific date.
 */
router.put('/', validate(completionSchema), (req, res) => {
  const clientId = req.user.id
  const { planItemId, status } = req.body
  const date = req.body.date || new Date().toISOString().slice(0, 10)

  // 1. Verify plan item belongs to this client's active plan
  const item = db
    .prepare(
      `SELECT pi.id, p.service
       FROM plan_items pi
       JOIN plans p ON p.id = pi.plan_id
       WHERE pi.id = ? AND p.client_id = ? AND p.status = 'active'`
    )
    .get(planItemId, clientId)

  if (!item) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'This plan item does not belong to any of your active plans.',
      },
    })
  }

  // 2. If status is 'pending', remove the completion row
  if (status === 'pending') {
    db.prepare('DELETE FROM item_completions WHERE client_id = ? AND plan_item_id = ? AND date = ?').run(clientId, planItemId, date)
  } else {
    // 3. Insert or update the status
    db.prepare(
      `INSERT INTO item_completions (client_id, plan_item_id, date, status)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (client_id, plan_item_id, date) DO UPDATE SET status = excluded.status`
    ).run(clientId, planItemId, date, status)
  }

  res.json({
    data: {
      success: true,
      planItemId,
      date,
      status,
    },
  })
})

export default router

