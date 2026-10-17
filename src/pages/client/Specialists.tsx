import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Search, Globe, Check, Users, CalendarCheck } from 'lucide-react'
import { Avatar, Btn, Card, EmptyState, Gate, inputCls, Skeleton, StateSwitcher, SVC, Tabs, Tag, type DemoState } from '../../ui'
import { specialists as staticSpecialists, nextSlots, slotLabel, slotsFor, days, t12, packagesFor, egp, type Svc } from '../../data'
import { api } from '../../api'

type Filter = 'all' | Svc
const dot = { move: 'bg-move', eat: 'bg-eat', recover: 'bg-recover' }

function formatNextSlot(startsAtStr?: string) {
  if (!startsAtStr) return 'No open slots'
  const d = new Date(startsAtStr)
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const dow = dayNames[d.getDay()]
  const date = d.getDate()
  const mon = months[d.getMonth()]
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ap = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${dow} ${date} ${mon}, ${h12}:${m} ${ap}`
}

function getInitials(name = '') {
  return name
    .replace(/^(Dr\.|Coach)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

function parseFocusTags(raw: any): string[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    return raw.split(',').map((x) => x.trim()).filter(Boolean)
  }
  return ['Rehab', 'Strength']
}

export function SpecialistsList() {
  const [f, setF] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('soonest')
  const [state, setState] = useState<DemoState>('loading')
  const [list, setList] = useState<any[]>([])

  const load = () => {
    setState('loading')
    api.getSpecialists({ type: f, q, sort })
      .then((res) => {
        const mapped = (res.specialists || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          initials: getInitials(s.name),
          svc: s.service || (s.type === 'physical_therapist' ? 'recover' : s.type === 'nutritionist' ? 'eat' : 'move'),
          role: s.type === 'physical_therapist' ? 'Physical therapist' : s.type === 'nutritionist' ? 'Dietitian' : 'Personal trainer',
          cred: s.credentials,
          langs: Array.isArray(s.languages) ? s.languages.join(', ') : s.languages,
          years: s.yearsExperience || s.years_experience || 0,
          rate: s.rateEgp || s.rate_egp || 400,
          nextSlot: formatNextSlot(s.nextAvailable),
        }))
        setList(mapped)
        setState('loaded')
      })
      .catch((err) => {
        console.error('Failed to load specialists:', err)
        setState('error')
      })
  }

  useEffect(() => {
    load()
  }, [f, q, sort])

  const pills: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'move', label: 'Trainers' },
    { id: 'eat', label: 'Dietitians' },
    { id: 'recover', label: 'Physical therapists' },
  ]

  const clear = () => { setF('all'); setQ('') }
  const empty = (
    <Card>
      <EmptyState title="No specialists match" text="Try a different name or a wider filter. Everyone here is licensed or certified." action={<Btn variant="secondary" onClick={clear}>Clear filters</Btn>} />
    </Card>
  )

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Filter by type">
        {pills.map((p) => (
          <button
            key={p.id}
            aria-pressed={f === p.id}
            onClick={() => setF(p.id)}
            className={`min-h-11 px-4 rounded-full border font-semibold inline-flex items-center gap-2 cursor-pointer ${f === p.id ? 'bg-ink text-white border-ink' : 'bg-white border-ink/25 hover:border-ink'}`}
          >
            {p.id !== 'all' && <span className={`size-3 rounded-full ${dot[p.id]} ${f === p.id ? 'ring-2 ring-white' : ''}`} aria-hidden />}
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-2" aria-hidden />
          <input aria-label="Search specialists" placeholder="Search by name or focus" className={`${inputCls} pl-11`} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-[14px] text-ink-2 whitespace-nowrap">
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value)} className={`${inputCls} w-auto text-ink font-semibold`}>
            <option value="soonest">Next available</option>
            <option value="low">Price: low to high</option>
            <option value="high">Price: high to low</option>
            <option value="exp">Most experience</option>
          </select>
        </label>
        {/* <StateSwitcher value={state} onChange={setState} /> */}
      </div>
      <Gate
        state={state}
        retry={load}
        skeleton={<div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div>}
        empty={empty}
      >
        {list.length === 0 ? (
          empty
        ) : (
          <>
            <p className="text-[14px] text-ink-2 mb-3" aria-live="polite">{list.length} specialists</p>
            <Card>
              <ul className="divide-y divide-line">
                {list.map((s) => (
                  <li key={s.id} className="p-5 sm:p-6 grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] gap-x-8 gap-y-4 items-center">
                    <div className="flex gap-4 items-start min-w-0">
                      <Avatar initials={s.initials} svc={s.svc} size={64} />
                      <div className="min-w-0">
                        <Tag svc={s.svc}>{s.role}</Tag>
                        <p className="h-display text-[20px] mt-2 leading-6" style={{ letterSpacing: '-0.02em' }}>{s.name}</p>
                        <p className="text-ink-2 text-[15px] mt-1">{s.cred}</p>
                        <p className="text-[14px] mt-1 flex items-center gap-2 text-ink-2"><Globe size={16} aria-hidden /> {s.langs} · {s.years} years</p>
                      </div>
                    </div>
                    <div className={`rounded-xl p-3 ${(SVC[(s.svc as Svc) || 'move'] || SVC.move).tint}`}>
                      <p className="text-[13px] font-semibold">Next available</p>
                      <p className="font-bold">{s.nextSlot}</p>
                    </div>
                    <div className="flex md:flex-col items-center md:items-end justify-between gap-3">
                      <p className="whitespace-nowrap"><span className="num text-[24px]">{s.rate} EGP</span> <span className="text-[14px] text-ink-2">per session</span></p>
                      <Btn variant="secondary" className="whitespace-nowrap" to={`/app/specialists/${s.id}`}>View profile</Btn>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </Gate>
    </div>
  )
}

export function SpecialistProfile() {
  const { id } = useParams()
  const nav = useNavigate()
  const [tab, setTab] = useState<'about' | 'avail' | 'pack'>('about')
  const [slot, setSlot] = useState(0)
  const [spData, setSpData] = useState<any>(null)
  const [slotsList, setSlotsList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      api.getSpecialist(id),
      api.getSpecialistSlots(id),
    ])
      .then(([spRes, slotsRes]) => {
        setSpData(spRes.specialist)
        setSlotsList(slotsRes.slots || [])
      })
      .catch((err) => {
        console.error('Failed to load profile:', err)
      })
      .finally(() => setLoading(false))
  }, [id])

  const s = spData
    ? {
        id: spData.id,
        name: spData.name,
        initials: getInitials(spData.name),
        svc: (spData.service || (spData.type === 'physical_therapist' ? 'recover' : spData.type === 'nutritionist' ? 'eat' : 'move')) as Svc,
        role: spData.type === 'physical_therapist' ? 'Physical therapist' : spData.type === 'nutritionist' ? 'Dietitian' : 'Personal trainer',
        cred: spData.credentials,
        langs: Array.isArray(spData.languages) ? spData.languages.join(', ') : spData.languages,
        sessions: spData.sessionsCompleted || spData.sessions_completed || 120,
        rate: spData.rateEgp || spData.rate_egp || 450,
        about: spData.bio || 'Experienced specialist working in Cairo and Alexandria.',
        focus: parseFocusTags(spData.focusTags ?? spData.focus_tags ?? spData.focus),
        how: 'I review your weekly progress reports and coordinate plan adjustments with your care team.',
        packages: spData.packages && spData.packages.length > 0 ? spData.packages : packagesFor(spData.rateEgp || 450),
      }
    : staticSpecialists.find((x) => x.id === id)

  if (!s && !loading)
    return (
      <Card>
        <EmptyState title="We couldn't find that specialist" text="The profile may have moved." action={<Btn to="/app/specialists">Back to specialists</Btn>} />
      </Card>
    )

  if (!s) {
    return <Card className="p-8"><Skeleton className="h-64" /></Card>
  }

  const formattedSlots = slotsList.length > 0
    ? slotsList.slice(0, 4).map((sl: any) => ({
        id: sl.id,
        label: formatNextSlot(sl.startsAt || sl.starts_at),
      }))
    : nextSlots(s.id, 4).map((x) => ({ id: 0, label: slotLabel(x) }))

  const others = staticSpecialists.filter((x) => x.id !== String(s.id) && ['karim', 'hana', 'mona'].includes(String(x.id))).filter((x) => x.svc !== s.svc)
  const book = () => nav(`/app/specialists/${s.id}/book?slot=${slot}`)

  const panel = (
    <Card className="p-6">
      <p className="h-display text-[20px]" style={{ letterSpacing: '-0.02em' }}>Next free slots</p>
      <p className="text-[14px] text-ink-2">Cairo time</p>
      <div role="radiogroup" aria-label="Next free slots" className="grid gap-2 mt-4">
        {formattedSlots.map((x, i) => (
          <button
            key={i}
            role="radio"
            aria-checked={slot === i}
            onClick={() => setSlot(i)}
            className={`min-h-12 px-4 rounded-xl border text-left font-semibold flex items-center justify-between cursor-pointer ${slot === i ? 'border-ink border-2 bg-white' : 'border-ink/25 hover:border-ink'}`}
          >
            {x.label}
            {slot === i && <Check size={18} aria-hidden />}
          </button>
        ))}
      </div>
      <div className="flex items-baseline justify-between mt-5">
        <span className="num text-[28px]">{s.rate} EGP</span>
        <span className="text-[14px] text-ink-2">per session</span>
      </div>
      <Btn onClick={book} className="w-full mt-4">Book a session</Btn>
    </Card>
  )

  return (
    <div className="pb-28 lg:pb-0">
      <Link to="/app/specialists" className="inline-flex items-center gap-2 min-h-11 font-semibold mb-2">
        <ArrowLeft size={18} aria-hidden /> All specialists
      </Link>
      <div className="grid lg:grid-cols-[1fr_340px] gap-8 items-start">
        <div>
          <div className={`rounded-[28px] p-6 sm:p-8 ${(SVC[(s.svc as Svc) || 'move'] || SVC.move).tint} flex flex-col sm:flex-row gap-6 sm:items-center`}>
            <Avatar initials={s.initials} svc={s.svc} size={96} />
            <div>
              <Tag svc={s.svc}>{s.role}</Tag>
              <h2 className="h-display text-[28px] lg:text-[32px] mt-2" style={{ letterSpacing: '-0.025em' }}>{s.name}</h2>
              <p className="mt-1">{s.cred}</p>
              <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-[15px] font-medium">
                <span className="flex items-center gap-2"><Globe size={16} aria-hidden /> {s.langs}</span>
                <span className="flex items-center gap-2"><CalendarCheck size={16} aria-hidden /> <span className="num">{s.sessions.toLocaleString('en-US')}</span> sessions completed</span>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Tabs label="Profile sections" value={tab} onChange={setTab} tabs={[{ id: 'about', label: 'About' }, { id: 'avail', label: 'Availability' }, { id: 'pack', label: 'Packages' }]} />
          </div>

          <div className="mt-6" role="tabpanel">
            {tab === 'about' && (
              <div className="space-y-6">
                <Card className="p-6">
                  <p className="leading-7 max-w-2xl">{s.about}</p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {parseFocusTags(s.focus).map((f: string) => (
                      <span key={f} className="rounded-full bg-paper border border-line px-3 h-8 inline-flex items-center text-[14px] font-semibold">{f}</span>
                    ))}
                  </div>
                </Card>
                <Card className="p-6">
                  <h3 className="h-display text-[22px] flex items-center gap-2" style={{ letterSpacing: '-0.02em' }}>
                    <Users size={22} aria-hidden /> How I work with your other specialists
                  </h3>
                  <p className="leading-7 mt-3 max-w-2xl">{s.how}</p>
                  <div className="flex flex-wrap gap-3 mt-4">
                    {others.map((o) => (
                      <span key={o.id} className="inline-flex items-center gap-2 rounded-xl bg-paper border border-line p-2 pr-4 text-[14px] font-semibold">
                        <Avatar initials={o.initials} svc={o.svc} size={32} /> {o.name}
                      </span>
                    ))}
                  </div>
                </Card>
              </div>
            )}
            {tab === 'avail' && (
              <Card className="p-6">
                <p className="text-[14px] text-ink-2 mb-4">Open slots this week, Cairo time.</p>
                <div className="grid gap-3">
                  {days.map((d, di) => {
                    const sl = slotsFor(s.id, di)
                    return (
                      <div key={d.n} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3 border-b border-line last:border-0">
                        <p className="w-24 font-bold shrink-0">{d.d} <span className="num">{d.n}</span></p>
                        {sl.length ? (
                          <div className="flex flex-wrap gap-2">
                            {sl.map((t) => (
                              <span key={t} className={`rounded-lg px-3 h-9 inline-flex items-center text-[14px] font-semibold ${SVC[s.svc].tint}`}>{t12(t)}</span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-ink-2 text-[15px]">No free times</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}
            {tab === 'pack' && (
              <div className="grid md:grid-cols-3 gap-4">
                {packagesFor(s.rate).map((p) => (
                  <Card key={p.id} className="p-6 flex flex-col">
                    <p className="font-bold">{p.name}</p>
                    <p className="mt-3"><span className="num text-[32px]">{p.price.toLocaleString('en-US')}</span> <span className="font-semibold">EGP</span></p>
                    <p className="text-[14px] text-ink-2">{p.n} {p.n === 1 ? 'session' : 'sessions'} · <span className="num">{Math.round(p.price / p.n)}</span> EGP each</p>
                    <p className="text-[15px] mt-3 text-ink-2">{p.note}</p>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="hidden lg:block sticky top-24">{panel}</div>
      </div>

      <div className="lg:hidden fixed bottom-16 inset-x-0 z-20 bg-white border-t border-line px-5 py-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-ink-2">Next free slot</p>
          <p className="font-bold truncate">{formattedSlots[0]?.label || 'No slots available'}</p>
        </div>
        <Btn onClick={() => nav(`/app/specialists/${s.id}/book?slot=0`)}>Book a session</Btn>
      </div>
    </div>
  )
}
