# Rebound: Backend & Database Spec

This file is the source of truth for the backend. `schema.sql` (same folder) is the database schema. Read both fully before doing anything.

---

## 0. How to work (read first)

You are continuing an existing React front end that was **exported from Figma Make and is already complete: every page and screen is built**. Do **not** recreate, redesign, restyle or rewrite any page or component. The backend does not exist yet, and your job is to add it and connect the existing pages to it. Expect the export to use hard-coded sample data inside the components, and possibly no real routing or API layer yet. The developer (Ziad) will teach this code to five students who are new to programming, so **readability matters more than cleverness**.

**Rules**
1. Work **one phase at a time** (section 8). At the end of each phase, stop and report: files created or changed, how to run it, how to test it, and anything you were unsure about. Do not start the next phase until told.
2. Start with **Phase 0 only**: inspect the existing code and report. Do not write backend code in Phase 0.
3. Plain JavaScript (ES modules), no TypeScript, no ORM, no extra frameworks. Short functions. Comments in simple English that explain *why*, not just *what*.
4. Allowed dependencies: `express`, `better-sqlite3`, `jsonwebtoken`, `bcryptjs`, `zod`, `cors`, `dotenv`, and optionally `express-rate-limit`. Dev: `concurrently` at the root. Use Node's built-in `--watch` for the dev server. **Ask before adding anything else.**
5. **The front end is finished. Never change how any page looks or is laid out.** When connecting a screen to the API (Phase 7), make the smallest possible change: replace the hard-coded data with data from the API, and keep the existing markup, styling, loading, empty and error designs. Do not rename or move existing files and components unless it is unavoidable (explain why if so). If a screen needs data or a state that its design does not show, tell me instead of inventing UI.
6. No placeholders like `// TODO implement`. Every endpoint you create must work and be tested.
7. SQL: prepared statements only, never build SQL with string concatenation. Use transactions for any multi-step write.

---

## 1. Product context

Rebound is an online platform that combines **fitness (Move)**, **nutrition (Eat)** and **physical therapy (Recover)** in one integrated plan, delivered by real specialists. It is a **graduation project demo**: it runs on one laptop and is never deployed.

Roles: **client**, **specialist** (trainer, nutritionist or physical therapist), **admin**.

| Real (working backend) | Mocked (UI works, no real service behind it) |
|---|---|
| Sign up, log in, roles | Payments (records a fake "paid" subscription only) |
| Onboarding profile and injuries | Video calls (session screen shows placeholder data) |
| Browse specialists, booking, cancel | Real-time chat and notifications |
| Plans (workout / meals / recovery), daily check-offs | Email, SMS, file storage |
| Progress tracking (weight, workouts, pain) | |
| AI plan generator | |
| Specialist portal (clients, plan editing, schedule) | |
| Admin (overview, users, specialist approvals) | |

---

## 2. Folder layout

```
rebound/
├─ client/                  the existing Figma Make React app. If the export sits at the project root,
│                           leave it exactly where it is and add `server/` beside it; adjust the
│                           root scripts to match and tell me what you did.
├─ server/
│  ├─ package.json
│  ├─ .env.example
│  ├─ api.http              sample requests for every endpoint (VS Code REST Client format)
│  ├─ data/                 rebound.db is created here (git-ignored)
│  ├─ seed-content/         editable JSON so non-developers can change demo content
│  │   ├─ exercises.json    ~20 strength / cardio exercises
│  │   ├─ recovery.json     ~10 physical-therapy exercises, each tagged with body areas
│  │   ├─ meals.json        ~15 meals with kcal and macros
│  │   └─ specialists.json  specialist profiles and packages
│  └─ src/
│     ├─ index.js           starts the server
│     ├─ app.js             express setup and route mounting
│     ├─ db/
│     │   ├─ connection.js  opens SQLite, PRAGMA foreign_keys = ON, WAL mode
│     │   ├─ schema.sql     copy of schema.sql from this spec
│     │   ├─ seed.js        fills the database with demo data
│     │   └─ reset.js       deletes the db file, applies schema, runs seed
│     ├─ middleware/        auth.js, requireRole.js, validate.js, errorHandler.js
│     ├─ routes/            auth.js, profile.js, specialists.js, bookings.js, plans.js,
│     │                     progress.js, dashboard.js, ai.js, checkout.js,
│     │                     specialistPortal.js, admin.js
│     └─ services/          aiPlanner.js, planFallback.js
└─ package.json             root scripts: "dev" (client + server together), "db:reset"
```

