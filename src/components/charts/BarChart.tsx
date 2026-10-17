import { H, pad, useWidth } from './chartUtils'

export type BarChartProps = {
  labels: string[]
  data: number[]
  target: number
}

export function BarChart({ labels, data, target }: BarChartProps) {
  const [ref, w] = useWidth()
  const n = data.length
  const max = 6
  const y = (v: number) => pad.t + ((max - v) / max) * (H - pad.t - pad.b)
  const slot = (w - pad.l - pad.r) / n
  const bw = Math.min(36, slot * 0.6)
  const cx = (i: number) => pad.l + slot * i + slot / 2
  const every = w < 420 ? Math.ceil(n / 3) : w < 600 ? Math.ceil(n / 5) : Math.ceil(n / 7)

  return (
    <div ref={ref} className="w-full">
      <svg width={w} height={H} role="img" aria-label={`Workouts per week, target ${target}. Latest week: ${data[n - 1] ?? 0}.`}>
        <g fontSize="12" fill="#5B616B">
          {[0, 2, 4, 6].map((t) => (
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
              <text key={l + i} x={cx(i)} y={H - 10} textAnchor="middle">
                {l}
              </text>
            ) : null
          )}
        </g>
        {data.map((v, i) => (
          <g key={i}>
            <rect x={cx(i) - bw / 2} y={y(v)} width={bw} height={y(0) - y(v)} rx="4" fill="#FF6A3D" />
            {(n <= 8 || i === n - 1) && (
              <text x={cx(i)} y={y(v) - 6} textAnchor="middle" fontSize="12" fontWeight="700" fill="#14161A">
                {v}
              </text>
            )}
          </g>
        ))}
        <line x1={pad.l} x2={w - pad.r} y1={y(target)} y2={y(target)} stroke="#14161A" strokeDasharray="5 4" strokeWidth="1.5" />
        <text x={w - pad.r + 6} y={y(target) + 4} fontSize="13" fontWeight="800" fill="#14161A">
          Target {target}
        </text>
      </svg>
    </div>
  )
}
