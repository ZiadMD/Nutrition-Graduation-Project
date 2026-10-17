import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, ArrowRight, Check, MessageSquare, Video, Info } from 'lucide-react'
import { Avatar, Btn, Card, EmptyState, SVC, Tag } from '../../ui'
import { specialists as staticSpecialists, packagesFor, days, slotsFor, t12, egp, sessionPrice, nextSlots, type Svc } from '../../data'
import { api } from '../../api'

const steps = ['Package', 'Date and time', 'Review']

function getInitials(name = '') {
  return name
    .replace(/^(Dr\.|Coach)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

export default function Booking() {
  const { id } = useParams()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const [spData, setSpData] = useState<any>(null)
  const [serverSlots, setServerSlots] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([
      api.getSpecialist(id),
      api.getSpecialistSlots(id),
    ])
      .then(([sRes, slotsRes]) => {
        setSpData(sRes.specialist)
        setServerSlots(slotsRes.slots || [])
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [id])

  const s = spData
    ? {
        id: spData.id,
        name: spData.name,
        initials: getInitials(spData.name),
        svc: (spData.service || (spData.type === 'physical_therapist' ? 'recover' : spData.type === 'nutritionist' ? 'eat' : 'move')) as any,
        role: spData.type === 'physical_therapist' ? 'Physical therapist' : spData.type === 'nutritionist' ? 'Dietitian' : 'Personal trainer',
        rate: spData.rateEgp || 450,
      }
    : staticSpecialists.find((x) => x.id === id)

  const resched = sp.get('reschedule') === '1'
  const reschedBookingId = sp.get('bookingId') || sp.get('booking_id') || undefined
  const pre = nextSlots(id ?? '', 4)[Number(sp.get('slot') ?? 0)]
  const [step, setStep] = useState(resched ? 1 : 0)
  const [pkg, setPkg] = useState('single')
  const [type, setType] = useState('Video call')
  const [di, setDi] = useState(pre?.di ?? 0)
  const [time, setTime] = useState<string | null>(pre?.t ?? null)
  const [err, setErr] = useState('')

  if (!s && !loading)
    return (
      <Card>
        <EmptyState title="We couldn't find that specialist" text="Go back and choose someone from the list." action={<Btn to="/app/specialists">Back to specialists</Btn>} />
      </Card>
    )

  if (!s) {
    return <Card className="p-8 text-center"><p className="text-ink-2">Loading booking details...</p></Card>
  }

  const pk = packagesFor(s.rate).find((p) => p.id === pkg)!
  const total = sessionPrice(pk.price, type)
  const slots = slotsFor(s.id, di)
  const when = time ? `${days[di].d} ${days[di].n} Oct, ${t12(time)}` : null

  const next = () => {
    if (step === 1 && !time) return setErr('Choose a time to continue.')
    setErr('')
    setStep(step + 1)
  }

  // Find slot ID from server slots if available
  const matchingSlot = serverSlots.find((sl) => {
    if (!time) return false
    const d = new Date(sl.startsAt || sl.starts_at)
    const h = d.getHours()
    const m = d.getMinutes()
    const hmStr = `${h}:${m < 10 ? '0' : ''}${m}`
    return hmStr === time || sl.startsAt?.includes(time)
  }) || serverSlots[0]

  const confirm = () =>
    nav('/app/bookings/checkout', {
      state: {
        spId: s.id,
        pkg: pk.name,
        n: pk.n,
        type,
        when,
        total,
        resched,
        bookingId: reschedBookingId,
        slotId: matchingSlot?.id,
      },
    })

  return (
    <div>
      <button onClick={() => (step > 0 && !(resched && step === 1) ? setStep(step - 1) : nav(-1))} className="inline-flex items-center gap-2 min-h-11 font-semibold mb-2 cursor-pointer">
        <ArrowLeft size={18} aria-hidden /> Back
      </button>
      <div className="mb-8" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step + 1} aria-label={`Step ${step + 1} of 3`}>
        <p className="font-semibold text-[15px] mb-3">
          Step {step + 1} of 3: {steps[step]}
        </p>
        <div className="flex gap-2 max-w-xl">
          {steps.map((t, i) => (
            <span key={t} className={`h-2 flex-1 rounded-full ${i <= step ? 'bg-ink' : 'bg-line'}`} />
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
        <div>
          {step === 0 && (
            <div>
              <h2 className="h-display text-[28px]" style={{ letterSpacing: '-0.025em' }}>Choose a package</h2>
              <div role="radiogroup" aria-label="Package" className="grid gap-3 mt-5">
                {packagesFor(s.rate).map((p) => (
                  <button
                    key={p.id}
                    role="radio"
                    aria-checked={pkg === p.id}
                    onClick={() => setPkg(p.id)}
                    className={`text-left rounded-2xl p-5 bg-white border-2 flex gap-4 items-start cursor-pointer ${pkg === p.id ? 'border-ink' : 'border-line hover:border-ink/40'}`}
                  >
                    <span className={`mt-1 size-6 rounded-full border-2 border-ink grid place-items-center shrink-0 ${pkg === p.id ? 'bg-ink text-white' : ''}`}>{pkg === p.id && <Check size={14} strokeWidth={3} />}</span>
                    <span className="flex-1">
                      <span className="font-bold block">{p.name}</span>
                      <span className="text-[15px] text-ink-2 block">{p.note}</span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="num text-[22px] block">{p.price.toLocaleString('en-US')}</span>
                      <span className="text-[13px] text-ink-2">EGP</span>
                    </span>
                  </button>
                ))}
              </div>
              <h3 className="font-bold mt-8 mb-3">Session type</h3>
              <div role="radiogroup" aria-label="Session type" className="grid sm:grid-cols-2 gap-3">
                {[
                  ['Video call', Video, '30 minutes, live with your specialist.'],
                  ['Chat check-in', MessageSquare, 'Send updates in the app. Reply within 4 hours. 40% cheaper.'],
                ].map(([t, I, d]) => {
                  const Icon = I as typeof Video
                  return (
                    <button
                      key={t as string}
                      role="radio"
                      aria-checked={type === t}
                      onClick={() => setType(t as string)}
                      className={`text-left rounded-2xl p-5 bg-white border-2 cursor-pointer ${type === t ? 'border-ink' : 'border-line hover:border-ink/40'}`}
                    >
                      <span className="flex items-center gap-2 font-bold"><Icon size={20} aria-hidden /> {t as string}{type === t && <Check size={18} className="ml-auto" aria-hidden />}</span>
                      <span className="text-[15px] text-ink-2 block mt-1">{d as string}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="h-display text-[28px]" style={{ letterSpacing: '-0.025em' }}>{resched ? 'Pick a new time' : 'Pick a date and time'}</h2>
              <p className="text-ink-2 mt-1 flex items-center gap-2"><Info size={16} aria-hidden /> All times are Cairo time.</p>
              <div role="radiogroup" aria-label="Date" className="mt-5 grid grid-cols-7 gap-2">
                {days.map((d, i) => {
                  const none = slotsFor(s.id, i).length === 0
                  return (
                    <button
                      key={d.n}
                      role="radio"
                      aria-checked={di === i}
                      disabled={none}
                      aria-label={`${d.d} ${d.n} October${none ? ', no free times' : ''}`}
                      onClick={() => { setDi(i); setTime(null) }}
                      className={`min-h-[72px] rounded-xl border-2 flex flex-col items-center justify-center cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 disabled:line-through ${di === i ? 'bg-ink text-white border-ink' : 'bg-white border-line hover:border-ink/40'}`}
                    >
                      <span className="text-[13px] font-semibold">{d.d}</span>
                      <span className="num text-[22px]">{d.n}</span>
                    </button>
                  )
                })}
              </div>
              <h3 className="font-bold mt-8 mb-3">Free times on {days[di].d} {days[di].n} Oct</h3>
              {slots.length ? (
                <div role="radiogroup" aria-label="Time" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {slots.map((t) => (
                    <button
                      key={t}
                      role="radio"
                      aria-checked={time === t}
                      onClick={() => { setTime(t); setErr('') }}
                      className={`min-h-12 rounded-xl border font-bold cursor-pointer ${time === t ? 'bg-ink text-white border-ink' : 'bg-white border-ink/25 hover:border-ink'}`}
                    >
                      {t12(t)}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-ink-2">No free times that day. Try another date.</p>
              )}
              {err && <p role="alert" className="text-[#a02a2a] font-semibold text-[14px] mt-3">{err}</p>}
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="h-display text-[28px]" style={{ letterSpacing: '-0.025em' }}>Review and confirm</h2>
              <Card className="mt-5 divide-y divide-line">
                {[
                  ['Specialist', s.name],
                  ['Package', `${pk.name} (${pk.n} ${pk.n === 1 ? 'session' : 'sessions'})`],
                  ['Type', type],
                  ['First session', `${when}, Cairo time`],
                ].map(([k, v]) => (
                  <div key={k} className="p-4 flex justify-between gap-4">
                    <span className="text-ink-2">{k}</span>
                    <span className="font-bold text-right">{v}</span>
                  </div>
                ))}
              </Card>
              <p className="text-[15px] text-ink-2 mt-4 max-w-lg">Free cancellation up to 12 hours before. After that the session is charged. Remaining sessions in a package can be booked from My bookings.</p>
            </div>
          )}

          <div className="flex justify-between mt-10 gap-3">
            {step > 0 && !(resched && step === 1) ? (
              <Btn variant="secondary" onClick={() => setStep(step - 1)}><ArrowLeft size={18} aria-hidden /> Back</Btn>
            ) : <span />}
            {step < 2 ? (
              <Btn onClick={next}>Continue <ArrowRight size={18} aria-hidden /></Btn>
            ) : (
              <Btn onClick={confirm}>{resched ? 'Confirm new time' : 'Confirm and pay'} <ArrowRight size={18} aria-hidden /></Btn>
            )}
          </div>
        </div>

        <aside className="lg:sticky lg:top-24">
          <Card className="p-6">
            <p className="label text-ink-2 uppercase">Your booking</p>
            <div className="flex items-center gap-3 mt-3">
              <Avatar initials={s.initials} svc={s.svc} />
              <div>
                <p className="font-bold leading-5">{s.name}</p>
                <Tag svc={s.svc}>{s.role}</Tag>
              </div>
            </div>
            <dl className="mt-5 space-y-3 text-[15px]">
              <div className="flex justify-between gap-3"><dt className="text-ink-2">Package</dt><dd className="font-semibold text-right">{pk.name}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-2">Type</dt><dd className="font-semibold">{type}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-2">When</dt><dd className="font-semibold text-right">{when ?? 'Not chosen yet'}</dd></div>
            </dl>
            <div className={`mt-5 rounded-xl p-4 flex items-baseline justify-between ${(SVC[(s.svc as Svc) || 'move'] || SVC.move).tint}`}>
              <span className="font-semibold">Total</span>
              <span className="num text-[28px]">{egp(total)}</span>
            </div>
          </Card>
          <Link to="/app/specialists" className="inline-flex min-h-11 items-center mt-3 text-[15px] font-semibold underline underline-offset-4">Choose someone else</Link>
        </aside>
      </div>
    </div>
  )
}
