// admin.js — Admin platform management routes.
//
// Guarded with requireAuth and requireRole('admin').
// Provides platform overview metrics, recent activity feeds, user management,
// and specialist credential verification/approval.

import { Router } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import db from '../db/connection.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { validate } from '../middleware/validate.js'

const router = Router()

// All routes require the admin role
router.use(requireAuth, requireRole('admin'))

// Helper: initials
function getInitials(name = '') {
  return name
    .replace(/^(Dr\.|Coach)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

/**
 * GET /api/admin/overview
 * Platform statistics and 10 most recent activity items.
 */
router.get('/overview', (_req, res) => {
  // 1. Metric counts
  const usersCount = db.prepare(`SELECT COUNT(*) AS c FROM users`).get().c
  const activePlansCount = db.prepare(`SELECT COUNT(*) AS c FROM plans WHERE status = 'active'`).get().c
  const bookingsWeekCount = db
    .prepare(`SELECT COUNT(*) AS c FROM bookings WHERE created_at >= date('now', '-7 days')`)
    .get().c
  const specialistsApproved = db
    .prepare(`SELECT COUNT(*) AS c FROM specialists WHERE approval_status = 'approved'`)
    .get().c
  const specialistsPending = db
    .prepare(`SELECT COUNT(*) AS c FROM specialists WHERE approval_status = 'pending'`)
    .get().c
  const specialistsTotal = db.prepare(`SELECT COUNT(*) AS c FROM specialists`).get().c

  // 2. Recent activity feed (derived via UNION across system event tables)
  const activities = db
    .prepare(
      `SELECT * FROM (
        -- User registrations
        SELECT 
          'user_registered' AS type,
          u.name || ' created an account' AS description,
          u.role AS svc_or_role,
          u.created_at AS timestamp
        FROM users u

        UNION ALL

        -- Bookings
        SELECT 
          'booking_created' AS type,
          u.name || ' booked a session with ' || sp_u.name AS description,
          sp.type AS svc_or_role,
          b.created_at AS timestamp
        FROM bookings b
        JOIN users u ON u.id = b.client_id
        JOIN users sp_u ON sp_u.id = b.specialist_id
        JOIN specialists sp ON sp.user_id = sp_u.id

        UNION ALL

        -- Plans updated/created
        SELECT 
          'plan_updated' AS type,
          COALESCE(author.name, 'AI Planner') || ' updated ' || p.service || ' plan for ' || client.name AS description,
          p.service AS svc_or_role,
          p.updated_at AS timestamp
        FROM plans p
        JOIN users client ON client.id = p.client_id
        LEFT JOIN users author ON author.id = p.author_id

        UNION ALL

        -- Subscriptions
        SELECT 
          'subscription_created' AS type,
          u.name || ' subscribed to ' || s.plan_name || ' plan' AS description,
          'move' AS svc_or_role,
          s.created_at AS timestamp
        FROM subscriptions s
        JOIN users u ON u.id = s.client_id

        UNION ALL

        -- Specialist applications
        SELECT 
          'specialist_application' AS type,
          u.name || ' applied as a ' || sp.type AS description,
          sp.type AS svc_or_role,
          u.created_at AS timestamp
        FROM specialists sp
        JOIN users u ON u.id = sp.user_id
        WHERE sp.approval_status = 'pending'
      )
      ORDER BY timestamp DESC
      LIMIT 10`
    )
    .all()

  res.json({
    data: {
      counts: {
        users: usersCount,
        activePlans: activePlansCount,
        bookingsThisWeek: bookingsWeekCount,
        specialists: specialistsTotal,
        approvedSpecialists: specialistsApproved,
        pendingSpecialists: specialistsPending,
      },
      recentActivity: activities,
    },
  })
})

/**
 * GET /api/admin/users
 * Lists user accounts with filtering by role and search query (?q=, ?role=, ?status=).
 */
router.get('/users', (req, res) => {
  const { q, role, status } = req.query

  let query = `
    SELECT id, name, email, role, status, created_at, last_active_at
    FROM users
    WHERE 1=1
  `
  const params = []

  if (q?.trim()) {
    query += ` AND (name LIKE ? OR email LIKE ?)`
    params.push(`%${q.trim()}%`, `%${q.trim()}%`)
  }

  if (role && role !== 'All' && role !== 'all') {
    query += ` AND LOWER(role) = LOWER(?)`
    params.push(role)
  }

  if (status && status !== 'All' && status !== 'all') {
    query += ` AND LOWER(status) = LOWER(?)`
    params.push(status)
  }

  query += ` ORDER BY created_at DESC`

  const rows = db.prepare(query).all(...params)

  const users = rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role.charAt(0).toUpperCase() + u.role.slice(1),
    rawRole: u.role,
    status: u.status.charAt(0).toUpperCase() + u.status.slice(1),
    rawStatus: u.status,
    joined: u.created_at,
    active: u.last_active_at || u.created_at,
  }))

  res.json({
    data: {
      users,
    },
  })
})

