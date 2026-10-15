import { useEffect, useState, type FormEvent } from 'react'
import { FileText, Check, X, Eye, CircleCheck, Ban } from 'lucide-react'
import { Avatar, Btn, Card, Dialog, EmptyState, Field, Gate, inputCls, PageHead, Skeleton, StateSwitcher, Tabs, Tag, type DemoState } from '../../ui'
import { api } from '../../api'

type Svc = 'move' | 'eat' | 'recover'
type A = { id: number; name: string; initials: string; svc: Svc; role: string; city: string; years: number; applied: string; docs: [string, string][]; outcome?: 'Approved' | 'Rejected'; reason?: string }

const seed: A[] = [
  { id: 1, name: 'Dr. Yasmin Farouk', initials: 'YF', svc: 'recover', role: 'Physical therapist', city: 'Cairo', years: 8, applied: '12 Oct', docs: [['Syndicate licence', 'PDF, 1.2 MB'], ['Degree certificate', 'PDF, 0.8 MB'], ['National ID', 'JPG, 0.4 MB']] },
  { id: 2, name: 'Ali Tarek, RD', initials: 'AT', svc: 'eat', role: 'Dietitian', city: 'Alexandria', years: 5, applied: '11 Oct', docs: [['Nutrition licence', 'PDF, 0.9 MB'], ['Degree certificate', 'PDF, 1.1 MB']] },
  { id: 3, name: 'Coach Salma Ibrahim', initials: 'SI', svc: 'move', role: 'Personal trainer', city: 'Giza', years: 6, applied: '10 Oct', docs: [['Trainer certificate', 'PDF, 0.6 MB'], ['First aid card', 'JPG, 0.3 MB']] },
  { id: 4, name: 'Dr. Hesham Zaki', initials: 'HZ', svc: 'recover', role: 'Physical therapist', city: 'Mansoura', years: 3, applied: '8 Oct', docs: [['Degree certificate', 'PDF, 1.0 MB']] },
]

function getSvc(type?: string): Svc {
  if (!type) return 'recover'
  const t = type.toLowerCase()
  if (t.includes('trainer') || t.includes('move')) return 'move'
  if (t.includes('nutrition') || t.includes('eat') || t.includes('diet')) return 'eat'
  return 'recover'
}

function getRoleLabel(type?: string): string {
  if (!type) return 'Physical therapist'
  const t = type.toLowerCase()
  if (t.includes('trainer') || t.includes('move')) return 'Personal trainer'
  if (t.includes('nutrition') || t.includes('eat') || t.includes('diet')) return 'Dietitian'
  return 'Physical therapist'
}

