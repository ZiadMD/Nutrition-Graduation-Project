// test-phase2.js — Automated test suite for Phase 2 endpoints.
//
// Tests:
// 1. Health check (GET /api/health)
// 2. Login with valid demo credentials (sara@demo.com)
// 3. Login with wrong password (returns 401)
// 4. GET /api/auth/me for Sara (returns onboardingCompleted: true)
// 5. Login as specialist (mona@demo.com)
// 6. GET /api/auth/me for Mona (returns approvalStatus: 'approved')
// 7. Register new client
// 8. Register new specialist (approval_status: 'pending')
// 9. Register duplicate email (returns 409)
// 10. Role check: Client calls specialist endpoint (returns 403)
// 11. Role check: Specialist calls specialist endpoint (returns 200)
// 12. GET /api/profile for Sara (returns profile + injuries)
// 13. Step-by-step onboarding for newly registered client:
//     - PUT /api/profile (step 1: goal, daysPerWeek)
//     - PUT /api/profile (step 2: age, height, weight, activity)
//     - PUT /api/profile (step 3: injuries list replacement)
//     - PUT /api/profile (step 4: food preferences)
//     - POST /api/profile/complete
// 14. Verification of completed profile

import assert from 'node:assert'
import app from './src/app.js'

const PORT = 4001
let server

