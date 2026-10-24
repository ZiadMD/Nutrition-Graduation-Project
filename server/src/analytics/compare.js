// server/src/analytics/compare.js
// Handles KPI comparison arithmetic and percentage change calculations.

/**
 * Computes difference and percentage delta between current and previous values.
 *
 * @param {number|null} current
 * @param {number|null} previous
 * @param {object} [options]
 * @param {string} [options.unit]
 * @param {number} [options.precision=1] - Decimal precision for percentage
 * @returns {{ value: number|null, previous: number|null, delta: number|null, deltaPct: number|null, unit?: string }}
 */
export function withDelta(current, previous, options = {}) {
  if (current === null || current === undefined) {
    return {
      value: null,
      previous: previous ?? null,
      delta: null,
      deltaPct: null,
      ...(options.unit ? { unit: options.unit } : {}),
    }
  }

  const prev = previous ?? 0
  const delta = Math.round((current - prev) * 100) / 100

  let deltaPct = null
  if (prev !== 0) {
    const rawPct = ((current - prev) / Math.abs(prev)) * 100
    const factor = Math.pow(10, options.precision ?? 1)
    deltaPct = Math.round(rawPct * factor) / factor
  }

  const result = {
    value: current,
    previous: previous ?? 0,
    delta,
    deltaPct,
  }

  if (options.unit) {
    result.unit = options.unit
  }

  return result
}