const updateUserStatusSchema = z.object({
  status: z.enum(['active', 'suspended'], {
    errorMap: () => ({ message: "status must be 'active' or 'suspended'" }),
  }),
})

/**
 * PATCH /api/admin/users/:id/status
 * Suspends or reactivates a user account.
 */
router.patch('/users/:id/status', validate(updateUserStatusSchema), (req, res) => {
  const userId = Number(req.params.id)
  const { status } = req.body

  const existing = db.prepare(`SELECT id, name, email, role, status FROM users WHERE id = ?`).get(userId)
  if (!existing) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'User not found.' },
    })
  }

  db.prepare(`UPDATE users SET status = ? WHERE id = ?`).run(status, userId)

  const updated = db.prepare(`SELECT id, name, email, role, status FROM users WHERE id = ?`).get(userId)

  res.json({
    data: {
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        status: updated.status,
      },
    },
  })
})

const updateUserRoleSchema = z.object({
  role: z.enum(['client', 'specialist', 'admin', 'finance'], {
    errorMap: () => ({ message: "role must be 'client', 'specialist', 'admin', or 'finance'" }),
  }),
})

/**
 * PATCH /api/admin/users/:id/role
 * Admin updates user role (e.g., assign 'finance' role).
 */
router.patch('/users/:id/role', validate(updateUserRoleSchema), (req, res) => {
  const userId = Number(req.params.id)
  const { role } = req.body

  if (role === 'org_admin') {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'The org_admin role cannot be assigned by platform admin.' },
    })
  }

  const existing = db.prepare(`SELECT id, name, email, role, status FROM users WHERE id = ?`).get(userId)
  if (!existing) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'User not found.' },
    })
  }

  db.prepare(`UPDATE users SET role = ? WHERE id = ?`).run(role, userId)
  const updated = db.prepare(`SELECT id, name, email, role, status FROM users WHERE id = ?`).get(userId)

  res.json({
    data: {
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        status: updated.status,
      },
    },
  })
})

const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  email: z.string().trim().email('Valid email address required.'),
  password: z.string().min(6, 'Password must be at least 6 characters long.'),
  role: z.enum(['client', 'specialist', 'admin', 'finance'], {
    errorMap: () => ({ message: "role must be 'client', 'specialist', 'admin', or 'finance'" }),
  }),
})

/**
 * POST /api/admin/users
 * Admin creates a new user account directly with specified role.
 */
