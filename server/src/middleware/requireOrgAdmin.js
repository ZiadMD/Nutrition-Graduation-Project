// requireOrgAdmin.js — Middleware to verify org_admin role and attach req.orgId
// Always use after requireAuth.

export function requireOrgAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: { code: 'MISSING_TOKEN', message: 'Authentication required.' },
    })
  }

  if (req.user.role !== 'org_admin') {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Access restricted to organization administrators.' },
    })
  }

  if (!req.user.organizationId) {
    return res.status(403).json({
      error: { code: 'NO_ORGANIZATION', message: 'Account is not associated with an organization.' },
    })
  }

  req.orgId = req.user.organizationId
  next()
}
