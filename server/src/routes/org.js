// org.js — Organization administrator routes.
//
// All routes require requireAuth + requireOrgAdmin.
// Every query is strictly scoped by req.orgId (from req.user.organizationId).
// Any ID in parameters or body not belonging to req.orgId returns 404.
// Org admins NEVER receive health-related content or clinical details.

import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import db from '../db/connection.js'
import { requireAuth } from '../middleware/auth.js'
import { requireOrgAdmin } from '../middleware/requireOrgAdmin.js'
import { validate } from '../middleware/validate.js'

const router = Router()

// All org routes require authentication and org_admin role scoped by req.orgId
router.use(requireAuth, requireOrgAdmin)

// ── Helpers ─────────────────────────────────────────────────────────────────

export function mapTypeToField(type) {
  if (type === 'trainer') return 'Move'
  if (type === 'nutritionist') return 'Eat'
  if (type === 'physical_therapist') return 'Recover'
  return type
}

const SLOT_TIMES = ['10:00', '12:30', '15:00', '17:30']

/**
 * Generate default availability slots for the next 14 weekdays for a newly
 * created org specialist, mirroring the seed logic so org members can book.
 */
function generateDefaultSlotsForSpecialist(specialistId) {
  const insertSlotStmt = db.prepare(`
    INSERT OR IGNORE INTO availability_slots (specialist_id, starts_at, ends_at, is_booked)
    VALUES (?, ?, ?, 0)
  `)

  for (let offset = 0; offset < 14; offset++) {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    const dow = d.getDay() // 0=Sun, 5=Fri, 6=Sat

    // Friday is day off in Egypt — skip it
    if (dow === 5) continue

    const count = (specialistId + offset) % 3 === 0 ? 3 : 4
    for (let i = 0; i < count; i++) {
      const [h, m] = SLOT_TIMES[i].split(':').map(Number)
      const start = new Date(d)
      start.setHours(h, m, 0, 0)
      const end = new Date(start)
      end.setMinutes(end.getMinutes() + 30)

      const startIso = start.toISOString().replace(/\.\d{3}Z$/, 'Z')
      const endIso = end.toISOString().replace(/\.\d{3}Z$/, 'Z')
      insertSlotStmt.run(specialistId, startIso, endIso)
    }
  }
}

// ── Validation Schemas ──────────────────────────────────────────────────────

const createSpecialistSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  email: z.string().trim().email('Valid email address required.'),
  password: z.string().min(8, 'Password must be at least 8 characters long.'),
  type: z.enum(['trainer', 'nutritionist', 'physical_therapist']),
  bio: z.string().trim().optional(),
  credentials: z.string().trim().optional(),
})

const createAssignmentSchema = z.object({
  memberId: z.coerce.number().int().positive('memberId must be a positive integer.'),
  specialistId: z.coerce.number().int().positive('specialistId must be a positive integer.'),
})

// ── Endpoints ───────────────────────────────────────────────────────────────

/**
 * GET /api/org/info
 * Returns organization details, seat usage, and remaining seats.
 */
router.get('/info', (req, res) => {
  const org = db
    .prepare('SELECT id, name, type, logo_url, invite_code, seat_limit FROM organizations WHERE id = ?')
    .get(req.orgId)

  if (!org) {
    return res.status(404).json({
      error: { code: 'ORGANIZATION_NOT_FOUND', message: 'Organization not found.' },
    })
  }

  const seatsUsedRow = db
    .prepare("SELECT COUNT(*) AS count FROM users WHERE organization_id = ? AND role = 'client'")
    .get(req.orgId)
  const seatsUsed = seatsUsedRow?.count ?? 0
  const seatsRemaining = Math.max(0, org.seat_limit - seatsUsed)

  const orgPayload = {
    id: org.id,
    name: org.name,
    type: org.type,
    logoUrl: org.logo_url || null,
    inviteCode: org.invite_code,
    seatLimit: org.seat_limit,
    seatsUsed,
    seatsRemaining,
  }

  res.json({
    data: {
      ...orgPayload,
      organization: orgPayload,
    },
  })
})

/**
 * GET /api/org/members
 * Returns members of this organization (role 'client') and their active care team.
 * Never exposes health, clinical, plan, or progress data.
 */
