// bookings.js — Booking creation, listing, cancellation, and rescheduling.
//
// Endpoints:
// - POST  /api/bookings               (client only) -> creates booking in a transaction with slot locking
// - GET   /api/bookings               (client only) -> list upcoming or past bookings
// - PATCH /api/bookings/:id/cancel    (client only) -> cancel booking (enforces >= 12h cancellation rule)
// - PATCH /api/bookings/:id/reschedule(client only) -> reschedule to new slot in one transaction
// - GET   /api/bookings/:id/session   (client/specialist) -> session mock data

import { Router } from 'express'
import { z } from 'zod'
import db from '../db/connection.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { validate } from '../middleware/validate.js'
import { toCamelCase } from '../utils/case.js'

const router = Router()

// ── Validation schemas ───────────────────────────────────────────────────────

const createBookingSchema = z.object({
  specialistId: z.union([z.number(), z.string()]),
  slotId: z.coerce.number().int().positive('Slot ID is required.'),
  sessionType: z.string().transform((v) => {
    const s = String(v).toLowerCase()
    return s.includes('chat') ? 'chat' : 'video'
  }),
  packageId: z.coerce.number().int().positive().optional(),
  notes: z.string().optional(),
})

const rescheduleSchema = z.object({
  slotId: z.coerce.number().int().positive('Target slot ID is required.'),
})

// ── Helper to format booking response ───────────────────────────────────────

function formatBooking(row) {
  return {
    id: row.id,
    sessionType: row.session_type,
    status: row.status,
    priceEgp: row.price_egp,
    notes: row.notes || '',
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    slot: {
      id: row.slot_id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
    },
    specialist: {
      id: row.specialist_id,
      name: row.specialist_name,
      type: row.specialist_type,
      photoUrl: row.specialist_photo_url,
      rateEgp: row.specialist_rate_egp,
      credentials: row.specialist_credentials,
    },
    package: row.package_id
      ? {
          id: row.package_id,
          name: row.package_name,
          sessionsCount: row.package_sessions_count,
        }
      : null,
  }
}

// ── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/bookings
 * Client books an appointment with an approved specialist.
 * Handled in an atomic transaction:
 * - Slot must be open and in the future.
 * - Slot is set to is_booked = 1.
 * - Price computed server-side.
 * - Adds to care_team.
 * - Returns 409 SLOT_TAKEN on conflict.
 */
