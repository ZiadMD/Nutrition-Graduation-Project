// test-phase3.js — Automated test suite for Phase 3: Specialists, Slots, and Bookings.
//
// Key requirements tested:
// 1. Specialists directory filtering, search, sorting, and details.
// 2. Open future slots retrieval.
// 3. Two simultaneous bookings of the same slot result in EXACTLY ONE success and ONE 409.
// 4. Cancel frees the availability slot.
// 5. The 12-hour cancellation rule is strictly enforced.
// 6. Rescheduling an appointment frees the old slot and books the new one.
// 7. Video session mock endpoint returns valid room details.

import assert from 'node:assert'
import app from './src/app.js'
import db from './src/db/connection.js'

const PORT = 4002
let server

async function run() {
  server = app.listen(PORT)
  const baseUrl = `http://localhost:${PORT}/api`

  console.log(`Starting Phase 3 test suite on ${baseUrl}...\n`)

  let passed = 0
  function ok(msg) {
    passed++
    console.log(`  ✓ ${msg}`)
  }

  try {
    // 0. Login users to obtain tokens
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

    // 1. List specialists (only approved)
    const specRes = await fetch(`${baseUrl}/specialists`)
    const specJson = await specRes.json()
    assert.strictEqual(specRes.status, 200)
    assert.strictEqual(specJson.data.specialists.length, 6, 'Should list 6 approved specialists')
    const yasmin = specJson.data.specialists.find((s) => s.name?.includes('Yasmin'))
    assert.strictEqual(yasmin, undefined, 'Pending specialist Yasmin must not appear in directory')
    ok('Specialists list returns all 6 approved specialists (excludes pending)')

    // 2. Filter specialists by type
    const moveRes = await (await fetch(`${baseUrl}/specialists?type=move`)).json()
    assert.ok(moveRes.data.specialists.every((s) => s.type === 'trainer'))
    ok('Filter by type=move returns only trainers')

    const eatRes = await (await fetch(`${baseUrl}/specialists?type=eat`)).json()
    assert.ok(eatRes.data.specialists.every((s) => s.type === 'nutritionist'))
    ok('Filter by type=eat returns only nutritionists')

    const recoverRes = await (await fetch(`${baseUrl}/specialists?type=recover`)).json()
    assert.ok(recoverRes.data.specialists.every((s) => s.type === 'physical_therapist'))
    ok('Filter by type=recover returns only physical therapists')

    // 3. Search specialists by query
    const searchRes = await (await fetch(`${baseUrl}/specialists?q=Mona`)).json()
    assert.strictEqual(searchRes.data.specialists.length, 1)
    assert.ok(searchRes.data.specialists[0].name.includes('Mona'))
    const monaId = searchRes.data.specialists[0].id
    ok('Search by name query works (found Dr. Mona)')

    // 4. Specialist details and packages
    const monaDetailRes = await fetch(`${baseUrl}/specialists/${monaId}`)
    const monaDetail = await monaDetailRes.json()
    assert.strictEqual(monaDetailRes.status, 200)
    assert.strictEqual(monaDetail.data.specialist.id, monaId)
    assert.ok(Array.isArray(monaDetail.data.specialist.packages))
    assert.ok(monaDetail.data.specialist.packages.length >= 1)
    ok('GET /api/specialists/:id returns specialist profile and packages')

    // 5. Open future slots
    const slotsRes = await fetch(`${baseUrl}/specialists/${monaId}/slots`)
    const slotsJson = await slotsRes.json()
    assert.strictEqual(slotsRes.status, 200)
    assert.ok(slotsJson.data.slots.length > 2, 'Should have multiple open slots')
    const testSlot =
      slotsJson.data.slots.find((s) => new Date(s.startsAt).getTime() - Date.now() > 24 * 3600 * 1000) ||
      slotsJson.data.slots[0]
    const secondSlot =
      slotsJson.data.slots.find(
        (s) => s.id !== testSlot.id && new Date(s.startsAt).getTime() - Date.now() > 24 * 3600 * 1000
      ) || slotsJson.data.slots[1]
    ok('GET /api/specialists/:id/slots returns open future slots')

    // 6. SIMULTANEOUS BOOKINGS TEST: Exactly one must succeed, one must fail with 409
    console.log('\n  Testing race condition: 2 simultaneous booking requests for the same slot...')
    const [res1, res2] = await Promise.all([
      fetch(`${baseUrl}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${saraToken}` },
        body: JSON.stringify({ specialistId: monaId, slotId: testSlot.id, sessionType: 'video' }),
      }),
      fetch(`${baseUrl}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${omarToken}` },
        body: JSON.stringify({ specialistId: monaId, slotId: testSlot.id, sessionType: 'video' }),
      }),
    ])

    const json1 = await res1.json()
    const json2 = await res2.json()

    const statuses = [res1.status, res2.status].sort()
    assert.deepStrictEqual(statuses, [201, 409], 'One request must be 201 Created and the other 409 Conflict')

    const successRes = res1.status === 201 ? json1 : json2
    const failRes = res1.status === 409 ? json1 : json2

    assert.ok(successRes.data.booking.id)
    assert.strictEqual(failRes.error.code, 'SLOT_TAKEN')
    const createdBookingId = successRes.data.booking.id
    const bookingOwnerToken = res1.status === 201 ? saraToken : omarToken
    ok('Simultaneous bookings: exactly 1 succeeded (201) and 1 failed with 409 SLOT_TAKEN')

    // Verify slot is now marked is_booked = 1
    const checkSlotBooked = db.prepare('SELECT is_booked FROM availability_slots WHERE id = ?').get(testSlot.id)
    assert.strictEqual(checkSlotBooked.is_booked, 1)
    ok('Slot is marked is_booked = 1 in database')

    // 7. CANCEL FREES THE AVAILABILITY SLOT
    const cancelRes = await fetch(`${baseUrl}/bookings/${createdBookingId}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${bookingOwnerToken}` },
    })
    const cancelJson = await cancelRes.json()
    assert.strictEqual(cancelRes.status, 200)
    assert.strictEqual(cancelJson.data.success, true)
    assert.strictEqual(cancelJson.data.booking.status, 'cancelled')

    // Verify slot in DB is freed
    const checkSlotFreed = db.prepare('SELECT is_booked FROM availability_slots WHERE id = ?').get(testSlot.id)
    assert.strictEqual(checkSlotFreed.is_booked, 0)

    // Verify slot appears again in open slots API
    const recheckedSlots = await (await fetch(`${baseUrl}/specialists/${monaId}/slots`)).json()
    const slotReappeared = recheckedSlots.data.slots.some((s) => s.id === testSlot.id)
    assert.strictEqual(slotReappeared, true)
    ok('Cancel frees the slot (is_booked reset to 0, reappears in open slots)')

    // 8. 12-HOUR CANCELLATION RULE ENFORCEMENT
    // Create a slot starting in 4 hours
    const fourHoursLater = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}/, '')
    const fourHoursEnds = new Date(Date.now() + 4.5 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}/, '')

    const insertSoonSlot = db
      .prepare('INSERT INTO availability_slots (specialist_id, starts_at, ends_at, is_booked) VALUES (?, ?, ?, 0)')
      .run(monaId, fourHoursLater, fourHoursEnds)
    const soonSlotId = Number(insertSoonSlot.lastInsertRowid)

    // Book this slot
    const bookSoonRes = await (
      await fetch(`${baseUrl}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${saraToken}` },
        body: JSON.stringify({ specialistId: monaId, slotId: soonSlotId, sessionType: 'video' }),
      })
    ).json()
    const soonBookingId = bookSoonRes.data.booking.id

    // Attempt to cancel less than 12h away
    const cancelTooLateRes = await fetch(`${baseUrl}/bookings/${soonBookingId}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${saraToken}` },
    })
    const cancelTooLateJson = await cancelTooLateRes.json()
    assert.strictEqual(cancelTooLateRes.status, 409)
    assert.strictEqual(cancelTooLateJson.error.code, 'TOO_LATE_TO_CANCEL')
    ok('12-hour rule strictly blocks cancellation < 12h before session (returns 409 TOO_LATE_TO_CANCEL)')

    // 9. RESCHEDULE APPOINTMENT
    // Book a future slot (> 12h away)
    const bookRescheduleTarget = await (
      await fetch(`${baseUrl}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${saraToken}` },
        body: JSON.stringify({ specialistId: monaId, slotId: testSlot.id, sessionType: 'video' }),
      })
    ).json()
    const reschedBookingId = bookRescheduleTarget.data.booking.id

    // Reschedule from testSlot.id to secondSlot.id
    const reschedRes = await fetch(`${baseUrl}/bookings/${reschedBookingId}/reschedule`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${saraToken}` },
      body: JSON.stringify({ slotId: secondSlot.id }),
    })
    const reschedJson = await reschedRes.json()
    assert.strictEqual(reschedRes.status, 200)
    assert.strictEqual(reschedJson.data.booking.newSlotId, secondSlot.id)

    // Verify old slot is freed and new slot is booked
    const oldSlotCheck = db.prepare('SELECT is_booked FROM availability_slots WHERE id = ?').get(testSlot.id)
    const newSlotCheck = db.prepare('SELECT is_booked FROM availability_slots WHERE id = ?').get(secondSlot.id)
    assert.strictEqual(oldSlotCheck.is_booked, 0, 'Old slot must be freed')
    assert.strictEqual(newSlotCheck.is_booked, 1, 'New slot must be booked')
    ok('Rescheduling correctly frees old slot and locks new slot')

    // 10. GET /api/bookings LIST
    const listRes = await fetch(`${baseUrl}/bookings?tab=upcoming`, {
      headers: { Authorization: `Bearer ${saraToken}` },
    })
    const listJson = await listRes.json()
    assert.strictEqual(listRes.status, 200)
    assert.ok(Array.isArray(listJson.data.bookings))
    assert.ok(listJson.data.bookings.length >= 1)
    assert.ok(listJson.data.bookings[0].specialist.name)
    ok('GET /api/bookings?tab=upcoming returns client bookings with specialist summary')

    // 11. GET /api/bookings/:id/session MOCK
    const sessionRes = await fetch(`${baseUrl}/bookings/${reschedBookingId}/session`, {
      headers: { Authorization: `Bearer ${saraToken}` },
    })
    const sessionJson = await sessionRes.json()
    assert.strictEqual(sessionRes.status, 200)
    assert.ok(sessionJson.data.session.roomUrl)
    assert.strictEqual(sessionJson.data.session.bookingId, reschedBookingId)
    ok('GET /api/bookings/:id/session returns session room URL and participant info')

    console.log(`\nAll ${passed} Phase 3 tests passed successfully!`)
  } finally {
    server.close()
  }
}

run().catch((err) => {
  console.error('\n❌ Test failed:', err)
  if (server) server.close()
  process.exit(1)
})

