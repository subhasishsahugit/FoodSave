import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bot,
  CheckCircle2,
  History,
  Inbox,
  List,
  Map as MapIcon,
  
  Navigation,
  Package,
  Send,
  Shield,
  Thermometer,
  Clock,
  Utensils,
  Zap,
  Flame,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { KpiRow, ActionTile, PageHeader, SafetyBadge, SafetyMeter, SectionHeader } from '@/components/common'
import { BarCard, FunnelCard } from '@/components/charts'
import { ClaimChat, FeedCard, PickupPass } from '@/components/claim-widgets'
import { LeafletMap, MapLegend } from '@/components/leaflet-map'
import { ListingsTable } from '@/components/listings-table'
import { FilterBar, LeaderboardCard, LiveBoard } from '@/components/portal'
import { useApp } from '@/lib/store'
import { formatNumber,  titleCase } from '@/lib/format'

const unclaimed = (rows) => rows.filter((r) => !r.is_claimed)
const mine = (rows, username) => rows.filter((r) => r.claimed_by === username)

/* ==================================================== LISTING DETAIL */
function FeedDetail({ row }) {
  const { claimListing, claimingId } = useApp()

  if (!row) {
    return (
      <Card>
        <CardContent className="py-12">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Zap />
              </EmptyMedia>
              <EmptyTitle>Select a listing</EmptyTitle>
              <EmptyDescription>Pick food from the feed to see its full details and claim it.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    )
  }

  const facts = [
    [Package, 'Quantity', `${formatNumber(row.qty)} kg`],
    [Thermometer, 'Temperature', `${formatNumber(row.temp, 0)}°C`],
    [Clock, 'Age', `${formatNumber(row.hours_ago)}h`],
    [Shield, 'Safe window', `${Number(row.safe_hours).toFixed(1)}h`],
    [Utensils, 'Category', titleCase(row.food_category)],
    [Package, 'Packaging', titleCase(row.packaging)],
  ]

  return (
    <Card className="lg:sticky lg:top-20">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>{row.food_name}</CardTitle>
            <CardDescription>
              Published by {row.donor_name} · {row.donor_location_text || 'Odisha'}
            </CardDescription>
          </div>
          <SafetyBadge hours={row.safe_hours} showLabel />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {facts.map(([Icon, label, value]) => (
            <div key={label} className="flex items-start gap-2">
              <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <dt className="text-[11px] text-muted-foreground">{label}</dt>
                <dd className="truncate text-[15px] font-[450] tracking-[-0.008em]">{value}</dd>
              </div>
            </div>
          ))}
        </dl>

        <SafetyMeter hours={row.safe_hours} />

        {row.distance_km != null ? (
          <p className="text-xs text-muted-foreground">
            <Navigation className="mr-1 inline size-3" />
            {formatNumber(row.distance_km, 1)} km from your saved location
            {row.within_ngo_radius ? ' · inside your rescue radius' : ' · outside your rescue radius'}
          </p>
        ) : null}

        <Button className="w-full" disabled={claimingId === row.id} onClick={() => claimListing(row)}>
          {claimingId === row.id ? 'Claiming…' : 'Claim this food'}
        </Button>
        <p className="text-xs text-muted-foreground">Claiming mints a pickup pass so the donor can verify the handover.</p>
      </CardContent>
    </Card>
  )
}

/* ===================================================== NGO DASHBOARD */
export function NgoDashboard() {
  const { rows, analytics, user } = useApp()
  const open = unclaimed(rows)
  const mineRows = mine(rows, user.username)

  return (
    <>
      <PageHeader
        eyebrow="NGO portal"
        title={`Rescue queue, ${user.username}`}
        description="Ranked by urgency, freshness and how close it is to you."
        actions={
          <Button asChild>
            <Link to="/ngo/live-feed">
              <Zap /> Open live feed
            </Link>
          </Button>
        }
      />

      <KpiRow
        items={[
          { label: 'Unclaimed listings', value: open.length, icon: Inbox },
          { label: 'Critical (< 3h)', value: open.filter((r) => Number(r.safe_hours) < 3).length, icon: Flame, tone: 'unsafe' },
          { label: 'Active claims', value: mineRows.length, icon: Shield },
          { label: 'Completed', value: analytics?.metrics.claimed_listings ?? '—', icon: CheckCircle2, tone: 'safe' },
        ]}
      />

      <section>
        <SectionHeader eyebrow="Quick actions" title="Jump straight in" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ActionTile to="/ngo/live-feed" icon={Zap} title="Live feed" description="Freshest food, most urgent first" />
          <ActionTile to="/ngo/map-view" icon={MapIcon} title="Map view" description="See what is near you" />
          <ActionTile to="/ngo/ai-advisor" icon={Bot} title="AI advisor" description="Ranked queue with reasons" />
          <ActionTile to="/ngo/active-claims" icon={Shield} title="Active claims" description="Pickup passes and chat" />
          <ActionTile to="/leaderboard" icon={Inbox} title="Leaderboard" description="See the community ranking" />
          <ActionTile to="/contact" icon={Send} title="Support" description="Talk to the team" />
        </div>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <FunnelCard
          title="How the queue narrows"
          stages={[
            { label: 'Available listings', value: open.length },
            { label: 'Within 5 hours', value: open.filter((r) => Number(r.safe_hours) <= 5).length },
            { label: 'Critical (< 3h)', value: open.filter((r) => Number(r.safe_hours) < 3).length },
            { label: 'Claimed by you', value: mineRows.length },
          ]}
        />
        <BarCard
          title="Available food by safety window"
          description="Real counts from live listings"
          data={[
            { label: '0–2h', value: open.filter((r) => Number(r.safe_hours) <= 2).length },
            { label: '2–5h', value: open.filter((r) => Number(r.safe_hours) > 2 && Number(r.safe_hours) <= 5).length },
            { label: '5–10h', value: open.filter((r) => Number(r.safe_hours) > 5 && Number(r.safe_hours) <= 10).length },
            { label: '10h+', value: open.filter((r) => Number(r.safe_hours) > 10).length },
          ]}
          color="var(--chart-2)"
        />
      </div>

      <LiveBoard rows={rows} analytics={analytics} />
      <LeaderboardCard analytics={analytics} rows={rows} />
    </>
  )
}