router.post('/', requireAuth, requireRole('client'), validate(createBookingSchema), (req, res) => {
  const clientId = req.user.id
  const { specialistId, slotId, sessionType, packageId, notes } = req.body

  let resolvedSpecialistId = Number(specialistId)
  if (Number.isNaN(resolvedSpecialistId)) {
    const row = db
      .prepare(
        `SELECT u.id FROM users u
         JOIN specialists s ON s.user_id = u.id
         WHERE LOWER(u.email) LIKE ? OR LOWER(u.name) LIKE ?`
      )
      .get(`${String(specialistId).toLowerCase()}%`, `%${String(specialistId).toLowerCase()}%`)
    resolvedSpecialistId = row ? row.id : 0
  }

  try {
    const bookTransaction = db.transaction(() => {
      // 1. Fetch and validate slot
      const slot = db.prepare('SELECT * FROM availability_slots WHERE id = ?').get(slotId)
      if (!slot) {
        const err = new Error('Slot does not exist.')
        err.status = 404
        err.code = 'SLOT_NOT_FOUND'
        throw err
      }

      if (slot.specialist_id !== resolvedSpecialistId) {
        const err = new Error('Slot does not belong to the selected specialist.')
        err.status = 400
        err.code = 'INVALID_SLOT'
        throw err
      }

      // Check slot is in the future
      if (new Date(slot.starts_at).getTime() <= Date.now()) {
        const err = new Error('Cannot book an appointment in the past.')
        err.status = 400
        err.code = 'PAST_SLOT'
        throw err
      }

      // Check slot is not booked
      if (slot.is_booked === 1) {
        const err = new Error('This time slot is already booked.')
        err.status = 409
        err.code = 'SLOT_TAKEN'
        throw err
      }

      // 2. Fetch and validate approved specialist
      const specialist = db
        .prepare("SELECT user_id, rate_egp, approval_status FROM specialists WHERE user_id = ? AND approval_status = 'approved'")
        .get(resolvedSpecialistId)
      if (!specialist) {
        const err = new Error('Specialist is not available for booking.')
        err.status = 400
        err.code = 'SPECIALIST_UNAVAILABLE'
        throw err
      }

      // 3. Compute price server-side
      let priceEgp = specialist.rate_egp
      if (packageId) {
        const pkg = db
          .prepare('SELECT id, price_egp FROM specialist_packages WHERE id = ? AND specialist_id = ?')
          .get(packageId, resolvedSpecialistId)
        if (!pkg) {
          const err = new Error('Selected package does not belong to this specialist.')
          err.status = 400
          err.code = 'INVALID_PACKAGE'
          throw err
        }
        priceEgp = pkg.price_egp
      } else if (sessionType === 'chat') {
        // Chat sessions are 40% cheaper
        priceEgp = Math.round(specialist.rate_egp * 0.6)
      }

      // 4. Atomic slot lock
      const updateSlot = db.prepare('UPDATE availability_slots SET is_booked = 1 WHERE id = ? AND is_booked = 0').run(slotId)
      if (updateSlot.changes === 0) {
        const err = new Error('This time slot is already booked.')
        err.status = 409
        err.code = 'SLOT_TAKEN'
        throw err
      }

      // 5. Insert booking
      const insertBooking = db.prepare(
        `INSERT INTO bookings (client_id, specialist_id, slot_id, package_id, session_type, price_egp, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?)`
      ).run(clientId, resolvedSpecialistId, slotId, packageId || null, sessionType, priceEgp, notes || null)

      const newBookingId = Number(insertBooking.lastInsertRowid)

      // 6. Ensure care team connection
      db.prepare('INSERT OR IGNORE INTO care_team (client_id, specialist_id) VALUES (?, ?)').run(clientId, resolvedSpecialistId)

      return newBookingId
    })

    const bookingId = bookTransaction()

    // Fetch full booking record
    const row = db
      .prepare(
        `SELECT 
          b.*,
          s.starts_at,
          s.ends_at,
          u.name AS specialist_name,
          sp.type AS specialist_type,
          sp.photo_url AS specialist_photo_url,
          sp.rate_egp AS specialist_rate_egp,
          sp.credentials AS specialist_credentials,
          pkg.name AS package_name,
          pkg.sessions_count AS package_sessions_count
        FROM bookings b
        JOIN availability_slots s ON s.id = b.slot_id
        JOIN users u ON u.id = b.specialist_id
        JOIN specialists sp ON sp.user_id = b.specialist_id
        LEFT JOIN specialist_packages pkg ON pkg.id = b.package_id
        WHERE b.id = ?`
      )
      .get(bookingId)

    res.status(201).json({
      data: {
        booking: formatBooking(row),
      },
    })
  } catch (err) {
    if (err.message?.includes('UNIQUE') || err.code === 'SLOT_TAKEN') {
      return res.status(409).json({
        error: { code: 'SLOT_TAKEN', message: 'This time slot is already booked.' },
      })
    }
    throw err
  }
})

/**
 * GET /api/bookings
 * Returns the authenticated client's bookings.
 * Query params: ?tab=upcoming|past (or ?tab=up)
 */
