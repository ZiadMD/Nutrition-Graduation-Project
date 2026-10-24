import { useEffect, useState } from 'react'
import { ChevronDown, ShieldCheck, Clock, RefreshCw, Link2, Hourglass } from 'lucide-react'
import { Btn, Card, EmptyState, Gate, SafetyCallout, SVC, Skeleton, StateSwitcher, Tabs, type DemoState } from '../../ui'
import { api } from '../../api'

type Svc = 'move' | 'eat' | 'recover'
const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type Ex = { name: string; sets: string; tempo: string; rest: string; how: string; cleared: boolean }
const initialMove: Record<string, { title: string; ex: Ex[] } | null> = {
  Mon: {
    title: 'Upper push',
    ex: [
      { name: 'Dumbbell bench press', sets: '4 x 8', tempo: '3-1-1', rest: '90 s', how: 'Feet flat, shoulder blades pinched. Lower for three counts, press up without locking out.', cleared: true },
      { name: 'Seated shoulder press', sets: '3 x 10', tempo: '2-0-1', rest: '75 s', how: 'Back against the pad. Press straight up, elbows slightly in front of the body.', cleared: true },
      { name: 'Cable triceps pushdown', sets: '3 x 12', tempo: '2-0-2', rest: '60 s', how: 'Elbows pinned to your sides. Only the forearms move.', cleared: true },
    ],
  },
  Tue: null,
  Wed: {
    title: 'Lower, knee-safe',
    ex: [
      { name: 'Box squat to 60 degrees', sets: '4 x 8', tempo: '3-1-1', rest: '90 s', how: 'Sit back to the box set at knee angle 60 degrees. Touch, pause, stand. Never go deeper than the box.', cleared: true },
      { name: 'Romanian deadlift', sets: '3 x 10', tempo: '3-0-1', rest: '90 s', how: 'Soft knees, hinge at the hips, bar close to your legs. Stop when hamstrings stretch.', cleared: true },
      { name: 'Hip thrust', sets: '3 x 12', tempo: '2-1-1', rest: '75 s', how: 'Upper back on a bench. Drive through the heels and squeeze at the top.', cleared: true },
      { name: 'Walking lunges', sets: '3 x 10', tempo: 'Controlled', rest: '60 s', how: 'Short steps, front knee over the ankle. Held back until Dr. Mona clears it.', cleared: false },
    ],
  },
  Thu: {
    title: 'Upper pull',
    ex: [
      { name: 'Lat pulldown', sets: '4 x 10', tempo: '2-1-2', rest: '75 s', how: 'Pull the bar to your upper chest, elbows down and back.', cleared: true },
      { name: 'Seated cable row', sets: '3 x 10', tempo: '2-1-2', rest: '75 s', how: 'Chest tall. Squeeze the shoulder blades together on every rep.', cleared: true },
      { name: 'Dumbbell curl', sets: '3 x 12', tempo: '2-0-2', rest: '60 s', how: 'Keep elbows still. Lower slowly.', cleared: true },
    ],
  },
  Fri: null,
  Sat: {
    title: 'Lower and core',
    ex: [
      { name: 'Leg press, 0 to 60 degrees', sets: '4 x 10', tempo: '3-0-1', rest: '90 s', how: 'Set the stop pin so your knee never bends past 60 degrees. Press through the whole foot.', cleared: true },
      { name: 'Glute bridge', sets: '3 x 15', tempo: '2-1-1', rest: '60 s', how: 'Heels close to hips. Lift until shoulders, hips and knees are in a line.', cleared: true },
      { name: 'Plank', sets: '3 x 40 s', tempo: 'Hold', rest: '45 s', how: 'Elbows under shoulders, ribs down, breathe steadily.', cleared: true },
    ],
  },
  Sun: null,
}

type Meal = { name: string; what: string; kcal: number; p: number; c: number; f: number }
const defaultMealSets: Meal[][] = [
  [
    { name: 'Breakfast', what: 'Foul medames, 1 boiled egg, baladi bread half, tomato salad', kcal: 420, p: 24, c: 48, f: 14 },
    { name: 'Lunch', what: 'Grilled chicken breast 150 g, rice 120 g, molokhia', kcal: 610, p: 46, c: 62, f: 16 },
    { name: 'Snack', what: 'Greek yogurt, walnuts, 1 banana', kcal: 280, p: 18, c: 30, f: 9 },
    { name: 'Dinner', what: 'Grilled kofta 120 g, tahini salad, 1 small baladi bread', kcal: 520, p: 36, c: 38, f: 24 },
  ],
  [
    { name: 'Breakfast', what: 'Oats with milk, dates, almonds', kcal: 400, p: 20, c: 56, f: 12 },
    { name: 'Lunch', what: 'Grilled tilapia 180 g, bulgur, roasted vegetables', kcal: 580, p: 44, c: 58, f: 14 },
    { name: 'Snack', what: 'Labneh with cucumber and half baladi bread', kcal: 240, p: 14, c: 26, f: 8 },
    { name: 'Dinner', what: 'Lentil soup, tuna salad, 1 slice toast', kcal: 480, p: 34, c: 46, f: 14 },
  ],
]
const swaps: Record<string, string> = {
  Breakfast: 'Shakshuka with 2 eggs and half baladi bread',
  Lunch: 'Grilled turkey breast 150 g, freekeh, green salad',
  Snack: 'Cottage cheese with tomato and whole-wheat crackers',
  Dinner: 'Grilled chicken shish 150 g, grilled vegetables',
}

