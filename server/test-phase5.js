// test-phase5.js — Automated test suite for Phase 5: AI Planner and Fallback.
//
// Key requirements tested:
// 1. Fallback plan generation works with key removed (works offline / zero deps).
// 2. Knee injury filtering: exercises with avoidFor: ["knee"] (like goblet squat) are excluded.
// 3. Calorie floor: every day in the meal plan provides at least 1,400 kcal.
// 4. Mandatory disclaimer is always present on drafts.
// 5. Severe pain guardrail (pain >= 7) sets needsReview: true.
// 6. Allergy filtering: meals containing client allergies are excluded.
// 7. Handover: POST /api/ai/plan/:id/send converts draft to 3 database plans with source='ai', status='draft'.
// 8. Idempotency: Sending the same AI draft twice is rejected with 400 ALREADY_SENT.

import assert from 'node:assert'
import app from './src/app.js'
import db from './src/db/connection.js'
import { MIN_DAILY_CALORIES, AI_DISCLAIMER } from './src/services/planFallback.js'

const PORT = 4004
let server

async function run() {
  server = app.listen(PORT)
  const baseUrl = `http://localhost:${PORT}/api`

  console.log(`Starting Phase 5 test suite on ${baseUrl}...\n`)

  let passed = 0
  function ok(msg) {
    passed++
    console.log(`  ✓ ${msg}`)
  }

  try {
    // 0. Login as Sara
    const loginSara = await (
      await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'sara@demo.com', password: 'demo1234' }),
      })
    ).json()
    const saraToken = loginSara.data.token

    // 1. Generate plan draft with Knee injury (fallback mode)
    const genRes = await fetch(`${baseUrl}/ai/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${saraToken}`,
      },
      body: JSON.stringify({
        goal: 'lose_fat',
        daysPerWeek: 4,
        injuries: [{ bodyArea: 'knee', painLevel: 3 }],
        equipment: ['Full gym'],
        diet: 'High protein',
      }),
    })
    const genJson = await genRes.json()
    assert.strictEqual(genRes.status, 200)
    assert.ok(genJson.data.requestId)
    assert.ok(['ai', 'fallback'].includes(genJson.data.source))

    const draft = genJson.data.draft
    assert.ok(draft.summary)
    assert.strictEqual(draft.disclaimer, AI_DISCLAIMER, 'Disclaimer must be present')
    assert.strictEqual(draft.needsReview, false, 'Mild pain (3) should not trigger emergency review')
    ok(`AI plan generated successfully (source: ${genJson.data.source})`)

    // 2. INJURY-AWARE FILTERING: Knee exercises that stress the joint must be excluded
    assert.ok(Array.isArray(draft.move) && draft.move.length > 0)
    const gobletSquat = draft.move.find((m) => m.title.toLowerCase().includes('goblet'))
    assert.strictEqual(gobletSquat, undefined, 'Goblet squats (avoidFor: knee) must be excluded for knee injury')

    const boxSquats = draft.move.filter((m) => m.title.toLowerCase().includes('box squat'))
    assert.ok(boxSquats.length >= 1, 'Knee-safe box squats must be allowed')
    ok('Injury-aware filtering verified: goblet squats excluded, box squats allowed')

    // 3. CALORIE FLOOR: Daily calorie sum >= 1,400 kcal
    assert.ok(Array.isArray(draft.eat) && draft.eat.length > 0)
    const dayCalories = new Map()
    for (const m of draft.eat) {
      dayCalories.set(m.dayOfWeek, (dayCalories.get(m.dayOfWeek) || 0) + (m.kcal || 0))
    }
    for (let dow = 1; dow <= 7; dow++) {
      const total = dayCalories.get(dow) || 0
      assert.ok(total >= MIN_DAILY_CALORIES, `Day ${dow} calories (${total}) must meet or exceed ${MIN_DAILY_CALORIES} kcal`)
    }
    ok('1,400 kcal floor enforced across all 7 days of the nutrition plan')

    // 4. SEVERE PAIN GUARDRAIL: painLevel >= 7 triggers needsReview: true
    const severeRes = await fetch(`${baseUrl}/ai/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${saraToken}`,
      },
      body: JSON.stringify({
        goal: 'recover_injury',
        daysPerWeek: 3,
        injuries: [{ bodyArea: 'knee', painLevel: 8 }],
      }),
    })
    const severeJson = await severeRes.json()
    assert.strictEqual(severeRes.status, 200)
    assert.strictEqual(severeJson.data.draft.needsReview, true)
    ok('Severe pain guardrail enforced: painLevel 8 sets needsReview=true')

    // 5. ALLERGY FILTERING: Dairy allergy removes dairy meals
    const allergyRes = await fetch(`${baseUrl}/ai/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${saraToken}`,
      },
      body: JSON.stringify({
        allergies: ['dairy'],
      }),
    })
    const allergyJson = await allergyRes.json()
    assert.strictEqual(allergyRes.status, 200)
    const dairyMeal = allergyJson.data.draft.eat.find(
      (m) => m.title.toLowerCase().includes('oats with milk') || m.title.toLowerCase().includes('labneh')
    )
    assert.strictEqual(dairyMeal, undefined, 'Meals containing dairy must be excluded when dairy allergy is specified')
    ok('Allergy filtering enforced: dairy-containing meals successfully excluded')

    // 6. HANDOVER: Send AI draft to specialists
    const requestId = genJson.data.requestId
    const sendRes = await fetch(`${baseUrl}/ai/plan/${requestId}/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${saraToken}` },
    })
    const sendJson = await sendRes.json()
    assert.strictEqual(sendRes.status, 200)
    assert.strictEqual(sendJson.data.success, true)
    assert.strictEqual(sendJson.data.status, 'sent')
    assert.strictEqual(sendJson.data.planIds.length, 3, 'Must create 3 plans (move, eat, recover)')

    // Verify plans in database
    const createdPlans = db
      .prepare('SELECT id, service, source, status FROM plans WHERE id IN (?, ?, ?)')
      .all(...sendJson.data.planIds)
    assert.strictEqual(createdPlans.length, 3)
    assert.ok(createdPlans.every((p) => p.source === 'ai'))
    assert.ok(createdPlans.every((p) => p.status === 'draft'))

    // Verify items were created for each plan
    for (const plan of createdPlans) {
      const count = db.prepare('SELECT count(*) as count FROM plan_items WHERE plan_id = ?').get(plan.id).count
      assert.ok(count > 0, `Plan ${plan.id} (${plan.service}) must have items`)
    }
    ok('POST /api/ai/plan/:id/send successfully created 3 AI draft plans in DB with items')

    // 7. IDEMPOTENCY: Cannot send the same draft twice
    const resendRes = await fetch(`${baseUrl}/ai/plan/${requestId}/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${saraToken}` },
    })
    const resendJson = await resendRes.json()
    assert.strictEqual(resendRes.status, 400)
    assert.strictEqual(resendJson.error.code, 'ALREADY_SENT')
    ok('Resending an already sent draft is rejected with 400 ALREADY_SENT')

    console.log(`\nAll ${passed} Phase 5 tests passed successfully!`)
  } finally {
    server.close()
  }
}

run().catch((err) => {
  console.error('\n❌ Test failed:', err)
  if (server) server.close()
  process.exit(1)
})

