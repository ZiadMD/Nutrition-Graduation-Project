import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Check, Circle } from 'lucide-react'
import { Btn, Field, PasswordInput, inputCls, Wordmark, SVC } from '../ui'
import type { Svc } from '../data'

function AuthLayout({ children }: { children: ReactNode }) {
  const serviceText = {
    move: 'text-move',
    eat: 'text-eat',
    recover: 'text-recover',
  } as const
  const bands: [Svc, string, string][] = [
    ['move', 'Workouts that fit your week.', 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=900&q=85'],
    ['eat', 'Meals made from real Egyptian food.', 'https://images.unsplash.com/photo-1568625357288-d3b0051abf0e?auto=format&fit=crop&w=700&q=85'],
    ['recover', 'Rehab your trainer can see.', 'https://images.unsplash.com/photo-1645005512942-a17817fb7c11?auto=format&fit=crop&w=700&q=85'],
  ]
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col" aria-hidden>
        {bands.map(([k, t, image]) => {
          const s = SVC[k]
          return (
            <div key={k} className="relative flex flex-1 flex-col justify-end overflow-hidden bg-ink p-8 xl:p-12">
              <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-ink/75" />
              <div className={`relative ${serviceText[k]}`}>
                <s.Icon size={32} strokeWidth={2.4} />
                <p className="h-display mt-3 text-[40px] xl:text-[56px]">{s.label}</p>
                <p className="mt-1 font-bold xl:text-[18px]">{t}</p>
              </div>
              <div className="pointer-events-none absolute inset-0 bg-ink/15" />
            </div>
          )
        })}
      </div>
      <div className="flex h-3 lg:hidden" aria-hidden>
        {bands.map(([k]) => (
          <span key={k} className={`flex-1 ${SVC[k].bg}`} />
        ))}
      </div>
      <main className="flex flex-col px-5 sm:px-12 py-8 lg:py-12">
        <Link to="/" aria-label="Rebound home">
          <Wordmark />
        </Link>
        <div className="flex-1 flex items-center">
          <div className="w-full max-w-[440px] mx-auto py-10">{children}</div>
        </div>
      </main>
    </div>
  )
}

import { api, ApiError } from '../api'

const emailOk = (v: string) => /^\S+@\S+\.\S+$/.test(v)

