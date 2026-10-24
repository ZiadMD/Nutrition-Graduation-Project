-- =====================================================================
-- Rebound database schema (SQLite) — with Phase 0 approved additions:
--   client_profiles : phone
--   specialists     : focus_tags, photo_url, city
--   bookings        : notes
--   users           : last_active_at
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- Organizations (B2B)
-- ---------------------------------------------------------------------
CREATE TABLE organizations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  type        TEXT    NOT NULL CHECK (type IN ('company', 'university', 'gym', 'other')),
  logo_url    TEXT,
  invite_code TEXT    NOT NULL UNIQUE,
  seat_limit  INTEGER NOT NULL CHECK (seat_limit >= 1),
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ---------------------------------------------------------------------
-- Users and roles
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  email           TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash   TEXT    NOT NULL,
  role            TEXT    NOT NULL CHECK (role IN ('client', 'specialist', 'admin', 'org_admin', 'finance')),
  organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  status          TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  last_active_at  TEXT,                 -- updated on every authenticated request
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Onboarding answers for clients (one row per client)
CREATE TABLE client_profiles (
  user_id              INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  goal                 TEXT CHECK (goal IN ('lose_fat', 'build_muscle', 'recover_injury', 'stay_healthy')),
  days_per_week        INTEGER CHECK (days_per_week BETWEEN 1 AND 7),
  age                  INTEGER CHECK (age BETWEEN 16 AND 100),
  height_cm            REAL,
  weight_kg            REAL,
  activity_level       TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active')),
  diet_style           TEXT,                 -- e.g. 'no_preference', 'vegetarian', 'high_protein'
  allergies            TEXT,                 -- comma-separated, e.g. 'peanuts,shellfish'
  meals_per_day        INTEGER CHECK (meals_per_day BETWEEN 1 AND 8),
  disliked_foods       TEXT,
  phone                TEXT,                 -- stored in profile so specialists can contact the client
  plan_start_date      TEXT,                 -- 'YYYY-MM-DD', used to compute "week 3 of 8"
  program_weeks        INTEGER NOT NULL DEFAULT 8,
  onboarding_completed INTEGER NOT NULL DEFAULT 0 CHECK (onboarding_completed IN (0, 1)),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Pain / injury areas chosen in onboarding (one row per body area)
CREATE TABLE injuries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body_area   TEXT NOT NULL CHECK (body_area IN
                ('neck', 'shoulder', 'upper_back', 'lower_back', 'elbow_wrist', 'hip', 'knee', 'ankle_foot')),
  pain_level  INTEGER NOT NULL CHECK (pain_level BETWEEN 0 AND 10),
  duration    TEXT CHECK (duration IN ('days', 'weeks', 'months', 'years')),
  doctor_seen INTEGER NOT NULL DEFAULT 0 CHECK (doctor_seen IN (0, 1)),
  note        TEXT,
  UNIQUE (client_id, body_area)
);

-- ---------------------------------------------------------------------
-- Specialists
-- ---------------------------------------------------------------------
CREATE TABLE specialists (
  user_id            INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  organization_id    INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  type               TEXT NOT NULL CHECK (type IN ('trainer', 'nutritionist', 'physical_therapist')),
  credentials        TEXT NOT NULL,          -- e.g. 'Licensed physical therapist, MSc Sports Rehab'
  bio                TEXT,
  focus_tags         TEXT,                   -- comma-separated focus areas, e.g. 'Strength,Fat loss'
  photo_url          TEXT,                   -- Unsplash URL for the demo
  city               TEXT,                   -- city shown on admin approvals screen
  years_experience   INTEGER NOT NULL DEFAULT 0,
  languages          TEXT NOT NULL DEFAULT 'Arabic,English',
  rate_egp           INTEGER NOT NULL CHECK (rate_egp >= 0),   -- price per session
  sessions_completed INTEGER NOT NULL DEFAULT 0,
  approval_status    TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  credential_doc     TEXT,                   -- file name only (demo, no real upload)
  national_id        TEXT,                   -- Egyptian National ID or Passport Number
  syndicate_id       TEXT,                   -- Medical / Syndicate practice license registration ID
  documents          TEXT                    -- JSON array of legal paper attachments
);

CREATE TABLE specialist_packages (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  specialist_id  INTEGER NOT NULL REFERENCES specialists(user_id) ON DELETE CASCADE,
  name           TEXT NOT NULL,              -- e.g. '4-session rehab block'
  description    TEXT,
  sessions_count INTEGER NOT NULL CHECK (sessions_count >= 1),
  price_egp      INTEGER NOT NULL CHECK (price_egp >= 0)
);