router.get('/members', (req, res) => {
  const q = req.query.q?.trim().toLowerCase() || ''

  let sql = `
    SELECT id, name, email, status, created_at AS joinedAt, last_active_at AS lastActiveAt
    FROM users
    WHERE organization_id = ? AND role = 'client'
  `
  const params = [req.orgId]

  if (q) {
    sql += ` AND (LOWER(name) LIKE ? OR LOWER(email) LIKE ?)`
    params.push(`%${q}%`, `%${q}%`)
  }

  sql += ` ORDER BY name ASC`
  const memberRows = db.prepare(sql).all(...params)

  // Fetch active assigned specialists for all members in one lookup or per member
  const getSpecialistsStmt = db.prepare(`
    SELECT 
      s.user_id AS specialistId,
      u.name,
      s.type
    FROM care_team ct
    JOIN specialists s ON s.user_id = ct.specialist_id
    JOIN users u ON u.id = s.user_id
    WHERE ct.client_id = ? AND ct.status = 'active'
    ORDER BY ct.created_at ASC
  `)

  const members = memberRows.map((m) => {
    const spRows = getSpecialistsStmt.all(m.id)
    const assignedSpecialists = spRows.map((sp) => ({
      specialistId: sp.specialistId,
      name: sp.name,
      type: sp.type,
      field: mapTypeToField(sp.type),
    }))

    return {
      id: m.id,
      name: m.name,
      email: m.email,
      status: m.status,
      joinedAt: m.joinedAt,
      lastActiveAt: m.lastActiveAt || null,
      assignedSpecialists,
    }
  })

  res.json({
    data: {
      members,
    },
  })
})

/**
 * GET /api/org/specialists
 * Returns specialists belonging to this organization with active client counts.
 */
router.get('/specialists', (req, res) => {
  const rows = db.prepare(`
    SELECT 
      s.user_id AS specialistId,
      u.name,
      u.email,
      s.type,
      s.bio,
      s.credentials
    FROM specialists s
    JOIN users u ON u.id = s.user_id
    WHERE s.organization_id = ?
    ORDER BY u.name ASC
  `).all(req.orgId)

  const countStmt = db.prepare(`
    SELECT COUNT(*) AS count
    FROM care_team ct
    JOIN users u ON u.id = ct.client_id
    WHERE ct.specialist_id = ? AND ct.status = 'active' AND u.organization_id = ?
  `)

  const specialists = rows.map((s) => {
    const countRow = countStmt.get(s.specialistId, req.orgId)
    return {
      specialistId: s.specialistId,
      name: s.name,
      email: s.email,
      type: s.type,
      field: mapTypeToField(s.type),
      bio: s.bio || null,
      credentials: s.credentials || null,
      activeClientCount: countRow?.count ?? 0,
    }
  })

  res.json({
    data: {
      specialists,
    },
  })
})

/**
 * POST /api/org/specialists
 * Creates an organization-specific specialist. Auto-approves and generates bookable weekday slots.
 */
router.post('/specialists', validate(createSpecialistSchema), (req, res) => {
  const { name, email, password, type, bio, credentials } = req.body

  const existing = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email)
  if (existing) {
    return res.status(409).json({
      error: {
        code: 'EMAIL_IN_USE',
        message: 'An account with this email already exists.',
        fields: { email: 'Already in use' },
      },
    })
  }

  const passwordHash = bcrypt.hashSync(password, 10)

  const createSpecialistTx = db.transaction(() => {
    const userResult = db
      .prepare('INSERT INTO users (name, email, password_hash, role, organization_id) VALUES (?, ?, ?, ?, ?)')
      .run(name, email, passwordHash, 'specialist', req.orgId)
    const userId = Number(userResult.lastInsertRowid)

    db.prepare(`
      INSERT INTO specialists (
        user_id, organization_id, type, credentials, bio,
        approval_status, rate_egp, city, years_experience, languages
      ) VALUES (?, ?, ?, ?, ?, 'approved', 0, 'Cairo', 3, 'Arabic,English')
    `).run(
      userId,
      req.orgId,
      type,
      credentials || 'Certified Specialist',
      bio || null
    )

    // Generate bookable weekday slots for the next 14 days
    generateDefaultSlotsForSpecialist(userId)

    return userId
  })

  const newSpecialistId = createSpecialistTx()

  res.status(201).json({
    data: {
      specialist: {
        specialistId: newSpecialistId,
        name,
        email,
        type,
        field: mapTypeToField(type),
        bio: bio || null,
        credentials: credentials || 'Certified Specialist',
        approvalStatus: 'approved',
        activeClientCount: 0,
      },
    },
  })
})

