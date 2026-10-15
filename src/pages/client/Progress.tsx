import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Plus, TrendingDown, Dumbbell, HeartPulse } from 'lucide-react'
import { Btn, Card, Dialog, EmptyState, Field, Gate, inputCls, PageHead, PainChip, Segment, Skeleton, StateSwitcher, type DemoState } from '../../ui'

export const labels = ['28 Jul', '4 Aug', '11 Aug', '18 Aug', '25 Aug', '1 Sep', '8 Sep', '15 Sep', '22 Sep', '29 Sep', '6 Oct', '13 Oct']
const baseWeight = [76.4, 76.1, 75.9, 75.8, 75.2, 75.0, 74.6, 74.5, 74.1, 73.6, 73.2, 72.8]
const baseWorkouts = [1, 2, 2, 3, 2, 3, 3, 4, 3, 4, 4, 3]
const basePain = [6, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3, 3]

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(600)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.floor(e.contentRect.width))))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

type ChartProps = { labels: string[]; data: number[]; min: number; max: number; ticks: number[]; unit: string; desc: string }
const H = 240
const pad = { l: 40, r: 56, t: 16, b: 32 }

function Axes({ w, labels, ticks, y, n }: { w: number; labels: string[]; ticks: number[]; y: (v: number) => number; n: number }) {
  const x = (i: number) => pad.l + (n === 1 ? 0 : (i * (w - pad.l - pad.r)) / (n - 1))
  const every = w < 420 ? Math.ceil(n / 3) : w < 600 ? Math.ceil(n / 5) : Math.ceil(n / 7)
  return (
    <g fontSize="12" fill="#5B616B">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="#E6E2DA" />
          <text x={pad.l - 8} y={y(t) + 4} textAnchor="end">{t}</text>
        </g>
      ))}
      <line x1={pad.l} x2={w - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="#14161A" />
      {labels.map((l, i) => ((n - 1 - i) % every === 0 ? <text key={l} x={x(i)} y={H - 10} textAnchor="middle">{l}</text> : null))}
    </g>
  )
}

export function LineChart({ labels, data, min, max, ticks, unit, desc, color, safeBelow }: ChartProps & { color: string; safeBelow?: number }) {
  const [ref, w] = useWidth()
  const n = data.length
  const x = (i: number) => pad.l + (n === 1 ? 0 : (i * (w - pad.l - pad.r)) / (n - 1))
  const y = (v: number) => pad.t + ((max - v) / (max - min)) * (H - pad.t - pad.b)
  const pts = data.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const last = data.length - 1
  return (
    <div ref={ref} className="w-full">
      <svg width={w} height={H} role="img" aria-label={desc}>
        {safeBelow !== undefined && (
          <g>
            <rect x={pad.l} y={y(safeBelow)} width={w - pad.l - pad.r} height={y(min) - y(safeBelow)} fill="#D9F2EE" />
            <text x={pad.l + 8} y={y(safeBelow) + 16} fontSize="12" fontWeight="700" fill="#14161A">Safe zone: {safeBelow} or below</text>
          </g>
        )}
        <Axes w={w} labels={labels} ticks={ticks} y={y} n={n} />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((v, i) => (i === 0 || i === last ? <circle key={i} cx={x(i)} cy={y(v)} r="5" fill={color} stroke="#fff" strokeWidth="2" /> : null))}
        <text x={x(0)} y={y(data[0]) - 12} fontSize="13" fontWeight="700" fill="#14161A" textAnchor="start">{data[0]} {unit}</text>
        <text x={x(last) + 10} y={y(data[last]) + 4} fontSize="14" fontWeight="800" fill="#14161A">{data[last]} {unit}</text>
      </svg>
    </div>
  )
}

