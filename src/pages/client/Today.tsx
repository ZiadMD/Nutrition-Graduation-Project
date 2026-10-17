import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Check, Flame, Play, Video, CalendarClock, Dumbbell, Quote } from 'lucide-react'
import { Avatar, Btn, Card, Dialog, PainChip, Skeleton, SVC } from '../../ui'
import type { Svc } from '../../data'
import { api, getStoredUser } from '../../api'

const fallbackPlan: { id: string; svc: Svc; time: string; title: string; meta: string; action: string }[] = [
  { id: 'a', svc: 'eat', time: '2:00 PM', title: 'Lunch: grilled chicken with rice', meta: '620 kcal · 42 g protein', action: 'Swap meal' },
  { id: 'b', svc: 'move', time: '6:00 PM', title: 'Lower body, knee-safe', meta: '45 min · 5 exercises', action: 'Preview' },
  { id: 'c', svc: 'recover', time: '9:00 PM', title: 'Knee mobility', meta: '10 min · 3 exercises', action: 'Watch demo' },
]

function formatTime12(t: string) {
  if (!t) return '12:00 PM'
  if (t.includes('AM') || t.includes('PM')) return t
  const [h, m] = t.split(':').map(Number)
  if (isNaN(h)) return t
  const hr = h % 12 || 12
  const ampm = h < 12 ? 'AM' : 'PM'
  return `${hr}:${String(m || 0).padStart(2, '0')} ${ampm}`
}

function getActionLabel(svc: Svc) {
  if (svc === 'eat') return 'Swap meal'
  if (svc === 'move') return 'Preview'
  return 'Watch demo'
}

function getGreeting(name: string) {
  const hour = new Date().getHours()
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  const firstName = name.trim().split(' ')[0] || 'there'
  return `Good ${part}, ${firstName}`
}

