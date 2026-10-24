// server/test-analytics.js
// Comprehensive test suite for Rebound Analytics Foundation (Checkpoint 6A).
// Runs against a dedicated test database (DB_PATH) to guarantee isolation.

import assert from 'node:assert'
import Database from 'better-sqlite3'
import { readFileSync, unlinkSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEST_DB_PATH = join(__dirname, 'data/test-analytics.db')

// Clean up previous test database
if (existsSync(TEST_DB_PATH)) {
  unlinkSync(TEST_DB_PATH)
}

process.env.DB_PATH = TEST_DB_PATH

// Initialize schema on test database
const testDb = new Database(TEST_DB_PATH)
testDb.pragma('foreign_keys = ON')
testDb.pragma('journal_mode = WAL')

const schemaSql = readFileSync(join(__dirname, 'src/db/schema.sql'), 'utf8')
testDb.exec(schemaSql)

// Run BASE seed on test database so it has baseline users and Apex org
execSync(`node "${join(__dirname, 'src/db/seed.js')}"`, {
  env: { ...process.env, DB_PATH: TEST_DB_PATH },
  stdio: 'pipe',
})

// Import modules
import {
  parseRange,
  addDays,
  countDays,
  isoToCairoDate,
  isoToCairoHour,
  isoToCairoDow,
  CAIRO_OFFSET_HOURS,
  WEEK_START,
} from './src/analytics/range.js'
import { generateBuckets, zeroFillSeries } from './src/analytics/buckets.js'
import { withDelta } from './src/analytics/compare.js'
import { MIN_COHORT, suppress, assertNoForbiddenKeys } from './src/analytics/privacy.js'
import {
  getScopeMemberIds,
  computeActiveMembers,
  computeAdherence,
  computeSessions,
  computeStockMetricsAsOf,
  computeRevenue,
  getAnalytics,
} from './src/analytics/metrics.js'
import { seedHistory } from './src/db/seedHistory.js'

async function runTests() {
  console.log('======================================================================')
  console.log(' 🧪 Starting Analytics Foundation Test Suite (test-analytics.js)')
  console.log('======================================================================\n')

  // -------------------------------------------------------------------------
  // 1. Range & Cairo Midnight Boundary
  // -------------------------------------------------------------------------
  console.log('  1. Range parsing, duration equality, and Cairo midnight boundary...')
  const r7 = parseRange({ range: '7d' })
  assert.strictEqual(r7.durationDays, 7, '7d range must have durationDays = 7')
  assert.strictEqual(r7.granularity, 'day', '7d range must have day granularity')
  const prevDuration7 = countDays(r7.previous.from, r7.previous.to)
  assert.strictEqual(prevDuration7, 7, 'Previous period must have exact same duration (7 days)')
  assert.strictEqual(addDays(r7.previous.to, 1), r7.from, 'Previous period must immediately precede current range')

  const r90 = parseRange({ range: '90d' })
  assert.strictEqual(r90.durationDays, 90, '90d range must have durationDays = 90')
  assert.strictEqual(r90.granularity, 'week', '90d range must have week granularity')

  // Midnight boundary test (Cairo is UTC+2)
  // 21:59 UTC = 23:59 Cairo (same day)
  const utcBeforeMidnight = '2026-10-15T21:59:00Z'
  const cairoDateBefore = isoToCairoDate(utcBeforeMidnight)
  const cairoHourBefore = isoToCairoHour(utcBeforeMidnight)
  assert.strictEqual(cairoDateBefore, '2026-10-15', '21:59 UTC must be 2026-10-15 in Cairo')
  assert.strictEqual(cairoHourBefore, 23, '21:59 UTC must be 23:00 in Cairo')

  // 22:01 UTC = 00:01 Cairo (next day)
  const utcAfterMidnight = '2026-10-15T22:01:00Z'
  const cairoDateAfter = isoToCairoDate(utcAfterMidnight)
  const cairoHourAfter = isoToCairoHour(utcAfterMidnight)
  assert.strictEqual(cairoDateAfter, '2026-10-16', '22:01 UTC must cross into 2026-10-16 in Cairo')
  assert.strictEqual(cairoHourAfter, 0, '22:01 UTC must be 00:00 in Cairo')
  console.log('     ✓ Range durations match and Cairo midnight boundary verified.')

  // -------------------------------------------------------------------------
  // 2. Bucket Generation & Zero-Fill
  // -------------------------------------------------------------------------
  console.log('  2. Bucket generation and zero-filling series...')
  const dayBuckets = generateBuckets('2026-10-01', '2026-10-07', 'day')
  assert.strictEqual(dayBuckets.length, 7, 'Daily buckets for 7 days must contain 7 items')
  assert.strictEqual(dayBuckets[0], '2026-10-01')
  assert.strictEqual(dayBuckets[6], '2026-10-07')

  const sampleData = {
    '2026-10-02': { value: 12 },
    '2026-10-05': { value: 25 },
  }
  const filled = zeroFillSeries(dayBuckets, sampleData)
  assert.strictEqual(filled.length, 7)
  assert.strictEqual(filled[0].value, 0, 'Missing day must be zero-filled')
  assert.strictEqual(filled[1].value, 12, 'Existing day must keep value')
  assert.strictEqual(filled[4].value, 25, 'Existing day must keep value')
  assert.strictEqual(filled[6].value, 0, 'Missing day must be zero-filled')
  console.log('     ✓ Series zero-filling verified without gaps.')

  // -------------------------------------------------------------------------
  // 3. Comparison & Delta Arithmetic
  // -------------------------------------------------------------------------
  console.log('  3. Delta arithmetic & zero-previous handling...')
  const d1 = withDelta(150, 100)
  assert.strictEqual(d1.delta, 50)
  assert.strictEqual(d1.deltaPct, 50.0)

  const dZeroPrev = withDelta(10, 0)
  assert.strictEqual(dZeroPrev.delta, 10)
  assert.strictEqual(dZeroPrev.deltaPct, null, 'deltaPct must be null when previous is 0')

  const dDrop = withDelta(50, 100)
  assert.strictEqual(dDrop.delta, -50)
  assert.strictEqual(dDrop.deltaPct, -50.0)
  console.log('     ✓ withDelta handled positive, negative, and zero-previous cases.')

  // -------------------------------------------------------------------------
  // 4. Cohort Suppression (4 vs 5)
  // -------------------------------------------------------------------------
  console.log('  4. Cohort suppression (MIN_COHORT = 5)...')
  const suppressedMetric = suppress({ value: 85, delta: 5 }, 4)
  assert.strictEqual(suppressedMetric.suppressed, true)
  assert.strictEqual(suppressedMetric.value, null)
  assert.strictEqual(suppressedMetric.delta, null)
  assert.strictEqual(suppressedMetric.deltaPct, null)

  const allowedMetric = suppress({ value: 85, delta: 5 }, 5)
  assert.strictEqual(allowedMetric.suppressed, false)
  assert.strictEqual(allowedMetric.value, 85)
  console.log('     ✓ Suppression correctly triggers at 4 and unlocks at 5.')

  // -------------------------------------------------------------------------
  // 5. Database Population & Deterministic Seed Check
  // -------------------------------------------------------------------------
  console.log('  5. Seeding history into isolated test database...')
  seedHistory(testDb)

  const orgCount = testDb.prepare(`SELECT COUNT(*) AS c FROM organizations`).get().c
  assert.ok(orgCount >= 4, 'Must have at least 4 organizations (Apex, CU, Delta, Giza)')

  const totalClients = testDb.prepare(`SELECT COUNT(*) AS c FROM users WHERE role = 'client'`).get().c
  assert.ok(totalClients >= 80, 'Must have seeded members across B2C and B2B')
  console.log('     ✓ Test database seeded successfully.')

  // -------------------------------------------------------------------------
  // 6. Scope Disjointness & Completeness
  // -------------------------------------------------------------------------
  console.log('  6. Scope disjointness & completeness (B2C + B2B = Total)...')
  const allIds = getScopeMemberIds(testDb, { type: 'all' })
  const b2cIds = getScopeMemberIds(testDb, { type: 'b2c' })
  const b2bIds = getScopeMemberIds(testDb, { type: 'b2b' })

  assert.strictEqual(allIds.length, b2cIds.length + b2bIds.length, 'All client IDs must equal B2C IDs + B2B IDs')

  const b2cSet = new Set(b2cIds)
  const overlap = b2bIds.filter((id) => b2cSet.has(id))
  assert.strictEqual(overlap.length, 0, 'B2C and B2B member ID sets must be completely disjoint')
  console.log(`     ✓ Verified: ${allIds.length} total = ${b2cIds.length} B2C + ${b2bIds.length} B2B. Zero overlap.`)

  // -------------------------------------------------------------------------
  // 7. Metric Calculation & Cohort Suppression on Real Tables
  // -------------------------------------------------------------------------
  console.log('  7. Real queries: Giza CrossFit suppression vs Apex unsuppressed...')
  const gizaOrg = testDb.prepare(`SELECT id FROM organizations WHERE name LIKE '%Giza%'`).get()
  assert.ok(gizaOrg, 'Giza CrossFit org must exist')

  const gizaAnalytics = getAnalytics({ type: 'organization', orgId: gizaOrg.id }, { range: '30d' }, testDb)
  const gizaAdherence = gizaAnalytics.kpis.find((k) => k.key === 'adherence_rate')
  assert.strictEqual(gizaAdherence.suppressed, true, 'Giza org (4 members) adherence KPI must be suppressed')
  assert.strictEqual(gizaAnalytics.breakdowns.adherenceByPillar.suppressed, true, 'Giza pillar breakdown must be suppressed')

  const apexAnalytics = getAnalytics({ type: 'organization', orgId: 1 }, { range: '30d' }, testDb)
  const apexAdherence = apexAnalytics.kpis.find((k) => k.key === 'adherence_rate')
  assert.strictEqual(apexAdherence.suppressed, false, 'Apex org (20 members) adherence KPI must NOT be suppressed')
  assert.ok(typeof apexAdherence.value === 'number', 'Apex adherence value must be a number')
  console.log('     ✓ Real database suppression verified on small cohort vs large cohort.')

  // -------------------------------------------------------------------------
  // 8. Invariants: Bounds, Ranges, Adherence Between 0 and 1
  // -------------------------------------------------------------------------
  console.log('  8. Invariants: non-negativity, date bounds, adherence in [0, 1]...')
  const sysAdminAnalytics = getAnalytics({ type: 'all' }, { range: '30d' }, testDb)

  sysAdminAnalytics.kpis.forEach((kpi) => {
    if (!kpi.suppressed && typeof kpi.value === 'number') {
      assert.ok(kpi.value >= 0, `KPI ${kpi.key} must be non-negative (got ${kpi.value})`)
    }
  })

  // Check adherence bound
  if (!apexAdherence.suppressed && apexAdherence.value !== null) {
    assert.ok(apexAdherence.value >= 0 && apexAdherence.value <= 1, `Adherence rate must be between 0 and 1 (got ${apexAdherence.value})`)
  }

  // Check series date bounds
  sysAdminAnalytics.series.activeMembers.forEach((point) => {
    assert.ok(point.date >= sysAdminAnalytics.range.from && point.date <= sysAdminAnalytics.range.to, `Date ${point.date} must be inside range [${sysAdminAnalytics.range.from}, ${sysAdminAnalytics.range.to}]`)
    assert.ok(point.value >= 0, 'Series point value must be non-negative')
  })
  console.log('     ✓ Invariants verified: non-negativity, date bounds, and adherence in [0, 1].')

  // -------------------------------------------------------------------------
  // 9. Finance Gross Revenue Alignment
  // -------------------------------------------------------------------------
  console.log('  9. Revenue alignment with /api/finance/overview definition...')
  const rev = computeRevenue(testDb, sysAdminAnalytics.range.from, sysAdminAnalytics.range.to)
  assert.ok(typeof rev.allTimeGrossRevenue === 'number' && rev.allTimeGrossRevenue > 0, 'All-time gross revenue must be positive')

  // Execute finance.js overview query directly
  const subRevFinance = testDb.prepare(`
    SELECT COALESCE(SUM(price_egp), 0) AS total
    FROM subscriptions
    WHERE (source = 'self' OR source IS NULL)
  `).get()?.total ?? 0

  const sessRevFinance = testDb.prepare(`
    SELECT COALESCE(SUM(price_egp), 0) AS total
    FROM bookings
    WHERE status = 'completed'
  `).get()?.total ?? 0

  const financeOverviewGross = subRevFinance + sessRevFinance
  assert.strictEqual(rev.allTimeGrossRevenue, financeOverviewGross, 'metrics.js allTimeGrossRevenue must exactly equal finance overview revenue')
  console.log(`     ✓ Revenue query matched finance.js exactly: ${rev.allTimeGrossRevenue} EGP.`)

  // -------------------------------------------------------------------------
  // 10. Forbidden Keys Privacy Scan
  // -------------------------------------------------------------------------
  console.log('  10. Forbidden keys scanner passes on analytics payloads and catches leaks...')
  // Must not throw on valid payloads
  assert.doesNotThrow(() => assertNoForbiddenKeys(apexAnalytics), 'Apex analytics must not contain clinical keys')
  assert.doesNotThrow(() => assertNoForbiddenKeys(sysAdminAnalytics), 'SysAdmin analytics must not contain clinical keys')

  // Test that scanner correctly throws when a clinical key is leaked
  const leakedObject = {
    teamStats: {
      active: 12,
      painLevel: 5, // Forbidden!
    },
  }
  assert.throws(
    () => assertNoForbiddenKeys(leakedObject),
    /Forbidden clinical key "painLevel" detected/,
    'assertNoForbiddenKeys must catch and throw on clinical keys'
  )
  console.log('     ✓ Privacy scanner verified: zero clinical leaks.')

  // -------------------------------------------------------------------------
  // 11. EXPLAIN QUERY PLAN (Verify index utilization)
  // -------------------------------------------------------------------------
  console.log('  11. EXPLAIN QUERY PLAN verification for range indexes...')
  const explainCompletions = testDb
    .prepare(`EXPLAIN QUERY PLAN SELECT client_id FROM item_completions WHERE date BETWEEN '2026-09-01' AND '2026-10-01'`)
    .all()
  const usesCompletionsIndex = explainCompletions.some((row) =>
    row.detail.toLowerCase().includes('idx_completions_date')
  )
  assert.ok(usesCompletionsIndex, 'item_completions range query must use idx_completions_date')

  const explainSlots = testDb
    .prepare(`EXPLAIN QUERY PLAN SELECT specialist_id FROM availability_slots WHERE starts_at BETWEEN '2026-09-01' AND '2026-10-01'`)
    .all()
  const usesSlotsIndex = explainSlots.some((row) =>
    row.detail.toLowerCase().includes('idx_slots_starts_at')
  )
  assert.ok(usesSlotsIndex, 'availability_slots range query must use idx_slots_starts_at')
  console.log('     ✓ SQLite query planner confirmed using new timeseries range indexes.')

  console.log('\n======================================================================')
  console.log(' 🎉 All 11 Analytics Foundation Tests Passed Successfully!')
  console.log('======================================================================\n')
}

runTests().catch((err) => {
  console.error('\n❌ Analytics Test Failed:', err)
  process.exit(1)
})
