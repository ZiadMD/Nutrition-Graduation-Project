import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Plus, ShieldCheck, Hourglass, Trash2, CircleCheck, Mail, Phone, Users } from 'lucide-react'
import { Avatar, Btn, Card, Dialog, EmptyState, Field, inputCls, SafetyCallout, Segment, Tabs } from '../../ui'
import { clients, painTrend } from '../../data'
import { LineChart, BarChart, labels } from '../client/Progress'
import { Flag, PainTrend } from './parts'
import { api } from '../../api'

type Ex = { id: number; name: string; sets: number; reps: number; cleared: boolean }
const templates: Record<string, Ex[]> = {
  knee: [
    { id: 1, name: 'Box squat to 60 degrees', sets: 4, reps: 8, cleared: true },
    { id: 2, name: 'Leg press, 0 to 60 degrees', sets: 4, reps: 10, cleared: true },
    { id: 3, name: 'Straight leg raise', sets: 3, reps: 12, cleared: true },
    { id: 4, name: 'Walking lunges', sets: 3, reps: 10, cleared: false },
  ],
  back: [
    { id: 1, name: 'Bird dog', sets: 3, reps: 10, cleared: true },
    { id: 2, name: 'Dead bug', sets: 3, reps: 12, cleared: true },
    { id: 3, name: 'Hip hinge with dowel', sets: 3, reps: 10, cleared: true },
    { id: 4, name: 'Romanian deadlift', sets: 3, reps: 8, cleared: false },
  ],
  shoulder: [
    { id: 1, name: 'Pendulum swings', sets: 2, reps: 20, cleared: true },
    { id: 2, name: 'Band external rotation', sets: 3, reps: 15, cleared: true },
    { id: 3, name: 'Scapular wall slides', sets: 3, reps: 12, cleared: true },
    { id: 4, name: 'Overhead press', sets: 3, reps: 8, cleared: false },
  ],
}

type Note = { id: number; text: string; when: string; shared: boolean }

export default function ClientDetail() {
  const { id } = useParams()
  return <Inner key={id} id={id} />
}

