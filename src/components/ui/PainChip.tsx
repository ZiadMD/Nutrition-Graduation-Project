import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react'

export function PainChip({ n }: { n: number }) {
  const c =
    n <= 3
      ? ['bg-ok-tint text-[#1d6b3d]', CircleCheck, 'Mild']
      : n <= 6
      ? ['bg-warn-tint text-[#7a5200]', TriangleAlert, 'Moderate']
      : ['bg-bad-tint text-[#a02a2a]', CircleAlert, 'Severe']
  const I = c[1] as typeof CircleCheck
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 h-9 font-bold text-[14px] whitespace-nowrap ${c[0]}`}>
      <I size={16} aria-hidden />
      <span className="num">{n}</span>/10 · {c[2] as string}
    </span>
  )
}