router.get('/', requireAuth, requireRole('client'), (req, res) => {
  const clientId = req.user.id
  const { tab } = req.query

  let query = `
    SELECT 
      b.*,
      s.starts_at,
      s.ends_at,
      u.name AS specialist_name,
      sp.type AS specialist_type,
      sp.photo_url AS specialist_photo_url,
      sp.rate_egp AS specialist_rate_egp,
      sp.credentials AS specialist_credentials,
      pkg.name AS package_name,
      pkg.sessions_count AS package_sessions_count
    FROM bookings b
    JOIN availability_slots s ON s.id = b.slot_id
    JOIN users u ON u.id = b.specialist_id
    JOIN specialists sp ON sp.user_id = b.specialist_id
    LEFT JOIN specialist_packages pkg ON pkg.id = b.package_id
    WHERE b.client_id = ?
  `
  const params = [clientId]

  if (tab === 'upcoming' || tab === 'up') {
    query += ` AND b.status = 'confirmed' AND s.starts_at >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ORDER BY s.starts_at ASC`
  } else if (tab === 'past') {
    query += ` AND (b.status IN ('completed', 'cancelled') OR (b.status = 'confirmed' AND s.starts_at < strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))) ORDER BY s.starts_at DESC`
  } else {
    query += ` ORDER BY s.starts_at DESC`
  }

  query += ` LIMIT 100`

  const rows = db.prepare(query).all(...params)
  const bookings = rows.map(formatBooking)

  res.json({
    data: {
      bookings,
    },
  })
})

/**
 * PATCH /api/bookings/:id/cancel
 * Client cancels a booking. Enforces the >= 12h rule.
 * Frees the availability slot in the same transaction.
 */
router.patch('/:id/cancel', requireAuth, requireRole('client'), (req, res) => {
  const clientId = req.user.id
  const bookingId = Number(req.params.id)

  if (Number.isNaN(bookingId)) {
    return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid booking ID.' } })
  }

  const booking = db
    .prepare(
      `SELECT b.*, s.starts_at 
       FROM bookings b 
       JOIN availability_slots s ON s.id = b.slot_id 
       WHERE b.id = ?`
    )
    .get(bookingId)

  if (!booking) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Booking not found.' } })
  }

  if (booking.client_id !== clientId) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only cancel your own bookings.' } })
  }

  if (booking.status !== 'confirmed') {
    return res.status(400).json({
      error: { code: 'INVALID_STATUS', message: `Cannot cancel a booking with status "${booking.status}".` },
    })
  }

  // 12-hour rule check
  const startsAtMs = new Date(booking.starts_at).getTime()
  const nowMs = Date.now()
  const hoursUntil = (startsAtMs - nowMs) / (1000 * 60 * 60)

  if (hoursUntil < 12) {
    return res.status(409).json({
      error: {
        code: 'TOO_LATE_TO_CANCEL',
        message: 'Sessions cannot be cancelled less than 12 hours before the start time.',
      },
    })
  }

  // Cancel booking and free the slot in a single transaction
  const cancelTransaction = db.transaction(() => {
    db.prepare("UPDATE bookings SET status = 'cancelled', cancelled_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?").run(bookingId)
    db.prepare('UPDATE availability_slots SET is_booked = 0 WHERE id = ?').run(booking.slot_id)
  })

  cancelTransaction()

  res.json({
    data: {
      success: true,
      booking: {
        id: bookingId,
        status: 'cancelled',
        slotId: booking.slot_id,
      },
    },
  })
})

/**
 * PATCH /api/bookings/:id/reschedule
 * Replaces a booking's slot with a new one in a single transaction.
 */
