import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Check, ChevronDown, Menu, X, TriangleAlert, ShieldCheck } from 'lucide-react'
import { Btn, Card, Tag, SVC, Wordmark, Tabs, Avatar, StarRating, LanguageToggle } from '../ui'
import { specialists, week, type Svc } from '../data'

const wrap = 'mx-auto max-w-[1280px] px-5 lg:px-10'
const navLinks = [
  ['How it works', '#how'],
  ['Services', '#services'],
  ['Specialists', '#specialists'],
  ['Pricing', '#pricing'],
]

function Header() {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-40 bg-paper border-b border-line">
      <div className={`${wrap} h-[72px] flex items-center justify-between`}>
        <Link to="/" aria-label="Rebound home">
          <Wordmark />
        </Link>
        <nav className="hidden lg:flex gap-8" aria-label="Main">
          {navLinks.map(([l, h]) => (
            <a key={h} href={h} className="font-semibold text-[15px] py-3 hover:underline underline-offset-8 decoration-2">
              {l}
            </a>
          ))}
        </nav>
        <div className="hidden lg:flex items-center gap-3">
          <LanguageToggle />
          <Btn variant="ghost" to="/login">
            Log in
          </Btn>
          <Btn to="/signup">Get started</Btn>
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <LanguageToggle variant="pill" />
          <button
            className="size-11 grid place-items-center rounded-xl border border-line bg-white cursor-pointer"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="lg:hidden border-t border-line bg-paper px-5 pb-5 pt-2 flex flex-col">
          {navLinks.map(([l, h]) => (
            <a key={h} href={h} onClick={() => setOpen(false)} className="min-h-12 flex items-center font-semibold border-b border-line">
              {l}
            </a>
          ))}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <Btn variant="secondary" to="/login">
              Log in
            </Btn>
            <Btn to="/signup">Get started</Btn>
          </div>
        </div>
      )}
    </header>
  )
}

function PlanCard({ svc, time, title, meta, offset }: { svc: Svc; time: string; title: string; meta: string; offset: string }) {
  const s = SVC[svc]
  return (
    <div className={`${s.bg} rounded-2xl p-5 border-2 border-sand relative ${offset} text-ink`}>
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 label uppercase tracking-wider">
          <s.Icon size={18} strokeWidth={2.4} aria-hidden /> {s.label}
        </span>
        <span className="num text-[20px]">{time}</span>
      </div>
      <p className="h-display text-[28px] mt-3" style={{ letterSpacing: '-0.03em' }}>
        {title}
      </p>
      <p className="text-[15px] font-medium mt-1">{meta}</p>
    </div>
  )
}

function Hero() {
  const mark = (c: string, t: string) => <span className={`${c} px-2 -mx-1 rounded-xl box-decoration-clone`}>{t}</span>
  return (
    <section className={`${wrap} pt-10 lg:pt-16 pb-16 lg:pb-24 grid xl:grid-cols-[1.25fr_1fr] gap-12 xl:gap-12 items-center`}>
      <div>
        <h1 className="h-display text-[44px] sm:text-[60px] xl:text-[72px] leading-[1.04]" style={{ fontStretch: '100%' }}>
          Your {mark('bg-move-tint', 'workouts')}, {mark('bg-eat-tint', 'meals')} and {mark('bg-recover-tint', 'recovery')}, planned by people who talk to each other.
        </h1>
        <p className="mt-6 text-[18px] leading-7 text-ink-2 max-w-[560px]">
          One plan, three specialists. Your trainer, dietitian and physical therapist share notes, so a sore knee changes your lunch and your squats on the same day.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Btn to="/signup" className="h-14 px-8 text-[17px]">
            Start free assessment <ArrowRight size={20} aria-hidden />
          </Btn>
          <a href="#how" className="font-bold underline underline-offset-4 decoration-2 min-h-11 inline-flex items-center">
            See how it works
          </a>
        </div>
        <p className="mt-8 text-[14px] text-ink-2 flex items-center gap-2">
          <ShieldCheck size={18} className="text-ink shrink-0" aria-hidden />
          Licensed physical therapists · Registered dietitians · Certified trainers
        </p>
      </div>
      <div className="rounded-[28px] bg-sand p-6 sm:p-10">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="label text-ink-2 uppercase">Sara's Tuesday</p>
            <p className="h-display text-[28px] mt-1">14 October</p>
          </div>
          <span className="num text-[44px] leading-none">3</span>
        </div>
        <div className="flex flex-col">
          <PlanCard svc="eat" time="14:00" title="Lunch" meta="620 kcal · 42 g protein" offset="" />
          <PlanCard svc="move" time="18:00" title="Lower body" meta="45 min · adjusted for your knee" offset="-mt-3 sm:ml-8 z-10" />
          <PlanCard svc="recover" time="21:00" title="Knee mobility" meta="10 min · Dr. Mona's routine" offset="-mt-3 sm:ml-16 z-20" />
        </div>
      </div>
    </section>
  )
}