export function BarChart({ labels, data, target }: { labels: string[]; data: number[]; target: number }) {
  const [ref, w] = useWidth()
  const n = data.length
  const max = 6
  const y = (v: number) => pad.t + ((max - v) / max) * (H - pad.t - pad.b)
  const slot = (w - pad.l - pad.r) / n
  const bw = Math.min(36, slot * 0.6)
  const cx = (i: number) => pad.l + slot * i + slot / 2
  const every = w < 420 ? Math.ceil(n / 3) : w < 600 ? Math.ceil(n / 5) : Math.ceil(n / 7)
  return (
    <div ref={ref} className="w-full">
      <svg width={w} height={H} role="img" aria-label={`Workouts per week, target ${target}. Latest week: ${data[n - 1]}.`}>
        <g fontSize="12" fill="#5B616B">
          {[0, 2, 4, 6].map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="#E6E2DA" />
              <text x={pad.l - 8} y={y(t) + 4} textAnchor="end">{t}</text>
            </g>
          ))}
          <line x1={pad.l} x2={w - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="#14161A" />
          {labels.map((l, i) => ((n - 1 - i) % every === 0 ? <text key={l + i} x={cx(i)} y={H - 10} textAnchor="middle">{l}</text> : null))}
        </g>
        {data.map((v, i) => (
          <g key={i}>
            <rect x={cx(i) - bw / 2} y={y(v)} width={bw} height={y(0) - y(v)} rx="4" fill="#FF6A3D" />
            {(n <= 8 || i === n - 1) && <text x={cx(i)} y={y(v) - 6} textAnchor="middle" fontSize="12" fontWeight="700" fill="#14161A">{v}</text>}
          </g>
        ))}
        <line x1={pad.l} x2={w - pad.r} y1={y(target)} y2={y(target)} stroke="#14161A" strokeDasharray="5 4" strokeWidth="1.5" />
        <text x={w - pad.r + 6} y={y(target) + 4} fontSize="13" fontWeight="800" fill="#14161A">Target {target}</text>
      </svg>
    </div>
  )
}

function ChartCard({ icon, title, summary, children }: { icon: React.ReactNode; title: string; summary: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <h2 className="font-bold text-[18px] flex items-center gap-2">{icon} {title}</h2>
        <div>{summary}</div>
      </div>
      {children}
    </Card>
  )
}

import { api } from '../../api'

