import { useState, type FormEvent } from 'react'
import { useLocation } from 'react-router'
import { CreditCard, Smartphone, Store, Landmark, Lock, CircleCheck, Check, Building2 } from 'lucide-react'
import { Avatar, Btn, Card, Field, inputCls, SVC, Tag } from '../../ui'
import { specialists, egp } from '../../data'

const methods = [
  ['Card', CreditCard, 'Visa or Mastercard'],
  ['Fawry', Store, 'Pay with a code at any outlet'],
  ['Vodafone Cash', Smartphone, 'Approve on your phone'],
  ['InstaPay', Landmark, 'Pay from your bank app'],
] as const

import { api, getStoredUser } from '../../api'

export default function Checkout() {
  const loc = useLocation()
  const o = (loc.state as { spId: string; pkg: string; n: number; type: string; when: string; total: number; resched?: boolean; bookingId?: string | number; slotId?: number } | null) ?? {
    spId: 'mona', pkg: 'Single session', n: 1, type: 'Video call', when: 'Thu 16 Oct, 6:30 PM', total: 450,
  }
  const s = specialists.find((x) => x.id === o.spId) || specialists[0]
  const user = getStoredUser()
  const isSponsored = Boolean(user?.organization?.sponsored || user?.organizationId)
  const orgName = user?.organization?.name || 'your organization'

  const [m, setM] = useState<(typeof methods)[number][0]>('Card')
  const [f, setF] = useState(() => ({ name: user?.name || '', num: '', exp: '', cvc: '', phone: '', handle: '' }))
  const [err, setErr] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [paid, setPaid] = useState(false)
  const [reference, setReference] = useState('RB-48213')
  const fee = 0
  const total = isSponsored ? 0 : o.total + fee

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const v: Record<string, string> = {}
    if (!isSponsored) {
      if (m === 'Card') {
        if (f.name.trim().length < 2) v.name = 'Enter the name on the card.'
        if (f.num.replace(/\s/g, '').length !== 16) v.num = 'Card numbers have 16 digits.'
        if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(f.exp)) v.exp = 'Use the format MM/YY.'
        if (!/^\d{3}$/.test(f.cvc)) v.cvc = 'The code has 3 digits.'
      }
      if (m === 'Vodafone Cash' && !/^01[0-9]{9}$/.test(f.phone)) v.phone = 'Enter an Egyptian mobile number, like 01012345678.'
      if (m === 'InstaPay' && !/^\S+@\S+$/.test(f.handle)) v.handle = 'Enter your InstaPay address, like sara@instapay.'
      setErr(v)
      if (Object.keys(v).length) return
    }

    setSubmitting(true)
    try {
      if (o.slotId) {
        if (o.resched && o.bookingId) {
          const res = await api.rescheduleBooking(o.bookingId, o.slotId)
          setReference(`RB-${res?.booking?.id || o.bookingId}`)
        } else {
          const res = await api.createBooking({
            specialistId: o.spId as any,
            slotId: o.slotId,
            sessionType: o.type,
            notes: '',
          })
          setReference(`RB-${res?.booking?.id || '48213'}`)
        }
      } else {
        if (isSponsored) {
          setReference(`ORG-${user?.organization?.inviteCode || 'SPONSORED'}-${Date.now().toString().slice(-4)}`)
        } else {
          const methodMap: Record<string, 'card' | 'fawry' | 'vodafone_cash' | 'instapay'> = {
            'Card': 'card',
            'Fawry': 'fawry',
            'Vodafone Cash': 'vodafone_cash',
            'InstaPay': 'instapay',
          }
          const res = await api.checkout('Starter', methodMap[m] || 'card')
          setReference(res?.subscription?.reference || res?.subscription?.paymentReference || 'RB-48213')
        }
      }
      setPaid(true)
    } catch (error: any) {
      if (error?.code === 'ALREADY_SPONSORED') {
        // Defensively handle ALREADY_SPONSORED
        setReference(`ORG-${user?.organization?.inviteCode || 'SPONSORED'}`)
        setPaid(true)
      } else {
        console.error('Checkout error:', error)
        setErr({ general: error.message || 'Payment processing failed. Please try again.' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (paid)
    return (
      <div className="max-w-xl mx-auto text-center py-6">
        <span className="mx-auto size-20 rounded-full bg-ok-tint grid place-items-center">
          <CircleCheck size={44} className="text-ok" aria-hidden />
        </span>
        <h2 className="h-display text-[32px] mt-6" style={{ letterSpacing: '-0.025em' }}>{o.resched ? 'Session moved' : "You're booked"}</h2>
        <p className="text-ink-2 mt-2">{s.name} will see your plan before the session.</p>
        <Card className="mt-8 p-6 text-left divide-y divide-line">
          {[
            ['When', `${o.when}, Cairo time`],
            ['Type', o.type],
            ['Package', isSponsored ? `${o.pkg} (Sponsored)` : o.pkg],
            ['Paid', isSponsored ? '0 EGP (Sponsored)' : egp(total)],
            ['Reference', reference],
          ].map(([k, v]) => (
            <div key={k} className="py-3 first:pt-0 last:pb-0 flex justify-between gap-4"><span className="text-ink-2">{k}</span><span className="font-bold text-right">{v}</span></div>
          ))}
        </Card>
        <div className="flex flex-col sm:flex-row gap-3 mt-6 justify-center">
          <Btn variant="secondary">Add to calendar</Btn>
          <Btn to="/app/bookings">View my bookings</Btn>
        </div>
        <p className="text-[13px] text-ink-2 mt-6">
          {isSponsored ? `Session fully covered by ${orgName}.` : 'Demo only: no real payment was made.'}
        </p>
      </div>
    )

  return (
    <form onSubmit={submit} noValidate className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="h-display text-[28px]" style={{ letterSpacing: '-0.025em' }}>
            {isSponsored ? 'Confirm session' : 'Payment'}
          </h2>
          {isSponsored ? (
            <span className="rounded-full bg-sand px-3 h-7 inline-flex items-center gap-1.5 label text-ink">
              <Building2 size={13} className="text-move" /> Sponsored by {orgName}
            </span>
          ) : (
            <span className="rounded-full bg-eat-tint px-3 h-7 inline-flex items-center label">
              Demo only: no real payment
            </span>
          )}
        </div>

        {isSponsored ? (
          <Card className="p-6 mt-6 bg-sand/30 border-line">
            <div className="flex items-start gap-4">
              <span className="size-11 rounded-xl bg-white border border-line grid place-items-center shrink-0">
                <Building2 size={22} className="text-move" />
              </span>
              <div>
                <h3 className="font-bold text-[18px] text-ink">Sponsored by {orgName}</h3>
                <p className="text-ink-2 text-[14px] mt-1 leading-relaxed">
                  Your membership and specialist sessions are fully sponsored by your organization. You do not need to provide a credit card or payment method.
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <>
            <div role="radiogroup" aria-label="Payment method" className="grid sm:grid-cols-2 gap-3 mt-6">
              {methods.map(([n, I, d]) => (
                <button
                  type="button"
                  key={n}
                  role="radio"
                  aria-checked={m === n}
                  onClick={() => { setM(n); setErr({}) }}
                  className={`text-left rounded-2xl p-4 bg-white border-2 flex gap-3 items-center min-h-[72px] cursor-pointer ${m === n ? 'border-ink' : 'border-line hover:border-ink/40'}`}
                >
                  <span className="size-11 rounded-xl bg-sand grid place-items-center shrink-0"><I size={22} aria-hidden /></span>
                  <span className="flex-1"><span className="font-bold block">{n}</span><span className="text-[14px] text-ink-2">{d}</span></span>
                  {m === n && <Check size={20} aria-hidden />}
                </button>
              ))}
            </div>

            <Card className="p-6 mt-6">
              {m === 'Card' && (
                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2">
                    <Field label="Name on card" error={err.name}>{(p) => <input {...p} autoComplete="cc-name" className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Card number" helper="Any 16 digits works in this demo." error={err.num}>
                      {(p) => <input {...p} inputMode="numeric" autoComplete="cc-number" placeholder="1234 5678 9012 3456" className={inputCls} value={f.num} onChange={(e) => setF({ ...f, num: e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim() })} />}
                    </Field>
                  </div>
                  <Field label="Expiry" helper="MM/YY" error={err.exp}>
                    {(p) => <input {...p} inputMode="numeric" autoComplete="cc-exp" placeholder="08/28" className={inputCls} value={f.exp} onChange={(e) => { let v = e.target.value.replace(/[^\d]/g, '').slice(0, 4); if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2); setF({ ...f, exp: v }) }} />}
                  </Field>
                  <Field label="Security code" helper="3 digits on the back" error={err.cvc}>
                    {(p) => <input {...p} inputMode="numeric" autoComplete="cc-csc" className={inputCls} value={f.cvc} onChange={(e) => setF({ ...f, cvc: e.target.value.replace(/\D/g, '').slice(0, 3) })} />}
                  </Field>
                </div>
              )}
              {m === 'Fawry' && <p className="leading-7">We will show a Fawry code after you confirm. Pay it at any Fawry outlet or in the Fawry app within 24 hours. Your session is held until then.</p>}
              {m === 'Vodafone Cash' && (
                <Field label="Vodafone Cash number" helper="We send an approval request to this number." error={err.phone}>
                  {(p) => <input {...p} inputMode="tel" placeholder="01012345678" className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })} />}
                </Field>
              )}
              {m === 'InstaPay' && (
                <Field label="InstaPay address" helper="The address linked to your bank account." error={err.handle}>
                  {(p) => <input {...p} placeholder="sara@instapay" className={inputCls} value={f.handle} onChange={(e) => setF({ ...f, handle: e.target.value })} />}
                </Field>
              )}
            </Card>
          </>
        )}
      </div>

      <aside className="lg:sticky lg:top-24">
        <Card className="p-6">
          <p className="label text-ink-2 uppercase">Order summary</p>
          <div className="flex items-center gap-3 mt-3">
            <Avatar initials={s.initials} svc={s.svc} />
            <div><p className="font-bold leading-5">{s.name}</p><Tag svc={s.svc}>{s.role}</Tag></div>
          </div>
          <dl className="mt-5 space-y-3 text-[15px]">
            <div className="flex justify-between gap-3"><dt className="text-ink-2">{o.pkg}</dt><dd className="font-semibold">{isSponsored ? 'Sponsored' : egp(o.total)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-2">{o.type}</dt><dd className="font-semibold text-right">{o.when}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-2">Service fee</dt><dd className="font-semibold">Free</dd></div>
          </dl>
          <div className={`mt-5 rounded-xl p-4 flex items-baseline justify-between ${(SVC[s?.svc as Svc] || SVC.move).tint}`}>
            <span className="font-semibold">Total</span>
            <span className="num text-[28px]">{isSponsored ? '0 EGP' : egp(total)}</span>
          </div>
          {err.general && <p role="alert" className="text-[#a02a2a] font-semibold text-[14px] mt-3">{err.general}</p>}
          <Btn type="submit" className="w-full mt-5" disabled={submitting}>
            <Lock size={18} aria-hidden /> {submitting ? 'Processing...' : isSponsored ? 'Confirm booking' : `Pay ${egp(total)}`}
          </Btn>
          <p className="text-[13px] text-ink-2 text-center mt-3">
            {isSponsored ? `Sponsored by ${orgName}` : 'Demo only: no real payment'}
          </p>
        </Card>
      </aside>
    </form>
  )
}