function How() {
  const steps: [Svc, string, string][] = [
    ['move', 'Tell us about you', 'Goals, training days, any pain, and what you eat. About 8 minutes.'],
    ['eat', 'Meet your specialists', 'We match you with a trainer, dietitian or PT. You pick who you like.'],
    ['recover', 'Follow one plan', 'Workouts, meals and rehab on one calendar. Your team adjusts it as you go.'],
  ]
  return (
    <section id="how" className="bg-white border-y border-line">
      <div className={`${wrap} py-20 lg:py-28`}>
        <div className="lg:hidden">
          <h2 className="h-display text-[40px] max-w-xl">Three steps to a plan that fits your week</h2>
          <div className="relative mt-14 grid md:grid-cols-3 gap-10 md:gap-8">
            <div className="hidden md:block absolute top-[52px] left-[52px] right-[52px] h-1 bg-ink" aria-hidden />
            {steps.map(([svc, t, d], i) => (
              <div key={t} className="relative">
                <div className={`${SVC[svc].bg} size-[104px] rounded-[28px] grid place-items-center num text-[64px] relative`}>{i + 1}</div>
                <h3 className="h-display text-[24px] mt-6" style={{ letterSpacing: '-0.02em' }}>
                  {t}
                </h3>
                <p className="text-ink-2 mt-2 max-w-[320px]">{d}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="hidden lg:grid grid-cols-[0.72fr_1.28fr] items-center gap-16">
          <div>
            <p className="label uppercase tracking-wider text-ink-2">How Rebound works</p>
            <h2 className="h-display mt-4 text-[48px] max-w-md">Three steps to a plan that fits your week</h2>
            <p className="mt-6 max-w-md text-[18px] leading-7 text-ink-2">
              Start with your real routine, choose the specialists you trust, then follow one plan they manage together.
            </p>
            <div className="mt-8 flex h-2 max-w-[240px] overflow-hidden rounded-full" aria-hidden>
              <span className="flex-1 bg-move" />
              <span className="flex-1 bg-eat" />
              <span className="flex-1 bg-recover" />
            </div>
          </div>

          <div className="overflow-hidden rounded-[28px] border-2 border-ink bg-white">
            {steps.map(([svc, t, d], i) => {
              const service = SVC[svc]
              return (
                <div key={t} className={`grid min-h-40 grid-cols-[112px_1fr_112px] items-stretch ${i > 0 ? 'border-t-2 border-ink' : ''}`}>
                  <div className={`${service.bg} grid place-items-center`}>
                    <span className="num text-[52px] leading-none">0{i + 1}</span>
                  </div>
                  <div className="flex flex-col justify-center px-8 py-6">
                    <p className="h-display text-[26px]">{t}</p>
                    <p className="mt-2 max-w-lg text-ink-2">{d}</p>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-2 border-l border-line">
                    <service.Icon size={26} strokeWidth={2.4} aria-hidden />
                    <span className="label uppercase">{service.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

const serviceContent = {
  move: {
    title: 'Strength and conditioning you can actually keep up with',
    who: specialists[0],
    items: ['3 to 5 workouts a week, at home or in a gym', 'Video demos for every exercise', 'Weekly check-in and load changes'],
    sample: { head: 'Tuesday · Lower body', rows: ['Goblet squat · 3 × 10', 'Romanian deadlift · 3 × 8'], foot: '45 min' },
    image: 'https://images.unsplash.com/photo-1566568531155-07244e00963d?auto=format&fit=crop&w=500&q=85',
  },
  eat: {
    title: 'Meals built from the food you already eat',
    who: specialists[1],
    items: ['Meal plan with ful, koshari, grilled chicken and more', 'Calories and protein set to your goal', 'Swap any meal, your dietitian re-balances the day'],
    sample: { head: 'Lunch · Grilled chicken with rice', rows: ['150 g chicken, 1 cup rice, green salad', '42 g protein · 68 g carbs · 18 g fat'], foot: '620 kcal' },
    image: 'https://images.unsplash.com/photo-1568625357288-d3b0051abf0e?auto=format&fit=crop&w=500&q=85',
  },
  recover: {
    title: 'Rehab and pain checks, handled by a licensed PT',
    who: specialists[2],
    items: ['Short daily routines for your injured area', 'Pain check-ins reviewed within 24 hours', 'Your trainer sees every change they make'],
    sample: { head: 'Knee mobility', rows: ['Terminal knee extension · 2 × 15', 'Heel slides · 2 × 10'], foot: '10 min' },
    image: 'https://images.unsplash.com/photo-1645005512942-a17817fb7c11?auto=format&fit=crop&w=500&q=85',
  },
}

function Services() {
  const [tab, setTab] = useState<Svc>('move')
  const c = serviceContent[tab]
  const s = SVC[tab]
  return (
    <section id="services" className={`${wrap} py-20 lg:py-28`}>
      <h2 className="h-display text-[40px] max-w-xl">Three services, one plan</h2>
      <div className="mt-8">
        <Tabs
          label="Services"
          value={tab}
          onChange={setTab}
          tabs={(['move', 'eat', 'recover'] as Svc[]).map((id) => {
            const Icon = SVC[id].Icon
            return { id, label: SVC[id].label, icon: <Icon size={18} aria-hidden /> }
          })}
        />
      </div>
      <div className={`mt-6 rounded-[28px] p-6 sm:p-10 lg:min-h-[660px] lg:p-14 grid lg:grid-cols-[1.1fr_1fr] gap-10 transition-colors lg:[&>div:last-child>div]:h-full ${s.bg}`} role="tabpanel">
        <div className="flex flex-col">
          <h3 className="h-display text-[32px] sm:text-[40px] max-w-lg" style={{ letterSpacing: '-0.03em' }}>
            {c.title}
          </h3>
          <div className="mt-6 flex items-center gap-4 bg-white/90 rounded-2xl p-4 max-w-md">
            <Avatar initials={c.who.initials} svc={tab} />
            <div>
              <p className="label text-ink-2 uppercase">Delivered by</p>
              <p className="font-bold">{c.who.name}</p>
              <p className="text-[14px] text-ink-2">{c.who.role}, {c.who.years} years</p>
            </div>
          </div>
          <p className="label uppercase mt-8">What you get</p>
          <ul className="mt-3 space-y-3">
            {c.items.map((i) => (
              <li key={i} className="flex gap-3 font-medium">
                <Check size={22} strokeWidth={3} className="shrink-0 mt-0.5" aria-hidden /> {i}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative">
          <Card className="overflow-hidden">
            <div className="aspect-[16/9] overflow-hidden border-b border-line bg-white">
              <img
                src={c.image}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-opacity"
              />
            </div>
            <div className="p-6">
              <Tag svc={tab}>Sample</Tag>
              <p className="h-display text-[22px] mt-3" style={{ letterSpacing: '-0.02em' }}>
                {c.sample.head}
              </p>
              <ul className="mt-4 divide-y divide-line">
                {c.sample.rows.map((r) => (
                  <li key={r} className="py-3 text-[15px]">
                    {r}
                  </li>
                ))}
              </ul>
              <p className="num text-[32px] mt-2">{c.sample.foot}</p>
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
}

export function SampleWeek() {
  return (
    <div>
      <div className="flex flex-wrap gap-4 mb-5" aria-label="Legend">
        {(['move', 'eat', 'recover'] as Svc[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-2 text-[14px] font-semibold">
            <span className={`size-4 rounded ${SVC[k].bg}`} />
            {SVC[k].label}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto -mx-5 px-5 lg:mx-0 lg:px-0">
        <div className="grid grid-cols-7 gap-3 min-w-[980px] lg:min-w-0">
          {week.map((d) => (
            <div key={d.day} className="bg-white border border-line rounded-2xl p-3 flex flex-col gap-2">
              <p className="num text-[18px] px-1">{d.day}</p>
              {d.blocks.map((b) => (
                <div key={b.text} className={`${SVC[b.svc].bg} rounded-xl p-3 text-[14px] leading-5 font-medium text-ink`}>
                  <span className="label uppercase block mb-1">{SVC[b.svc].label}</span>
                  {b.text}
                  {b.adjusted && (
                    <span className="mt-2 inline-flex items-center gap-1 bg-white rounded-full px-2 h-6 label">
                      <TriangleAlert size={12} aria-hidden /> Adjusted
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Week() {
  return (
    <section className="bg-white">
      <div className={`${wrap} py-20 lg:py-28`}>
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_0.55fr]">
          <div>
            <p className="label uppercase tracking-wider text-ink-2">One plan, always in sync</p>
            <h2 className="h-display mt-4 max-w-2xl text-[40px] lg:text-[52px]">A real week that responds when your body does</h2>
            <p className="mt-5 max-w-2xl text-[18px] leading-7 text-ink-2">
              Every block comes from a different specialist. When Sara's knee hurt on Monday night, Tuesday's plan changed before her next session.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-paper p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-recover-tint text-ink">
                <Check size={22} strokeWidth={3} aria-hidden />
              </span>
              <p className="h-display text-[22px]">One change, shared instantly</p>
            </div>
            <p className="mt-3 text-[15px] leading-6 text-ink-2">The trainer, dietitian, and PT all work from the same live plan.</p>
          </div>
        </div>

        <div className="mt-10 rounded-[28px] border border-line bg-paper p-5 lg:p-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="label uppercase text-ink-2">Sara's coordinated plan</p>
              <p className="h-display mt-1 text-[28px]">This week</p>
            </div>
            <p className="text-[14px] font-semibold text-ink-2">Scroll to see all seven days</p>
          </div>
          <SampleWeek />
        </div>

        <div className="mt-6 overflow-hidden rounded-[28px] border border-line bg-paper lg:grid lg:grid-cols-[0.85fr_1.15fr]" role="note">
          <div className="bg-recover-tint p-6 lg:p-8">
            <Tag svc="recover">PT update</Tag>
            <p className="h-display mt-5 text-[28px]">Tuesday changed before Sara trained</p>
            <p className="mt-3 leading-6 text-ink-2">
              Sara logged knee pain at 4 out of 10. Dr. Mona Fathy changed two exercises and told Coach Karim before the session.
            </p>
          </div>

          <div className="p-6 lg:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="label uppercase text-ink-2">Plan change</p>
                <p className="h-display mt-1 text-[22px]">Lower body session</p>
              </div>
              <SVC.recover.Icon className="shrink-0 text-recover" aria-hidden />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-paper p-4">
                <p className="label uppercase text-ink-2">Before</p>
                <p className="mt-2 font-semibold">Goblet squat · 3 × 10</p>
                <p className="font-semibold">Walking lunge · 3 × 8</p>
              </div>
              <div className="rounded-xl border border-recover bg-recover-tint p-4">
                <p className="label uppercase">Updated by Dr. Mona</p>
                <p className="mt-2 font-semibold">Box squat to 90° · 3 × 8</p>
                <p className="font-semibold">Terminal knee extension · 3 × 12</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Specialists() {
  return (
    <section id="specialists" className={`${wrap} py-20 lg:py-28`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label uppercase tracking-wider text-ink-2 mb-3">Your care team</p>
          <h2 className="h-display text-[40px] max-w-xl">Real specialists, checked and licensed</h2>
          <p className="text-ink-2 mt-4 max-w-2xl">
            Choose the people you trust. Every Rebound specialist is vetted, experienced, and ready to work as one team.
          </p>
        </div>
        <Btn variant="secondary" to="/signup">
          Find yours
        </Btn>
      </div>
      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {specialists.map((s) => (
          <li key={s.id}>
            <Link
              to="/signup"
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white transition duration-300 hover:-translate-y-1 hover:border-ink hover:ring-2 hover:ring-ink focus-visible:-translate-y-1"
              aria-label={`Meet ${s.name}, ${s.role}`}
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-sand">
                <img
                  src={s.photo}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-[1.04] motion-reduce:transition-none"
                />
                <div className="absolute left-4 top-4">
                  <Tag svc={s.svc}>{s.role}</Tag>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="h-display text-[22px] leading-6">{s.name}</p>
                <div className="flex items-center gap-2 mt-2">
                  <StarRating rating={s.rating ?? 4.9} size={15} showValue />
                  <span className="text-[13px] text-ink-2 font-medium">({s.reviewsCount ?? 4} reviews)</span>
                </div>
                <p className="mt-2 text-[15px] text-ink-2 line-clamp-2">{s.cred}</p>
                <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
                  <span className="text-[13px] font-semibold text-ink-2">
                    <strong className="text-ink">{s.clientsCount ?? 120}</strong> clients worked with
                  </span>
                  <span className="inline-flex items-center gap-1 text-[14px] font-bold">
                    Meet {s.name.split(' ')[1]}
                    <ArrowRight size={17} aria-hidden className="transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
                  </span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-col items-start justify-between gap-5 rounded-2xl border-2 border-ink bg-sand p-6 sm:flex-row sm:items-center lg:p-8">
        <div>
          <p className="h-display text-[28px]">And many more specialists</p>
          <p className="mt-2 max-w-2xl text-ink-2">
            Explore trainers, dietitians, and physical therapists matched to your goals, schedule, and language.
          </p>
        </div>
        <Btn to="/signup" className="shrink-0">
          Browse all specialists <ArrowRight size={18} aria-hidden />
        </Btn>
      </div>
    </section>
  )
}

const plans = [
  {
    name: 'Starter',
    price: '399',
    blurb: 'One specialist, one focus.',
    feats: ['Plan from a trainer or dietitian', 'Weekly plan updates', 'In-app messages, replies within 48 h', '1 video check-in a month'],
  },
  {
    name: 'Plus',
    price: '899',
    blurb: 'Training and food together.',
    feats: ['Trainer and dietitian on your plan', 'Meals from Egyptian staples', 'Messages, replies within 24 h', '2 video sessions a month', 'Swap meals any time'],
  },
  {
    name: 'Full Team',
    price: '1,499',
    blurb: 'Trainer, dietitian and physical therapist.',
    feats: ['All three specialists share one plan', 'Pain check-ins reviewed within 24 h', 'Rehab routines with video demos', '4 video sessions a month', 'Change specialists whenever you like'],
    best: true,
  },
]

function Pricing() {
  const [tab, setTab] = useState<'individuals' | 'organizations'>('individuals')

  return (
    <section id="pricing" className="bg-white border-y border-line">
      <div className={`${wrap} py-20 lg:py-28`}>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h2 className="h-display text-[40px]">Transparent, flexible pricing</h2>
            <p className="text-ink-2 mt-2">
              For individuals seeking personal health guidance or organizations sponsoring their teams.
            </p>
          </div>
          {/* Individuals / Organizations Toggle */}
          <div className="inline-flex p-1 rounded-xl bg-paper border border-line self-start md:self-auto">
            <button
              type="button"
              onClick={() => setTab('individuals')}
              className={`px-5 py-2 rounded-lg font-semibold text-sm transition-all ${
                tab === 'individuals'
                  ? 'bg-ink text-white shadow-sm'
                  : 'text-ink-2 hover:text-ink'
              }`}
            >
              For individuals
            </button>
            <button
              type="button"
              onClick={() => setTab('organizations')}
              className={`px-5 py-2 rounded-lg font-semibold text-sm transition-all ${
                tab === 'organizations'
                  ? 'bg-ink text-white shadow-sm'
                  : 'text-ink-2 hover:text-ink'
              }`}
            >
              For organizations
            </button>
          </div>
        </div>

        {tab === 'individuals' ? (
          <div className="grid md:grid-cols-3 gap-5 items-stretch">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`rounded-2xl bg-white p-8 flex flex-col relative ${
                  p.best ? 'border-[3px] border-ink' : 'border border-line'
                }`}
              >
                {p.best && (
                  <span className="absolute -top-4 left-6 bg-ink text-white rounded-full px-4 h-8 inline-flex items-center label">
                    Best for rehab
                  </span>
                )}
                <h3 className="h-display text-[24px]">{p.name}</h3>
                <p className="text-ink-2 mt-1">{p.blurb}</p>
                <p className="mt-6 flex items-baseline gap-2">
                  <span className="num text-[48px] leading-none">{p.price}</span>
                  <span className="font-semibold">EGP / month</span>
                </p>
                <ul className="mt-6 space-y-3 mb-8">
                  {p.feats.map((f) => (
                    <li key={f} className="flex gap-3 text-[15px]">
                      <Check size={20} strokeWidth={3} className="shrink-0 mt-0.5 text-ok" aria-hidden />{' '}
                      {f}
                    </li>
                  ))}
                </ul>
                <Btn
                  variant={p.best ? 'primary' : 'secondary'}
                  to="/signup"
                  className="mt-auto w-full"
                >
                  Choose {p.name}
                </Btn>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8 items-stretch bg-paper rounded-3xl p-8 lg:p-12 border border-line">
            <div className="flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-move bg-move-tint px-3 py-1 rounded-full inline-block mb-4">
                  B2B Wellness & Performance
                </span>
                <h3 className="h-display text-[32px] lg:text-[36px]">
                  Sponsor your team's health
                </h3>
                <p className="text-ink-2 mt-3 text-base leading-relaxed">
                  Bring your own specialists or use ours. Plans scale with your team size, giving employees, athletes, or students dedicated Move, Eat, and Recover support.
                </p>

                <div className="grid sm:grid-cols-2 gap-4 mt-8">
                  <div className="p-4 rounded-xl bg-white border border-line">
                    <strong className="text-ink font-bold text-sm block">Flexible Specialists</strong>
                    <span className="text-xs text-ink-2 mt-1 block">
                      Connect your internal trainers and therapists or grant access to platform specialists.
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-line">
                    <strong className="text-ink font-bold text-sm block">Instant Onboarding</strong>
                    <span className="text-xs text-ink-2 mt-1 block">
                      One unique invite code. Members join without entering credit cards.
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-line">
                    <strong className="text-ink font-bold text-sm block">Privacy-First Analytics</strong>
                    <span className="text-xs text-ink-2 mt-1 block">
                      Track seat utilization and activity aggregates with zero clinical data exposure.
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-line">
                    <strong className="text-ink font-bold text-sm block">Custom Seat Limits</strong>
                    <span className="text-xs text-ink-2 mt-1 block">
                      Scale from 5 to 500+ sponsored member seats with predictable terms.
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-line flex flex-col sm:flex-row items-center gap-4">
                <Btn to="/register-org" className="w-full sm:w-auto px-8">
                  Register your organization <ArrowRight size={18} />
                </Btn>
                <Link
                  to="/join"
                  className="font-semibold text-ink underline underline-offset-4 text-sm"
                >
                  Have an invite code from your team? Join here
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border border-line flex flex-col justify-between shadow-sm">
              <div>
                <span className="label text-ink-2">Annual or Quarterly Sponsoring</span>
                <p className="mt-4 flex items-baseline gap-2">
                  <span className="num text-[44px] leading-none">Custom</span>
                  <span className="text-ink-2 font-medium">per seat / month</span>
                </p>
                <p className="text-xs text-ink-2 mt-2">
                  Invoiced in EGP with dedicated onboarding and specialist assignment support.
                </p>

                <div className="mt-6 pt-6 border-t border-line space-y-3">
                  {[
                    'Your own specialists or platform specialists',
                    'Invite codes for instant zero-payment onboarding',
                    'Members skip payment (fully sponsored)',
                    'Aggregate health dashboard for org admins',
                    '1 to 500 scalable member seats',
                  ].map((feat) => (
                    <div key={feat} className="flex gap-3 text-sm text-ink">
                      <Check size={18} strokeWidth={3} className="shrink-0 mt-0.5 text-ok" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-line text-center">
                <p className="text-xs text-ink-2">
                  Already managing a team?{' '}
                  <Link to="/login" className="font-bold text-ink underline underline-offset-4">
                    Log in as Org Admin
                  </Link>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

const faqs = [
  ['Is this medical advice?', 'No. Our physical therapists give rehab guidance for training, not a diagnosis. If something feels wrong, see a doctor first. We will tell you when that applies.'],
  ['Do I need a gym?', 'No. Most plans work with a pair of dumbbells or a resistance band at home. Tell us what you have and your trainer builds around it.'],
  ['How do sessions work?', 'You book a 30 or 45 minute video call with a specialist. Between sessions you message them and follow your daily plan in the app.'],
  ['Can I switch specialists?', 'Yes, any time and at no cost. Your plan and history stay with you, and the new specialist reads them before your first call.'],
  ['How is my health data used?', 'Only your own specialists see your answers. We do not sell data or share it with gyms or brands. You can export or delete it from settings.'],
]

function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section className={`${wrap} py-20 lg:py-28 grid lg:grid-cols-[1fr_1.6fr] gap-10`}>
      <h2 className="h-display text-[40px]">Questions people ask first</h2>
      <div className="border-t border-line">
        {faqs.map(([q, a], i) => (
          <div key={q} className="border-b border-line">
            <h3>
              <button
                aria-expanded={open === i}
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full min-h-16 py-4 flex items-center justify-between gap-4 text-left font-bold text-[18px] cursor-pointer"
              >
                {q}
                <ChevronDown className={`shrink-0 transition ${open === i ? 'rotate-180' : ''}`} aria-hidden />
              </button>
            </h3>
            {open === i && <p className="pb-5 text-ink-2 max-w-xl">{a}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}

function Closing() {
  return (
    <section className="bg-ink text-white">
      <div className={`${wrap} py-20 lg:py-24 flex flex-col lg:flex-row lg:items-center justify-between gap-8`}>
        <h2 className="h-display text-[40px] lg:text-[56px] max-w-2xl">Ten minutes to your starting plan.</h2>
        <div>
          <Btn variant="inverse" to="/signup" className="h-14 px-8">
            Start free assessment <ArrowRight size={20} aria-hidden />
          </Btn>
          <p className="text-[14px] text-white/70 mt-3">No card needed. Pick specialists after.</p>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  const cols = [
    ['Product', ['How it works', 'Services', 'Pricing']],
    ['Specialists', ['Join as a specialist', 'Our standards', 'Find a specialist']],
    ['Company', ['About', 'Contact', 'Privacy']],
  ] as const
  return (
    <footer className="bg-paper">
      <div className={`${wrap} py-14 grid md:grid-cols-[1.4fr_repeat(3,1fr)] gap-10`}>
        <div>
          <Wordmark />
          <p className="text-ink-2 mt-3 max-w-xs text-[15px]">Training, food and rehab on one plan. Made in Cairo.</p>
        </div>
        {cols.map(([h, ls]) => (
          <div key={h}>
            <p className="font-bold">{h}</p>
            <ul className="mt-3 space-y-1">
              {ls.map((l) => (
                <li key={l}>
                  <a href="#" className="text-ink-2 hover:text-ink min-h-11 inline-flex items-center">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className={`${wrap} pb-10`}>
        <p className="text-[14px] text-ink-2 border-t border-line pt-6 max-w-3xl">
          Rebound offers coaching and education, not medical diagnosis or treatment. Talk to your doctor before starting a new program, especially after an injury or if you have a medical condition.
        </p>
      </div>
    </footer>
  )
}

export default function Landing() {
  return (
    <div>
      <Header />
      <main>
        <Hero />
        <How />
        <Services />
        <Week />
        <Specialists />
        <Pricing />
        <Faq />
        <Closing />
      </main>
      <Footer />
    </div>
  )
}
