// checkout.js — Mock checkout and subscription route.
//
// In this demo, no real payment processor (e.g. Stripe or Paymob) is used.
// Clients select a plan name ('Starter', 'Plus', 'Full Team') and a payment method.
// The price is securely determined on the server — never trusted from the client.
// An active subscription record is created with a reference code (e.g. DEMO-XXXXXX).

import { Router } from 'express'
import { z } from 'zod'
import db from '../db/connection.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { validate } from '../middleware/validate.js'

const router = Router()

// Server-side pricing table. The client cannot dictate these values.
const PLAN_PRICES = {
  'Starter': 399,
  'Plus': 899,
  'Full Team': 1499,
}

const checkoutSchema = z.object({
  planName: z.enum(['Starter', 'Plus', 'Full Team'], {
    errorMap: () => ({ message: "planName must be 'Starter', 'Plus', or 'Full Team'" }),
  }),
  method: z.enum(['card', 'fawry', 'vodafone_cash', 'instapay'], {
    errorMap: () => ({ message: "method must be 'card', 'fawry', 'vodafone_cash', or 'instapay'" }),
  }),
})

/**
 * POST /api/checkout
 * Records a mock subscription for the authenticated client.
 */
router.post('/', requireAuth, requireRole('client'), validate(checkoutSchema), (req, res) => {
  const clientId = req.user.id
  const { planName, method } = req.body

  const priceEgp = PLAN_PRICES[planName]

  // Generate a realistic demo reference code, e.g. DEMO-8F2K41
  const randomChars = Math.random().toString(36).substring(2, 8).toUpperCase()
  const reference = `DEMO-${randomChars}`

  const info = db
    .prepare(
      `INSERT INTO subscriptions (client_id, plan_name, price_egp, method, status, reference)
       VALUES (?, ?, ?, ?, 'active', ?)`
    )
    .run(clientId, planName, priceEgp, method, reference)

  const subscription = db
    .prepare(`SELECT * FROM subscriptions WHERE id = ?`)
    .get(info.lastInsertRowid)

  res.status(201).json({
    data: {
      subscription: {
        id: subscription.id,
        clientId: subscription.client_id,
        planName: subscription.plan_name,
        priceEgp: subscription.price_egp,
        method: subscription.method,
        status: subscription.status,
        reference: subscription.reference,
        createdAt: subscription.created_at,
      },
    },
  })
})

/**
 * GET /api/checkout/current
 * Returns the authenticated client's latest active subscription if any.
 */
router.get('/current', requireAuth, requireRole('client'), (req, res) => {
  const clientId = req.user.id

  const subscription = db
    .prepare(
      `SELECT * FROM subscriptions
       WHERE client_id = ? AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(clientId)

  if (!subscription) {
    return res.json({ data: { subscription: null } })
  }

  res.json({
    data: {
      subscription: {
        id: subscription.id,
        clientId: subscription.client_id,
        planName: subscription.plan_name,
        priceEgp: subscription.price_egp,
        method: subscription.method,
        status: subscription.status,
        reference: subscription.reference,
        createdAt: subscription.created_at,
      },
    },
  })
})

export default router

