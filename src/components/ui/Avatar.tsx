import type { Svc } from '../../data'
import { SVC } from '../constants'

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
