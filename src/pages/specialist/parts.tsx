import { ArrowDown, ArrowUp, Minus, TriangleAlert, CircleCheck } from 'lucide-react'
import { painTrend, overLimit, type Client } from '../../data'

export function PainTrend({ c }: { c: any }) {
  const t = c.painTrend || painTrend(c)
  const I = t.dir === 'up' ? ArrowUp : t.dir === 'down' ? ArrowDown : Minus
  const cls = t.dir === 'up' ? 'text-[#a02a2a]' : t.dir === 'down' ? 'text-[#1d6b3d]' : 'text-ink-2'
  const word = t.dir === 'up' ? `up ${t.delta}` : t.dir === 'down' ? `down ${-t.delta}` : 'no change'
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={`Pain ${t.now} out of 10, ${word} since last week`}>
      <I size={16} className={cls} aria-hidden />
      <span className="num text-[18px]">{t.now}</span>
      <span className={`text-[13px] font-semibold ${cls}`}>{word}</span>
    </span>
  )
}

export function Flag({ c }: { c: any }) {
  const isOver = c.flagged !== undefined ? c.flagged : overLimit(c)
  return isOver ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-bad-tint text-[#a02a2a] px-3 h-8 font-bold text-[14px] whitespace-nowrap">
      <TriangleAlert size={16} aria-hidden /> Above safe limit
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-tint text-[#1d6b3d] px-3 h-8 font-bold text-[14px] whitespace-nowrap">
      <CircleCheck size={16} aria-hidden /> Within limit
    </span>
  )
}