export default function ClientToday() {
  const nav = useNavigate()
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState(() => getStoredUser()?.name || '')
  const [dashboard, setDashboard] = useState<any>(null)
  const [done, setDone] = useState<string[]>([])
  const [pain, setPain] = useState(3)
  const [draft, setDraft] = useState(3)
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    let active = true
    api.getTodayDashboard()
      .then((data) => {
        if (!active) return
        setDashboard(data)
        if (data.user?.name) setUserName(data.user.name)
        if (data.summary?.latestPain !== undefined && data.summary.latestPain !== null) {
          setPain(data.summary.latestPain)
          setDraft(data.summary.latestPain)
        }
        if (Array.isArray(data.plan)) {
          const completedIds = data.plan
            .filter((p: any) => p.status === 'done')
            .map((p: any) => String(p.itemId))
          setDone(completedIds)
        }
      })
      .catch((err) => {
        console.error('Failed to load today dashboard:', err)
        // Keep fallback values
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [])

  const toggleItem = async (itemId: string | number) => {
    const sId = String(itemId)
    const isDone = done.includes(sId)
    const nextStatus = isDone ? 'pending' : 'done'

    // Optimistic update
    setDone((prev) => (isDone ? prev.filter((x) => x !== sId) : [...prev, sId]))

    const numId = Number(itemId)
    if (!isNaN(numId)) {
      try {
        const todayStr = dashboard?.date || new Date().toISOString().slice(0, 10)
        await api.setCompletion(numId, todayStr, nextStatus)
      } catch (err) {
        console.error('Failed to update completion status:', err)
        // Revert on failure
        setDone((prev) => (isDone ? [...prev, sId] : prev.filter((x) => x !== sId)))
      }
    }
  }

  const saveCheckin = async () => {
    try {
      const todayStr = dashboard?.date || new Date().toISOString().slice(0, 10)
      await api.logProgress({ painLevel: draft, date: todayStr })
      setPain(draft)
      setOpen(false)
      setToast('Check-in saved. Dr. Mona can see it.')
      setTimeout(() => setToast(''), 4000)
    } catch (err: any) {
      console.error('Failed to log checkin:', err)
      alert(err.message || 'Failed to save check-in')
    }
  }

  const workoutsThisWeek = dashboard?.summary?.workoutsThisWeek ?? 3
  const workoutsTarget = dashboard?.summary?.workoutsTarget ?? 4
  const streak = dashboard?.summary?.streakDays ?? 5
  const currentWeek = dashboard?.weekOfProgram?.current ?? 3
  const totalWeeks = dashboard?.weekOfProgram?.total ?? 8

  // Format today's plan items
  const items = (dashboard?.plan && dashboard.plan.length > 0)
    ? dashboard.plan.map((p: any) => ({
        id: String(p.itemId),
        svc: (p.service as Svc) || 'move',
        time: formatTime12(p.time),
        title: p.title,
        meta: p.meta,
        action: getActionLabel((p.service as Svc) || 'move'),
      }))
    : fallbackPlan

  // Next session info
  const nextSession = dashboard?.nextSession
  const sessionName = nextSession?.specialist?.name || 'Dr. Mona Fathy, PT'
  const sessionSvc: Svc = nextSession?.specialist?.type === 'trainer' ? 'move' : nextSession?.specialist?.type === 'nutritionist' ? 'eat' : 'recover'
  const sessionInitials = sessionName.replace(/^(Dr\.|Coach)\s+/i, '').split(/\s+/).slice(0, 2).map((w: string) => w[0]?.toUpperCase()).join('') || 'MF'
  const sessionWhen = nextSession?.startsAt
    ? `${new Date(nextSession.startsAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · ${new Date(nextSession.startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} · Video`
    : 'Thu 16 Oct · 6:30 PM · Video'
  const rescheduleUrl = nextSession
    ? `/app/specialists/${nextSession.specialist.id}/book?reschedule=${nextSession.bookingId}`
    : '/app/specialists/mona/book?reschedule=1'

  // Latest specialist note
  const latestNote = dashboard?.latestNote
  const noteFrom = latestNote?.from || 'Dr. Mona'
  const noteBody = latestNote?.body || "Good news on the knee. Keep box squats at 60 degrees one more week, then we test a little deeper on Thursday. If today's pain climbs above 4, skip the squats and do the mobility only."
  const noteDate = latestNote?.createdAt
    ? `Sent ${new Date(latestNote.createdAt).toLocaleDateString('en-GB', { weekday: 'long', hour: 'numeric', minute: '2-digit', hour12: true })}`
    : 'Sent Monday, 9:12 PM'

  return (
    <div>
      <div className="mb-6">
        <h2 className="h-display text-[28px] lg:text-[32px]" style={{ letterSpacing: '-0.025em' }}>
          {getGreeting(userName)}
        </h2>
        <p className="text-ink-2 mt-1">Tuesday, 14 October · Week {currentWeek} of {totalWeeks} of your knee plan</p>
      </div>

      {toast && (
        <p role="status" className="mb-4 rounded-xl bg-ok-tint text-[#1d6b3d] font-semibold px-4 py-3 flex gap-2 items-center">
          <Check size={18} aria-hidden /> {toast}
        </p>
      )}

      <Card className="grid md:grid-cols-[1.4fr_1fr_1.2fr] md:divide-x divide-y md:divide-y-0 divide-line">
        <div className="p-6">
          <p className="label text-ink-2 uppercase">Workouts this week</p>
          <p className="num text-[56px] leading-none mt-3">
            {workoutsThisWeek}<span className="text-ink-2 text-[32px]">/{workoutsTarget}</span>
          </p>
          <div className="flex gap-2 mt-4" aria-hidden>
            {Array.from({ length: workoutsTarget }).map((_, i) => (
              <span key={i} className={`h-2 flex-1 rounded-full ${i < workoutsThisWeek ? 'bg-move' : 'bg-line'}`} />
            ))}
          </div>
          <p className="text-[14px] text-ink-2 mt-3">
            {workoutsTarget - workoutsThisWeek > 0
              ? `${workoutsTarget - workoutsThisWeek} left this week.`
              : 'Weekly target reached!'}
          </p>
        </div>
        <div className="p-6">
          <p className="label text-ink-2 uppercase">Day streak</p>
          <p className="num text-[56px] leading-none mt-3">{streak}</p>
          <p className="text-[14px] text-ink-2 flex items-center gap-2 mt-4">
            <Flame size={16} aria-hidden /> Best: {Math.max(streak, 9)} days
          </p>
        </div>
        <div className="p-6 bg-recover-tint md:rounded-r-2xl">
          <p className="label uppercase">Knee pain today</p>
          <div className="mt-3"><PainChip n={pain} /></div>
          <p className="text-[14px] mt-3">Stop and message Dr. Mona above 4/10.</p>
          <Btn variant="secondary" className="mt-3 w-full md:w-auto" onClick={() => { setDraft(pain); setOpen(true) }}>
            Log check-in
          </Btn>
        </div>
      </Card>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6 mt-8 items-start">
        <section aria-labelledby="plan-h">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h3 id="plan-h" className="h-display text-[24px]" style={{ letterSpacing: '-0.02em' }}>
              Today's plan
            </h3>
            <Btn onClick={() => nav('/session')} className="w-full sm:w-auto">
              <Play size={18} aria-hidden /> Start today's workout
            </Btn>
          </div>
          <ul className="space-y-3">
            {loading
              ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)
              : items.map((p: any) => {
                  const s = SVC[p.svc as Svc] || SVC.move
                  const d = done.includes(p.id)
                  return (
                    <li key={p.id} className={`${s.tint} rounded-2xl p-4 sm:p-5`}>
                      <div className="flex items-center gap-4">
                        <span className={`${s.bg} size-12 rounded-xl grid place-items-center shrink-0`}>
                          <s.Icon size={22} aria-hidden />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="label uppercase">
                            {s.label} · <span className="num text-[14px]">{p.time}</span>
                          </p>
                          <p className={`font-bold leading-6 ${d ? 'line-through decoration-2' : ''}`}>{p.title}</p>
                          <p className="text-[14px] text-ink-2">{p.meta}</p>
                        </div>
                        <button
                          aria-pressed={d}
                          aria-label={`Mark "${p.title}" as done`}
                          onClick={() => toggleItem(p.id)}
                          className={`size-11 rounded-full border-2 border-ink grid place-items-center cursor-pointer shrink-0 ${d ? 'bg-ink text-white' : 'bg-white'}`}
                        >
                          {d && <Check size={20} strokeWidth={3} />}
                        </button>
                      </div>
                      <div className="mt-2 pl-16">
                        <button className="min-h-11 font-semibold text-[15px] underline underline-offset-4 cursor-pointer">{p.action}</button>
                      </div>
                    </li>
                  )
                })}
          </ul>
        </section>

        <aside className="space-y-4">
          <Card className="p-6">
            <p className="label text-ink-2 uppercase">Next session</p>
            <div className="flex items-center gap-4 mt-3">
              <Avatar initials={sessionInitials} svc={sessionSvc} />
              <div>
                <p className="font-bold">{sessionName}</p>
                <p className="text-[14px] text-ink-2">{sessionWhen}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <Btn variant="secondary" onClick={() => nav('/session')} className="px-3">
                <Video size={18} aria-hidden /> Join
              </Btn>
              <Btn variant="secondary" onClick={() => nav(rescheduleUrl)} className="px-3">
                <CalendarClock size={18} aria-hidden /> Reschedule
              </Btn>
            </div>
          </Card>
          <Card className="p-6 bg-recover-tint border-recover/40">
            <p className="label uppercase flex items-center gap-2">
              <Quote size={16} aria-hidden /> Note from {noteFrom}
            </p>
            <p className="mt-3 leading-6">
              {noteBody}
            </p>
            <p className="text-[14px] text-ink-2 mt-3">{noteDate}</p>
          </Card>
          <Card className="p-5 flex gap-4 items-center">
            <span className="size-12 rounded-xl bg-move-tint grid place-items-center shrink-0">
              <Dumbbell size={22} aria-hidden />
            </span>
            <p className="text-[15px]">Next workout after today: <b>Upper pull</b>, Thursday.</p>
          </Card>
        </aside>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title="How does your knee feel?">
        <label htmlFor="ci" className="text-[14px] font-semibold">Pain right now</label>
        <input id="ci" type="range" min={0} max={10} value={draft} onChange={(e) => setDraft(+e.target.value)} className="w-full h-11 accent-ink mt-1" aria-valuetext={`${draft} out of 10`} />
        <div className="flex justify-between text-[13px] text-ink-2 font-medium mb-3">
          <span>0 No pain</span>
          <span>10 Worst pain</span>
        </div>
        <PainChip n={draft} />
        {draft > 4 && <p className="mt-3 text-[14px] font-semibold">Above 4: do mobility only today and message Dr. Mona.</p>}
        <div className="flex justify-end gap-3 mt-6">
          <Btn variant="secondary" onClick={() => setOpen(false)}>Cancel</Btn>
          <Btn onClick={saveCheckin}>Save check-in</Btn>
        </div>
      </Dialog>
    </div>
  )
}
