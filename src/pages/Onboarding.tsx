import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowLeft, ArrowRight, CircleCheck, TriangleAlert, OctagonAlert, Dumbbell, Utensils, HeartPulse, Scale, Flame, Bone, Sparkles } from 'lucide-react'
import { Btn, Chip, Field, inputCls, SafetyCallout, Wordmark, Card, SVC } from '../ui'
import { api } from '../api'

const goalMap: Record<string, string> = {
  'Lose fat': 'lose_fat',
  'Build muscle': 'build_muscle',
  'Recover from injury': 'recover_injury',
  'Stay healthy': 'stay_healthy',
}

const actMap: Record<string, string> = {
  'Mostly sitting': 'sedentary',
  'Lightly active': 'light',
  'Active': 'moderate',
  'Very active': 'active',
}

const areaMap: Record<string, string> = {
  'Neck': 'neck',
  'Shoulder': 'shoulder',
  'Upper back': 'upper_back',
  'Lower back': 'lower_back',
  'Elbow or wrist': 'elbow_wrist',
  'Hip': 'hip',
  'Knee': 'knee',
  'Ankle or foot': 'ankle_foot',
}

const durationMap: Record<string, string> = {
  'Less than 2 weeks': 'days',
  '2 to 6 weeks': 'weeks',
  '6 to 12 weeks': 'weeks',
  'Over 3 months': 'months',
}

const dietMap: Record<string, string> = {
  'No preference': 'no_preference',
  'High protein': 'high_protein',
  'Vegetarian': 'vegetarian',
  'Low carb': 'low_carb',
}

const goalsList = [
  ['Lose fat', Flame],
  ['Build muscle', Dumbbell],
  ['Recover from injury', Bone],
  ['Stay healthy', Sparkles],
] as const
const areas = ['Neck', 'Shoulder', 'Upper back', 'Lower back', 'Elbow or wrist', 'Hip', 'Knee', 'Ankle or foot', 'Nothing hurts']
const activity = [
  ['Mostly sitting', 'Desk or study, little exercise'],
  ['Lightly active', 'Walks, 1 to 2 workouts a week'],
  ['Active', '3 to 4 workouts a week'],
  ['Very active', '5 or more workouts a week'],
]
const titles = ['Goals', 'About you', 'Pain and injuries', 'Food']

type Pain = { level: number; time: string; doctor: string }

function painInfo(n: number) {
  if (n <= 3) return { Icon: CircleCheck, text: 'Mild', cls: 'bg-ok-tint text-[#1d6b3d]' }
  if (n <= 6) return { Icon: TriangleAlert, text: 'Moderate', cls: 'bg-warn-tint text-[#7a5200]' }
  return { Icon: OctagonAlert, text: 'Severe', cls: 'bg-bad-tint text-[#a02a2a]' }
}

