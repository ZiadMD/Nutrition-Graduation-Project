// requireRole.js — Role-based access control middleware factory.
//
// Returns a middleware that only lets the request through if the authenticated
// user has one of the allowed roles.  Always use AFTER requireAuth.
//
// Usage:
//   router.get('/dashboard', requireAuth, requireRole('specialist'), handler)
//   router.get('/admin',     requireAuth, requireRole('admin', 'specialist'), handler)

export function requireRole(...allowedRoles) {
  return function checkRole(req, res, next) {
    // requireAuth must have run first — if not, req.user won't exist.
    if (!req.user) {
      return res.status(401).json({
        error: { code: 'MISSING_TOKEN', message: 'Authentication required.' },
      })
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Access restricted to: ${allowedRoles.join(', ')}.`,
        },
      })
    }

    next()
  }
}

