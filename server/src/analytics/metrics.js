// server/src/analytics/metrics.js
// Unified analytics engine for Org Admin, System Admin, and Specialist dashboards.
// All queries run over real database tables, enforcing MIN_COHORT = 5 suppression.

import defaultDb from '../db/connection.js'
import {
  parseRange,
  isoToCairoDate,
  isoToCairoHour,
  isoToCairoDow,
  CAIRO_OFFSET_HOURS,
  WEEK_START,
} from './range.js'
import { generateBuckets, zeroFillSeries } from './buckets.js'
import { withDelta } from './compare.js'
import { MIN_COHORT, suppress, assertNoForbiddenKeys } from './privacy.js'

/**
 * Returns member user IDs matching the given scope.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object} scope - { type: 'all'|'organization'|'specialist'|'b2c'|'b2b', orgId?, specialistId? }
 * @returns {number[]}
 */
export function getScopeMemberIds(db, scope) {
  const type = scope?.type || 'all'

  if (type === 'organization') {
    if (!scope.orgId) return []
    return db
      .prepare(`SELECT id FROM users WHERE role = 'client' AND organization_id = ?`)
      .all(scope.orgId)
      .map((r) => r.id)
  }

  if (type === 'b2c') {
    return db
      .prepare(`SELECT id FROM users WHERE role = 'client' AND organization_id IS NULL`)
      .all()
      .map((r) => r.id)
  }

  if (type === 'b2b') {
    return db
      .prepare(`SELECT id FROM users WHERE role = 'client' AND organization_id IS NOT NULL`)
      .all()
      .map((r) => r.id)
  }

  if (type === 'specialist') {
    if (!scope.specialistId) return []
    return db
      .prepare(
        `SELECT client_id AS id FROM care_team WHERE specialist_id = ? AND status = 'active'`
      )
      .all(scope.specialistId)
      .map((r) => r.id)
  }

  // 'all'
  return db
    .prepare(`SELECT id FROM users WHERE role = 'client'`)
    .all()
    .map((r) => r.id)
}

/**
 * Computes active members count and timeseries for a scope in a period.
 * Active member = initiated at least one action:
 * - item_completions with status = 'done'
 * - progress_logs entry
 * - bookings created
 */
export function computeActiveMembers(db, memberIds, from, to, granularity) {
  if (!memberIds || memberIds.length === 0) {
    const buckets = generateBuckets(from, to, granularity)
    return {
      count: 0,
      series: zeroFillSeries(buckets, {}),
    }
  }

  const idPlaceholders = memberIds.map(() => '?').join(',')

  // Total unique active members in [from, to]
  const countSql = `
    SELECT COUNT(DISTINCT client_id) AS count FROM (
      SELECT client_id FROM item_completions 
      WHERE status = 'done' AND date BETWEEN ? AND ? AND client_id IN (${idPlaceholders})
      UNION
      SELECT client_id FROM progress_logs 
      WHERE date BETWEEN ? AND ? AND client_id IN (${idPlaceholders})
      UNION
      SELECT client_id FROM bookings 
      WHERE DATE(datetime(created_at, '+${CAIRO_OFFSET_HOURS} hours')) BETWEEN ? AND ? AND client_id IN (${idPlaceholders})
    )
  `
  const params = [
    from,
    to,
    ...memberIds,
    from,
    to,
    ...memberIds,
    from,
    to,
    ...memberIds,
  ]
  const count = db.prepare(countSql).get(...params)?.count ?? 0

  // Series over buckets
  const buckets = generateBuckets(from, to, granularity)
  const seriesSql = `
    SELECT act_date AS date, COUNT(DISTINCT client_id) AS value FROM (
      SELECT date AS act_date, client_id FROM item_completions 
      WHERE status = 'done' AND date BETWEEN ? AND ? AND client_id IN (${idPlaceholders})
      UNION
      SELECT date AS act_date, client_id FROM progress_logs 
      WHERE date BETWEEN ? AND ? AND client_id IN (${idPlaceholders})
      UNION
      SELECT DATE(datetime(created_at, '+${CAIRO_OFFSET_HOURS} hours')) AS act_date, client_id FROM bookings 
      WHERE DATE(datetime(created_at, '+${CAIRO_OFFSET_HOURS} hours')) BETWEEN ? AND ? AND client_id IN (${idPlaceholders})
    )
    GROUP BY act_date
  `
  const rawRows = db.prepare(seriesSql).all(...params)

  const dataMap = new Map()
  if (granularity === 'day') {
    rawRows.forEach((r) => dataMap.set(r.date, { value: r.value }))
  } else {
    // Group raw days into week buckets
    rawRows.forEach((r) => {
      const weekBucket = getWeekStart(r.date)
      const existing = dataMap.get(weekBucket)?.value ?? 0
      dataMap.set(weekBucket, { value: existing + r.value })
    })
  }

  function getWeekStart(dStr) {
    const d = new Date(dStr + 'T00:00:00Z')
    const dow = d.getUTCDay()
    const diff = (dow - WEEK_START + 7) % 7
    d.setUTCDate(d.getUTCDate() - diff)
    return d.toISOString().slice(0, 10)
  }

  return {
    count,
    series: zeroFillSeries(buckets, dataMap),
  }
}