function Segment({ options, value, onChange, label }: { options: string[]; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={`min-h-11 min-w-11 px-4 rounded-xl border font-semibold cursor-pointer ${value === o ? 'bg-ink text-white border-ink' : 'bg-white border-ink/25 hover:border-ink'}`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

export default function Onboarding() {
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [saved, setSaved] = useState(false)
  const [goals, setGoals] = useState<string[]>(['Recover from injury'])
  const [days, setDays] = useState('3')
  const [about, setAbout] = useState({ age: '24', height: '172', weight: '74', act: 'Lightly active' })
  const [err, setErr] = useState<Record<string, string>>({})
  const [sel, setSel] = useState<string[]>(['Knee'])
  const [pain, setPain] = useState<Record<string, Pain>>({ Knee: { level: 4, time: '2 to 6 weeks', doctor: 'No' } })
  const [food, setFood] = useState({ diet: 'No preference', allergies: [] as string[], meals: '3', dislikes: 'Okra, liver' })

  useEffect(() => {
    api.getProfile().then((res) => {
      if (res?.profile) {
        const p = res.profile
        if (p.goal) {
          const revGoal = Object.entries(goalMap).find(([_, v]) => v === p.goal)?.[0]
          if (revGoal) setGoals([revGoal])
        }
        if (p.days_per_week) setDays(String(p.days_per_week))
        setAbout((prev) => ({
          ...prev,
          age: p.age ? String(p.age) : prev.age,
          height: p.height_cm ? String(p.height_cm) : prev.height,
          weight: p.weight_kg ? String(p.weight_kg) : prev.weight,
          act: Object.entries(actMap).find(([_, v]) => v === p.activity_level)?.[0] || prev.act,
        }))
        if (p.diet_style) {
          const revDiet = Object.entries(dietMap).find(([_, v]) => v === p.diet_style)?.[0]
          if (revDiet) setFood((f) => ({ ...f, diet: revDiet }))
        }
        if (p.meals_per_day) setFood((f) => ({ ...f, meals: String(p.meals_per_day) }))
        if (p.disliked_foods) setFood((f) => ({ ...f, dislikes: p.disliked_foods }))
        if (p.allergies) {
          const list = p.allergies.split(',').map((s: string) => s.trim()).filter(Boolean)
          setFood((f) => ({ ...f, allergies: list }))
        }
      }
      if (res?.injuries && res.injuries.length > 0) {
        const areas = res.injuries.map((inj: any) => {
          const areaName = Object.entries(areaMap).find(([_, v]) => v === inj.body_area)?.[0] || 'Knee'
          return areaName
        })
        setSel(areas)
        const painObj: Record<string, Pain> = {}
        res.injuries.forEach((inj: any) => {
          const areaName = Object.entries(areaMap).find(([_, v]) => v === inj.body_area)?.[0] || 'Knee'
          painObj[areaName] = {
            level: inj.pain_level,
            time: inj.duration === 'days' ? 'Less than 2 weeks' : '2 to 6 weeks',
            doctor: inj.doctor_seen ? 'Yes' : 'No',
          }
        })
        setPain(painObj)
      }
    }).catch(() => {})
  }, [])

  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const toggleArea = (a: string) => {
    if (a === 'Nothing hurts') return setSel(sel.includes(a) ? [] : [a])
    const next = toggle(sel.filter((x) => x !== 'Nothing hurts'), a)
    setSel(next)
    if (!pain[a]) setPain({ ...pain, [a]: { level: 3, time: 'Less than 2 weeks', doctor: 'No' } })
  }

  const saveCurrentStep = async (s = step) => {
    try {
      if (s === 0) {
        await api.updateProfile({
          goal: goalMap[goals[0]] || 'stay_healthy',
          daysPerWeek: Number(days),
        })
      } else if (s === 1) {
        await api.updateProfile({
          age: Number(about.age),
          heightCm: Number(about.height),
          weightKg: Number(about.weight),
          activityLevel: actMap[about.act] || 'light',
        })
      } else if (s === 2) {
        const painAreas = sel.filter((x) => x !== 'Nothing hurts')
        const injuriesPayload = painAreas.map((area) => {
          const p = pain[area] || { level: 3, time: '2 to 6 weeks', doctor: 'No' }
          return {
            bodyArea: areaMap[area] || 'knee',
            painLevel: Number(p.level),
            duration: durationMap[p.time] || 'weeks',
            doctorSeen: p.doctor === 'Yes',
          }
        })
        await api.updateProfile({ injuries: injuriesPayload })
      } else if (s === 3) {
        await api.updateProfile({
          dietStyle: dietMap[food.diet] || 'no_preference',
          allergies: food.allergies,
          mealsPerDay: Number(food.meals),
          dislikedFoods: food.dislikes ? food.dislikes.split(',').map((x) => x.trim()).filter(Boolean) : [],
        })
      }
    } catch (err) {
      console.error('Error saving onboarding step:', err)
    }
  }

  const next = async () => {
    const e: Record<string, string> = {}
    if (step === 0 && goals.length === 0) e.goals = 'Choose at least one goal.'
    if (step === 1) {
      const a = +about.age, h = +about.height, w = +about.weight
      if (!(a >= 16 && a <= 80)) e.age = 'Enter an age between 16 and 80.'
      if (!(h >= 120 && h <= 220)) e.height = 'Enter your height in cm, between 120 and 220.'
      if (!(w >= 35 && w <= 250)) e.weight = 'Enter your weight in kg, between 35 and 250.'
    }
    if (step === 2 && sel.length === 0) e.pain = 'Choose an area, or tap "Nothing hurts".'
    setErr(e)
    if (Object.keys(e).length === 0) {
      await saveCurrentStep(step)
      setStep(step + 1)
    }
  }

  const handleSaveLater = async () => {
    await saveCurrentStep(step)
    setSaved(true)
  }

  const painAreas = sel.filter((s) => s !== 'Nothing hurts')
  const done = step === 4

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-paper sticky top-0 z-30">
        <div className="mx-auto max-w-[760px] px-5 h-[72px] flex items-center justify-between">
          <Link to="/" aria-label="Rebound home">
            <Wordmark />
          </Link>
          <button
            onClick={handleSaveLater}
            className="min-h-11 px-3 font-semibold underline underline-offset-4 cursor-pointer"
          >
            Save and continue later
          </button>
        </div>
      </header>
      {saved && (
        <div role="status" className="mx-auto max-w-[760px] px-5 mt-4">
          <div className="rounded-xl bg-ok-tint border border-ok/40 p-4 flex gap-3 items-center">
            <CircleCheck className="text-ok shrink-0" aria-hidden />
            <p className="font-semibold flex-1">Saved. Log in any time to pick up at step {Math.min(step + 1, 4)}.</p>
            <button className="min-h-11 px-3 font-bold underline cursor-pointer" onClick={() => setSaved(false)}>
              Dismiss
            </button>
          </div>
        </div>
      )}
      <main className="mx-auto max-w-[760px] px-5 py-10 pb-40">
        {!done && (
          <div className="mb-10">
            <div className="flex justify-between font-semibold text-[15px]">
              <span>
                Step {step + 1} of 4: {titles[step]}
              </span>
              <span className="text-ink-2">{step * 25}% done</span>
            </div>
            <div
              className="mt-3 flex gap-2"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={4}
              aria-valuenow={step + 1}
              aria-label={`Step ${step + 1} of 4`}
            >
              {titles.map((t, i) => (
                <span key={t} className={`h-2 flex-1 rounded-full ${i <= step ? 'bg-ink' : 'bg-line'}`} />
              ))}
            </div>
          </div>
        )}

        {step === 0 && (
          <Section title="What are you training for?" sub="Choose all that apply. You can change this later.">
            <div className="grid sm:grid-cols-2 gap-3" role="group" aria-label="Goals">
              {goalsList.map(([g, Icon]) => {
                const on = goals.includes(g)
                return (
                  <button
                    key={g}
                    aria-pressed={on}
                    onClick={() => setGoals(toggle(goals, g))}
                    className={`text-left min-h-20 rounded-2xl p-5 flex items-center gap-4 border-2 cursor-pointer ${on ? 'border-ink bg-white' : 'border-line bg-white hover:border-ink/40'}`}
                  >
                    <span className={`size-12 rounded-xl grid place-items-center ${on ? 'bg-ink text-white' : 'bg-sand'}`}>
                      {on ? <CircleCheck size={24} aria-hidden /> : <Icon size={24} aria-hidden />}
                    </span>
                    <span className="font-bold text-[17px]">{g}</span>
                  </button>
                )
              })}
            </div>
            {err.goals && <p className="text-[#a02a2a] font-semibold text-[14px] mt-3">{err.goals}</p>}
            <div className="mt-8">
              <p className="text-[14px] font-semibold mb-2">Days per week you can train</p>
              <Segment label="Days per week" options={['1', '2', '3', '4', '5', '6']} value={days} onChange={setDays} />
              <p className="text-[14px] text-ink-2 mt-2">Be honest. Three steady days beat five you skip.</p>
            </div>
          </Section>
        )}

        {step === 1 && (
          <Section title="A little about you" sub="This sets your starting loads and calories.">
            <div className="grid sm:grid-cols-3 gap-4">
              {(
                [
                  ['age', 'Age', 'Years'],
                  ['height', 'Height', 'In cm'],
                  ['weight', 'Weight', 'In kg'],
                ] as const
              ).map(([k, l, h]) => (
                <Field key={k} label={l} helper={h} error={err[k]}>
                  {(p) => <input {...p} inputMode="numeric" className={inputCls} value={about[k]} onChange={(e) => setAbout({ ...about, [k]: e.target.value.replace(/\D/g, '') })} />}
                </Field>
              ))}
            </div>
            <fieldset className="mt-8">
              <legend className="text-[14px] font-semibold mb-3">How active are you now?</legend>
              <div className="grid gap-3">
                {activity.map(([a, d]) => (
                  <label
                    key={a}
                    className={`flex items-center gap-4 min-h-16 px-5 rounded-2xl border-2 cursor-pointer bg-white ${about.act === a ? 'border-ink' : 'border-line hover:border-ink/40'}`}
                  >
                    <input type="radio" name="act" className="size-5 accent-ink" checked={about.act === a} onChange={() => setAbout({ ...about, act: a })} />
                    <span>
                      <span className="font-bold block">{a}</span>
                      <span className="text-[14px] text-ink-2">{d}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </Section>
        )}

        {step === 2 && (
          <Section title="Where does it hurt?" sub="Choose every area that bothers you, even a little.">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Pain areas">
              {areas.map((a) => (
                <Chip key={a} selected={sel.includes(a)} onClick={() => toggleArea(a)}>
                  {a}
                </Chip>
              ))}
            </div>
            {err.pain && <p className="text-[#a02a2a] font-semibold text-[14px] mt-3">{err.pain}</p>}
            <div className="mt-6 space-y-4">
              {painAreas.map((a) => {
                const p = pain[a] ?? { level: 3, time: 'Less than 2 weeks', doctor: 'No' }
                const set = (x: Partial<Pain>) => setPain({ ...pain, [a]: { ...p, ...x } })
                const info = painInfo(p.level)
                return (
                  <Card key={a} className="p-6">
                    <h3 className="h-display text-[22px]" style={{ letterSpacing: '-0.02em' }}>
                      {a}
                    </h3>
                    <div className="mt-5">
                      <label htmlFor={`pain-${a}`} className="text-[14px] font-semibold">
                        Pain level right now
                      </label>
                      <div className="flex items-center gap-4 mt-2">
                        <input
                          id={`pain-${a}`}
                          type="range"
                          min={0}
                          max={10}
                          value={p.level}
                          onChange={(e) => set({ level: +e.target.value })}
                          className="flex-1 h-11 accent-ink cursor-pointer"
                          aria-valuetext={`${p.level} out of 10, ${info.text}`}
                        />
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 h-9 font-bold text-[14px] shrink-0 ${info.cls}`}>
                          <info.Icon size={16} aria-hidden />
                          <span className="num">{p.level}</span>/10 · {info.text}
                        </span>
                      </div>
                      <div className="flex justify-between text-[13px] text-ink-2 font-medium">
                        <span>0 No pain</span>
                        <span>10 Worst pain</span>
                      </div>
                      {p.level >= 7 && (
                        <p className="mt-3 text-[14px] font-semibold text-[#a02a2a] flex gap-2">
                          <OctagonAlert size={18} className="shrink-0" aria-hidden /> Pain this high needs a doctor before you train this area. Your PT will help you plan that.
                        </p>
                      )}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4 mt-5">
                      <Field label="How long has it lasted?">
                        {(q) => (
                          <select {...q} className={inputCls} value={p.time} onChange={(e) => set({ time: e.target.value })}>
                            {['Less than 2 weeks', '2 to 6 weeks', '2 to 6 months', 'More than 6 months'].map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </select>
                        )}
                      </Field>
                      <div>
                        <p className="text-[14px] font-semibold mb-2">Has a doctor seen it?</p>
                        <Segment label="Doctor seen" options={['Yes', 'No']} value={p.doctor} onChange={(v) => set({ doctor: v })} />
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
            <SafetyCallout title="This isn't a diagnosis." className="mt-6">
              Your physical therapist will review it. If you ever have sharp pain, numbness or swelling, stop and see a doctor.
            </SafetyCallout>
          </Section>
        )}

        {step === 3 && (
          <Section title="How do you eat?" sub="Your dietitian builds around this.">
            <div className="space-y-7">
              <div>
                <p className="text-[14px] font-semibold mb-2">Diet style</p>
                <Segment label="Diet style" options={['No preference', 'Vegetarian', 'Pescatarian', 'High protein']} value={food.diet} onChange={(v) => setFood({ ...food, diet: v })} />
              </div>
              <div>
                <p className="text-[14px] font-semibold mb-2">Allergies</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Allergies">
                  {['Nuts', 'Dairy', 'Gluten', 'Eggs', 'Shellfish'].map((a) => (
                    <Chip key={a} selected={food.allergies.includes(a)} onClick={() => setFood({ ...food, allergies: toggle(food.allergies, a) })}>
                      {a}
                    </Chip>
                  ))}
                </div>
                <p className="text-[14px] text-ink-2 mt-2">Leave empty if none.</p>
              </div>
              <div>
                <p className="text-[14px] font-semibold mb-2">Meals per day</p>
                <Segment label="Meals per day" options={['2', '3', '4', '5']} value={food.meals} onChange={(v) => setFood({ ...food, meals: v })} />
              </div>
              <Field label="Foods you dislike" helper="Separate with commas, for example: okra, liver.">
                {(p) => <input {...p} className={inputCls} value={food.dislikes} onChange={(e) => setFood({ ...food, dislikes: e.target.value })} />}
              </Field>
            </div>
          </Section>
        )}

        {done && (
          <Section title="Your starting profile" sub="Here is what your specialists will see first. Check it looks right.">
            <div className="space-y-3">
              <Row svc="move" Icon={Dumbbell} head="Move" lines={[goals.join(', ') || 'No goal chosen', `${days} training days a week`]} />
              <Row svc="eat" Icon={Utensils} head="Eat" lines={[`${food.diet}, ${food.meals} meals a day`, food.allergies.length ? `Allergies: ${food.allergies.join(', ')}` : 'No allergies', food.dislikes ? `Dislikes: ${food.dislikes}` : '']} />
              <Row
                svc="recover"
                Icon={HeartPulse}
                head="Recover"
                lines={painAreas.length ? painAreas.map((a) => `${a}: ${pain[a].level}/10, ${pain[a].time.toLowerCase()}`) : ['Nothing hurts right now']}
              />
              <Card className="p-5 flex gap-4 items-center">
                <span className="size-12 rounded-xl bg-sand grid place-items-center">
                  <Scale size={22} aria-hidden />
                </span>
                <p className="text-[15px]">
                  <span className="num">{about.age}</span> years · <span className="num">{about.height}</span> cm · <span className="num">{about.weight}</span> kg · {about.act}
                </p>
              </Card>
            </div>
            {painAreas.length > 0 && (
              <SafetyCallout title="A physical therapist will review your pain answers." className="mt-6">
                This isn't a diagnosis. Nothing in your plan that touches a sore area will start until they have looked.
              </SafetyCallout>
            )}
          </Section>
        )}
      </main>

      <div className="fixed bottom-0 inset-x-0 bg-paper border-t border-line z-30">
        <div className="mx-auto max-w-[760px] px-5 h-24 flex items-center justify-between">
          {step > 0 ? (
            <Btn variant="secondary" onClick={() => { setErr({}); setStep(step - 1) }}>
              <ArrowLeft size={18} aria-hidden /> Back
            </Btn>
          ) : (
            <span />
          )}
          {done ? (
            <Btn
              onClick={async () => {
                try {
                  await api.completeOnboarding()
                } catch (err) {
                  console.error('Error completing onboarding:', err)
                }
                nav('/app/specialists')
              }}
            >
              Find my specialists <ArrowRight size={18} aria-hidden />
            </Btn>
          ) : (
            <Btn onClick={next}>
              {step === 3 ? 'See my profile' : 'Continue'} <ArrowRight size={18} aria-hidden />
            </Btn>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <section>
      <h1 className="h-display text-[32px]">{title}</h1>
      <p className="text-ink-2 mt-2 mb-8">{sub}</p>
      {children}
    </section>
  )
}

function Row({ svc, Icon, head, lines }: { svc: 'move' | 'eat' | 'recover'; Icon: typeof Dumbbell; head: string; lines: string[] }) {
  return (
    <div className={`${SVC[svc].tint} rounded-2xl p-5 flex gap-4`}>
      <span className={`size-12 rounded-xl grid place-items-center shrink-0 ${SVC[svc].bg}`}>
        <Icon size={24} aria-hidden />
      </span>
      <div>
        <p className="label uppercase">{head}</p>
        {lines.filter(Boolean).map((l) => (
          <p key={l} className="font-semibold">
            {l}
          </p>
        ))}
      </div>
    </div>
  )
}
