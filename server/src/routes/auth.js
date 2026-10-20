// auth.js — Authentication routes: register, login, me.
//
// All endpoints adhere to the spec:
// - POST /api/auth/register (public)
// - POST /api/auth/login    (public)
// - GET  /api/auth/me       (authenticated, any role)

import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import db from '../db/connection.js'
import { validate } from '../middleware/validate.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// ── Validation schemas ───────────────────────────────────────────────────────

const documentSchema = z.object({
  name: z.string().trim().min(1),
  size: z.string().trim().optional(),
  type: z.string().trim().optional(),
  url: z.string().trim().optional(),
})

const packageSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  sessionsCount: z.number().int().min(1),
  priceEgp: z.number().int().nonnegative(),
})

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  email: z.string().trim().email('Valid email address required.'),
  password: z.string().min(8, 'Password must be at least 8 characters long.'),
  role: z.enum(['client', 'specialist']).optional().default('client'),
  // Specialist-specific fields
  type: z.enum(['trainer', 'nutritionist', 'physical_therapist']).optional(),
  credentials: z.string().trim().optional(),
  city: z.string().trim().optional(),
  bio: z.string().trim().optional(),
  rateEgp: z.number().int().nonnegative().optional(),
  yearsExperience: z.number().int().nonnegative().optional(),
  languages: z.string().trim().optional(),
  focusTags: z.union([z.string().trim(), z.array(z.string().trim())]).optional(),
  nationalId: z.string().trim().optional(),
  syndicateId: z.string().trim().optional(),
  credentialDoc: z.string().trim().optional(),
  documents: z.union([z.string().trim(), z.array(documentSchema)]).optional(),
  packages: z.array(packageSchema).optional(),
})

const loginSchema = z.object({
  email: z.string().trim().email('Valid email address required.'),
  password: z.string().min(1, 'Password is required.'),
})

// ── Helper to build clean user response ─────────────────────────────────────

function buildUserPayload(user) {
  const result = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.created_at,
    lastActiveAt: user.last_active_at,
  }

  if (user.role === 'client') {
    const profile = db.prepare('SELECT onboarding_completed FROM client_profiles WHERE user_id = ?').get(user.id)
    result.onboardingCompleted = profile ? Boolean(profile.onboarding_completed) : false
  } else if (user.role === 'specialist') {
    const specialist = db.prepare(
      `SELECT type, approval_status, photo_url, city, rate_egp, credentials, bio,
              focus_tags, years_experience, languages, national_id, syndicate_id, documents
       FROM specialists WHERE user_id = ?`
    ).get(user.id)
    if (specialist) {
      result.type = specialist.type
      result.approvalStatus = specialist.approval_status
      result.photoUrl = specialist.photo_url
      result.city = specialist.city
      result.rateEgp = specialist.rate_egp
      result.credentials = specialist.credentials
      result.bio = specialist.bio
      result.focusTags = specialist.focus_tags ? specialist.focus_tags.split(',').map((t) => t.trim()) : []
      result.yearsExperience = specialist.years_experience
      result.languages = specialist.languages
      result.nationalId = specialist.national_id
      result.syndicateId = specialist.syndicate_id
      try {
        result.documents = specialist.documents ? JSON.parse(specialist.documents) : []
      } catch {
        result.documents = []
      }
    }
  }

  return result
}

// Helper to sign 7-day JWT tokens
function signToken(userId, role) {
  return jwt.sign({ sub: userId, role }, process.env.JWT_SECRET, { expiresIn: '7d' })
}

// ── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Creates a new user. Role defaults to 'client'.
 * Specialists require type and credentials, and start with approval_status = 'pending'.
 */
router.post('/register', validate(registerSchema), (req, res) => {
  const {
    name,
    email,
    password,
    role,
    type,
    credentials,
    city,
    bio,
    rateEgp,
    yearsExperience,
    languages,
    focusTags,
    nationalId,
    syndicateId,
    credentialDoc,
    documents,
    packages,
  } = req.body

  // Check if email already in use (case-insensitive)
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

  // Validate specialist-specific requirements
  if (role === 'specialist') {
    const fields = {}
    if (!type) fields.type = 'Specialist type is required (trainer, nutritionist, physical_therapist).'
    if (!credentials) fields.credentials = 'Credentials or qualifications are required for specialist registration.'
    if (Object.keys(fields).length > 0) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Missing specialist fields.', fields },
      })
    }
  }

  // Hash password using bcrypt (cost 10 as specified in spec)
  const passwordHash = bcrypt.hashSync(password, 10)

  // Insert user and corresponding profile/specialist row in a single transaction
  const createUserTransaction = db.transaction(() => {
    const userResult = db
      .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(name, email, passwordHash, role)
    const userId = Number(userResult.lastInsertRowid)

    if (role === 'client') {
      db.prepare('INSERT INTO client_profiles (user_id) VALUES (?)').run(userId)
    } else if (role === 'specialist') {
      const normalizedFocusTags = Array.isArray(focusTags)
        ? focusTags.join(',')
        : (focusTags || null)
      const docsJson = documents
        ? (typeof documents === 'string' ? documents : JSON.stringify(documents))
        : null
      const primaryDoc = credentialDoc || (Array.isArray(documents) && documents[0]?.name ? documents[0].name : null)

      db.prepare(
        `INSERT INTO specialists (
          user_id, type, credentials, bio, focus_tags, city,
          years_experience, languages, rate_egp, approval_status,
          credential_doc, national_id, syndicate_id, documents
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`
      ).run(
        userId,
        type,
        credentials,
        bio || null,
        normalizedFocusTags,
        city || 'Cairo',
        yearsExperience || 0,
        languages || 'Arabic,English',
        rateEgp || 0,
        primaryDoc,
        nationalId || null,
        syndicateId || null,
        docsJson
      )

      if (Array.isArray(packages) && packages.length > 0) {
        const insertPkg = db.prepare(
          `INSERT INTO specialist_packages (specialist_id, name, description, sessions_count, price_egp)
           VALUES (?, ?, ?, ?, ?)`
        )
        for (const pkg of packages) {
          insertPkg.run(userId, pkg.name, pkg.description || null, pkg.sessionsCount, pkg.priceEgp)
        }
      }
    }

    return db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  })

  const newUser = createUserTransaction()
  const token = signToken(newUser.id, newUser.role)
  const userPayload = buildUserPayload(newUser)

  res.status(201).json({
    data: {
      token,
      user: userPayload,
    },
  })
})

/**
 * POST /api/auth/login
 * Validates email and password, updates last_active_at, returns JWT and user info.
 */
router.post('/login', validate(loginSchema), (req, res) => {
  const { email, password } = req.body

  const user = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email)

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
    })
  }

  if (user.status === 'suspended') {
    return res.status(403).json({
      error: { code: 'ACCOUNT_SUSPENDED', message: 'Your account has been suspended.' },
    })
  }

  // Update last_active_at
  db.prepare("UPDATE users SET last_active_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?").run(user.id)
  user.last_active_at = new Date().toISOString()

  const token = signToken(user.id, user.role)
  const userPayload = buildUserPayload(user)

  res.json({
    data: {
      token,
      user: userPayload,
    },
  })
})

/**
 * GET /api/auth/me
 * Returns the currently authenticated user with role-specific profile details.
 */
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, status, last_active_at, created_at FROM users WHERE id = ?').get(req.user.id)

  if (!user) {
    return res.status(404).json({
      error: { code: 'USER_NOT_FOUND', message: 'User not found.' },
    })
  }

  const userPayload = buildUserPayload(user)

  res.json({
    data: {
      user: userPayload,
    },
  })
})

export default router