/**
 * Computes adherence rate (completed items / planned items on scheduled days).
 *
 * Rules:
 * - Planned days run from max(plan_start_date, range.from) to min(program_end, today, range.to).
 * - Members with no active plan are excluded.
 * - Suppressed if fewer than 5 members in scope have an active plan.
 */
export function computeAdherence(db, memberIds, from, to, cairoToday) {
  if (!memberIds || memberIds.length === 0) {
    return {
      rate: null,
      cohortSize: 0,
      byPillar: { move: null, eat: null, recover: null },
      bands: { '0-25': 0, '25-50': 0, '50-75': 0, '75-100': 0 },
      suppressed: true,
    }
  }

  const idPlaceholders = memberIds.map(() => '?').join(',')

  // Fetch active plans and client profile plan dates for members in scope
  const activePlansSql = `
    SELECT 
      p.id AS plan_id,
      p.client_id,
      p.service,
      COALESCE(cp.plan_start_date, DATE(datetime(p.created_at, '+${CAIRO_OFFSET_HOURS} hours'))) AS start_date,
      COALESCE(cp.program_weeks, 8) AS program_weeks
    FROM plans p
    JOIN users u ON u.id = p.client_id
    LEFT JOIN client_profiles cp ON cp.user_id = p.client_id
    WHERE p.status = 'active' AND p.client_id IN (${idPlaceholders})
  `
  const plans = db.prepare(activePlansSql).all(...memberIds)
  const distinctClientCount = new Set(plans.map((p) => p.client_id)).size

  if (distinctClientCount < MIN_COHORT) {
    return {
      rate: null,
      cohortSize: distinctClientCount,
      byPillar: { move: null, eat: null, recover: null },
      bands: { '0-25': 0, '25-50': 0, '50-75': 0, '75-100': 0 },
      suppressed: true,
    }
  }

  // Fetch all plan items for these active plans
  const planIds = plans.map((p) => p.plan_id)
  const planIdPlaceholders = planIds.map(() => '?').join(',')
  const itemsSql = `
    SELECT id, plan_id, day_of_week
    FROM plan_items
    WHERE plan_id IN (${planIdPlaceholders})
  `
  const allItems = db.prepare(itemsSql).all(...planIds)
  const itemsByPlan = new Map()
  allItems.forEach((it) => {
    if (!itemsByPlan.has(it.plan_id)) itemsByPlan.set(it.plan_id, [])
    itemsByPlan.get(it.plan_id).push(it)
  })

  // Fetch completed items in [from, to] with status = 'done'
  const completionsSql = `
    SELECT client_id, plan_item_id, date
    FROM item_completions
    WHERE status = 'done' AND date BETWEEN ? AND ? AND client_id IN (${idPlaceholders})
  `
  const completions = db.prepare(completionsSql).all(from, to, ...memberIds)
  const completionsSet = new Set(
    completions.map((c) => `${c.client_id}_${c.plan_item_id}_${c.date}`)
  )

  let totalPlanned = 0
  let totalCompleted = 0

  const pillarTotals = {
    move: { planned: 0, completed: 0 },
    eat: { planned: 0, completed: 0 },
    recover: { planned: 0, completed: 0 },
  }

  // Client-level adherence for distribution bands
  const clientStats = new Map()

  for (const plan of plans) {
    const items = itemsByPlan.get(plan.plan_id) || []
    if (items.length === 0) continue

    // Effective start and end dates for planned days
    const pStart = plan.start_date > from ? plan.start_date : from
    const programEnd = addDaysToDateStr(plan.start_date, plan.program_weeks * 7)
    let pEnd = programEnd < to ? programEnd : to
    if (pEnd > cairoToday) pEnd = cairoToday

    if (pStart > pEnd) continue // Plan hasn't started or is entirely in future

    // Iterate through days in [pStart, pEnd]
    let curr = pStart
    while (curr <= pEnd) {
      const dow = getDayOfWeek1to7(curr)
      const dayItems = items.filter((it) => it.day_of_week === dow)

      for (const it of dayItems) {
        totalPlanned++
        pillarTotals[plan.service].planned++

        if (!clientStats.has(plan.client_id)) {
          clientStats.set(plan.client_id, { planned: 0, completed: 0 })
        }
        clientStats.get(plan.client_id).planned++

        const key = `${plan.client_id}_${it.id}_${curr}`
        if (completionsSet.has(key)) {
          totalCompleted++
          pillarTotals[plan.service].completed++
          clientStats.get(plan.client_id).completed++
        }
      }

      curr = addDaysToDateStr(curr, 1)
    }
  }

  const overallRate =
    totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 1000) / 1000 : 0

  const byPillar = {
    move:
      pillarTotals.move.planned > 0
        ? Math.round((pillarTotals.move.completed / pillarTotals.move.planned) * 1000) / 1000
        : null,
    eat:
      pillarTotals.eat.planned > 0
        ? Math.round((pillarTotals.eat.completed / pillarTotals.eat.planned) * 1000) / 1000
        : null,
    recover:
      pillarTotals.recover.planned > 0
        ? Math.round((pillarTotals.recover.completed / pillarTotals.recover.planned) * 1000) / 1000
        : null,
  }

  // Adherence bands
  const bands = { '0-25': 0, '25-50': 0, '50-75': 0, '75-100': 0 }
  clientStats.forEach((st) => {
    const rate = st.planned > 0 ? st.completed / st.planned : 0
    if (rate <= 0.25) bands['0-25']++
    else if (rate <= 0.5) bands['25-50']++
    else if (rate <= 0.75) bands['50-75']++
    else bands['75-100']++
  })

  return {
    rate: overallRate,
    cohortSize: distinctClientCount,
    byPillar,
    bands,
    suppressed: false,
  }
}

