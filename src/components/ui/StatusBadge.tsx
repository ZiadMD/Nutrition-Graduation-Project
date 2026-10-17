import { CircleCheck, Clock, Ban } from 'lucide-react'

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
