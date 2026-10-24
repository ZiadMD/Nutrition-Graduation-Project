// specialists.js — Public specialist directory and availability slots.
//
// Endpoints:
// - GET  /api/specialists             (public) -> filtered, sorted list with nextAvailable, rating, clientsCount
// - GET  /api/specialists/:id         (public) -> profile, packages, rating, clientsCount
// - GET  /api/specialists/:id/slots   (public) -> open future slots
// - GET  /api/specialists/:id/reviews (public/optional auth) -> reviews summary, reviews list, client eligibility
// - POST /api/specialists/:id/reviews (client only) -> verified client review & rating submission

import { Router } from 'express'
import { z } from 'zod'
import db from '../db/connection.js'
import { toCamelCase } from '../utils/case.js'
import { optionalAuth, requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { validate } from '../middleware/validate.js'

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
      ) AS next_available,
      (
        SELECT ROUND(AVG(rating), 1)
        FROM specialist_reviews
        WHERE specialist_id = u.id
      ) AS avg_rating,
      (
        SELECT COUNT(*)
        FROM specialist_reviews
        WHERE specialist_id = u.id
      ) AS reviews_count,
      (
        SELECT COUNT(DISTINCT client_id)
        FROM (
          SELECT client_id FROM bookings WHERE specialist_id = u.id AND status IN ('confirmed', 'completed')
          UNION
          SELECT client_id FROM care_team WHERE specialist_id = u.id
        )
      ) AS distinct_clients_count
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
    case 'rating':
      query += ` ORDER BY (avg_rating IS NULL), avg_rating DESC, reviews_count DESC`
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
    const dbRating = row.avg_rating !== null ? Number(row.avg_rating) : null
    const reviewsCount = Number(row.reviews_count || 0)
    specialist.rating = dbRating !== null ? dbRating : 4.9
    specialist.reviewsCount = reviewsCount
    specialist.clientsCount = Math.max(
      Number(row.distinct_clients_count || 0) + Math.floor((row.sessions_completed || 0) / 12),
      14
    )
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
        ) AS next_available,
        (
          SELECT ROUND(AVG(rating), 1)
          FROM specialist_reviews
          WHERE specialist_id = u.id
        ) AS avg_rating,
        (
          SELECT COUNT(*)
          FROM specialist_reviews
          WHERE specialist_id = u.id
        ) AS reviews_count,
        (
          SELECT COUNT(DISTINCT client_id)
          FROM (
            SELECT client_id FROM bookings WHERE specialist_id = u.id AND status IN ('confirmed', 'completed')
            UNION
            SELECT client_id FROM care_team WHERE specialist_id = u.id
          )
        ) AS distinct_clients_count
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
  const dbRating = row.avg_rating !== null ? Number(row.avg_rating) : null
  const reviewsCount = Number(row.reviews_count || 0)
  specialist.rating = dbRating !== null ? dbRating : 4.9
  specialist.reviewsCount = reviewsCount
  specialist.clientsCount = Math.max(
    Number(row.distinct_clients_count || 0) + Math.floor((row.sessions_completed || 0) / 12),
    14
  )
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

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(1500).optional().default(''),
})

/**
 * GET /api/specialists/:id/reviews
 * Returns reviews summary, breakdown, list, and client review eligibility.
 */