/**
 * Computes session metrics by session date (availability_slots.starts_at shifted to Cairo).
 */
export function computeSessions(db, memberIds, from, to, granularity) {
  if (!memberIds || memberIds.length === 0) {
    const buckets = generateBuckets(from, to, granularity)
    return {
      completed: 0,
      cancelled: 0,
      confirmed: 0,
      total: 0,
      completionRate: null,
      series: buckets.map((b) => ({ date: b, completed: 0, confirmed: 0, cancelled: 0 })),
      heatmap: generateEmptyHeatmap(),
      heatmapSuppressed: true,
    }
  }

  const idPlaceholders = memberIds.map(() => '?').join(',')

  // Sessions by session date in [from, to]
  const sql = `
    SELECT 
      b.id,
      b.status,
      b.client_id,
      b.session_type,
      DATE(datetime(s.starts_at, '+${CAIRO_OFFSET_HOURS} hours')) AS session_date,
      strftime('%w', datetime(s.starts_at, '+${CAIRO_OFFSET_HOURS} hours')) AS cairo_dow,
      strftime('%H', datetime(s.starts_at, '+${CAIRO_OFFSET_HOURS} hours')) AS cairo_hour
    FROM bookings b
    JOIN availability_slots s ON s.id = b.slot_id
    WHERE DATE(datetime(s.starts_at, '+${CAIRO_OFFSET_HOURS} hours')) BETWEEN ? AND ?
      AND b.client_id IN (${idPlaceholders})
  `
  const rows = db.prepare(sql).all(from, to, ...memberIds)

  let completed = 0
  let cancelled = 0
  let confirmed = 0

  const buckets = generateBuckets(from, to, granularity)
  const statusMap = new Map()
  buckets.forEach((b) => statusMap.set(b, { completed: 0, confirmed: 0, cancelled: 0 }))

  const distinctClientsInSessions = new Set()
  const heatmapCounts = {}

  for (const r of rows) {
    distinctClientsInSessions.add(r.client_id)

    if (r.status === 'completed') completed++
    else if (r.status === 'cancelled') cancelled++
    else if (r.status === 'confirmed' || r.status === 'pending') confirmed++

    // Bucket mapping
    let bucketKey = r.session_date
    if (granularity === 'week') {
      const d = new Date(r.session_date + 'T00:00:00Z')
      const dow = d.getUTCDay()
      const diff = (dow - WEEK_START + 7) % 7
      d.setUTCDate(d.getUTCDate() - diff)
      bucketKey = d.toISOString().slice(0, 10)
    }

    if (statusMap.has(bucketKey)) {
      const entry = statusMap.get(bucketKey)
      if (r.status === 'completed') entry.completed++
      else if (r.status === 'cancelled') entry.cancelled++
      else entry.confirmed++
    }

    // Heatmap: dow (0..6) x hour (0..23)
    const hKey = `${r.cairo_dow}_${parseInt(r.cairo_hour, 10)}`
    heatmapCounts[hKey] = (heatmapCounts[hKey] || 0) + 1
  }

  const finishedTotal = completed + cancelled
  const completionRate =
    finishedTotal > 0 ? Math.round((completed / finishedTotal) * 1000) / 1000 : null

  // Suppress heatmap if fewer than MIN_COHORT distinct members had sessions
  const heatmapSuppressed = distinctClientsInSessions.size < MIN_COHORT
  const heatmap = heatmapSuppressed ? null : formatHeatmap(heatmapCounts)

  const series = buckets.map((b) => ({
    date: b,
    ...(statusMap.get(b) || { completed: 0, confirmed: 0, cancelled: 0 }),
  }))

  return {
    completed,
    cancelled,
    confirmed,
    total: rows.length,
    completionRate,
    series,
    heatmap,
    heatmapSuppressed,
  }
}

