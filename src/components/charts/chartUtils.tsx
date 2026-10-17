import { useEffect, useRef, useState } from 'react'

export function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(600)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.floor(e.contentRect.width))))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

export const H = 240
export const pad = { l: 40, r: 56, t: 16, b: 32 }

export function Axes({
  w,
  labels,
  ticks,
  y,
  n,
}: {
  w: number
  labels: string[]
  ticks: number[]
  y: (v: number) => number
  n: number
}) {
  const x = (i: number) => pad.l + (n === 1 ? 0 : (i * (w - pad.l - pad.r)) / (n - 1))
  const every = w < 420 ? Math.ceil(n / 3) : w < 600 ? Math.ceil(n / 5) : Math.ceil(n / 7)
  return (
    <g fontSize="12" fill="#5B616B">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="#E6E2DA" />
          <text x={pad.l - 8} y={y(t) + 4} textAnchor="end">
            {t}
          </text>
        </g>
      ))}
      <line x1={pad.l} x2={w - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="#14161A" />
      {labels.map((l, i) =>
        (n - 1 - i) % every === 0 ? (
          <text key={l} x={x(i)} y={H - 10} textAnchor="middle">
            {l}
          </text>
        ) : null
      )}
    </g>
  )
}
