import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

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
