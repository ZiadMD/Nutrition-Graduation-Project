// test-ratings-reviews.js — Tests for specialist ratings, reviews, breakdown, and anti-spam verification
import assert from 'node:assert'
import http from 'node:http'
import app from './src/app.js'

const PORT = 4015
const baseUrl = `http://localhost:${PORT}/api`

async function run() {
  console.log(`Starting Ratings & Reviews test suite on ${baseUrl}...`)

  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(PORT, resolve))

  try {
    // 1. Directory returns ratings, reviewsCount, clientsCount
    const spRes = await (await fetch(`${baseUrl}/specialists`)).json()
    assert.strictEqual(spRes.data.specialists.length >= 6, true)
    const mona = spRes.data.specialists.find((s) => s.name.includes('Mona'))
    assert.ok(mona, 'Specialist Mona must exist')
    assert.ok(typeof mona.rating === 'number', 'Rating must be a number')
    assert.ok(mona.reviewsCount >= 4, 'Must have at least 4 reviews')
    assert.ok(mona.clientsCount > 0, 'Must have clients count')
    console.log('  ✓ GET /api/specialists includes rating, reviewsCount, and clientsCount')

    // 2. Reviews endpoint returns summary, breakdown, and reviews list
    const revRes = await (await fetch(`${baseUrl}/specialists/mona/reviews`)).json()
    assert.ok(revRes.data.summary, 'Summary must exist')
    assert.strictEqual(typeof revRes.data.summary.averageRating, 'number')
    assert.strictEqual(typeof revRes.data.summary.totalReviews, 'number')
    assert.ok(revRes.data.summary.breakdown, 'Breakdown must exist')
    assert.ok(Array.isArray(revRes.data.reviews), 'Reviews must be an array')
    assert.ok(revRes.data.reviews.length >= 4, 'Must return seeded reviews')
    assert.ok(revRes.data.reviews[0].client.name, 'Review must include client name')
    console.log('  ✓ GET /api/specialists/:id/reviews returns summary breakdown and reviews list')

    // 3. Unauthenticated / unverified user cannot review
    const unauthPost = await fetch(`${baseUrl}/specialists/mona/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 5, comment: 'Nice' }),
    })
    assert.strictEqual(unauthPost.status, 401, 'Unauthenticated POST must return 401')
    console.log('  ✓ Unauthenticated POST /api/specialists/:id/reviews is rejected with 401')

    // 4. Client with no bookings/care team is blocked from reviewing (anti-spam)
    const omarLogin = await (
      await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'omar@demo.com', password: 'demo1234' }),
      })
    ).json()
    const omarToken = omarLogin.data.token

    const spamPost = await fetch(`${baseUrl}/specialists/mona/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${omarToken}`,
      },
      body: JSON.stringify({ rating: 1, comment: 'Spam review' }),
    })
    assert.strictEqual(spamPost.status, 403, 'Unverified client must be rejected with 403')
    const spamErr = await spamPost.json()
    assert.strictEqual(spamErr.error.code, 'REVIEW_NOT_ELIGIBLE')
    console.log('  ✓ Anti-spam check blocks unverified client with 403 REVIEW_NOT_ELIGIBLE')

    // 5. Verified client (Sara) can submit / update review
    const saraLogin = await (
      await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'sara@demo.com', password: 'demo1234' }),
      })
    ).json()
    const saraToken = saraLogin.data.token

    const validPost = await fetch(`${baseUrl}/specialists/mona/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${saraToken}`,
      },
      body: JSON.stringify({
        rating: 5,
        comment: 'Dr. Mona is fantastic! My recovery was quick and completely painless.',
      }),
    })
    assert.strictEqual(validPost.status, 201, 'Verified client review must succeed with 201')
    const validJson = await validPost.json()
    assert.strictEqual(validJson.data.review.rating, 5)
    assert.strictEqual(
      validJson.data.review.comment,
      'Dr. Mona is fantastic! My recovery was quick and completely painless.'
    )
    console.log('  ✓ Verified client can submit and update their rating and review (201)')

    console.log('\nAll Ratings & Reviews tests passed successfully!')
  } finally {
    server.close()
  }
}

run()
