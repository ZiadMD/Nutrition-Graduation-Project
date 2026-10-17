import { Axes, H, pad, useWidth } from './chartUtils'

export type LineChartProps = {
  labels: string[]
  data: number[]
  min: number
  max: number
  ticks: number[]
  unit: string
  desc: string
  color: string
  safeBelow?: number
}

export function LineChart({
  labels,
  data,
  min,
  max,
  ticks,
  unit,
  desc,
  color,
  safeBelow,
}: LineChartProps) {
  const [ref, w] = useWidth()
  const n = data.length
  const x = (i: number) => pad.l + (n === 1 ? 0 : (i * (w - pad.l - pad.r)) / (n - 1))
  const y = (v: number) => pad.t + ((max - v) / (max - min)) * (H - pad.t - pad.b)
  const pts = data.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const last = data.length - 1

  return (
    <div ref={ref} className="w-full">
      <svg width={w} height={H} role="img" aria-label={desc}>
        {safeBelow !== undefined && (
          <g>
            <rect
              x={pad.l}
              y={y(safeBelow)}
              width={w - pad.l - pad.r}
              height={y(min) - y(safeBelow)}
              fill="#D9F2EE"
            />
            <text x={pad.l + 8} y={y(safeBelow) + 16} fontSize="12" fontWeight="700" fill="#14161A">
              Safe zone: {safeBelow} or below
            </text>
          </g>
        )}
        <Axes w={w} labels={labels} ticks={ticks} y={y} n={n} />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((v, i) =>
          i === 0 || i === last ? (
            <circle key={i} cx={x(i)} cy={y(v)} r="5" fill={color} stroke="#fff" strokeWidth="2" />
          ) : null
        )}
        {data.length > 0 && (
          <>
            <text x={x(0)} y={y(data[0]) - 12} fontSize="13" fontWeight="700" fill="#14161A" textAnchor="start">
              {data[0]} {unit}
            </text>
            <text x={x(last) + 10} y={y(data[last]) + 4} fontSize="14" fontWeight="800" fill="#14161A">
              {data[last]} {unit}
            </text>
          </>
        )}
      </svg>
    </div>
  )
}