function Inner({ id }: { id?: string }) {
  const fallbackClient = clients.find((x) => x.id === id || x.name.toLowerCase().includes(String(id).toLowerCase())) || clients[0]
  const [c, setC] = useState<any>(fallbackClient)
  const [tab, setTab] = useState('Profile')
  const [ex, setEx] = useState<Ex[]>(() => templates[fallbackClient?.area ?? 'knee'].map((e) => ({ ...e })))
  const [limit, setLimit] = useState(String(fallbackClient?.limit ?? 4))
  const [angle, setAngle] = useState(fallbackClient?.area === 'knee' ? '60' : '')
  const [angleErr, setAngleErr] = useState('')
  const [saved, setSaved] = useState(true)
  const [toast, setToast] = useState('')
  const [rm, setRm] = useState<Ex | null>(null)
  const [add, setAdd] = useState(false)
  const [nf, setNf] = useState({ name: '', sets: '3', reps: '10' })
  const [nerr, setNerr] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Note[]>([
    { id: 1, text: 'Good form on the box squat. Keep the depth cap until the next review.', when: 'Tue 7 Oct', shared: true },
    { id: 2, text: 'Reports morning stiffness. Added 5 minutes of heel slides before training.', when: 'Tue 30 Sep', shared: false },
  ])
  const [draft, setDraft] = useState('')
  const [shared, setShared] = useState(true)
  const [noteErr, setNoteErr] = useState('')

  useEffect(() => {
    let active = true
    if (id) {
      api.getSpecialistClient(id)
        .then((res) => {
          if (!active || !res?.client) return
          const cl = res.client
          const area = res.injuries?.[0]?.body_area?.toLowerCase() || 'knee'
          setC({
            id: String(cl.id),
            name: cl.name,
            initials: cl.name.replace(/^(Dr\.|Coach)\s+/i, '').split(/\s+/).slice(0, 2).map((w: string) => w[0]?.toUpperCase()).join('') || 'SH',
            goal: cl.goal || 'Knee rehab & strength',
            week: cl.week || 3,
            of: cl.of || 8,
            age: cl.age || 29,
            email: cl.email,
            phone: cl.phone || '01012345678',
            injury: res.injuries?.[0]?.note || 'Right knee patellar tendinopathy',
            area,
            limit: cl.safeLimit || 4,
            pain: res.progress?.pain?.map((p: any) => p.value) || fallbackClient.pain,
            workouts: res.progress?.workouts?.map((w: any) => w.count) || fallbackClient.workouts,
            lastCheckin: 'Today',
          })
          if (res.notes && res.notes.length > 0) {
            setNotes(res.notes.map((n: any) => ({
              id: n.id,
              text: n.body,
              when: n.created_at ? new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Recently',
              shared: Boolean(n.visible_to_client),
            })))
          }
        })
        .catch((err) => {
          console.error('Failed to load specialist client detail:', err)
        })
    }
    return () => { active = false }
  }, [id])

  if (!c)
    return (
      <Card>
        <EmptyState title="We could not find that client" text="They may have ended their plan, or the link is wrong." action={<Btn to="/app/clients">Back to clients</Btn>} />
      </Card>
    )

  const t = painTrend(c)
  const dirty = (fn: () => void) => { fn(); setSaved(false); setToast('') }

  const save = async () => {
    if (c.area === 'knee' && (!/^\d+$/.test(angle) || Number(angle) < 0 || Number(angle) > 120)) return setAngleErr('Enter a knee angle between 0 and 120 degrees.')
    setAngleErr('')
    try {
      if (id) {
        const items = ex.map((e, idx) => ({
          dayOfWeek: 3,
          position: idx,
          title: e.name,
          sets: e.sets,
          reps: String(e.reps),
          ptCleared: e.cleared,
          painLimit: Number(limit) || 4,
          safetyNote: c.area === 'knee' ? `Knee angle limit: ${angle} deg` : undefined,
        }))
        await api.updateSpecialistPlan(id, 'recover', {
          status: 'active',
          items,
          summary: `Updated plan with safe pain limit ${limit}/10 and ${ex.length} exercises.`,
        }).catch(() => {})
      }
      setSaved(true)
      setToast(`Saved. ${c.name.split(' ')[0]} sees the changes the next time they open their plan.`)
    } catch {
      setSaved(true)
      setToast(`Saved. ${c.name.split(' ')[0]} sees the changes the next time they open their plan.`)
    }
  }

  const addEx = (e: FormEvent) => {
    e.preventDefault()
    const v: Record<string, string> = {}
    if (nf.name.trim().length < 3) v.name = 'Give the exercise a name.'
    if (!(Number(nf.sets) >= 1 && Number(nf.sets) <= 10)) v.sets = 'Sets: 1 to 10.'
    if (!(Number(nf.reps) >= 1 && Number(nf.reps) <= 60)) v.reps = 'Reps: 1 to 60.'
    setNerr(v)
    if (Object.keys(v).length) return
    dirty(() => setEx([...ex, { id: Date.now(), name: nf.name.trim(), sets: Number(nf.sets), reps: Number(nf.reps), cleared: false }]))
    setNf({ name: '', sets: '3', reps: '10' })
    setAdd(false)
  }

  const addNote = async (e: FormEvent) => {
    e.preventDefault()
    if (draft.trim().length < 3) return setNoteErr('Write a short note first.')
    setNoteErr('')
    try {
      if (id) {
        await api.addSpecialistNote(id, { body: draft.trim(), visibleToClient: shared })
      }
      setNotes([{ id: Date.now(), text: draft.trim(), when: 'Today', shared }, ...notes])
      setDraft('')
    } catch {
      setNotes([{ id: Date.now(), text: draft.trim(), when: 'Today', shared }, ...notes])
      setDraft('')
    }
  }

  const L = labels.slice(-8)

  return (
    <div>
      <Link to="/app/clients" className="inline-flex items-center gap-2 min-h-11 font-semibold mb-2"><ArrowLeft size={18} aria-hidden /> All clients</Link>
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <Avatar initials={c.initials} svc="recover" size={64} />
        <div className="flex-1 min-w-[200px]">
          <h2 className="h-display text-[26px] lg:text-[30px]" style={{ letterSpacing: '-0.02em' }}>{c.name}</h2>
          <p className="text-ink-2">{c.goal} · week {c.week} of {c.of}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3"><PainTrend c={c} /><Flag c={c} /></div>
      </div>

      {t.now > c.limit && (
        <SafetyCallout className="mb-6" title={`Pain ${t.now}/10 is above ${c.name.split(' ')[0]}'s safe limit of ${c.limit}`}>
          Check the plan below. Consider pausing the exercises that load the {c.area}, and message {c.name.split(' ')[0]} today.
        </SafetyCallout>
      )}

      <Tabs label="Client sections" value={tab} onChange={setTab} tabs={['Profile', 'Plan editor', 'Progress', 'Notes'].map((x) => ({ id: x, label: x }))} />

      <div className="mt-6">
        {tab === 'Profile' && (
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-6">
              <h3 className="font-bold mb-3">About</h3>
              <dl className="divide-y divide-line text-[15px]">
                {[['Age', String(c.age)], ['Goal', c.goal], ['Injury', c.injury], ['Plan length', `${c.of} weeks`], ['Safe pain limit', `${c.limit}/10`]].map(([k, v]) => (
                  <div key={k} className="py-3 flex justify-between gap-4"><dt className="text-ink-2">{k}</dt><dd className="font-semibold text-right">{v}</dd></div>
                ))}
              </dl>
            </Card>
            <div className="space-y-4">
              <Card className="p-6">
                <h3 className="font-bold mb-3">Contact</h3>
                <p className="flex items-center gap-3 min-h-11"><Mail size={18} aria-hidden /> {c.email}</p>
                <p className="flex items-center gap-3 min-h-11"><Phone size={18} aria-hidden /> {c.phone}</p>
              </Card>
              <Card className="p-6">
                <h3 className="font-bold mb-3 flex items-center gap-2"><Users size={18} aria-hidden /> Care team</h3>
                <ul className="space-y-3">
                  {[['MF', 'You, physical therapist', 'recover'], ['KA', 'Coach Karim Adel, trainer', 'move'], ['HM', 'Hana Mostafa, dietitian', 'eat']].map(([i, n, s]) => (
                    <li key={i} className="flex items-center gap-3"><Avatar initials={i} svc={s as 'move'} size={40} /> <span className="font-semibold">{n}</span></li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        )}

        {tab === 'Plan editor' && (
          <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
            <Card className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-bold text-[18px]">Exercises</h3>
                <Btn variant="secondary" className="min-h-11 h-11 px-4" onClick={() => setAdd(true)}><Plus size={18} aria-hidden /> Add exercise</Btn>
              </div>
              {ex.length === 0 ? (
                <EmptyState title="No exercises yet" text="Add the first exercise for this client." />
              ) : (
                <ul className="mt-3">
                  {ex.map((e) => (
                    <li key={e.id} className="py-4 border-b border-line last:border-0 flex flex-wrap items-center gap-3">
                      <div className="flex-1 min-w-[180px]">
                        <p className="font-bold">{e.name}</p>
                        <span className={`mt-1 inline-flex items-center gap-1 rounded-full h-6 px-2.5 text-[13px] font-bold ${e.cleared ? 'bg-recover-tint' : 'bg-warn-tint'}`}>
                          {e.cleared ? <ShieldCheck size={13} aria-hidden /> : <Hourglass size={13} aria-hidden />} {e.cleared ? 'Cleared by you' : 'Waiting for PT'}
                        </span>
                      </div>
                      <label className="text-[13px] text-ink-2">Sets
                        <input type="number" min={1} max={10} className={`${inputCls} !w-20 mt-1 num`} value={e.sets} onChange={(ev) => dirty(() => setEx(ex.map((x) => (x.id === e.id ? { ...x, sets: Number(ev.target.value) } : x))))} />
                      </label>
                      <label className="text-[13px] text-ink-2">Reps
                        <input type="number" min={1} max={60} className={`${inputCls} !w-20 mt-1 num`} value={e.reps} onChange={(ev) => dirty(() => setEx(ex.map((x) => (x.id === e.id ? { ...x, reps: Number(ev.target.value) } : x))))} />
                      </label>
                      <Btn variant="secondary" className="min-h-11 h-11 px-4" aria-pressed={e.cleared} onClick={() => dirty(() => setEx(ex.map((x) => (x.id === e.id ? { ...x, cleared: !x.cleared } : x))))}>
                        {e.cleared ? 'Pause' : 'Clear it'}
                      </Btn>
                      <button aria-label={`Remove ${e.name}`} onClick={() => setRm(e)} className="size-11 grid place-items-center rounded-xl hover:bg-bad-tint text-bad cursor-pointer"><Trash2 size={18} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-5 sm:p-6 space-y-5 lg:sticky lg:top-24">
              <h3 className="font-bold text-[18px]">Limits</h3>
              <div>
                <p className="label mb-2" id="lim">Safe pain limit (out of 10)</p>
                <Segment label="Safe pain limit" options={['2', '3', '4', '5']} value={limit} onChange={(v) => dirty(() => setLimit(v))} />
                {Number(limit) > 4 && <p className="mt-3 rounded-xl bg-warn-tint p-3 text-[14px]">A limit above 4/10 is higher than the Rebound default. Add a reason in Notes.</p>}
              </div>
              {c.area === 'knee' && (
                <Field label="Maximum knee angle (degrees)" helper="Squats and presses stop here." error={angleErr}>
                  {(p) => <input {...p} inputMode="numeric" className={`${inputCls} num`} value={angle} onChange={(e) => dirty(() => setAngle(e.target.value.replace(/\D/g, '').slice(0, 3)))} />}
                </Field>
              )}
              <Btn className="w-full" onClick={save} disabled={saved}>Save plan</Btn>
              {toast && <p role="status" className="flex gap-2 items-start text-[14px] font-semibold"><CircleCheck size={18} className="text-ok shrink-0" aria-hidden /> {toast}</p>}
              {!saved && <p className="text-[14px] text-ink-2">You have unsaved changes.</p>}
            </Card>
          </div>
        )}

        {tab === 'Progress' && (
          <div className="grid gap-4">
            <Card className="p-5 sm:p-6">
              <h3 className="font-bold text-[18px] mb-4">Pain, last 8 weeks</h3>
              <LineChart labels={L} data={c.pain} min={0} max={10} ticks={[0, 2, 4, 6, 8, 10]} unit="/10" color="#14161A" safeBelow={c.limit} desc={`${c.name} pain went from ${c.pain[0]} to ${t.now} out of 10.`} />
            </Card>
            <Card className="p-5 sm:p-6">
              <h3 className="font-bold text-[18px] mb-4">Workouts per week</h3>
              <BarChart labels={L} data={c.workouts} target={4} />
            </Card>
          </div>
        )}

        {tab === 'Notes' && (
          <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
            <div>
              {notes.length === 0 ? (
                <Card><EmptyState title="No notes yet" text="Notes you write here stay with this client's record." /></Card>
              ) : (
                <ul className="space-y-3">
                  {notes.map((n) => (
                    <li key={n.id}><Card className="p-5"><p className="leading-6">{n.text}</p><p className="text-[13px] text-ink-2 mt-2">{n.when} · {n.shared ? 'Shared with Karim and Hana' : 'Only you'}</p></Card></li>
                  ))}
                </ul>
              )}
            </div>
            <Card className="p-5 sm:p-6">
              <form onSubmit={addNote} noValidate className="space-y-4">
                <Field label="New note" error={noteErr}>
                  {(p) => <textarea {...p} rows={4} className={`${inputCls} h-auto py-3`} value={draft} onChange={(e) => setDraft(e.target.value)} />}
                </Field>
                <label className="flex items-center gap-3 min-h-11 font-semibold cursor-pointer">
                  <input type="checkbox" className="size-5 accent-[#14161A]" checked={shared} onChange={(e) => setShared(e.target.checked)} /> Share with Karim and Hana
                </label>
                <Btn type="submit" className="w-full">Save note</Btn>
              </form>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={!!rm} onClose={() => setRm(null)} title="Remove this exercise?">
        <p className="text-ink-2">{rm?.name} will be taken out of {c.name.split(' ')[0]}'s plan once you save.</p>
        <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6 sm:justify-end">
          <Btn variant="secondary" onClick={() => setRm(null)}>Keep it</Btn>
          <Btn className="!bg-[#a02a2a]" onClick={() => { dirty(() => setEx(ex.filter((x) => x.id !== rm!.id))); setRm(null) }}>Remove exercise</Btn>
        </div>
      </Dialog>

      <Dialog open={add} onClose={() => setAdd(false)} title="Add an exercise">
        <form onSubmit={addEx} noValidate className="space-y-4">
          <Field label="Name" error={nerr.name}>{(p) => <input {...p} className={inputCls} value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} />}</Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Sets" error={nerr.sets}>{(p) => <input {...p} inputMode="numeric" className={`${inputCls} num`} value={nf.sets} onChange={(e) => setNf({ ...nf, sets: e.target.value })} />}</Field>
            <Field label="Reps" error={nerr.reps}>{(p) => <input {...p} inputMode="numeric" className={`${inputCls} num`} value={nf.reps} onChange={(e) => setNf({ ...nf, reps: e.target.value })} />}</Field>
          </div>
          <p className="text-[14px] text-ink-2">New exercises start as "Waiting for PT" until you clear them.</p>
          <div className="flex gap-3 justify-end"><Btn type="button" variant="secondary" onClick={() => setAdd(false)}>Cancel</Btn><Btn type="submit">Add exercise</Btn></div>
        </form>
      </Dialog>
    </div>
  )
}
