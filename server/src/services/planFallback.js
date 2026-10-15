// planFallback.js — Deterministic, injury-aware plan generator.
//
// Generates a customized 7-day plan from seed-content/*.json when:
// - No AI API key is configured
// - Network is offline
// - The AI provider fails or times out
//
// Guardrails:
// - Filters out exercises whose avoidFor contains any of the client's injury areas
// - If any injury has painLevel >= 7, sets needsReview: true and switches to gentle mobility
// - Enforces a daily calorie floor of 1,400 kcal
// - Filters meals based on allergies and disliked foods
// - Includes standard disclaimer

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SEED_DIR = join(__dirname, '../../seed-content')

// Load seed content libraries
const exercisesData = JSON.parse(readFileSync(join(SEED_DIR, 'exercises.json'), 'utf8'))
const recoveryData = JSON.parse(readFileSync(join(SEED_DIR, 'recovery.json'), 'utf8'))
const mealsData = JSON.parse(readFileSync(join(SEED_DIR, 'meals.json'), 'utf8'))

export const MIN_DAILY_CALORIES = 1400
export const AI_DISCLAIMER = 'AI draft. Your specialist reviews it before it becomes your plan.'

/**
 * Normalizes injury body areas into standard tokens.
 */
function normalizeArea(str) {
  const s = String(str || '').toLowerCase()
  if (s.includes('knee')) return 'knee'
  if (s.includes('back')) return s.includes('upper') ? 'upper_back' : 'lower_back'
  if (s.includes('shoulder')) return 'shoulder'
  if (s.includes('neck')) return 'neck'
  if (s.includes('hip')) return 'hip'
  if (s.includes('ankle') || s.includes('foot')) return 'ankle_foot'
  if (s.includes('wrist') || s.includes('elbow')) return 'elbow_wrist'
  return s.trim()
}

/**
 * Generates a deterministic fallback plan from seed content.
 */
