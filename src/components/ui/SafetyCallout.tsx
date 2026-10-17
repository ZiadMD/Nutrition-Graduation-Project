import type { ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'

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
