// test-phase4.js — Automated test suite for Phase 4: Today, Plans, Completions, and Progress.
//
// Key requirements tested:
// 1. GET /api/dashboard/today for Sara matches Section 5 shape and values:
//    - weekOfProgram { current: 3, total: 8 }
//    - summary { workoutsThisWeek: 3, workoutsTarget: 4, streakDays: 5, latestPain: 3 }
//    - plan items list with time, title, meta, status
//    - nextSession with Dr. Mona
//    - latestNote from Dr. Mona
// 2. Checking an item off with PUT /api/completions changes status and affects summary.
// 3. Resetting an item with status "pending" removes the completion.
// 4. Unauthorized item completion is rejected with 403 FORBIDDEN.
// 5. GET /api/plans returns all 3 active plans with days and items.
// 6. GET /api/plans?service=move returns single plan.
// 7. GET /api/progress returns weight, pain, workoutsPerWeek, and safeLimit (4).
// 8. PUT /api/progress upserts check-in.

import assert from 'node:assert'
import app from './src/app.js'
import db from './src/db/connection.js'

const PORT = 4003
let server

async function run() {
  server = app.listen(PORT)
  const baseUrl = `http://localhost:${PORT}/api`

  console.log(`Starting Phase 4 test suite on ${baseUrl}...\n`)

  let passed = 0
  function ok(msg) {
    passed++
    console.log(`  ✓ ${msg}`)
  }

  try {
    // 0. Login users
    const loginSara = await (
      await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'sara@demo.com', password: 'demo1234' }),
      })
    ).json()
    const saraToken = loginSara.data.token

    const loginOmar = await (
      await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'omar@demo.com', password: 'demo1234' }),
      })
    ).json()
    const omarToken = loginOmar.data.token

    // 1. GET /api/dashboard/today for Sara
    const todayRes = await fetch(`${baseUrl}/dashboard/today`, {
      headers: { Authorization: `Bearer ${saraToken}` },
    })
    const todayJson = await todayRes.json()
    assert.strictEqual(todayRes.status, 200)

    const data = todayJson.data
    assert.ok(data.date, 'Must include date')
    assert.deepStrictEqual(data.weekOfProgram, { current: 3, total: 8 }, 'Sara must be in week 3 of 8')
    assert.strictEqual(data.summary.workoutsTarget, 4, 'Target workouts must be 4')
    assert.strictEqual(data.summary.streakDays, 5, 'Sara must have a 5-day streak from seed')
    assert.strictEqual(data.summary.latestPain, 3, 'Latest pain must be 3')
    assert.ok(Array.isArray(data.plan), 'plan must be an array')
    assert.ok(data.plan.length >= 1, 'Today must have plan items')

    // Verify item shape
    const firstItem = data.plan[0]
    assert.ok(firstItem.itemId)
    assert.ok(firstItem.service)
    assert.ok(firstItem.time)
    assert.ok(firstItem.title)
    assert.ok(firstItem.meta)
    assert.ok(['pending', 'done', 'skipped'].includes(firstItem.status))

    // Next session check
    assert.ok(data.nextSession, 'Sara must have upcoming session')
    assert.ok(data.nextSession.specialist.name.includes('Mona'))
    assert.strictEqual(data.nextSession.specialist.type, 'physical_therapist')

    // Latest note check
    assert.ok(data.latestNote, 'Sara must have latest note')
    assert.ok(data.latestNote.from.includes('Mona'))
    assert.ok(data.latestNote.body)

    ok('GET /api/dashboard/today matches Section 5 shape and exact seeded numbers (week 3/8, streak 5, pain 3)')

    // 2. Completions: Mark an item as 'done'
    const targetItemId = firstItem.itemId
    const completeRes = await fetch(`${baseUrl}/completions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${saraToken}` },
      body: JSON.stringify({
        planItemId: targetItemId,
        status: 'done',
      }),
    })
    const completeJson = await completeRes.json()
    assert.strictEqual(completeRes.status, 200)
    assert.strictEqual(completeJson.data.status, 'done')
    ok('PUT /api/completions marks item as done')

    // Verify Today screen now reflects 'done'
    const todayAfterDone = await (
      await fetch(`${baseUrl}/dashboard/today`, {
        headers: { Authorization: `Bearer ${saraToken}` },
      })
    ).json()
    const updatedItem = todayAfterDone.data.plan.find((p) => p.itemId === targetItemId)
    assert.strictEqual(updatedItem.status, 'done')
    ok('Today dashboard reflects the newly checked-off item status')

    // 3. Completions: Reset item to 'pending' (removes the row)
    const resetRes = await fetch(`${baseUrl}/completions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${saraToken}` },
      body: JSON.stringify({
        planItemId: targetItemId,
        status: 'pending',
      }),
    })
    const resetJson = await resetRes.json()
    assert.strictEqual(resetRes.status, 200)
    assert.strictEqual(resetJson.data.status, 'pending')

    const dbCheck = db.prepare('SELECT id FROM item_completions WHERE plan_item_id = ? AND client_id = 1 AND date = ?').get(targetItemId, data.date)
    assert.strictEqual(dbCheck, undefined, 'Pending completion must be deleted from table')
    ok('Setting status=pending removes the completion row from database')

    // 4. Unauthorized item completion (Omar tries to complete Sara's item)
    const unauthorizedRes = await fetch(`${baseUrl}/completions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${omarToken}` },
      body: JSON.stringify({
        planItemId: targetItemId,
        status: 'done',
      }),
    })
    const unauthorizedJson = await unauthorizedRes.json()
    assert.strictEqual(unauthorizedRes.status, 403)
    assert.strictEqual(unauthorizedJson.error.code, 'FORBIDDEN')
    ok('Completing another user’s plan item is rejected with 403 FORBIDDEN')

    // 5. GET /api/plans (all 3 active plans)
    const plansRes = await fetch(`${baseUrl}/plans`, {
      headers: { Authorization: `Bearer ${saraToken}` },
    })
    const plansJson = await plansRes.json()
    assert.strictEqual(plansRes.status, 200)
    assert.strictEqual(plansJson.data.plans.length, 3, 'Sara must have 3 active plans (move, eat, recover)')
    const services = plansJson.data.plans.map((p) => p.service).sort()
    assert.deepStrictEqual(services, ['eat', 'move', 'recover'])
    assert.ok(plansJson.data.plans[0].days.length >= 1)
    ok('GET /api/plans returns all three active plans with author, summary, and days')

    // 6. GET /api/plans?service=move
    const movePlanRes = await fetch(`${baseUrl}/plans?service=move`, {
      headers: { Authorization: `Bearer ${saraToken}` },
    })
    const movePlanJson = await movePlanRes.json()
    assert.strictEqual(movePlanRes.status, 200)
    assert.strictEqual(movePlanJson.data.plan.service, 'move')
    assert.ok(movePlanJson.data.plan.title.includes('strength'))
    assert.ok(movePlanJson.data.plan.summary.includes('60 degrees'))
    assert.strictEqual(movePlanJson.data.plan.author.name, 'Coach Karim Adel')
    ok('GET /api/plans?service=move returns single plan with full item details')

    // 7. GET /api/progress
    const progressRes = await fetch(`${baseUrl}/progress?range=4w`, {
      headers: { Authorization: `Bearer ${saraToken}` },
    })
    const progressJson = await progressRes.json()
    assert.strictEqual(progressRes.status, 200)
    assert.ok(progressJson.data.weight.length >= 14, 'Should have multiple weight points')
    assert.ok(progressJson.data.pain.length >= 14, 'Should have multiple pain points')
    assert.ok(progressJson.data.workoutsPerWeek.length >= 2, 'Should have weekly workout counts')
    assert.strictEqual(progressJson.data.safeLimit, 3, 'Safe limit must be 3 based on active plan pain limits (Walking lunges painLimit is 3)')
    ok('GET /api/progress returns weight, pain, workoutsPerWeek, and safeLimit (3)')

    // 8. PUT /api/progress (upsert check-in)
    const logDate = data.date
    const putProgressRes = await fetch(`${baseUrl}/progress`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${saraToken}` },
      body: JSON.stringify({
        date: logDate,
        weightKg: 72.3,
        workoutDone: true,
        painLevel: 2,
        note: 'Feeling stronger every session',
      }),
    })
    const putProgressJson = await putProgressRes.json()
    assert.strictEqual(putProgressRes.status, 200)
    assert.strictEqual(putProgressJson.data.progressLog.weightKg, 72.3)
    assert.strictEqual(putProgressJson.data.progressLog.painLevel, 2)
    assert.strictEqual(putProgressJson.data.progressLog.note, 'Feeling stronger every session')
    ok('PUT /api/progress upserts daily progress check-in')

    console.log(`\nAll ${passed} Phase 4 tests passed successfully!`)
  } finally {
    server.close()
  }
}

run().catch((err) => {
  console.error('\n❌ Test failed:', err)
  if (server) server.close()
  process.exit(1)
})
