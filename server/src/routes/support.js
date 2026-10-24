// support.js — Customer support tickets and incident reporting routes.
//
// Endpoints:
// - POST  /api/support/tickets               (Client/Specialist) -> Create a new support ticket or incident report
// - GET   /api/support/tickets/my            (Client/Specialist) -> List user's submitted tickets
// - GET   /api/support/tickets/:id           (Reporter or Admin) -> Get ticket details & message thread
// - POST  /api/support/tickets/:id/messages  (Reporter or Admin) -> Post reply message to thread
// - GET   /api/admin/support/tickets         (Admin only)        -> Overview, metrics, and filterable ticket queue
// - PATCH /api/admin/support/tickets/:id     (Admin only)        -> Update ticket status, priority, resolution
// - POST  /api/admin/support/tickets/:id/action (Admin only)     -> Quick moderation actions (suspend user, refund, cancel)

import { Router } from 'express'
import { z } from 'zod'
import db from '../db/connection.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { validate } from '../middleware/validate.js'
import { toCamelCase } from '../utils/case.js'

const router = Router()

// ── Validation schemas ──────────────────────────────────────────────────────────

const createTicketSchema = z.object({
  category: z.enum([
    'session_dispute',
    'specialist_conduct',
    'client_conduct',
    'billing_refund',
    'technical_issue',
    'general_inquiry',
  ]),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  subject: z.string().trim().min(3, 'Subject must be at least 3 characters.').max(200),
  description: z.string().trim().min(10, 'Description must be at least 10 characters.').max(3000),
  bookingId: z.coerce.number().int().positive().optional().nullable(),
  targetUserId: z.coerce.number().int().positive().optional().nullable(),
})

const createMessageSchema = z.object({
  message: z.string().trim().min(1, 'Message cannot be empty.').max(2000),
  isInternal: z.coerce.boolean().optional().default(false),
})

const updateTicketSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignedTo: z.coerce.number().int().positive().optional().nullable(),
  resolutionNote: z.string().trim().max(1000).optional().nullable(),
})

const ticketActionSchema = z.object({
  action: z.enum(['suspend_user', 'cancel_booking', 'flag_refund']),
  reason: z.string().trim().optional(),
})

// ── Helpers ────────────────────────────────────────────────────────────────────

function generateTicketNumber() {
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `TICK-${rand}`
}

// ── User Endpoints (Clients & Specialists) ────────────────────────────────────

/**
 * POST /api/support/tickets
 * Create a new ticket or incident report.
 */
