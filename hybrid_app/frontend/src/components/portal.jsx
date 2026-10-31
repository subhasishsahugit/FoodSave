import { Link } from 'react-router-dom'
import { ArrowRight, Inbox, Search, ShieldCheck, Trophy, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Kpi, ListGroup, ListRow, SafetyBadge } from '@/components/common'
import { formatNumber, safetyVar } from '@/lib/format'
import { useApp } from '@/lib/store'

/* ------------------------------------------------------- realtime board */
export function LiveBoard({ rows = [], analytics, title = 'Live board' }) {
  const open = rows.filter((r) => !r.is_claimed)
  const urgent = [...open].sort((a, b) => Number(a.safe_hours || 0) - Number(b.safe_hours || 0)).slice(0, 5)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Refreshes automatically every 8 seconds</CardDescription>
        <CardAction>
          <Badge variant="secondary" className="gap-1">
            <span className="size-1.5 animate-pulse rounded-full bg-current" />
            Live
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Available now" value={open.length} />
          <Kpi
            label="Urgent (< 3h)"
            value={open.filter((r) => Number(r.safe_hours) < 3).length}
            className="!text-destructive [&_.hig-stat__value]:text-destructive"
          />
          <Kpi label="Claimed all time" value={analytics?.metrics.claimed_listings ?? '—'} />
          <Kpi label="Avg safe window" value={analytics ? `${analytics.metrics.avg_safe_hours}h` : '—'} />
        </div>

        <div>
          <p className="hig-section-label mb-2">Most time-sensitive right now</p>
          {urgent.length === 0 ? (
            <Empty className="py-8">
              <EmptyHeader>
                <EmptyTitle>Nothing urgent</EmptyTitle>
                <EmptyDescription>No unclaimed listings are close to their safety limit.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ListGroup className="hig-group--bleed">
              {urgent.map((r) => (
                <ListRow
                  key={r.id}
                  title={r.food_name}
                  subtitle={`${r.donor_name} · ${formatNumber(r.qty)} kg · ${r.donor_location_text || 'Odisha'}`}
                  accessory={
                    <>
                      <span className="hidden w-20 sm:block">
                        <span className="hig-meter block">
                          <span
                            className="hig-meter__fill block"
                            style={{
                              width: `${Math.max(4, Math.min(100, (Number(r.safe_hours) / 12) * 100))}%`,
                              background: safetyVar(r.safe_hours),
                            }}
                          />
                        </span>
                      </span>
                      <SafetyBadge hours={r.safe_hours} />
                    </>
                  }
                />
              ))}
            </ListGroup>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------ leaderboard card */
export function LeaderboardCard({ analytics, rows = [], compact = true, action = true }) {
  const donors = analytics?.donor_volume ?? []
  const ngos = (analytics?.ngo_claims ?? []).filter((n) => n.name !== 'Unclaimed')
  const open = rows.filter((r) => !r.is_claimed).slice(0, compact ? 5 : 8)

  function Column({ title, icon: Icon, rows: items, metric }) {
    return (
      <div className="min-w-0">
        <p className="hig-section-label mb-2 flex items-center gap-2">
          <Icon className="size-3.5" />
          {title}
        </p>
        {items.length === 0 ? (
          <p className="py-4 text-xs text-muted-foreground">No activity yet.</p>
        ) : (
          <ListGroup className="hig-group--bleed">
            {items.map((item, i) => (
              <ListRow
                key={item.name}
                title={item.name}
                accessory={
                  <span className="text-xs tabular-nums">
                    {metric === 'claims' ? `${item.claims} claims` : `${formatNumber(item.qty)} kg`}
                  </span>
                }
                leading={
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--hig-fill-tertiary)] text-[10px] font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                }
                className="!min-h-0 !gap-2.5 !py-2"
              />
            ))}
          </ListGroup>
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Community leaderboard</CardTitle>
        <CardDescription>Ranked from real listing and claim data</CardDescription>
        {action ? (
          <CardAction>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/leaderboard">
                Full board
                <ArrowRight />
              </Link>
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-3">
          <Column title="Top donors" icon={ShieldCheck} rows={donors} metric="qty" />
          <Column title="Top NGOs" icon={Inbox} rows={ngos} metric="claims" />
          <div className="hidden md:block">
            <p className="hig-section-label mb-2 flex items-center gap-2">
              <Trophy className="size-3.5" />
              Open listings
            </p>
            {open.length === 0 ? (
              <p className="py-4 text-xs text-muted-foreground">Nothing available right now.</p>
            ) : (
              <ListGroup className="hig-group--bleed">
                {open.map((r, i) => (
                  <ListRow
                    key={r.id}
                    title={r.food_name}
                    accessory={<span className="text-xs tabular-nums">{formatNumber(r.qty)} kg</span>}
                    leading={
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--hig-fill-tertiary)] text-[10px] font-semibold text-muted-foreground">
                        {i + 1}
                      </span>
                    }
                    className="!min-h-0 !gap-2.5 !py-2"
                  />
                ))}
              </ListGroup>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------ filter bar */
export function FilterBar() {
  const { filters, setFilters } = useApp()
  const dirty = filters.q || filters.status !== 'all' || filters.minSafe !== '' || filters.maxSafe !== ''
  const update = (patch) => setFilters((f) => ({ ...f, ...patch }))

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="hig-search min-w-[220px] flex-1">
        <span className="hig-search__icon">
          <Search className="size-4" />
        </span>
        <input
          type="text"
          value={filters.q || ''}
          placeholder="Search food or donor"
          aria-label="Search listings"
          onChange={(e) => update({ q: e.target.value })}
        />
        {filters.q ? (
          <button type="button" onClick={() => update({ q: '' })} aria-label="Clear search" className="hig-search__clear">
            <X className="size-3" />
          </button>
        ) : null}
      </div>

      <Tabs value={filters.status} onValueChange={(v) => update({ status: v })}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="claimed">Claimed</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-1.5 pl-1">
        <span className="text-[13px] text-muted-foreground">Safe hours</span>
        <Input
          type="number"
          value={filters.minSafe}
          placeholder="min"
          aria-label="Minimum safe hours"
          className="w-[4.5rem]"
          onChange={(e) => update({ minSafe: e.target.value })}
        />
        <span className="text-[13px] text-muted-foreground">–</span>
        <Input
          type="number"
          value={filters.maxSafe}
          placeholder="max"
          aria-label="Maximum safe hours"
          className="w-[4.5rem]"
          onChange={(e) => update({ maxSafe: e.target.value })}
        />
      </div>

      {dirty ? (
        <Button variant="ghost" size="sm" onClick={() => setFilters({ q: '', status: 'all', minSafe: '', maxSafe: '' })}>
          Reset
        </Button>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------- site footer */
export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--hig-separator)]">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="max-w-sm">
            <p className="text-[17px] font-semibold tracking-[-0.011em]">FoodSave</p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              AI-assisted food rescue for Odisha. Donors publish surplus, NGOs claim it in minutes, and nothing goes to
              waste.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            {[
              ['/home', 'Home'],
              ['/about', 'About'],
              ['/impact', 'Impact'],
              ['/leaderboard', 'Leaderboard'],
              ['/contact', 'Contact'],
            ].map(([to, label]) => (
              <Link key={to} to={to} className="text-[13px] text-[var(--system-blue)] hover:underline">
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-8 text-[11px] text-muted-foreground">
          Demonstration build. Impact figures are derived from real listing and claim data in this instance.
        </p>
      </div>
    </footer>
  )
}
