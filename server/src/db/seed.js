// Fills the database with demo data.
// All demo passwords are: demo1234
// Slots are generated relative to today so db:reset always gives fresh dates.

import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '../../data/rebound.db')
const CONTENT = join(__dirname, '../../seed-content')

const db = new Database(DB_PATH)
db.pragma('foreign_keys = ON')
db.pragma('journal_mode = WAL')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Format a Date to 'YYYY-MM-DD'
function toDate(d) {
  return d.toISOString().slice(0, 10)
}

// Format a Date to ISO 8601 UTC string like '2026-10-15T14:30:00Z'
function toISO(d) {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

// Return a Date that is `days` days before/after today (positive = future)
function daysFromNow(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

// Return 'YYYY-MM-DD' for today + offset days
function dateStr(offsetDays = 0) {
  return toDate(daysFromNow(offsetDays))
}

// Hash a password with bcrypt cost 10 (spec requirement)
function hash(pw) {
  return bcrypt.hashSync(pw, 10)
}

// Load a JSON file from seed-content/
function load(filename) {
  return JSON.parse(readFileSync(join(CONTENT, filename), 'utf8'))
}

const DEMO_PW = hash('demo1234')

// ---------------------------------------------------------------------------
// Load seed-content files
// ---------------------------------------------------------------------------
const specialistData = load('specialists.json')

// ---------------------------------------------------------------------------
// Insert helpers (thin wrappers so each section reads like plain English)
// ---------------------------------------------------------------------------
const ins = db.prepare

function run(sql, params = []) {
  return db.prepare(sql).run(params)
}

function insertUser({ name, email, role }) {
  return run(
    `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)`,
    [name, email, DEMO_PW, role]
  ).lastInsertRowid
}

function insertClientProfile(userId, fields) {
  const cols = Object.keys(fields).join(', ')
  const placeholders = Object.keys(fields).map(() => '?').join(', ')
  return run(
    `INSERT INTO client_profiles (user_id, ${cols}) VALUES (?, ${placeholders})`,
    [userId, ...Object.values(fields)]
  )
}

function insertSpecialist(userId, fields) {
  return run(
    `INSERT INTO specialists
       (user_id, type, credentials, bio, focus_tags, photo_url, city,
        years_experience, languages, rate_egp, sessions_completed,
        approval_status, credential_doc)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      fields.type,
      fields.credentials,
      fields.bio,
      fields.focusTags,
      fields.photoUrl,
      fields.city,
      fields.yearsExperience,
      fields.languages,
      fields.rateEgp,
      fields.sessionsCompleted,
      fields.approvalStatus,
      fields.credentialDoc,
    ]
  )
}

function insertPackage(specialistId, pkg) {
  return run(
    `INSERT INTO specialist_packages (specialist_id, name, description, sessions_count, price_egp)
     VALUES (?, ?, ?, ?, ?)`,
    [specialistId, pkg.name, pkg.description, pkg.sessionsCount, pkg.priceEgp]
  ).lastInsertRowid
}

function insertSlot(specialistId, startsAt, endsAt) {
  return run(
    `INSERT OR IGNORE INTO availability_slots (specialist_id, starts_at, ends_at)
     VALUES (?, ?, ?)`,
    [specialistId, startsAt, endsAt]
  ).lastInsertRowid
}

function insertCareTeam(clientId, specialistId) {
  return run(
    `INSERT OR IGNORE INTO care_team (client_id, specialist_id) VALUES (?, ?)`,
    [clientId, specialistId]
  )
}

function insertPlan(clientId, service, authorId, title, summary) {
  return run(
    `INSERT INTO plans (client_id, service, author_id, source, status, title, summary)
     VALUES (?, ?, ?, 'specialist', 'active', ?, ?)`,
    [clientId, service, authorId, title, summary]
  ).lastInsertRowid
}

function insertPlanItem(planId, fields) {
  return run(
    `INSERT INTO plan_items
       (plan_id, day_of_week, position, time_of_day, title, instructions,
        sets, reps, tempo, rest_sec, duration_min, pain_limit, pt_cleared, safety_note,
        meal_type, kcal, protein_g, carbs_g, fat_g)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      planId,
      fields.dayOfWeek,
      fields.position ?? 0,
      fields.timeOfDay ?? null,
      fields.title,
      fields.instructions ?? null,
      fields.sets ?? null,
      fields.reps ?? null,
      fields.tempo ?? null,
      fields.restSec ?? null,
      fields.durationMin ?? null,
      fields.painLimit ?? null,
      fields.ptCleared ? 1 : 0,
      fields.safetyNote ?? null,
      fields.mealType ?? null,
      fields.kcal ?? null,
      fields.proteinG ?? null,
      fields.carbsG ?? null,
      fields.fatG ?? null,
    ]
  ).lastInsertRowid
}

function insertCompletion(clientId, planItemId, date, status) {
  return run(
    `INSERT OR IGNORE INTO item_completions (client_id, plan_item_id, date, status)
     VALUES (?, ?, ?, ?)`,
    [clientId, planItemId, date, status]
  )
}

function insertProgress(clientId, date, weightKg, workoutDone, painLevel, note = null) {
  return run(
    `INSERT OR IGNORE INTO progress_logs
       (client_id, date, weight_kg, workout_done, pain_level, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [clientId, date, weightKg, workoutDone ? 1 : 0, painLevel, note]
  )
}

function insertNote(clientId, authorId, body, visibleToClient) {
  return run(
    `INSERT INTO notes (client_id, author_id, body, visible_to_client) VALUES (?, ?, ?, ?)`,
    [clientId, authorId, body, visibleToClient ? 1 : 0]
  )
}

function insertBooking(clientId, specialistId, slotId, packageId, sessionType, priceEgp, status, notes) {
  return run(
    `INSERT INTO bookings
       (client_id, specialist_id, slot_id, package_id, session_type, price_egp, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [clientId, specialistId, slotId, packageId, sessionType, priceEgp, status, notes]
  ).lastInsertRowid
}

function insertReview(specialistId, clientId, rating, comment, createdAt) {
  return run(
    `INSERT OR REPLACE INTO specialist_reviews (specialist_id, client_id, rating, comment, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [specialistId, clientId, rating, comment, createdAt || toISO(new Date()), createdAt || toISO(new Date())]
  )
}

function insertSupportTicket({
  ticketNumber,
  reporterId,
  category,
  priority = 'medium',
  status = 'open',
  subject,
  description,
  bookingId = null,
  targetUserId = null,
  assignedTo = null,
  resolutionNote = null,
  resolvedAt = null,
  createdAt = null,
}) {
  const ts = createdAt || toISO(new Date())
  return run(
    `INSERT INTO support_tickets 
     (ticket_number, reporter_id, category, priority, status, subject, description, booking_id, target_user_id, assigned_to, resolution_note, resolved_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ticketNumber,
      reporterId,
      category,
      priority,
      status,
      subject,
      description,
      bookingId,
      targetUserId,
      assignedTo,
      resolutionNote,
      resolvedAt,
      ts,
      ts,
    ]
  ).lastInsertRowid
}

function insertTicketMessage(ticketId, senderId, message, isInternal = 0, createdAt = null) {
  const ts = createdAt || toISO(new Date())
  return run(
    `INSERT INTO ticket_messages (ticket_id, sender_id, message, is_internal, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [ticketId, senderId, message, isInternal ? 1 : 0, ts]
  ).lastInsertRowid
}

function markSlotBooked(slotId) {
  return run(`UPDATE availability_slots SET is_booked = 1 WHERE id = ?`, [slotId])
}

// ---------------------------------------------------------------------------
// Slot generation
// Spec: next 14 days, Saturday to Thursday (Fri is off), 3-4 slots per day.
// Day-of-week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
// Working days: Sat(6), Sun(0), Mon(1), Tue(2), Wed(3), Thu(4)
// ---------------------------------------------------------------------------

// Four possible time slots per day (we'll use 3-4 depending on the day)
const SLOT_TIMES = ['10:00', '12:30', '15:00', '17:30']

// Generate slots for a specialist for the next 14 days.
// Returns an array of { startsAt, endsAt } ISO strings.
function generateSlots(specialistId) {
  const slots = []
  for (let offset = 0; offset < 14; offset++) {
    const date = daysFromNow(offset)
    const dow = date.getDay() // 0=Sun ... 6=Sat

    // Friday is the day off — skip it
    if (dow === 5) continue

    // Use a deterministic count (3 or 4) based on specialist id + offset
    // so different specialists have different-looking schedules
    const count = (specialistId + offset) % 3 === 0 ? 3 : 4

    for (let i = 0; i < count; i++) {
      const [h, m] = SLOT_TIMES[i].split(':').map(Number)
      const start = new Date(date)
      start.setHours(h, m, 0, 0)
      const end = new Date(start)
      end.setMinutes(end.getMinutes() + 30)
      slots.push({ startsAt: toISO(start), endsAt: toISO(end) })
    }
  }
  return slots
}

// ---------------------------------------------------------------------------
// Wrap everything in a transaction so the DB is either fully seeded or empty
// ---------------------------------------------------------------------------
const seedAll = db.transaction(() => {

  // -------------------------------------------------------------------------
  // 1. Users
  // -------------------------------------------------------------------------
  console.log('Creating users...')

  const saraId = insertUser({ name: 'Sara Hassan', email: 'sara@demo.com', role: 'client' })
  const omarId = insertUser({ name: 'Omar Khaled', email: 'omar@demo.com', role: 'client' })
  const lailaId = insertUser({ name: 'Laila Mostafa', email: 'laila@demo.com', role: 'client' })
  const yasinId = insertUser({ name: 'Yasin Nabil', email: 'yasin@demo.com', role: 'client' })
  const mariamId = insertUser({ name: 'Mariam Adel', email: 'mariam@demo.com', role: 'client' })
  const ahmedId = insertUser({ name: 'Ahmed Essam', email: 'ahmed@demo.com', role: 'client' })
  const tarekId = insertUser({ name: 'Tarek Zaki', email: 'tarek@demo.com', role: 'client' })
  const nouranId = insertUser({ name: 'Nouran Mahmoud', email: 'nouran@demo.com', role: 'client' })
  const adminId = insertUser({ name: 'Admin Team', email: 'admin@demo.com', role: 'admin' })
  const financeId = insertUser({ name: 'Tamer Fahmy', email: 'finance@demo.com', role: 'finance' })

  // Specialist users — order matches specialists.json
  const specialistUserIds = {}
  for (const sp of specialistData) {
    const uid = insertUser({ name: sp.name, email: sp.email, role: 'specialist' })
    specialistUserIds[sp.email] = uid
  }

  const karimId  = specialistUserIds['karim@demo.com']
  const hanaId   = specialistUserIds['hana@demo.com']
  const monaId   = specialistUserIds['mona@demo.com']
  const nourId   = specialistUserIds['nour@demo.com']
  const nadaId   = specialistUserIds['nada@demo.com']
  const youssefId = specialistUserIds['youssef@demo.com']
  const yasminId = specialistUserIds['yasmin@demo.com']

  // -------------------------------------------------------------------------
  // 2. Client profiles
  // -------------------------------------------------------------------------
  console.log('Creating client profiles...')

  // Sara: plan_start_date = today minus 14 days (so she is on week 3 of 8)
  const saraPlanStart = dateStr(-14)

  insertClientProfile(saraId, {
    goal: 'lose_fat',
    days_per_week: 4,
    age: 26,
    height_cm: 165,
    weight_kg: 72.8,
    activity_level: 'moderate',
    diet_style: 'high_protein',
    allergies: null,
    meals_per_day: 4,
    disliked_foods: 'okra',
    phone: '0100 555 0142',
    plan_start_date: saraPlanStart,
    program_weeks: 8,
    onboarding_completed: 1,
  })

  // Omar: onboarding not completed — empty profile row
  insertClientProfile(omarId, {
    onboarding_completed: 0,
  })

  // Laila: completed onboarding
  insertClientProfile(lailaId, {
    goal: 'recover_injury',
    days_per_week: 3,
    age: 29,
    height_cm: 168,
    weight_kg: 65.0,
    activity_level: 'light',
    diet_style: 'vegetarian',
    plan_start_date: dateStr(-10),
    program_weeks: 8,
    onboarding_completed: 1,
  })

  // Yasin: completed onboarding
  insertClientProfile(yasinId, {
    goal: 'build_muscle',
    days_per_week: 5,
    age: 31,
    height_cm: 182,
    weight_kg: 84.0,
    activity_level: 'active',
    diet_style: 'high_protein',
    plan_start_date: dateStr(-5),
    program_weeks: 12,
    onboarding_completed: 1,
  })

  // -------------------------------------------------------------------------
  // 3. Injuries
  // -------------------------------------------------------------------------
  console.log('Creating injuries...')

  run(
    `INSERT INTO injuries (client_id, body_area, pain_level, duration, doctor_seen, note)
     VALUES (?, 'knee', 3, 'weeks', 1, 'Right knee, meniscus strain. Currently manageable.')`,
    [saraId]
  )

  // -------------------------------------------------------------------------
  // 4. Specialists + packages
  // -------------------------------------------------------------------------
  console.log('Creating specialists and packages...')

  const specialistDbIds = {}
  for (const sp of specialistData) {
    const uid = specialistUserIds[sp.email]
    insertSpecialist(uid, sp)
    specialistDbIds[sp.email] = uid

    for (const pkg of sp.packages) {
      insertPackage(uid, pkg)
    }
  }

  // -------------------------------------------------------------------------
  // 5. Availability slots
  // -------------------------------------------------------------------------
  console.log('Generating availability slots...')

  const slotIds = {} // slotIds[specialistId][startsAt] = slotDbId

  for (const sp of specialistData) {
    // Only approved specialists get slots
    if (sp.approvalStatus !== 'approved') continue
    const uid = specialistUserIds[sp.email]
    slotIds[uid] = {}
    const slots = generateSlots(uid)
    for (const s of slots) {
      const id = insertSlot(uid, s.startsAt, s.endsAt)
      if (id) slotIds[uid][s.startsAt] = id
    }
  }

  // Convenience: find the first open slot for a specialist on or after a given offset
  function findSlot(specialistId, minOffsetDays = 1) {
    for (let offset = minOffsetDays; offset < 20; offset++) {
      const date = daysFromNow(offset)
      const dow = date.getDay()
      if (dow === 5) continue
      for (const time of SLOT_TIMES) {
        const [h, m] = time.split(':').map(Number)
        const dt = new Date(date)
        dt.setHours(h, m, 0, 0)
        const key = toISO(dt)
        const id = slotIds[specialistId]?.[key]
        if (id) return { id, startsAt: key }
      }
    }
    return null
  }

  // Find a past slot (already happened — we manually build the ISO string)
  function pastSlotStartsAt(offsetDays) {
    const d = daysFromNow(-offsetDays)
    d.setHours(15, 0, 0, 0)
    return toISO(d)
  }

  // -------------------------------------------------------------------------
  // 6. Care team — Sara works with Karim, Hana, Mona
  // -------------------------------------------------------------------------
  console.log('Creating care team...')

  insertCareTeam(saraId, karimId)
  insertCareTeam(saraId, hanaId)
  insertCareTeam(saraId, monaId)

  // -------------------------------------------------------------------------
  // 7. Plans for Sara
  // Spec: "The PT caps squat depth and marks knee-safe exercises with pt_cleared,
  //        the trainer's plan swaps a movement to match, and the nutritionist's
  //        plan raises protein for recovery."
  // -------------------------------------------------------------------------
  console.log('Creating plans for Sara...')

  // --- MOVE plan (by Karim) ---
  const movePlanId = insertPlan(
    saraId, 'move', karimId,
    "Sara's strength plan",
    "Squats are capped at 60 degrees on Dr. Mona's instruction. Leg day uses the box squat and leg press instead of free squats. Walking lunges are on hold until the knee review clears them."
  )

  // Monday (1): Upper push
  insertPlanItem(movePlanId, { dayOfWeek: 1, position: 0, timeOfDay: '18:00', title: 'Dumbbell bench press', instructions: 'Feet flat, shoulder blades pinched. Lower for three counts, press up without locking out.', sets: 4, reps: '8', tempo: '3-1-1', restSec: 90, painLimit: 5, ptCleared: true })
  insertPlanItem(movePlanId, { dayOfWeek: 1, position: 1, timeOfDay: '18:00', title: 'Seated dumbbell shoulder press', instructions: 'Back against the pad. Press straight up, elbows slightly in front.', sets: 3, reps: '10', tempo: '2-0-1', restSec: 75, painLimit: 5, ptCleared: true })
  insertPlanItem(movePlanId, { dayOfWeek: 1, position: 2, timeOfDay: '18:00', title: 'Cable triceps pushdown', instructions: 'Elbows pinned to your sides. Only the forearms move.', sets: 3, reps: '12', tempo: '2-0-2', restSec: 60, painLimit: 5, ptCleared: true })

  // Wednesday (3): Lower body — knee-safe
  insertPlanItem(movePlanId, { dayOfWeek: 3, position: 0, timeOfDay: '18:00', title: 'Box squat to 60 degrees', instructions: 'Sit back to the box set at 60 degrees. Touch, pause, stand. Never go deeper than the box.', sets: 4, reps: '8', tempo: '3-1-1', restSec: 90, painLimit: 4, ptCleared: true, safetyNote: 'Knee angle must not exceed 60 degrees. Dr. Mona reviewed and cleared this.' })
  insertPlanItem(movePlanId, { dayOfWeek: 3, position: 1, timeOfDay: '18:00', title: 'Romanian deadlift', instructions: 'Soft knees, hinge at hips, bar close to legs. Stop when hamstrings stretch.', sets: 3, reps: '10', tempo: '3-0-1', restSec: 90, painLimit: 5, ptCleared: true })
  insertPlanItem(movePlanId, { dayOfWeek: 3, position: 2, timeOfDay: '18:00', title: 'Hip thrust', instructions: 'Upper back on bench, drive through heels, squeeze at top.', sets: 3, reps: '12', tempo: '2-1-1', restSec: 75, painLimit: 5, ptCleared: true })
  insertPlanItem(movePlanId, { dayOfWeek: 3, position: 3, timeOfDay: '18:00', title: 'Walking lunges', instructions: 'Short steps, front knee over ankle.', sets: 3, reps: '10', tempo: 'Controlled', restSec: 60, painLimit: 3, ptCleared: false, safetyNote: 'On hold — waiting for Dr. Mona to review at next session.' })

  // Thursday (4): Upper pull
  insertPlanItem(movePlanId, { dayOfWeek: 4, position: 0, timeOfDay: '18:00', title: 'Lat pulldown', instructions: 'Pull bar to upper chest, elbows down and back.', sets: 4, reps: '10', tempo: '2-1-2', restSec: 75, painLimit: 5, ptCleared: true })
  insertPlanItem(movePlanId, { dayOfWeek: 4, position: 1, timeOfDay: '18:00', title: 'Seated cable row', instructions: 'Chest tall. Squeeze shoulder blades together on every rep.', sets: 3, reps: '10', tempo: '2-1-2', restSec: 75, painLimit: 5, ptCleared: true })
  insertPlanItem(movePlanId, { dayOfWeek: 4, position: 2, timeOfDay: '18:00', title: 'Dumbbell curl', instructions: 'Keep elbows still. Lower slowly.', sets: 3, reps: '12', tempo: '2-0-2', restSec: 60, painLimit: 5, ptCleared: true })

  // Saturday (6): Lower and core
  insertPlanItem(movePlanId, { dayOfWeek: 6, position: 0, timeOfDay: '11:00', title: 'Leg press, 0 to 60 degrees', instructions: 'Set stop pin so knee never bends past 60 degrees. Press through whole foot.', sets: 4, reps: '10', tempo: '3-0-1', restSec: 90, painLimit: 4, ptCleared: true, safetyNote: 'Use the safety pin. Cleared by Dr. Mona.' })
  insertPlanItem(movePlanId, { dayOfWeek: 6, position: 1, timeOfDay: '11:00', title: 'Glute bridge', instructions: 'Heels close to hips, lift until hips and knees are in a line.', sets: 3, reps: '15', tempo: '2-1-1', restSec: 60, painLimit: 4, ptCleared: true })
  insertPlanItem(movePlanId, { dayOfWeek: 6, position: 2, timeOfDay: '11:00', title: 'Plank', instructions: 'Elbows under shoulders, ribs down, breathe steadily.', sets: 3, reps: '40 sec', tempo: 'Hold', restSec: 45, painLimit: 5, ptCleared: true })

  // --- EAT plan (by Hana) ---
  const eatPlanId = insertPlan(
    saraId, 'eat', hanaId,
    "Sara's meal plan",
    "Protein is kept at 130 g on training days to support knee recovery and fat loss. Meals use Egyptian staples Sara already eats. Okra is excluded as requested."
  )

  // Meals repeat across days — Mon/Wed/Fri/Sun use pattern A; Tue/Thu/Sat use pattern B
  const mealDays = [
    // [dayOfWeek, patternA? ]
    [1, true], [2, false], [3, true], [4, false],
    [5, true], [6, false], [7, true],
  ]

  const patternA = [
    { mealType: 'breakfast', timeOfDay: '08:00', title: 'Foul medames with egg and baladi bread', kcal: 420, proteinG: 24, carbsG: 48, fatG: 14 },
    { mealType: 'lunch',     timeOfDay: '14:00', title: 'Grilled chicken breast with rice and molokhia', kcal: 610, proteinG: 46, carbsG: 62, fatG: 16 },
    { mealType: 'snack',     timeOfDay: '17:00', title: 'Greek yogurt with walnuts and banana', kcal: 280, proteinG: 18, carbsG: 30, fatG: 9 },
    { mealType: 'dinner',    timeOfDay: '21:00', title: 'Grilled kofta with tahini salad and baladi bread', kcal: 520, proteinG: 36, carbsG: 38, fatG: 24 },
  ]

  const patternB = [
    { mealType: 'breakfast', timeOfDay: '08:00', title: 'Oats with milk, dates, and almonds', kcal: 400, proteinG: 20, carbsG: 56, fatG: 12 },
    { mealType: 'lunch',     timeOfDay: '14:00', title: 'Grilled tilapia with bulgur and roasted vegetables', kcal: 580, proteinG: 44, carbsG: 58, fatG: 14 },
    { mealType: 'snack',     timeOfDay: '17:00', title: 'Labneh with cucumber and half baladi bread', kcal: 240, proteinG: 14, carbsG: 26, fatG: 8 },
    { mealType: 'dinner',    timeOfDay: '21:00', title: 'Lentil soup with tuna salad and toast', kcal: 480, proteinG: 34, carbsG: 46, fatG: 14 },
  ]

  for (const [dow, useA] of mealDays) {
    const meals = useA ? patternA : patternB
    meals.forEach((m, i) => {
      insertPlanItem(eatPlanId, { dayOfWeek: dow, position: i, ...m })
    })
  }

  // --- RECOVER plan (by Mona) ---
  const recoverPlanId = insertPlan(
    saraId, 'recover', monaId,
    "Sara's knee rehab plan",
    "Squats capped at 60 degrees until the next review. Daily knee routine runs on all days, especially the day after lower-body training. Walking lunges remain on hold pending Thursday's assessment."
  )

  // Daily routine — every day (1-7)
  for (let dow = 1; dow <= 7; dow++) {
    insertPlanItem(recoverPlanId, { dayOfWeek: dow, position: 0, timeOfDay: '21:00', title: 'Quad sets', instructions: 'Sit with the leg straight. Tighten the thigh and press the knee down. Hold 5 seconds.', sets: 3, reps: '15', tempo: '5 s hold', restSec: 30, painLimit: 4, ptCleared: true, safetyNote: 'Stop if pain rises above 4/10.' })
    insertPlanItem(recoverPlanId, { dayOfWeek: dow, position: 1, timeOfDay: '21:00', title: 'Straight leg raise', instructions: 'Tighten the thigh first, then lift to the height of the other knee. Lower slowly.', sets: 3, reps: '12', tempo: '2-1-2', restSec: 30, painLimit: 4, ptCleared: true })
    insertPlanItem(recoverPlanId, { dayOfWeek: dow, position: 2, timeOfDay: '21:00', title: 'Heel slides', instructions: 'Slide heel toward you until a gentle stretch — not pain. Slide back out.', sets: 2, reps: '15', tempo: 'Slow', restSec: 30, painLimit: 4, ptCleared: true })
    insertPlanItem(recoverPlanId, { dayOfWeek: dow, position: 3, timeOfDay: '21:00', title: 'Foam rolling — quads and calves', instructions: 'Roll slowly. Stop on tender spots for 20 seconds. Never roll directly on the knee joint.', sets: 1, reps: '2 min each', tempo: 'Slow', durationMin: 5, painLimit: 5, ptCleared: true })
  }

  // -------------------------------------------------------------------------
  // 8. Progress logs for Sara — 21 days
  // Weight drifts down, pain trends from 6 to 3.
  // -------------------------------------------------------------------------
  console.log('Creating progress logs for Sara...')

  // 21 entries: day -20 through day 0 (today)
  const weightStart = 76.4
  const weightEnd   = 72.8
  const painStart   = 6
  const painEnd     = 3
  const N = 21

  for (let i = 0; i < N; i++) {
    const dayOffset = -(N - 1 - i)  // -20, -19, ... 0
    const t = i / (N - 1)            // 0.0 → 1.0

    // Interpolate with slight random wobble for realism
    const weight = +(weightStart + (weightEnd - weightStart) * t + (Math.random() - 0.5) * 0.3).toFixed(1)
    // Pain decreases from 6 to 3, stays as integers
    const pain = Math.round(painStart + (painEnd - painStart) * t)
    // Workout done on 4/7 days — skip Sun and Wed and random day
    const dow = daysFromNow(dayOffset).getDay()
    const workoutDone = dow !== 0 && dow !== 3 && i % 7 !== 5

    insertProgress(saraId, dateStr(dayOffset), weight, workoutDone, pain)
  }

  // -------------------------------------------------------------------------
  // 9. Completions for Sara — last 5 days
  // -------------------------------------------------------------------------
  console.log('Creating completions for Sara...')

  // Get all of Sara's plan items so we can check them off
  const saraItems = db.prepare(
    `SELECT pi.id, pi.day_of_week, p.service
     FROM plan_items pi
     JOIN plans p ON p.id = pi.plan_id
     WHERE p.client_id = ? AND p.status = 'active'`
  ).all(saraId)

  // For each of the last 5 days, mark items for that day-of-week as done
  for (let offset = -4; offset <= 0; offset++) {
    const d = daysFromNow(offset)
    const dow = d.getDay()
    // Convert JS day (0=Sun) to DB day (1=Mon)
    const dbDow = dow === 0 ? 7 : dow

    for (const item of saraItems) {
      if (item.day_of_week !== dbDow) continue
      // Skip the recover plan's foam-rolling item (position 3) occasionally
      // to make it look realistic — still mark most items done
      const status = 'done'
      insertCompletion(saraId, item.id, dateStr(offset), status)
    }
  }

  // -------------------------------------------------------------------------
  // 10. Bookings for Sara
  // Spec: one upcoming with Dr. Mona, two past bookings
  // -------------------------------------------------------------------------
  console.log('Creating bookings for Sara...')

  // Get Mona's single-session package
  const monaPackage = db.prepare(
    `SELECT id, price_egp FROM specialist_packages WHERE specialist_id = ? AND sessions_count = 1`
  ).get(monaId)

  // Upcoming booking — first available future slot for Mona
  const upcomingSlot = findSlot(monaId, 1)
  let upcomingBookingId = null

  if (upcomingSlot) {
    upcomingBookingId = insertBooking(
      saraId, monaId, upcomingSlot.id,
      monaPackage?.id ?? null,
      'video',
      monaPackage?.price_egp ?? 450,
      'confirmed',
      'Knee review, week 3'
    )
    markSlotBooked(upcomingSlot.id)
  }

  // Past booking 1 — Mona, completed, 7 days ago
  // We insert a synthetic past slot (not in the slots table, just for the booking record)
  // so we create a past slot row first
  const pastSlot1StartsAt = pastSlotStartsAt(7)
  const pastSlot1EndsAt = (() => {
    const d = new Date(pastSlot1StartsAt)
    d.setMinutes(d.getMinutes() + 30)
    return toISO(d)
  })()
  const pastSlotId1 = run(
    `INSERT OR IGNORE INTO availability_slots (specialist_id, starts_at, ends_at, is_booked)
     VALUES (?, ?, ?, 1)`,
    [monaId, pastSlot1StartsAt, pastSlot1EndsAt]
  ).lastInsertRowid

  if (pastSlotId1) {
    insertBooking(saraId, monaId, pastSlotId1, monaPackage?.id ?? null, 'video', monaPackage?.price_egp ?? 450, 'completed', 'Knee review, week 2')
  }

  // Past booking 2 — Karim, completed, 14 days ago
  const karimPackage = db.prepare(
    `SELECT id, price_egp FROM specialist_packages WHERE specialist_id = ? AND sessions_count = 1`
  ).get(karimId)

  const pastSlot2StartsAt = pastSlotStartsAt(14)
  const pastSlot2EndsAt = (() => {
    const d = new Date(pastSlot2StartsAt)
    d.setMinutes(d.getMinutes() + 30)
    return toISO(d)
  })()
  const pastSlotId2 = run(
    `INSERT OR IGNORE INTO availability_slots (specialist_id, starts_at, ends_at, is_booked)
     VALUES (?, ?, ?, 1)`,
    [karimId, pastSlot2StartsAt, pastSlot2EndsAt]
  ).lastInsertRowid

  if (pastSlotId2) {
    insertBooking(saraId, karimId, pastSlotId2, karimPackage?.id ?? null, 'video', karimPackage?.price_egp ?? 350, 'completed', 'Program start')
  }

  // -------------------------------------------------------------------------
  // 11. Note from Dr. Mona to Sara (visible to client)
  // -------------------------------------------------------------------------
  console.log('Creating notes...')

  insertNote(
    saraId, monaId,
    'Good news on the knee. Keep box squats at 60 degrees one more week, then we test a little deeper on Thursday. If today\'s pain climbs above 4, skip the squats and do the mobility only.',
    true
  )

  // Private note (not visible to Sara)
  insertNote(
    saraId, monaId,
    'Reports morning stiffness. Added 5 minutes of heel slides before the main routine. Monitor at next session.',
    false
  )

  // -------------------------------------------------------------------------
  // 12. Financial Seed Data (Subscriptions, Bookings, Specialist Payouts)
  // -------------------------------------------------------------------------
  console.log('Creating subscriptions and financial records...')

  const insertSub = db.prepare(`
    INSERT INTO subscriptions (client_id, plan_name, price_egp, method, status, reference, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  insertSub.run(saraId, 'Full Team', 1499, 'instapay', 'active', 'SUB-FT-8821', dateStr(-21) + 'T10:00:00Z')
  insertSub.run(omarId, 'Starter', 399, 'card', 'active', 'SUB-ST-4029', dateStr(-14) + 'T12:30:00Z')
  insertSub.run(lailaId, 'Plus', 899, 'vodafone_cash', 'active', 'SUB-PL-1920', dateStr(-10) + 'T14:15:00Z')
  insertSub.run(yasinId, 'Full Team', 1499, 'card', 'active', 'SUB-FT-5510', dateStr(-5) + 'T09:45:00Z')

  // Additional completed booking for Laila with Dr. Mona
  const pastSlot3StartsAt = pastSlotStartsAt(3)
  const pastSlot3EndsAt = (() => {
    const d = new Date(pastSlot3StartsAt)
    d.setMinutes(d.getMinutes() + 30)
    return toISO(d)
  })()
  const pastSlotId3 = run(
    `INSERT OR IGNORE INTO availability_slots (specialist_id, starts_at, ends_at, is_booked)
     VALUES (?, ?, ?, 1)`,
    [monaId, pastSlot3StartsAt, pastSlot3EndsAt]
  ).lastInsertRowid

  if (pastSlotId3) {
    insertBooking(lailaId, monaId, pastSlotId3, null, 'video', 450, 'completed', 'Initial injury triage')
  }

  // Specialist Payouts (disbursements)
  const insertPayout = db.prepare(`
    INSERT INTO payouts (specialist_id, amount_egp, platform_cut_egp, net_payout_egp, period_start, period_end, status, reference, paid_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  // Settle payout for Dr. Mona: gross 900 EGP, 20% platform cut (180 EGP), net payout 720 EGP (Paid)
  insertPayout.run(monaId, 900, 180, 720, dateStr(-28), dateStr(-14), 'paid', 'PAY-MF-9901', dateStr(-14) + 'T16:00:00Z', dateStr(-14) + 'T12:00:00Z')

  // Settle payout for Coach Karim: gross 700 EGP, 20% cut (140 EGP), net payout 560 EGP (Paid)
  insertPayout.run(karimId, 700, 140, 560, dateStr(-28), dateStr(-14), 'paid', 'PAY-KA-9902', dateStr(-14) + 'T16:30:00Z', dateStr(-14) + 'T12:30:00Z')

  // Pending payout for Dr. Mona: gross 450 EGP, 20% cut (90 EGP), net 360 EGP (Pending)
  insertPayout.run(monaId, 450, 90, 360, dateStr(-14), dateStr(0), 'pending', 'PAY-MF-9903', null, dateStr(-1) + 'T10:00:00Z')

  // Pending payout for Hana: gross 500 EGP, 20% cut (100 EGP), net 400 EGP (Pending)
  insertPayout.run(hanaId, 500, 100, 400, dateStr(-14), dateStr(0), 'pending', 'PAY-HI-9904', null, dateStr(-2) + 'T11:00:00Z')

  // -------------------------------------------------------------------------
  // 13. Specialist Ratings and Reviews (Verified Clients Anti-Spam Enforced)
  // -------------------------------------------------------------------------
  console.log('Creating verified client reviews and ratings...')

  // Establish care_team links for reviewing clients to fulfill the anti-spam eligibility check
  insertCareTeam(mariamId, monaId)
  insertCareTeam(mariamId, hanaId)
  insertCareTeam(ahmedId, monaId)
  insertCareTeam(ahmedId, hanaId)
  insertCareTeam(ahmedId, nadaId)
  insertCareTeam(tarekId, karimId)
  insertCareTeam(tarekId, youssefId)
  insertCareTeam(nouranId, karimId)
  insertCareTeam(nouranId, youssefId)
  insertCareTeam(yasinId, karimId)
  insertCareTeam(yasinId, nourId)
  insertCareTeam(lailaId, nourId)

  // Dr. Mona Fathy reviews
  insertReview(monaId, saraId, 5, "Dr. Mona changed my entire knee rehab. When my pain spiked to 4/10 on Monday, she adjusted my routine immediately before my workout. Best physical therapist in Cairo!", dateStr(-4) + 'T15:20:00Z')
  insertReview(monaId, lailaId, 5, "Extremely professional and compassionate. The pain rules gave me the confidence to exercise again without fear of re-injury.", dateStr(-8) + 'T11:45:00Z')
  insertReview(monaId, mariamId, 5, "Her coordination with my gym coach was seamless. Ten minutes of daily mobility completely fixed my morning hip stiffness.", dateStr(-12) + 'T09:30:00Z')
  insertReview(monaId, ahmedId, 4, "Great session and very thorough assessment of my shoulder mobility. Practical exercises that fit into a busy day.", dateStr(-15) + 'T18:10:00Z')

  // Coach Karim Adel reviews
  insertReview(karimId, saraId, 5, "Karim focuses on strict form and sustainable progress. My strength has surged while staying completely injury-free.", dateStr(-5) + 'T14:00:00Z')
  insertReview(karimId, yasinId, 5, "Tracks my numbers every week and never lets me compromise technique. Truly one of the best strength coaches.", dateStr(-9) + 'T16:20:00Z')
  insertReview(karimId, tarekId, 5, "Top-tier coaching. Tailors every workout to my recovery capacity and coordinates with my doctor.", dateStr(-13) + 'T12:00:00Z')
  insertReview(karimId, nouranId, 4, "Great motivation and prompt check-ins when I travel for work. Super supportive coach.", dateStr(-18) + 'T10:15:00Z')

  // Hana Ibrahim, RD reviews
  insertReview(hanaId, saraId, 5, "Hana made hitting 130g protein effortless with real Egyptian staples like ful, eggs, and lentil soup. No extreme diets!", dateStr(-3) + 'T17:40:00Z')
  insertReview(hanaId, mariamId, 5, "Down 4 kg in 6 weeks without feeling sluggish or hungry. Her grocery shopping hacks saved me money too.", dateStr(-7) + 'T13:10:00Z')
  insertReview(hanaId, ahmedId, 5, "Practical sports nutrition advice and realistic portions that match my training days.", dateStr(-11) + 'T19:00:00Z')

  // Dr. Youssef Amin reviews
  insertReview(youssefId, tarekId, 5, "Fixed my persistent lower back stiffness from desk work. Short, highly effective mobility routines.", dateStr(-6) + 'T10:30:00Z')
  insertReview(youssefId, nouranId, 5, "Excellent diagnosis and clear instructions. Highly recommend Dr. Youssef for anyone with office posture pain.", dateStr(-14) + 'T11:00:00Z')

  // Coach Nour Salem reviews
  insertReview(nourId, lailaId, 5, "Empowering workouts for home and gym. She keeps me accountable and celebrates small wins!", dateStr(-5) + 'T12:15:00Z')
  insertReview(nourId, yasinId, 4, "Solid workouts, great variety, and very approachable attitude.", dateStr(-10) + 'T14:40:00Z')

  // Nada Gamal, RD reviews
  insertReview(nadaId, ahmedId, 5, "High protein meals tailored to an Egyptian student budget. Amazing recipes!", dateStr(-8) + 'T16:50:00Z')

  // -------------------------------------------------------------------------
  // 14. Customer Support Tickets & Incident Reports
  // -------------------------------------------------------------------------
  console.log('Creating customer support tickets and reports...')

  // Ticket 1: Session dispute (Urgent, in progress)
  const t1 = insertSupportTicket({
    ticketNumber: 'TICK-8021',
    reporterId: lailaId,
    category: 'session_dispute',
    priority: 'urgent',
    status: 'in_progress',
    subject: 'Video session disconnected at 15 minutes',
    description: 'During our rehab follow-up, the video room froze and we could not reconnect. Need to reschedule the remaining time.',
    targetUserId: monaId,
    assignedTo: adminId,
    createdAt: dateStr(-1) + 'T14:30:00Z',
  })
  insertTicketMessage(t1, lailaId, 'During our rehab follow-up, the video room froze and we could not reconnect. Need to reschedule the remaining time.', 0, dateStr(-1) + 'T14:30:00Z')
  insertTicketMessage(t1, adminId, 'Hello Laila, we apologize for the network disruption. We reviewed the session logs and have notified Dr. Mona to arrange a complimentary makeup check-in.', 0, dateStr(-1) + 'T15:15:00Z')
  insertTicketMessage(t1, adminId, 'Verified WebRTC disconnection in server logs. Free makeup session token approved.', 1, dateStr(-1) + 'T15:16:00Z')

  // Ticket 2: Billing & Subscription Inquiry (Open)
  const t2 = insertSupportTicket({
    ticketNumber: 'TICK-8022',
    reporterId: saraId,
    category: 'billing_refund',
    priority: 'medium',
    status: 'open',
    subject: 'Inquiry regarding pausing my Full Team subscription',
    description: 'I will be traveling outside Egypt for 10 days next month. Can I pause my active Full Team subscription and resume without losing my care team?',
    assignedTo: adminId,
    createdAt: dateStr(-2) + 'T11:00:00Z',
  })
  insertTicketMessage(t2, saraId, 'I will be traveling outside Egypt for 10 days next month. Can I pause my active Full Team subscription and resume without losing my care team?', 0, dateStr(-2) + 'T11:00:00Z')

  // Ticket 3: Conduct report (High, open)
  const t3 = insertSupportTicket({
    ticketNumber: 'TICK-8023',
    reporterId: omarId,
    category: 'specialist_conduct',
    priority: 'high',
    status: 'open',
    subject: 'Specialist joined 20 minutes late with no notice',
    description: 'The specialist joined 20 minutes late with no prior warning and rushed through my routine questions.',
    targetUserId: karimId,
    createdAt: dateStr(-3) + 'T16:00:00Z',
  })
  insertTicketMessage(t3, omarId, 'The specialist joined 20 minutes late with no prior warning and rushed through my routine questions.', 0, dateStr(-3) + 'T16:00:00Z')

  // Ticket 4: General inquiry & Fawry verification (Resolved)
  const t4 = insertSupportTicket({
    ticketNumber: 'TICK-8024',
    reporterId: yasinId,
    category: 'general_inquiry',
    priority: 'low',
    status: 'resolved',
    subject: 'Fawry payment confirmation receipt',
    description: 'Paid for Starter plan at a Fawry kiosk yesterday. Want to confirm reference code was acknowledged.',
    assignedTo: adminId,
    resolutionNote: 'Fawry transaction matched in bank reconciliation. Plan confirmed active.',
    resolvedAt: dateStr(-1) + 'T10:00:00Z',
    createdAt: dateStr(-4) + 'T09:30:00Z',
  })
  insertTicketMessage(t4, yasinId, 'Paid for Starter plan at a Fawry kiosk yesterday. Want to confirm reference code was acknowledged.', 0, dateStr(-4) + 'T09:30:00Z')
  insertTicketMessage(t4, adminId, 'Hello Yasin, your payment reference has been reconciled successfully. Your subscription is active and all features are unlocked!', 0, dateStr(-1) + 'T10:00:00Z')

  console.log('Seed complete.')
  console.log(`  sara@demo.com   — client (full data, week 3 of 8)`)
  console.log(`  omar@demo.com   — client (onboarding not completed)`)
  console.log(`  karim@demo.com  — trainer, approved`)
  console.log(`  hana@demo.com   — nutritionist, approved`)
  console.log(`  mona@demo.com   — physical therapist, approved`)
  console.log(`  nour@demo.com   — trainer, approved`)
  console.log(`  nada@demo.com   — nutritionist, approved`)
  console.log(`  youssef@demo.com— physical therapist, approved`)
  console.log(`  yasmin@demo.com — physical therapist, PENDING`)
  console.log(`  admin@demo.com  — admin`)
  console.log(`  finance@demo.com— finance officer`)
  console.log(`  All passwords:  demo1234`)
})

seedAll()
db.close()

