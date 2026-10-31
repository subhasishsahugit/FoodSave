import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChartColumn,
  ChartPie,
  CircleDot,
  ScatterChart as ScatterIcon,
  Target,
  TrendingUp,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { formatNumber,  safetyVar } from '@/lib/format'

/* Recharts hardcodes grey (#666) tick fills by default, which does
   not follow the theme. Every axis states its colours explicitly. */
const TICK = { fill: 'var(--muted-foreground)', fontSize: 11 }
const AXIS = { tickLine: false, axisLine: false, tickMargin: 8, tick: TICK }
const GRID = { strokeDasharray: '3 3', stroke: 'var(--hig-separator)' }

function Shell({ title, description, caption, icon: Icon = ChartPie, empty, emptyText, config, height = 'h-64', heightStyle, legend, children }) {
  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex-1">
        {empty ? (
          <Empty className="py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon />
              </EmptyMedia>
              <EmptyTitle>{empty}</EmptyTitle>
              {emptyText ? <EmptyDescription>{emptyText}</EmptyDescription> : null}
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <ChartContainer config={config} className={`w-full ${height} aspect-auto`} style={heightStyle}>
              {children}
            </ChartContainer>
            {legend}
          </>
        )}
      </CardContent>
      {caption ? (
        <div className="border-t border-[var(--hig-separator)] px-4 py-2.5 text-[11px] text-muted-foreground">
          {caption}
        </div>
      ) : null}
    </Card>
  )
}

/* ------------------------------------------------------------- bar chart */
export function BarCard({ title, description, caption, data, xKey = 'label', yKey = 'value', color = 'var(--chart-1)', height, empty }) {
  const rows = (data || []).filter((d) => d && Number.isFinite(Number(d[yKey])))
  const config = { [yKey]: { label: yKey, color } }
  return (
    <Shell
      title={title}
      description={description}
      caption={caption}
      icon={ChartColumn}
      config={config}
      height={height}
      empty={empty || (rows.length ? null : 'No data yet')}
    >
      <BarChart data={rows} margin={{ left: 4, right: 4, top: 8 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey={xKey} {...AXIS} tickFormatter={(v) => (String(v).length > 12 ? `${String(v).slice(0, 11)}…` : v)} />
        <YAxis {...AXIS} width={44} />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(value) => [formatNumber(value), yKey]} />}
          cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
        />
        <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={56} />
      </BarChart>
    </Shell>
  )
}

/* ------------------------------------------------------------ donut chart */
export function DonutCard({ title, description, caption, data, nameKey = 'label', valueKey = 'value', empty, center }) {
  const rows = (data || []).filter((d) => d && Number(d[valueKey]) > 0)
  const config = Object.fromEntries(
    rows.map((d, i) => [String(d[nameKey]), { label: String(d[nameKey]), color: `var(--chart-${(i % 5) + 1})` }]),
  )
  const total = rows.reduce((a, d) => a + Number(d[valueKey]), 0)

  /* Recharts' own legend is an absolutely positioned HTML row that
     escapes the card when the labels are long, so the legend is
     rendered here in normal flow instead. */
  const legend = rows.length ? (
    <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {rows.map((d, i) => (
        <li key={i} className="flex min-w-0 max-w-[15rem] items-center gap-1.5 text-[12px] text-muted-foreground">
          <span className="size-2 shrink-0 rounded-[2px]" style={{ background: `var(--chart-${(i % 5) + 1})` }} />
          <span className="truncate">{String(d[nameKey])}</span>
        </li>
      ))}
    </ul>
  ) : null

  return (
    <Shell
      title={title}
      description={description}
      caption={caption}
      icon={CircleDot}
      config={config}
      legend={legend}
      empty={empty || (total ? null : 'No data yet')}
    >
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey={nameKey} />} />
        <Pie data={rows} dataKey={valueKey} nameKey={nameKey} innerRadius={58} outerRadius={88} strokeWidth={2}>
          {rows.map((d, i) => (
            <Cell key={i} fill={`var(--chart-${(i % 5) + 1})`} />
          ))}
        </Pie>
        {center ? (
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-[28px] font-bold tracking-[-0.02em]">
            {center}
          </text>
        ) : null}
      </PieChart>
    </Shell>
  )
}

/* ---------------------------------------------------- scatter / correlation */
export function ScatterCard({ title, description, caption, points, empty, threshold }) {
  const config = { x: { label: 'Temperature (°C)' }, y: { label: 'Safe hours' }, z: { label: 'Quantity (kg)' } }
  const rows = (points || []).filter((p) => Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)))
  return (
    <Shell
      title={title}
      description={description}
      caption={caption}
      icon={ScatterIcon}
      config={config}
      height="h-72"
      empty={empty || (rows.length ? null : 'No listings yet')}
    >
      <ScatterChart margin={{ top: 12, right: 16, bottom: 12, left: 0 }}>
        <CartesianGrid {...GRID} />
        <XAxis
          type="number"
          dataKey="x"
          name="Temperature (°C)"
          {...AXIS}
          tickFormatter={(v) => `${Math.round(v)}°`}
        />
        <YAxis type="number" dataKey="y" name="Safe hours" {...AXIS} width={40} />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div className="hig-panel !p-2.5 !text-[13px] shadow-lg">
                <p className="font-medium">{payload[0].payload.label}</p>
                <p className="text-muted-foreground">
                  {payload[0].payload.x}°C · {payload[0].payload.y}h safe
                </p>
              </div>
            ) : null
          }
        />
        {threshold != null ? <ReferenceLine y={threshold} stroke="var(--caution)" strokeDasharray="4 4" /> : null}
        <Scatter
          data={rows}
          fill="var(--chart-1)"
          shape={(props) => {
            const r = Math.max(3, Math.min(9, 3 + Number(props.payload?.z || 0) / 8))
            return (
              <circle
                cx={props.cx}
                cy={props.cy}
                r={r}
                fill={safetyVar(props.payload?.y)}
                fillOpacity={0.65}
                stroke="var(--background)"
              />
            )
          }}
        />
      </ScatterChart>
    </Shell>
  )
}

