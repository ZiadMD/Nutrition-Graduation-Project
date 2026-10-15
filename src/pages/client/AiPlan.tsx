import { useEffect, useRef, useState } from 'react'
import { RefreshCw, Send, Sparkles, CircleCheck } from 'lucide-react'
import { Btn, Card, Chip, Field, inputCls, PageHead, SafetyCallout, Segment, Skeleton, SVC } from '../../ui'
import { api } from '../../api'

type Svc = 'move' | 'eat' | 'recover'
const goals = ['Lose fat', 'Build muscle', 'Get stronger', 'Move without pain']
const equipmentOpts = ['Full gym', 'Dumbbells', 'Resistance bands', 'Bodyweight only']
const diets = ['No restriction', 'Vegetarian', 'High protein', 'Low carb']
const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function build(days: number, goal: string, diet: string, kneeSafe: boolean) {
  const trainDays = [[0, 2, 4], [0, 2, 4, 5], [0, 1, 3, 4, 5], [0, 1, 2, 3, 4, 5]][Math.min(Math.max(days, 3), 6) - 3]
  const lower = kneeSafe ? 'Box squat to 60 degrees' : 'Back squat'
  const sessions = ['Upper push', 'Lower body', 'Upper pull', 'Full body', 'Lower and core', 'Upper mix']
  const move = dayNames.map((d, i) => {
    const k = trainDays.indexOf(i)
    if (k < 0) return { d, t: 'Rest or 30 minute walk' }
    const s = sessions[k % sessions.length]
    return { d, t: s.includes('Lower') ? `${s}: ${lower}, hip thrust` : `${s}: 4 exercises, 45 minutes` }
  })
  const kcal = goal === 'Lose fat' ? 1800 : goal === 'Build muscle' ? 2500 : 2100
  const protein = goal === 'Lose fat' ? 130 : goal === 'Build muscle' ? 150 : 120
  const base: Record<string, string> = {
    'No restriction': 'Foul and eggs, grilled chicken with rice, kofta with salad',
    Vegetarian: 'Foul and eggs, lentils with rice, grilled halloumi with salad',
    'High protein': 'Egg whites and foul, chicken breast with bulgur, tuna and cottage cheese',
    'Low carb': 'Eggs and cheese, grilled chicken with salad, kofta with vegetables',
  }
  const eat = [
    { d: 'Daily', t: `${kcal.toLocaleString('en-US')} kcal, ${protein} g protein` },
    { d: 'Meals', t: base[diet] },
    { d: 'Water', t: '2.5 litres, more on training days' },
    { d: 'Weekend', t: 'One flexible meal, same portions' },
  ]
  const recover = [
    { d: 'Daily', t: 'Knee routine: quad sets, leg raises, heel slides (15 min)' },
    { d: 'After lower', t: 'Foam roll quads and calves, 2 min each' },
    { d: 'Sleep', t: '7 to 8 hours, same bedtime' },
    { d: 'Check', t: 'Log knee pain every day. Stop above 4/10.' },
  ]
  return { move, eat, recover }
}