/**
 * POST /api/org/assignments
 * Links an org member to an org specialist.
 * Idempotent for active assignments; reactivates ended assignments.
 * Enforces one active specialist per clinical field.
 */
router.post('/assignments', validate(createAssignmentSchema), (req, res) => {
  const { memberId, specialistId } = req.body

  // 1. Verify member belongs to req.orgId
  const member = db
    .prepare('SELECT id, name, organization_id, role FROM users WHERE id = ?')
    .get(memberId)

  if (!member || member.role !== 'client' || member.organization_id !== req.orgId) {
    return res.status(404).json({
      error: { code: 'MEMBER_NOT_FOUND', message: 'Member not found in your organization.' },
    })
  }

  // 2. Verify specialist belongs to req.orgId
  const specialist = db
    .prepare(`
      SELECT s.user_id, s.organization_id, s.type, u.name
      FROM specialists s
      JOIN users u ON u.id = s.user_id
      WHERE s.user_id = ?
    `)
    .get(specialistId)

  if (!specialist || specialist.organization_id !== req.orgId) {
    return res.status(404).json({
      error: { code: 'SPECIALIST_NOT_FOUND', message: 'Specialist not found in your organization.' },
    })
  }

  const targetField = mapTypeToField(specialist.type)

  // 3. Check existing care_team row for this member and specialist
  const existingPair = db
    .prepare('SELECT client_id, specialist_id, status FROM care_team WHERE client_id = ? AND specialist_id = ?')
    .get(memberId, specialistId)

  // If already active, return idempotently
  if (existingPair && existingPair.status === 'active') {
    return res.json({
      data: {
        assignment: {
          memberId,
          specialistId,
          status: 'active',
          field: targetField,
          specialistType: specialist.type,
          specialistName: specialist.name,
        },
      },
    })
  }

  // 4. Check if member already has an ACTIVE specialist in the same field
  const activeAssignments = db
    .prepare(`
      SELECT ct.specialist_id, s.type, u.name
      FROM care_team ct
      JOIN specialists s ON s.user_id = ct.specialist_id
      JOIN users u ON u.id = s.user_id
      WHERE ct.client_id = ? AND ct.status = 'active'
    `)
    .all(memberId)

  const conflictingAssignment = activeAssignments.find((a) => mapTypeToField(a.type) === targetField)
  if (conflictingAssignment) {
    return res.status(409).json({
      error: {
        code: 'FIELD_ALREADY_ASSIGNED',
        message: `Member already has an active ${targetField} specialist (${conflictingAssignment.name}). You must end that assignment before assigning a new specialist for this field.`,
        field: targetField,
        currentSpecialistId: conflictingAssignment.specialist_id,
      },
    })
  }

  // 5. Insert or reactivate assignment
  const assignTx = db.transaction(() => {
    if (existingPair) {
      db.prepare("UPDATE care_team SET status = 'active', ended_at = NULL WHERE client_id = ? AND specialist_id = ?").run(
        memberId,
        specialistId
      )
    } else {
      db.prepare("INSERT INTO care_team (client_id, specialist_id, status, created_at) VALUES (?, ?, 'active', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))").run(
        memberId,
        specialistId
      )
    }
  })

  assignTx()

  res.status(201).json({
    data: {
      assignment: {
        memberId,
        specialistId,
        status: 'active',
        field: targetField,
        specialistType: specialist.type,
        specialistName: specialist.name,
      },
    },
  })
})

/**
 * PATCH /api/org/assignments/:clientId/:specialistId/end
 * Ends an active assignment.
 */
