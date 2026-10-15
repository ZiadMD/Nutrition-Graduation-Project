// app.js — Express application setup.
// We keep this separate from index.js so tests can import the app
// without actually starting a server on a port.

import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../.env') })
import express from 'express'
import cors from 'cors'
import { errorHandler } from './middleware/errorHandler.js'

const app = express()

// Allow requests from the Vite dev server (and future production origin).
// The CLIENT_ORIGIN env var is set in .env; CORS will block any other origin.
app.use(cors({ origin: process.env.CLIENT_ORIGIN }))

// Parse incoming JSON bodies so route handlers can read req.body.
app.use(express.json())

// ── Health check ────────────────────────────────────────────────────────────
// The front end (and any CI check) can hit GET /api/health to confirm the
// server is alive without needing auth or a database query.
app.get('/api/health', (_req, res) => {
  res.json({ data: { status: 'ok' } })
})

// ── Route mounting ──────────────────────────────────────────────────────────
import authRoutes from './routes/auth.js'
import profileRoutes from './routes/profile.js'
import specialistPortalRoutes from './routes/specialistPortal.js'
import specialistsRoutes from './routes/specialists.js'
import bookingsRoutes from './routes/bookings.js'
import dashboardRoutes from './routes/dashboard.js'
import plansRoutes from './routes/plans.js'
import completionsRoutes from './routes/completions.js'
import progressRoutes from './routes/progress.js'
import aiRoutes from './routes/ai.js'
import checkoutRoutes from './routes/checkout.js'
import adminRoutes from './routes/admin.js'
import financeRoutes from './routes/finance.js'

app.use('/api/auth', authRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/specialist', specialistPortalRoutes)
app.use('/api/specialists', specialistsRoutes)
app.use('/api/bookings', bookingsRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/plans', plansRoutes)
app.use('/api/completions', completionsRoutes)
app.use('/api/progress', progressRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/checkout', checkoutRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/finance', financeRoutes)

// ── 404 catch-all ───────────────────────────────────────────────────────────
// Any request that reaches here didn't match a real route.
app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } })
})

// ── Global error handler ────────────────────────────────────────────────────
// Must be registered AFTER all routes. Express recognises error-handling
// middleware by its 4-argument signature: (err, req, res, next).
app.use(errorHandler)

export default app