-- Bookable time slots (generated by the seed script for the next 14 days)
CREATE TABLE availability_slots (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  specialist_id INTEGER NOT NULL REFERENCES specialists(user_id) ON DELETE CASCADE,
  starts_at     TEXT NOT NULL,
  ends_at       TEXT NOT NULL,
  is_booked     INTEGER NOT NULL DEFAULT 0 CHECK (is_booked IN (0, 1)),
  UNIQUE (specialist_id, starts_at)
);

-- Which specialists work with which client (assignments linking a member to a specialist)
CREATE TABLE care_team (
  client_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  specialist_id INTEGER NOT NULL REFERENCES specialists(user_id) ON DELETE CASCADE,
  status        TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ended_at      TEXT,
  PRIMARY KEY (client_id, specialist_id)
);

-- ---------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------
CREATE TABLE bookings (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  specialist_id INTEGER NOT NULL REFERENCES specialists(user_id),
  slot_id       INTEGER NOT NULL REFERENCES availability_slots(id),
  package_id    INTEGER REFERENCES specialist_packages(id),
  session_type  TEXT NOT NULL CHECK (session_type IN ('video', 'chat')),
  status        TEXT NOT NULL DEFAULT 'confirmed'
                CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  price_egp     INTEGER NOT NULL CHECK (price_egp >= 0),
  notes         TEXT,                        -- short topic/description visible to client and specialist
  cancelled_at  TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- A slot can have only ONE active booking (cancelled bookings don't count).
CREATE UNIQUE INDEX idx_bookings_active_slot
  ON bookings (slot_id) WHERE status IN ('pending', 'confirmed');

-- ---------------------------------------------------------------------
-- Plans (one active plan per client per service)
-- ---------------------------------------------------------------------
CREATE TABLE plans (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service    TEXT NOT NULL CHECK (service IN ('move', 'eat', 'recover')),
  author_id  INTEGER REFERENCES users(id),   -- the specialist; NULL for an AI draft not yet reviewed
  source     TEXT NOT NULL DEFAULT 'specialist' CHECK (source IN ('specialist', 'ai')),
  status     TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  title      TEXT NOT NULL,
  summary    TEXT,                           -- the "how this fits together" sentence for this service
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE UNIQUE INDEX idx_plans_one_active
  ON plans (client_id, service) WHERE status = 'active';

-- One row per exercise (move / recover) or per meal (eat)
CREATE TABLE plan_items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id        INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  day_of_week    INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),   -- 1 = Monday
  position       INTEGER NOT NULL DEFAULT 0,                              -- order inside the day
  time_of_day    TEXT,                                                    -- 'HH:MM'
  title          TEXT NOT NULL,
  instructions   TEXT,

  -- move / recover
  sets           INTEGER,
  reps           TEXT,                       -- text so it can be '8-10' or '30 sec'
  tempo          TEXT,                       -- e.g. '3-1-1'
  rest_sec       INTEGER,
  duration_min   INTEGER,
  pain_limit     INTEGER CHECK (pain_limit BETWEEN 0 AND 10),             -- "stop if pain goes above N"
  pt_cleared     INTEGER NOT NULL DEFAULT 0 CHECK (pt_cleared IN (0, 1)), -- shows the "Knee-safe" badge
  safety_note    TEXT,

  -- eat
  meal_type      TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  kcal           INTEGER,
  protein_g      INTEGER,
  carbs_g        INTEGER,
  fat_g          INTEGER
);

-- The client's check-offs on the Today screen
CREATE TABLE item_completions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_item_id INTEGER NOT NULL REFERENCES plan_items(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,                -- 'YYYY-MM-DD'
  status       TEXT NOT NULL CHECK (status IN ('done', 'skipped')),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE (client_id, plan_item_id, date)
);

-- ---------------------------------------------------------------------
-- Progress, notes, AI, checkout
-- ---------------------------------------------------------------------
CREATE TABLE progress_logs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,                -- 'YYYY-MM-DD'
  weight_kg    REAL,
  workout_done INTEGER NOT NULL DEFAULT 0 CHECK (workout_done IN (0, 1)),
  pain_level   INTEGER CHECK (pain_level BETWEEN 0 AND 10),
  note         TEXT,
  UNIQUE (client_id, date)
);

