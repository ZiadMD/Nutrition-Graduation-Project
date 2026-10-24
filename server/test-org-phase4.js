// test-org-phase4.js — Automated test suite for Phase 4: Org Admin Routes & Member Additions.
//
// Key requirements tested:
// 1. Every /api/org/* route's happy path (info, members with ?q=, specialists, create specialist, assign, end assign, stats).
// 2. Multi-tenant isolation: Org 2 cannot see or modify Org 1's members, specialists or assignments (404s).
// 3. Assigning across organizations fails (404).
// 4. FIELD_ALREADY_ASSIGNED rule (409) when assigning a specialist of the same field.
// 5. Idempotent assign (200) and reactivate ended assignment (201).
// 6. Newly created org specialist can log in and is auto-approved.
// 7. Newly created org specialist has bookable availability slots.
// 8. Ending an assignment removes that client from GET /api/specialist/clients.
// 9. client and specialist roles get 403 on /api/org/* routes.
// 10. org_admin gets 403 on /api/plans, /api/profile, /api/progress, /api/ai/plan, and /api/specialist/*.
// 11. Privacy scanner: confirms none of the forbidden health/plan keys appear anywhere in /api/org/* responses.
// 12. POST /api/checkout returns 409 ALREADY_SPONSORED for an org member.
// 13. GET /api/my/specialists works for both individual (Sara) and org member (member1).
// 14. GET /api/checkout/current includes source and organizationName for sponsored members.

import assert from 'node:assert'
import app from './src/app.js'
import db from './src/db/connection.js'

const PORT = 4030
let server

const FORBIDDEN_KEYS = [
  'goal',
  'weight_kg',
  'weightKg',
  'injuries',
  'allergies',
  'plan',
  'plans',
  'items',
  'notes',
  'painLevel',
  'note',
  'summary',
]

function scanForbiddenKeys(obj, forbiddenList, path = '') {
  if (!obj || typeof obj !== 'object') return
  for (const [key, val] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key
    assert.ok(
      !forbiddenList.includes(key),
      `Privacy violation: forbidden key "${key}" found in org response at path "${currentPath}"`
    )
    if (typeof val === 'object' && val !== null) {
      scanForbiddenKeys(val, forbiddenList, currentPath)
    }
  }
}

