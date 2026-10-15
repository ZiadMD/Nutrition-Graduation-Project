# Rebound — Manual QA Test Checklist Per Screen

This document provides a comprehensive, step-by-step manual test checklist covering all 11 screens in the Rebound application.

---

## Pre-requisites & Quick Start
1. Ensure dependencies are installed: `npm install`
2. Ensure database is freshly seeded: `npm run db:reset`
3. Start the application: `npm run dev`
4. Access the frontend in browser (default: `http://localhost:8443` or `http://localhost:5173`)
5. Backend runs at `http://localhost:4000/api`

---

## Screen 1: Auth & Role Switcher
**Route:** `/auth` & Top Header Switcher
- [ ] **Standard Login:**
  - Enter email `sara@demo.com`, password `demo1234`.
  - Click "Sign in". Verify redirection to Today dashboard (`/app/today`).
  - Verify client header with Sara Hassan profile pill.
- [ ] **Invalid Credentials:**
  - Enter `sara@demo.com`, password `wrongpassword`.
  - Verify an error toast / message indicates invalid credentials.
- [ ] **Registration Flow:**
  - Switch to "Create account".
  - Enter a new name, unique email (e.g. `alex@example.com`), and password `password123`.
  - Submit. Verify user is registered and immediately directed to Onboarding (`/onboarding`).
- [ ] **Duplicate Email Registration:**
  - Attempt to register with `sara@demo.com`.
  - Verify error indicates the email is already in use.
- [ ] **Role Switcher (Demo Mode):**
  - In the top header bar, click the Demo Role Switcher dropdown.
  - Switch to **Dr. Mona (Specialist)** (`mona@demo.com`) — verify UI shifts into the Specialist Portal navigation.
  - Switch to **Admin** (`admin@demo.com`) — verify UI shifts into the Admin Portal navigation.
  - Switch to **Omar (New Client)** (`omar@demo.com`) — verify prompt or redirect to complete onboarding.
  - Switch back to **Sara (Client)** (`sara@demo.com`).

---

## Screen 2: Client Onboarding
**Route:** `/onboarding` (Test with `omar@demo.com` or a newly registered user)
- [ ] **Step 1 — Goals:**
  - Select primary goal (e.g. "Recover from injury" or "Lose fat").
  - Select weekly commitment (e.g., "4 days per week").
  - Click "Continue".
- [ ] **Step 2 — Anthropometrics & Activity:**
  - Enter age (e.g. 27), height (175 cm), weight (78 kg).
  - Select activity level (e.g. "Lightly active").
  - Click "Continue".
- [ ] **Step 3 — Injury & Pain Screening:**
  - Select affected body area (e.g. "Knee" or "Lower back").
  - Set pain slider (e.g., 4/10).
  - Toggle doctor consultation checkbox ("Yes, doctor evaluated").
  - Click "Continue".
- [ ] **Step 4 — Nutrition Preferences:**
  - Select dietary preference (e.g., "High protein").
  - Add any allergies or disliked foods.
  - Click "Complete profile".
- [ ] **Verification:**
  - Verify user is redirected to `/app/today`.
  - Check that subsequent visits to `/app/today` keep `onboardingCompleted: true`.

---

## Screen 3: Specialists Directory & Profile
**Routes:** `/specialists`, `/specialists/:slug`
- [ ] **Specialist Filters:**
  - Click "All Specialists", "Trainers", "Nutritionists", "Physical Therapists".
  - Verify the list updates dynamically based on the active filter.
- [ ] **Specialist Card Details:**
  - Verify credentials, years of experience, city, session rate (in EGP), and focus tags display properly.
  - Verify pending specialists are **not** visible to clients (e.g. Dr. Yasmin Farouk should only appear in Admin Approvals until approved).
- [ ] **Specialist Profile Page:**
  - Click on "Dr. Mona Fathy, PT" (`/specialists/mona`).
  - Verify full bio, clinical focus tags, available consultation packages, and next open slot date.

---

## Screen 4: Booking & Appointments Management
**Routes:** `/book/:specialistSlug`, `/app/bookings`
- [ ] **Slot Selection:**
  - Navigate to book an appointment with Dr. Mona (`/book/mona`).
  - Select session type (Video consultation or In-person).
  - Pick a date and an available time slot from the calendar.
- [ ] **Confirm Booking:**
  - Enter session notes (e.g. "Knee pain evaluation after run").
  - Click "Confirm booking".
  - Verify success confirmation and immediate appearance in `/app/bookings` under Upcoming.
- [ ] **Atomic Slot Protection:**
  - Attempting to book an already-booked slot displays a conflict notification (`SLOT_TAKEN`) and prevents duplicate records.
- [ ] **Reschedule Booking:**
  - On the upcoming booking card, click "Reschedule".
  - Select another available slot. Confirm.
  - Verify the appointment updates to the new time and the old slot becomes open again.
- [ ] **12-Hour Cancellation Rule:**
  - For bookings > 12 hours away: Click "Cancel booking". Verify booking status changes to cancelled and the slot is freed.
  - For bookings < 12 hours away: Verify the system warns the client that cancellations within 12 hours are restricted.

---

## Screen 5: Today Dashboard
**Route:** `/app/today` (Logged in as Sara Hassan)
- [ ] **Integration Header:**
  - Verify program status displays (e.g., "Week 3 of 8 • Active Recovery").
  - Verify Care Team summary pills: Coach Karim (Trainer), Hana Ibrahim (Nutritionist), Dr. Mona (PT).
- [ ] **Next Session Card:**
  - Shows upcoming consultation details (specialist name, time, join session action).