/* ======================================================== LIVE FEED */
export function NgoLiveFeed() {
  const { filteredRows, selectedId, setSelectedId } = useApp()
  const navigate = useNavigate()
  const open = unclaimed(filteredRows)
  const selected = open.find((r) => r.id === selectedId) || open[0]

  return (
    <>
      <PageHeader
        eyebrow="NGO portal"
        title="Live feed"
        description={`Every unclaimed listing, refreshed automatically. ${open.length} available right now.`}
        actions={
          <Button variant="outline" onClick={() => navigate('/ngo/map-view')}>
            <MapIcon /> Map
          </Button>
        }
      />

      <FilterBar />

      {open.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CheckCircle2 />
                </EmptyMedia>
                <EmptyTitle>Nothing available right now</EmptyTitle>
                <EmptyDescription>All published food has been claimed. New listings appear here automatically.</EmptyDescription>
              </EmptyHeader>
              <Button variant="outline" onClick={() => navigate('/ngo/history')}>
                <History /> View your history
              </Button>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
          <div className="grid max-h-[calc(100vh-8rem)] gap-3 overflow-y-auto pr-1">
            {open.map((r) => (
              <FeedCard key={r.id} row={r} selected={selected?.id === r.id} onSelect={() => setSelectedId(r.id)} />
            ))}
          </div>
          <FeedDetail row={selected} />
        </div>
      )}
    </>
  )
}

/* ========================================================= MAP VIEW */
export function NgoMapView() {
  const { filteredRows } = useApp()
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState(null)
  const open = unclaimed(filteredRows)
  const selected = open.find((r) => r.id === selectedId) || open[0]

  return (
    <>
      <PageHeader
        eyebrow="NGO portal"
        title="Map view"
        description="Available food plotted around your saved location. Marker colour is the safe window; size is the quantity."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/ngo/live-feed')}>
              <List /> List
            </Button>
            <Button variant="outline" onClick={() => navigate('/settings/location')}>
              <Navigation /> Update location
            </Button>
          </div>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div>
          <LeafletMap rows={open} />
          <MapLegend />
        </div>

        <div className="grid gap-3">
          {open.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>Nothing on the map</EmptyTitle>
                    <EmptyDescription>No unclaimed listings with coordinates right now.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </CardContent>
            </Card>
          ) : (
            <>
              {open.slice(0, 8).map((r) => (
                <FeedCard key={r.id} row={r} selected={selected?.id === r.id} onSelect={() => setSelectedId(r.id)} />
              ))}
              <FeedDetail row={selected} />
            </>
          )}
        </div>
      </div>
    </>
  )
}

/* ==================================================== ACTIVE CLAIMS */
export function NgoActiveClaims() {
  const { rows, user, setActiveChatFoodId } = useApp()
  const navigate = useNavigate()
  const claimed = mine(rows, user.username)

  return (
    <>
      <PageHeader
        eyebrow="NGO portal"
        title="Active claims"
        description={`Pickup passes for food you have claimed. ${claimed.length} total.`}
      />

      {claimed.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Shield />
                </EmptyMedia>
                <EmptyTitle>No claims yet</EmptyTitle>
                <EmptyDescription>Claim food from the live feed and your pickup pass appears here.</EmptyDescription>
              </EmptyHeader>
              <Button onClick={() => navigate('/ngo/live-feed')}>
                <Zap /> Open live feed
              </Button>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {claimed.map((r) => (
            <PickupPass key={r.id} row={r} onChat={setActiveChatFoodId} />
          ))}
        </div>
      )}

      <ClaimChat />
    </>
  )
}

