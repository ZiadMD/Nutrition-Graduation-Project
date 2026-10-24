// server/src/analytics/check.js
// CLI script to display headline analytical metrics for sample scopes over the last 30 days vs previous 30 days.

import db from '../db/connection.js'
import { getAnalytics } from './metrics.js'

function formatVal(kpi) {
  if (kpi?.suppressed) {
    return '[SUPPRESSED (Cohort < 5)]'
  }
  const val = kpi?.value !== null && kpi?.value !== undefined ? kpi.value : 'N/A'
  const prev = kpi?.previous !== null && kpi?.previous !== undefined ? kpi.previous : 'N/A'
  const delta = kpi?.delta !== null && kpi?.delta !== undefined ? (kpi.delta >= 0 ? `+${kpi.delta}` : `${kpi.delta}`) : '0'
  const deltaPct = kpi?.deltaPct !== null && kpi?.deltaPct !== undefined ? ` (${kpi.deltaPct >= 0 ? `+${kpi.deltaPct}` : `${kpi.deltaPct}`}%)` : ''
  const unit = kpi?.unit ? ` ${kpi.unit}` : ''

  return `${val}${unit} (prev: ${prev}${unit} | change: ${delta}${unit}${deltaPct})`
}

function runCheck() {
  console.log('======================================================================')
  console.log(' 📊 REBOUND PLATFORM ANALYTICS CHECK (30 Days vs Previous 30 Days)')
  console.log('======================================================================\n')

  // Discover sample organizations
  const apex = db.prepare(`SELECT id, name FROM organizations WHERE id = 1`).get()
  const cu = db.prepare(`SELECT id, name FROM organizations WHERE type = 'university' LIMIT 1`).get()
  const giza = db.prepare(`SELECT id, name FROM organizations WHERE name LIKE '%Giza%' LIMIT 1`).get()

  const scopes = [
    { name: `1. Organization: ${apex?.name || 'Apex Athletic Club'}`, scope: { type: 'organization', orgId: apex?.id || 1 } },
    ...(cu ? [{ name: `2. Organization (University): ${cu.name}`, scope: { type: 'organization', orgId: cu.id } }] : []),
    ...(giza ? [{ name: `3. Organization (Tiny Cohort): ${giza.name}`, scope: { type: 'organization', orgId: giza.id } }] : []),
    { name: '4. B2C Consumer Segment (organization_id IS NULL)', scope: { type: 'b2c' } },
    { name: '5. Whole Platform (System Admin Scope)', scope: { type: 'all' } },
  ]

  scopes.forEach(({ name, scope }) => {
    console.log(`----------------------------------------------------------------------`)
    console.log(`📌 Scope: ${name}`)
    console.log(`----------------------------------------------------------------------`)

    try {
      const data = getAnalytics(scope, { range: '30d' }, db)
      console.log(`Period: ${data.range.from} to ${data.range.to} | Previous: ${data.range.previous.from} to ${data.range.previous.to}`)

      data.kpis.forEach((kpi) => {
        console.log(`  • ${kpi.label.padEnd(25)}: ${formatVal(kpi)}`)
      })

      if (data.breakdowns?.funnel) {
        const f = data.breakdowns.funnel
        console.log(`  • Cohort Funnel (Joined in 30d): Joined: ${f.joined} → Onboarded: ${f.onboarded} → Assigned: ${f.assigned} → Active: ${f.active}`)
      }

      if (data.breakdowns?.adherenceByPillar) {
        const p = data.breakdowns.adherenceByPillar
        if (p.suppressed) {
          console.log(`  • Pillar Adherence       : [SUPPRESSED (Cohort < 5)]`)
        } else {
          console.log(`  • Pillar Adherence       : Move: ${p.move ?? 'N/A'} | Eat: ${p.eat ?? 'N/A'} | Recover: ${p.recover ?? 'N/A'}`)
        }
      }

      console.log()
    } catch (err) {
      console.error(`Error computing metrics for ${name}:`, err.message)
    }
  })

  console.log('======================================================================\n')
}

runCheck()
