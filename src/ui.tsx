import { Link, useNavigate } from 'react-router'
import { type ComponentProps, type ReactNode, useId, useState } from 'react'
import {
  Dumbbell,
  Utensils,
  HeartPulse,
  TriangleAlert,
  Eye,
  EyeOff,
  CircleAlert,
  Inbox,
  RefreshCw,
} from 'lucide-react'
import type { Svc } from './data'

export const SVC = {
  move: { label: 'Move', bg: 'bg-move', tint: 'bg-move-tint', Icon: Dumbbell, hex: '#FF6A3D' },
  eat: { label: 'Eat', bg: 'bg-eat', tint: 'bg-eat-tint', Icon: Utensils, hex: '#FFC93C' },
  recover: { label: 'Recover', bg: 'bg-recover', tint: 'bg-recover-tint', Icon: HeartPulse, hex: '#3DB7A5' },
} as const

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="flex gap-[3px] items-end h-6" aria-hidden>
        <span className="w-[7px] h-6 rounded-full bg-move" />
        <span className="w-[7px] h-4 rounded-full bg-eat" />
        <span className="w-[7px] h-5 rounded-full bg-recover" />
      </span>
      <span className="h-display text-[22px] tracking-tight" style={{ letterSpacing: '-0.04em' }}>
        Rebound
      </span>
    </span>
  )
}

const variants = {
  primary: 'bg-ink text-white hover:bg-[#2a2e35]',
  secondary: 'bg-white text-ink border border-ink/20 hover:border-ink',
  inverse: 'bg-white text-ink hover:bg-eat-tint',
  ghost: 'text-ink hover:bg-ink/5',
}

type BtnProps = {
  variant?: keyof typeof variants
  to?: string
  className?: string
  children: ReactNode
} & Omit<ComponentProps<'button'>, 'className' | 'children'>

export function Btn({ variant = 'primary', to, className = '', children, ...rest }: BtnProps) {
  const cls = `inline-flex items-center justify-center gap-2 min-h-12 px-6 rounded-xl font-bold text-[16px] transition active:scale-[.98] cursor-pointer disabled:opacity-50 ${variants[variant]} ${className}`
  if (to)
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    )
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  )
}

export function Tag({ svc, children }: { svc: Svc; children?: ReactNode }) {
  const s = SVC[svc]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 h-8 label ${s.tint} text-ink`}>
      <s.Icon size={14} strokeWidth={2.4} aria-hidden />
      {children ?? s.label}
    </span>
  )
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`bg-white border border-line rounded-2xl ${className}`}>{children}</div>
}

export function Avatar({ initials, svc, size = 56 }: { initials: string; svc: Svc; size?: number }) {
  return (
    <span
      className={`shrink-0 grid place-items-center rounded-2xl font-display font-extrabold text-ink ${SVC[svc].tint}`}
      style={{ width: size, height: size, fontSize: size * 0.34 }}
      aria-hidden
    >
      {initials}
    </span>
  )
}

export const inputCls =
  'w-full h-12 rounded-xl border border-ink/25 bg-white px-4 text-[16px] placeholder:text-ink-2/70 focus:border-ink aria-[invalid=true]:border-bad aria-[invalid=true]:border-2'

export function Field({
  label,
  helper,
  error,
  children,
}: {
  label: string
  helper?: string
  error?: string
  children: ReactNode | ((p: { id: string; 'aria-describedby': string; 'aria-invalid': boolean }) => ReactNode)
}) {
  const id = useId()
  const d = `${id}-d`
  return (
    <div>
      <label htmlFor={id} className="block text-[14px] font-semibold mb-2">
        {label}
      </label>
      {typeof children === 'function' ? children({ id, 'aria-describedby': d, 'aria-invalid': !!error }) : children}
      {(error || helper) && (
        <p id={d} className={`mt-2 text-[14px] leading-5 ${error ? 'text-[#a02a2a] font-semibold flex gap-1.5 items-start' : 'text-ink-2'}`}>
          {error ? (
            <>
              <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
              {error}
            </>
          ) : (
            helper
          )}
        </p>
      )}
    </div>
  )
}

export function PasswordInput(props: ComponentProps<'input'>) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className={`${inputCls} pr-14`} />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-1 top-1 size-11 grid place-items-center rounded-lg text-ink-2 hover:text-ink cursor-pointer"
      >
        {show ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  )
}

export function SafetyCallout({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div role="note" className={`flex gap-3 rounded-2xl bg-warn-tint border border-warn/60 p-4 ${className}`}>
      <TriangleAlert className="shrink-0 text-[#9a6700] mt-0.5" size={22} aria-hidden />
      <div>
        <p className="font-bold text-[16px]">{title}</p>
        <p className="text-[15px] leading-6 text-ink mt-0.5">{children}</p>
      </div>
    </div>
  )
}

export function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-11 px-4 rounded-full border font-semibold text-[15px] transition cursor-pointer inline-flex items-center gap-2 ${
        selected ? 'bg-ink text-white border-ink' : 'bg-white border-ink/25 hover:border-ink'
      }`}
    >
      {selected && <Check size={16} strokeWidth={3} aria-hidden />}
      {children}
    </button>
  )
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { id: T; label: string; icon?: ReactNode }[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex flex-wrap gap-1 p-1 rounded-2xl bg-white border border-line">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`min-h-11 px-5 rounded-xl font-bold text-[15px] inline-flex items-center gap-2 cursor-pointer transition ${
            value === t.id ? 'bg-ink text-white' : 'text-ink hover:bg-ink/5'
          }`}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[#ece8e0] rounded-xl ${className}`} aria-hidden />
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="text-center py-12 px-6">
      <span className="mx-auto size-14 rounded-2xl bg-sand grid place-items-center mb-4">
        <Inbox size={26} aria-hidden />
      </span>
      <p className="h-display text-[22px]">{title}</p>
      <p className="text-ink-2 mt-2 max-w-sm mx-auto">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ onRetry, title = 'We could not load this', text = 'Check your connection and try again. Nothing was lost.' }: { onRetry: () => void; title?: string; text?: string }) {
  return (
    <div role="alert" className="text-center py-12 px-6">
      <span className="mx-auto size-14 rounded-2xl bg-bad-tint grid place-items-center mb-4">
        <CircleAlert size={26} className="text-bad" aria-hidden />
      </span>
      <p className="h-display text-[22px]">{title}</p>
      <p className="text-ink-2 mt-2 max-w-sm mx-auto">{text}</p>
      <div className="mt-5">
        <Btn variant="secondary" onClick={onRetry}>
          <RefreshCw size={18} aria-hidden /> Try again
        </Btn>
      </div>
    </div>
  )
}

