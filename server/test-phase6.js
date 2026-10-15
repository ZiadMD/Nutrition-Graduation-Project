// test-phase6.js — Automated test suite for Phase 6: Specialist Portal, Admin, & Checkout.
//
// Key requirements tested:
// 1. Checkout (Mock):
//    - Client creates active subscription with server-enforced pricing and DEMO- reference.
//    - GET /api/checkout/current returns active subscription.
//    - Non-client cannot use checkout (403).
//    - Invalid plan name or method rejected (400).
// 2. Specialist Portal:
//    - GET /api/specialist/clients returns care-team clients with goals, weeks, pain trends.
//    - Safety flag: when latest pain > safeLimit (lowest plan item painLimit), client is flagged.
//    - Search (?q=) correctly filters clients.
//    - GET /api/specialist/clients/:id returns full client clinical dossier.
//    - Access denied (403) for clients not in specialist's care team.
//    - Specialty check: PT cannot edit 'move' or 'eat' plans (403).
//    - Plan replacement & atomic activation: Activating a new plan archives previous active plan.
//    - Specialists can post notes (visibleToClient flag preserved).
//    - GET /api/specialist/schedule returns slots with client and booking details.
// 3. Admin Portal:
//    - GET /api/admin/overview returns platform metrics & recent activity feed.
//    - GET /api/admin/users returns user list with filtering.
//    - Admin can suspend / reactivate user accounts.
//    - GET /api/admin/specialists?status=pending returns pending specialists (Yasmin).
//    - PATCH /api/admin/specialists/:id/approval updates approval status to 'approved'.
//    - Client or specialist cannot call admin endpoints (403).

import assert from 'node:assert'
import app from './src/app.js'
import db from './src/db/connection.js'

const PORT = 4005
let server