Environment variables (`server/.env.example`):
```
PORT=4000
JWT_SECRET=change-me
CLIENT_ORIGIN=http://localhost:5173
AI_PROVIDER=            # e.g. gemini | anthropic | openai (empty = always use fallback)
AI_API_KEY=
AI_MODEL=
```

---

## 3. Conventions

- Base path `/api`. JSON only.
- Success: `{ "data": ... }`. Error: `{ "error": { "code": "SLOT_TAKEN", "message": "Plain English message", "fields": { "email": "Already in use" } } }` (`fields` only for validation errors).
- Status codes: 200, 201, 400 (validation), 401 (not logged in), 403 (wrong role or not yours), 404, 409 (conflict, e.g. slot taken or email exists), 500.
- JSON keys are `camelCase`; database columns are `snake_case`. Convert in one small helper.
- Auth: JWT (HS256, 7 days) in `Authorization: Bearer <token>`, payload `{ sub: userId, role }`. Passwords hashed with bcrypt (cost 10). Never return `password_hash`.
- Validate every request body and query with `zod`; return the `fields` map on failure.
- Ownership: clients see only their own data. A specialist sees only clients in `care_team` with them. Admin sees everything.
- CORS: allow only `CLIENT_ORIGIN`.
- Dates: store and return ISO UTC. The front end formats in `Africa/Cairo`.
- List endpoints return at most 100 rows. No pagination needed.
- A `GET /api/health` endpoint returns `{ "data": { "status": "ok" } }`.

---

## 4. Database

Use `schema.sql` exactly as provided (15 tables). Notes:

- Run `PRAGMA foreign_keys = ON` and `PRAGMA journal_mode = WAL` when opening the connection.
- The partial unique indexes are important: `idx_bookings_active_slot` prevents double booking, and `idx_plans_one_active` guarantees one active plan per client per service.
- Map specialist type to service: `trainer` → `move`, `nutritionist` → `eat`, `physical_therapist` → `recover`.
- If you believe the schema needs a change, explain why in your phase report and wait for approval.

---

## 5. API contract

Priority: **P0** = needed for the demo, **P1** = should have, **P2** = only if time remains.

### Auth
| Method | Path | Who | P | Notes |
|---|---|---|---|---|
| POST | `/api/auth/register` | public | P0 | `{ name, email, password, role? }`. Role defaults to `client`. A `specialist` signup also takes `{ type, credentials }` and starts as `pending`. Returns token and user. |
| POST | `/api/auth/login` | public | P0 | `{ email, password }` → `{ token, user }`. |
| GET | `/api/auth/me` | any | P0 | User plus `onboardingCompleted` (clients) or `approvalStatus` (specialists). |

### Profile and onboarding (client)
| Method | Path | Who | P | Notes |
|---|---|---|---|---|
| GET | `/api/profile` | client | P0 | Profile plus injuries. |
| PUT | `/api/profile` | client | P0 | Partial update, so each onboarding step can save on its own. May include `injuries: [{ bodyArea, painLevel, duration, doctorSeen, note }]`, which **replaces** the list. |
| POST | `/api/profile/complete` | client | P0 | Sets `onboarding_completed = 1` and `plan_start_date` to today if empty. |

### Specialists
| Method | Path | Who | P | Notes |
|---|---|---|---|---|
| GET | `/api/specialists` | any | P0 | `?type=&q=&sort=rate\|experience\|soonest`. Approved only. Each row includes `nextAvailable`. |
| GET | `/api/specialists/:id` | any | P0 | Profile and packages. |
| GET | `/api/specialists/:id/slots` | any | P0 | `?from=&to=` (dates). Open future slots only. |

