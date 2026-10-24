# 📊 Rebound Analytics & Metric Dictionary

This document defines the mathematical models, business rules, privacy guardrails, and data sources governing all analytical calculations across the Rebound platform.

---

## 1. Timezone, Calendar & Period Conventions

### Timezone Standard
- **Timezone Assumption:** `Africa/Cairo` (UTC+2 standard; UTC+3 Daylight Saving Time).
- **Constant:** `CAIRO_OFFSET_HOURS = 2`.
- **Database Storage:**
  - Date-only columns (`item_completions.date`, `progress_logs.date`) are stored as `'YYYY-MM-DD'` and used as-is.
  - Timestamp columns (`created_at`, `updated_at`, `cancelled_at`, `resolved_at`) and `availability_slots.starts_at` are stored as ISO 8601 strings in UTC with `'Z'` (e.g. `'2026-10-15T14:30:00Z'`).
  - To determine the Cairo calendar day for an ISO timestamp, add `CAIRO_OFFSET_HOURS` (2 hours) to UTC:
    $$\text{Cairo Timestamp} = \text{UTC Timestamp} + (\text{CAIRO\_OFFSET\_HOURS} \times 3600 \text{ sec})$$
    $$\text{Date}_{\text{Cairo}} = \text{strftime}('\%Y-\%m-\%d', \text{Cairo Timestamp})$$

### Week Boundaries
- **Week Start:** `WEEK_START = 6` (Saturday). In Egypt and the MENA region, the official working week runs Saturday through Thursday (Friday off).
- Weekly buckets are labeled by the Saturday date of that week.

### Range & Comparison Semantics
- **Inclusive Whole Days:** A range `[from, to]` represents full inclusive days from `00:00:00` Cairo time on `from` to `23:59:59` Cairo time on `to`.
- **Granularity Selection:**
  - Ranges $\le 31$ days use **daily** granularity (`YYYY-MM-DD`).
  - Ranges $> 31$ days use **weekly** granularity (`YYYY-Wxx` or starting Saturday date).
- **Previous Period:** Exactly the same number of consecutive days immediately preceding the current range:
  $$\text{durationDays} = \text{to} - \text{from} + 1$$
  $$\text{previous.to} = \text{from} - 1 \text{ day}$$
  $$\text{previous.from} = \text{previous.to} - \text{durationDays} + 1$$
- **Delta & Percentage Change:**
  $$\Delta = \text{current} - \text{previous}$$
  $$\Delta\% = \begin{cases} \text{null} & \text{if } \text{previous} = 0 \\ \frac{\text{current} - \text{previous}}{\text{previous}} \times 100\% & \text{if } \text{previous} \neq 0 \end{cases}$$

### Session Date vs. Booking Creation Date
- **"Session Date" (`availability_slots.starts_at`):** Used for session-related metrics (sessions completed, sessions upcoming, attendance, session heatmap). A session that was booked in August but attended on September 5th is counted on September 5th.
- **"Booking Creation Date" (`bookings.created_at`):** Used for demand analysis (booking volume over time).
- **"Cancellation Date" (`bookings.cancelled_at`):** Used for cancellation trends.

---

## 2. Core Metric Definitions

### 1. Active Member
A client member who has initiated at least one deliberate health or training action within the target period.
- **Counted (Member-Initiated):**
  1. Completed plan items: `item_completions` with `status = 'done'` (rows with `status = 'skipped'` do NOT count as active engagement).
  2. Daily progress check-in: `progress_logs` record.
  3. Session reservation: `bookings` created by the member.
- **Excluded (Non-Member Actions):** Automated plan generation, specialist notes creation, and specialist slot creation do not count toward client activity.

### 2. Adherence Rate
Measures how consistently a client fulfills their scheduled plan items.
$$\text{Adherence Rate} = \frac{\text{Completed Plan Items on Scheduled Days}}{\text{Total Planned Items on Active Scheduled Days}}$$