-- Notes written by specialists about a client
CREATE TABLE notes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_id         INTEGER NOT NULL REFERENCES users(id),
  body              TEXT NOT NULL,
  visible_to_client INTEGER NOT NULL DEFAULT 1 CHECK (visible_to_client IN (0, 1)),
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Every AI plan the client generates (input, output, and what happened to it)
CREATE TABLE ai_plan_requests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  input_json  TEXT NOT NULL,
  output_json TEXT,
  provider    TEXT,                          -- which model answered, or 'fallback'
  status      TEXT NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'sent', 'failed')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Mock checkout: records a "paid" or "sponsored" subscription. No real payment is processed.
CREATE TABLE subscriptions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_name  TEXT NOT NULL,                  -- 'Starter' | 'Plus' | 'Full Team' | 'Sponsored'
  price_egp  INTEGER NOT NULL,
  method     TEXT NOT NULL CHECK (method IN ('card', 'fawry', 'vodafone_cash', 'instapay')),
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  source     TEXT NOT NULL DEFAULT 'self' CHECK (source IN ('self', 'organization')),
  reference  TEXT NOT NULL,                  -- fake reference like 'DEMO-8F2K41' or 'ORG-APEX2026-...'
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Specialist Payouts (disbursements for completed sessions and commissions)
CREATE TABLE payouts (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  specialist_id    INTEGER NOT NULL REFERENCES specialists(user_id) ON DELETE CASCADE,
  amount_egp       INTEGER NOT NULL CHECK (amount_egp >= 0),
  platform_cut_egp INTEGER NOT NULL DEFAULT 0 CHECK (platform_cut_egp >= 0),
  net_payout_egp   INTEGER NOT NULL CHECK (net_payout_egp >= 0),
  period_start     TEXT NOT NULL,
  period_end       TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  reference        TEXT,
  paid_at          TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Specialist Ratings & Reviews
CREATE TABLE specialist_reviews (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  specialist_id INTEGER NOT NULL REFERENCES specialists(user_id) ON DELETE CASCADE,
  client_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE (specialist_id, client_id)
);

-- Support Tickets and Incident Reports
CREATE TABLE support_tickets (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_number   TEXT NOT NULL UNIQUE,
  reporter_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category        TEXT NOT NULL CHECK (category IN (
                    'session_dispute',
                    'specialist_conduct',
                    'client_conduct',
                    'billing_refund',
                    'technical_issue',
                    'general_inquiry'
                  )),
  priority        TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  subject         TEXT NOT NULL,
  description     TEXT NOT NULL,
  booking_id      INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  target_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_to     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolution_note TEXT,
  resolved_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Message Thread for Each Support Ticket
CREATE TABLE ticket_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id   INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  is_internal INTEGER NOT NULL DEFAULT 0 CHECK (is_internal IN (0, 1)),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ---------------------------------------------------------------------
-- Indexes for the queries the screens run most
-- ---------------------------------------------------------------------
CREATE INDEX idx_injuries_client          ON injuries (client_id);
CREATE INDEX idx_slots_specialist_time    ON availability_slots (specialist_id, starts_at);
CREATE INDEX idx_bookings_client          ON bookings (client_id, status);
CREATE INDEX idx_bookings_specialist      ON bookings (specialist_id, status);
CREATE INDEX idx_plans_client             ON plans (client_id, service, status);
CREATE INDEX idx_items_plan_day           ON plan_items (plan_id, day_of_week, position);
CREATE INDEX idx_completions_client_date  ON item_completions (client_id, date);
CREATE INDEX idx_progress_client_date     ON progress_logs (client_id, date);
CREATE INDEX idx_notes_client             ON notes (client_id, created_at);
CREATE INDEX idx_payouts_specialist       ON payouts (specialist_id, status);
CREATE INDEX idx_reviews_specialist       ON specialist_reviews (specialist_id, rating);
CREATE INDEX idx_reviews_client           ON specialist_reviews (client_id);
CREATE INDEX idx_tickets_reporter         ON support_tickets (reporter_id, status);
CREATE INDEX idx_tickets_status           ON support_tickets (status, priority);
CREATE INDEX idx_tickets_category         ON support_tickets (category);
CREATE INDEX idx_messages_ticket          ON ticket_messages (ticket_id, created_at);
CREATE INDEX idx_care_team_active         ON care_team (client_id, specialist_id) WHERE status = 'active';
CREATE INDEX idx_care_team_specialist     ON care_team (specialist_id, status);
CREATE INDEX idx_users_org                ON users (organization_id);
CREATE INDEX idx_specialists_org          ON specialists (organization_id);