### Bookings
| Method | Path | Who | P | Notes |
|---|---|---|---|---|
| POST | `/api/bookings` | client | P0 | `{ specialistId, slotId, sessionType, packageId? }`. See booking rules. |
| GET | `/api/bookings` | client | P0 | `?tab=upcoming\|past`. Includes specialist summary. |
| PATCH | `/api/bookings/:id/cancel` | client | P0 | See booking rules. |
| PATCH | `/api/bookings/:id/reschedule` | client | P1 | `{ slotId }`. Cancel + rebook in one transaction. |
| GET | `/api/bookings/:id/session` | client, specialist | P2 | Mock: `{ startsAt, specialist, sharedNotes }`, no real video. |

### Today, plans, progress
| Method | Path | Who | P | Notes |
|---|---|---|---|---|
| GET | `/api/dashboard/today` | client | P0 | Shape below. |
| GET | `/api/plans` | client | P0 | `?service=move\|eat\|recover` → the active plan with `author`, `updatedAt`, `summary` and `days: [{ dayOfWeek, items: [...] }]`. Without `service`, return all three. |
| PUT | `/api/completions` | client | P0 | `{ planItemId, date, status: "done" \| "skipped" \| "pending" }`. `pending` removes the row. Item must belong to the client's active plan. |
| GET | `/api/progress` | client | P0 | `?range=4w\|8w\|all` → `{ weight: [{date, value}], workoutsPerWeek: [{weekStart, count}], pain: [{date, value}], safeLimit }`. |
| PUT | `/api/progress` | client | P0 | `{ date?, weightKg?, workoutDone?, painLevel?, note? }`. Upsert by date (default today). |

`GET /api/dashboard/today` response:
```json
{ "data": {
  "date": "2026-10-13",
  "weekOfProgram": { "current": 3, "total": 8 },
  "summary": { "workoutsThisWeek": 3, "workoutsTarget": 4, "streakDays": 5, "latestPain": 3 },
  "plan": [
    { "itemId": 12, "service": "move", "time": "18:00", "title": "Lower body", "meta": "45 min", "status": "pending" }
  ],
  "nextSession": { "bookingId": 7, "startsAt": "2026-10-15T16:30:00Z", "specialist": { "id": 5, "name": "Dr. Mona Fathy", "type": "physical_therapist" } },
  "latestNote": { "from": "Dr. Mona Fathy", "body": "...", "createdAt": "..." }
} }
```
`status` is `pending`, `done` or `skipped` for that date. `meta` is built from the item (duration, or kcal for meals).

### AI plan
| Method | Path | Who | P | Notes |
|---|---|---|---|---|
| POST | `/api/ai/plan` | client | P1 | `{ goal, daysPerWeek, injuries: [{ bodyArea, painLevel }], equipment, diet }` → `{ requestId, source: "ai" \| "fallback", draft }`. |
| POST | `/api/ai/plan/:id/send` | client | P1 | Turns the draft into three `plans` rows with `source='ai'`, `status='draft'` for specialists to review. Marks the request `sent`. |

### Checkout (mock)
| Method | Path | Who | P | Notes |
|---|---|---|---|---|
| POST | `/api/checkout` | client | P1 | `{ planName, method }`. The price comes from a server-side constant (Starter 399, Plus 899, Full Team 1499), never from the client. Inserts a `subscriptions` row with a fake reference like `DEMO-8F2K41`. |

### Specialist portal
| Method | Path | Who | P | Notes |
|---|---|---|---|---|
| GET | `/api/specialist/clients` | specialist | P1 | Search `?q=`. Each row: goal, week of program, latest pain, pain trend, last check-in, `flagged`. |
| GET | `/api/specialist/clients/:clientId` | specialist | P1 | Profile, injuries, plans (all statuses, including AI drafts), progress, notes. |
| PUT | `/api/specialist/clients/:clientId/plans/:service` | specialist | P1 | Replaces the items of the plan for that service and sets `status` (`draft` or `active`). A specialist may only edit the service matching their type. Activating archives the previous active plan in the same transaction. |
| POST | `/api/specialist/clients/:clientId/notes` | specialist | P2 | `{ body, visibleToClient }`. |
| GET | `/api/specialist/schedule` | specialist | P1 | `?from=&to=` → slots with booking and client info. |

