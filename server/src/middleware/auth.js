// auth.js — JWT verification middleware.
//
// Reads the Authorization header, verifies the token, and attaches the
// decoded payload to req.user so route handlers know who is calling.
// Also updates last_active_at on the user row as noted in the schema.
//
// Usage:
//   import { requireAuth } from './middleware/auth.js'
//   router.get('/me', requireAuth, handler)

import jwt from 'jsonwebtoken'
import db from '../db/connection.js'

export function requireAuth(req, res, next) {
  // The header should look like: Authorization: Bearer <token>
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    return res.status(401).json({
      error: { code: 'MISSING_TOKEN', message: 'Authentication token required.' },
    })
  }

  try {
    // jwt.verify throws if the token is expired, tampered with, or signed with
    // a different secret. The decoded payload contains { sub: userId, role }.
    const payload = jwt.verify(token, process.env.JWT_SECRET)

    // Check if the user exists and is not suspended
    const user = db.prepare('SELECT id, name, email, role, status, organization_id FROM users WHERE id = ?').get(payload.sub)
    if (!user) {
      return res.status(401).json({
        error: { code: 'USER_NOT_FOUND', message: 'User no longer exists.' },
      })
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        error: { code: 'ACCOUNT_SUSPENDED', message: 'Your account has been suspended.' },
      })
    }

    // Attach a clean user object so downstream handlers don't need to know the
    // JWT internals. sub is the standard JWT "subject" claim (the user's id).
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organization_id || null,
    }

    // Update last_active_at timestamp (best effort)
    try {
      db.prepare("UPDATE users SET last_active_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?").run(user.id)
    } catch {
      // Ignore background update errors
    }

    next()
  } catch {
    return res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: 'Token is invalid or expired.' },
    })
  }
}

export function optionalAuth(req, res, next) {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    req.user = null
    return next()
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = db.prepare('SELECT id, name, email, role, status, organization_id FROM users WHERE id = ?').get(payload.sub)
    if (user && user.status !== 'suspended') {
      req.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id || null,
      }
    } else {
      req.user = null
    }
  } catch {
    req.user = null
  }
  next()
}

export { requireOrgAdmin } from './requireOrgAdmin.js'

