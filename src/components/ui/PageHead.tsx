import type { ReactNode } from 'react'

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