export type DemoState = 'loaded' | 'loading' | 'empty' | 'error'

export function StateSwitcher({ value, onChange }: { value: DemoState; onChange: (v: DemoState) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-[14px] text-ink-2">
      Preview state
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as DemoState)}
        className="h-11 rounded-xl border border-ink/25 bg-white px-3 text-ink font-semibold"
      >
        <option value="loaded">Loaded</option>
        <option value="loading">Loading</option>
        <option value="empty">Empty</option>
        <option value="error">Error</option>
      </select>
    </label>
  )
}

export function Kettlebell({ className = '', fill = '#14161A', accent = '#fff' }: { className?: string; fill?: string; accent?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <path d="M32 58a28 28 0 0 1 56 0H76a16 16 0 0 0-32 0z" fill={fill} />
      <circle cx="60" cy="78" r="34" fill={fill} />
      <circle cx="48" cy="70" r="7" fill={accent} opacity=".9" />
    </svg>
  )
}

export function Bowl({ className = '', fill = '#14161A', accent = '#fff' }: { className?: string; fill?: string; accent?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <circle cx="44" cy="50" r="16" fill={accent} />
      <circle cx="68" cy="42" r="14" fill={accent} opacity=".7" />
      <circle cx="84" cy="54" r="12" fill={accent} opacity=".9" />
      <path d="M10 62h100a50 50 0 0 1-100 0z" fill={fill} />
      <rect x="38" y="104" width="44" height="8" rx="4" fill={fill} />
    </svg>
  )
}

export function Roller({ className = '', fill = '#14161A', accent = '#fff' }: { className?: string; fill?: string; accent?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <rect x="8" y="34" width="104" height="52" rx="26" fill={fill} />
      <circle cx="86" cy="60" r="16" fill={accent} opacity=".9" />
      <rect x="30" y="46" width="30" height="8" rx="4" fill={accent} opacity=".5" />
    </svg>
  )
}

