// test-support.js — Test suite for Customer Support & Incident Reporting
import assert from 'node:assert'
import http from 'node:http'
import app from './src/app.js'

const PORT = 4016
const baseUrl = `http://localhost:${PORT}/api`

async function run() {
  console.log(`Starting Support & Reports test suite on ${baseUrl}...`)

  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(PORT, resolve))

  try {
    // 1. Log in as Sara (Client)
    const saraAuth = await (
      await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'sara@demo.com', password: 'demo1234' }),
      })
    ).json()
    const saraToken = saraAuth.data.token

    // 2. Log in as Admin
    const adminAuth = await (
      await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@demo.com', password: 'demo1234' }),
      })
    ).json()
    const adminToken = adminAuth.data.token

    // 3. GET /api/support/tickets/my (Sara)
    const myRes = await fetch(`${baseUrl}/support/tickets/my`, {
      headers: { Authorization: `Bearer ${saraToken}` },
    })
    assert.strictEqual(myRes.status, 200)
    const myJson = await myRes.json()
    assert.ok(Array.isArray(myJson.data.tickets))
    assert.ok(myJson.data.tickets.length >= 1)
    console.log('  ✓ Client can list their submitted tickets (GET /api/support/tickets/my)')

    // 4. POST /api/support/tickets (Sara creates a new ticket)
    const createRes = await fetch(`${baseUrl}/support/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${saraToken}`,
      },
      body: JSON.stringify({
        category: 'technical_issue',
        priority: 'high',
        subject: 'Cannot upload profile picture',
        description: 'Every time I try to save a new avatar, the page displays a generic error.',
      }),
    })
    assert.strictEqual(createRes.status, 201)
    const createJson = await createRes.json()
    const newTicketId = createJson.data.ticket.id
    assert.ok(newTicketId)
    assert.strictEqual(createJson.data.ticket.category, 'technical_issue')
    assert.ok(createJson.data.ticket.ticketNumber.startsWith('TICK-'))
    console.log('  ✓ Client can create a support ticket (POST /api/support/tickets)')

    // 5. GET /api/support/tickets/:id (Client views their ticket)
    const viewRes = await fetch(`${baseUrl}/support/tickets/${newTicketId}`, {
      headers: { Authorization: `Bearer ${saraToken}` },
    })
    assert.strictEqual(viewRes.status, 200)
    const viewJson = await viewRes.json()
    assert.strictEqual(viewJson.data.ticket.id, newTicketId)
    assert.strictEqual(viewJson.data.messages.length, 1)
    console.log('  ✓ Client can view ticket details & message thread')

    // 6. Admin posts internal note (Client cannot see it)
    const adminNoteRes = await fetch(`${baseUrl}/support/tickets/${newTicketId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        message: 'Checked S3 upload bucket logs: permissions need re-sync.',
        isInternal: true,
      }),
    })
    assert.strictEqual(adminNoteRes.status, 201)

    // Verify Sara cannot see the internal note
    const recheckedView = await (
      await fetch(`${baseUrl}/support/tickets/${newTicketId}`, {
        headers: { Authorization: `Bearer ${saraToken}` },
      })
    ).json()
    assert.strictEqual(recheckedView.data.messages.length, 1, 'Client must NOT see internal staff note')
    console.log('  ✓ Internal staff notes are hidden from non-admin clients')

    // Verify Admin CAN see the internal note
    const adminView = await (
      await fetch(`${baseUrl}/support/tickets/${newTicketId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
    ).json()
    assert.strictEqual(adminView.data.messages.length, 2, 'Admin must see all messages including internal notes')
    console.log('  ✓ Admin can see internal notes and message history')

    // 7. Admin lists all tickets with metrics
    const adminListRes = await fetch(`${baseUrl}/support/admin/tickets`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    assert.strictEqual(adminListRes.status, 200)
    const adminListJson = await adminListRes.json()
    assert.ok(adminListJson.data.metrics.totalOpen >= 2)
    assert.ok(adminListJson.data.tickets.length >= 4)
    console.log('  ✓ Admin support desk returns platform metrics & ticket queue')

    // 8. Admin resolves ticket
    const resolveRes = await fetch(`${baseUrl}/support/admin/tickets/${newTicketId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: 'resolved',
        resolutionNote: 'Fixed image upload timeout on storage service.',
      }),
    })
    assert.strictEqual(resolveRes.status, 200)
    const resolveJson = await resolveRes.json()
    assert.strictEqual(resolveJson.data.ticket.status, 'resolved')
    assert.ok(resolveJson.data.ticket.resolvedAt)
    console.log('  ✓ Admin can resolve ticket and record resolution note')

    // 9. Admin triggers moderation action (flag_refund)
    const actionRes = await fetch(`${baseUrl}/support/admin/tickets/${newTicketId}/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        action: 'flag_refund',
        reason: 'Client experienced technical issue during onboarding',
      }),
    })
    assert.strictEqual(actionRes.status, 200)
    const actionJson = await actionRes.json()
    assert.strictEqual(actionJson.data.success, true)
    console.log('  ✓ Admin can trigger moderation / financial action from ticket')

    // 10. Role boundary: Non-admin calling admin endpoint is rejected (403)
    const unauthorizedAdminCall = await fetch(`${baseUrl}/support/admin/tickets`, {
      headers: { Authorization: `Bearer ${saraToken}` },
    })
    assert.strictEqual(unauthorizedAdminCall.status, 403)
    console.log('  ✓ Non-admin calling admin support endpoint is rejected with 403 FORBIDDEN')

    console.log('\nAll Support & Reports backend tests passed successfully!')
  } finally {
    server.close()
  }
}

run()