- [ ] **Clinical Triage Note:**
  - Displays latest note from Dr. Mona (e.g., "Keep squat depth above 90 degrees until knee review").
- [ ] **Today's Action Items (Move / Eat / Recover):**
  - Check off a recovery item (e.g., "Quad isometric hold").
  - Verify checkbox immediately fills, progress updates, and completion persists on refresh.
  - Uncheck the item. Verify state reverts cleanly.

---

## Screen 6: My Plan (Move, Eat, Recover)
**Route:** `/app/plan`
- [ ] **Integrated Services Tabs:**
  - Switch between **Move** (Workout), **Eat** (Nutrition), and **Recover** (Physical Therapy) tabs.
- [ ] **Multi-Disciplinary Integration Verification:**
  - **Recover tab:** Notice Dr. Mona's rehab exercises with `PT-Cleared` badges and pain thresholds (`<= 4/10`).
  - **Move tab:** Notice Coach Karim's strength movements adapted around knee safety (e.g., box squats replacing deep squats).
  - **Eat tab:** Notice Hana's high-protein meal plans aligned with recovery caloric targets.
- [ ] **Weekly Schedule Grid:**
  - Inspect days 1 through 7 with planned rest days and exercise parameters (sets, reps, tempo, rest periods).

---

## Screen 7: Progress Analytics & Check-ins
**Route:** `/app/progress`
- [ ] **Trend Charts:**
  - Inspect Weight History graph (21-day downward trend from seed data).
  - Inspect Knee Pain Trend graph (improving from 6/10 down to 2/10).
  - Switch date range filter: 4 Weeks, 8 Weeks, All Time.
- [ ] **Workouts Per Week:**
  - Verify weekly frequency bar charts display consistent 4-day workouts.
- [ ] **Log New Check-in:**
  - Open "Log Today's Progress".
  - Enter today's weight (e.g. `67.0` kg), pain level (`2/10`), energy (`High`), and notes.
  - Save. Verify charts update and new log appears in history.

---

## Screen 8: AI Injury-Aware Planner
**Route:** `/app/ai-plan`
- [ ] **Input Form:**
  - Select injury area: "Knee (Patellar tendon)".
  - Set pain score: 3.
  - Select training days: 4 days/week.
  - Select equipment: Dumbbells & resistance bands.
  - Select diet: High protein.
- [ ] **Generation:**
  - Click "Generate Custom AI Plan".
  - Watch progress status.
  - Verify generated response returns complete, integrated 3-part plan (Move, Eat, Recover) with clinical safety notes.
- [ ] **Deterministic Fallback:**
  - If no `AI_API_KEY` is provided, verify the system automatically provides the deterministic clinical seed plan without error.
- [ ] **Send for Specialist Review:**
  - Click "Send Draft to Care Team for Clinical Review".
  - Verify confirmation toast appears.

---

## Screen 9: Mock Checkout & Subscriptions
**Route:** `/checkout`
- [ ] **Tier Selection:**
  - Compare Starter (399 EGP), Plus (899 EGP), and Full Team (1,499 EGP).
  - Select "Full Team".
- [ ] **Payment Methods:**
  - Choose between Credit/Debit Card, Fawry, Vodafone Cash, and InstaPay.
- [ ] **Submit Payment:**
  - Click "Pay 1,499 EGP".
  - Verify mock processing modal or redirect to `/checkout/success`.
  - Verify the client profile reflects an active `Full Team` subscription.

---

## Screen 10: Specialist Portal
**Routes:** `/specialist/clients`, `/specialist/clients/:id`, `/specialist/schedule` (Login as `mona@demo.com`)
- [ ] **Clients Triage List (`/specialist/clients`):**
  - Verify list displays clients assigned to Dr. Mona (Sara Hassan).
  - Notice triage pain alert flag: "Knee pain 3/10 • Doctor seen".
  - Search by client name ("Sara") or filter by condition.
- [ ] **Client Dossier (`/specialist/clients/1` or `/specialist/clients/sara`):**
  - View Sara's anthropometrics, injury history, active workout & meal plans.
  - View client progress logs and pain graphs.
- [ ] **Add Clinical Note:**
  - In "Specialist Notes", enter: "Client shows improved quad activation without swelling. Cleared for partial box squats."
  - Toggle "Visible to Client" = ON. Click "Add Note".
  - Verify note appears at top of note feed and shows up on Sara's Today dashboard.
- [ ] **Edit Rehab Plan:**
  - Modify sets/reps or add an exercise to Sara's Recover plan.
  - Save changes. Verify the updated plan is saved and active.
- [ ] **Specialist Schedule (`/specialist/schedule`):**
  - View weekly calendar grid with bookable slots and confirmed client sessions.

---

## Screen 11: Admin Portal
**Routes:** `/admin/overview`, `/admin/users`, `/admin/approvals` (Login as `admin@demo.com`)
- [ ] **Platform Overview (`/admin/overview`):**
  - Verify aggregate metrics: Total Users, Active Clients, Approved Specialists, Bookings This Week.
  - Verify Recent Platform Activity feed (registrations, bookings, plan updates).
- [ ] **User Management (`/admin/users`):**
  - Filter by role: All, Clients, Specialists.
  - Click "Suspend" on user (e.g. Omar Khaled). Verify status reflects "Suspended".
  - Click "Reactivate". Verify status reflects "Active".
- [ ] **Specialist Approvals (`/admin/approvals`):**
  - Verify pending specialist application for **Dr. Yasmin Farouk, PT** (Credential: MSc Orthopedic Rehab, Cairo).
  - Click "Approve Application".
  - Verify Dr. Yasmin disappears from pending approvals and is now active in the Specialists directory.