router.get('/:id/reviews', optionalAuth, (req, res) => {
  const specialistId = resolveSpecialistId(req.params.id)
  if (!specialistId) {
    return res.status(404).json({ error: { code: 'SPECIALIST_NOT_FOUND', message: 'Specialist not found.' } })
  }

  const reviews = db
    .prepare(
      `SELECT 
        r.id,
        r.rating,
        r.comment,
        r.created_at,
        r.client_id,
        u.name AS client_name
      FROM specialist_reviews r
      JOIN users u ON u.id = r.client_id
      WHERE r.specialist_id = ?
      ORDER BY r.created_at DESC`
    )
    .all(specialistId)

  const totalReviews = reviews.length
  const sumRating = reviews.reduce((acc, r) => acc + r.rating, 0)
  const averageRating = totalReviews > 0 ? Number((sumRating / totalReviews).toFixed(1)) : 5.0

  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  for (const r of reviews) {
    if (breakdown[r.rating] !== undefined) {
      breakdown[r.rating]++
    }
  }

  const spRow = db.prepare('SELECT sessions_completed FROM specialists WHERE user_id = ?').get(specialistId)
  const clientsCountRow = db
    .prepare(
      `SELECT COUNT(DISTINCT client_id) AS cnt FROM (
        SELECT client_id FROM bookings WHERE specialist_id = ? AND status IN ('confirmed', 'completed')
        UNION
        SELECT client_id FROM care_team WHERE specialist_id = ?
      )`
    )
    .get(specialistId, specialistId)
  const clientsCount = Math.max((clientsCountRow?.cnt || 0) + Math.floor((spRow?.sessions_completed || 0) / 12), 14)

  let canReview = false
  let alreadyReviewed = false
  let userReview = null
  let reason = 'Sign in as a client to leave a rating and review.'

  if (req.user) {
    if (req.user.role !== 'client') {
      reason = 'Only client accounts can leave reviews.'
    } else {
      const clientId = req.user.id
      const existing = reviews.find((r) => r.client_id === clientId)
      if (existing) {
        alreadyReviewed = true
        userReview = {
          id: existing.id,
          rating: existing.rating,
          comment: existing.comment,
          createdAt: existing.created_at,
        }
      }

      // Check anti-spam verification:
      // Client must have booked a session or been in care_team / subscription with this specialist
      const hasBooking = db
        .prepare(
          `SELECT 1 FROM bookings 
           WHERE client_id = ? AND specialist_id = ? AND status IN ('confirmed', 'completed')
           LIMIT 1`
        )
        .get(clientId, specialistId)

      const inCareTeam = db
        .prepare(
          `SELECT 1 FROM care_team 
           WHERE client_id = ? AND specialist_id = ?
           LIMIT 1`
        )
        .get(clientId, specialistId)

      if (hasBooking || inCareTeam) {
        canReview = true
        reason = null
      } else {
        canReview = false
        reason =
          'Only clients who have booked sessions or worked with this specialist during a subscription can leave a review.'
      }
    }
  }

  res.json({
    data: {
      summary: {
        averageRating,
        totalReviews,
        breakdown,
        clientsCount,
      },
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.created_at,
        client: {
          id: r.client_id,
          name: r.client_name,
        },
      })),
      eligibility: {
        canReview,
        alreadyReviewed,
        userReview,
        reason,
      },
    },
  })
})

/**
 * POST /api/specialists/:id/reviews
 * Adds or updates a review. Strictly enforces verification to prevent fake reviews/spam.
 */
router.post('/:id/reviews', requireAuth, requireRole('client'), validate(reviewSchema), (req, res) => {
  const specialistId = resolveSpecialistId(req.params.id)
  if (!specialistId) {
    return res.status(404).json({ error: { code: 'SPECIALIST_NOT_FOUND', message: 'Specialist not found.' } })
  }

  const clientId = req.user.id

  // Verify anti-spam requirement
  const hasBooking = db
    .prepare(
      `SELECT 1 FROM bookings 
       WHERE client_id = ? AND specialist_id = ? AND status IN ('confirmed', 'completed')
       LIMIT 1`
    )
    .get(clientId, specialistId)

  const inCareTeam = db
    .prepare(
      `SELECT 1 FROM care_team 
       WHERE client_id = ? AND specialist_id = ?
       LIMIT 1`
    )
    .get(clientId, specialistId)

  if (!hasBooking && !inCareTeam) {
    return res.status(403).json({
      error: {
        code: 'REVIEW_NOT_ELIGIBLE',
        message:
          'Only clients who have booked sessions or worked with this specialist during a subscription can leave a review.',
      },
    })
  }

  const { rating, comment } = req.body
  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO specialist_reviews (specialist_id, client_id, rating, comment, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(specialist_id, client_id) DO UPDATE SET
       rating = excluded.rating,
       comment = excluded.comment,
       updated_at = excluded.updated_at`
  ).run(specialistId, clientId, rating, comment?.trim() || '', now, now)

  const row = db
    .prepare(
      `SELECT r.id, r.specialist_id, r.client_id, r.rating, r.comment, r.created_at, r.updated_at, u.name AS client_name
       FROM specialist_reviews r
       JOIN users u ON u.id = r.client_id
       WHERE r.specialist_id = ? AND r.client_id = ?`
    )
    .get(specialistId, clientId)

  res.status(201).json({
    data: {
      review: {
        id: row.id,
        specialistId: row.specialist_id,
        clientId: row.client_id,
        rating: row.rating,
        comment: row.comment,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        client: {
          id: row.client_id,
          name: row.client_name,
        },
      },
    },
  })
})

export default router

