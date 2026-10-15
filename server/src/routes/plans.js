// plans.js — Client plans endpoint.
//
// GET /api/plans?service=move|eat|recover (client only)
// Returns the active plan with author, updatedAt, summary, and days with items.
// If service is omitted, returns all three active plans.

import { Router } from 'express'
import db from '../db/connection.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { toCamelCase } from '../utils/case.js'

const router = Router()

// All plan routes require client role
router.use(requireAuth, requireRole('client'))

function formatPlanWithDays(planRow) {
  if (!planRow) return null

  const items = db
    .prepare(
      `SELECT * FROM plan_items
       WHERE plan_id = ?
       ORDER BY day_of_week ASC, position ASC`
    )
    .all(planRow.id)

  // Group items by day_of_week (1..7)
  const daysMap = new Map()
  for (let d = 1; d <= 7; d++) {
    daysMap.set(d, [])
  }

  for (const item of items) {
    const formatted = toCamelCase(item)
    formatted.ptCleared = Boolean(item.pt_cleared)
    if (!daysMap.has(item.day_of_week)) {
      daysMap.set(item.day_of_week, [])
    }
    daysMap.get(item.day_of_week).push(formatted)
  }

  const days = []
  for (const [dayOfWeek, dayItems] of daysMap.entries()) {
    if (dayItems.length > 0) {
      days.push({
        dayOfWeek,
        items: dayItems,
      })
    }
  }

  return {
    id: planRow.id,
    service: planRow.service,
    source: planRow.source,
    status: planRow.status,
    title: planRow.title,
    summary: planRow.summary || '',
    updatedAt: planRow.updated_at,
    createdAt: planRow.created_at,
    author: planRow.author_id
      ? {
          id: planRow.author_id,
          name: planRow.author_name,
          type: planRow.author_type,
        }
      : null,
    days,
  }
}

/**
 * GET /api/plans
 * Query params: ?service=move|eat|recover
 */
router.get('/', (req, res) => {
  const clientId = req.user.id
  const { service } = req.query

  let query = `
    SELECT 
      p.*,
      u.name AS author_name,
      sp.type AS author_type
    FROM plans p
    LEFT JOIN users u ON u.id = p.author_id
    LEFT JOIN specialists sp ON sp.user_id = p.author_id
    WHERE p.client_id = ? AND p.status = 'active'
  `
  const params = [clientId]

  if (service) {
    query += ` AND p.service = ?`
    params.push(service.toLowerCase())
    const row = db.prepare(query).get(...params)
    const plan = formatPlanWithDays(row)

    return res.json({
      data: {
        plan,
      },
    })
  }

  // Without ?service, return all active plans
  query += ` ORDER BY CASE p.service WHEN 'move' THEN 1 WHEN 'eat' THEN 2 WHEN 'recover' THEN 3 ELSE 4 END`
  const rows = db.prepare(query).all(...params)
  const plans = rows.map(formatPlanWithDays).filter(Boolean)

  res.json({
    data: {
      plans,
    },
  })
})

export default router