export function Login() {
  const nav = useNavigate()
  const [f, setF] = useState({ email: '', password: '' })
  const [err, setErr] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const validate = (x = f) => ({
    email: !x.email ? 'Enter your email.' : !emailOk(x.email) ? 'That email looks incomplete. Try name@example.com.' : '',
    password: !x.password ? 'Enter your password.' : '',
  })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const v = validate()
    setErr(v)
    if (v.email || v.password) return

    setLoading(true)
    try {
      const res = await api.login(f.email, f.password)
      const user = res.user
      if (user.role === 'admin') {
        nav('/app/overview')
      } else if (user.role === 'specialist') {
        nav('/app/today')
      } else {
        if (user.onboardingCompleted === false) {
          nav('/onboarding')
        } else {
          nav('/app/today')
        }
      }
    } catch (error: any) {
      setErr({
        password: error?.message || 'Login failed. Check your email and password.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <h1 className="h-display text-[32px]">Welcome back</h1>
      <p className="text-ink-2 mt-2">Log in to see today's plan.</p>
      <form onSubmit={submit} noValidate className="mt-8 space-y-5">
        <Field label="Email" error={err.email}>
          {(p) => (
            <input {...p} type="email" autoComplete="email" className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} onBlur={() => setErr({ ...err, email: validate().email })} />
          )}
        </Field>
        <Field label="Password" error={err.password}>
          {(p) => <PasswordInput {...p} autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />}
        </Field>
        <div className="flex justify-end -mt-2">
          <a href="#" className="font-semibold underline underline-offset-4 min-h-11 inline-flex items-center">
            Forgot password?
          </a>
        </div>
        <Btn type="submit" className="w-full" disabled={loading}>
          {loading ? 'Logging in...' : 'Log in'}
        </Btn>
      </form>
      <p className="mt-8 text-ink-2">
        New to Rebound?{' '}
        <Link to="/signup" className="font-bold text-ink underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}

export function Signup() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const specialist = params.get('role') === 'specialist'
  const [f, setF] = useState({ name: '', email: '', password: '', profession: '' })
  const [err, setErr] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const rules = [
    ['At least 8 characters', f.password.length >= 8],
    ['One number', /\d/.test(f.password)],
    ['One letter', /[a-zA-Z]/.test(f.password)],
  ] as const

  const validate = () => ({
    name: f.name.trim().length < 2 ? 'Enter your full name.' : '',
    email: !emailOk(f.email) ? 'Enter a valid email, like name@example.com.' : '',
    password: rules.every((r) => r[1]) ? '' : 'Your password needs to meet all three rules below.',
    profession: specialist && !f.profession ? 'Choose your profession.' : '',
  })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const v = validate()
    setErr(v)
    if (Object.values(v).some(Boolean)) return

    setLoading(true)
    try {
      if (specialist) {
        const typeMap: Record<string, string> = {
          Trainer: 'trainer',
          Dietitian: 'nutritionist',
          'Physical therapist': 'physical_therapist',
        }
        await api.register({
          name: f.name.trim(),
          email: f.email.trim(),
          password: f.password,
          role: 'specialist',
          type: typeMap[f.profession] || 'trainer',
          credentials: `${f.profession}, Cairo University`,
        })
        nav('/app/today')
      } else {
        await api.register({
          name: f.name.trim(),
          email: f.email.trim(),
          password: f.password,
          role: 'client',
        })
        nav('/onboarding')
      }
    } catch (error: any) {
      if (error?.code === 'EMAIL_IN_USE') {
        setErr({ email: 'This email is already registered. Try logging in.' })
      } else {
        setErr({ password: error?.message || 'Failed to create account.' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <h1 className="h-display text-[32px]">{specialist ? 'Join as a specialist' : 'Create your account'}</h1>
      <p className="text-ink-2 mt-2">{specialist ? 'Trainers, dietitians and physical therapists. We verify your license before you go live.' : 'Free to start. Pick specialists after your assessment.'}</p>
      <form onSubmit={submit} noValidate className="mt-8 space-y-5">
        <Field label="Full name" error={err.name}>
          {(p) => <input {...p} autoComplete="name" className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}
        </Field>
        {specialist && (
          <Field label="Profession" helper="You will upload your license later." error={err.profession}>
            {(p) => (
              <select {...p} className={inputCls} value={f.profession} onChange={(e) => setF({ ...f, profession: e.target.value })}>
                <option value="">Choose one</option>
                <option>Trainer</option>
                <option>Dietitian</option>
                <option>Physical therapist</option>
              </select>
            )}
          </Field>
        )}
        <Field label="Email" error={err.email}>
          {(p) => <input {...p} type="email" autoComplete="email" className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}
        </Field>
        <div>
          <Field label="Password" error={err.password}>
            {(p) => <PasswordInput {...p} autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />}
          </Field>
          <ul className="-mt-1 space-y-1" aria-label="Password rules">
            {rules.map(([t, ok]) => (
              <li key={t} className={`flex items-center gap-2 text-[14px] ${ok ? 'text-[#1d6b3d] font-semibold' : 'text-ink-2'}`}>
                {ok ? <Check size={16} strokeWidth={3} aria-hidden /> : <Circle size={16} aria-hidden />}
                {t}
                <span className="sr-only">{ok ? ', done' : ', not yet'}</span>
              </li>
            ))}
          </ul>
        </div>
        <Btn type="submit" className="w-full" disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </Btn>
      </form>
      <div className="mt-8 space-y-1 text-ink-2">
        <p>
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-ink underline underline-offset-4">
            Log in
          </Link>
        </p>
        <p>
          {specialist ? (
            <Link to="/signup" className="font-bold text-ink underline underline-offset-4">
              Sign up as a client instead
            </Link>
          ) : (
            <Link to="/signup?role=specialist" className="font-bold text-ink underline underline-offset-4">
              Join as a specialist
            </Link>
          )}
        </p>
      </div>
    </AuthLayout>
  )
}
