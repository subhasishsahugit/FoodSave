import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  
  ChartPie,
  Heart,
  History,
  
  Send,
  Utensils,
  Wand2,
  Boxes,
  Trophy,
  MessageSquare,
  
  
  
  
  CircleCheck,
  CircleX,
  TriangleAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card,  CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader,  EmptyTitle } from '@/components/ui/empty'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ActionTile, KpiRow, ListGroup, ListRow, PageHeader, SafetyMeter, SafetyBadge, SectionHeader } from '@/components/common'
import { ClaimChat } from '@/components/claim-widgets'
import { ListingsTable } from '@/components/listings-table'
import { LeaderboardCard, LiveBoard } from '@/components/portal'
import { FOOD_CATEGORIES, PACKAGING_OPTIONS, STORAGE_OPTIONS } from '@/lib/routes'
import { apiSend } from '@/lib/api'
import { useApp } from '@/lib/store'
import { formatNumber,  riskTone, safetySoftVar, safetyVar } from '@/lib/format'

/* ===================================================== DONOR DASHBOARD */
export function DonorDashboard() {
  const { analytics, rows, user } = useApp()
  const mine = rows.filter((r) => r.donor_name === user.username)
  const m = analytics?.metrics

  return (
    <>
      <PageHeader
        eyebrow="Donor portal"
        title={`Welcome back, ${user.username}`}
        description="Everything you have published, and what it saved."
        actions={
          <Button asChild>
            <Link to="/donor/donate">
              <Wand2 /> Donate food
            </Link>
          </Button>
        }
      />

      {m ? (
        <KpiRow
          items={[
            { label: 'Food donated', value: `${formatNumber(m.total_qty_kg)} kg`, icon: Heart },
            { label: 'Active listings', value: mine.filter((r) => !r.is_claimed).length, icon: Boxes },
            { label: 'Rescued', value: `${formatNumber(m.waste_diverted_kg)} kg`, icon: CircleCheck, tone: 'safe' },
            { label: 'Meals enabled', value: formatNumber(m.meals_rescued), icon: Utensils },
            { label: 'Urgent', value: mine.filter((r) => !r.is_claimed && Number(r.safe_hours) < 3).length, icon: TriangleAlert, tone: 'unsafe' },
          ]}
        />
      ) : null}

      <section>
        <SectionHeader eyebrow="Quick actions" title="What do you want to do?" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ActionTile to="/donor/donate" icon={Wand2} title="Donate food" description="Publish surplus with an AI safety score" />
          <ActionTile to="/donor/active" icon={Boxes} title="Active listings" description="Track what is still out there" />
          <ActionTile to="/donor/history" icon={History} title="History" description="See what got rescued, chat with NGOs" />
          <ActionTile to="/leaderboard" icon={Trophy} title="Leaderboard" description="See where your contribution ranks" />
          <ActionTile to="/visualizations" icon={ChartPie} title="Visual Lab" description="Explore the platform data" />
          <ActionTile to="/contact" icon={Send} title="Support" description="Talk to the team" />
        </div>
      </section>

      <LiveBoard rows={rows} analytics={analytics} />
      <LeaderboardCard analytics={analytics} rows={rows} />
    </>
  )
}

/* =========================================================== DONATE */
function Gauge({ hours, max = 24 }) {
  const pct = Math.max(0, Math.min(1, Number(hours) / max))
  const r = 58
  const sweep = 0.75
  const circ = 2 * Math.PI * r
  const arc = circ * sweep
  const size = 150
  return (
    <div
      data-testid="gauge"
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`${hours} hours safe`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--hig-fill-tertiary)"
          strokeWidth={10}
          fill="none"
          strokeDasharray={`${arc} ${circ}`}
          transform={`rotate(135 ${size / 2} ${size / 2})`}
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={safetyVar(hours)}
          strokeWidth={10}
          fill="none"
          strokeDasharray={`${arc * pct} ${circ}`}
          transform={`rotate(135 ${size / 2} ${size / 2})`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 400ms var(--hig-ease), stroke 400ms var(--hig-ease)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-6">
        <span className="!text-[28px] !font-bold !leading-none !tracking-[-0.02em] tabular-nums">
          {Number(hours).toFixed(1)}
        </span>
        <span className="mt-1 text-[11px] tracking-[0.02em] text-muted-foreground uppercase">hours safe</span>
      </div>
    </div>
  )
}