/**
 * Computes point-in-time stock metrics as of a given cutoff date.
 *
 * Evaluates:
 * - Total members as of cutoff
 * - Active care_team assignments as of cutoff (created <= cutoff and (ended_at IS NULL or ended_at > cutoff))
 * - Specialist coverage %
 * - Seat utilization % (for organizations)
 */
export function computeStockMetricsAsOf(db, scope, cutoffDate) {
  const type = scope?.type || 'all'

  let totalMembersSql = `
    SELECT COUNT(*) AS count FROM users 
    WHERE role = 'client' AND DATE(datetime(created_at, '+${CAIRO_OFFSET_HOURS} hours')) <= ?
  `
  const params = [cutoffDate]

  if (type === 'organization' && scope.orgId) {
    totalMembersSql += ` AND organization_id = ?`
    params.push(scope.orgId)
  } else if (type === 'b2c') {
    totalMembersSql += ` AND organization_id IS NULL`
  } else if (type === 'b2b') {
    totalMembersSql += ` AND organization_id IS NOT NULL`
  }

  const totalMembers = db.prepare(totalMembersSql).get(...params)?.count ?? 0

  // Assigned members as of cutoff
  let assignedSql = `
    SELECT COUNT(DISTINCT ct.client_id) AS count
    FROM care_team ct
    JOIN users u ON u.id = ct.client_id
    WHERE DATE(datetime(ct.created_at, '+${CAIRO_OFFSET_HOURS} hours')) <= ?
      AND (ct.ended_at IS NULL OR DATE(datetime(ct.ended_at, '+${CAIRO_OFFSET_HOURS} hours')) > ?)
      AND DATE(datetime(u.created_at, '+${CAIRO_OFFSET_HOURS} hours')) <= ?
  `
  const assignedParams = [cutoffDate, cutoffDate, cutoffDate]

  if (type === 'organization' && scope.orgId) {
    assignedSql += ` AND u.organization_id = ?`
    assignedParams.push(scope.orgId)
  } else if (type === 'b2c') {
    assignedSql += ` AND u.organization_id IS NULL`
  } else if (type === 'b2b') {
    assignedSql += ` AND u.organization_id IS NOT NULL`
  }

  const assignedMembers = db.prepare(assignedSql).get(...assignedParams)?.count ?? 0

  const coverageRate =
    totalMembers > 0 ? Math.round((assignedMembers / totalMembers) * 1000) / 1000 : 0

  let seatLimit = null
  let seatUtilization = null

  if (type === 'organization' && scope.orgId) {
    const org = db
      .prepare(`SELECT seat_limit FROM organizations WHERE id = ?`)
      .get(scope.orgId)
    if (org) {
      seatLimit = org.seat_limit
      seatUtilization =
        seatLimit > 0 ? Math.round((totalMembers / seatLimit) * 1000) / 1000 : 0
    }
  }

  return {
    totalMembers,
    assignedMembers,
    coverageRate,
    seatLimit,
    seatUtilization,
  }
}

