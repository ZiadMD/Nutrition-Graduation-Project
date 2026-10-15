// case.js — Utilities to convert between snake_case (database) and camelCase (JSON API).
//
// The spec states:
// "JSON keys are camelCase; database columns are snake_case. Convert in one small helper."

/**
 * Converts a snake_case string to camelCase.
 * e.g. "plan_start_date" -> "planStartDate"
 */
export function snakeToCamel(str) {
  return str.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase())
}

/**
 * Converts a camelCase string to snake_case.
 * e.g. "planStartDate" -> "plan_start_date"
 */
export function camelToSnake(str) {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase()
}

/**
 * Converts all top-level keys of an object from snake_case to camelCase.
 */
export function toCamelCase(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj

  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    result[snakeToCamel(key)] = value
  }
  return result
}

/**
 * Converts all top-level keys of an object from camelCase to snake_case.
 */
export function toSnakeCase(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj

  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    result[camelToSnake(key)] = value
  }
  return result
}