export function SpecialistCard({ s, cta = 'View profile' }: { s: (typeof import('./data'))['specialists'][number]; cta?: string }) {
  const sv = SVC[s.svc]
  return (
    <Card className="p-6 flex flex-col h-full">
      <div className="flex items-start gap-4">
        <Avatar initials={s.initials} svc={s.svc} size={64} />
        <div className="min-w-0">
          <Tag svc={s.svc}>{s.role}</Tag>
          <p className="h-display text-[20px] mt-2 leading-6" style={{ letterSpacing: '-0.02em' }}>
            {s.name}
          </p>
        </div>
      </div>
      <p className="text-ink-2 mt-4 text-[15px]">{s.cred}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-[14px]">
        <div>
          <dt className="text-ink-2">Experience</dt>
          <dd className="font-semibold">{s.years} years</dd>
        </div>
        <div>
          <dt className="text-ink-2">Languages</dt>
          <dd className="font-semibold">{s.langs}</dd>
        </div>
      </dl>
      <div className={`mt-5 rounded-xl px-4 py-3 flex items-baseline justify-between ${sv.tint}`}>
        <span className="num text-[24px]">{s.rate} EGP</span>
        <span className="text-[14px]">per session</span>
      </div>
      <Btn variant="secondary" className="mt-5 w-full" to="/app/specialists">
        {cta}
      </Btn>
    </Card>
  )
}

/* ---- shared app helpers ---- */
import { useEffect } from 'react'
import { CircleCheck, Clock, Ban, X, Check } from 'lucide-react'

export function Gate({ state, skeleton, empty, retry, children }: { state: DemoState; skeleton: ReactNode; empty: ReactNode; retry: () => void; children: ReactNode }) {
  if (state === 'loading') return <div aria-busy="true" aria-label="Loading">{skeleton}</div>
  if (state === 'empty') return <>{empty}</>
  if (state === 'error') return <ErrorState onRetry={retry} />
  return <>{children}</>
}

export function PageHead({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h2 className="h-display text-[24px] lg:text-[28px]" style={{ letterSpacing: '-0.02em' }}>
          {title}
        </h2>
        {sub && <p className="text-ink-2 mt-1">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatusBadge({ status }: { status: 'Confirmed' | 'Completed' | 'Cancelled' }) {
  const m = {
    Confirmed: [CircleCheck, 'bg-ok-tint text-[#1d6b3d]'],
    Completed: [Clock, 'bg-sand text-ink'],
    Cancelled: [Ban, 'bg-bad-tint text-[#a02a2a]'],
  } as const
  const [I, c] = m[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 h-8 font-bold text-[14px] ${c}`}>
      <I size={16} aria-hidden /> {status}
    </span>
  )
}

export function Dialog({ open, onClose, title, children, side = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; side?: boolean }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className={`fixed inset-0 z-50 bg-ink/40 flex ${side ? 'justify-end' : 'items-center justify-center p-5'}`} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`bg-white shadow-[0_16px_48px_rgba(20,22,26,0.25)] overflow-y-auto ${side ? 'w-full max-w-[440px] h-full p-6' : 'rounded-2xl p-6 max-w-md w-full max-h-full'}`}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="h-display text-[24px]" style={{ letterSpacing: '-0.02em' }}>
            {title}
          </h2>
          <button onClick={onClose} aria-label="Close" className="size-11 -mt-2 -mr-2 grid place-items-center rounded-xl hover:bg-ink/5 cursor-pointer shrink-0">
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Segment({ options, value, onChange, label }: { options: string[]; value: string; onChange: (v: string) => void; label: string }) {
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

export function PainChip({ n }: { n: number }) {
  const c = n <= 3 ? ['bg-ok-tint text-[#1d6b3d]', CircleCheck, 'Mild'] : n <= 6 ? ['bg-warn-tint text-[#7a5200]', TriangleAlert, 'Moderate'] : ['bg-bad-tint text-[#a02a2a]', CircleAlert, 'Severe']
  const I = c[1] as typeof CircleCheck
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 h-9 font-bold text-[14px] whitespace-nowrap ${c[0]}`}>
      <I size={16} aria-hidden />
      <span className="num">{n}</span>/10 · {c[2] as string}
    </span>
  )
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="bg-white border border-line rounded-2xl p-4 space-y-3" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="size-11 !rounded-full shrink-0" />
          <Skeleton className="h-5 flex-1" />
          <Skeleton className="h-5 w-1/4 hidden md:block" />
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  )
}

export function NotFoundState({ home = '/', homeLabel = 'Back home', full = false }: { home?: string; homeLabel?: string; full?: boolean }) {
  const go = useNavigate()
  return (
    <div className={`text-center px-6 ${full ? 'min-h-screen grid place-items-center' : 'py-16'}`}>
      <div>
        <p className="num text-[88px] sm:text-[120px] leading-none">404</p>
        <h1 className="h-display text-[26px] mt-4">We can't find that page</h1>
        <p className="text-ink-2 mt-2 max-w-sm mx-auto">The link may be old, or the page may have moved. Go back, or start from the home page.</p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Btn variant="secondary" onClick={() => go(-1)}>Go back</Btn>
          <Btn to={home}>{homeLabel}</Btn>
        </div>
      </div>
    </div>
  )
}