/* ========================================================== HISTORY */
export function NgoHistory() {
  const { rows, user, setActiveChatFoodId } = useApp()
  const claimed = mine(rows, user.username)
  const totalQty = claimed.reduce((a, r) => a + Number(r.qty || 0), 0)
  const avgSafe = claimed.length ? claimed.reduce((a, r) => a + Number(r.safe_hours || 0), 0) / claimed.length : 0

  return (
    <>
      <PageHeader eyebrow="NGO portal" title="Claim history" description="Everything your organisation has collected." />

      <KpiRow
        items={[
          { label: 'Total claims', value: claimed.length, icon: CheckCircle2 },
          { label: 'Food collected', value: `${formatNumber(totalQty)} kg`, icon: Package, tone: 'safe' },
          { label: 'Avg safe window', value: `${formatNumber(avgSafe, 1)}h`, icon: Clock },
          { label: 'Est. meals', value: formatNumber(Math.round(totalQty * 2.2)), icon: Utensils },
        ]}
      />

      <ListingsTable
        rows={claimed}
        title="Claim history"
        emptyTitle="No claims yet"
        emptyText="Claimed food shows up here with its pickup pass."
        allowEdit={false}
        onOpenChat={setActiveChatFoodId}
      />

      <ClaimChat />
    </>
  )
}

/* ======================================================== AI ADVISOR */
export function NgoAiAdvisor() {
  const { rows, claimListing, claimingId } = useApp()
  const queue = unclaimed(rows)
    .slice()
    .sort((a, b) => Number(b.priority_score || 0) - Number(a.priority_score || 0))
    .slice(0, 10)

  const critical = queue.filter((r) => Number(r.safe_hours) < 3).length
  const urgent = queue.filter((r) => Number(r.safe_hours) >= 3 && Number(r.safe_hours) < 6).length

  const reasons = [
    [Clock, 'Urgency', 'A short safe window pushes a listing up, because rescuing it saves the most food.'],
    [Thermometer, 'Condition', 'Higher storage temperature and looser packaging raise priority.'],
    [Navigation, 'Proximity', 'Listings closer to your saved location gain a bonus, all else being equal.'],
  ]

  return (
    <>
      <PageHeader
        eyebrow="NGO portal"
        title="AI advisor"
        description="The same urgency score the platform ranks listings by, with the reasons behind each position."
      />

      <KpiRow
        items={[
          { label: 'Critical now', value: critical, icon: Flame, tone: 'unsafe' },
          { label: 'Urgent', value: urgent, icon: Zap, tone: 'caution' },
          { label: 'Can wait', value: queue.length - critical - urgent, icon: Clock, tone: 'safe' },
          { label: 'Queue length', value: queue.length, icon: List },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Recommended order</CardTitle>
          <CardDescription>Highest priority first — urgency, confidence and proximity combined</CardDescription>
        </CardHeader>
        <CardContent className="!p-0">
          {queue.length === 0 ? (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Bot />
                </EmptyMedia>
                <EmptyTitle>Nothing to recommend</EmptyTitle>
                <EmptyDescription>The queue is empty right now.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ol>
              {queue.map((r, i) => {
                const reason =
                  Number(r.safe_hours) < 3
                    ? 'Closes in under 3 hours'
                    : Number(r.safe_hours) < 6
                      ? 'Narrow window — claim soon'
                      : 'Safe window is comfortable'
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--hig-separator)] px-4 py-3.5 last:border-b-0"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--hig-fill-tertiary)] text-[10px] font-semibold text-muted-foreground">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="hig-row__title !font-[590]">{r.food_name}</p>
                        <p className="hig-row__subtitle">
                          {r.donor_name} · {formatNumber(r.qty)} kg · {reason}
                          {r.distance_km != null ? ` · ${formatNumber(r.distance_km, 1)} km` : ''}
                        </p>
                        <div className="mt-2 grid max-w-xs gap-1.5">
                          {[
                            ['Priority', r.priority_score],
                            ['Confidence', r.confidence_score],
                          ].map(([label, value]) => (
                            <div key={label} className="space-y-1">
                              <div className="flex items-baseline justify-between">
                                <span className="text-[11px] text-muted-foreground">{label}</span>
                                <span className="text-[11px] font-[590] tabular-nums">{Math.round(value)}%</span>
                              </div>
                              <div className="hig-meter !h-1">
                                <div
                                  className="hig-meter__fill"
                                  style={{ width: `${value}%`, background: `var(--chart-${value > 66 ? 3 : 1})` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <SafetyBadge hours={r.safe_hours} />
                      <Button size="sm" disabled={claimingId === r.id} onClick={() => claimListing(r)}>
                        Claim
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How listings are ranked</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {reasons.map(([Icon, title, text]) => (
              <div key={title} className="hig-panel !p-4">
                <span className="mb-2.5 inline-flex size-8 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                <p className="!text-[15px] font-[590] tracking-[-0.008em]">{title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  )
}