/**
 * Computes cohort funnel for members who joined within [from, to].
 * Stages: Joined -> Onboarded -> Assigned -> Active
 */
export function computeCohortFunnel(db, memberIds, from, to) {
  if (!memberIds || memberIds.length === 0) {
    return { joined: 0, onboarded: 0, assigned: 0, active: 0 }
  }

  const idPlaceholders = memberIds.map(() => '?').join(',')

  // 1. Joined in range
  const joinedSql = `
    SELECT u.id, COALESCE(cp.onboarding_completed, 0) AS onboarded
    FROM users u
    LEFT JOIN client_profiles cp ON cp.user_id = u.id
    WHERE u.id IN (${idPlaceholders})
      AND DATE(datetime(u.created_at, '+${CAIRO_OFFSET_HOURS} hours')) BETWEEN ? AND ?
  `
  const cohortUsers = db.prepare(joinedSql).all(...memberIds, from, to)
  const joined = cohortUsers.length

  if (joined === 0) {
    return { joined: 0, onboarded: 0, assigned: 0, active: 0 }
  }

  const cohortIds = cohortUsers.map((u) => u.id)
  const cohortPlaceholders = cohortIds.map(() => '?').join(',')

  // 2. Onboarded
  const onboarded = cohortUsers.filter((u) => u.onboarded === 1).length

  // 3. Ever assigned to care_team
  const assignedSql = `
    SELECT COUNT(DISTINCT client_id) AS count
    FROM care_team
    WHERE client_id IN (${cohortPlaceholders})
  `
  const assigned = db.prepare(assignedSql).get(...cohortIds)?.count ?? 0

  // 4. Active in range
  const activeSql = `
    SELECT COUNT(DISTINCT client_id) AS count FROM (
      SELECT client_id FROM item_completions 
      WHERE status = 'done' AND date BETWEEN ? AND ? AND client_id IN (${cohortPlaceholders})
      UNION
      SELECT client_id FROM progress_logs 
      WHERE date BETWEEN ? AND ? AND client_id IN (${cohortPlaceholders})
      UNION
      SELECT client_id FROM bookings 
      WHERE DATE(datetime(created_at, '+${CAIRO_OFFSET_HOURS} hours')) BETWEEN ? AND ? AND client_id IN (${cohortPlaceholders})
    )
  `
  const activeParams = [
    from,
    to,
    ...cohortIds,
    from,
    to,
    ...cohortIds,
    from,
    to,
    ...cohortIds,
  ]
  const active = db.prepare(activeSql).get(...activeParams)?.count ?? 0

  return {
    joined,
    onboarded,
    assigned,
    active,
  }
}

/**
 * Computes platform-wide revenue mirroring server/src/routes/finance.js.
 * Excludes sponsored subscriptions (source = 'organization') and org bookings.
 */
