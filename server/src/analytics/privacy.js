// server/src/analytics/privacy.js
// Enforces privacy guardrails, cohort suppression, and clinical data isolation.

export const MIN_COHORT = 5

export const FORBIDDEN_CLINICAL_KEYS = [
  'goal',
  'weight_kg',
  'weightKg',
  'pain',
  'painLevel',
  'injuries',
  'allergies',
  'note',
  'notes',
  'plan',
  'plans',
  'items',
  'summary',
  'bodyArea',
]

/**
 * Checks cohort size and suppresses metric if cohort < MIN_COHORT.
 *
 * @param {object} metricObj - Standard metric or comparison object
 * @param {number} cohortSize - Number of members in the cohort / slice
 * @returns {object} Unsuppressed object or { suppressed: true, value: null, ... }
 */
export function suppress(metricObj, cohortSize) {
  if (cohortSize < MIN_COHORT) {
    return {
      ...(typeof metricObj === 'object' && metricObj !== null ? metricObj : {}),
      suppressed: true,
      value: null,
      previous: null,
      delta: null,
      deltaPct: null,
    }
  }

  return {
    ...(typeof metricObj === 'object' && metricObj !== null ? metricObj : { value: metricObj }),
    suppressed: false,
  }
}

/**
 * Recursively scans any object or array for forbidden clinical keys.
 * Throws an Error if any prohibited key is detected.
 *
 * @param {any} data
 * @param {string} [currentPath='']
 */
export function assertNoForbiddenKeys(data, currentPath = '') {
  if (data === null || data === undefined) return

  if (Array.isArray(data)) {
    data.forEach((item, index) => {
      assertNoForbiddenKeys(item, `${currentPath}[${index}]`)
    })
    return
  }

  if (typeof data === 'object') {
    for (const key of Object.keys(data)) {
      const lowerKey = key.toLowerCase()
      const isForbidden = FORBIDDEN_CLINICAL_KEYS.some(
        (fk) => fk.toLowerCase() === lowerKey
      )

      if (isForbidden) {
        throw new Error(
          `Privacy Violation: Forbidden clinical key "${key}" detected at path "${currentPath}.${key}" in analytical payload.`
        )
      }

      assertNoForbiddenKeys(data[key], `${currentPath}.${key}`)
    }
  }
}
