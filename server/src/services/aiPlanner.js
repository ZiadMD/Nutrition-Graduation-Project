// aiPlanner.js — AI-powered plan generation with automated fallback.
//
// Single entry point: generatePlan(input).
// When an AI provider (e.g. Gemini, OpenAI) and API key are configured in .env,
// it requests a 7-day personalized plan in strict JSON.
// If the API key is missing, times out (10s), or returns invalid schema,
// it seamlessly falls back to planFallback.js.

import { z } from 'zod'
import { generateFallbackPlan, AI_DISCLAIMER, MIN_DAILY_CALORIES } from './planFallback.js'

// ── Zod schema to validate model response ───────────────────────────────────

const planItemSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(1).max(7),
  title: z.string().min(1),
  sets: z.coerce.number().optional().nullable(),
  reps: z.union([z.string(), z.number()]).transform((v) => (v !== null && v !== undefined ? String(v) : null)).optional().nullable(),
  tempo: z.string().optional().nullable(),
  restSec: z.coerce.number().optional().nullable(),
  durationMin: z.coerce.number().optional().nullable(),
  painLimit: z.coerce.number().min(0).max(10).optional().nullable(),
  safetyNote: z.string().optional().nullable(),
})

const mealItemSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(1).max(7),
  mealType: z.string().optional().default('lunch'),
  title: z.string().min(1),
  kcal: z.coerce.number().min(1),
  proteinG: z.coerce.number().optional().nullable(),
  carbsG: z.coerce.number().optional().nullable(),
  fatG: z.coerce.number().optional().nullable(),
})

const aiPlanOutputSchema = z.object({
  summary: z.string().min(1),
  move: z.array(planItemSchema),
  eat: z.array(mealItemSchema),
  recover: z.array(planItemSchema),
})

// ── Prompt Builder ──────────────────────────────────────────────────────────

function buildPrompt(input) {
  const injuriesText = Array.isArray(input.injuries) && input.injuries.length > 0
    ? input.injuries.map((i) => `${i.bodyArea || i.area || 'unspecified'}: pain ${i.painLevel || i.level || '?'}/10`).join(', ')
    : 'None reported'

  return `You are an expert sports physiologist, physical therapist, and clinical sports nutritionist.
Create a structured 7-day fitness, nutrition, and recovery plan for this client.

Client details:
- Goal: ${input.goal || 'General health'}
- Training days per week: ${input.daysPerWeek || 4}
- Equipment: ${Array.isArray(input.equipment) ? input.equipment.join(', ') : input.equipment || 'Gym'}
- Diet preference: ${input.diet || input.dietStyle || 'Balanced Egyptian food'}
- Reported injuries / pain areas: ${injuriesText}

REQUIREMENTS:
1. Day numbers must be 1 to 7 (1 = Monday, 7 = Sunday).
2. For any injured body area, NEVER program deep high-impact movements that stress that joint. Use joint-safe variations with a painLimit (0-10) and safetyNote.
3. Every day must include breakfast, lunch, and dinner with authentic Egyptian/Mediterranean foods, meeting at least 1,400 kcal per day.
4. Output STRICT JSON ONLY matching this exact structure:
{
  "summary": "One or two sentence overview of the plan and safety modifications.",
  "move": [
    { "dayOfWeek": 1, "title": "Box squat to 60 deg", "sets": 3, "reps": "10", "tempo": "3-1-1", "restSec": 90, "durationMin": 45, "painLimit": 4, "safetyNote": "Stop if knee aches" }
  ],
  "eat": [
    { "dayOfWeek": 1, "mealType": "breakfast", "title": "Foul with olive oil and eggs", "kcal": 420, "proteinG": 22, "carbsG": 40, "fatG": 14 }
  ],
  "recover": [
    { "dayOfWeek": 1, "title": "Quad sets", "sets": 3, "reps": "15", "tempo": "5s hold", "restSec": 30, "durationMin": 10, "painLimit": 4, "safetyNote": "Gentle contraction" }
  ]
}`
}