/* --------------------------------------------------- treemap (CSS grid) */
export function TreemapCard({ title, description, caption, data, empty }) {
  const rows = (data || []).filter((d) => d && Number(d.value) > 0)
  const total = rows.reduce((a, d) => a + Number(d.value), 0)

  /* slice-and-dice: fill alternating rows until the row is ~65% of the area */
  const boxes = []
  let idx = 0
  let row = 0
  while (idx < rows.length) {
    let share = 0
    const start = idx
    while (idx < rows.length && (share === 0 || share < 0.62)) {
      share += rows[idx].value / total
      idx += 1
    }
    if (share <= 0) break
    let offset = 0
    rows.slice(start, idx).forEach((d, i) => {
      const w = (d.value / total / share) * 100
      boxes.push({
        ...d,
        style: {
          left: `${offset}%`,
          width: `calc(${w}% - 2px)`,
          top: `${row * (100 / Math.ceil(rows.length / Math.max(1, idx - start))) * 0}%`,
        },
        tone: `var(--chart-${(start + i) % 5 + 1})`,
      })
      offset += w
    })
    row += 1
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex-1">
        {!total ? (
          <Empty className="py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ChartPie />
              </EmptyMedia>
              <EmptyTitle>{empty || 'No data yet'}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex h-56 gap-1 overflow-hidden rounded-lg">
            {boxes.map((b, i) => (
              <div
                key={i}
                title={`${b.label}: ${formatNumber(b.value)}`}
                className="relative flex min-w-0 flex-col justify-center overflow-hidden rounded-md px-2.5 py-1.5"
                style={{ flexGrow: b.value, flexBasis: 0, background: `color-mix(in oklab, ${b.tone} 16%, transparent)`, borderTop: `2px solid ${b.tone}` }}
              >
                <span className="truncate text-[11px] font-[590]">{b.label}</span>
                <span className="truncate text-[10px] text-muted-foreground tabular-nums">{formatNumber(b.value)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {caption ? (
        <div className="border-t border-[var(--hig-separator)] px-4 py-2.5 text-[11px] text-muted-foreground">
          {caption}
        </div>
      ) : null}
    </Card>
  )
}

/* ----------------------------------------------------------- funnel chart */
export function FunnelCard({ title, description, caption, stages, empty }) {
  const rows = (stages || []).filter((s) => s && Number.isFinite(Number(s.value)))
  const config = Object.fromEntries(
    rows.map((s, i) => [s.label, { label: s.label, color: `var(--chart-${(i % 5) + 1})` }]),
  )
  /* A vertical bar chart needs a real height — h-auto collapses to
     zero and the chart renders nothing at all. */
  const height = Math.max(168, rows.length * 42 + 32)
  return (
    <Shell
      title={title}
      description={description}
      caption={caption}
      icon={Target}
      config={config}
      heightStyle={{ height: `${height}px` }}
      empty={empty || (rows.length ? null : 'No data yet')}
    >
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }} barCategoryGap={12}>
        <CartesianGrid {...GRID} horizontal={false} />
        <XAxis type="number" {...AXIS} />
        <YAxis type="category" dataKey="label" {...AXIS} width={130} />
        <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
          {rows.map((s, i) => (
            <Cell key={s.label} fill={`var(--chart-${(i % 5) + 1})`} />
          ))}
        </Bar>
      </BarChart>
    </Shell>
  )
}

/* ------------------------------------------------------------- line chart */
export function LineCard({ title, description, caption, data, xKey, yKey = 'value', empty }) {
  const config = { [yKey]: { label: yKey, color: 'var(--chart-2)' } }
  const rows = (data || []).filter((d) => d && Number.isFinite(Number(d[yKey])))
  return (
    <Shell
      title={title}
      description={description}
      caption={caption}
      icon={TrendingUp}
      config={config}
      height="h-56"
      empty={empty || (rows.length ? null : 'No data yet')}
    >
      <LineChart data={rows} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey={xKey} {...AXIS} />
        <YAxis {...AXIS} width={44} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line dataKey={yKey} stroke="var(--chart-2)" strokeWidth={2} dot={false} type="monotone" />
      </LineChart>
    </Shell>
  )
}

/* ------------------------------------------------------------ radar chart */
export function RadarCard({ title, description, caption, rows, empty }) {
  const config = Object.fromEntries(
    ['0–2h', '2–5h', '5–10h', '10h+'].map((k, i) => [k, { label: k, color: `var(--chart-${i + 1})` }]),
  )
  return (
    <Shell
      title={title}
      description={description}
      caption={caption}
      config={config}
      height="h-64"
      empty={empty || (rows?.length ? null : 'No data yet')}
    >
      <RadarChart data={rows} outerRadius="72%">
        <PolarGrid stroke="var(--hig-separator)" />
        <PolarAngleAxis dataKey="band" tick={TICK} />
        <PolarRadiusAxis tick={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Radar dataKey="value" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.35} />
      </RadarChart>
    </Shell>
  )
}