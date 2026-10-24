// my.js — Member/client personal routes.
//
// GET /api/my/specialists (client only): returns the active care team specialists
// supporting this member (platform or organization specialists).

import { Router } from 'express'
import db from '../db/connection.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { mapTypeToField } from './org.js'

const router = Router()

/**
 * GET /api/my/specialists
 * Returns the authenticated client's active care_team specialists.
 */
router.get('/specialists', requireAuth, requireRole('client'), (req, res) => {
  const clientId = req.user.id

  const rows = db
    .prepare(`
      SELECT 
        s.user_id AS specialistId,
        u.name,
        s.type,
        s.photo_url AS photoUrl,
        s.bio,
        o.name AS orgName
      FROM care_team ct
      JOIN specialists s ON s.user_id = ct.specialist_id
      JOIN users u ON u.id = s.user_id
      LEFT JOIN organizations o ON o.id = s.organization_id
      WHERE ct.client_id = ? AND ct.status = 'active'
      ORDER BY ct.created_at ASC
    `)
    .all(clientId)

  const specialists = rows.map((s) => ({
    specialistId: s.specialistId,
    name: s.name,
    type: s.type,
    field: mapTypeToField(s.type),
    photoUrl: s.photoUrl || null,
    bio: s.bio || null,
    orgName: s.orgName || null,
  }))

  res.json({
    data: {
      specialists,
    },
  })
})

export default router
