import type { ReactNode } from 'react'

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