async function run() {
  server = app.listen(PORT)
  const baseUrl = `http://localhost:${PORT}/api`

  console.log(`Starting Phase 4 Org Admin & Member Routes test suite on ${baseUrl}...\n`)

  let passed = 0
  function ok(msg) {
    passed++
    console.log(`  ✓ ${msg}`)
  }

  const ts = Date.now()

  try {
    // -------------------------------------------------------------
    // Setup: Login tokens
    // -------------------------------------------------------------
    // Apex Org Admin
    const apexAdminRes = await (
      await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@apex.com', password: 'demo1234' }),
      })
    ).json()
    const apexAdminToken = apexAdminRes.data.token
    const apexOrgId = apexAdminRes.data.organization.id

    // Individual Member (Sara)
    const saraRes = await (
      await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'sara@demo.com', password: 'demo1234' }),
      })
    ).json()
    const saraToken = saraRes.data.token
    const saraId = saraRes.data.user.id

    // Org Member 1 (member1@apex.com)
    const member1Res = await (
      await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'member1@apex.com', password: 'demo1234' }),
      })
    ).json()
    const member1Token = member1Res.data.token
    const member1Id = member1Res.data.user.id

    // Org Specialist (Coach Tarek - trainer / Move)
    const tarekRes = await (
      await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'tarek.org@apex.com', password: 'demo1234' }),
      })
    ).json()
    const tarekToken = tarekRes.data.token
    const tarekId = tarekRes.data.user.id

    // Org Specialist (Dr Salma - physical_therapist / Recover)
    const salmaUser = db.prepare('SELECT id FROM users WHERE email = ?').get('salma.org@apex.com')
    const salmaId = salmaUser.id

    // Clean up any test-specific care_team rows on member1 before starting so runs are idempotent
    db.prepare("DELETE FROM care_team WHERE client_id = ? AND specialist_id NOT IN (?, ?)").run(member1Id, tarekId, salmaId)
    db.prepare("UPDATE care_team SET status = 'active', ended_at = NULL WHERE client_id = ? AND specialist_id IN (?, ?)").run(member1Id, tarekId, salmaId)

    // -------------------------------------------------------------
    // 1. GET /api/org/info
    // -------------------------------------------------------------
    const infoRes = await fetch(`${baseUrl}/org/info`, {
      headers: { Authorization: `Bearer ${apexAdminToken}` },
    })
    assert.strictEqual(infoRes.status, 200, 'GET /api/org/info must return 200')
    const infoData = await infoRes.json()
    scanForbiddenKeys(infoData, FORBIDDEN_KEYS)

    assert.strictEqual(infoData.data.name, 'Apex Athletic Club')
    assert.strictEqual(infoData.data.seatLimit, 30)
    assert.strictEqual(infoData.data.seatsUsed, 20)
    assert.strictEqual(infoData.data.seatsRemaining, 10)
    assert.strictEqual(infoData.data.inviteCode, 'APEX2026')
    ok('GET /api/org/info returns complete organization details with seatsRemaining')

    // -------------------------------------------------------------
    // 2. GET /api/org/members (with active assigned specialists and ?q= search)
    // -------------------------------------------------------------
    const membersRes = await fetch(`${baseUrl}/org/members`, {
      headers: { Authorization: `Bearer ${apexAdminToken}` },
    })
    assert.strictEqual(membersRes.status, 200)
    const membersData = await membersRes.json()
    scanForbiddenKeys(membersData, FORBIDDEN_KEYS)

    assert.strictEqual(membersData.data.members.length, 20, 'Apex must list 20 members')
    const member1InList = membersData.data.members.find((m) => m.id === member1Id)
    assert.ok(member1InList, 'member1 must be present in members list')
    assert.strictEqual(member1InList.lastActiveAt, undefined, 'lastActiveAt must be removed from GET /api/org/members')
    assert.ok(Array.isArray(member1InList.assignedSpecialists), 'assignedSpecialists must be an array')
    assert.ok(member1InList.assignedSpecialists.length > 0, 'member1 must have active assigned specialists')
    const assignedTarek = member1InList.assignedSpecialists.find((s) => s.specialistId === tarekId)
    assert.ok(assignedTarek, 'Tarek must be assigned to member1')
    assert.strictEqual(assignedTarek.field, 'Move', 'Trainer type must derive to field Move')

    // Test ?q= filter
    const searchRes = await fetch(`${baseUrl}/org/members?q=member10`, {
      headers: { Authorization: `Bearer ${apexAdminToken}` },
    })
    const searchData = await searchRes.json()
    scanForbiddenKeys(searchData, FORBIDDEN_KEYS)
    assert.strictEqual(searchData.data.members.length, 1, 'Search for member10 must return exactly 1 member')
    assert.strictEqual(searchData.data.members[0].email, 'member10@apex.com')
    ok('GET /api/org/members returns sanitized members with active care team and handles ?q= search')

    // -------------------------------------------------------------
    // 3. GET /api/org/specialists
    // -------------------------------------------------------------
    const specialistsRes = await fetch(`${baseUrl}/org/specialists`, {
      headers: { Authorization: `Bearer ${apexAdminToken}` },
    })
    assert.strictEqual(specialistsRes.status, 200)
    const specialistsData = await specialistsRes.json()
    scanForbiddenKeys(specialistsData, FORBIDDEN_KEYS)

    assert.ok(specialistsData.data.specialists.length >= 2, 'Apex must have at least Coach Tarek and Dr. Salma')
    const tarekInList = specialistsData.data.specialists.find((s) => s.specialistId === tarekId)
    assert.ok(tarekInList)
    assert.strictEqual(tarekInList.field, 'Move')
    assert.strictEqual(typeof tarekInList.activeClientCount, 'number')
    assert.ok(tarekInList.activeClientCount > 0, 'Coach Tarek has active clients')
    ok('GET /api/org/specialists returns org specialists with activeClientCount and derived field')

    // -------------------------------------------------------------
    // 4. POST /api/org/specialists (create new specialist + auto-approved + slots)
    // -------------------------------------------------------------
    const newSpecialistEmail = `nadia.nutrition.${ts}@apex.com`
    const createSpRes = await fetch(`${baseUrl}/org/specialists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apexAdminToken}` },
      body: JSON.stringify({
        name: 'Dr. Nadia Nutritionist',
        email: newSpecialistEmail,
        password: 'Password123!',
        type: 'nutritionist',
        bio: 'Clinical nutrition specialist for endurance and corporate athletes.',
        credentials: 'MSc Clinical Nutrition, Cairo University',
      }),
    })
    assert.strictEqual(createSpRes.status, 201, 'Creating org specialist must return 201')
    const createSpData = await createSpRes.json()
    scanForbiddenKeys(createSpData, FORBIDDEN_KEYS)

    assert.strictEqual(createSpData.data.specialist.name, 'Dr. Nadia Nutritionist')
    assert.strictEqual(createSpData.data.specialist.field, 'Eat')
    assert.strictEqual(createSpData.data.specialist.approvalStatus, 'approved')
    assert.strictEqual(createSpData.data.specialist.password, undefined, 'Password must not be returned')
    assert.strictEqual(createSpData.data.specialist.password_hash, undefined, 'Password hash must not be returned')

    const newSpId = createSpData.data.specialist.specialistId

    // Verify DB: auto-approved and rate_egp is 0
    const spRow = db.prepare('SELECT * FROM specialists WHERE user_id = ?').get(newSpId)
    assert.strictEqual(spRow.organization_id, apexOrgId)
    assert.strictEqual(spRow.approval_status, 'approved')
    assert.strictEqual(spRow.rate_egp, 0)

    // Verify slots were generated
    const slotsCount = db.prepare('SELECT COUNT(*) AS count FROM availability_slots WHERE specialist_id = ?').get(newSpId)
    assert.ok(slotsCount.count > 0, 'New specialist must have generated weekday availability slots')

    // Verify new specialist can log in
    const spLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newSpecialistEmail, password: 'Password123!' }),
    })
    assert.strictEqual(spLoginRes.status, 200, 'Newly created specialist must be able to log in')
    const spLoginData = await spLoginRes.json()
    assert.strictEqual(spLoginData.data.user.role, 'specialist')
    assert.strictEqual(spLoginData.data.organization.name, 'Apex Athletic Club')
    ok('POST /api/org/specialists creates auto-approved specialist with generated slots who can log in')

    // -------------------------------------------------------------
    // 5. POST /api/org/assignments
    // -------------------------------------------------------------
    // Assign Nadia (Eat) to member1 (who currently has Move and Recover)
    const assignNadiaRes = await fetch(`${baseUrl}/org/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apexAdminToken}` },
      body: JSON.stringify({ memberId: member1Id, specialistId: newSpId }),
    })
    assert.strictEqual(assignNadiaRes.status, 201, 'Assigning Eat specialist to member1 must return 201')
    const assignNadiaData = await assignNadiaRes.json()
    scanForbiddenKeys(assignNadiaData, FORBIDDEN_KEYS)
    assert.strictEqual(assignNadiaData.data.assignment.status, 'active')
    assert.strictEqual(assignNadiaData.data.assignment.field, 'Eat')

    // Idempotent assignment: POST again for same active pair returns 200 without error
    const assignIdempotentRes = await fetch(`${baseUrl}/org/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apexAdminToken}` },
      body: JSON.stringify({ memberId: member1Id, specialistId: newSpId }),
    })
    assert.strictEqual(assignIdempotentRes.status, 200, 'Re-assigning active specialist must be idempotent')
    ok('POST /api/org/assignments successfully creates assignment and behaves idempotently')

    // -------------------------------------------------------------
    // 6. FIELD_ALREADY_ASSIGNED rule (409)
    // -------------------------------------------------------------
    // Create another nutritionist in Apex
    const secondNutrRes = await fetch(`${baseUrl}/org/specialists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apexAdminToken}` },
      body: JSON.stringify({
        name: 'Dr. Sameh Nutrition',
        email: `sameh.nutr.${ts}@apex.com`,
        password: 'Password123!',
        type: 'nutritionist',
      }),
    })
    const secondNutrData = await secondNutrRes.json()
    const secondNutrId = secondNutrData.data.specialist.specialistId

    // Attempting to assign second nutritionist to member1 (who already has Nadia active) must 409
    const conflictAssignRes = await fetch(`${baseUrl}/org/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apexAdminToken}` },
      body: JSON.stringify({ memberId: member1Id, specialistId: secondNutrId }),
    })
    assert.strictEqual(conflictAssignRes.status, 409, 'Assigning second specialist for Eat field must return 409')
    const conflictData = await conflictAssignRes.json()
    assert.strictEqual(conflictData.error.code, 'FIELD_ALREADY_ASSIGNED')
    ok('FIELD_ALREADY_ASSIGNED rule enforced when assigning a duplicate field')

    // -------------------------------------------------------------
    // 7. PATCH /api/org/assignments/:clientId/:specialistId/end & Reactivate
    // -------------------------------------------------------------
    const endAssignRes = await fetch(`${baseUrl}/org/assignments/${member1Id}/${newSpId}/end`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apexAdminToken}` },
    })
    assert.strictEqual(endAssignRes.status, 200, 'Ending assignment must return 200')
    const endAssignData = await endAssignRes.json()
    scanForbiddenKeys(endAssignData, FORBIDDEN_KEYS)
    assert.strictEqual(endAssignData.data.assignment.status, 'ended')
    assert.ok(endAssignData.data.assignment.endedAt, 'endedAt must be recorded')

    // Verify DB state
    const careRow = db.prepare('SELECT status, ended_at FROM care_team WHERE client_id = ? AND specialist_id = ?').get(member1Id, newSpId)
    assert.strictEqual(careRow.status, 'ended')
    assert.ok(careRow.ended_at)

    // Reactivate assignment: POST /api/org/assignments for the ended pair reactivates it
    const reactivateRes = await fetch(`${baseUrl}/org/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apexAdminToken}` },
      body: JSON.stringify({ memberId: member1Id, specialistId: newSpId }),
    })
    assert.strictEqual(reactivateRes.status, 201, 'Reactivating ended assignment must return 201')
    const reactivateCare = db.prepare('SELECT status, ended_at FROM care_team WHERE client_id = ? AND specialist_id = ?').get(member1Id, newSpId)
    assert.strictEqual(reactivateCare.status, 'active')
    assert.strictEqual(reactivateCare.ended_at, null)
    ok('PATCH /api/org/assignments/.../end ends assignment, and POST reactivates ended assignment')

    // -------------------------------------------------------------
    // 8. Ending an assignment removes client from GET /api/specialist/clients
    // -------------------------------------------------------------
    // First, verify Coach Tarek sees member1 in his clients list
    const tarekClientsBeforeRes = await fetch(`${baseUrl}/specialist/clients`, {
      headers: { Authorization: `Bearer ${tarekToken}` },
    })
    const tarekClientsBefore = await tarekClientsBeforeRes.json()
    const member1FoundBefore = tarekClientsBefore.data.clients.find((c) => c.email === 'member1@apex.com' || c.id === member1Id)
    assert.ok(member1FoundBefore, 'Tarek must initially see member1')

    // End Tarek's assignment with member1
    await fetch(`${baseUrl}/org/assignments/${member1Id}/${tarekId}/end`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apexAdminToken}` },
    })

    // Verify Tarek no longer sees member1 in his clients list
    const tarekClientsAfterRes = await fetch(`${baseUrl}/specialist/clients`, {
      headers: { Authorization: `Bearer ${tarekToken}` },
    })
    const tarekClientsAfter = await tarekClientsAfterRes.json()
    const member1FoundAfter = tarekClientsAfter.data.clients.find((c) => c.email === 'member1@apex.com' || c.id === member1Id)
    assert.strictEqual(member1FoundAfter, undefined, 'Ending assignment removes client from specialist client list')

    // Reactivate Tarek so member1 remains assigned
    await fetch(`${baseUrl}/org/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apexAdminToken}` },
      body: JSON.stringify({ memberId: member1Id, specialistId: tarekId }),
    })
    ok('Ending assignment stops specialist from viewing client in specialist portal')

    // -------------------------------------------------------------
    // 9. GET /api/org/stats (aggregate counts only)
    // -------------------------------------------------------------
    const statsRes = await fetch(`${baseUrl}/org/stats`, {
      headers: { Authorization: `Bearer ${apexAdminToken}` },
    })
    assert.strictEqual(statsRes.status, 200)
    const statsData = await statsRes.json()
    scanForbiddenKeys(statsData, FORBIDDEN_KEYS)

    assert.strictEqual(typeof statsData.data.totalMembers, 'number')
    assert.strictEqual(typeof statsData.data.seatsUsed, 'number')
    assert.strictEqual(typeof statsData.data.seatLimit, 'number')
    assert.strictEqual(typeof statsData.data.seatsRemaining, 'number')
    assert.strictEqual(typeof statsData.data.membersWithAssignment, 'number')
    assert.strictEqual(typeof statsData.data.membersWithoutAssignment, 'number')
    assert.strictEqual(typeof statsData.data.activeMembersLast7Days, 'number')
    assert.strictEqual(typeof statsData.data.plansUpdatedLast7Days, 'number')
    assert.ok(statsData.data.assignmentsByField, 'assignmentsByField must exist')
    assert.strictEqual(typeof statsData.data.assignmentsByField.move, 'number')
    assert.strictEqual(typeof statsData.data.assignmentsByField.eat, 'number')
    assert.strictEqual(typeof statsData.data.assignmentsByField.recover, 'number')
    ok('GET /api/org/stats returns aggregate metrics without health/clinical content')

    // -------------------------------------------------------------
    // 10. Multi-tenant isolation: Second org cannot access or tamper with Apex
    // -------------------------------------------------------------
    const org2Res = await fetch(`${baseUrl}/auth/register-org`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationName: 'Second Corp',
        type: 'company',
        seatLimit: 10,
        adminName: 'Second Admin',
        email: `admin2.${ts}@secondcorp.com`,
        password: 'Password123!',
      }),
    })
    assert.strictEqual(org2Res.status, 201)
    const org2Data = await org2Res.json()
    const org2Token = org2Data.data.token
    const org2Id = org2Data.data.organization.id

    // Org 2 creates a member
    const org2MemberRes = await fetch(`${baseUrl}/auth/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inviteCode: org2Data.data.organization.inviteCode,
        name: 'Org2 Member',
        email: `member.${ts}@secondcorp.com`,
        password: 'Password123!',
      }),
    })
    const org2MemberData = await org2MemberRes.json()
    const org2MemberId = org2MemberData.data.user.id

    // Org 2 creates a specialist
    const org2SpRes = await fetch(`${baseUrl}/org/specialists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${org2Token}` },
      body: JSON.stringify({
        name: 'Org2 Trainer',
        email: `trainer.${ts}@secondcorp.com`,
        password: 'Password123!',
        type: 'trainer',
      }),
    })
    const org2SpData = await org2SpRes.json()
    const org2SpId = org2SpData.data.specialist.specialistId

    // A. Org 2 admin attempting to assign member of Apex to specialist of Org 2 -> 404
    const tamperAssign1 = await fetch(`${baseUrl}/org/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${org2Token}` },
      body: JSON.stringify({ memberId: member1Id, specialistId: org2SpId }),
    })
    assert.strictEqual(tamperAssign1.status, 404, 'Assigning foreign member must return 404')

    // B. Org 2 admin attempting to assign Org 2 member to Apex specialist -> 404
    const tamperAssign2 = await fetch(`${baseUrl}/org/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${org2Token}` },
      body: JSON.stringify({ memberId: org2MemberId, specialistId: tarekId }),
    })
    assert.strictEqual(tamperAssign2.status, 404, 'Assigning foreign specialist must return 404')

    // C. Org 2 admin attempting to end an assignment of Apex -> 404
    const tamperEnd = await fetch(`${baseUrl}/org/assignments/${member1Id}/${tarekId}/end`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${org2Token}` },
    })
    assert.strictEqual(tamperEnd.status, 404, 'Ending foreign assignment must return 404')

    // D. Org 2 members list only shows Org 2 members (1 member, NOT Apex's 20)
    const org2MembersRes = await fetch(`${baseUrl}/org/members`, {
      headers: { Authorization: `Bearer ${org2Token}` },
    })
    const org2MembersData = await org2MembersRes.json()
    assert.strictEqual(org2MembersData.data.members.length, 1)
    assert.strictEqual(org2MembersData.data.members[0].id, org2MemberId)
    ok('Multi-tenant isolation strictly verified: cross-org assignments and lookups return 404')

    // -------------------------------------------------------------
    // 11. Role boundaries and route guards (403 checks)
    // -------------------------------------------------------------
    // Non-org-admins (client and specialist) get 403 on /api/org/*
    const clientToOrgRes = await fetch(`${baseUrl}/org/info`, {
      headers: { Authorization: `Bearer ${saraToken}` },
    })
    assert.strictEqual(clientToOrgRes.status, 403, 'Client calling /api/org/info must be 403')

    const specialistToOrgRes = await fetch(`${baseUrl}/org/members`, {
      headers: { Authorization: `Bearer ${tarekToken}` },
    })
    assert.strictEqual(specialistToOrgRes.status, 403, 'Specialist calling /api/org/members must be 403')

    // org_admin gets 403 on client-only and specialist-only clinical routes
    const adminToPlans = await fetch(`${baseUrl}/plans`, {
      headers: { Authorization: `Bearer ${apexAdminToken}` },
    })
    assert.strictEqual(adminToPlans.status, 403, 'org_admin on /api/plans must be 403')

    const adminToProfile = await fetch(`${baseUrl}/profile`, {
      headers: { Authorization: `Bearer ${apexAdminToken}` },
    })
    assert.strictEqual(adminToProfile.status, 403, 'org_admin on /api/profile must be 403')

    const adminToProgress = await fetch(`${baseUrl}/progress`, {
      headers: { Authorization: `Bearer ${apexAdminToken}` },
    })
    assert.strictEqual(adminToProgress.status, 403, 'org_admin on /api/progress must be 403')

    const adminToAi = await fetch(`${baseUrl}/ai/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apexAdminToken}` },
      body: JSON.stringify({ goal: 'lose_fat' }),
    })
    assert.strictEqual(adminToAi.status, 403, 'org_admin on /api/ai/plan must be 403')

    const adminToSpecialistPortal = await fetch(`${baseUrl}/specialist/clients`, {
      headers: { Authorization: `Bearer ${apexAdminToken}` },
    })
    assert.strictEqual(adminToSpecialistPortal.status, 403, 'org_admin on /api/specialist/clients must be 403')
    ok('Role boundaries enforced: client/specialist denied on /api/org/*, org_admin denied on clinical routes (403)')

    // -------------------------------------------------------------
    // 12. Checkout rules for sponsored members
    // -------------------------------------------------------------
    // Org member checkout returns 409 ALREADY_SPONSORED
    const orgCheckoutRes = await fetch(`${baseUrl}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${member1Token}` },
      body: JSON.stringify({ planName: 'Plus', method: 'card' }),
    })
    assert.strictEqual(orgCheckoutRes.status, 409, 'Org member checkout must return 409')
    const orgCheckoutData = await orgCheckoutRes.json()
    assert.strictEqual(orgCheckoutData.error.code, 'ALREADY_SPONSORED')

    // GET /api/checkout/current includes source and organizationName for sponsored member
    const orgCurrentSubRes = await fetch(`${baseUrl}/checkout/current`, {
      headers: { Authorization: `Bearer ${member1Token}` },
    })
    assert.strictEqual(orgCurrentSubRes.status, 200)
    const orgCurrentSub = await orgCurrentSubRes.json()
    assert.strictEqual(orgCurrentSub.data.subscription.source, 'organization')
    assert.strictEqual(orgCurrentSub.data.subscription.organizationName, 'Apex Athletic Club')
    ok('POST /api/checkout returns 409 ALREADY_SPONSORED and GET /api/checkout/current returns organizationName')

    // -------------------------------------------------------------
    // 13. GET /api/my/specialists (Individual & Org Member)
    // -------------------------------------------------------------
    // Individual (Sara: works with Karim, Hana, Mona - platform specialists)
    const saraMyRes = await fetch(`${baseUrl}/my/specialists`, {
      headers: { Authorization: `Bearer ${saraToken}` },
    })
    assert.strictEqual(saraMyRes.status, 200)
    const saraMyData = await saraMyRes.json()
    assert.strictEqual(saraMyData.data.specialists.length, 3, 'Sara has 3 platform specialists')
    for (const sp of saraMyData.data.specialists) {
      assert.strictEqual(sp.orgName, null, 'Platform specialists must have orgName: null')
      assert.ok(['Move', 'Eat', 'Recover'].includes(sp.field))
    }

    // Org member (member1: works with Tarek, Salma, Nadia - Apex specialists)
    const member1MyRes = await fetch(`${baseUrl}/my/specialists`, {
      headers: { Authorization: `Bearer ${member1Token}` },
    })
    assert.strictEqual(member1MyRes.status, 200)
    const member1MyData = await member1MyRes.json()
    assert.ok(member1MyData.data.specialists.length >= 2, 'member1 has active org specialists')
    for (const sp of member1MyData.data.specialists) {
      assert.strictEqual(sp.orgName, 'Apex Athletic Club')
      assert.ok(['Move', 'Eat', 'Recover'].includes(sp.field))
    }
    ok('GET /api/my/specialists returns active specialists for both individual and org members')

    console.log(`\nAll ${passed} Phase 4 Org Admin & Member tests passed successfully!`)
  } finally {
    if (server) {
      server.close()
    }
  }
}

run().catch((err) => {
  console.error('Test suite failed:', err)
  if (server) server.close()
  process.exit(1)
})