router.patch('/assignments/:clientId/:specialistId/end', (req, res) => {
  const clientId = Number(req.params.clientId)
  const specialistId = Number(req.params.specialistId)

  if (!clientId || !specialistId) {
    return res.status(400).json({
      error: { code: 'INVALID_PARAMS', message: 'Valid clientId and specialistId required.' },
    })
  }

  // Verify member belongs to req.orgId
  const member = db
    .prepare('SELECT id, organization_id, role FROM users WHERE id = ?')
    .get(clientId)

  if (!member || member.role !== 'client' || member.organization_id !== req.orgId) {
    return res.status(404).json({
      error: { code: 'MEMBER_NOT_FOUND', message: 'Member not found in your organization.' },
    })
  }

  // Verify specialist belongs to req.orgId
  const specialist = db
    .prepare('SELECT user_id, organization_id FROM specialists WHERE user_id = ?')
    .get(specialistId)

  if (!specialist || specialist.organization_id !== req.orgId) {
    return res.status(404).json({
      error: { code: 'SPECIALIST_NOT_FOUND', message: 'Specialist not found in your organization.' },
    })
  }

  // Verify care_team record exists
  const care = db
    .prepare('SELECT client_id, specialist_id, status FROM care_team WHERE client_id = ? AND specialist_id = ?')
    .get(clientId, specialistId)

  if (!care) {
    return res.status(404).json({
      error: { code: 'ASSIGNMENT_NOT_FOUND', message: 'Assignment record not found.' },
    })
  }

  const endedAt = new Date().toISOString()
  db.prepare("UPDATE care_team SET status = 'ended', ended_at = ? WHERE client_id = ? AND specialist_id = ?").run(
    endedAt,
    clientId,
    specialistId
  )

  res.json({
    data: {
      assignment: {
        memberId: clientId,
        specialistId,
        status: 'ended',
        endedAt,
      },
    },
  })
})

/**
 * GET /api/org/stats
 * Aggregate counts only. No clinical details, no names, no member IDs.
 */
router.get('/stats', (req, res) => {
  const org = db.prepare('SELECT seat_limit FROM organizations WHERE id = ?').get(req.orgId)
  if (!org) {
    return res.status(404).json({
      error: { code: 'ORGANIZATION_NOT_FOUND', message: 'Organization not found.' },
    })
  }

  const seatLimit = org.seat_limit

  // Total members / seats used (only role 'client' uses seats)
  const totalMembersRow = db
    .prepare("SELECT COUNT(*) AS count FROM users WHERE organization_id = ? AND role = 'client'")
    .get(req.orgId)
  const totalMembers = totalMembersRow?.count ?? 0
  const seatsUsed = totalMembers
  const seatsRemaining = Math.max(0, seatLimit - seatsUsed)

  // Members with at least one active assignment
  const assignedRow = db
    .prepare(`
      SELECT COUNT(DISTINCT ct.client_id) AS count
      FROM care_team ct
      JOIN users u ON u.id = ct.client_id
      WHERE u.organization_id = ? AND u.role = 'client' AND ct.status = 'active'
    `)
    .get(req.orgId)
  const membersWithAssignment = assignedRow?.count ?? 0
  const membersWithoutAssignment = Math.max(0, totalMembers - membersWithAssignment)

  // Active members in the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const activeMembersRow = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM users
      WHERE organization_id = ? AND role = 'client' AND last_active_at IS NOT NULL AND last_active_at >= ?
    `)
    .get(req.orgId, sevenDaysAgo)
  const activeMembersLast7Days = activeMembersRow?.count ?? 0

  // Plans updated or created in the last 7 days for members of this org
  const plansRow = db
    .prepare(`
      SELECT COUNT(p.id) AS count
      FROM plans p
      JOIN users u ON u.id = p.client_id
      WHERE u.organization_id = ? AND (
        (p.updated_at IS NOT NULL AND p.updated_at >= ?) OR
        (p.created_at IS NOT NULL AND p.created_at >= ?)
      )
    `)
    .get(req.orgId, sevenDaysAgo, sevenDaysAgo)
  const plansUpdatedLast7Days = plansRow?.count ?? 0

  // Active assignments by field
  const fieldCounts = db
    .prepare(`
      SELECT s.type, COUNT(*) AS count
      FROM care_team ct
      JOIN users u ON u.id = ct.client_id
      JOIN specialists s ON s.user_id = ct.specialist_id
      WHERE u.organization_id = ? AND ct.status = 'active'
      GROUP BY s.type
    `)
    .all(req.orgId)

  const assignmentsByField = {
    move: 0,
    eat: 0,
    recover: 0,
  }

  for (const row of fieldCounts) {
    if (row.type === 'trainer') assignmentsByField.move = row.count
    else if (row.type === 'nutritionist') assignmentsByField.eat = row.count
    else if (row.type === 'physical_therapist') assignmentsByField.recover = row.count
  }

  const stats = {
    totalMembers,
    seatsUsed,
    seatLimit,
    seatsRemaining,
    membersWithAssignment,
    membersWithoutAssignment,
    activeMembersLast7Days,
    plansUpdatedLast7Days,
    assignmentsByField,
  }

  res.json({
    data: {
      ...stats,
      stats,
    },
  })
})

export default router
