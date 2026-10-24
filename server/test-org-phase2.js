// test-org-phase2.js — Automated test suite for Phase 2 follow-ups:
// 1. Org specialist hidden from public directory, slots and :id for outsiders.
// 2. Org specialist visible to members of the same organization.
// 3. Org member cannot book a platform specialist (403).
// 4. Individual cannot book an org specialist (403).
// 5. Org member cannot book an unassigned org specialist (403).
// 6. Org member CAN book an assigned org specialist (201).
// 7. Sponsored subscriptions excluded from finance MRR and transactions.
// 8. Org specialists absent from admin approval queue and payouts.
// 9. Platform admin cannot create or assign the org_admin role.

import assert from 'node:assert'
import app from './src/app.js'
import db from './src/db/connection.js'

const PORT = 4020
let server

async function run() {
  server = app.listen(PORT)
  const baseUrl = `http://localhost:${PORT}/api`

  console.log(`Starting Phase 2 Org Follow-up test suite on ${baseUrl}...\n`)

  let passed = 0
  function ok(msg) {
    passed++
    console.log(`  ✓ ${msg}`)
  }

  try {
    // Logins
    async function login(email, password = 'demo1234') {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      assert.strictEqual(res.status, 200, `Login failed for ${email}`)
      return data.data
    }

    const sara = await login('sara@demo.com')           // Individual client (organization_id NULL)
    const admin = await login('admin@demo.com')         // Platform admin
    const finance = await login('finance@demo.com')     // Finance officer
    const member1 = await login('member1@apex.com')     // Org member assigned to Tarek and Salma
    const member20 = await login('member20@apex.com')   // Org member assigned to Salma only

    const tarekRow = db.prepare("SELECT user_id FROM specialists WHERE user_id = (SELECT id FROM users WHERE email = 'tarek.org@apex.com')").get()
    const tarekId = tarekRow.user_id

    const monaRow = db.prepare("SELECT user_id FROM specialists WHERE user_id = (SELECT id FROM users WHERE email = 'mona@demo.com')").get()
    const monaId = monaRow.user_id

    // 1. Org specialist hidden from public directory
    const dirRes = await fetch(`${baseUrl}/specialists`)
    const dirData = await dirRes.json()
    assert.strictEqual(dirRes.status, 200)
    const hasOrgSpec = dirData.data.specialists.some((s) => s.id === tarekId)
    assert.strictEqual(hasOrgSpec, false, 'Public directory must not contain org specialist')
    ok('Org specialist is hidden from public specialists directory')

    // 2. Org specialist :id and slots return 404 to unauthenticated and outsiders
    const publicIdRes = await fetch(`${baseUrl}/specialists/${tarekId}`)
    assert.strictEqual(publicIdRes.status, 404, 'Public GET /:id for org specialist must return 404')

    const outsiderIdRes = await fetch(`${baseUrl}/specialists/${tarekId}`, {
      headers: { Authorization: `Bearer ${sara.token}` },
    })
    assert.strictEqual(outsiderIdRes.status, 404, 'Outsider GET /:id for org specialist must return 404')

    const outsiderSlotsRes = await fetch(`${baseUrl}/specialists/${tarekId}/slots`, {
      headers: { Authorization: `Bearer ${sara.token}` },
    })
    assert.strictEqual(outsiderSlotsRes.status, 404, 'Outsider GET /:id/slots for org specialist must return 404')
    ok('Org specialist :id and slots return 404 to unauthenticated callers and individual members')

    // 3. Org specialist :id and slots succeed for members of the same org
    const memberIdRes = await fetch(`${baseUrl}/specialists/${tarekId}`, {
      headers: { Authorization: `Bearer ${member1.token}` },
    })
    assert.strictEqual(memberIdRes.status, 200, 'Org member must be able to view their org specialist')
    const memberSlotsRes = await fetch(`${baseUrl}/specialists/${tarekId}/slots`, {
      headers: { Authorization: `Bearer ${member1.token}` },
    })
    assert.strictEqual(memberSlotsRes.status, 200, 'Org member must be able to view their org specialist slots')
    const memberSlotsData = await memberSlotsRes.json()
    assert.ok(memberSlotsData.data.slots.length > 0, 'Org specialist must have bookable slots')
    ok('Org specialist profile and slots are accessible to members of the same organization')

    // 4. Org member cannot book a platform specialist (403)
    const nowIso = new Date().toISOString()
    const monaSlot = db.prepare("SELECT id FROM availability_slots WHERE specialist_id = ? AND is_booked = 0 AND starts_at > ? ORDER BY starts_at ASC LIMIT 1").get(monaId, nowIso)
    assert.ok(monaSlot, 'Platform specialist Mona must have an open future slot')

    const bookPlatformRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${member1.token}` },
      body: JSON.stringify({
        specialistId: monaId,
        slotId: monaSlot.id,
        sessionType: 'video',
      }),
    })
    assert.strictEqual(bookPlatformRes.status, 403, 'Org member booking platform specialist must return 403')
    ok('Org member cannot book platform specialist (403 FORBIDDEN)')

    // 5. Individual member cannot book an org specialist (403)
    const tarekSlot = db.prepare("SELECT id FROM availability_slots WHERE specialist_id = ? AND is_booked = 0 AND starts_at > ? ORDER BY starts_at ASC LIMIT 1").get(tarekId, nowIso)
    assert.ok(tarekSlot, 'Coach Tarek must have an open future slot')

    const individualBookOrgRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sara.token}` },
      body: JSON.stringify({
        specialistId: tarekId,
        slotId: tarekSlot.id,
        sessionType: 'video',
      }),
    })
    assert.strictEqual(individualBookOrgRes.status, 403, 'Individual member booking org specialist must return 403')
    ok('Individual member cannot book org specialist (403 FORBIDDEN)')

    // 6. Org member cannot book an unassigned org specialist (403)
    // member20 is NOT assigned to Coach Tarek
    const unassignedBookRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${member20.token}` },
      body: JSON.stringify({
        specialistId: tarekId,
        slotId: tarekSlot.id,
        sessionType: 'video',
      }),
    })
    assert.strictEqual(unassignedBookRes.status, 403, 'Org member booking unassigned org specialist must return 403')
    ok('Org member cannot book unassigned org specialist (403 FORBIDDEN)')

    // 7. Org member CAN book an assigned org specialist (201)
    // member1 is assigned to Coach Tarek
    const assignedBookRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${member1.token}` },
      body: JSON.stringify({
        specialistId: tarekId,
        slotId: tarekSlot.id,
        sessionType: 'video',
        notes: 'Pre-season athletic mobility check',
      }),
    })
    assert.strictEqual(assignedBookRes.status, 201, 'Org member booking assigned org specialist must return 201')
    ok('Org member can book assigned org specialist (201 Created)')

    // 8. Finance isolation: sponsored subscriptions excluded from MRR and transactions
    const finRes = await fetch(`${baseUrl}/finance/overview`, {
      headers: { Authorization: `Bearer ${finance.token}` },
    })
    const finData = await finRes.json()
    assert.strictEqual(finRes.status, 200)

    // Expected paid subscriptions MRR: Sara(1499) + Omar(399) + Laila(899) + Yasin(1499) + Individual(399) = 4695
    assert.strictEqual(finData.data.metrics.mrr, 4695, 'MRR must only sum self-paid subscriptions')

    const txRes = await fetch(`${baseUrl}/finance/transactions`, {
      headers: { Authorization: `Bearer ${finance.token}` },
    })
    const txData = await txRes.json()
    const hasSponsoredInFeed = txData.data.transactions.some((t) => t.description && t.description.toLowerCase().includes('apex'))
    assert.strictEqual(hasSponsoredInFeed, false, 'Transaction feed must exclude sponsored subscriptions')
    ok('Sponsored subscriptions are excluded from finance MRR and transaction feeds')

    // 9. Org specialists absent from platform payouts and admin approval queue
    const payoutsRes = await fetch(`${baseUrl}/finance/payouts`, {
      headers: { Authorization: `Bearer ${finance.token}` },
    })
    const payoutsData = await payoutsRes.json()
    assert.strictEqual(payoutsRes.status, 200)
    const hasOrgInPayouts = payoutsData.data.specialists.some((s) => s.userId === tarekId)
    assert.strictEqual(hasOrgInPayouts, false, 'Org specialist must be excluded from platform payouts')

    const adminQueueRes = await fetch(`${baseUrl}/admin/specialists`, {
      headers: { Authorization: `Bearer ${admin.token}` },
    })
    const adminQueueData = await adminQueueRes.json()
    assert.strictEqual(adminQueueRes.status, 200)
    const hasOrgInAdminQueue = adminQueueData.data.specialists.some((s) => s.id === tarekId)
    assert.strictEqual(hasOrgInAdminQueue, false, 'Org specialist must be excluded from admin approval queue')
    ok('Org specialists are absent from the admin approval queue and platform payouts')

    // 10. Platform admin routes cannot create or assign org_admin role
    const createOrgAdminRes = await fetch(`${baseUrl}/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
      body: JSON.stringify({
        name: 'Malicious Admin',
        email: 'malicious@admin.com',
        password: 'password123',
        role: 'org_admin',
      }),
    })
    assert.ok(createOrgAdminRes.status === 400 || createOrgAdminRes.status === 403, 'Admin cannot create user with role org_admin')

    const updateRoleRes = await fetch(`${baseUrl}/admin/users/${sara.user.id}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
      body: JSON.stringify({ role: 'org_admin' }),
    })
    assert.ok(updateRoleRes.status === 400 || updateRoleRes.status === 403, 'Admin cannot assign role org_admin')
    ok('Platform admin routes cannot create or assign the org_admin role')

    console.log(`\nAll ${passed} Phase 2 Org Follow-up tests passed successfully!`)
  } finally {
    server.close()
  }
}

run().catch((err) => {
  console.error('Test suite failed:', err)
  if (server) server.close()
  process.exit(1)
})
