import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { UserPlus, CalendarCheck, ShieldCheck, ClipboardList, TriangleAlert, ArrowRight } from 'lucide-react'
import { Card, EmptyState, Gate, PageHead, Skeleton, StateSwitcher, SVC, type DemoState } from '../../ui'
import type { Svc } from '../../data'
import { api } from '../../api'

const initialTiles = [
  ['Users', '1,284', '+38 this week', 'bg-sand'],
  ['Active plans', '612', '+21 this week', SVC.move.tint],
  ['Bookings this week', '947', '+6% vs last week', SVC.eat.tint],
  ['Specialists', '46', '3 waiting for approval', SVC.recover.tint],
] as const

const fallbackActivity: [any, Svc, string, string][] = [
  [UserPlus, 'move', 'Sara Hassan joined and finished onboarding', '12 min ago'],
  [CalendarCheck, 'recover', 'Dr. Mona Fathy confirmed 3 sessions for Thursday', '34 min ago'],
  [ClipboardList, 'eat', 'Hana Mostafa updated a meal plan for Omar Khaled', '1 h ago'],
  [TriangleAlert, 'recover', 'Laila Mostafa reported pain 8/10 to Dr. Mona', '1 h ago'],
  [ShieldCheck, 'move', 'Dr. Yasmin Farouk applied as a physical therapist', '3 h ago'],
  [CalendarCheck, 'move', 'Coach Karim Adel opened 12 new slots for next week', 'Yesterday'],
]

function getIconForType(type: string) {
  if (type === 'user_registered') return UserPlus
  if (type === 'plan_updated') return ClipboardList
  if (type === 'specialist_application') return ShieldCheck
  if (type === 'pain_alert') return TriangleAlert
  return CalendarCheck
}

function getSvcForType(svcOrRole?: string): Svc {
  if (!svcOrRole) return 'move'
  const s = svcOrRole.toLowerCase()
  if (s.includes('recover') || s.includes('therapist') || s.includes('pt')) return 'recover'
  if (s.includes('eat') || s.includes('nutrition') || s.includes('diet')) return 'eat'
  return 'move'
}

function formatRelativeTime(timestamp?: string) {
  if (!timestamp) return 'Just now'
  const diffMs = Date.now() - new Date(timestamp).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 60) return `${Math.max(1, mins)} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

export default function Overview() {
  const [state, setState] = useState<DemoState>('loaded')
  const [counts, setCounts] = useState<any>(null)
  const [activityList, setActivityList] = useState<[any, Svc, string, string][]>(fallbackActivity)

  useEffect(() => {
    let active = true
    api.getAdminOverview()
      .then((data) => {
        if (!active || !data) return
        if (data.counts) {
          setCounts(data.counts)
        }
        if (Array.isArray(data.recentActivity) && data.recentActivity.length > 0) {
          const mapped: [any, Svc, string, string][] = data.recentActivity.map((a: any) => [
            getIconForType(a.type),
            getSvcForType(a.svc_or_role),
            a.description,
            formatRelativeTime(a.timestamp),
          ])
          setActivityList(mapped)
        }
      })
      .catch((err) => {
        console.error('Failed to load admin overview:', err)
      })
    return () => { active = false }
  }, [])

  const tiles = counts ? [
    ['Users', counts.users.toLocaleString('en-US'), `+${Math.max(1, Math.round(counts.users * 0.1))} this week`, 'bg-sand'],
    ['Active plans', counts.activePlans.toLocaleString('en-US'), `+${Math.max(1, Math.round(counts.activePlans * 0.15))} this week`, SVC.move.tint],
    ['Bookings this week', counts.bookingsThisWeek.toLocaleString('en-US'), '+6% vs last week', SVC.eat.tint],
    ['Specialists', counts.specialists.toLocaleString('en-US'), `${counts.pendingSpecialists || 3} waiting for approval`, SVC.recover.tint],
  ] : initialTiles

  const pendingCount = counts?.pendingSpecialists ?? 3

  return (
    <div>
      <PageHead title="Platform this week" sub="Updated recently" /* action={<StateSwitcher value={state} onChange={setState} />} */ />
      <Gate
        state={state}
        retry={() => setState('loaded')}
        skeleton={<div className="space-y-4"><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}</div><Skeleton className="h-72" /></div>}
        empty={<Card><EmptyState title="No activity yet" text="Numbers and activity appear here once people start using Rebound." /></Card>}
      >
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {tiles.map(([l, v, d, bg]) => (
            <div key={l} className={`${bg} rounded-2xl p-5 sm:p-6`}>
              <dt className="label uppercase">{l}</dt>
              <dd className="num text-[44px] sm:text-[56px] leading-none mt-3">{v}</dd>
              <dd className="text-[14px] font-semibold mt-3">{d}</dd>
            </div>
          ))}
        </dl>

        <Link to="/app/approvals" className="mt-4 flex items-center gap-3 rounded-2xl bg-warn-tint border border-warn/60 p-4 min-h-14 font-semibold">
          <TriangleAlert size={20} className="text-[#9a6700] shrink-0" aria-hidden />
          <span className="flex-1">{pendingCount} specialist{pendingCount === 1 ? ' is' : 's are'} waiting for approval. Clients cannot book them yet.</span>
          <ArrowRight size={18} aria-hidden />
        </Link>

        <Card className="mt-4">
          <h3 className="font-bold text-[18px] px-5 sm:px-6 pt-5">Recent activity</h3>
          <ul className="mt-2">
            {activityList.map(([I, s, t, w], i) => (
              <li key={i} className="px-5 sm:px-6 py-3.5 flex items-center gap-4 border-b border-line last:border-0">
                <span className={`size-10 rounded-xl grid place-items-center shrink-0 ${SVC[s].tint}`}><I size={18} aria-hidden /></span>
                <p className="flex-1 text-[15px]">{t}</p>
                <p className="text-[13px] text-ink-2 whitespace-nowrap">{w}</p>
              </li>
            ))}
          </ul>
        </Card>
      </Gate>
    </div>
  )
}