### Admin
| Method | Path | Who | P | Notes |
|---|---|---|---|---|
| GET | `/api/admin/overview` | admin | P1 | Counts: users, active plans, bookings this week, approved specialists, plus the 10 most recent activities. |
| GET | `/api/admin/users` | admin | P2 | `?q=&role=`. |
| GET | `/api/admin/specialists` | admin | P1 | `?status=pending`. |
| PATCH | `/api/admin/specialists/:id/approval` | admin | P1 | `{ status: "approved" \| "rejected" }`. |

---

## 6. Business rules (defaults chosen by the developer; adjust if the team decides otherwise)

**Booking**
- Create in one transaction: the slot exists, is not booked, starts in the future, and belongs to an **approved** specialist; the price comes from the package or the specialist's rate; insert the booking, set `is_booked = 1`, and insert into `care_team` if missing. If the slot is taken, return `409 SLOT_TAKEN`.
- Cancel: only the owner, only `confirmed` bookings, and only **at least 12 hours before** the start. Set `status='cancelled'`, `cancelled_at`, and free the slot. Otherwise `409 TOO_LATE_TO_CANCEL`.

**Dashboard maths**
- Week of program: `floor((today - plan_start_date) / 7) + 1`, out of `program_weeks`.
- Workouts this week: distinct days in the current Monday to Sunday week with a `done` completion on a `move` item. The target is `days_per_week`.
- Streak: consecutive days up to today with at least one `done` completion.

**Safety flag**
- A client is `flagged` for the specialist when the latest `pain_level` is above the lowest `pain_limit` among their active plan items (default 4 if none set).
- `safeLimit` in `/api/progress` uses the same value.

**Plans**
- A specialist edits only the plan for their own service type, and only for clients in their `care_team`.
- A client may read only their own plans. AI drafts are visible to the client but are clearly marked as drafts.

---

## 7. AI planner

File: `services/aiPlanner.js`, with `services/planFallback.js` as the safety net.

