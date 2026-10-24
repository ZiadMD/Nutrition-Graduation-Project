// server/src/analytics/buckets.js
// Generates contiguous bucket arrays to guarantee zero-filled timeseries with no gaps.

import { addDays, countDays, getWeekStartBucket, parseDate, formatDate, WEEK_START } from './range.js'

/**
 * Generates an array of bucket label strings covering [from, to] inclusive.
 *
 * @param {string} from - 'YYYY-MM-DD'
 * @param {string} to - 'YYYY-MM-DD'
 * @param {'day'|'week'} granularity
 * @param {number} [weekStart=WEEK_START]
 * @returns {string[]} Array of bucket labels (YYYY-MM-DD)
 */
export function generateBuckets(from, to, granularity = 'day', weekStart = WEEK_START) {
  if (granularity === 'day') {
    const buckets = []
    const totalDays = countDays(from, to)
    let current = from
    for (let i = 0; i < totalDays; i++) {
      buckets.push(current)
      current = addDays(current, 1)
    }
    return buckets
  }

  // Weekly buckets
  const buckets = []
  let currentWeekStart = getWeekStartBucket(from, weekStart)
  const lastWeekStart = getWeekStartBucket(to, weekStart)

  while (currentWeekStart <= lastWeekStart) {
    buckets.push(currentWeekStart)
    currentWeekStart = addDays(currentWeekStart, 7)
  }

  return buckets
}

/**
 * Maps a list of raw database bucket aggregates into a full zero-filled timeseries.
 *
 * @param {string[]} buckets - Continuous bucket labels
 * @param {Map<string, object>|Record<string, object>} dataMap - Data indexed by bucket
 * @param {string[]} valueKeys - Keys to extract and zero-fill (default: ['value'])
 * @returns {Array<object>} Array of { date: bucket, ...values }
 */
export function zeroFillSeries(buckets, dataMap, valueKeys = ['value']) {
  const isMap = dataMap instanceof Map

  return buckets.map((bucket) => {
    const entry = isMap ? dataMap.get(bucket) : dataMap?.[bucket]
    const row = { date: bucket }

    for (const key of valueKeys) {
      row[key] = entry?.[key] ?? 0
    }

    return row
  })
}
