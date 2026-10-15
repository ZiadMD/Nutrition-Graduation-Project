# 🌿 Rebound — Integrated Health, Rehab & Nutrition Platform

Welcome to **Rebound**, a multi-disciplinary health and wellness platform that coordinates **Physical Therapy**, **Strength Training**, and **Clinical Nutrition** around an individual client's injuries and goals.

---

## 📖 Table of Contents
1. [Tech Stack](#-tech-stack)
2. [Quick Start for Beginners](#-quick-start-for-beginners)
3. [Demo Accounts & Role Switcher](#-demo-accounts--role-switcher)
4. [Project Structure](#-project-structure)
5. [Architecture Explainer for Students](#-architecture-explainer-for-students)
6. [API & Manual Testing](#-api--manual-testing)
7. [Scripts Reference](#-scripts-reference)

---

## 🛠 Tech Stack

### Frontend
- **Framework:** React 19 + TypeScript
- **Styling:** Tailwind CSS v4
- **Icons:** Lucide React
- **Build Tool:** Vite 8

### Backend
- **Runtime:** Node.js (ES modules: `"type": "module"`)
- **Web Framework:** Express 4
- **Database:** SQLite 3 via `better-sqlite3` (WAL mode enabled for concurrent reads & writes)
- **Validation:** Zod schemas for all request payloads
- **Security:** JWT (JSON Web Tokens) + `bcryptjs` password hashing + CORS protection
- **AI Integration:** Google Gemini API with automatic, deterministic clinical fallback

---

## 🚀 Quick Start for Beginners

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (version 18 or higher).

### 2. Install Dependencies
Open your terminal in the project root directory and run:
```bash
npm install
```
*(Dependencies for both frontend and backend will be installed).*

### 3. Environment Configuration
The repository includes pre-configured environment files:
- Root `.env`:
  ```env
  VITE_API_URL=http://localhost:4000/api
  VITE_DEMO_MODE=true
  ```
- Backend `server/.env`:
  ```env
  PORT=4000
  JWT_SECRET=rebound-super-secret-dev-key
  CLIENT_ORIGIN=http://localhost:8443
  # Optional: Add Google Gemini API key for live AI generation
  # AI_API_KEY=your_key_here
  # AI_MODEL=gemini-1.5-flash
  ```

### 4. Initialize / Reset the Database
Seed the SQLite database with rich demo data:
```bash
npm run db:reset
```
*You can run this anytime to restore a clean demo state.*

### 5. Start the Application
Run both frontend and backend concurrently with a single command:
```bash
npm run dev
```
- **Frontend:** [http://localhost:8443](http://localhost:8443) (or your Vite local port)
- **Backend API:** [http://localhost:4000/api](http://localhost:4000/api)
- **Health Check:** [http://localhost:4000/api/health](http://localhost:4000/api/health)

---

## 👥 Demo Accounts & Role Switcher

All demo accounts share the password: **`demo1234`**

| Email | Role | Name | Notes / Test Purpose |
|---|---|---|---|
| `sara@demo.com` | **Client** | Sara Hassan | Full data (Week 3 of 8). Knee pain 3/10. Active rehab, workout, and nutrition plans, progress history, upcoming booking. |
| `omar@demo.com` | **Client** | Omar Khaled | Uncompleted onboarding. Great for testing the step-by-step onboarding flow. |
| `karim@demo.com` | **Specialist** | Coach Karim Adel | Certified Strength Coach (Approved). |
| `hana@demo.com` | **Specialist** | Hana Ibrahim, RD | Clinical Dietitian (Approved). |
| `mona@demo.com` | **Specialist** | Dr. Mona Fathy, PT | Physical Therapist (Approved). Assigned to Sara's care team. |
| `yasmin@demo.com`| **Specialist** | Dr. Yasmin Farouk | Physical Therapist with `pending` approval status (for Admin approval testing). |
| `admin@demo.com` | **Admin** | Admin Team | Full platform metrics, user status management, specialist approvals, user creation. |
| `finance@demo.com` | **Finance** | Tamer Fahmy | Dedicated Financial Dashboard, transaction ledger, specialist payouts settlement, and MRR metrics. |

> 💡 **Role Switcher in Header:** When `VITE_DEMO_MODE=true`, you can use the dropdown in the top navigation bar to switch between Sara, Dr. Mona, and the Admin instantly without re-typing credentials.

---

## 📁 Project Structure

```
.
├── src/                          # React Frontend
│   ├── api/                      # Strongly-typed API client (client.ts, auth.ts, etc.)
│   ├── components/               # UI components, navigation, layouts
│   ├── context/                  # React Contexts (AuthContext, DemoRoleContext)
│   ├── pages/                    # 11 Application Screens
│   │   ├── client/               # Today, Plan, Progress, Booking, Specialists, AiPlan
│   │   ├── specialist/           # Specialist Portal (Clients, Dossier, Notes, Schedule)
│   │   ├── admin/                # Admin Portal (Overview, Users, Approvals)
│   │   ├── Auth.tsx              # Sign In & Registration
│   │   └── Onboarding.tsx        # 4-step Client Questionnaire
│   └── main.tsx                  # Vite React entry point
│
├── server/                       # Express + SQLite Backend
│   ├── data/                     # SQLite database file (rebound.db)
│   ├── seed-content/             # Plain JSON content (exercises, meals, rehab protocols)
│   ├── src/
│   │   ├── db/                   # Schema, connection, seed scripts, reset logic
│   │   ├── middleware/           # auth, requireRole, validation, errorHandler
│   │   ├── routes/               # API route modules (auth, profile, specialists, bookings, etc.)
│   │   ├── services/             # AI planner & deterministic fallback generator
│   │   └── app.js                # Express app configuration
│   └── api.http                  # VS Code REST Client test requests
│
├── api.http                      # Root copy of REST test requests
├── TEST_CHECKLIST.md             # Complete manual testing checklist per screen
├── BACKEND_SPEC.md               # Technical specification & requirements
└── package.json                  # Scripts & dependencies
```

---

## 🎓 Architecture Explainer for Students

### 1. Multi-Disciplinary Integration Design
In ordinary fitness apps, workouts, meals, and physical therapy are siloed. Rebound's core architectural principle is **clinical synchronization**:
- When **Dr. Mona (PT)** flags a client's knee pain and sets a pain threshold (`<= 4/10`), the knee rehab protocol marks safe movements as `pt_cleared = true`.
- **Coach Karim (Trainer)** can view this clinical clearance in the client's dossier and substitute deep squats for box squats.
- **Hana (Dietitian)** raises protein intake to promote connective tissue repair.
- The client's **Today Dashboard** aggregates all three disciplines into one cohesive daily schedule.

### 2. High-Performance SQLite with WAL Mode
Instead of requiring an external database server like PostgreSQL or MySQL, Rebound uses `better-sqlite3`:
- Runs in-process with **zero network latency**.
- Uses **WAL Mode (Write-Ahead Logging)**: Readers do not block writers, and writers do not block readers.
- Transactions are synchronous and acid-compliant, executing in single-digit microseconds.

### 3. Atomic Slot Locking & Race Protection
When booking appointments:
- If two clients click "Book" on the exact same specialist slot simultaneously, SQLite transactions run an atomic check:
  ```sql
  UPDATE availability_slots SET is_booked = 1 WHERE id = ? AND is_booked = 0
  ```
- If rows modified equals 0, the backend immediately throws a `409 SLOT_TAKEN` error. Only one client can ever claim the slot.

### 4. 12-Hour Cancellation Business Rule
To respect specialists' professional schedules:
- When a client cancels an appointment, the backend computes:
  ```javascript
  const hoursUntil = (new Date(slot.starts_at) - Date.now()) / (1000 * 60 * 60);
  ```
- If `hoursUntil < 12`, the cancellation is rejected with `409 TOO_LATE_TO_CANCEL`.

### 5. Resilient AI Planner (Live Gemini + Fallback)
The AI workout and meal planner in `/api/ai/plan`:
- First checks if an `AI_API_KEY` is present to call Google Gemini.
- If no key is set or the external API is unreachable, it automatically engages the **deterministic fallback engine** in `server/src/services/planFallback.js`.
- The fallback reads from `server/seed-content/*.json` and filters out exercises tagged with `avoidFor: ["knee"]`.
- The frontend receives an identical response schema either way — zero user-facing errors.

---

## 🧪 API & Manual Testing

### Option A: VS Code REST Client (`api.http`)
Rebound includes a comprehensive `api.http` file containing **52 pre-written requests** for every endpoint:
1. Install the **REST Client** extension by *Huachao Mao* in VS Code.
2. Open `api.http` (in the project root or `server/`).
3. Click **"Send Request"** above any block to execute endpoints directly.

### Option B: Manual Testing Checklist
Refer to [`TEST_CHECKLIST.md`](./TEST_CHECKLIST.md) for step-by-step UI validation covering all 11 screens.

---

## 📜 Scripts Reference

| Command | Action |
|---|---|
| `npm run dev` | Runs both the Vite frontend and Express server concurrently. |
| `npm run db:reset` | Resets the SQLite database and re-seeds all demo data from scratch. |
| `npm run build` | Compiles TypeScript and creates an optimized production bundle in `dist/`. |
| `npm run preview` | Previews the production build locally. |
| `npm run format` | Checks code formatting via `oxfmt`. |