// ── Call Gemini API ─────────────────────────────────────────────────────────

async function callGemini(apiKey, model, prompt) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    }),
    signal: AbortSignal.timeout(10000), // 10s strict timeout
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API error (${response.status}): ${errorText}`)
  }

  const json = await response.json()
  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!rawText) throw new Error('Empty response from Gemini')

  return JSON.parse(rawText)
}

// ── Apply Guardrails in Code ────────────────────────────────────────────────

function applyGuardrails(draft, input) {
  const injuries = Array.isArray(input.injuries) ? input.injuries : []
  const hasSeverePain = injuries.some((i) => Number(i.painLevel || i.level || 0) >= 7)

  // 1. Mandatory disclaimer
  draft.disclaimer = AI_DISCLAIMER
  draft.needsReview = hasSeverePain || Boolean(draft.needsReview)

  // 2. High pain safety: if pain >= 7, restrict high load exercises
  if (hasSeverePain) {
    draft.move = draft.move.filter((m) => !m.title.toLowerCase().includes('squat') && !m.title.toLowerCase().includes('deadlift'))
    draft.summary = `High pain reported. High-load movements paused in favor of gentle mobility until your specialist reviews.`
  }

  // 3. Enforce 1,400 kcal floor across days in 'eat'
  const caloriesPerDay = new Map()
  for (const item of draft.eat) {
    caloriesPerDay.set(item.dayOfWeek, (caloriesPerDay.get(item.dayOfWeek) || 0) + (item.kcal || 0))
  }

  for (let dow = 1; dow <= 7; dow++) {
    const total = caloriesPerDay.get(dow) || 0
    if (total < MIN_DAILY_CALORIES) {
      const topUpKcal = MIN_DAILY_CALORIES - total + 50
      draft.eat.push({
        dayOfWeek: dow,
        mealType: 'snack',
        title: 'Nut butter & banana snack',
        kcal: topUpKcal,
        proteinG: 10,
        carbsG: 25,
        fatG: 12,
      })
    }
  }

  return draft
}

// ── Public Orchestrator ─────────────────────────────────────────────────────

/**
 * Generates a plan draft using AI provider with automatic fallback.
 *
 * @param {object} input - Plan requirements (goal, daysPerWeek, injuries, equipment, diet)
 * @returns {Promise<{ source: "ai" | "fallback", provider: string, draft: object }>}
 */
export async function generatePlan(input) {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase()
  const apiKey = process.env.AI_API_KEY
  const model = process.env.AI_MODEL || 'gemini-1.5-flash'

  // If no API key is provided, use fallback immediately
  if (!apiKey || !apiKey.trim()) {
    const fallbackDraft = generateFallbackPlan(input)
    return {
      source: 'fallback',
      provider: 'fallback',
      draft: applyGuardrails(fallbackDraft, input),
    }
  }

  try {
    const prompt = buildPrompt(input)
    let rawOutput = null

    if (provider === 'gemini') {
      rawOutput = await callGemini(apiKey, model, prompt)
    } else {
      throw new Error(`Unsupported AI provider: ${provider}`)
    }

    // Validate structure against Zod schema
    const parsed = aiPlanOutputSchema.safeParse(rawOutput)
    if (!parsed.success) {
      console.warn('[AI Planner] Model output did not match expected schema. Falling back to deterministic plan.')
      const fallbackDraft = generateFallbackPlan(input)
      return {
        source: 'fallback',
        provider: 'fallback',
        draft: applyGuardrails(fallbackDraft, input),
      }
    }

    const safeDraft = applyGuardrails(parsed.data, input)

    return {
      source: 'ai',
      provider,
      draft: safeDraft,
    }
  } catch (err) {
    console.warn(`[AI Planner] ${err.message}. Using fallback generator.`)
    const fallbackDraft = generateFallbackPlan(input)
    return {
      source: 'fallback',
      provider: 'fallback',
      draft: applyGuardrails(fallbackDraft, input),
    }
  }
}

