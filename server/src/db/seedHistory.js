// server/src/db/seedHistory.js
// Opt-in deterministic history seed for analytical dashboards (Power BI style).
// Populates 90 days of rich timeseries data on top of the base seed.

import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { CAIRO_OFFSET_HOURS } from '../analytics/range.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const defaultDbPath = join(__dirname, '../../data/rebound.db')
const dbPath = process.env.DB_PATH || defaultDbPath

const db = new Database(dbPath)
db.pragma('foreign_keys = ON')
db.pragma('journal_mode = WAL')

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32) for perfectly deterministic, repeatable data
// ---------------------------------------------------------------------------
function createRng(seed = 42) {
  let s = seed
  return function () {
    let t = (s += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rng = createRng(42)

function randomInt(min, max) {
  return Math.floor(rng() * (max - min + 1)) + min
}

function randomChoice(arr) {
  return arr[Math.floor(rng() * arr.length)]
}

// Fixed bcrypt hash for 'demo1234'
const DEMO_PW = bcrypt.hashSync('demo1234', 10)

// Reference today
const NOW = new Date()

function relativeDateStr(daysAgo) {
  const d = new Date(NOW.getTime() - daysAgo * 86400 * 1000)
  return d.toISOString().slice(0, 10)
}

function relativeIso(daysAgo, hour = 12, minute = 0) {
  const d = new Date(NOW.getTime() - daysAgo * 86400 * 1000)
  d.setUTCHours(hour, minute, 0, 0)
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

// ---------------------------------------------------------------------------
// Main Seed Function
// ---------------------------------------------------------------------------
export function seedHistory(customDb = null) {
  const targetDb = customDb || db

  console.log('Seeding 90-day history on top of base database...')

  const runTx = targetDb.transaction(() => {
    // 1. Backdate existing Apex members (ID 21..40)
    console.log('  Backdating Apex Athletic Club members...')
    const apexMembers = targetDb
      .prepare(
        `SELECT id FROM users WHERE organization_id = 1 AND role = 'client' ORDER BY id ASC`
      )
      .all()

    apexMembers.forEach((m, idx) => {
      // Stagger joins across the last 85 days
      const daysAgo = Math.max(2, Math.floor(85 - idx * 4))
      const joinIso = relativeIso(daysAgo, 10 + (idx % 8))
      targetDb
        .prepare(`UPDATE users SET created_at = ? WHERE id = ?`)
        .run(joinIso, m.id)

      targetDb
        .prepare(
          `UPDATE client_profiles SET plan_start_date = ? WHERE user_id = ?`
        )
        .run(relativeDateStr(daysAgo), m.id)
    })

    // 2. Add Organization 2: Cairo University Sports (35 members, 60 seats)
    console.log('  Creating Cairo University Sports Team (B2B)...')
    const cuOrg = targetDb
      .prepare(
        `INSERT INTO organizations (name, type, invite_code, seat_limit, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        'Cairo University Sports Team',
        'university',
        'CUSP2026',
        60,
        relativeIso(80, 9, 0)
      )
    const cuOrgId = cuOrg.lastInsertRowid

    // CU Admin
    targetDb
      .prepare(
        `INSERT INTO users (name, email, password_hash, role, organization_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'Coach Nabil (Admin)',
        'admin@cu.edu.eg',
        DEMO_PW,
        'org_admin',
        cuOrgId,
        'active',
        relativeIso(80, 9, 30)
      )

    // CU Specialists
    const cuSpecs = [
      {
        name: 'Dr. Amr Ezzat',
        email: 'dr.amr@cu.edu.eg',
        type: 'trainer',
        bio: 'Varsity strength and sprint conditioning coach.',
      },
      {
        name: 'Dr. Dina Fawzy',
        email: 'dr.dina@cu.edu.eg',
        type: 'nutritionist',
        bio: 'Athletic endurance and macro performance dietitian.',
      },
      {
        name: 'Dr. Hassan Kamal',
        email: 'dr.hassan@cu.edu.eg',
        type: 'physical_therapist',
        bio: 'Spine and lower-limb sports physical therapist.',
      },
    ]

    const cuSpecialistIds = []
    cuSpecs.forEach((sp, idx) => {
      const u = targetDb
        .prepare(
          `INSERT INTO users (name, email, password_hash, role, organization_id, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          sp.name,
          sp.email,
          DEMO_PW,
          'specialist',
          cuOrgId,
          'active',
          relativeIso(78 - idx, 10, 0)
        )
      const uId = u.lastInsertRowid
      cuSpecialistIds.push({ id: uId, type: sp.type })

      targetDb
        .prepare(
          `INSERT INTO specialists (user_id, organization_id, type, credentials, bio, rate_egp, approval_status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          uId,
          cuOrgId,
          sp.type,
          'Cairo Univ Faculty of Physical Therapy / Sports Medicine',
          sp.bio,
          0,
          'approved'
        )
    })

    // 35 CU Members
    const cuMemberIds = []
    for (let i = 1; i <= 35; i++) {
      const daysAgo = Math.max(1, Math.floor(75 - i * 2))
      const u = targetDb
        .prepare(
          `INSERT INTO users (name, email, password_hash, role, organization_id, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          `CU Athlete ${i}`,
          `cu.member${i}@cu.edu.eg`,
          DEMO_PW,
          'client',
          cuOrgId,
          'active',
          relativeIso(daysAgo, 11, i % 60)
        )
      const memberId = u.lastInsertRowid
      cuMemberIds.push(memberId)

      // Profile
      targetDb
        .prepare(
          `INSERT INTO client_profiles (user_id, goal, days_per_week, plan_start_date, onboarding_completed)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(
          memberId,
          i % 2 === 0 ? 'build_muscle' : 'stay_healthy',
          4,
          relativeDateStr(daysAgo),
          1
        )

      // Sponsored subscription
      targetDb
        .prepare(
          `INSERT INTO subscriptions (client_id, plan_name, price_egp, method, status, source, reference, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          memberId,
          'Sponsored',
          0,
          'card',
          'active',
          'organization',
          `ORG-CU-${i}`,
          relativeIso(daysAgo, 11, i)
        )

      // Assign to CU specialists (Move & Recover)
      const trainer = cuSpecialistIds.find((s) => s.type === 'trainer')
      if (trainer) {
        targetDb
          .prepare(
            `INSERT INTO care_team (client_id, specialist_id, status, created_at)
             VALUES (?, ?, 'active', ?)`
          )
          .run(memberId, trainer.id, relativeIso(daysAgo, 12, 0))
      }
      if (i % 3 === 0) {
        const pt = cuSpecialistIds.find((s) => s.type === 'physical_therapist')
        if (pt) {
          targetDb
            .prepare(
              `INSERT INTO care_team (client_id, specialist_id, status, created_at)
               VALUES (?, ?, 'active', ?)`
            )
            .run(memberId, pt.id, relativeIso(daysAgo, 12, 10))
        }
      }
    }

    // 3. Add Organization 3: Delta Tech Solutions (8 members, 40 seats)
    console.log('  Creating Delta Tech Solutions (B2B)...')
    const deltaOrg = targetDb
      .prepare(
        `INSERT INTO organizations (name, type, invite_code, seat_limit, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        'Delta Tech Solutions',
        'company',
        'DELT2026',
        40,
        relativeIso(60, 10, 0)
      )
    const deltaOrgId = deltaOrg.lastInsertRowid

    // Delta Admin
    targetDb
      .prepare(
        `INSERT INTO users (name, email, password_hash, role, organization_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'Eng. Sherif (Admin)',
        'admin@delta.com',
        DEMO_PW,
        'org_admin',
        deltaOrgId,
        'active',
        relativeIso(60, 10, 30)
      )

    // Delta Specialist
    const deltaCoach = targetDb
      .prepare(
        `INSERT INTO users (name, email, password_hash, role, organization_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'Coach Ziad',
        'coach.ziad@delta.com',
        DEMO_PW,
        'specialist',
        deltaOrgId,
        'active',
        relativeIso(58, 10, 0)
      )
    const deltaCoachId = deltaCoach.lastInsertRowid
    targetDb
      .prepare(
        `INSERT INTO specialists (user_id, organization_id, type, credentials, bio, rate_egp, approval_status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        deltaCoachId,
        deltaOrgId,
        'trainer',
        'Ergonomics & Desk Worker Posture Coach',
        'Desk posture and corporate metabolic health.',
        0,
        'approved'
      )

    // 8 Delta Members
    const deltaMemberIds = []
    for (let i = 1; i <= 8; i++) {
      const daysAgo = Math.max(3, Math.floor(55 - i * 6))
      const u = targetDb
        .prepare(
          `INSERT INTO users (name, email, password_hash, role, organization_id, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          `Delta Staff ${i}`,
          `delta.member${i}@delta.com`,
          DEMO_PW,
          'client',
          deltaOrgId,
          'active',
          relativeIso(daysAgo, 9, i)
        )
      const memberId = u.lastInsertRowid
      deltaMemberIds.push(memberId)

      targetDb
        .prepare(
          `INSERT INTO client_profiles (user_id, goal, days_per_week, plan_start_date, onboarding_completed)
           VALUES (?, 'stay_healthy', 3, ?, 1)`
        )
        .run(memberId, relativeDateStr(daysAgo))

      targetDb
        .prepare(
          `INSERT INTO subscriptions (client_id, plan_name, price_egp, method, status, source, reference, created_at)
           VALUES (?, 'Sponsored', 0, 'card', 'active', 'organization', ?, ?)`
        )
        .run(memberId, `ORG-DELT-${i}`, relativeIso(daysAgo, 9, i))

      targetDb
        .prepare(
          `INSERT INTO care_team (client_id, specialist_id, status, created_at)
           VALUES (?, ?, 'active', ?)`
        )
        .run(memberId, deltaCoachId, relativeIso(daysAgo, 10, 0))
    }

    // 4. Add Organization 4: Giza CrossFit (TINY COHORT: 4 members, for suppression testing)
    console.log('  Creating Giza CrossFit Studio (Tiny Cohort: 4 members)...')
    const gizaOrg = targetDb
      .prepare(
        `INSERT INTO organizations (name, type, invite_code, seat_limit, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run('Giza CrossFit Studio', 'gym', 'GIZA2026', 15, relativeIso(25, 14, 0))
    const gizaOrgId = gizaOrg.lastInsertRowid

    // Giza Admin
    targetDb
      .prepare(
        `INSERT INTO users (name, email, password_hash, role, organization_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'Captain Khaled (Admin)',
        'admin@giza.com',
        DEMO_PW,
        'org_admin',
        gizaOrgId,
        'active',
        relativeIso(25, 14, 30)
      )

    // 4 Giza Members
    const gizaMemberIds = []
    for (let i = 1; i <= 4; i++) {
      const daysAgo = Math.max(1, 20 - i * 4)
      const u = targetDb
        .prepare(
          `INSERT INTO users (name, email, password_hash, role, organization_id, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          `Giza Athlete ${i}`,
          `giza.member${i}@giza.com`,
          DEMO_PW,
          'client',
          gizaOrgId,
          'active',
          relativeIso(daysAgo, 12, i)
        )
      const memberId = u.lastInsertRowid
      gizaMemberIds.push(memberId)

      targetDb
        .prepare(
          `INSERT INTO client_profiles (user_id, goal, days_per_week, plan_start_date, onboarding_completed)
           VALUES (?, 'lose_fat', 4, ?, 1)`
        )
        .run(memberId, relativeDateStr(daysAgo))

      targetDb
        .prepare(
          `INSERT INTO subscriptions (client_id, plan_name, price_egp, method, status, source, reference, created_at)
           VALUES (?, 'Sponsored', 0, 'card', 'active', 'organization', ?, ?)`
        )
        .run(memberId, `ORG-GIZA-${i}`, relativeIso(daysAgo, 12, i))
    }

    // 5. Add 40 B2C Individual Members
    console.log('  Creating 40 B2C Individual members and subscriptions...')
    const b2cMemberIds = []
    const plansInfo = [
      { name: 'Starter', price: 399 },
      { name: 'Plus', price: 899 },
      { name: 'Full Team', price: 1499 },
    ]
    const methods = ['card', 'instapay', 'vodafone_cash', 'fawry']
    const goals = ['lose_fat', 'build_muscle', 'recover_injury', 'stay_healthy']

    // Platform specialists for B2C care team links
    const platformSpecs = targetDb
      .prepare(
        `SELECT user_id, type FROM specialists WHERE organization_id IS NULL AND approval_status = 'approved'`
      )
      .all()

    for (let i = 1; i <= 40; i++) {
      const daysAgo = Math.max(1, Math.floor(88 - i * 2.1))
      const u = targetDb
        .prepare(
          `INSERT INTO users (name, email, password_hash, role, organization_id, status, created_at)
           VALUES (?, ?, ?, ?, NULL, 'active', ?)`
        )
        .run(
          `B2C Client ${i}`,
          `b2c.user${i}@demo.com`,
          DEMO_PW,
          'client',
          relativeIso(daysAgo, 10 + (i % 10), i % 60)
        )
      const memberId = u.lastInsertRowid
      b2cMemberIds.push(memberId)

      const onboarded = i <= 34 ? 1 : 0
      targetDb
        .prepare(
          `INSERT INTO client_profiles (user_id, goal, days_per_week, age, weight_kg, plan_start_date, onboarding_completed)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          memberId,
          randomChoice(goals),
          randomInt(3, 5),
          randomInt(22, 55),
          randomInt(60, 95),
          relativeDateStr(daysAgo),
          onboarded
        )

      // Self-paid subscription for onboarded members
      if (onboarded === 1) {
        const plan = randomChoice(plansInfo)
        const method = randomChoice(methods)
        targetDb
          .prepare(
            `INSERT INTO subscriptions (client_id, plan_name, price_egp, method, status, source, reference, created_at)
             VALUES (?, ?, ?, ?, 'active', 'self', ?, ?)`
          )
          .run(
            memberId,
            plan.name,
            plan.price,
            method,
            `SUB-B2C-${i}-${daysAgo}`,
            relativeIso(daysAgo, 11, 0)
          )

        // Assign to a platform specialist
        const sp = platformSpecs[i % platformSpecs.length]
        if (sp) {
          targetDb
            .prepare(
              `INSERT INTO care_team (client_id, specialist_id, status, created_at)
               VALUES (?, ?, 'active', ?)`
            )
            .run(memberId, sp.user_id, relativeIso(daysAgo, 12, 0))
        }
      }
    }

    // 6. Member Behavior Personas: Plans, Completions, and Progress Logs
    console.log('  Generating behavioral personas, plan items, and check-ins...')
    const allCohortClients = [
      ...apexMembers.map((m) => m.id),
      ...cuMemberIds,
      ...deltaMemberIds,
      ...gizaMemberIds,
      ...b2cMemberIds.slice(0, 34), // only onboarded
    ]

    // Create active plans for clients who don't have one
    const insertPlan = targetDb.prepare(`
      INSERT INTO plans (client_id, service, author_id, source, status, title, summary, created_at, updated_at)
      VALUES (?, ?, NULL, 'specialist', 'active', ?, ?, ?, ?)
    `)

    const insertItem = targetDb.prepare(`
      INSERT INTO plan_items (plan_id, day_of_week, position, title, meal_type, pt_cleared)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const insertCompletion = targetDb.prepare(`
      INSERT OR IGNORE INTO item_completions (client_id, plan_item_id, date, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `)

    const insertProgress = targetDb.prepare(`
      INSERT OR IGNORE INTO progress_logs (client_id, date, weight_kg, workout_done, pain_level)
      VALUES (?, ?, ?, ?, ?)
    `)

    // Pre-create plans for cohort clients
    const existingPlanClients = new Set(
      targetDb
        .prepare(`SELECT client_id FROM plans WHERE status = 'active'`)
        .all()
        .map((p) => p.client_id)
    )

    allCohortClients.forEach((clientId, idx) => {
      let movePlanId = null
      let eatPlanId = null

      if (!existingPlanClients.has(clientId)) {
        const p1 = insertPlan.run(
          clientId,
          'move',
          'Strength & Functional Movement',
          'Periodized training block',
          relativeIso(70, 8, 0),
          relativeIso(20, 8, 0)
        )
        movePlanId = p1.lastInsertRowid

        // Move items on Mon (1), Wed (3), Sat (6)
        insertItem.run(movePlanId, 1, 1, 'Warmup & Mobility', null, 1)
        insertItem.run(movePlanId, 1, 2, 'Main Compound Lifts', null, 1)
        insertItem.run(movePlanId, 3, 1, 'Accessory Hypertrophy', null, 1)
        insertItem.run(movePlanId, 6, 1, 'Conditioning Intervals', null, 1)

        const p2 = insertPlan.run(
          clientId,
          'eat',
          'High Protein Egyptian Nutrition',
          'Nutritional balance with local foods',
          relativeIso(70, 8, 10),
          relativeIso(20, 8, 10)
        )
        eatPlanId = p2.lastInsertRowid

        // Eat items daily
        for (let d = 1; d <= 7; d++) {
          insertItem.run(eatPlanId, d, 1, 'Nutritious Breakfast', 'breakfast', 1)
          insertItem.run(eatPlanId, d, 2, 'Lean High Protein Lunch', 'lunch', 1)
        }
      }
    })

    // Fetch all active items by client
    const clientItems = targetDb
      .prepare(
        `SELECT pi.id, pi.day_of_week, p.client_id, p.service
         FROM plan_items pi
         JOIN plans p ON p.id = pi.plan_id
         WHERE p.status = 'active'`
      )
      .all()

    const itemsByClient = new Map()
    clientItems.forEach((it) => {
      if (!itemsByClient.has(it.client_id)) itemsByClient.set(it.client_id, [])
      itemsByClient.get(it.client_id).push(it)
    })

    // Assign personas:
    // 0: Highly Engaged (85%)
    // 1: Steady (60%)
    // 2: Drifting (starts 75%, drops to 20%)
    // 3: Dormant (quits after 15 days)
    allCohortClients.forEach((clientId, idx) => {
      const persona = idx % 4
      const clientPlanItems = itemsByClient.get(clientId) || []
      if (clientPlanItems.length === 0) return

      // Generate daily history over the last 60 days
      for (let dayOffset = 59; dayOffset >= 0; dayOffset--) {
        const dateStr = relativeDateStr(dayOffset)
        const dObj = new Date(NOW.getTime() - dayOffset * 86400 * 1000)
        const dow = dObj.getUTCDay()
        const dow1to7 = dow === 0 ? 7 : dow // 1=Mon .. 7=Sun

        // Persona probability of completion
        let prob = 0.6
        if (persona === 0) prob = 0.88
        else if (persona === 1) prob = 0.62
        else if (persona === 2) prob = dayOffset > 25 ? 0.75 : 0.2
        else if (persona === 3) prob = dayOffset > 45 ? 0.65 : 0.02

        // Weekend slight drop
        if (dow === 5 || dow === 6) prob *= 0.9

        const scheduled = clientPlanItems.filter(
          (it) => it.day_of_week === dow1to7
        )
        for (const it of scheduled) {
          if (rng() < prob) {
            insertCompletion.run(
              clientId,
              it.id,
              dateStr,
              'done',
              relativeIso(dayOffset, 18, randomInt(0, 50))
            )
          } else if (rng() < 0.2) {
            insertCompletion.run(
              clientId,
              it.id,
              dateStr,
              'skipped',
              relativeIso(dayOffset, 18, randomInt(0, 50))
            )
          }
        }

        // Progress log once or twice a week
        if (dow === 6 && rng() < prob) {
          insertProgress.run(
            clientId,
            dateStr,
            75.0 + Math.sin(dayOffset / 10),
            1,
            randomInt(1, 4)
          )
        }
      }
    })

    // 7. Historical Bookings, Availability Slots & Heatmap Spread
    console.log('  Generating historical bookings, slot schedules, and sessions...')
    const specialists = targetDb
      .prepare(`SELECT user_id, type FROM specialists WHERE approval_status = 'approved'`)
      .all()

    const slotHours = [10, 12, 15, 17, 19, 20]
    const insertSlot = targetDb.prepare(`
      INSERT OR IGNORE INTO availability_slots (specialist_id, starts_at, ends_at, is_booked)
      VALUES (?, ?, ?, ?)
    `)
    const insertBooking = targetDb.prepare(`
      INSERT INTO bookings (client_id, specialist_id, slot_id, session_type, status, price_egp, notes, cancelled_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    // Create sessions across the last 60 days
    specialists.forEach((sp) => {
      // Find assigned clients for this specialist
      const assignedClients = targetDb
        .prepare(`SELECT client_id FROM care_team WHERE specialist_id = ?`)
        .all(sp.user_id)
        .map((r) => r.client_id)

      if (assignedClients.length === 0) return

      for (let dayOffset = 58; dayOffset >= 0; dayOffset -= 2) {
        const dObj = new Date(NOW.getTime() - dayOffset * 86400 * 1000)
        const dow = dObj.getUTCDay()
        if (dow === 5) continue // Friday off

        // 2-3 sessions per working day
        const sessionsToday = randomInt(2, 3)
        for (let sIdx = 0; sIdx < sessionsToday; sIdx++) {
          const hour = randomChoice(slotHours)
          const startsAt = relativeIso(dayOffset, hour, 0)
          const endsAt = relativeIso(dayOffset, hour, 45)
          const client = randomChoice(assignedClients)

          // 80% completed, 12% cancelled, 8% confirmed
          const roll = rng()
          let status = 'completed'
          let cancelledAt = null
          let isBooked = 1

          if (roll < 0.12) {
            status = 'cancelled'
            cancelledAt = relativeIso(dayOffset + 1, 14, 0)
            isBooked = 0
          } else if (roll < 0.20 && dayOffset <= 5) {
            status = 'confirmed'
          }

          const slotRes = insertSlot.run(sp.user_id, startsAt, endsAt, isBooked)
          if (slotRes.changes > 0) {
            const slotId = slotRes.lastInsertRowid
            const bookedDaysPrior = randomInt(1, 4)
            const createdIso = relativeIso(dayOffset + bookedDaysPrior, 10, 0)
            insertBooking.run(
              client,
              sp.user_id,
              slotId,
              'video',
              status,
              sp.type === 'trainer' ? 350 : 450,
              'Routine clinical / fitness review',
              cancelledAt,
              createdIso
            )
          }
        }
      }
    })

    // 8. Support Tickets (Varied resolution durations)
    console.log('  Generating support tickets and resolution durations...')
    const ticketCategories = [
      'session_dispute',
      'billing_refund',
      'technical_issue',
      'general_inquiry',
    ]

    const insertTicket = targetDb.prepare(`
      INSERT INTO support_tickets (ticket_number, reporter_id, category, priority, status, subject, description, resolution_note, resolved_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (let i = 1; i <= 14; i++) {
      const daysAgo = randomInt(3, 80)
      const createdIso = relativeIso(daysAgo, randomInt(9, 16), randomInt(0, 50))
      const reporter = randomChoice(b2cMemberIds)
      const cat = randomChoice(ticketCategories)

      // 10 resolved, 4 open/in_progress
      if (i <= 10) {
        const resolutionHours = randomChoice([2.5, 4.0, 8.5, 16.0, 24.0, 36.5])
        const resolvedDate = new Date(
          new Date(createdIso).getTime() + resolutionHours * 3600 * 1000
        )
        const resolvedIso = resolvedDate.toISOString().replace(/\.\d{3}Z$/, 'Z')

        insertTicket.run(
          `TICK-2026-0${100 + i}`,
          reporter,
          cat,
          'medium',
          'resolved',
          `Inquiry regarding ${cat.replace('_', ' ')}`,
          'Client reported a service or scheduling question.',
          'Resolved in accordance with platform policies.',
          resolvedIso,
          createdIso
        )
      } else {
        insertTicket.run(
          `TICK-2026-0${100 + i}`,
          reporter,
          cat,
          'high',
          'open',
          `Active inquiry regarding ${cat.replace('_', ' ')}`,
          'Pending staff review and follow up.',
          null,
          null,
          createdIso
        )
      }
    }

    // 9. Specialist Reviews & Ratings
    console.log('  Adding specialist ratings and verified reviews...')
    const insertReview = targetDb.prepare(`
      INSERT OR IGNORE INTO specialist_reviews (specialist_id, client_id, rating, comment, created_at)
      VALUES (?, ?, ?, ?, ?)
    `)

    for (let i = 0; i < 20; i++) {
      const sp = randomChoice(specialists)
      const cl = randomChoice(b2cMemberIds)
      insertReview.run(
        sp.user_id,
        cl,
        randomChoice([4, 5, 5, 5]),
        'Outstanding guidance, clear progressions, and attentive rehabilitation.',
        relativeIso(randomInt(5, 70), 14, 0)
      )
    }

    console.log('History seeding transaction successfully committed!')
  })

  runTx()
}

// Execute if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedHistory()
  console.log('\n--- New Demo Accounts Created for History Demonstration ---')
  console.log('1. Cairo University Sports (35 members, 60 seats):')
  console.log('   - Admin: admin@cu.edu.eg | demo1234')
  console.log('   - Invite Code: CUSP2026')
  console.log('2. Delta Tech Solutions (8 members, 40 seats):')
  console.log('   - Admin: admin@delta.com | demo1234')
  console.log('   - Invite Code: DELT2026')
  console.log('3. Giza CrossFit Studio (4 members, 15 seats — Demonstrates MIN_COHORT = 5 Suppression):')
  console.log('   - Admin: admin@giza.com | demo1234')
  console.log('   - Invite Code: GIZA2026')
  console.log('4. 40 B2C Individual Members:')
  console.log('   - b2c.user1@demo.com .. b2c.user40@demo.com | demo1234')
  console.log('All accounts share password: demo1234')
}