async function run() {
  server = app.listen(PORT)
  const baseUrl = `http://localhost:${PORT}/api`

  console.log(`Starting Phase 2 test suite on ${baseUrl}...\n`)

  let passed = 0
  function ok(msg) {
    passed++
    console.log(`  ✓ ${msg}`)
  }

  try {
    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/health`)
    const healthJson = await healthRes.json()
    assert.strictEqual(healthRes.status, 200)
    assert.strictEqual(healthJson.data.status, 'ok')
    ok('Health check returns status ok')

    // 2. Login with Sara (client)
    const loginSaraRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sara@demo.com', password: 'demo1234' }),
    })
    const loginSaraJson = await loginSaraRes.json()
    assert.strictEqual(loginSaraRes.status, 200)
    assert.ok(loginSaraJson.data.token, 'Token must be provided')
    assert.strictEqual(loginSaraJson.data.user.email, 'sara@demo.com')
    assert.strictEqual(loginSaraJson.data.user.role, 'client')
    assert.strictEqual(loginSaraJson.data.user.onboardingCompleted, true)
    const saraToken = loginSaraJson.data.token
    ok('Client login succeeds (Sara)')

    // 3. Login with wrong password
    const wrongPassRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sara@demo.com', password: 'wrongpassword' }),
    })
    const wrongPassJson = await wrongPassRes.json()
    assert.strictEqual(wrongPassRes.status, 401)
    assert.strictEqual(wrongPassJson.error.code, 'INVALID_CREDENTIALS')
    ok('Wrong password returns 401 INVALID_CREDENTIALS')

    // 4. GET /api/auth/me for Sara
    const meSaraRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${saraToken}` },
    })
    const meSaraJson = await meSaraRes.json()
    assert.strictEqual(meSaraRes.status, 200)
    assert.strictEqual(meSaraJson.data.user.email, 'sara@demo.com')
    assert.strictEqual(meSaraJson.data.user.onboardingCompleted, true)
    ok('GET /api/auth/me for client returns onboardingCompleted: true')

    // 5. Login as specialist (Mona)
    const loginMonaRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'mona@demo.com', password: 'demo1234' }),
    })
    const loginMonaJson = await loginMonaRes.json()
    assert.strictEqual(loginMonaRes.status, 200)
    assert.strictEqual(loginMonaJson.data.user.role, 'specialist')
    assert.strictEqual(loginMonaJson.data.user.approvalStatus, 'approved')
    const monaToken = loginMonaJson.data.token
    ok('Specialist login succeeds (Mona, PT approved)')

    // 6. GET /api/auth/me for Mona
    const meMonaRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${monaToken}` },
    })
    const meMonaJson = await meMonaRes.json()
    assert.strictEqual(meMonaRes.status, 200)
    assert.strictEqual(meMonaJson.data.user.role, 'specialist')
    assert.strictEqual(meMonaJson.data.user.approvalStatus, 'approved')
    ok('GET /api/auth/me for specialist returns approvalStatus')

    // 7. Register new client
    const uniqueEmail = `test.client.${Date.now()}@example.com`
    const registerClientRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Client',
        email: uniqueEmail,
        password: 'password1234',
        role: 'client',
      }),
    })
    const registerClientJson = await registerClientRes.json()
    assert.strictEqual(registerClientRes.status, 201)
    assert.ok(registerClientJson.data.token)
    assert.strictEqual(registerClientJson.data.user.email, uniqueEmail)
    assert.strictEqual(registerClientJson.data.user.onboardingCompleted, false)
    const newClientToken = registerClientJson.data.token
    ok('Register new client succeeds (onboardingCompleted: false)')

    // 8. Register new specialist
    const uniqueSpecEmail = `test.spec.${Date.now()}@example.com`
    const registerSpecRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Dr. Test Spec',
        email: uniqueSpecEmail,
        password: 'password1234',
        role: 'specialist',
        type: 'nutritionist',
        credentials: 'MSc Nutrition',
        city: 'Giza',
        rateEgp: 600,
      }),
    })
    const registerSpecJson = await registerSpecRes.json()
    assert.strictEqual(registerSpecRes.status, 201)
    assert.strictEqual(registerSpecJson.data.user.role, 'specialist')
    assert.strictEqual(registerSpecJson.data.user.approvalStatus, 'pending')
    ok('Register new specialist starts with approvalStatus: pending')

    // 9. Register duplicate email
    const duplicateRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sara Duplicate',
        email: 'sara@demo.com',
        password: 'password1234',
      }),
    })
    const duplicateJson = await duplicateRes.json()
    assert.strictEqual(duplicateRes.status, 409)
    assert.strictEqual(duplicateJson.error.code, 'EMAIL_IN_USE')
    ok('Register duplicate email returns 409 EMAIL_IN_USE')

    // 10. Role check: Client calls specialist endpoint -> 403 FORBIDDEN
    const clientForbiddenRes = await fetch(`${baseUrl}/specialist/clients`, {
      headers: { Authorization: `Bearer ${saraToken}` },
    })
    const clientForbiddenJson = await clientForbiddenRes.json()
    assert.strictEqual(clientForbiddenRes.status, 403)
    assert.strictEqual(clientForbiddenJson.error.code, 'FORBIDDEN')
    ok('Client calling specialist endpoint is rejected with 403 FORBIDDEN')

    // 11. Role check: Specialist calls specialist endpoint -> 200 OK
    const specAllowedRes = await fetch(`${baseUrl}/specialist/clients`, {
      headers: { Authorization: `Bearer ${monaToken}` },
    })
    const specAllowedJson = await specAllowedRes.json()
    assert.strictEqual(specAllowedRes.status, 200)
    assert.ok(Array.isArray(specAllowedJson.data.clients))
    ok('Specialist calling specialist endpoint returns 200 and client list')

    // 12. GET /api/profile for Sara
    const saraProfileRes = await fetch(`${baseUrl}/profile`, {
      headers: { Authorization: `Bearer ${saraToken}` },
    })
    const saraProfileJson = await saraProfileRes.json()
    assert.strictEqual(saraProfileRes.status, 200)
    assert.strictEqual(saraProfileJson.data.profile.goal, 'lose_fat')
    assert.strictEqual(saraProfileJson.data.profile.daysPerWeek, 4)
    assert.strictEqual(saraProfileJson.data.profile.onboardingCompleted, true)
    assert.ok(saraProfileJson.data.injuries.length >= 1)
    assert.strictEqual(saraProfileJson.data.injuries[0].bodyArea, 'knee')
    ok("GET /api/profile returns Sara's profile and knee injury")

    // 13. Onboarding step 1 for new client: Goals & Days
    const step1Res = await fetch(`${baseUrl}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newClientToken}`,
      },
      body: JSON.stringify({
        goal: 'Recover from injury',
        daysPerWeek: 3,
      }),
    })
    const step1Json = await step1Res.json()
    assert.strictEqual(step1Res.status, 200)
    assert.strictEqual(step1Json.data.profile.goal, 'recover_injury')
    assert.strictEqual(step1Json.data.profile.daysPerWeek, 3)
    ok('Onboarding step 1 saved (goal normalized to recover_injury, days: 3)')

    // 14. Onboarding step 2 for new client: Age, Height, Weight, Activity
    const step2Res = await fetch(`${baseUrl}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newClientToken}`,
      },
      body: JSON.stringify({
        age: 29,
        heightCm: 175,
        weightKg: 80,
        activityLevel: 'Lightly active',
      }),
    })
    const step2Json = await step2Res.json()
    assert.strictEqual(step2Res.status, 200)
    assert.strictEqual(step2Json.data.profile.age, 29)
    assert.strictEqual(step2Json.data.profile.heightCm, 175)
    assert.strictEqual(step2Json.data.profile.weightKg, 80)
    assert.strictEqual(step2Json.data.profile.activityLevel, 'light')
    ok('Onboarding step 2 saved (anthropometrics & activity normalized to light)')

    // 15. Onboarding step 3 for new client: Injuries list replacement
    const step3Res = await fetch(`${baseUrl}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newClientToken}`,
      },
      body: JSON.stringify({
        injuries: [
          {
            bodyArea: 'Lower back',
            painLevel: 5,
            duration: '2 to 6 weeks',
            doctorSeen: 'Yes',
            note: 'Stiff after office work',
          },
        ],
      }),
    })
    const step3Json = await step3Res.json()
    assert.strictEqual(step3Res.status, 200)
    assert.strictEqual(step3Json.data.injuries.length, 1)
    assert.strictEqual(step3Json.data.injuries[0].bodyArea, 'lower_back')
    assert.strictEqual(step3Json.data.injuries[0].painLevel, 5)
    assert.strictEqual(step3Json.data.injuries[0].duration, 'weeks')
    assert.strictEqual(step3Json.data.injuries[0].doctorSeen, true)
    ok('Onboarding step 3 saved (injuries list replaced and normalized)')

    // 16. Onboarding step 4 for new client: Diet, allergies, meals, phone
    const step4Res = await fetch(`${baseUrl}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newClientToken}`,
      },
      body: JSON.stringify({
        dietStyle: 'high_protein',
        allergies: ['dairy', 'gluten'],
        mealsPerDay: 4,
        dislikedFoods: 'eggplant, lentils',
        phone: '+20 102 333 4444',
      }),
    })
    const step4Json = await step4Res.json()
    assert.strictEqual(step4Res.status, 200)
    assert.deepStrictEqual(step4Json.data.profile.allergies, ['dairy', 'gluten'])
    assert.strictEqual(step4Json.data.profile.mealsPerDay, 4)
    assert.strictEqual(step4Json.data.profile.phone, '+20 102 333 4444')
    ok('Onboarding step 4 saved (diet, allergies array, meals, phone)')

    // 17. Complete onboarding
    const completeRes = await fetch(`${baseUrl}/profile/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${newClientToken}` },
    })
    const completeJson = await completeRes.json()
    assert.strictEqual(completeRes.status, 200)
    assert.strictEqual(completeJson.data.onboardingCompleted, true)
    assert.ok(completeJson.data.planStartDate)
    ok('POST /api/profile/complete marks onboarding completed and sets planStartDate')

    // 18. Verify auth/me reports onboardingCompleted: true
    const meCompletedRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${newClientToken}` },
    })
    const meCompletedJson = await meCompletedRes.json()
    assert.strictEqual(meCompletedRes.status, 200)
    assert.strictEqual(meCompletedJson.data.user.onboardingCompleted, true)
    ok('GET /api/auth/me confirms onboardingCompleted is true')

    console.log(`\nAll ${passed} Phase 2 tests passed successfully!`)
  } finally {
    server.close()
  }
}

run().catch((err) => {
  console.error('\n❌ Test failed:', err)
  if (server) server.close()
  process.exit(1)
})

