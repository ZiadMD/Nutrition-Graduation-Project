// specialists.js — Public specialist directory and availability slots.
//
// Endpoints:
// - GET /api/specialists             (public) -> filtered, sorted list with nextAvailable
// - GET /api/specialists/:id         (public) -> profile and packages
// - GET /api/specialists/:id/slots   (public) -> open future slots

import { Router } from 'express'
import db from '../db/connection.js'
import { toCamelCase } from '../utils/case.js'

const router = Router()

// Map between specialist types and service names
const SERVICE_TYPE_MAP = {
  move: 'trainer',
  trainer: 'trainer',
  eat: 'nutritionist',
  nutritionist: 'nutritionist',
  recover: 'physical_therapist',
  physical_therapist: 'physical_therapist',
}

const TYPE_TO_SERVICE = {
  trainer: 'move',
  nutritionist: 'eat',
  physical_therapist: 'recover',
}

/**
 * GET /api/specialists
 * Query params:
 *   - type: 'move'|'eat'|'recover'|'trainer'|'nutritionist'|'physical_therapist'
 *   - q: search term (name, bio, credentials, city, focus_tags)
 *   - sort: 'soonest' | 'rate' | 'low' | 'high' | 'experience' | 'exp'
 * Approved specialists only.
 */
router.get('/', (req, res) => {
  const { type, q, sort = 'soonest' } = req.query

  let query = `
    SELECT 
      u.id,
      u.name,
      u.email,
      s.type,
      s.credentials,
      s.bio,
      s.focus_tags,
      s.photo_url,
      s.city,
      s.years_experience,
      s.languages,
      s.rate_egp,
      s.sessions_completed,
      (
        SELECT starts_at
        FROM availability_slots
        WHERE specialist_id = u.id
          AND is_booked = 0
          AND starts_at > strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        ORDER BY starts_at ASC
        LIMIT 1
      ) AS next_available
    FROM specialists s
    JOIN users u ON u.id = s.user_id
    WHERE s.approval_status = 'approved' AND u.status = 'active'
  `
  const params = []

  // Filter by specialist type / service
  if (type && type !== 'all') {
    const dbType = SERVICE_TYPE_MAP[type.toLowerCase()]
    if (dbType) {
      query += ` AND s.type = ?`
      params.push(dbType)
    }
  }

  // Search by keyword in name, bio, credentials, city, or focus_tags
  if (q && q.trim()) {
    query += ` AND (
      u.name LIKE ? OR 
      s.bio LIKE ? OR 
      s.credentials LIKE ? OR 
      s.city LIKE ? OR 
      s.focus_tags LIKE ?
    )`
    const term = `%${q.trim()}%`
    params.push(term, term, term, term, term)
  }

  // Sorting
  switch (sort) {
    case 'rate':
    case 'low':
      query += ` ORDER BY s.rate_egp ASC`
      break
    case 'high':
      query += ` ORDER BY s.rate_egp DESC`
      break
    case 'experience':
    case 'exp':
      query += ` ORDER BY s.years_experience DESC`
      break
    case 'soonest':
    default:
      // Place specialists with earliest next_available first, NULLs last
      query += ` ORDER BY (next_available IS NULL), next_available ASC, s.years_experience DESC`
      break
  }

  query += ` LIMIT 100`

  const rows = db.prepare(query).all(...params)

  // Attach packages to each specialist
  const getPackages = db.prepare(
    `SELECT id, name, description, sessions_count, price_egp
     FROM specialist_packages
     WHERE specialist_id = ?
     ORDER BY sessions_count ASC`
  )

  const specialists = rows.map((row) => {
    const specialist = toCamelCase(row)
    specialist.service = TYPE_TO_SERVICE[row.type] || 'move'
    specialist.packages = getPackages.all(row.id).map(toCamelCase)
    return specialist
  })

  res.json({
    data: {
      specialists,
    },
  })
})

function resolveSpecialistId(param) {
  const num = Number(param)
  if (!Number.isNaN(num)) return num
  const row = db
    .prepare(
      `SELECT u.id FROM users u
       JOIN specialists s ON s.user_id = u.id
       WHERE LOWER(u.email) LIKE ? OR LOWER(u.name) LIKE ?`
    )
    .get(`${param.toLowerCase()}%`, `%${param.toLowerCase()}%`)
  return row ? row.id : null
}

/**
 * GET /api/specialists/:id
 * Returns a single specialist's profile, next available slot, and packages.
 */
router.get('/:id', (req, res) => {
  const specialistId = resolveSpecialistId(req.params.id)
  if (!specialistId) {
    return res.status(404).json({ error: { code: 'SPECIALIST_NOT_FOUND', message: 'Specialist not found.' } })
  }

  const row = db
    .prepare(
      `SELECT 
        u.id,
        u.name,
        u.email,
        s.type,
        s.credentials,
        s.bio,
        s.focus_tags,
        s.photo_url,
        s.city,
        s.years_experience,
        s.languages,
        s.rate_egp,
        s.sessions_completed,
        (
          SELECT starts_at
          FROM availability_slots
          WHERE specialist_id = u.id
            AND is_booked = 0
            AND starts_at > strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
          ORDER BY starts_at ASC
          LIMIT 1
        ) AS next_available
      FROM specialists s
      JOIN users u ON u.id = s.user_id
      WHERE u.id = ? AND s.approval_status = 'approved' AND u.status = 'active'`
    )
    .get(specialistId)

  if (!row) {
    return res.status(404).json({
      error: { code: 'SPECIALIST_NOT_FOUND', message: 'Specialist not found or not approved.' },
    })
  }

  const specialist = toCamelCase(row)
  specialist.service = TYPE_TO_SERVICE[row.type] || 'move'
  specialist.packages = db
    .prepare(
      `SELECT id, name, description, sessions_count, price_egp
       FROM specialist_packages
       WHERE specialist_id = ?
       ORDER BY sessions_count ASC`
    )
    .all(specialistId)
    .map(toCamelCase)

  res.json({
    data: {
      specialist,
    },
  })
})

/**
 * GET /api/specialists/:id/slots
 * Returns open, future availability slots for a specialist.
 * Query params: ?from=&to= (ISO date or date-time strings)
 */
router.get('/:id/slots', (req, res) => {
  const specialistId = resolveSpecialistId(req.params.id)
  if (!specialistId) {
    return res.status(404).json({ error: { code: 'SPECIALIST_NOT_FOUND', message: 'Specialist not found.' } })
  }

  const { from, to } = req.query

  let query = `
    SELECT id, specialist_id, starts_at, ends_at
    FROM availability_slots
    WHERE specialist_id = ?
      AND is_booked = 0
      AND starts_at > strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
  `
  const params = [specialistId]

  if (from) {
    query += ` AND starts_at >= ?`
    params.push(from)
  }
  if (to) {
    query += ` AND starts_at <= ?`
    params.push(to)
  }

  query += ` ORDER BY starts_at ASC LIMIT 100`

  const slots = db.prepare(query).all(...params).map(toCamelCase)

  res.json({
    data: {
      slots,
    },
  })
})

export default router

