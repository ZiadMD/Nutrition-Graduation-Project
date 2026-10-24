// server/src/analytics/range.js
// Handles period parsing, previous period calculation, and Cairo timezone conversions.

export const CAIRO_OFFSET_HOURS = 2
export const WEEK_START = 6 // Saturday (Egyptian convention: 0=Sun, 1=Mon, ..., 6=Sat)

/**
 * Format Date object to 'YYYY-MM-DD'.
 */
export function formatDate(d) {
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parses a 'YYYY-MM-DD' string to a UTC Date object at 00:00:00 UTC.
 */
export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0))
}

/**
 * Adds integer days to a 'YYYY-MM-DD' string and returns a new 'YYYY-MM-DD' string.
 */
export function addDays(dateStr, days) {
  const d = parseDate(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return formatDate(d)
}

/**
 * Calculates the inclusive count of days between two 'YYYY-MM-DD' strings.
 */
export function countDays(fromStr, toStr) {
  const t1 = parseDate(fromStr).getTime()
  const t2 = parseDate(toStr).getTime()
  return Math.round((t2 - t1) / (86400 * 1000)) + 1
}

/**
 * Converts an ISO 8601 string (or Date object) to a Cairo calendar date 'YYYY-MM-DD'.
 * Applies CAIRO_OFFSET_HOURS (UTC+2) to the timestamp.
 */
export function isoToCairoDate(isoStr) {
  if (!isoStr) return null
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return null
  // Shift by CAIRO_OFFSET_HOURS
  const cairoMs = d.getTime() + CAIRO_OFFSET_HOURS * 3600 * 1000
  return formatDate(new Date(cairoMs))
}

/**
 * Returns the hour of the day (0..23) in Cairo local time for a given ISO timestamp.
 */
export function isoToCairoHour(isoStr) {
  if (!isoStr) return 0
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return 0
  const cairoMs = d.getTime() + CAIRO_OFFSET_HOURS * 3600 * 1000
  return new Date(cairoMs).getUTCHours()
}

/**
 * Returns the day of week (0..6, where 0=Sun, 6=Sat) in Cairo local time for an ISO timestamp.
 */
export function isoToCairoDow(isoStr) {
  if (!isoStr) return 0
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return 0
  const cairoMs = d.getTime() + CAIRO_OFFSET_HOURS * 3600 * 1000
  return new Date(cairoMs).getUTCDay()
}

/**
 * Returns the Cairo calendar date for today.
 */
export function getCairoToday() {
  return isoToCairoDate(new Date().toISOString())
}

/**
 * Computes the weekly bucket label (the starting Saturday 'YYYY-MM-DD') for any date.
 */
export function getWeekStartBucket(dateStr, weekStart = WEEK_START) {
  const d = parseDate(dateStr)
  const currentDow = d.getUTCDay() // 0=Sun ... 6=Sat
  // Calculate how many days to rewind to reach the previous Saturday (or current if Saturday)
  const diff = (currentDow - weekStart + 7) % 7
  d.setUTCDate(d.getUTCDate() - diff)
  return formatDate(d)
}

/**
 * Parses range parameters: ?range=7d|30d|90d or explicit from/to ('YYYY-MM-DD').
 *
 * Rules:
 * - Whole days, inclusive.
 * - Previous period is the SAME number of days immediately before 'from'.
 * - Granularity is 'day' if total days <= 31, otherwise 'week'.
 */
export function parseRange(params = {}) {
  const today = getCairoToday()
  let from = ''
  let to = ''

  if (params.from && params.to) {
    from = params.from.trim()
    to = params.to.trim()
  } else {
    const rangePreset = (params.range || '30d').toLowerCase()
    const days = rangePreset === '7d' ? 7 : rangePreset === '90d' ? 90 : 30
    to = today
    from = addDays(today, -(days - 1))
  }

  // Validate date strings
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD.')
  }

  if (from > to) {
    throw new Error('from date cannot be after to date.')
  }

  const durationDays = countDays(from, to)
  if (durationDays > 365) {
    throw new Error('Maximum range duration is 365 days.')
  }

  // Calculate previous period of equal length immediately preceding 'from'
  const prevTo = addDays(from, -1)
  const prevFrom = addDays(prevTo, -(durationDays - 1))

  const granularity = durationDays <= 31 ? 'day' : 'week'

  return {
    from,
    to,
    durationDays,
    granularity,
    previous: {
      from: prevFrom,
      to: prevTo,
    },
  }
}
