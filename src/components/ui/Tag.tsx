import type { ReactNode } from 'react'
import type { Svc } from '../../data'
import { SVC } from '../constants'

export function Tag({ svc, children }: { svc?: Svc; children?: ReactNode }) {
  const s = (svc && SVC[svc]) || SVC.move
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 h-8 label ${s.tint} text-ink`}>
      <s.Icon size={14} strokeWidth={2.4} aria-hidden />
      {children ?? s.label}
    </span>
  )
}