1. Build a prompt from the request and the client's injuries. Ask the model for **JSON only**, in this shape: `{ summary, move: [{ dayOfWeek, title, sets, reps, tempo, restSec, durationMin, painLimit, safetyNote }], eat: [{ dayOfWeek, mealType, title, kcal, proteinG, carbsG, fatG }], recover: [...] }`.
2. Validate the model's answer with `zod`. If the provider is missing, the call fails, times out (10 seconds), or the JSON is invalid, **use the fallback**.
3. **Fallback**: a deterministic plan built from `seed-content/*.json`, filtered to exclude exercises whose `avoidFor` list contains one of the client's injury areas. The demo must work with no API key and no internet.
4. **Guardrails enforced in code, not only in the prompt:**
   - Never diagnose. Every draft carries the disclaimer "AI draft. Your specialist reviews it before it becomes your plan."
   - If any injury has pain level 7 or higher, the draft is recovery-focused only, and `needsReview: true` is set.
   - Enforce a daily calorie floor of 1,400 kcal (value to be confirmed with the project's nutritionist, kept in one constant) regardless of what the model returns.
   - Respect allergies and disliked foods from the profile when picking meals.
5. Keep the provider behind one function, `generatePlan(input)`, so the provider can be swapped by changing environment variables.
6. The API key lives only on the server. Never send it to the browser.
7. Save every request and result in `ai_plan_requests`.

---

## 8. Phases

Stop and report at the end of each phase.

**Phase 0: Inspect (no code).** Report: repo layout and framework versions; the list of routes/screens; every place the UI uses hard-coded data; a **screen → endpoint map**; any field the UI shows that the schema lacks (or the reverse); the exact folder structure you propose; and a task list. Wait for approval.

**Phase 1: Scaffold, database, seed.** Server skeleton, `connection.js`, `schema.sql`, `reset.js`, `seed.js`, the seed-content JSON files, `/api/health`, root `npm run dev` (client and server together) and `npm run db:reset`.
*Done when:* `npm run db:reset` creates the database with the seed data, and `/api/health` answers.

**Phase 2: Auth, profile, onboarding (P0).** Register, login, me, auth and role middleware, profile endpoints.
*Done when:* demo users can log in, a wrong password returns 401, a client cannot call a specialist endpoint (403), and onboarding data saves per step.

**Phase 3: Specialists, slots, bookings (P0, then P1).**
*Done when:* two simultaneous bookings of the same slot result in exactly one success; cancel frees the slot; the 12-hour rule works.

**Phase 4: Plans, today, completions, progress (P0).**
*Done when:* `/api/dashboard/today` for Sara matches the shape and numbers in section 5, and checking an item off changes the summary.

**Phase 5: AI planner (P1).**
*Done when:* it returns a valid draft with a real key, and also with the key removed (fallback). Injury-aware filtering is demonstrated with the knee case.

**Phase 6: Specialist portal, admin, checkout and session mocks (P1/P2).**
*Done when:* Dr. Mona can see flagged clients and activate a plan, and admin can approve the pending specialist.

**Phase 7: Connect the front end.** Add a small `client/src/api/` layer (fetch wrapper with base URL from `VITE_API_URL`, attaches the token, handles 401 by redirecting to login). Connect screens in this order: login and sign up, onboarding, specialists, booking and bookings, Today, My plan, Progress, AI plan, checkout, specialist portal, admin. Guard routes by role. Make the "Demo role" switcher log in as the demo accounts, only when `VITE_DEMO_MODE=true`. Wire the existing loading, empty and error states to real API states.
*Done when:* every screen works against the real API with the UI unchanged.

**Phase 8: QA and handover.** Complete `api.http`, a manual test checklist per screen, a `README.md` written for beginners (install, run, reset the demo data, demo accounts), and a short architecture explainer for the students.

---

## 9. Seed data

All demo passwords are `demo1234`. Slots are generated **relative to today** (next 14 days, Saturday to Thursday, 3 to 4 slots per day), so `db:reset` always gives a fresh demo.

| Email | Role | Notes |
|---|---|---|
| sara@demo.com | client | Sara Hassan, 26. Goal: lose fat; knee pain 3/10 for weeks, doctor seen. Program week 3 of 8 (`plan_start_date` = today minus 14 days), 4 days/week. Active plans for all three services. About 21 days of progress logs (weight drifting down, pain trending from 6 to 3). Completions for the last 5 days. One upcoming booking with Dr. Mona; two past bookings; one visible note from Dr. Mona. |
| omar@demo.com | client | Omar Khaled. Onboarding **not** completed, no plans, no bookings (for testing onboarding and empty states). |
| karim@demo.com | trainer | Coach Karim Adel. Approved. |
| hana@demo.com | nutritionist | Hana Ibrahim RD. Approved. |
| mona@demo.com | physical therapist | Dr. Mona Fathy PT. Approved. |
| (3 more) | specialists | One more trainer, one more nutritionist, one more physical therapist, all approved. |
| (1 more) | specialist | One physical therapist with `approval_status = 'pending'` (for the admin approval screen). |
| admin@demo.com | admin | |

Sara's plans must show the integration idea: the PT caps squat depth and marks knee-safe exercises with `pt_cleared`, the trainer's plan swaps a movement to match, and the nutritionist's plan raises protein for recovery. Each plan's `summary` carries one sentence about that.

Content lives in `seed-content/*.json`, in plain language, so non-developers can edit it. Each recovery exercise and strength exercise has an `avoidFor` array of body areas (for example `["knee"]`), which the AI fallback uses.

---

## 10. Out of scope (do not build)

Real payments, real video calls, real-time chat, email or SMS, file uploads, deployment, Docker, TypeScript, ORMs, refresh tokens, password reset, translations.