export function generateFallbackPlan(input) {
  const goal = input.goal || 'lose_fat'
  const daysPerWeek = Math.min(Math.max(Number(input.daysPerWeek) || 4, 2), 6)
  const injuries = Array.isArray(input.injuries) ? input.injuries : []
  const dietStyle = String(input.diet || input.dietStyle || '').toLowerCase()
  const allergies = Array.isArray(input.allergies)
    ? input.allergies.map((a) => String(a).toLowerCase())
    : String(input.allergies || '')
        .toLowerCase()
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
  const dislikedFoods = String(input.dislikedFoods || '').toLowerCase()

  // 1. Identify injury body areas and severe pain
  const injuryAreas = new Set()
  let hasSeverePain = false

  for (const inj of injuries) {
    const area = normalizeArea(inj.bodyArea || inj.area)
    if (area) injuryAreas.add(area)
    const level = Number(inj.painLevel || inj.level || 0)
    if (level >= 7) {
      hasSeverePain = true
    }
  }

  // 2. Filter exercises: exclude anything whose avoidFor intersects client's injury areas
  const safeExercises = exercisesData.filter((ex) => {
    const avoid = ex.avoidFor || []
    return !avoid.some((area) => injuryAreas.has(area))
  })

  // 3. Filter recovery exercises: prioritize exercises targeting client's injury areas
  const relevantRecovery = recoveryData.filter((rec) => {
    const avoid = rec.avoidFor || []
    return !avoid.some((area) => injuryAreas.has(area))
  })

  // 4. Filter meals: exclude allergies and disliked foods
  const safeMeals = mealsData.filter((meal) => {
    // Check meal tags & avoidFor against allergies
    const mealAvoid = (meal.avoidFor || []).map((s) => s.toLowerCase())
    const hasAllergy = allergies.some((a) => mealAvoid.includes(a) || meal.tags?.some((t) => t.toLowerCase() === a))
    if (hasAllergy) return false

    // Check disliked foods against title
    const titleLower = meal.title.toLowerCase()
    if (dislikedFoods) {
      const dislikedList = dislikedFoods.split(',').map((s) => s.trim()).filter(Boolean)
      if (dislikedList.some((d) => titleLower.includes(d))) return false
    }

    // Check vegetarian diet
    if (dietStyle.includes('veg') && (titleLower.includes('chicken') || titleLower.includes('meat') || titleLower.includes('tilapia') || titleLower.includes('kofta') || titleLower.includes('tuna'))) {
      return false
    }

    return true
  })

  // 5. Build MOVE plan items
  // Schedule workout days: e.g. for 4 days -> Mon(1), Wed(3), Thu(4), Sat(6)
  const trainingDaysMap = {
    2: [1, 4],
    3: [1, 3, 5],
    4: [1, 3, 4, 6],
    5: [1, 2, 4, 5, 6],
    6: [1, 2, 3, 4, 5, 6],
  }
  const activeWorkoutDays = trainingDaysMap[daysPerWeek] || [1, 3, 4, 6]

  const moveItems = []
  if (!hasSeverePain) {
    activeWorkoutDays.forEach((dow, dayIdx) => {
      // Pick 3 safe exercises per workout day
      const dayExercises = safeExercises.slice((dayIdx * 3) % safeExercises.length, ((dayIdx * 3) % safeExercises.length) + 3)
      // If sliced wrap-around was small, top up
      while (dayExercises.length < 3 && safeExercises.length > 0) {
        dayExercises.push(safeExercises[dayExercises.length % safeExercises.length])
      }

      dayExercises.forEach((ex) => {
        moveItems.push({
          dayOfWeek: dow,
          title: ex.title,
          sets: ex.sets || 3,
          reps: ex.reps || '10',
          tempo: ex.tempo || '3-0-1',
          restSec: ex.restSec || 60,
          durationMin: ex.durationMin || null,
          painLimit: ex.painLimit || (injuryAreas.size > 0 ? 4 : 5),
          safetyNote: ex.safetyNote || (injuryAreas.size > 0 ? 'Stop if pain increases.' : null),
        })
      })
    })
  }

  // 6. Build RECOVER plan items
  // Schedule daily recovery for all 7 days
  const recoverItems = []
  const recoveryPool = relevantRecovery.length > 0 ? relevantRecovery : recoveryData

  for (let dow = 1; dow <= 7; dow++) {
    // Pick 2 recovery movements per day
    const rec1 = recoveryPool[(dow - 1) % recoveryPool.length]
    const rec2 = recoveryPool[dow % recoveryPool.length]

    recoverItems.push({
      dayOfWeek: dow,
      title: rec1.title,
      sets: rec1.sets || 3,
      reps: rec1.reps || '12',
      tempo: rec1.tempo || 'Slow',
      restSec: rec1.restSec || 30,
      durationMin: rec1.durationMin || null,
      painLimit: rec1.painLimit || 4,
      safetyNote: rec1.safetyNote || 'Focus on controlled range of motion.',
    })

    if (rec2 && rec2.title !== rec1.title) {
      recoverItems.push({
        dayOfWeek: dow,
        title: rec2.title,
        sets: rec2.sets || 2,
        reps: rec2.reps || '15',
        tempo: rec2.tempo || 'Slow',
        restSec: rec2.restSec || 30,
        durationMin: rec2.durationMin || null,
        painLimit: rec2.painLimit || 4,
        safetyNote: rec2.safetyNote || null,
      })
    }
  }

  // 7. Build EAT plan items (all 7 days) and enforce 1,400 kcal floor
  const mealPool = safeMeals.length > 0 ? safeMeals : mealsData
  const breakfasts = mealPool.filter((m) => m.mealType === 'breakfast')
  const lunches = mealPool.filter((m) => m.mealType === 'lunch')
  const snacks = mealPool.filter((m) => m.mealType === 'snack')
  const dinners = mealPool.filter((m) => m.mealType === 'dinner')

  const eatItems = []
  for (let dow = 1; dow <= 7; dow++) {
    const b = breakfasts[(dow - 1) % (breakfasts.length || 1)] || mealPool[0]
    const l = lunches[(dow - 1) % (lunches.length || 1)] || mealPool[1]
    const s = snacks[(dow - 1) % (snacks.length || 1)] || mealPool[2]
    const d = dinners[(dow - 1) % (dinners.length || 1)] || mealPool[3]

    const dayMeals = [b, l, s, d]
    let dayCalories = dayMeals.reduce((sum, m) => sum + (m.kcal || 0), 0)

    // Enforce 1,400 kcal floor: if total is below 1,400, top up or add a snack
    if (dayCalories < MIN_DAILY_CALORIES) {
      const extraKcalNeeded = MIN_DAILY_CALORIES - dayCalories
      dayMeals.push({
        mealType: 'snack',
        title: 'Nut butter & banana on toast',
        kcal: extraKcalNeeded + 50,
        proteinG: 12,
        carbsG: 30,
        fatG: 14,
      })
    }

    dayMeals.forEach((m) => {
      eatItems.push({
        dayOfWeek: dow,
        mealType: m.mealType || 'snack',
        title: m.title,
        kcal: m.kcal || 350,
        proteinG: m.proteinG || 20,
        carbsG: m.carbsG || 35,
        fatG: m.fatG || 12,
      })
    })
  }

  // 8. Build summary sentence
  let summary = `Balanced 7-day plan with ${daysPerWeek} weekly workouts and daily recovery.`
  if (injuryAreas.size > 0) {
    const areas = Array.from(injuryAreas).join(' and ')
    summary = `Injury-aware draft customized to protect your ${areas}. ${daysPerWeek} training days scheduled with joint-safe modifications.`
  }
  if (hasSeverePain) {
    summary = `High pain reported. High-load movements have been paused in favor of gentle physical therapy routines until your specialist reviews.`
  }

  return {
    summary,
    disclaimer: AI_DISCLAIMER,
    needsReview: hasSeverePain,
    move: moveItems,
    eat: eatItems,
    recover: recoverItems,
  }
}
