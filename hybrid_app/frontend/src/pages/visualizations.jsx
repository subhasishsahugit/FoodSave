import { RefreshCw, Info } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { KpiRow, PageHeader } from '@/components/common'
import { BarCard, DonutCard, FunnelCard, ScatterCard, TreemapCard } from '@/components/charts'
import { LeafletMap } from '@/components/leaflet-map'
import { useApp } from '@/lib/store'
import { formatNumber } from '@/lib/format'

/**
 * Visual Lab — every chart here is derived from live API responses.
 * Charts that previously computed their own values (the Sankey, waterfall,
 * radar and synthesised sparklines) were removed rather than restyled.
 */
export function Visualizations() {
  const { rows, analytics, loading, refresh } = useApp()
  const m = analytics?.metrics
  const claimed = rows.filter((r) => r.is_claimed)
  const open = rows.filter((r) => !r.is_claimed)

  const countBy = (items, keyFn) => {
    const counts = {}
    items.forEach((r) => {
      const k = keyFn(r)
      if (!k) return
      counts[k] = (counts[k] || 0) + 1
    })
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
  }

  const bands = [
    { label: '0–2h', lo: 0, hi: 2 },
    { label: '2–5h', lo: 2, hi: 5 },
    { label: '5–10h', lo: 5, hi: 10 },
    { label: '10h+', lo: 10, hi: Infinity },
  ].map((b) => ({
    label: b.label,
    value: open.filter((r) => Number(r.safe_hours) >= b.lo && Number(r.safe_hours) < b.hi).length,
  }))

  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Visual Lab"
        description="Every series below is derived from /api/analytics and /api/food/all. Charts that previously used invented values have been removed."
        actions={
          <Button variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw /> Refresh
          </Button>
        }
      />

      {m ? (
        <KpiRow
          items={[
            { label: 'Listings', value: formatNumber(m.total_listings), icon: Info },
            { label: 'Claimed', value: formatNumber(m.claimed_listings), icon: Info },
            { label: 'Avg safe window', value: `${m.avg_safe_hours}h`, icon: Info },
            { label: 'Quantity tracked', value: `${formatNumber(m.total_qty_kg)} kg`, icon: Info },
          ]}
        />
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <BarCard
          title="Donor contribution"
          description="Sum of kilograms published per donor"
          data={analytics?.donor_volume ?? []}
          xKey="name"
          yKey="qty"
          color="var(--chart-2)"
          caption="Source: /api/analytics → donor_volume"
        />
        <DonutCard
          title="Claims by NGO"
          description="Completed rescues per organisation"
          data={(analytics?.ngo_claims ?? []).filter((n) => n.name !== 'Unclaimed')}
          nameKey="name"
          valueKey="claims"
          center={m ? formatNumber(m.claimed_listings) : undefined}
          caption="Source: /api/analytics → ngo_claims"
        />
        <ScatterCard
          title="Storage temperature vs safe window"
          description="One point per listing, sized by quantity"
          points={rows.map((r) => ({
            x: Number(r.temp),
            y: Number(r.safe_hours),
            z: Number(r.qty),
            label: `${r.food_name} · ${r.donor_name}`,
          }))}
          threshold={5}
          caption="Source: /api/food/all"
        />
        <BarCard
          title="Safety window distribution"
          description="How many listings fall in each time band"
          data={bands}
          color="var(--chart-3)"
          caption="Source: /api/food/all → safe_hours"
        />
        <TreemapCard
          title="Largest lots available"
          description="Top listings by quantity"
          data={[...rows].sort((a, b) => Number(b.qty) - Number(a.qty)).slice(0, 14).map((r) => ({ label: r.food_name, value: Number(r.qty) || 0 }))}
          caption="Source: /api/food/all → qty"
        />
        <FunnelCard
          title="Rescue pipeline"
          description="From published to collected"
          stages={[
            { label: 'Published', value: m?.total_listings ?? 0 },
            { label: 'Available', value: m?.available_listings ?? 0 },
            { label: 'High risk open', value: m?.high_risk_available ?? 0 },
            { label: 'Rescued', value: m?.claimed_listings ?? 0 },
          ]}
          caption="Source: /api/analytics → metrics"
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <DonutCard title="Rescued per donor" description="Count of claimed listings" data={countBy(claimed, (r) => r.donor_name)} caption="Source: /api/food/all" />
        <DonutCard title="Storage conditions" description="Across all listings" data={countBy(rows, (r) => r.storage_conditions)} caption="Source: /api/food/all → storage_conditions" />
        <DonutCard title="Food categories" description="Across all listings" data={countBy(rows, (r) => r.food_category)} caption="Source: /api/food/all → food_category" />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <BarCard
          title="Packaging mix"
          description="Sealed, bulk and open listings"
          data={countBy(rows, (r) => r.packaging)}
          color="var(--chart-4)"
          caption="Source: /api/food/all → packaging"
        />
        <Card>
          <CardHeader>
            <CardTitle>Geography</CardTitle>
            <CardDescription>Donor coordinates for every listing</CardDescription>
          </CardHeader>
          <CardContent>
            <LeafletMap rows={rows} className="h-[360px]" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Why some charts are missing</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            The previous Visual Lab included a Sankey, a waterfall, a radar chart and several sparklines. Their values
            were invented at render time — the Sankey in particular computed its own numbers from two totals — so they
            were removed rather than restyled. Everything remaining on this page is traceable to an API response.
          </p>
        </CardContent>
      </Card>
    </>
  )
}