#### Planned Days Window
The evaluation window for a client runs from:
$$\text{Window Start} = \max(\text{plan\_start\_date}, \text{range.from})$$
$$\text{Window End} = \min(\text{program\_end\_date}, \text{today}, \text{range.to})$$
- **Future Days Excluded:** Days in the future are never counted in the denominator.
- **Planned Items Derivation:** Derived by matching `plan_items.day_of_week` ($1 = \text{Monday}, \dots, 7 = \text{Sunday}$) against the days of the week falling in the planned days window.
- **Skipped & Missing:** Plan items marked `status = 'skipped'` or with no completion record count as planned but not done (in the denominator, but not the numerator).
- **Limitation & Versioning Note:** In the current schema, plans and `plan_items` are not versioned; editing an existing plan updates `plan_items` retroactively for historical adherence.
- **Members with No Plan:** Members without an active plan are excluded from adherence calculations.

### 3. Session Completion Rate
$$\text{Session Completion Rate} = \frac{\text{Bookings with } status = 'completed'}{\text{Bookings with } status \in ('completed', 'cancelled')}$$

### 4. Stock Metrics ("As Of" Semantics)
Stock metrics (seat utilization, specialist coverage, active client counts) are evaluated **point-in-time as of the end of the current range** and **as of the end of the previous range**:
- **Specialist Coverage (As Of Date $T$):**
  $$\text{Coverage}(T) = \frac{\text{Members with } care\_team \text{ created } \le T \text{ and } (ended\_at \text{ IS NULL or } ended\_at > T)}{\text{Total Client Members with } users.created\_at \le T}$$
- **Seat Utilization (As Of Date $T$):**
  $$\text{Seat Utilization}(T) = \frac{\text{Client members with } users.created\_at \le T \text{ and } organization\_id = org.id}{\text{organizations.seat\_limit}}$$

### 5. Member Funnel (Cohort Funnel)
Tracks the progression of members whose account was created within the range (`users.created_at BETWEEN from AND to`):
1. **Joined:** Total client accounts created within the range.
2. **Onboarded:** Members who completed onboarding (`client_profiles.onboarding_completed = 1`). *Note: `onboarding_completed` is a boolean flag without an independent timestamp.*
3. **Assigned:** Members who have ever had at least one specialist assignment (`care_team`).
4. **Active:** Members who logged at least one member-initiated action in the range.

### 6. Gross Revenue
Mirrors the financial definitions in `server/src/routes/finance.js`:
$$\text{Gross Revenue} = \sum \text{subscriptions.price\_egp} \ (\text{self-paid only}) + \sum \text{bookings.price\_egp} \ (\text{completed, self-paid})$$
- **Sponsored Slices Excluded:** Subscriptions with `source = 'organization'` (price 0) and bookings by sponsored members are strictly excluded from revenue.

### 7. Support Metrics
- **Open Support Tickets:** Tickets with `status IN ('open', 'in_progress')`.
- **Median Resolution Time:** The 50th percentile duration (in hours) between `created_at` and `resolved_at` for tickets with a non-null `resolved_at` (`status IN ('resolved', 'closed')`).

---

## 3. Privacy & Cohort Rules (`MIN_COHORT = 5`)

To protect user confidentiality, analytical outputs adhere to strict multi-tenant boundaries and k-anonymity principles:

1. **Minimum Cohort Threshold (`MIN_COHORT = 5`):**
   - Any aggregated metric computed over fewer than 5 members returns:
     ```json
     {
       "suppressed": true,
       "value": null,
       "previous": null,
       "delta": null,
       "deltaPct": null
     }
     ```
   - Applied to slices: adherence by pillar, adherence distribution bands, per-specialist client adherence, and organization engagement %.
   - **Heatmap:** The entire sessions heatmap is suppressed if fewer than 5 distinct members attended sessions in the range.
2. **Workload Exception:** Organization specialist workload counts (active clients, sessions completed) are NOT suppressed, as the organization administrator personally assigned those clients.
3. **System Admin Organizations Table:** Member and seat counts are always visible; the engagement percentage is suppressed if the organization has $< 5$ members.
4. **Zero Clinical Exposure:**
   - Org Admin and System Admin queries never select or return clinical keys:
     `goal`, `weight_kg`, `weightKg`, `pain`, `painLevel`, `injuries`, `allergies`, `note`, `notes`, `plan`, `plans`, `items`, `summary`, `bodyArea`.
   - Automated tests run a recursive forbidden-key scanner over every analytical response payload.
