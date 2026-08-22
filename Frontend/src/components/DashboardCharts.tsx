type ChartPoint = {
  label: string
  value: number
  hint?: string
}

type MixSlice = {
  label: string
  value: number
  color: string
}

const W = 640
const H = 220
const PAD = { top: 16, right: 12, bottom: 36, left: 8 }

function plotBox() {
  return {
    x: PAD.left,
    y: PAD.top,
    w: W - PAD.left - PAD.right,
    h: H - PAD.top - PAD.bottom,
  }
}

function scaleY(values: number[], plotH: number) {
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const range = max - min || 1
  return {
    min,
    max,
    y: (v: number) => PAD.top + plotH - ((v - min) / range) * plotH,
    zeroY: PAD.top + plotH - ((0 - min) / range) * plotH,
  }
}

export function LineTrendChart({
  points,
  color = 'var(--accent)',
}: {
  points: ChartPoint[]
  color?: string
}) {
  if (!points.length) return <p className="muted">No data yet.</p>

  const box = plotBox()
  const values = points.map((p) => p.value)
  const { y } = scaleY(values, box.h)
  const step = points.length === 1 ? 0 : box.w / (points.length - 1)
  const coords = points.map((p, i) => ({
    x: box.x + i * step,
    y: y(p.value),
    point: p,
  }))
  const line = coords.map((c) => `${c.x},${c.y}`).join(' ')
  const area = `${box.x},${y(0)} ${line} ${coords[coords.length - 1].x},${y(0)}`
  const labelEvery = Math.max(1, Math.ceil(points.length / 7))

  return (
    <svg className="dash-chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Profit trend">
      <defs>
        <linearGradient id="dash-line-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon fill="url(#dash-line-fill)" points={area} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={line}
      />
      {coords.map((c, i) => (
        <g key={c.point.label}>
          <circle cx={c.x} cy={c.y} r="3.5" fill={color} />
          <title>{c.point.hint || `${c.point.label}: ${c.point.value}`}</title>
          {i % labelEvery === 0 || i === coords.length - 1 ? (
            <text x={c.x} y={H - 10} textAnchor="middle" className="dash-chart-label">
              {c.point.label}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  )
}

export function BarTrendChart({
  bars,
  color = 'var(--accent)',
  negativeColor = 'var(--danger)',
}: {
  bars: ChartPoint[]
  color?: string
  negativeColor?: string
}) {
  if (!bars.length) return <p className="muted">No data yet.</p>

  const box = plotBox()
  const values = bars.map((p) => p.value)
  const { y, zeroY } = scaleY(values, box.h)
  const gap = 10
  const barW = Math.max(8, (box.w - gap * bars.length) / bars.length)

  return (
    <svg className="dash-chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Monthly profit">
      <line
        x1={box.x}
        x2={box.x + box.w}
        y1={zeroY}
        y2={zeroY}
        stroke="var(--border-strong)"
        strokeWidth="1"
      />
      {bars.map((bar, i) => {
        const x = box.x + i * (barW + gap) + gap / 2
        const top = Math.min(y(bar.value), zeroY)
        const height = Math.max(2, Math.abs(y(bar.value) - zeroY))
        return (
          <g key={bar.label}>
            <rect
              x={x}
              y={top}
              width={barW}
              height={height}
              rx="5"
              fill={bar.value < 0 ? negativeColor : color}
            />
            <title>{bar.hint || `${bar.label}: ${bar.value}`}</title>
            <text x={x + barW / 2} y={H - 10} textAnchor="middle" className="dash-chart-label">
              {bar.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function MixBars({ slices }: { slices: MixSlice[] }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0)
  if (!total) return <p className="muted">No fuel litres recorded this month.</p>

  return (
    <div className="dash-mix">
      <div className="dash-mix-track" aria-hidden="true">
        {slices.map((slice) => (
          <span
            key={slice.label}
            className="dash-mix-seg"
            style={{ width: `${(slice.value / total) * 100}%`, background: slice.color }}
          />
        ))}
      </div>
      <ul className="dash-mix-legend">
        {slices.map((slice) => (
          <li key={slice.label}>
            <span className="dash-mix-dot" style={{ background: slice.color }} />
            <span>{slice.label}</span>
            <strong>
              {slice.value.toLocaleString('en-IN', { maximumFractionDigits: 1 })} L
            </strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

export const FUEL_COLORS = [
  '#ea580c',
  '#0c4a6e',
  '#16a34a',
  '#7c3aed',
  '#ca8a04',
  '#db2777',
  '#0891b2',
]