export function computeRevenue(db, from, to) {
  // Subscriptions revenue in range
  const subRevenue =
    db
      .prepare(
        `SELECT COALESCE(SUM(price_egp), 0) AS total
         FROM subscriptions
         WHERE (source = 'self' OR source IS NULL)
           AND DATE(datetime(created_at, '+${CAIRO_OFFSET_HOURS} hours')) BETWEEN ? AND ?`
      )
      .get(from, to)?.total ?? 0

  // Completed sessions revenue in range (self-paid only)
  const sessionRevenue =
    db
      .prepare(
        `SELECT COALESCE(SUM(b.price_egp), 0) AS total
         FROM bookings b
         JOIN availability_slots s ON s.id = b.slot_id
         JOIN users u ON u.id = b.client_id
         WHERE b.status = 'completed'
           AND (u.organization_id IS NULL)
           AND DATE(datetime(s.starts_at, '+${CAIRO_OFFSET_HOURS} hours')) BETWEEN ? AND ?`
      )
      .get(from, to)?.total ?? 0

  const grossRevenue = subRevenue + sessionRevenue

  // All-time platform gross revenue check (for finance overview alignment)
  const allTimeSubRevenue =
    db
      .prepare(
        `SELECT COALESCE(SUM(price_egp), 0) AS total
         FROM subscriptions
         WHERE (source = 'self' OR source IS NULL)`
      )
      .get()?.total ?? 0

  const allTimeSessionRevenue =
    db
      .prepare(
        `SELECT COALESCE(SUM(price_egp), 0) AS total
         FROM bookings
         WHERE status = 'completed'`
      )
      .get()?.total ?? 0

  const allTimeGrossRevenue = allTimeSubRevenue + allTimeSessionRevenue

  return {
    grossRevenue,
    subRevenue,
    sessionRevenue,
    allTimeGrossRevenue,
  }
}

/**
 * Computes support ticket metrics (open tickets and median resolution time in hours).
 */
export function computeSupportMetrics(db, from, to) {
  // Open tickets as of range.to
  const openCount =
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM support_tickets
         WHERE status IN ('open', 'in_progress')
           AND DATE(datetime(created_at, '+${CAIRO_OFFSET_HOURS} hours')) <= ?`
      )
      .get(to)?.count ?? 0

  // Tickets resolved in [from, to] with non-null resolved_at
  const resolvedRows = db
    .prepare(
      `SELECT 
         created_at,
         resolved_at,
         (julianday(resolved_at) - julianday(created_at)) * 24.0 AS hours_taken
       FROM support_tickets
       WHERE resolved_at IS NOT NULL
         AND status IN ('resolved', 'closed')
         AND DATE(datetime(resolved_at, '+${CAIRO_OFFSET_HOURS} hours')) BETWEEN ? AND ?`
    )
    .all(from, to)

  let medianResolutionHours = null
  if (resolvedRows.length > 0) {
    const durations = resolvedRows
      .map((r) => r.hours_taken)
      .filter((h) => h >= 0)
      .sort((a, b) => a - b)

    if (durations.length > 0) {
      const mid = Math.floor(durations.length / 2)
      medianResolutionHours =
        durations.length % 2 !== 0
          ? Math.round(durations[mid] * 10) / 10
          : Math.round(((durations[mid - 1] + durations[mid]) / 2) * 10) / 10
    }
  }

  return {
    openCount,
    resolvedCount: resolvedRows.length,
    medianResolutionHours,
  }
}

/**
 * Computes System Admin Organizations summary table.
 * Shows member counts, seat limits, and engagement % (suppressed if members < 5).
 */
export function computeOrganizationsTable(db, from, to) {
  const orgs = db
    .prepare(
      `SELECT 
         id, name, type, seat_limit,
         DATE(datetime(created_at, '+${CAIRO_OFFSET_HOURS} hours')) AS created_date
       FROM organizations
       ORDER BY name ASC`
    )
    .all()

  return orgs.map((org) => {
    // Current members
    const members = db
      .prepare(
        `SELECT id FROM users WHERE role = 'client' AND organization_id = ?`
      )
      .all(org.id)
      .map((u) => u.id)

    const specialistsCount =
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM specialists WHERE organization_id = ?`
        )
        .get(org.id)?.count ?? 0

    const memberCount = members.length
    let engagementRate = null
    let engagementSuppressed = true

    if (memberCount >= MIN_COHORT) {
      const idPlaceholders = members.map(() => '?').join(',')
      const activeCount =
        db
          .prepare(
            `SELECT COUNT(DISTINCT client_id) AS count FROM (
               SELECT client_id FROM item_completions 
               WHERE status = 'done' AND date BETWEEN ? AND ? AND client_id IN (${idPlaceholders})
               UNION
               SELECT client_id FROM progress_logs 
               WHERE date BETWEEN ? AND ? AND client_id IN (${idPlaceholders})
               UNION
               SELECT client_id FROM bookings 
               WHERE DATE(datetime(created_at, '+${CAIRO_OFFSET_HOURS} hours')) BETWEEN ? AND ? AND client_id IN (${idPlaceholders})
             )`
          )
          .get(from, to, ...members, from, to, ...members, from, to, ...members)?.count ?? 0

      engagementRate =
        memberCount > 0 ? Math.round((activeCount / memberCount) * 1000) / 10 : 0
      engagementSuppressed = false
    }

    return {
      id: org.id,
      name: org.name,
      type: org.type,
      seatLimit: org.seat_limit,
      seatsUsed: memberCount,
      specialistsCount,
      createdDate: org.created_date,
      engagementPct: engagementRate,
      engagementSuppressed,
    }
  })
}