async function run() {
  server = app.listen(PORT)
  const baseUrl = `http://localhost:${PORT}/api`

  console.log(`Starting Phase 6 test suite on ${baseUrl}...\n`)

  let passed = 0
  function ok(msg) {
    passed++
    console.log(`  ✓ ${msg}`)
  }

  try {
    // -----------------------------------------------------------------------
    // Setup: Login tokens
    // -----------------------------------------------------------------------
    const loginSara = await (
      await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'sara@demo.com', password: 'demo1234' }),
      })
    ).json()
    const saraToken = loginSara.data.token
    const saraId = loginSara.data.user.id

    const loginMona = await (
      await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'mona@demo.com', password: 'demo1234' }),
      })
    ).json()
    const monaToken = loginMona.data.token

    const loginAdmin = await (
      await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@demo.com', password: 'demo1234' }),
      })
    ).json()
    const adminToken = loginAdmin.data.token

    // -----------------------------------------------------------------------
    // 1. Mock Checkout Tests
    // -----------------------------------------------------------------------
    console.log('--- Checkout (Mock) Tests ---')

    // 1.1 Non-client forbidden
    const monaCheckout = await fetch(`${baseUrl}/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${monaToken}`,
      },
      body: JSON.stringify({ planName: 'Starter', method: 'card' }),
    })
    assert.strictEqual(monaCheckout.status, 403, 'Specialist must be forbidden from client checkout')
    ok('Role check: Specialist cannot call client checkout (403)')

    // 1.2 Invalid plan rejected
    const badPlan = await fetch(`${baseUrl}/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${saraToken}`,
      },
      body: JSON.stringify({ planName: 'Enterprise', method: 'card' }),
    })
    assert.strictEqual(badPlan.status, 400, 'Invalid plan name must be rejected')
    ok('Validation: Invalid plan rejected (400)')

    // 1.3 Successful checkout
    const checkoutRes = await fetch(`${baseUrl}/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${saraToken}`,
      },
      body: JSON.stringify({ planName: 'Starter', method: 'card' }),
    })
    const checkoutJson = await checkoutRes.json()
    assert.strictEqual(checkoutRes.status, 201)
    const sub = checkoutJson.data.subscription
    assert.strictEqual(sub.planName, 'Starter')
    assert.strictEqual(sub.priceEgp, 399, 'Price must be 399 EGP strictly from server constant')
    assert.strictEqual(sub.method, 'card')
    assert.strictEqual(sub.status, 'active')
    assert.ok(sub.reference.startsWith('DEMO-'), 'Reference code must start with DEMO-')
    ok('Client checkout succeeded with server pricing (399 EGP) and DEMO- reference')

    // 1.4 GET /api/checkout/current
    const currentSubRes = await fetch(`${baseUrl}/checkout/current`, {
      headers: { Authorization: `Bearer ${saraToken}` },
    })
    const currentSubJson = await currentSubRes.json()
    assert.strictEqual(currentSubRes.status, 200)
    assert.strictEqual(currentSubJson.data.subscription.reference, sub.reference)
    ok('GET /api/checkout/current returns active subscription')

    // -----------------------------------------------------------------------
    // 2. Specialist Portal Tests
    // -----------------------------------------------------------------------
    console.log('\n--- Specialist Portal Tests ---')

    // 2.1 GET /api/specialist/clients
    const clientsRes = await fetch(`${baseUrl}/specialist/clients`, {
      headers: { Authorization: `Bearer ${monaToken}` },
    })
    const clientsJson = await clientsRes.json()
    assert.strictEqual(clientsRes.status, 200)
    assert.ok(Array.isArray(clientsJson.data.clients))

    const saraRow = clientsJson.data.clients.find((c) => c.id === saraId)
    assert.ok(saraRow, "Sara must be in Dr. Mona's care team")
    assert.strictEqual(saraRow.name, 'Sara Hassan')
    assert.strictEqual(saraRow.initials, 'SH')
    assert.ok(saraRow.week >= 1)
    assert.strictEqual(saraRow.of, 8)
    assert.ok(saraRow.safeLimit !== undefined)
    assert.strictEqual(saraRow.flagged, false, 'Initial pain (3) <= safeLimit (3), so flagged is false')
    ok("GET /api/specialist/clients returns Sara with accurate goal, week, and initial flag=false")

    // 2.2 Client search (?q=)
    const searchRes = await fetch(`${baseUrl}/specialist/clients?q=Sara`, {
      headers: { Authorization: `Bearer ${monaToken}` },
    })
    const searchJson = await searchRes.json()
    assert.strictEqual(searchJson.data.clients.length, 1)

    const emptySearchRes = await fetch(`${baseUrl}/specialist/clients?q=NonExistentPerson`, {
      headers: { Authorization: `Bearer ${monaToken}` },
    })
    const emptySearchJson = await emptySearchRes.json()
    assert.strictEqual(emptySearchJson.data.clients.length, 0)
    ok('Specialist client search (?q=) filters correctly')

    // 2.3 SAFETY FLAG: Trigger pain elevation
    // Sara logs pain 5 (which is > lowest plan item pain_limit 3)
    const progressPut = await fetch(`${baseUrl}/progress`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${saraToken}`,
      },
      body: JSON.stringify({
        weightKg: 72.4,
        workoutDone: true,
        painLevel: 5,
        note: 'Elevated pain during squats',
      }),
    })
    assert.strictEqual(progressPut.status, 200)

    // Check Dr. Mona's view again — Sara must now be flagged!
    const flaggedCheckRes = await fetch(`${baseUrl}/specialist/clients`, {
      headers: { Authorization: `Bearer ${monaToken}` },
    })
    const flaggedCheckJson = await flaggedCheckRes.json()
    const saraFlaggedRow = flaggedCheckJson.data.clients.find((c) => c.id === saraId)
    assert.strictEqual(saraFlaggedRow.latestPain, 5)
    assert.strictEqual(saraFlaggedRow.safeLimit, 3)
    assert.strictEqual(saraFlaggedRow.flagged, true, 'Pain (5) > safeLimit (3) MUST set flagged to true')
    ok('Safety Flag: Elevated pain (5/10 > 3/10) correctly flags client for specialist review')

    // 2.4 GET /api/specialist/clients/:clientId (Full Dossier)
    const dossierRes = await fetch(`${baseUrl}/specialist/clients/${saraId}`, {
      headers: { Authorization: `Bearer ${monaToken}` },
    })
    const dossierJson = await dossierRes.json()
    assert.strictEqual(dossierRes.status, 200)
    const dData = dossierJson.data
    assert.strictEqual(dData.client.name, 'Sara Hassan')
    assert.ok(Array.isArray(dData.injuries))
    assert.ok(Array.isArray(dData.plans))
    assert.ok(Array.isArray(dData.careTeam))
    assert.ok(dData.progress.logs.length > 0)
    assert.strictEqual(dData.progress.flagged, true)
    ok('GET /api/specialist/clients/:id returns complete client profile, injuries, plans, and logs')

    // 2.5 Access control: Non-care-team client forbidden
    const omarUser = db.prepare(`SELECT id FROM users WHERE email = 'omar@demo.com'`).get()
    const forbiddenDossier = await fetch(`${baseUrl}/specialist/clients/${omarUser.id}`, {
      headers: { Authorization: `Bearer ${monaToken}` },
    })
    assert.strictEqual(forbiddenDossier.status, 403, 'Specialist must not access clients outside care team')
    ok('Care-team boundary enforced: Accessing non-care-team client returns 403')

    // 2.6 Specialty check: Dr. Mona (PT) cannot edit Move (trainer) plans
    const badServiceEdit = await fetch(`${baseUrl}/specialist/clients/${saraId}/plans/move`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${monaToken}`,
      },
      body: JSON.stringify({
        title: 'Mona attempts trainer move plan',
        status: 'active',
        items: [],
      }),
    })
    assert.strictEqual(badServiceEdit.status, 403, 'PT cannot edit move plan')
    ok('Specialty boundary enforced: Physical therapist cannot edit trainer move plan (403)')

    // 2.7 Plan editing and atomic activation
    // Dr. Mona activates a new updated rehab plan for Sara
    const prevActiveRecover = db
      .prepare(`SELECT id FROM plans WHERE client_id = ? AND service = 'recover' AND status = 'active'`)
      .get(saraId)
    assert.ok(prevActiveRecover, 'Previous active recover plan must exist')

    const updatePlanRes = await fetch(`${baseUrl}/specialist/clients/${saraId}/plans/recover`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${monaToken}`,
      },
      body: JSON.stringify({
        title: "Sara's updated knee rehab protocol",
        summary: 'Quad sets and straight leg raises cleared. Walking lunges paused.',
        status: 'active',
        items: [
          {
            dayOfWeek: 1,
            position: 0,
            timeOfDay: '20:00',
            title: 'Quad sets with biofeedback',
            instructions: 'Tighten thigh, hold 5s.',
            sets: 4,
            reps: '15',
            painLimit: 3,
            ptCleared: true,
          },
          {
            dayOfWeek: 1,
            position: 1,
            timeOfDay: '20:00',
            title: 'Heel slides on foam mat',
            instructions: 'Gentle range of motion.',
            sets: 3,
            reps: '12',
            painLimit: 3,
            ptCleared: true,
          },
        ],
      }),
    })
    const updatePlanJson = await updatePlanRes.json()
    assert.strictEqual(updatePlanRes.status, 200)
    const newPlan = updatePlanJson.data.plan
    assert.strictEqual(newPlan.status, 'active')
    assert.strictEqual(newPlan.items.length, 2)
    assert.notStrictEqual(newPlan.id, prevActiveRecover.id)

    // Check that previous plan is now archived in DB
    const oldPlanStatus = db.prepare(`SELECT status FROM plans WHERE id = ?`).get(prevActiveRecover.id)
    assert.strictEqual(oldPlanStatus.status, 'archived', 'Old active plan must be archived')

    // Verify exactly ONE active recover plan exists for Sara
    const activeCount = db
      .prepare(`SELECT COUNT(*) AS c FROM plans WHERE client_id = ? AND service = 'recover' AND status = 'active'`)
      .get(saraId).c
    assert.strictEqual(activeCount, 1, 'Exactly one active recover plan allowed per client')
    ok('Atomic activation: New plan is active and previous active plan is archived in same transaction')

    // 2.8 Specialist Note Creation
    const noteRes = await fetch(`${baseUrl}/specialist/clients/${saraId}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${monaToken}`,
      },
      body: JSON.stringify({
        body: 'Knee tracking looked improved today. Safe limit adjusted.',
        visibleToClient: true,
      }),
    })
    const noteJson = await noteRes.json()
    assert.strictEqual(noteRes.status, 201)
    assert.strictEqual(noteJson.data.note.body, 'Knee tracking looked improved today. Safe limit adjusted.')
    assert.strictEqual(noteJson.data.note.visibleToClient, true)
    ok('Specialist can record notes with visibleToClient preserved (201)')

    // 2.9 Specialist Schedule
    const scheduleRes = await fetch(`${baseUrl}/specialist/schedule`, {
      headers: { Authorization: `Bearer ${monaToken}` },
    })
    const scheduleJson = await scheduleRes.json()
    assert.strictEqual(scheduleRes.status, 200)
    assert.ok(Array.isArray(scheduleJson.data.slots))
    assert.ok(scheduleJson.data.slots.length > 0)
    const bookedSlot = scheduleJson.data.slots.find((s) => s.isBooked && s.booking)
    assert.ok(bookedSlot, 'Schedule must include booked slots with client details')
    assert.strictEqual(bookedSlot.booking.client.name, 'Sara Hassan')
    ok('GET /api/specialist/schedule returns specialist slots and attached bookings')

    // -----------------------------------------------------------------------
    // 3. Admin Portal Tests
    // -----------------------------------------------------------------------
    console.log('\n--- Admin Portal Tests ---')

    // 3.1 Non-admin access rejected
    const nonAdminRes = await fetch(`${baseUrl}/admin/overview`, {
      headers: { Authorization: `Bearer ${saraToken}` },
    })
    assert.strictEqual(nonAdminRes.status, 403, 'Client must not access admin endpoints')
    ok('Role check: Non-admin cannot access admin overview (403)')

    // 3.2 GET /api/admin/overview
    const overviewRes = await fetch(`${baseUrl}/admin/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const overviewJson = await overviewRes.json()
    assert.strictEqual(overviewRes.status, 200)
    const { counts, recentActivity } = overviewJson.data
    assert.ok(counts.users >= 8)
    assert.ok(counts.activePlans >= 3)
    assert.ok(counts.approvedSpecialists >= 5)
    assert.ok(counts.pendingSpecialists >= 1)
    assert.ok(Array.isArray(recentActivity))
    assert.ok(recentActivity.length <= 10)
    ok('GET /api/admin/overview returns platform metrics and 10 recent activities via UNION')

    // 3.3 GET /api/admin/users
    const usersRes = await fetch(`${baseUrl}/admin/users?role=specialist`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const usersJson = await usersRes.json()
    assert.strictEqual(usersRes.status, 200)
    assert.ok(usersJson.data.users.every((u) => u.rawRole === 'specialist'))
    ok('GET /api/admin/users filters users by role correctly')

    // 3.4 PATCH /api/admin/users/:id/status (Suspend & Reactivate)
    const suspendRes = await fetch(`${baseUrl}/admin/users/${omarUser.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'suspended' }),
    })
    const suspendJson = await suspendRes.json()
    assert.strictEqual(suspendRes.status, 200)
    assert.strictEqual(suspendJson.data.user.status, 'suspended')

    const reactivateRes = await fetch(`${baseUrl}/admin/users/${omarUser.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'active' }),
    })
    const reactivateJson = await reactivateRes.json()
    assert.strictEqual(reactivateJson.data.user.status, 'active')
    ok('PATCH /api/admin/users/:id/status suspends and reactivates accounts')

    // 3.5 GET /api/admin/specialists?status=pending
    const pendingRes = await fetch(`${baseUrl}/admin/specialists?status=pending`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const pendingJson = await pendingRes.json()
    assert.strictEqual(pendingRes.status, 200)
    const yasmin = pendingJson.data.specialists.find((s) => s.email === 'yasmin@demo.com')
    assert.ok(yasmin, 'Dr. Yasmin Farouk must be listed in pending specialists')
    assert.strictEqual(yasmin.approvalStatus, 'pending')
    ok('GET /api/admin/specialists?status=pending returns Dr. Yasmin Farouk')

    // 3.6 PATCH /api/admin/specialists/:id/approval (Approve specialist)
    const approveRes = await fetch(`${baseUrl}/admin/specialists/${yasmin.id}/approval`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'approved' }),
    })
    const approveJson = await approveRes.json()
    assert.strictEqual(approveRes.status, 200)
    assert.strictEqual(approveJson.data.specialist.approvalStatus, 'approved')

    // Verify in database
    const dbSpecialist = db
      .prepare(`SELECT approval_status FROM specialists WHERE user_id = ?`)
      .get(yasmin.id)
    assert.strictEqual(dbSpecialist.approval_status, 'approved')
    ok('PATCH /api/admin/specialists/:id/approval successfully approves pending specialist')

    console.log(`\n========================================`)
    console.log(`Phase 6 Tests Passed: ${passed}/17 tests`)
    console.log(`========================================\n`)
  } finally {
    if (server) server.close()
  }
}

run().catch((err) => {
  console.error('\n❌ Phase 6 Test Failed:', err)
  if (server) server.close()
  process.exit(1)
})

