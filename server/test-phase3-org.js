// test-phase3-org.js — Automated test suite for Phase 3: Org Auth & Permissions.
//
// Requirements tested:
// 1. POST /api/auth/register-org creates organization + org_admin in one transaction.
// 2. Invite code generation is 8 chars, uppercase alphanumeric (no 0/O/1/I).
// 3. org_admin does not have a client_profiles row and does not count as a seat.
// 4. Validation bounds on register-org (seatLimit 1-500, type enum, duplicate email 409).
// 5. POST /api/auth/join normalizes invite code, joins org, creates client_profile & sponsored subscription.
// 6. Join rejects invalid invite codes with 404.
// 7. Join rejects full organizations with 409 (SEATS_FULL).
// 8. Normal POST /api/auth/register cannot set org_admin role or organization_id.
// 9. Organization payload shape verification for all roles (org_admin, member, specialist, individual)
//    in both login and /me.
// 10. requireOrgAdmin middleware verification.

import assert from 'node:assert'
import app from './src/app.js'
import db from './src/db/connection.js'
import { requireAuth } from './src/middleware/auth.js'
import { requireOrgAdmin } from './src/middleware/requireOrgAdmin.js'

const PORT = 4025
let server

async function run() {
  server = app.listen(PORT)
  const baseUrl = `http://localhost:${PORT}/api`

  console.log(`Starting Phase 3 Org Auth test suite on ${baseUrl}...\n`)

  let passed = 0
  function ok(msg) {
    passed++
    console.log(`  ✓ ${msg}`)
  }

  const ts = Date.now()
  try {
    // -------------------------------------------------------------
    // 1. POST /api/auth/register-org success
    // -------------------------------------------------------------
    const regOrgPayload = {
      name: 'Tech University Fitness',
      type: 'university',
      seatLimit: 150,
      adminName: 'Prof. Fitness Admin',
      adminEmail: `dean.admin.${ts}@techuni.edu`,
      adminPassword: 'Password123!',
    }

    const regOrgRes = await fetch(`${baseUrl}/auth/register-org`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regOrgPayload),
    })

    assert.strictEqual(regOrgRes.status, 201, 'register-org must return 201 Created')
    const regOrgData = await regOrgRes.json()
    assert.ok(regOrgData.data.token, 'Response must include JWT token')
    assert.strictEqual(regOrgData.data.user.role, 'org_admin', 'User must have role org_admin')
    assert.ok(regOrgData.data.organization, 'Response must include organization object')
    assert.strictEqual(regOrgData.data.organization.name, 'Tech University Fitness')
    assert.strictEqual(regOrgData.data.organization.seatLimit, 150)
    assert.strictEqual(regOrgData.data.organization.seatsUsed, 0, 'New org must have 0 seats used')
    assert.strictEqual(typeof regOrgData.data.organization.inviteCode, 'string')
    assert.strictEqual(regOrgData.data.organization.inviteCode.length, 8, 'Invite code must be 8 chars')
    assert.match(regOrgData.data.organization.inviteCode, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/, 'Invite code must not have 0/O/1/I')

    // Verify database state: org_admin has NO client_profiles row
    const adminUser = db.prepare('SELECT id, role, organization_id FROM users WHERE email = ?').get(`dean.admin.${ts}@techuni.edu`)
    assert.ok(adminUser, 'Admin user must exist in DB')
    const profileRow = db.prepare('SELECT user_id FROM client_profiles WHERE user_id = ?').get(adminUser.id)
    assert.strictEqual(profileRow, undefined, 'org_admin must NOT have client_profiles row')
    ok('POST /api/auth/register-org creates organization + org_admin with 8-char code and no client_profiles row')

    // -------------------------------------------------------------
    // 2. Duplicate email in register-org returns 409
    // -------------------------------------------------------------
    const dupRes = await fetch(`${baseUrl}/auth/register-org`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regOrgPayload),
    })
    assert.strictEqual(dupRes.status, 409, 'Duplicate admin email must return 409')
    const dupData = await dupRes.json()
    assert.strictEqual(dupData.error.code, 'EMAIL_IN_USE')
    ok('register-org rejects duplicate admin email with 409 EMAIL_IN_USE')

    // -------------------------------------------------------------
    // 3. Validation bounds on register-org
    // -------------------------------------------------------------
    const invalidLimitRes = await fetch(`${baseUrl}/auth/register-org`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...regOrgPayload,
        adminEmail: `different.${ts}@techuni.edu`,
        seatLimit: 600, // max is 500
      }),
    })
    assert.strictEqual(invalidLimitRes.status, 400, 'seatLimit > 500 must return 400')

    const invalidTypeRes = await fetch(`${baseUrl}/auth/register-org`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...regOrgPayload,
        adminEmail: `different2.${ts}@techuni.edu`,
        type: 'non_existent_type',
      }),
    })
    assert.strictEqual(invalidTypeRes.status, 400, 'Invalid org type must return 400')
    ok('register-org validates seatLimit (1-500) and type enum')

    // -------------------------------------------------------------
    // 4. POST /api/auth/join success & case-insensitivity
    // -------------------------------------------------------------
    const createdOrgCode = regOrgData.data.organization.inviteCode
    const lowercaseCode = createdOrgCode.toLowerCase()

    const joinRes = await fetch(`${baseUrl}/auth/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inviteCode: lowercaseCode, // Test lowercase normalization
        name: 'Student Member One',
        email: `student1.${ts}@techuni.edu`,
        password: 'Password123!',
      }),
    })

    assert.strictEqual(joinRes.status, 201, 'Join must return 201 Created')
    const joinData = await joinRes.json()
    assert.ok(joinData.data.token, 'Join must return JWT token')
    assert.strictEqual(joinData.data.user.role, 'client', 'Joined user must have client role')
    assert.strictEqual(joinData.data.organization.name, 'Tech University Fitness')
    assert.strictEqual(joinData.data.organization.sponsored, true, 'Joined member organization must have sponsored: true')
    assert.strictEqual(joinData.data.organization.inviteCode, undefined, 'Joined member organization must NOT leak inviteCode')

    // Verify DB: client_profiles row exists and sponsored subscription exists
    const studentUser = db.prepare('SELECT id, organization_id FROM users WHERE email = ?').get(`student1.${ts}@techuni.edu`)
    assert.ok(studentUser, 'Student user must exist')
    const studentProfile = db.prepare('SELECT user_id, onboarding_completed FROM client_profiles WHERE user_id = ?').get(studentUser.id)
    assert.ok(studentProfile, 'client_profiles row must exist for joined user')

    const sub = db.prepare('SELECT * FROM subscriptions WHERE client_id = ?').get(studentUser.id)
    assert.ok(sub, 'Sponsored subscription must exist')
    assert.strictEqual(sub.source, 'organization', "Subscription source must be 'organization'")
    assert.strictEqual(sub.price_egp, 0, 'Sponsored subscription price must be 0')
    assert.strictEqual(sub.status, 'active', 'Sponsored subscription status must be active')
    ok('POST /api/auth/join normalizes invite code, creates user, profile, and sponsored subscription')

    // -------------------------------------------------------------
    // 5. Join with invalid code returns 404
    // -------------------------------------------------------------
    const invalidCodeRes = await fetch(`${baseUrl}/auth/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inviteCode: 'NONEXIST',
        name: 'Ghost User',
        email: `ghost.${ts}@nowhere.com`,
        password: 'Password123!',
      }),
    })
    assert.strictEqual(invalidCodeRes.status, 404, 'Invalid invite code must return 404')
    const invalidCodeData = await invalidCodeRes.json()
    assert.strictEqual(invalidCodeData.error.code, 'ORGANIZATION_NOT_FOUND')
    ok('Join with non-existent invite code returns 404 ORGANIZATION_NOT_FOUND')

    // -------------------------------------------------------------
    // 6. Join when seats are full returns 409 SEATS_FULL
    // -------------------------------------------------------------
    // Create a 1-seat organization
    const tinyOrgRes = await fetch(`${baseUrl}/auth/register-org`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Tiny Startup',
        type: 'company',
        seatLimit: 1,
        adminName: 'Tiny Admin',
        adminEmail: `admin.${ts}@tinystartup.com`,
        adminPassword: 'Password123!',
      }),
    })
    assert.strictEqual(tinyOrgRes.status, 201)
    const tinyOrgData = await tinyOrgRes.json()
    const tinyCode = tinyOrgData.data.organization.inviteCode

    // First member joins -> uses 1 / 1 seat
    const join1Res = await fetch(`${baseUrl}/auth/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inviteCode: tinyCode,
        name: 'Lucky Member',
        email: `lucky.${ts}@tinystartup.com`,
        password: 'Password123!',
      }),
    })
    assert.strictEqual(join1Res.status, 201, 'First member must consume the 1 seat')

    // Second member joins -> should be blocked with 409
    const join2Res = await fetch(`${baseUrl}/auth/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inviteCode: tinyCode,
        name: 'Unlucky Member',
        email: `unlucky.${ts}@tinystartup.com`,
        password: 'Password123!',
      }),
    })
    assert.strictEqual(join2Res.status, 409, 'Joining full organization must return 409')
    const join2Data = await join2Res.json()
    assert.strictEqual(join2Data.error.code, 'SEATS_FULL')
    ok('Join rejects registration when seats limit is reached (409 SEATS_FULL)')

    // -------------------------------------------------------------
    // 7. Normal POST /api/auth/register cannot set org_admin or organization_id
    // -------------------------------------------------------------
    // Attempting to pass role: 'org_admin' must be rejected
    const attackRoleRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sneaky Admin Wannabe',
        email: `sneaky.role.${ts}@example.com`,
        password: 'Password123!',
        role: 'org_admin',
      }),
    })
    assert.strictEqual(attackRoleRes.status, 400, 'Registering with role org_admin must be rejected (400)')

    // Attempting to inject organization_id must be ignored and stay null
    const attackOrgRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sneaky Client',
        email: `sneaky.org.${ts}@example.com`,
        password: 'Password123!',
        organization_id: 1,
        organizationId: 1,
      }),
    })
    assert.strictEqual(attackOrgRes.status, 201, 'Normal register succeeds as regular client')
    const attackOrgData = await attackOrgRes.json()
    assert.strictEqual(attackOrgData.data.user.role, 'client', 'Role must remain client')
    assert.strictEqual(attackOrgData.data.user.organizationId, null, 'organizationId must remain null')
    assert.strictEqual(attackOrgData.data.organization, null, 'organization must be null')

    const sneakyDbUser = db.prepare('SELECT role, organization_id FROM users WHERE email = ?').get(`sneaky.org.${ts}@example.com`)
    assert.strictEqual(sneakyDbUser.role, 'client')
    assert.strictEqual(sneakyDbUser.organization_id, null)
    ok('Standard register cannot escalate to org_admin or set organization_id')
    assert.strictEqual(sneakyDbUser.role, 'client')
    assert.strictEqual(sneakyDbUser.organization_id, null)
    ok('Standard register cannot escalate to org_admin or set organization_id')

    // -------------------------------------------------------------
    // 8. Organization object payload for all roles in login & /me
    // -------------------------------------------------------------

    // A. org_admin (admin@apex.com)
    const apexAdminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@apex.com', password: 'demo1234' }),
    })
    assert.strictEqual(apexAdminLoginRes.status, 200)
    const apexAdminLogin = await apexAdminLoginRes.json()
    assert.strictEqual(apexAdminLogin.data.user.role, 'org_admin')
    assert.ok(apexAdminLogin.data.organization, 'org_admin must receive organization object')
    assert.strictEqual(apexAdminLogin.data.organization.inviteCode, 'APEX2026')
    assert.strictEqual(apexAdminLogin.data.organization.seatLimit, 30)
    assert.strictEqual(apexAdminLogin.data.organization.seatsUsed, 20)

    const apexAdminMeRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${apexAdminLogin.data.token}` },
    })
    const apexAdminMe = await apexAdminMeRes.json()
    assert.strictEqual(apexAdminMe.data.organization.inviteCode, 'APEX2026')
    assert.strictEqual(apexAdminMe.data.organization.seatLimit, 30)
    assert.strictEqual(apexAdminMe.data.organization.seatsUsed, 20)
    ok('org_admin receives complete organization object including inviteCode, seatLimit, and seatsUsed (20/30)')

    // B. Org member (member1@apex.com)
    const apexMemberLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'member1@apex.com', password: 'demo1234' }),
    })
    assert.strictEqual(apexMemberLoginRes.status, 200)
    const apexMemberLogin = await apexMemberLoginRes.json()
    assert.strictEqual(apexMemberLogin.data.user.role, 'client')
    assert.strictEqual(apexMemberLogin.data.organization.name, 'Apex Athletic Club')
    assert.strictEqual(apexMemberLogin.data.organization.sponsored, true)
    assert.strictEqual(apexMemberLogin.data.organization.inviteCode, undefined, 'Org member must not see inviteCode')

    const apexMemberMeRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${apexMemberLogin.data.token}` },
    })
    const apexMemberMe = await apexMemberMeRes.json()
    assert.strictEqual(apexMemberMe.data.organization.sponsored, true)
    assert.strictEqual(apexMemberMe.data.organization.inviteCode, undefined)
    ok('Org member receives organization with sponsored: true and without inviteCode')

    // C. Org specialist (tarek.org@apex.com)
    const tarekLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tarek.org@apex.com', password: 'demo1234' }),
    })
    assert.strictEqual(tarekLoginRes.status, 200)
    const tarekLogin = await tarekLoginRes.json()
    assert.strictEqual(tarekLogin.data.user.role, 'specialist')
    assert.strictEqual(tarekLogin.data.organization.name, 'Apex Athletic Club')
    assert.strictEqual(tarekLogin.data.organization.sponsored, undefined, 'Specialist must not have sponsored: true')
    assert.strictEqual(tarekLogin.data.organization.inviteCode, undefined, 'Specialist must not see inviteCode')

    const tarekMeRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${tarekLogin.data.token}` },
    })
    const tarekMe = await tarekMeRes.json()
    assert.strictEqual(tarekMe.data.organization.name, 'Apex Athletic Club')
    assert.strictEqual(tarekMe.data.organization.sponsored, undefined)
    assert.strictEqual(tarekMe.data.organization.inviteCode, undefined)
    ok('Org specialist receives organization without sponsored flag and without inviteCode')

    // D. Individual member (sara@demo.com)
    const saraLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sara@demo.com', password: 'demo1234' }),
    })
    assert.strictEqual(saraLoginRes.status, 200)
    const saraLogin = await saraLoginRes.json()
    assert.strictEqual(saraLogin.data.organization, null, 'Individual member organization must be null')

    const saraMeRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${saraLogin.data.token}` },
    })
    const saraMe = await saraMeRes.json()
    assert.strictEqual(saraMe.data.organization, null)
    ok('Individual member receives organization: null')

    // -------------------------------------------------------------
    // 9. requireOrgAdmin middleware verification
    // -------------------------------------------------------------
    let nextCalled = false
    const mockReqAdmin = {
      user: { id: apexAdminLogin.data.user.id, role: 'org_admin', organizationId: apexAdminLogin.data.organization.id },
    }
    const mockResAdmin = {
      status(s) { this.statusCode = s; return this },
      json(d) { this.body = d; return this },
    }
    requireOrgAdmin(mockReqAdmin, mockResAdmin, () => { nextCalled = true })
    assert.strictEqual(nextCalled, true, 'requireOrgAdmin must call next() for org_admin')
    assert.strictEqual(mockReqAdmin.orgId, apexAdminLogin.data.organization.id, 'req.orgId must match user organizationId')

    // Non-org-admin member gets 403
    let forbiddenCalled = false
    const mockReqMember = {
      user: { id: apexMemberLogin.data.user.id, role: 'client', organizationId: 1 },
    }
    const mockResMember = {
      status(s) { this.statusCode = s; return this },
      json(d) { this.body = d; return this },
    }
    requireOrgAdmin(mockReqMember, mockResMember, () => { forbiddenCalled = true })
    assert.strictEqual(forbiddenCalled, false, 'requireOrgAdmin must not call next() for non-org-admin')
    assert.strictEqual(mockResMember.statusCode, 403, 'requireOrgAdmin must return 403 for client')

    // Unauthenticated gets 401
    const mockReqUnauth = {}
    const mockResUnauth = {
      status(s) { this.statusCode = s; return this },
      json(d) { this.body = d; return this },
    }
    requireOrgAdmin(mockReqUnauth, mockResUnauth, () => {})
    assert.strictEqual(mockResUnauth.statusCode, 401, 'requireOrgAdmin must return 401 for unauthenticated')

    ok('requireOrgAdmin middleware grants org_admin with req.orgId and denies non-admins (403) and unauthenticated (401)')

    console.log(`\nAll ${passed} Phase 3 Org Auth tests passed successfully!`)
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