export default function Progress() {
  const [range, setRange] = useState('8 weeks')
  const [state, setState] = useState<DemoState>('loaded')
  const [open, setOpen] = useState(false)
  const [weight, setWeight] = useState(baseWeight)
  const [pain, setPain] = useState(basePain)
  const [workouts, setWorkouts] = useState(baseWorkouts)
  const [chartLabels, setChartLabels] = useState(labels)
  const [safeLimit, setSafeLimit] = useState(4)
  const [toast, setToast] = useState('')
  const [form, setForm] = useState({ w: '', done: 'Yes', pain: '', note: '' })
  const [err, setErr] = useState<Record<string, string>>({})

  const rangeParam = range === '4 weeks' ? '4w' : range === '8 weeks' ? '8w' : 'all'

  const loadProgress = async () => {
    try {
      const res = await api.getProgress(rangeParam)
      if (res) {
        if (res.safeLimit !== undefined) setSafeLimit(res.safeLimit)

        // Process weight logs
        if (Array.isArray(res.weight) && res.weight.length > 0) {
          const wVals = res.weight.map((x) => x.value)
          const wDates = res.weight.map((x) => {
            const d = new Date(x.date)
            return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          })
          setWeight(wVals)
          setChartLabels(wDates)
        }

        // Process pain logs
        if (Array.isArray(res.pain) && res.pain.length > 0) {
          setPain(res.pain.map((x) => x.value))
        }

        // Process workouts
        if (Array.isArray(res.workoutsPerWeek) && res.workoutsPerWeek.length > 0) {
          setWorkouts(res.workoutsPerWeek.map((x) => x.count))
        }
      }
    } catch (e) {
      console.error('Failed to load progress from API:', e)
    }
  }

  useEffect(() => {
    loadProgress()
  }, [rangeParam])

  const k = range === '4 weeks' ? 4 : range === '8 weeks' ? 8 : 12
  const sl = <T,>(a: T[]) => a.slice(Math.max(0, a.length - k))
  const L = sl(chartLabels)
  const wt = sl(weight)
  const wk = sl(workouts)
  const pn = sl(pain)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const v: Record<string, string> = {}
    const w = Number(form.w)
    if (!form.w || isNaN(w) || w < 30 || w > 250) v.w = 'Enter your weight in kg, between 30 and 250.'
    if (form.pain === '' || Number(form.pain) < 0 || Number(form.pain) > 10) v.pain = 'Choose a pain level from 0 to 10.'
    setErr(v)
    if (Object.keys(v).length) return

    try {
      await api.logProgress({
        weightKg: w,
        workoutDone: form.done === 'Yes',
        painLevel: Number(form.pain),
        note: form.note || undefined,
      })
      await loadProgress()
      setOpen(false)
      setToast(Number(form.pain) > 4 ? 'Saved. Pain is above 4/10, so Dr. Mona was told.' : 'Saved. Your charts are updated.')
      setForm({ w: '', done: 'Yes', pain: '', note: '' })
    } catch (error: any) {
      console.error('Failed to save progress entry:', error)
      alert(error.message || 'Failed to save progress entry.')
    }
  }

  const delta = wt.length >= 2 ? (wt[wt.length - 1] - wt[0]).toFixed(1) : '0.0'
  const minW = wt.length > 0 ? Math.floor(Math.min(...wt)) - 1 : 70
  const maxW = wt.length > 0 ? Math.ceil(Math.max(...wt)) + 1 : 78
  const stepW = Math.max(1, Math.round((maxW - minW) / 4))
  const ticksW = [minW, minW + stepW, minW + stepW * 2, minW + stepW * 3, maxW]

  return (
    <div>
      <PageHead title="Progress" sub="Your weight, training and knee pain, in one place." action={<Btn onClick={() => setOpen(true)}><Plus size={18} aria-hidden /> Log today</Btn>} />
      {toast && <p role="status" className="mb-4 rounded-xl bg-ok-tint font-semibold px-4 py-3">{toast}</p>}
      <div className="flex flex-wrap items-center gap-4 mb-5">
        <Segment label="Range" options={['4 weeks', '8 weeks', 'All']} value={range} onChange={setRange} />
        {/* <StateSwitcher value={state} onChange={setState} /> */}
      </div>

      <Gate
        state={state}
        retry={() => setState('loaded')}
        skeleton={<div className="grid gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[330px]" />)}</div>}
        empty={<Card><EmptyState title="No entries yet" text="Log your weight and how your knee feels. Charts appear after your first entry." action={<Btn onClick={() => setOpen(true)}>Log today</Btn>} /></Card>}
      >
        <div className="grid gap-4">
          <ChartCard
            icon={<TrendingDown size={20} aria-hidden />}
            title="Weight"
            summary={<span className="num text-[22px]">{Number(delta) > 0 ? '+' : ''}{delta} kg <span className="text-[14px] text-ink-2 font-normal font-sans">over {range === 'All' ? '12 weeks' : range}</span></span>}
          >
            <LineChart labels={L} data={wt} min={minW} max={maxW} ticks={ticksW} unit="kg" color="#14161A" desc={`Weight went from ${wt[0]} to ${wt[wt.length - 1]} kilograms.`} />
          </ChartCard>

          <div className="grid lg:grid-cols-2 gap-4">
            <ChartCard
              icon={<Dumbbell size={20} aria-hidden />}
              title="Workouts per week"
              summary={<span className="text-[14px] text-ink-2">Hit target in <span className="num text-ink">{wk.filter((x) => x >= 4).length}</span> of {wk.length} weeks</span>}
            >
              <BarChart labels={L} data={wk} target={4} />
            </ChartCard>
            <ChartCard icon={<HeartPulse size={20} aria-hidden />} title="Knee pain" summary={<PainChip n={pn[pn.length - 1]} />}>
              <LineChart labels={L} data={pn} min={0} max={10} ticks={[0, 2, 4, 6, 8, 10]} unit="/10" color="#14161A" safeBelow={safeLimit} desc={`Knee pain went from ${pn[0]} to ${pn[pn.length - 1]} out of 10.`} />
            </ChartCard>
          </div>
        </div>
      </Gate>

      <Dialog open={open} onClose={() => setOpen(false)} title="Log today" side>
        <form onSubmit={save} noValidate className="space-y-5">
          <Field label="Weight (kg)" error={err.w}>
            {(p) => <input {...p} inputMode="decimal" placeholder="72.6" className={inputCls} value={form.w} onChange={(e) => setForm({ ...form, w: e.target.value })} />}
          </Field>
          <div>
            <p className="label mb-2">Did you work out today?</p>
            <Segment label="Workout done" options={['Yes', 'No', 'Rest day']} value={form.done} onChange={(v) => setForm({ ...form, done: v })} />
          </div>
          <div>
            <p className="label mb-2" id="pain-l">Knee pain, 0 to 10</p>
            <div role="radiogroup" aria-labelledby="pain-l" className="grid grid-cols-6 gap-2">
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  type="button"
                  key={i}
                  role="radio"
                  aria-checked={form.pain === String(i)}
                  onClick={() => setForm({ ...form, pain: String(i) })}
                  className={`min-h-11 rounded-xl border font-bold cursor-pointer num ${form.pain === String(i) ? 'bg-ink text-white border-ink' : 'bg-white border-ink/25 hover:border-ink'}`}
                >
                  {i}
                </button>
              ))}
            </div>
            {err.pain && <p role="alert" className="text-[#a02a2a] font-semibold text-[14px] mt-2">{err.pain}</p>}
            {Number(form.pain) > 4 && form.pain !== '' && <p className="text-[14px] mt-2 rounded-xl bg-warn-tint p-3">Pain above 4/10: stop training the knee today. Dr. Mona will be told.</p>}
          </div>
          <Field label="Note (optional)">
            {(p) => <textarea {...p} rows={3} className={`${inputCls} h-auto py-3`} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />}
          </Field>
          <div className="flex gap-3 justify-end pt-2">
            <Btn type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Btn>
            <Btn type="submit">Save entry</Btn>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