/**
 * Computes specialist workload for organization specialists.
 * Workload counts (active clients, sessions completed) are NOT suppressed for org admin.
 */
export function computeSpecialistWorkload(db, orgId, from, to) {
  const specs = db
    .prepare(
      `SELECT 
         s.user_id AS specialist_id,
         u.name,
         s.type,
         CASE s.type
           WHEN 'trainer' THEN 'Move'
           WHEN 'nutritionist' THEN 'Eat'
           WHEN 'physical_therapist' THEN 'Recover'
           ELSE 'Move'
         END AS field
       FROM specialists s
       JOIN users u ON u.id = s.user_id
       WHERE s.organization_id = ?
       ORDER BY u.name ASC`
    )
    .all(orgId)

  return specs.map((sp) => {
    const activeClients =
      db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM care_team
           WHERE specialist_id = ? AND status = 'active'`
        )
        .get(sp.specialist_id)?.count ?? 0

    const completedSessions =
      db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM bookings b
           JOIN availability_slots s ON s.id = b.slot_id
           WHERE b.specialist_id = ?
             AND b.status = 'completed'
             AND DATE(datetime(s.starts_at, '+${CAIRO_OFFSET_HOURS} hours')) BETWEEN ? AND ?`
        )
        .get(sp.specialist_id, from, to)?.count ?? 0

    return {
      specialistId: sp.specialist_id,
      name: sp.name,
      field: sp.field,
      activeClients,
      completedSessions,
    }
  })
}

/**
 * Master analytical function executing all metrics for any scope and date range.
 *
 * @param {object} scope - { type: 'all'|'organization'|'specialist'|'b2c'|'b2b', orgId?, specialistId? }
 * @param {object} [rangeParams={}] - { range?: '7d'|'30d'|'90d', from?: string, to?: string }
 * @param {import('better-sqlite3').Database} [customDb] - Optional custom database instance
 * @returns {object} Standard Power BI-style dashboard payload
 */