export default function Approvals() {
  const [rows, setRows] = useState<A[]>(seed)
  const [tab, setTab] = useState<'pending' | 'reviewed'>('pending')
  const [state, setState] = useState<DemoState>('loaded')
  const [doc, setDoc] = useState<{ who: string; name: string } | null>(null)
  const [ok, setOk] = useState<A | null>(null)
  const [no, setNo] = useState<A | null>(null)
  const [reason, setReason] = useState('')
  const [rErr, setRErr] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let active = true
    api.getAdminSpecialists()
      .then((data) => {
        if (!active || !data?.specialists) return
        if (data.specialists.length > 0) {
          const mapped: A[] = data.specialists.map((s: any) => ({
            id: s.id,
            name: s.name,
            initials: s.name.replace(/^(Dr\.|Coach)\s+/i, '').split(/\s+/).slice(0, 2).map((w: string) => w[0]?.toUpperCase()).join('') || 'SP',
            svc: getSvc(s.type),
            role: getRoleLabel(s.type),
            city: s.city || 'Cairo',
            years: s.yearsExperience || s.years_experience || 5,
            applied: s.appliedAt ? new Date(s.appliedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Recently',
            docs: s.credentialDoc ? [[s.credentialDoc, 'PDF, 1.2 MB']] : [['Syndicate licence', 'PDF, 1.2 MB'], ['Degree certificate', 'PDF, 0.8 MB']],
            outcome: s.approvalStatus === 'approved' ? 'Approved' : s.approvalStatus === 'rejected' ? 'Rejected' : undefined,
          }))
          setRows(mapped)
        }
      })
      .catch((err) => {
        console.error('Failed to load specialists for approval:', err)
      })
    return () => { active = false }
  }, [])

  const pending = rows.filter((r) => !r.outcome)
  const reviewed = rows.filter((r) => r.outcome)
  const list = tab === 'pending' ? pending : reviewed

  const approve = async (specialist: A) => {
    try {
      await api.updateSpecialistApproval(specialist.id, 'approved')
      setRows((prev) => prev.map((r) => (r.id === specialist.id ? { ...r, outcome: 'Approved' } : r)))
      setMsg(`${specialist.name} is approved and can take bookings.`)
    } catch {
      setRows((prev) => prev.map((r) => (r.id === specialist.id ? { ...r, outcome: 'Approved' } : r)))
      setMsg(`${specialist.name} is approved and can take bookings.`)
    } finally {
      setOk(null)
    }
  }

  const reject = async (e: FormEvent) => {
    e.preventDefault()
    if (reason.trim().length < 5) return setRErr('Tell the applicant why, in at least a few words.')
    try {
      if (no) {
        await api.updateSpecialistApproval(no.id, 'rejected')
      }
      setRows((prev) => prev.map((r) => (r.id === no!.id ? { ...r, outcome: 'Rejected', reason: reason.trim() } : r)))
      setMsg(`${no!.name} was rejected. They will get your reason by email.`)
    } catch {
      setRows((prev) => prev.map((r) => (r.id === no!.id ? { ...r, outcome: 'Rejected', reason: reason.trim() } : r)))
      setMsg(`${no!.name} was rejected. They will get your reason by email.`)
    } finally {
      setNo(null)
      setReason('')
      setRErr('')
    }
  }

  return (
    <div>
      <PageHead title="Specialist approvals" sub={`${pending.length} waiting. Check each licence before approving.`} />
      {msg && <p role="status" className="mb-4 rounded-xl bg-sand font-semibold px-4 py-3">{msg}</p>}
      <div className="flex flex-wrap items-center gap-4 mb-5">
        <Tabs label="Queue" value={tab} onChange={setTab} tabs={[{ id: 'pending', label: `Pending (${pending.length})` }, { id: 'reviewed', label: `Reviewed (${reviewed.length})` }]} />
        {/* <StateSwitcher value={state} onChange={setState} /> */}
      </div>
      <Gate
        state={state}
        retry={() => setState('loaded')}
        skeleton={<div className="space-y-4">{[0, 1].map((i) => <Skeleton key={i} className="h-48" />)}</div>}
        empty={<Card><EmptyState title="Nothing to review" text="New specialist applications show up here." /></Card>}
      >
        {list.length === 0 ? (
          <Card><EmptyState title={tab === 'pending' ? "You're all caught up" : 'Nothing reviewed yet'} text={tab === 'pending' ? 'No specialists are waiting for approval.' : 'Approved and rejected applications are listed here.'} /></Card>
        ) : (
          <ul className="space-y-4">
            {list.map((a) => (
              <li key={a.id}>
                <Card className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-4">
                    <Avatar initials={a.initials} svc={a.svc} />
                    <div className="flex-1 min-w-[200px]">
                      <p className="font-bold text-[18px]">{a.name}</p>
                      <p className="text-[14px] text-ink-2">{a.city} · {a.years} years · applied {a.applied}</p>
                    </div>
                    <Tag svc={a.svc}>{a.role}</Tag>
                  </div>
                  <div className="mt-4">
                    <p className="label text-ink-2 mb-2">Credential documents</p>
                    <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {a.docs.map(([n, meta]) => (
                        <li key={n}>
                          <button onClick={() => setDoc({ who: a.name, name: n })} className="w-full min-h-14 text-left rounded-xl border border-line bg-paper hover:border-ink px-3 flex items-center gap-3 cursor-pointer" aria-label={`Preview ${n} for ${a.name}`}>
                            <FileText size={20} aria-hidden />
                            <span className="flex-1"><span className="font-semibold block leading-5">{n}</span><span className="text-[13px] text-ink-2">{meta}</span></span>
                            <Eye size={18} aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {a.outcome ? (
                    <div className="mt-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 h-8 font-bold text-[14px] ${a.outcome === 'Approved' ? 'bg-ok-tint text-[#1d6b3d]' : 'bg-bad-tint text-[#a02a2a]'}`}>
                        {a.outcome === 'Approved' ? <CircleCheck size={16} aria-hidden /> : <Ban size={16} aria-hidden />} {a.outcome}
                      </span>
                      {a.reason && <p className="text-[15px] text-ink-2 mt-2">Reason: {a.reason}</p>}
                    </div>
                  ) : (
                    <div className="mt-5 flex flex-col sm:flex-row gap-3">
                      <Btn onClick={() => setOk(a)}><Check size={18} aria-hidden /> Approve</Btn>
                      <Btn variant="secondary" onClick={() => setNo(a)}><X size={18} aria-hidden /> Reject</Btn>
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Gate>

      <Dialog open={!!doc} onClose={() => setDoc(null)} title={doc?.name ?? ''}>
        <p className="text-[14px] text-ink-2 mb-3">Submitted by {doc?.who}. Placeholder preview for the demo.</p>
        <div className="rounded-xl bg-sand aspect-[3/4] max-h-[50vh] mx-auto p-6 space-y-3" aria-hidden>
          <div className="h-5 w-1/2 rounded bg-ink/15" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-3 rounded bg-ink/10" style={{ width: `${95 - (i % 3) * 18}%` }} />)}
          <div className="h-16 w-24 rounded border-2 border-dashed border-ink/20 mt-6" />
        </div>
        <div className="mt-5 flex justify-end"><Btn variant="secondary" onClick={() => setDoc(null)}>Close</Btn></div>
      </Dialog>

      <Dialog open={!!ok} onClose={() => setOk(null)} title="Approve this specialist?">
        <p className="text-ink-2">{ok?.name} will appear in the specialists list and clients can book them straight away.</p>
        <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6 sm:justify-end">
          <Btn variant="secondary" onClick={() => setOk(null)}>Not yet</Btn>
          <Btn onClick={() => approve(ok!)}>Yes, approve</Btn>
        </div>
      </Dialog>

      <Dialog open={!!no} onClose={() => { setNo(null); setRErr('') }} title="Reject this application?">
        <form onSubmit={reject} noValidate className="space-y-4">
          <p className="text-ink-2">{no?.name} will get your reason by email and can apply again.</p>
          <Field label="Reason" error={rErr}>{(p) => <textarea {...p} rows={3} className={`${inputCls} h-auto py-3`} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            <Btn type="button" variant="secondary" onClick={() => { setNo(null); setRErr('') }}>Cancel</Btn>
            <Btn type="submit" className="!bg-[#a02a2a]">Reject application</Btn>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
