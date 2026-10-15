import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Ban } from 'lucide-react'
import { Btn, Card, Dialog, Gate, PageHead, Skeleton, StateSwitcher, SVC, type DemoState } from '../../ui'
import { api } from '../../api'

type Kind = 'rehab' | 'karim' | 'hana'
type Booked = { kind: Kind; who: string; id?: string; topic: string }
const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const startDate = 13 // Mon 13 Oct
const slots = Array.from({ length: 20 }, (_, i) => 10 * 60 + i * 30)
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const t12 = (m: number) => { const h = Math.floor(m / 60); return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` }

const hours: Record<number, [number, number] | null> = { 0: [14 * 60, 20 * 60], 1: [14 * 60, 20 * 60], 2: [14 * 60, 20 * 60], 3: [14 * 60, 20 * 60], 4: null, 5: [10 * 60, 14 * 60], 6: null }
const initialBooked: Record<string, Booked> = {
  '0-15:00': { kind: 'rehab', who: 'Dina Fouad', id: 'dina', topic: 'Core and back, week 4' },
  '0-17:30': { kind: 'rehab', who: 'Tarek Samir', id: 'tarek', topic: 'Neck and back' },
  '1-16:00': { kind: 'rehab', who: 'Sara Hassan', id: 'sara', topic: 'Knee review' },
  '1-17:00': { kind: 'rehab', who: 'Omar Khaled', id: 'omar', topic: 'Lower back check-in' },
  '1-18:30': { kind: 'rehab', who: 'Laila Mostafa', id: 'laila', topic: 'Shoulder program, week 3' },
  '2-14:30': { kind: 'rehab', who: 'Youssef Nabil', id: 'youssef', topic: 'ACL phase 3 review' },
  '2-16:00': { kind: 'karim', who: 'Coach Karim Adel', topic: 'Plan sync: leg day for Sara and Youssef' },
  '2-19:00': { kind: 'rehab', who: 'Mariam Adel', id: 'mariam', topic: 'Knee osteoarthritis' },
  '3-14:00': { kind: 'hana', who: 'Hana Mostafa', topic: 'Nutrition sync: recovery protein' },
  '3-18:30': { kind: 'rehab', who: 'Sara Hassan', id: 'sara', topic: 'Knee review, week 3' },
  '3-19:30': { kind: 'rehab', who: 'Nour El-Din', id: 'nour', topic: 'Shoulder strength' },
  '5-10:30': { kind: 'rehab', who: 'Mariam Adel', id: 'mariam', topic: 'Walking program' },
  '5-12:00': { kind: 'karim', who: 'Coach Karim Adel', topic: 'Plan sync: Saturday sessions' },
}
const kindSvc: Record<Kind, keyof typeof SVC> = { rehab: 'recover', karim: 'move', hana: 'eat' }
const kindLabel: Record<Kind, string> = { rehab: 'Client session', karim: 'Sync with trainer', hana: 'Sync with dietitian' }

export default function Schedule() {
  const [week, setWeek] = useState(0)
  const [day, setDay] = useState(1)
  const [blocked, setBlocked] = useState<Record<string, boolean>>({})
  const [pick, setPick] = useState<{ key: string; d: number; m: number } | null>(null)
  const [state, setState] = useState<DemoState>('loaded')
  const [msg, setMsg] = useState('')
  const [bookedMap, setBookedMap] = useState<Record<string, Booked>>(initialBooked)

  useEffect(() => {
    let active = true
    api.getSpecialistSchedule()
      .then((res) => {
        if (!active || !res?.slots) return
        const map: Record<string, Booked> = { ...initialBooked }
        res.slots.forEach((s: any) => {
          if (s.booking && s.booking.client) {
            const dt = new Date(s.startsAt)
            const jsDow = dt.getDay()
            const monIdx = jsDow === 0 ? 6 : jsDow - 1
            const h = dt.getHours()
            const m = dt.getMinutes()
            const timeKey = `${monIdx}-${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
            map[timeKey] = {
              kind: 'rehab',
              who: s.booking.client.name,
              id: String(s.booking.client.id),
              topic: s.booking.sessionType || 'Client session',
            }
          }
        })
        setBookedMap(map)
      })
      .catch((err) => {
        console.error('Failed to load schedule from API:', err)
      })
    return () => { active = false }
  }, [week])

  const key = (d: number, m: number) => `${d}-${hm(m)}`
  const bk = (d: number, m: number) => (week === 0 ? bookedMap[key(d, m)] : undefined)
  const isOpen = (d: number, m: number) => {
    const h = hours[d]
    return !!h && m >= h[0] && m < h[1]
  }
  const wkKey = (d: number, m: number) => `${week}:${key(d, m)}`
  const dateOf = (d: number) => startDate + week * 7 + d
  const dateLabel = (d: number) => { const n = dateOf(d); return n > 31 ? `${n - 31} Nov` : `${n} Oct` }

  const count = (k: Kind) => Object.values(week === 0 ? bookedMap : {}).filter((b) => b.kind === k).length
  const openCount = slots.reduce((a, m) => a + dayNames.reduce((b, _, d) => b + (isOpen(d, m) && !bk(d, m) && !blocked[wkKey(d, m)] ? 1 : 0), 0), 0)

  const cell = (d: number, m: number) => {
    const b = bk(d, m)
    const closed = !isOpen(d, m) && !b
    const blk = blocked[wkKey(d, m)]
    const base = 'w-full min-h-11 h-full rounded-lg text-left px-2 text-[13px] leading-4 font-semibold flex flex-col justify-center cursor-pointer'
    if (b) {
      const s = kindSvc[b.kind]
      return (
        <button onClick={() => setPick({ key: wkKey(d, m), d, m })} className={`${base} ${SVC[s].tint} border-l-4`} style={{ borderLeftColor: SVC[s].hex }} aria-label={`${dayNames[d]} ${t12(m)}: ${kindLabel[b.kind]} with ${b.who}`}>
          <span className="truncate">{b.who}</span>
        </button>
      )
    }
    if (closed) return <div className="w-full h-full min-h-11 rounded-lg bg-sand/50" aria-hidden />
    if (blk) return <button onClick={() => setPick({ key: wkKey(d, m), d, m })} className={`${base} bg-sand text-ink-2 items-start gap-0.5`} aria-label={`${dayNames[d]} ${t12(m)}: blocked`}><span className="inline-flex items-center gap-1"><Ban size={12} aria-hidden /> Blocked</span></button>
    return <button onClick={() => setPick({ key: wkKey(d, m), d, m })} className={`${base} border border-dashed border-ink/30 text-ink-2 hover:border-ink hover:bg-white`} aria-label={`${dayNames[d]} ${t12(m)}: open slot`}>Open</button>
  }

  const pb = pick ? bk(pick.d, pick.m) : undefined

  return (
    <div>
      <PageHead title="Schedule" sub={`Week of ${dateLabel(0)}. ${openCount} open slots.`} />
      {msg && <p role="status" className="mb-4 rounded-xl bg-sand font-semibold px-4 py-3">{msg}</p>}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="inline-flex items-center gap-1">
          <button aria-label="Previous week" onClick={() => setWeek(week - 1)} className="size-11 rounded-xl border border-line bg-white grid place-items-center cursor-pointer"><ChevronLeft size={20} /></button>
          <button onClick={() => setWeek(0)} className="min-h-11 px-4 rounded-xl border border-line bg-white font-bold cursor-pointer">This week</button>
          <button aria-label="Next week" onClick={() => setWeek(week + 1)} className="size-11 rounded-xl border border-line bg-white grid place-items-center cursor-pointer"><ChevronRight size={20} /></button>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-[14px]" aria-label="Legend">
          {(['rehab', 'karim', 'hana'] as Kind[]).map((k) => (
            <li key={k} className="inline-flex items-center gap-2"><span className={`size-4 rounded ${SVC[kindSvc[k]].bg}`} aria-hidden /> {kindLabel[k]} ({count(k)})</li>
          ))}
          <li className="inline-flex items-center gap-2"><span className="size-4 rounded border border-dashed border-ink/50" aria-hidden /> Open</li>
        </ul>
        {/* <span className="ml-auto"><StateSwitcher value={state} onChange={setState} /></span> */}
      </div>

      <Gate
        state={state}
        retry={() => setState('loaded')}
        skeleton={<Skeleton className="h-[520px]" />}
        empty={<Card className="p-8 text-center"><p className="h-display text-[22px]">No availability set</p><p className="text-ink-2 mt-2">Set your weekly hours so clients can book you.</p><Btn className="mt-5">Set hours</Btn></Card>}
      >
        <Card className="hidden md:block overflow-x-auto">
          <div className="min-w-[860px] grid grid-cols-[64px_repeat(7,1fr)]">
            <div className="border-b border-line" />
            {dayNames.map((n, d) => (
              <div key={n} className={`px-2 py-3 text-center border-b border-line ${week === 0 && d === 1 ? 'bg-ink text-white' : ''}`}>
                <p className="text-[13px] font-semibold">{n}</p>
                <p className="num text-[20px]">{dateOf(d) > 31 ? dateOf(d) - 31 : dateOf(d)}</p>
              </div>
            ))}
            {slots.map((m) => (
              <div key={m} className="contents">
                <div className="text-[13px] text-ink-2 num px-2 pt-1 text-right border-r border-line h-12">{m % 60 === 0 ? t12(m) : ''}</div>
                {dayNames.map((_, d) => (
                  <div key={d} className={`p-0.5 h-12 ${m % 60 === 0 ? 'border-t border-line' : ''}`}>{cell(d, m)}</div>
                ))}
              </div>
            ))}
          </div>
        </Card>

        <div className="md:hidden">
          <div role="radiogroup" aria-label="Day" className="grid grid-cols-7 gap-1.5 mb-4">
            {dayNames.map((n, d) => (
              <button key={n} role="radio" aria-checked={day === d} onClick={() => setDay(d)} className={`min-h-14 rounded-xl border flex flex-col items-center justify-center cursor-pointer ${day === d ? 'bg-ink text-white border-ink' : 'bg-white border-line'}`}>
                <span className="text-[13px] font-semibold">{n}</span>
                <span className="num text-[18px]">{dateOf(d) > 31 ? dateOf(d) - 31 : dateOf(d)}</span>
              </button>
            ))}
          </div>
          <Card className="p-3">
            <p className="font-bold px-1 pb-2">{dayNames[day]} {dateLabel(day)}</p>
            {hours[day] === null ? (
              <p className="text-ink-2 px-1 py-6 text-center">You are off this day.</p>
            ) : (
              <ul className="space-y-1.5">
                {slots.filter((m) => isOpen(day, m) || bk(day, m)).map((m) => (
                  <li key={m} className="grid grid-cols-[72px_1fr] gap-2 items-stretch">
                    <span className="num text-[13px] text-ink-2 pt-3">{t12(m)}</span>
                    <div className="min-h-12">{cell(day, m)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </Gate>

      <Dialog open={!!pick} onClose={() => setPick(null)} title={pb ? kindLabel[pb.kind] : blocked[pick?.key ?? ''] ? 'Blocked time' : 'Open slot'}>
        {pick && (
          <>
            <p className="font-semibold">{dayNames[pick.d]} {dateLabel(pick.d)}, {t12(pick.m)} to {t12(pick.m + 30)}</p>
            {pb ? (
              <>
                <p className="mt-2">{pb.who}</p>
                <p className="text-ink-2">{pb.topic}</p>
                <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6 sm:justify-end">
                  <Btn variant="secondary" onClick={() => setPick(null)}>Close</Btn>
                  {pb.id ? <Btn to={`/app/clients/${pb.id}`}>Open client</Btn> : null}
                </div>
              </>
            ) : blocked[pick.key] ? (
              <>
                <p className="text-ink-2 mt-2">Clients cannot book this time.</p>
                <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6 sm:justify-end">
                  <Btn variant="secondary" onClick={() => setPick(null)}>Keep blocked</Btn>
                  <Btn onClick={() => { setBlocked({ ...blocked, [pick.key]: false }); setMsg('Slot opened. Clients can book it now.'); setPick(null) }}>Open this slot</Btn>
                </div>
              </>
            ) : (
              <>
                <p className="text-ink-2 mt-2">Nobody has booked this time. Block it if you are not available. Existing bookings are not affected.</p>
                <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6 sm:justify-end">
                  <Btn variant="secondary" onClick={() => setPick(null)}>Leave open</Btn>
                  <Btn onClick={() => { setBlocked({ ...blocked, [pick.key]: true }); setMsg('Slot blocked. Clients cannot book it.'); setPick(null) }}>Block this time</Btn>
                </div>
              </>
            )}
          </>
        )}
      </Dialog>
    </div>
  )
}