router.patch('/:id/reschedule', requireAuth, requireRole('client'), validate(rescheduleSchema), (req, res) => {
  const clientId = req.user.id
  const bookingId = Number(req.params.id)
  const { slotId: newSlotId } = req.body

  if (Number.isNaN(bookingId)) {
    return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid booking ID.' } })
  }

  const booking = db
    .prepare(
      `SELECT b.*, s.starts_at 
       FROM bookings b 
       JOIN availability_slots s ON s.id = b.slot_id 
       WHERE b.id = ?`
    )
    .get(bookingId)

  if (!booking) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Booking not found.' } })
  }

  if (booking.client_id !== clientId) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only reschedule your own bookings.' } })
  }

  if (booking.status !== 'confirmed') {
    return res.status(400).json({
      error: { code: 'INVALID_STATUS', message: 'Only confirmed bookings can be rescheduled.' },
    })
  }

  // Check 12-hour rule on current booking
  const startsAtMs = new Date(booking.starts_at).getTime()
  const hoursUntil = (startsAtMs - Date.now()) / (1000 * 60 * 60)
  if (hoursUntil < 12) {
    return res.status(409).json({
      error: {
        code: 'TOO_LATE_TO_CANCEL',
        message: 'Sessions cannot be rescheduled less than 12 hours before start time.',
      },
    })
  }

  // Check target slot
  const newSlot = db.prepare('SELECT * FROM availability_slots WHERE id = ?').get(newSlotId)
  if (!newSlot) {
    return res.status(404).json({ error: { code: 'SLOT_NOT_FOUND', message: 'New slot does not exist.' } })
  }

  if (newSlot.specialist_id !== booking.specialist_id) {
    return res.status(400).json({ error: { code: 'INVALID_SLOT', message: 'Slot must belong to the same specialist.' } })
  }

  if (new Date(newSlot.starts_at).getTime() <= Date.now()) {
    return res.status(400).json({ error: { code: 'PAST_SLOT', message: 'Cannot reschedule into the past.' } })
  }

  if (newSlot.is_booked === 1) {
    return res.status(409).json({ error: { code: 'SLOT_TAKEN', message: 'Target time slot is already booked.' } })
  }

  try {
    const rescheduleTransaction = db.transaction(() => {
      // 1. Free old slot
      db.prepare('UPDATE availability_slots SET is_booked = 0 WHERE id = ?').run(booking.slot_id)

      // 2. Lock new slot
      const updateResult = db.prepare('UPDATE availability_slots SET is_booked = 1 WHERE id = ? AND is_booked = 0').run(newSlotId)
      if (updateResult.changes === 0) {
        throw new Error('SLOT_TAKEN')
      }

      // 3. Update booking
      db.prepare('UPDATE bookings SET slot_id = ? WHERE id = ?').run(newSlotId, bookingId)
    })

    rescheduleTransaction()

    res.json({
      data: {
        success: true,
        booking: {
          id: bookingId,
          oldSlotId: booking.slot_id,
          newSlotId,
        },
      },
    })
  } catch (err) {
    if (err.message === 'SLOT_TAKEN') {
      return res.status(409).json({ error: { code: 'SLOT_TAKEN', message: 'Target time slot was just booked.' } })
    }
    throw err
  }
})

/**
 * GET /api/bookings/:id/session
 * Session room details for client or specialist (mock video room).
 */
router.get('/:id/session', requireAuth, (req, res) => {
  const userId = req.user.id
  const bookingId = Number(req.params.id)

  const booking = db
    .prepare(
      `SELECT 
        b.id,
        b.client_id,
        b.specialist_id,
        b.session_type,
        b.notes,
        s.starts_at,
        s.ends_at,
        cu.name AS client_name,
        su.name AS specialist_name,
        sp.type AS specialist_type
      FROM bookings b
      JOIN availability_slots s ON s.id = b.slot_id
      JOIN users cu ON cu.id = b.client_id
      JOIN users su ON su.id = b.specialist_id
      JOIN specialists sp ON sp.user_id = b.specialist_id
      WHERE b.id = ?`
    )
    .get(bookingId)

  if (!booking) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Booking not found.' } })
  }

  // Requester must be either the client or the specialist
  if (booking.client_id !== userId && booking.specialist_id !== userId && req.user.role !== 'admin') {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access to this session is restricted.' } })
  }

  res.json({
    data: {
      session: {
        bookingId: booking.id,
        startsAt: booking.starts_at,
        endsAt: booking.ends_at,
        sessionType: booking.session_type,
        roomUrl: `https://meet.rebound.internal/room-${booking.id}`,
        specialist: {
          id: booking.specialist_id,
          name: booking.specialist_name,
          type: booking.specialist_type,
        },
        client: {
          id: booking.client_id,
          name: booking.client_name,
        },
        notes: booking.notes || '',
      },
    },
  })
})

export default router