router.post('/users', validate(createUserSchema), (req, res) => {
  const { name, email, password, role } = req.body

  if (role === 'org_admin') {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'The org_admin role cannot be created by platform admin.' },
    })
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email)
  if (existing) {
    return res.status(409).json({
      error: { code: 'EMAIL_IN_USE', message: 'A user with this email already exists.' },
    })
  }

  const passwordHash = bcrypt.hashSync(password, 10)

  const result = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, status)
      VALUES (?, ?, ?, ?, 'active')
    `).run(name, email, passwordHash, role)

    const newUserId = Number(info.lastInsertRowid)

    if (role === 'client') {
      db.prepare('INSERT INTO client_profiles (user_id, onboarding_completed) VALUES (?, 0)').run(newUserId)
    } else if (role === 'specialist') {
      db.prepare(`
        INSERT INTO specialists (user_id, type, credentials, approval_status, rate_egp)
        VALUES (?, 'trainer', 'Specialist staff', 'approved', 400)
      `).run(newUserId)
    }

    return db.prepare('SELECT id, name, email, role, status, created_at FROM users WHERE id = ?').get(newUserId)
  })()

  res.status(201).json({
    data: {
      user: {
        id: result.id,
        name: result.name,
        email: result.email,
        role: result.role,
        status: result.status,
        createdAt: result.created_at,
      },
    },
  })
})

/**
 * GET /api/admin/specialists
 * Lists specialists, optionally filtered by approval status (?status=pending).
 */
router.get('/specialists', (req, res) => {
  const { status } = req.query

  let query = `
    SELECT 
      s.user_id AS id,
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
      s.approval_status,
      s.credential_doc,
      s.national_id,
      s.syndicate_id,
      s.documents,
      u.created_at AS applied_at
    FROM specialists s
    JOIN users u ON u.id = s.user_id
    WHERE s.organization_id IS NULL
  `
  const params = []

  if (status && status !== 'all') {
    query += ` AND s.approval_status = ?`
    params.push(status)
  }

  query += ` ORDER BY u.created_at DESC`

  const rows = db.prepare(query).all(...params)

  const specialists = rows.map((s) => ({
    id: s.id,
    name: s.name,
    initials: getInitials(s.name),
    email: s.email,
    type: s.type,
    svc: s.type === 'physical_therapist' ? 'recover' : s.type === 'nutritionist' ? 'eat' : 'move',
    role:
      s.type === 'physical_therapist'
        ? 'Physical therapist'
        : s.type === 'nutritionist'
          ? 'Dietitian'
          : 'Personal trainer',
    credentials: s.credentials,
    bio: s.bio,
    focusTags: s.focus_tags ? s.focus_tags.split(',').map((t) => t.trim()) : [],
    photoUrl: s.photo_url,
    city: s.city || 'Cairo',
    years: s.years_experience,
    languages: s.languages ? s.languages.split(',').map((l) => l.trim()) : [],
    rateEgp: s.rate_egp,
    sessionsCompleted: s.sessions_completed,
    approvalStatus: s.approval_status,
    applied: s.applied_at,
    nationalId: s.national_id,
    syndicateId: s.syndicate_id,
    docs: (() => {
      if (s.documents) {
        try {
          const parsed = JSON.parse(s.documents)
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((d) => [d.name, d.size || 'PDF, 1.2 MB'])
          }
        } catch {
          // ignore
        }
      }
      return s.credential_doc
        ? [[s.credential_doc, 'Application document']]
        : [
            ['Syndicate licence', 'PDF, 1.2 MB'],
            ['Degree certificate', 'PDF, 0.8 MB'],
            ['National ID', 'JPG, 0.4 MB'],
          ]
    })(),
  }))

  res.json({
    data: {
      specialists,
    },
  })
})

const updateApprovalSchema = z.object({
  status: z.enum(['approved', 'rejected'], {
    errorMap: () => ({ message: "status must be 'approved' or 'rejected'" }),
  }),
})

/**
 * PATCH /api/admin/specialists/:id/approval
 * Approves or rejects a specialist's license application.
 */
router.patch('/specialists/:id/approval', validate(updateApprovalSchema), (req, res) => {
  const specialistId = Number(req.params.id)
  const { status } = req.body

  const existing = db
    .prepare(`SELECT user_id, approval_status FROM specialists WHERE user_id = ?`)
    .get(specialistId)

  if (!existing) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Specialist not found.' },
    })
  }

  db.prepare(`UPDATE specialists SET approval_status = ? WHERE user_id = ?`).run(status, specialistId)

  const updated = db
    .prepare(
      `SELECT s.user_id AS id, u.name, u.email, s.type, s.approval_status
       FROM specialists s
       JOIN users u ON u.id = s.user_id
       WHERE s.user_id = ?`
    )
    .get(specialistId)

  res.json({
    data: {
      specialist: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        type: updated.type,
        approvalStatus: updated.approval_status,
      },
    },
  })
})

export default router