export function Donate() {
  const { user, refresh } = useApp()
  const [values, setValues] = useState({
    food_name: '',
    qty: 10,
    temp: 8,
    hours_ago: 2,
    food_category: 'prepared',
    storage: 'refrigerated',
    packaging: 'sealed',
  })
  const [prediction, setPrediction] = useState(null)
  const [busy, setBusy] = useState(false)

  const update = (key) => (v) => setValues((prev) => ({ ...prev, [key]: v }))

  /* Live scoring — the API is the single source of truth. */
  useEffect(() => {
    if (!values.food_name.trim()) {
      setPrediction(null)
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      apiSend('/api/ai/predict', 'POST', {
        temp: Number(values.temp),
        hours_ago: Number(values.hours_ago),
        food_category: values.food_category,
        storage: values.storage,
        packaging: values.packaging,
      })
        .then((data) => !cancelled && setPrediction(data))
        .catch(() => {})
    }, 280)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [values.food_name, values.temp, values.hours_ago, values.food_category, values.storage, values.packaging])

  const safeHours = prediction ? Number(prediction.safe_hours) : 0
  const canPublish = Boolean(values.food_name.trim()) && Number(values.qty) > 0 && prediction && safeHours > 0 && !busy

  function submit(e) {
    e.preventDefault()
    if (!canPublish) return
    setBusy(true)
    apiSend('/api/food', 'POST', {
      donor_name: user.username,
      food_name: values.food_name.trim(),
      qty: Number(values.qty),
      temp: Number(values.temp),
      hours_ago: Number(values.hours_ago),
      food_category: values.food_category,
      storage: values.storage,
      packaging: values.packaging,
    })
      .then((data) => {
        toast.success('Listing published', {
          description: `${values.food_name} is visible to nearby NGOs (listing #${data.listing_id}).`,
        })
        setValues((v) => ({ ...v, food_name: '' }))
        setPrediction(null)
        refresh()
      })
      .catch((err) => toast.error('Could not publish the listing.', { description: err.message }))
      .finally(() => setBusy(false))
  }

  const tone = riskTone(safeHours)
  const matrix = useMemo(() => {
    if (!prediction) return null
    const temps = [-20, 0, 4, 8, 15, 25, 40]
    const hours = [0.5, 1, 2, 4, 6, 8, 12]
    const catEnc = { protein: 0, dairy: 1, produce: 2, grains: 3, prepared: 4 }[values.food_category]
    const storEnc = { frozen: 0, refrigerated: 1, ambient: 2 }[values.storage]
    const pkgEnc = { sealed: 0, bulk: 1, open: 2 }[values.packaging]
    return temps.map((t) => ({
      temp: `${t}°C`,
      hours,
      values: hours.map((h) =>
        Math.max(0, Math.round((safeHours - Math.abs(t - Number(values.temp)) * (storEnc === 2 ? 1.2 : 0.8) - (h - Number(values.hours_ago)) * (pkgEnc === 2 ? 1.4 : 0.9)) * 10) / 10),
      ),
    }))
  }, [prediction, safeHours, values.temp, values.hours_ago, values.food_category, values.storage, values.packaging])

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      <PageHeader
        eyebrow="Donor portal"
        title="Donate food"
        description="Describe the surplus. The safety model scores it live, so you publish with the real answer already attached."
      />

      <div className="grid items-start gap-4 lg:grid-cols-5">
        <div className="grid gap-4 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>What are you donating?</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field>
                <FieldLabel htmlFor="food-name">
                  Food name <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="food-name"
                  placeholder="Vegetable curry, 12 noon batch"
                  value={values.food_name}
                  onChange={(e) => update('food_name')(e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="qty">
                    Quantity (kg) <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input id="qty" type="number" min="0.1" step="0.1" value={values.qty} onChange={(e) => update('qty')(e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="hours">
                    Hours since prepared <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input id="hours" type="number" min="0" step="0.5" value={values.hours_ago} onChange={(e) => update('hours_ago')(e.target.value)} />
                  <FieldDescription>Counted from when the food was cooked.</FieldDescription>
                </Field>
              </div>

              <Field>
                <FieldLabel>Category</FieldLabel>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={values.food_category}
                  onValueChange={(v) => v && update('food_category')(v)}
                  className="flex flex-wrap gap-1.5"
                >
                  {FOOD_CATEGORIES.map((c) => (
                    <ToggleGroupItem key={c.value} value={c.value} size="sm">
                      {c.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>

              <Field>
                <FieldLabel>Storage conditions</FieldLabel>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={values.storage}
                  onValueChange={(v) => v && update('storage')(v)}
                  className="flex flex-wrap gap-1.5"
                >
                  {STORAGE_OPTIONS.map((c) => (
                    <ToggleGroupItem key={c.value} value={c.value} size="sm">
                      {c.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>

              <Field>
                <FieldLabel>Packaging</FieldLabel>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={values.packaging}
                  onValueChange={(v) => v && update('packaging')(v)}
                  className="flex flex-wrap gap-1.5"
                >
                  {PACKAGING_OPTIONS.map((c) => (
                    <ToggleGroupItem key={c.value} value={c.value} size="sm">
                      {c.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Storage temperature</CardTitle>
              <CardDescription>The single biggest driver of the safe window</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Slider
                value={[Number(values.temp)]}
                min={-20}
                max={45}
                step={1}
                onValueChange={([v]) => update('temp')(v)}
                aria-label="Current temperature"
              />
              <div className="grid grid-cols-3 items-baseline text-xs text-muted-foreground tabular-nums">
                <span>-20°</span>
                <span className="text-center font-[590] text-foreground">{Number(values.temp)}°C</span>
                <span className="text-right">45°</span>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setValues((v) => ({ ...v, food_name: '' }))
                setPrediction(null)
              }}
            >
              Clear
            </Button>
            <Button type="submit" size="lg" disabled={!canPublish}>
              <Send /> Publish listing
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Safety score</CardTitle>
              <CardDescription>
                {prediction ? 'Updated live from the model' : 'Enter a food name to score it'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {prediction ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Gauge hours={safeHours} />
                    <div className="min-w-0 flex-1 space-y-3">
                      {[
                        ['Confidence', prediction.confidence_score],
                        ['Urgency priority', prediction.priority_score],
                      ].map(([label, value]) => (
                        <div key={label} className="space-y-1">
                          <div className="flex items-baseline justify-between">
                            <span className="text-xs text-muted-foreground">{label}</span>
                            <span className="text-xs font-[590] tabular-nums">{Math.round(value)}%</span>
                          </div>
                          <div className="hig-meter">
                            <div
                              className="hig-meter__fill"
                              style={{ width: `${value}%`, background: `var(--chart-${value > 66 ? 3 : 2})` }}
                            />
                          </div>
                        </div>
                      ))}
                      <SafetyBadge hours={safeHours} showLabel />
                    </div>
                  </div>

                  <div
                    data-testid="verdict"
                    className="flex items-start gap-3 rounded-[10px] p-3"
                    style={{ background: safetySoftVar(safeHours) }}
                  >
                    {tone === 'unsafe' ? (
                      <CircleX className="mt-0.5 size-4 shrink-0" style={{ color: safetyVar(safeHours) }} />
                    ) : tone === 'safe' ? (
                      <CircleCheck className="mt-0.5 size-4 shrink-0" style={{ color: safetyVar(safeHours) }} />
                    ) : (
                      <TriangleAlert className="mt-0.5 size-4 shrink-0" style={{ color: safetyVar(safeHours) }} />
                    )}
                    <p className="text-[13px] leading-relaxed">
                      {safeHours > 0
                        ? `Safe for roughly ${safeHours.toFixed(1)} more hours at ${values.temp}°C, ${values.packaging} packaging. Publish it and nearby NGOs will see it immediately.`
                        : 'The model scores this as unsafe to donate. Cool it down, seal it, or shorten the age and try again.'}
                    </p>
                  </div>
                </div>
              ) : (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>No score yet</EmptyTitle>
                    <EmptyDescription>
                      Start with the food name — the model scores temperature, age, category, storage and packaging
                      together.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Condition matrix</CardTitle>
              <CardDescription>Where this batch sits across temperature and age</CardDescription>
            </CardHeader>
            <CardContent>
              {matrix ? (
                <div className="overflow-x-auto">
                  <table className="text-xs">
                    <thead>
                      <tr>
                        <th className="pr-2 text-left font-[590] text-muted-foreground" />
                        {matrix[0].hours.map((h) => (
                          <th key={h} className="px-1 pb-1 text-center font-[590] text-muted-foreground">
                            {h}h
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.map((row) => (
                        <tr key={row.temp}>
                          <td className="py-0.5 pr-2 text-right font-[590] whitespace-nowrap text-muted-foreground">{row.temp}</td>
                          {row.values.map((v, i) => (
                            <td key={i} className="p-0.5">
                              <div
                                title={`${row.temp} · ${row.hours[i]}h: ${v}`}
                                className="flex size-8 items-center justify-center rounded-[6px] text-[10px] font-[590] tabular-nums"
                                style={{
                                  background: v > 0 ? safetySoftVar(v) : 'var(--hig-fill-quaternary)',
                                  color: v > 0 ? safetyVar(v) : 'var(--muted-foreground)',
                                }}
                              >
                                {v}
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>Nothing to plot yet</EmptyTitle>
                    <EmptyDescription>The matrix fills in once the model has scored your batch.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  )
}

/* =========================================================== ACTIVE */
export function DonorActive() {
  const { rows, user, retractListing, saveListing, setActiveChatFoodId } = useApp()
  const mine = rows.filter((r) => r.donor_name === user.username && !r.is_claimed)

  return (
    <>
      <PageHeader
        eyebrow="Donor portal"
        title="Active listings"
        description="Food you have published that has not been claimed yet."
        actions={
          <Button asChild>
            <Link to="/donor/donate">
              <Wand2 /> New listing
            </Link>
          </Button>
        }
      />

      {mine.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {mine.slice(0, 4).map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle>{r.food_name}</CardTitle>
                    <CardDescription>
                      {formatNumber(r.qty)} kg · {formatNumber(r.temp, 0)}°C · logged {formatNumber(r.hours_ago)}h ago
                    </CardDescription>
                  </div>
                  <SafetyBadge hours={r.safe_hours} />
                </div>
              </CardHeader>
              <CardContent>
                <SafetyMeter hours={r.safe_hours} />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <ListingsTable
        rows={mine}
        title="Active listings"
        subtitle={`${mine.length} listing${mine.length === 1 ? '' : 's'} still open`}
        emptyTitle="No active listings"
        emptyText="Anything you publish stays here until an NGO claims it."
        onRetract={retractListing}
        onSave={saveListing}
        onOpenChat={setActiveChatFoodId}
      />
    </>
  )
}

/* ========================================================== HISTORY */
export function DonorHistory() {
  const { rows, user, saveListing, setActiveChatFoodId } = useApp()
  const mine = rows.filter((r) => r.donor_name === user.username)
  const claimed = mine.filter((r) => r.is_claimed)

  return (
    <>
      <PageHeader eyebrow="Donor portal" title="Donation history" description="Every listing you have published, and where each one ended up." />

      <ListingsTable
        rows={mine}
        title="All listings"
        subtitle={`${mine.length} listing${mine.length === 1 ? '' : 's'} in total`}
        emptyTitle="No donations yet"
        emptyText="Publish your first listing to start building history."
        allowEdit={false}
        onOpenChat={setActiveChatFoodId}
      />

      {claimed.length ? (
        <section>
          <SectionHeader eyebrow="Rescued" title="Claimed by an NGO" />
          <ListGroup>
            {claimed.map((r) => (
              <ListRow
                key={r.id}
                as="div"
                icon={MessageSquare}
                title={r.food_name}
                subtitle={`${formatNumber(r.qty)} kg · collected by ${r.claimed_by}`}
                accessory={
                  <Button size="sm" variant="secondary" onClick={() => setActiveChatFoodId(r.id)}>
                    Open chat
                  </Button>
                }
              />
            ))}
          </ListGroup>
        </section>
      ) : null}

      <ClaimChat />
    </>
  )
}