router.post('/tickets', requireAuth, validate(createTicketSchema), (req, res) => {
  const reporterId = req.user.id
  const { category, priority, subject, description, bookingId, targetUserId } = req.body

  let ticketNumber = generateTicketNumber()
  // Ensure ticket number is unique
  let attempts = 0
  while (attempts < 5) {
    const existing = db.prepare('SELECT id FROM support_tickets WHERE ticket_number = ?').get(ticketNumber)
    if (!existing) break
    ticketNumber = generateTicketNumber()
    attempts++
  }

  const now = new Date().toISOString()

  const insertTicket = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO support_tickets 
         (ticket_number, reporter_id, category, priority, status, subject, description, booking_id, target_user_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)`
      )
      .run(
        ticketNumber,
        reporterId,
        category,
        priority,
        subject,
        description,
        bookingId || null,
        targetUserId || null,
        now,
        now
      )

    const ticketId = info.lastInsertRowid

    // Insert original description as the first message in the thread
    db.prepare(
      `INSERT INTO ticket_messages (ticket_id, sender_id, message, is_internal, created_at)
       VALUES (?, ?, ?, 0, ?)`
    ).run(ticketId, reporterId, description, now)

    return ticketId
  })

  const ticketId = insertTicket()

  const ticket = db
    .prepare(
      `SELECT t.*, u.name AS reporter_name, u.email AS reporter_email, u.role AS reporter_role
       FROM support_tickets t
       JOIN users u ON u.id = t.reporter_id
       WHERE t.id = ?`
    )
    .get(ticketId)

  res.status(201).json({
    data: {
      ticket: toCamelCase(ticket),
    },
  })
})

/**
 * GET /api/support/tickets/my
 * Returns the authenticated user's submitted support tickets.
 */
router.get('/tickets/my', requireAuth, (req, res) => {
  const userId = req.user.id

  const rows = db
    .prepare(
      `SELECT 
         t.*,
         (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id AND is_internal = 0) AS message_count,
         (SELECT message FROM ticket_messages WHERE ticket_id = t.id AND is_internal = 0 ORDER BY created_at DESC LIMIT 1) AS last_message,
         tu.name AS target_user_name
       FROM support_tickets t
       LEFT JOIN users tu ON tu.id = t.target_user_id
       WHERE t.reporter_id = ?
       ORDER BY t.updated_at DESC`
    )
    .all(userId)

  res.json({
    data: {
      tickets: rows.map(toCamelCase),
    },
  })
})

/**
 * GET /api/support/tickets/:id
 * Returns a single ticket with its conversation thread.
 * Accessible by ticket reporter OR admins.
 */
router.get('/tickets/:id', requireAuth, (req, res) => {
  const ticketId = Number(req.params.id)
  const user = req.user

  const ticket = db
    .prepare(
      `SELECT 
         t.*,
         ru.name AS reporter_name,
         ru.email AS reporter_email,
         ru.role AS reporter_role,
         tu.name AS target_user_name,
         tu.role AS target_user_role,
         au.name AS assignee_name,
         b.session_type AS booking_session_type,
         b.price_egp AS booking_price_egp
       FROM support_tickets t
       JOIN users ru ON ru.id = t.reporter_id
       LEFT JOIN users tu ON tu.id = t.target_user_id
       LEFT JOIN users au ON au.id = t.assigned_to
       LEFT JOIN bookings b ON b.id = t.booking_id
       WHERE t.id = ?`
    )
    .get(ticketId)

  if (!ticket) {
    return res.status(404).json({ error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found.' } })
  }

  // Permission check: only reporter or admin can view
  if (ticket.reporter_id !== user.id && user.role !== 'admin') {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied.' } })
  }

  // If user is not admin, filter out internal notes
  let messageQuery = `
    SELECT m.*, u.name AS sender_name, u.role AS sender_role
    FROM ticket_messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.ticket_id = ?
  `
  if (user.role !== 'admin') {
    messageQuery += ` AND m.is_internal = 0`
  }
  messageQuery += ` ORDER BY m.created_at ASC`

  const messages = db.prepare(messageQuery).all(ticketId)

  res.json({
    data: {
      ticket: toCamelCase(ticket),
      messages: messages.map(toCamelCase),
    },
  })
})

/**
 * POST /api/support/tickets/:id/messages
 * Appends a message to a ticket thread.
 * Reporters and Admins can post. Admins can mark isInternal=true for staff notes.
 */
router.post('/tickets/:id/messages', requireAuth, validate(createMessageSchema), (req, res) => {
  const ticketId = Number(req.params.id)
  const user = req.user
  const { message, isInternal } = req.body

  const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(ticketId)
  if (!ticket) {
    return res.status(404).json({ error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found.' } })
  }

  // Access check
  if (ticket.reporter_id !== user.id && user.role !== 'admin') {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied.' } })
  }

  // Non-admins cannot post internal notes
  const internalFlag = user.role === 'admin' && Boolean(isInternal) ? 1 : 0
  const now = new Date().toISOString()

  const insertMsg = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO ticket_messages (ticket_id, sender_id, message, is_internal, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(ticketId, user.id, message, internalFlag, now)

    // If ticket was resolved/closed and reporter replies, reopen it to in_progress
    let nextStatus = ticket.status
    if (user.role !== 'admin' && ['resolved', 'closed'].includes(ticket.status)) {
      nextStatus = 'in_progress'
    } else if (user.role === 'admin' && ticket.status === 'open' && !internalFlag) {
      nextStatus = 'in_progress'
    }

    db.prepare('UPDATE support_tickets SET status = ?, updated_at = ? WHERE id = ?').run(
      nextStatus,
      now,
      ticketId
    )

    return info.lastInsertRowid
  })

  const messageId = insertMsg()

  const msgRow = db
    .prepare(
      `SELECT m.*, u.name AS sender_name, u.role AS sender_role
       FROM ticket_messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.id = ?`
    )
    .get(messageId)

  res.status(201).json({
    data: {
      message: toCamelCase(msgRow),
    },
  })
})

// ── Admin Endpoints ────────────────────────────────────────────────────────────

/**
 * GET /api/admin/support/tickets
 * Admin overview: returns triage metrics and filterable list of all platform tickets.
 */
router.get('/admin/tickets', requireAuth, requireRole('admin'), (req, res) => {
  const { status, category, priority, q } = req.query

  let query = `
    SELECT 
      t.*,
      ru.name AS reporter_name,
      ru.email AS reporter_email,
      ru.role AS reporter_role,
      tu.name AS target_user_name,
      au.name AS assignee_name,
      (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id) AS message_count,
      (SELECT message FROM ticket_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) AS last_message
    FROM support_tickets t
    JOIN users ru ON ru.id = t.reporter_id
    LEFT JOIN users tu ON tu.id = t.target_user_id
    LEFT JOIN users au ON au.id = t.assigned_to
    WHERE 1=1
  `
  const params = []

  if (status && status !== 'all') {
    query += ` AND t.status = ?`
    params.push(status)
  }

  if (category && category !== 'all') {
    query += ` AND t.category = ?`
    params.push(category)
  }

  if (priority && priority !== 'all') {
    query += ` AND t.priority = ?`
    params.push(priority)
  }

  if (q && q.trim()) {
    query += ` AND (
      t.ticket_number LIKE ? OR
      t.subject LIKE ? OR
      t.description LIKE ? OR
      ru.name LIKE ? OR
      ru.email LIKE ?
    )`
    const term = `%${q.trim()}%`
    params.push(term, term, term, term, term)
  }

  query += ` ORDER BY 
    CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
    t.updated_at DESC LIMIT 100`

  const rows = db.prepare(query).all(...params)

  // Platform support metrics
  const totalOpen = db.prepare(`SELECT COUNT(*) AS c FROM support_tickets WHERE status IN ('open', 'in_progress')`).get().c
  const urgentCount = db.prepare(`SELECT COUNT(*) AS c FROM support_tickets WHERE status != 'resolved' AND status != 'closed' AND priority IN ('urgent', 'high')`).get().c
  const inProgressCount = db.prepare(`SELECT COUNT(*) AS c FROM support_tickets WHERE status = 'in_progress'`).get().c
  const resolvedCount = db.prepare(`SELECT COUNT(*) AS c FROM support_tickets WHERE status IN ('resolved', 'closed')`).get().c
  const disputesCount = db.prepare(`SELECT COUNT(*) AS c FROM support_tickets WHERE category = 'session_dispute' AND status != 'resolved'`).get().c

  res.json({
    data: {
      metrics: {
        totalOpen,
        urgentCount,
        inProgressCount,
        resolvedCount,
        disputesCount,
      },
      tickets: rows.map(toCamelCase),
    },
  })
})

/**
 * PATCH /api/admin/support/tickets/:id
 * Admin updates ticket status, priority, assignee, or resolution note.
 */
router.patch('/admin/tickets/:id', requireAuth, requireRole('admin'), validate(updateTicketSchema), (req, res) => {
  const ticketId = Number(req.params.id)
  const { status, priority, assignedTo, resolutionNote } = req.body

  const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(ticketId)
  if (!ticket) {
    return res.status(404).json({ error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found.' } })
  }

  const updates = []
  const params = []

  if (status !== undefined) {
    updates.push('status = ?')
    params.push(status)
    if (status === 'resolved' || status === 'closed') {
      updates.push("resolved_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')")
    }
  }

  if (priority !== undefined) {
    updates.push('priority = ?')
    params.push(priority)
  }

  if (assignedTo !== undefined) {
    updates.push('assigned_to = ?')
    params.push(assignedTo)
  }

  if (resolutionNote !== undefined) {
    updates.push('resolution_note = ?')
    params.push(resolutionNote)
  }

  updates.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')")
  params.push(ticketId)

  db.prepare(`UPDATE support_tickets SET ${updates.join(', ')} WHERE id = ?`).run(...params)

  const updated = db
    .prepare(
      `SELECT t.*, ru.name AS reporter_name, tu.name AS target_user_name, au.name AS assignee_name
       FROM support_tickets t
       JOIN users ru ON ru.id = t.reporter_id
       LEFT JOIN users tu ON tu.id = t.target_user_id
       LEFT JOIN users au ON au.id = t.assigned_to
       WHERE t.id = ?`
    )
    .get(ticketId)

  res.json({
    data: {
      ticket: toCamelCase(updated),
    },
  })
})

/**
 * POST /api/admin/support/tickets/:id/action
 * Quick moderation shortcuts: suspend user, flag refund, or cancel disputed booking.
 */
router.post('/admin/tickets/:id/action', requireAuth, requireRole('admin'), validate(ticketActionSchema), (req, res) => {
  const ticketId = Number(req.params.id)
  const { action, reason } = req.body

  const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(ticketId)
  if (!ticket) {
    return res.status(404).json({ error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found.' } })
  }

  const adminId = req.user.id
  const now = new Date().toISOString()
  let actionMessage = ''

  if (action === 'suspend_user') {
    if (!ticket.target_user_id) {
      return res.status(400).json({ error: { code: 'NO_TARGET_USER', message: 'Ticket does not reference a target user.' } })
    }
    db.prepare("UPDATE users SET status = 'suspended' WHERE id = ?").run(ticket.target_user_id)
    actionMessage = `Admin suspended target user (ID #${ticket.target_user_id}). Reason: ${reason || 'Reported misconduct'}.`
  } else if (action === 'cancel_booking') {
    if (!ticket.booking_id) {
      return res.status(400).json({ error: { code: 'NO_BOOKING', message: 'Ticket does not reference a booking.' } })
    }
    db.prepare("UPDATE bookings SET status = 'cancelled', cancelled_at = ? WHERE id = ?").run(now, ticket.booking_id)
    const booking = db.prepare('SELECT slot_id FROM bookings WHERE id = ?').get(ticket.booking_id)
    if (booking?.slot_id) {
      db.prepare('UPDATE availability_slots SET is_booked = 0 WHERE id = ?').run(booking.slot_id)
    }
    actionMessage = `Admin cancelled disputed booking (ID #${ticket.booking_id}) and released slot.`
  } else if (action === 'flag_refund') {
    actionMessage = `Admin approved refund flag for finance disbursement review. Note: ${reason || 'Disputed session refund'}.`
  }

  // Record action as an internal note
  db.prepare(
    `INSERT INTO ticket_messages (ticket_id, sender_id, message, is_internal, created_at)
     VALUES (?, ?, ?, 1, ?)`
  ).run(ticketId, adminId, actionMessage, now)

  // Update ticket status
  db.prepare("UPDATE support_tickets SET status = 'in_progress', updated_at = ? WHERE id = ?").run(now, ticketId)

  res.json({
    data: {
      success: true,
      actionTaken: action,
      actionMessage,
    },
  })
})

export default router