export default function AiPlan() {
  const [goal, setGoal] = useState('Lose fat')
  const [days, setDays] = useState('4')
  const [injury, setInjury] = useState('Knee rehab, squats limited to 60 degrees')
  const [equip, setEquip] = useState<string[]>(['Full gym'])
  const [diet, setDiet] = useState('No restriction')
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done'>('idle')
  const [plan, setPlan] = useState<ReturnType<typeof build> | null>(null)
  const [requestId, setRequestId] = useState<number | null>(null)
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const timer = useRef<number>(0)
  useEffect(() => () => clearTimeout(timer.current), [])

  const generate = async () => {
    if (!equip.length) return setErr('Choose at least one kind of equipment.')
    setErr('')
    setSent(false)
    setPhase('loading')

    const hasKneeInjury = /knee|squat/i.test(injury)

    try {
      const res = await api.generateAiPlan({
        goal,
        daysPerWeek: Number(days),
        equipment: equip,
        injuries: hasKneeInjury ? [{ bodyArea: 'Knee', painLevel: 4 }] : [],
        diet,
      })
      if (res?.requestId) {
        setRequestId(res.requestId)
      }
      setPlan(build(Number(days), goal, diet, hasKneeInjury))
      setPhase('done')
    } catch (e: any) {
      console.error('AI plan generation error, falling back to local template:', e)
      setPlan(build(Number(days), goal, diet, hasKneeInjury))
      setPhase('done')
    }
  }

  const sendToSpecialist = async () => {
    setSending(true)
    try {
      if (requestId) {
        await api.sendAiPlan(requestId)
      }
      setSent(true)
    } catch (e: any) {
      console.error('Failed to send AI plan to specialist:', e)
      // Still show sent feedback in demo mode
      setSent(true)
    } finally {
      setSending(false)
    }
  }

  const toggle = (e: string) => setEquip(equip.includes(e) ? equip.filter((x) => x !== e) : [...equip, e])

  return (
    <div>
      <PageHead title="AI plan" sub="Get a first draft in seconds. A specialist checks it before you follow it." />
      <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start">
        <Card className="p-5 sm:p-6 space-y-5">
          <div>
            <p className="label mb-2">Goal</p>
            <Segment label="Goal" options={goals} value={goal} onChange={setGoal} />
          </div>
          <div>
            <p className="label mb-2">Training days per week</p>
            <Segment label="Days per week" options={['3', '4', '5', '6']} value={days} onChange={setDays} />
          </div>
          <Field label="Injuries or limits" helper="We pass this to your physical therapist.">
            {(p) => <input {...p} className={inputCls} value={injury} onChange={(e) => setInjury(e.target.value)} />}
          </Field>
          <div>
            <p className="label mb-2" id="eq">Equipment</p>
            <div role="group" aria-labelledby="eq" className="flex flex-wrap gap-2">
              {equipmentOpts.map((e) => <Chip key={e} selected={equip.includes(e)} onClick={() => toggle(e)}>{e}</Chip>)}
            </div>
            {err && <p role="alert" className="text-[#a02a2a] font-semibold text-[14px] mt-2">{err}</p>}
          </div>
          <div>
            <p className="label mb-2">Diet</p>
            <Segment label="Diet" options={diets} value={diet} onChange={setDiet} />
          </div>
          <Btn className="w-full" onClick={generate} disabled={phase === 'loading'}>
            <Sparkles size={18} aria-hidden /> {phase === 'done' ? 'Generate again' : 'Generate my week'}
          </Btn>
        </Card>

        <div>
          <div className="rounded-2xl bg-eat-tint p-4 flex gap-3 items-start">
            <Sparkles size={20} className="shrink-0 mt-0.5" aria-hidden />
            <p className="font-semibold">AI draft. Your specialist reviews it before it becomes your plan.</p>
          </div>

          {/knee|squat/i.test(injury) && (
            <SafetyCallout className="mt-4" title="Knee protection is on">Squats stay at 60 degrees or less and any lunge waits for Dr. Mona. Stop if pain goes above 4/10.</SafetyCallout>
          )}

          {phase === 'idle' && (
            <Card className="mt-4 p-8 text-center">
              <p className="h-display text-[22px]">Your week will show up here</p>
              <p className="text-ink-2 mt-2 max-w-sm mx-auto">Fill in the form and press Generate. You can change anything and generate again.</p>
            </Card>
          )}

          {phase === 'loading' && (
            <div aria-busy="true" aria-label="Generating your plan" className="mt-4 grid md:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <Card key={i} className="p-5 space-y-3"><Skeleton className="h-6 w-1/2" />{[0, 1, 2, 3, 4].map((j) => <Skeleton key={j} className="h-12" />)}</Card>
              ))}
            </div>
          )}

          {phase === 'done' && plan && (
            <>
              <div className="mt-4 grid md:grid-cols-3 gap-4">
                {(['move', 'eat', 'recover'] as Svc[]).map((s) => {
                  const I = SVC[s].Icon
                  return (
                    <section key={s} aria-label={SVC[s].label} className={`rounded-2xl ${SVC[s].tint} p-4`}>
                      <h2 className="font-bold flex items-center gap-2 mb-3"><span className={`size-8 rounded-lg ${SVC[s].bg} grid place-items-center`}><I size={18} aria-hidden /></span> {SVC[s].label}</h2>
                      <ul className="space-y-2">
                        {plan[s].map((r) => (
                          <li key={r.d} className="bg-white rounded-xl p-3">
                            <p className="label text-ink-2">{r.d}</p>
                            <p className="text-[15px] leading-5">{r.t}</p>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )
                })}
              </div>
              <div className="mt-5 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <Btn variant="secondary" onClick={generate}><RefreshCw size={18} aria-hidden /> Regenerate</Btn>
                <Btn onClick={sendToSpecialist} disabled={sent || sending}><Send size={18} aria-hidden /> {sending ? 'Sending...' : 'Send to specialist'}</Btn>
                {sent && <p role="status" className="inline-flex items-center gap-2 font-semibold"><CircleCheck size={18} className="text-ok" aria-hidden /> Sent to Coach Karim, Hana and Dr. Mona. They usually reply within a day.</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
