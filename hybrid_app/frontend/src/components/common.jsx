import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatNumber, riskLabel, riskTone, safetySoftVar, safetyVar, titleCase } from '@/lib/format'
import { cn } from '@/lib/utils'

/* ------------------------------------------------- safety-aware badge */
export function SafetyBadge({ hours, className, showLabel = false }) {
  const tone = riskTone(hours)
  return (
    <Badge
      variant="outline"
      className={cn('gap-1.5 border-transparent tabular-nums', className)}
      style={{ background: safetySoftVar(hours), color: safetyVar(hours) }}
    >
      <span className="size-1.5 rounded-full" style={{ background: 'currentColor' }} />
      {Number(hours).toFixed(1)}h{showLabel ? ` · ${riskLabel(hours)}` : ''}
    </Badge>
  )
}

/* ------------------------------------------------------------ stat tile */
export function Kpi({ label, value, sub, icon: Icon, tone, className }) {
  return (
    <div className={cn('hig-stat', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="hig-stat__label">{label}</p>
        {Icon ? (
          <Icon
            className={cn(
              'size-4 shrink-0',
              tone === 'safe' && 'text-[var(--safe)]',
              tone === 'caution' && 'text-[var(--caution)]',
              tone === 'unsafe' && 'text-destructive',
              !tone && 'text-muted-foreground',
            )}
          />
        ) : null}
      </div>
      <p className="hig-stat__value">{value}</p>
      {sub ? <p className="hig-stat__sub">{sub}</p> : null}
    </div>
  )
}

export function KpiRow({ items, className }) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 lg:grid-cols-4',
        items.length === 5 && 'xl:grid-cols-5',
        className,
      )}
    >
      {items.map((k) => (
        <Kpi key={k.label} {...k} />
      ))}
    </div>
  )
}

/* ------------------------------------------------------- safety meter */
export function SafetyMeter({ hours, className }) {
  const pct = Math.max(2, Math.min(100, (Number(hours) / 12) * 100))
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">Safe window remaining</span>
        <span className="text-xs tabular-nums text-foreground">{Number(hours).toFixed(1)}h</span>
      </div>
      <div
        className="hig-meter"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="hig-meter__fill" style={{ width: `${pct}%`, background: safetyVar(hours) }} />
      </div>
    </div>
  )
}

/* ----------------------------------------------------------- stat strip */
export function StatStrip({ items }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((s) => (
        <div key={s.label} className="hig-stat items-center text-center">
          <p className="hig-stat__value">{s.value}</p>
          <p className="hig-stat__label">{s.label}</p>
        </div>
      ))}
    </div>
  )
}

/* --------------------------------------------------------- page header */
export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="hig-section-label mb-1.5">{eyebrow}</p> : null}
        <h1 className="hig-large-title">{title}</h1>
        {description ? <p className="hig-subtitle">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

/* --------------------------------------------------------- section head */
export function SectionHeader({ eyebrow, title, description, action, className }) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="hig-section-label mb-1">{eyebrow}</p> : null}
        <h2 className="hig-section-title">{title}</h2>
        {description ? <p className="mt-1 text-[13px] text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

/* ------------------------------------------------------------ list row
   The HIG list row: 44pt minimum, 16pt leading padding, chevron
   accessory. Renders as <a> when given `to`, as <button> when given
   `onClick`, and as a plain element when given `as` — a row that
   contains its own controls must not become a nested button. */
export function ListRow({ icon: Icon, leading, title, subtitle, accessory, to, onClick, as, className, children }) {
  const body = (
    <>
      {Icon ? (
        <span className="hig-row__icon">
          <Icon className="size-4" />
        </span>
      ) : null}
      {leading}
      <span className="hig-row__body">
        <span className="hig-row__title block truncate">{title}</span>
        {subtitle ? <span className="hig-row__subtitle block truncate">{subtitle}</span> : null}
      </span>
      {accessory ? <span className="hig-row__accessory">{accessory}</span> : null}
      {to ? <ChevronRight className="hig-row__chevron size-4 shrink-0" aria-hidden /> : null}
    </>
  )

  const Tag = as || (to ? Link : 'button')
  const interactive = !as && !to

  return (
    <Tag
      to={to}
      onClick={onClick}
      type={interactive ? 'button' : undefined}
      className={cn('hig-row', interactive && 'hig-row--tappable', className)}
    >
      {body}
      {children}
    </Tag>
  )
}

/* ------------------------------------------------------------ grouped list */
export function ListGroup({ children, className }) {
  return <div className={cn('hig-group', className)}>{children}</div>
}

/* ------------------------------------------------------- quick-action tile */
export function ActionTile({ to, icon: Icon, title, description }) {
  return (
    <Link
      to={to}
      className="hig-row hig-row--tappable group !min-h-[3.5rem] rounded-xl border border-[var(--hig-separator)] bg-card !border-b transition-colors hover:bg-[var(--hig-fill-quaternary)]"
    >
      <span className="hig-row__icon !size-8 !rounded-[10px] bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <span className="hig-row__body">
        <span className="hig-row__title block !font-[590]">{title}</span>
        <span className="hig-row__subtitle block truncate">{description}</span>
      </span>
      <ChevronRight className="hig-row__chevron size-4 shrink-0" aria-hidden />
    </Link>
  )
}

/* ------------------------------------------------------------ metadata */
export function MetaRow({ icon: Icon, label, value, className }) {
  return (
    <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{label ? `${label} ` : ''}{value}</span>
    </div>
  )
}

export function FoodMeta({ row }) {
  return (
    <span className="block text-xs text-muted-foreground">
      {titleCase(row.food_category)} · {titleCase(row.storage_conditions)} · {titleCase(row.packaging)}
    </span>
  )
}

export function Qty({ row }) {
  return <span className="tabular-nums">{formatNumber(row.qty)} kg</span>
}
