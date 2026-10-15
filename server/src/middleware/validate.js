// validate.js — Zod request body validation middleware factory.
//
// Returns a middleware that runs a Zod schema against req.body.  On failure it
// responds immediately with a 400 and a map of field-level error messages so
// the front end can highlight exactly which fields are wrong.
//
// Usage:
//   import { z } from 'zod'
//   import { validate } from './middleware/validate.js'
//
//   const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) })
//   router.post('/login', validate(loginSchema), handler)

import { z } from 'zod'

export function validate(schema) {
  return function checkBody(req, res, next) {
    const result = schema.safeParse(req.body)

    if (!result.success) {
      // Zod gives us a flat list of issues.  We convert it to a plain object
      // keyed by field path so the client can map errors to form inputs.
      // e.g. { email: 'Invalid email', password: 'Required' }
      const fields = {}
      for (const issue of result.error.issues) {
        const path = issue.path.join('.') || '_root'
        fields[path] = issue.message
      }

      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request body.', fields },
      })
    }

    // Replace req.body with the parsed (and potentially transformed) value so
    // route handlers get clean, type-safe data.
    req.body = result.data
    next()
  }
}

// Re-export z so route files can import both from this one file if they prefer.
export { z }