const defaultRec: Ex[] = [
  { name: 'Quad sets', sets: '3 x 15', tempo: '5 s hold', rest: '30 s', how: 'Sit with the leg straight. Tighten the thigh and press the knee down into the floor.', cleared: true },
  { name: 'Straight leg raise', sets: '3 x 12', tempo: '2-1-2', rest: '30 s', how: 'Tighten the thigh first, then lift to the height of the other knee. Lower slowly.', cleared: true },
  { name: 'Heel slides', sets: '2 x 15', tempo: 'Slow', rest: '30 s', how: 'Slide the heel toward you until a gentle stretch, not pain. Slide back out.', cleared: true },
  { name: 'Foam rolling, quads and calves', sets: '2 min each', tempo: 'Slow', rest: '-', how: 'Roll slowly. Stop on tender spots for 20 seconds. Never roll directly on the knee joint.', cleared: true },
]

function Bar({ label, v, max, color }: { label: string; v: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="w-14 text-ink-2">{label}</span>
      <span className="flex-1 h-2 rounded-full bg-line overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: color }} /></span>
      <span className="num w-10 text-right">{v} g</span>
    </div>
  )
}

function ExRow({ e, svc }: { e: Ex; svc: Svc }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="border-b border-line last:border-0">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="w-full text-left py-4 flex items-start gap-3 cursor-pointer min-h-11">
        <span className={`mt-1.5 size-3 rounded-full shrink-0 ${SVC[svc].bg}`} aria-hidden />
        <span className="flex-1 min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{e.name}</span>
            {svc !== 'eat' &&
              (e.cleared ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-recover-tint h-6 px-2.5 text-[13px] font-bold"><ShieldCheck size={13} aria-hidden /> Knee-safe</span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-warn-tint h-6 px-2.5 text-[13px] font-bold"><Hourglass size={13} aria-hidden /> Waiting for PT</span>
              ))}
          </span>
          <span className="text-[14px] text-ink-2 block mt-0.5"><span className="num text-ink">{e.sets}</span> · tempo {e.tempo} · rest {e.rest}</span>
        </span>
        <ChevronDown size={20} className={`mt-1 shrink-0 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && <p className="pb-4 pl-6 text-[15px] leading-6 text-ink-2 max-w-xl">{e.how}</p>}
    </li>
  )
}

function MealRow({ m }: { m: Meal }) {
  const [alt, setAlt] = useState(false)
  return (
    <li className="py-4 border-b border-line last:border-0 grid sm:grid-cols-[1fr_240px] gap-3 sm:gap-6">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-bold">{m.name}</span>
          <span className="num text-[15px]">{m.kcal} kcal</span>
          {alt && <span className="rounded-full bg-eat-tint h-6 px-2.5 text-[13px] font-bold inline-flex items-center">Swapped</span>}
        </div>
        <p className="text-[15px] text-ink-2 mt-0.5">{alt ? swaps[m.name] : m.what}</p>
        <button onClick={() => setAlt(!alt)} className="mt-2 min-h-11 inline-flex items-center gap-2 font-semibold underline underline-offset-4 cursor-pointer">
          <RefreshCw size={16} aria-hidden /> {alt ? 'Undo swap' : 'Swap meal'}
        </button>
      </div>
      <div className="space-y-1.5 self-center">
        <Bar label="Protein" v={m.p} max={60} color="#14161A" />
        <Bar label="Carbs" v={m.c} max={80} color="#FFC93C" />
        <Bar label="Fat" v={m.f} max={30} color="#FF6A3D" />
      </div>
    </li>
  )
}

function Band({ svc, who, action }: { svc?: Svc; who: string; action?: { label: string; to: string } }) {
  const S = (svc && SVC[svc]) || SVC.move
  return (
    <div className={`${S.tint} px-5 sm:px-6 py-4 flex flex-wrap items-center gap-x-4 gap-y-3 justify-between`}>
      <div className="flex items-center gap-3">
        <span className={`${S.bg} size-10 rounded-xl grid place-items-center`}><S.Icon size={20} aria-hidden /></span>
        <div>
          <p className="font-bold leading-5">{S.label} · {who}</p>
          <p className="text-[14px] flex items-center gap-1.5"><Clock size={14} aria-hidden /> Updated recently</p>
        </div>
      </div>
      {action && <Btn to={action.to}>{action.label}</Btn>}
    </div>
  )
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function Plan() {
  const [tab, setTab] = useState<Svc>('move')
  const [day, setDay] = useState('Wed')
  const [state, setState] = useState<DemoState>('loaded')
  const [plansData, setPlansData] = useState<any[]>([])
  const [programInfo, setProgramInfo] = useState<{ week: number; total: number }>({ week: 3, total: 8 })

  useEffect(() => {
    let active = true
    Promise.all([
      api.getPlans().catch(() => ({ plans: [] })),
      api.getProfile().catch(() => ({ profile: {} })),
    ]).then(([plansRes, profRes]) => {
      if (!active) return
      if (plansRes?.plans) {
        setPlansData(plansRes.plans)
      }
      if (profRes?.profile) {
        const p = profRes.profile
        const total = p.program_weeks || p.programWeeks || 8
        let cur = 1
        if (p.plan_start_date || p.planStartDate) {
          const start = new Date(p.plan_start_date || p.planStartDate)
          const diffDays = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24))
          cur = Math.max(1, Math.min(total, Math.floor(diffDays / 7) + 1))
        }
        setProgramInfo({ week: cur, total })
      }
    })
    return () => { active = false }
  }, [])

  // Process plans from API
  const movePlan = plansData.find((p) => p.service === 'move')
  const eatPlan = plansData.find((p) => p.service === 'eat')
  const recoverPlan = plansData.find((p) => p.service === 'recover')

  // Move plan by day
  const moveByDay: Record<string, { title: string; ex: Ex[] } | null> = { ...initialMove }
  if (movePlan && Array.isArray(movePlan.days)) {
    dayNames.forEach((dName, idx) => {
      const dayNum = idx + 1 // 1=Mon ... 7=Sun
      const dayData = movePlan.days.find((d: any) => d.dayOfWeek === dayNum)
      if (dayData && dayData.items && dayData.items.length > 0) {
        const firstTitle = dayData.items[0]?.title || ''
        const title = firstTitle.toLowerCase().includes('squat') ? 'Lower, knee-safe' : firstTitle.toLowerCase().includes('lat') ? 'Upper pull' : 'Upper push'
        moveByDay[dName] = {
          title: dayData.items[0]?.categoryTitle || title,
          ex: dayData.items.map((it: any) => ({
            name: it.title,
            sets: it.sets ? `${it.sets} x ${it.reps || 10}` : '3 x 10',
            tempo: it.tempo || '2-0-1',
            rest: it.restSec ? `${it.restSec} s` : '60 s',
            how: it.instructions || it.safetyNote || 'Follow proper form and tempo.',
            cleared: it.ptCleared !== false,
          })),
        }
      } else {
        moveByDay[dName] = null
      }
    })
  }

  // Eat plan by day
  const dayIndex = dayNames.indexOf(day)
  let meals: Meal[] = defaultMealSets[dayIndex % 2]
  let totalKcal = 1830
  let totalProtein = 124

  if (eatPlan && Array.isArray(eatPlan.days)) {
    const dayNum = dayIndex + 1
    const dayData = eatPlan.days.find((d: any) => d.dayOfWeek === dayNum)
    if (dayData && dayData.items && dayData.items.length > 0) {
      meals = dayData.items.map((it: any) => ({
        name: capitalize(it.mealType || 'Meal'),
        what: it.title,
        kcal: it.kcal || 400,
        p: it.proteinG || 25,
        c: it.carbsG || 45,
        f: it.fatG || 14,
      }))
      totalKcal = meals.reduce((sum, m) => sum + m.kcal, 0)
      totalProtein = meals.reduce((sum, m) => sum + m.p, 0)
    }
  }

  // Recover plan items
  let recExercises: Ex[] = defaultRec
  if (recoverPlan && Array.isArray(recoverPlan.days)) {
    const allRecoverItems: any[] = []
    recoverPlan.days.forEach((d: any) => {
      if (Array.isArray(d.items)) {
        d.items.forEach((it: any) => {
          if (!allRecoverItems.some((x) => x.title === it.title)) {
            allRecoverItems.push(it)
          }
        })
      }
    })
    if (allRecoverItems.length > 0) {
      recExercises = allRecoverItems.map((it: any) => ({
        name: it.title,
        sets: it.sets ? `${it.sets} x ${it.reps || 15}` : '2 x 15',
        tempo: it.tempo || 'Slow',
        rest: it.restSec ? `${it.restSec} s` : '30 s',
        how: it.instructions || 'Perform with controlled tempo and pain within limits.',
        cleared: it.ptCleared !== false,
      }))
    }
  }

  const mv = moveByDay[day]
  const meta = {
    move: [movePlan?.author?.name || 'Coach Karim Adel', 'KA'],
    eat: [eatPlan?.author?.name || 'Hana Mostafa, RD', 'HM'],
    recover: [recoverPlan?.author?.name || 'Dr. Mona Fathy, PT', 'MF'],
  }[tab]

  const coordinationSummary = movePlan?.summary || "Squats are limited to 60 degrees by Dr. Mona Fathy, so Karim swapped leg day to box squats and Hana added protein for recovery."

  return (
    <div>
      <p className="text-ink-2 mb-6">Week {programInfo.week} of {programInfo.total}. Built by three specialists who can see each other's notes.</p>

      <div className={`${SVC.recover.tint} rounded-2xl p-5 flex gap-4 items-start`}>
        <Link2 size={22} className="shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="font-bold">How your plan fits together</p>
          <p className="text-[15px] leading-6 mt-1 max-w-3xl">{coordinationSummary}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 mt-6">
        <Tabs
          label="Service"
          value={tab}
          onChange={setTab}
          tabs={(['move', 'eat', 'recover'] as Svc[]).map((s) => ({ id: s, label: SVC[s].label, icon: <span className={`size-2.5 rounded-full ${SVC[s].bg}`} aria-hidden /> }))}
        />
        {/* <StateSwitcher value={state} onChange={setState} /> */}
      </div>

      <Gate
        state={state}
        retry={() => setState('loaded')}
        skeleton={<div className="mt-5 space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>}
        empty={<Card className="mt-5"><EmptyState title="Nothing in this plan yet" text="Your specialist is still building it. You will get a notification when it is ready." action={<Btn to="/app/specialists/karim">Message your specialist</Btn>} /></Card>}
      >
        {tab !== 'recover' && (
          <div role="radiogroup" aria-label="Day" className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-2 max-w-xl">
            {dayNames.map((d) => (
              <button
                key={d}
                role="radio"
                aria-checked={day === d}
                onClick={() => setDay(d)}
                className={`min-h-12 rounded-xl border font-bold text-[14px] sm:text-[15px] cursor-pointer ${day === d ? 'bg-ink text-white border-ink' : 'bg-white border-line hover:border-ink/40'}`}
              >
                {d}
              </button>
            ))}
          </div>
        )}

        {tab === 'move' && (
          <Card className="mt-4 overflow-hidden">
            <Band svc="move" who={meta[0]} action={mv ? { label: 'Start workout', to: '/session' } : undefined} />
            <div className="p-5 sm:p-6">
            {mv ? (
              <>
                <h2 className="h-display text-[22px]" style={{ letterSpacing: '-0.02em' }}>{day}: {mv.title}</h2>
                <ul className="mt-2">{mv.ex.map((e) => <ExRow key={e.name} e={e} svc="move" />)}</ul>
              </>
            ) : (
              <EmptyState title="Rest day" text="Walk 6,000 steps, drink water and sleep well. Your next session is on the next training day." />
            )}
            </div>
          </Card>
        )}

        {tab === 'eat' && (
          <Card className="mt-4 overflow-hidden">
            <Band svc="eat" who={meta[0]} />
            <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="h-display text-[22px]" style={{ letterSpacing: '-0.02em' }}>{day}: {totalKcal.toLocaleString('en-US')} kcal</h2>
              <p className="text-[14px] text-ink-2"><span className="num text-ink">{totalProtein} g</span> protein · target 130 g</p>
            </div>
            <ul className="mt-2">{meals.map((m) => <MealRow key={m.name} m={m} />)}</ul>
            </div>
          </Card>
        )}

        {tab === 'recover' && (
          <div className="mt-5 space-y-4">
            <SafetyCallout title="Stop if pain goes above 4/10">Pain above 4/10, sharp pain or swelling means stop and message Dr. Mona. Do these exercises on the days between training.</SafetyCallout>
            <Card className="overflow-hidden">
              <Band svc="recover" who={meta[0]} action={{ label: 'Start routine', to: '/session' }} />
              <div className="p-5 sm:p-6">
              <h2 className="h-display text-[22px]" style={{ letterSpacing: '-0.02em' }}>Daily knee routine</h2>
              <p className="text-[14px] text-ink-2 mt-1">About 15 minutes. Both legs, every day.</p>
              <ul className="mt-2">{recExercises.map((e) => <ExRow key={e.name} e={e} svc="recover" />)}</ul>
              </div>
            </Card>
          </div>
        )}
      </Gate>
    </div>
  )
}
