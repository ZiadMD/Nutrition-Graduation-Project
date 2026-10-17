import { Dumbbell, Utensils, HeartPulse } from 'lucide-react'
import type { Svc } from '../data'

export const SVC = {
  move: { label: 'Move', bg: 'bg-move', tint: 'bg-move-tint', Icon: Dumbbell, hex: '#FF6A3D' },
  eat: { label: 'Eat', bg: 'bg-eat', tint: 'bg-eat-tint', Icon: Utensils, hex: '#FFC93C' },
  recover: { label: 'Recover', bg: 'bg-recover', tint: 'bg-recover-tint', Icon: HeartPulse, hex: '#3DB7A5' },
} as const

export const inputCls =
  'w-full h-12 rounded-xl border border-ink/25 bg-white px-4 text-[16px] placeholder:text-ink-2/70 focus:border-ink aria-[invalid=true]:border-bad aria-[invalid=true]:border-2'