export function getAnalytics(scope = { type: 'all' }, rangeParams = {}, customDb = null) {
  const db = customDb || defaultDb
  const parsedRange = parseRange(rangeParams)
  const { from, to, granularity, previous } = parsedRange
  const cairoToday = isoToCairoDate(new Date().toISOString())

  const memberIds = getScopeMemberIds(db, scope)
  const cohortSize = memberIds.length

  // 1. Active Members
  const currActive = computeActiveMembers(db, memberIds, from, to, granularity)
  const prevActive = computeActiveMembers(db, memberIds, previous.from, previous.to, granularity)
  const activeKpi = withDelta(currActive.count, prevActive.count)

  // 2. Adherence
  const currAdherence = computeAdherence(db, memberIds, from, to, cairoToday)
  const prevAdherence = computeAdherence(db, memberIds, previous.from, previous.to, previous.to)
  const adherenceKpi = suppress(
    withDelta(currAdherence.rate, prevAdherence.rate, { unit: '%' }),
    currAdherence.cohortSize
  )

  // 3. Sessions
  const currSessions = computeSessions(db, memberIds, from, to, granularity)
  const prevSessions = computeSessions(db, memberIds, previous.from, previous.to, granularity)
  const sessionsKpi = withDelta(currSessions.completed, prevSessions.completed)

  // 4. Stock metrics ("As of" range end vs previous range end)
  const currStock = computeStockMetricsAsOf(db, scope, to)
  const prevStock = computeStockMetricsAsOf(db, scope, previous.to)

  const coverageKpi = suppress(
    withDelta(currStock.coverageRate, prevStock.coverageRate, { unit: '%' }),
    currStock.totalMembers
  )

  const utilizationKpi =
    currStock.seatUtilization !== null
      ? withDelta(currStock.seatUtilization, prevStock.seatUtilization, { unit: '%' })
      : null

  // 5. Funnel
  const funnel = computeCohortFunnel(db, memberIds, from, to)

  // 6. KPIs Collection
  const kpis = [
    {
      key: 'active_members',
      label: 'Active Members',
      ...activeKpi,
    },
    {
      key: 'adherence_rate',
      label: 'Adherence Rate',
      ...adherenceKpi,
    },
    {
      key: 'sessions_completed',
      label: 'Sessions Completed',
      ...sessionsKpi,
    },
    {
      key: 'specialist_coverage',
      label: 'Specialist Coverage',
      ...coverageKpi,
    },
  ]

  if (utilizationKpi) {
    kpis.push({
      key: 'seat_utilization',
      label: 'Seat Utilization',
      ...utilizationKpi,
    })
  }

  // 7. Series & Breakdowns
  const series = {
    activeMembers: currActive.series,
    sessionsByStatus: currSessions.series,
  }

  const breakdowns = {
    adherenceByPillar: suppress(currAdherence.byPillar, currAdherence.cohortSize),
    adherenceBands: suppress(currAdherence.bands, currAdherence.cohortSize),
    sessionsHeatmap: currSessions.heatmap,
    funnel,
  }

  // Org-specific breakdowns
  if (scope.type === 'organization' && scope.orgId) {
    breakdowns.specialistWorkload = computeSpecialistWorkload(db, scope.orgId, from, to)
  }

  // System Admin additions
  if (scope.type === 'all') {
    const rev = computeRevenue(db, from, to)
    const prevRev = computeRevenue(db, previous.from, previous.to)
    kpis.push({
      key: 'gross_revenue',
      label: 'Gross Revenue',
      unit: 'EGP',
      ...withDelta(rev.grossRevenue, prevRev.grossRevenue),
    })

    const support = computeSupportMetrics(db, from, to)
    const prevSupport = computeSupportMetrics(db, previous.from, previous.to)
    kpis.push({
      key: 'open_support_tickets',
      label: 'Open Support Tickets',
      ...withDelta(support.openCount, prevSupport.openCount),
    })
    kpis.push({
      key: 'median_resolution_time',
      label: 'Median Resolution Time',
      unit: 'hours',
      ...withDelta(support.medianResolutionHours, prevSupport.medianResolutionHours),
    })

    breakdowns.organizationsTable = computeOrganizationsTable(db, from, to)
  }

  const payload = {
    range: parsedRange,
    kpis,
    series,
    breakdowns,
    generatedAt: new Date().toISOString(),
  }

  // Enforce zero clinical exposure for org and admin scopes
  if (scope.type !== 'specialist') {
    assertNoForbiddenKeys(payload)
  }

  return payload
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addDaysToDateStr(dStr, days) {
  const d = new Date(dStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function getDayOfWeek1to7(dStr) {
  // Returns 1=Monday ... 7=Sunday
  const d = new Date(dStr + 'T00:00:00Z')
  const dow = d.getUTCDay() // 0=Sun, 1=Mon, ..., 6=Sat
  return dow === 0 ? 7 : dow
}

function generateEmptyHeatmap() {
  const grid = []
  // Saturday (6), Sunday (0), Monday (1), Tuesday (2), Wednesday (3), Thursday (4), Friday (5)
  const egyptianOrder = [6, 0, 1, 2, 3, 4, 5]
  for (const dow of egyptianOrder) {
    for (let h = 0; h < 24; h++) {
      grid.push({ dow, hour: h, count: 0 })
    }
  }
  return grid
}

function formatHeatmap(countsMap) {
  const grid = []
  const egyptianOrder = [6, 0, 1, 2, 3, 4, 5]
  for (const dow of egyptianOrder) {
    for (let h = 0; h < 24; h++) {
      const key = `${dow}_${h}`
      grid.push({
        dow,
        hour: h,
        count: countsMap[key] || 0,
      })
    }
  }
  return grid
}
