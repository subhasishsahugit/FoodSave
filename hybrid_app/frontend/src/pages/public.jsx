import {  useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Bot, ChartBar, Heart, History, Inbox, Navigation, Send, Shield, Trophy, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card,  CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { BarCard, DonutCard, FunnelCard } from '@/components/charts'
import { KpiRow, PageHeader, SectionHeader, StatStrip,  ListGroup } from '@/components/common'
import { SiteFooter } from '@/components/portal'
import { useApp } from '@/lib/store'
import { apiSend } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { toast } from 'sonner'

/* =============================================================== HOME */
export function Home() {
  const { analytics } = useApp()

  const steps = [
    { title: 'Publish your surplus', text: 'Tell us what you have, how much, and how it has been stored. Takes under a minute.' },
    { title: 'Let the model check it', text: 'A random-forest model scores the safe window from temperature, age, category, storage and packaging.' },
    { title: 'An NGO claims it', text: 'Nearby NGOs see it ranked by urgency and distance, claim it, and collect with a pickup pass.' },
  ]

  const features = [
    { icon: Bot, title: 'Real safety scoring', text: 'Every listing is scored on five inputs and re-scored whenever conditions change.' },
    { icon: Navigation, title: 'Proximity matching', text: 'Listings are ranked against your saved location and rescue radius across Odisha.' },
    { icon: Shield, title: 'Pickup passes', text: 'Claiming a listing mints a time-limited pass code so both sides confirm the handover.' },
    { icon: Send, title: 'Direct chat', text: 'Donor and NGO get a private thread per claim with delivery and read receipts.' },
    { icon: ChartBar, title: 'Live impact', text: 'Kilograms, meals and carbon figures update from the database, never from placeholders.' },
    { icon: History, title: 'Audit trail', text: 'Logins, claims, listings and admin actions are all recorded server-side.' },
  ]

  const m = analytics?.metrics

  return (
    <div className="min-h-full">
      <section className="mx-auto w-full max-w-7xl px-4 text-center pt-16 sm:px-6 lg:px-8">
        <p className="hig-eyebrow">Live in Bhubaneswar · 10 cities across Odisha</p>
        <h1 className="hig-display mx-auto mt-4 max-w-4xl text-balance">
          Rescue the food that is still good
        </h1>
        <p className="hig-lead mx-auto mt-6 max-w-2xl text-pretty">
          Surplus food is usually thrown away because nobody can tell whether it is safe, or find it in time. FoodSave
          scores it, matches it, and gets it collected before it spoils.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button size="lg" asChild>
            <Link to="/register">
              <Heart /> Donate surplus food
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/register">
              <Shield /> I run an NGO
            </Link>
          </Button>
        </div>
        <p className="mt-5 text-xs text-muted-foreground">No card required · Demo accounts on the sign-in page</p>

        {m ? (
          <div className="mt-14">
            <StatStrip
              items={[
                { value: `${formatNumber(m.waste_diverted_kg)} kg`, label: 'Food rescued from waste' },
                { value: formatNumber(m.meals_rescued), label: 'Meals enabled' },
                { value: `${formatNumber(m.co2e_avoided_kg)} kg`, label: 'CO₂e avoided (est.)' },
                { value: formatNumber(m.available_listings), label: 'Listings live right now' },
              ]}
            />
          </div>
        ) : null}
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 mt-20 sm:px-6 lg:px-8">
        <SectionHeader eyebrow="How it works" title="Three steps, start to finish" />
        <div className="grid gap-3 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="hig-panel !p-5">
              <span className="mb-3 inline-flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <h3 className="!text-[17px] font-[590] tracking-[-0.011em]">{s.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 mt-20 sm:px-6 lg:px-8">
        <SectionHeader eyebrow="Platform" title="Built for the whole handover" />
        <div className="grid gap-3 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="hig-panel !p-5">
              <span className="mb-3 inline-flex size-9 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                <f.icon className="size-[18px]" />
              </span>
              <h3 className="!text-[17px] font-[590] tracking-[-0.011em]">{f.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 mt-20 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[var(--hig-separator)] bg-muted/50 px-6 py-14 text-center sm:px-10">
          <h2 className="hig-display-2 mx-auto max-w-2xl text-balance">Start rescuing food today</h2>
          <p className="hig-lead mx-auto mt-4 max-w-xl text-pretty">
            Create a donor or NGO account in under a minute and publish or claim your first listing.
          </p>
          <Button size="lg" className="mt-8" asChild>
            <Link to="/register">
              Create an account
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}

/* ============================================================== ABOUT */
export function About() {
  const principles = [
    { title: 'Safety is a decision, not a guess', text: 'Donors should know whether food can be donated without guessing. The model turns temperature, age, category, storage and packaging into one number they can act on.' },
    { title: 'Urgency beats availability', text: 'A listing with four safe hours is worth more to an NGO than one with twenty, even if it is further away. The queue is ranked on time, not just distance.' },
    { title: 'The handover has to be provable', text: 'Claims mint a time-limited pickup pass so both sides can confirm that the food changed hands, and who collected it.' },
  ]

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="pt-14">
        <PageHeader
          eyebrow="About"
          title="FoodSave"
          description="A food rescue platform built around one question: can this food still be eaten by someone who needs it?"
        />
        <div className="mt-8 max-w-2xl space-y-4 text-[17px] leading-[1.55] tracking-[-0.011em] text-muted-foreground">
          <p>
            Every day, edible surplus food is thrown away — because nobody can judge its safety quickly, or because
            there is no reliable way to connect a donor holding it with an organisation that needs it within the next
            few hours.
          </p>
          <p>
            FoodSave closes that gap. Donors publish surplus in under a minute. A machine-learning model scores the
            safe window from the conditions they report. Nearby NGOs see the freshest, most urgent listings first,
            claim one, collect it with a pickup pass, and coordinate the handover over a private thread.
          </p>
        </div>
      </div>

      <div className="mt-14">
        <SectionHeader eyebrow="Principles" title="What we optimise for" />
        <div className="grid gap-3 md:grid-cols-3">
          {principles.map((p) => (
            <div key={p.title} className="hig-panel !p-5">
              <h3 className="!text-[17px] font-[590] tracking-[-0.011em]">{p.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{p.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-20 mb-16 rounded-2xl border border-[var(--hig-separator)] bg-muted/50 px-6 py-12 text-center sm:px-10">
        <h2 className="hig-display-2 mx-auto max-w-2xl text-balance">See the numbers</h2>
        <p className="hig-lead mx-auto mt-4 max-w-xl text-pretty">
          Every figure on our impact page comes from live data in this instance.
        </p>
        <Button size="lg" variant="outline" className="mt-8" asChild>
          <Link to="/impact">
            View impact
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  )
}

/* ============================================================ IMPACT */
export function Impact() {
  const { analytics, rows } = useApp()
  const m = analytics?.metrics
  const open = (rows || []).filter((r) => !r.is_claimed)

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
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="pt-14">
        <PageHeader
          eyebrow="Impact"
          title="Measured, not estimated"
          description="Every number below is computed from the listings and claims recorded in this FoodSave instance. Nothing here is hard-coded."
        />
        {m ? (
          <div className="mt-8">
            <KpiRow
              items={[
                { label: 'Food diverted from waste', value: `${formatNumber(m.waste_diverted_kg)} kg`, icon: Heart },
                { label: 'Meals enabled', value: formatNumber(m.meals_rescued), icon: Inbox },
                { label: 'People served (est.)', value: formatNumber(m.people_served_est), icon: Users },
                { label: 'CO₂e avoided (est.)', value: `${formatNumber(m.co2e_avoided_kg)} kg`, icon: Bot },
              ]}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-8 grid items-start gap-4 lg:grid-cols-2">
        <BarCard
          title="Donor contribution"
          description="Kilograms published, top donors"
          data={analytics?.donor_volume ?? []}
          xKey="name"
          yKey="qty"
          color="var(--chart-2)"
          caption="Source: /api/analytics → donor_volume"
        />
        <DonutCard
          title="Claims by NGO"
          description="Share of completed rescues"
          data={(analytics?.ngo_claims ?? []).filter((n) => n.name !== 'Unclaimed')}
          nameKey="name"
          valueKey="claims"
          center={m ? formatNumber(m.claimed_listings) : undefined}
          caption="Source: /api/analytics → ngo_claims"
        />
        <BarCard
          title="Available listings by safety window"
          description="How much time NGOs actually have"
          data={bands}
          color="var(--chart-3)"
          caption="Source: /api/food/all → safe_hours"
        />
        <FunnelCard
          title="Rescue pipeline"
          description="From published to collected"
          stages={[
            { label: 'Listings published', value: m?.total_listings ?? 0 },
            { label: 'Available now', value: m?.available_listings ?? 0 },
            { label: 'Still safe (< 3h)', value: m?.high_risk_available ?? 0 },
            { label: 'Claimed & collected', value: m?.claimed_listings ?? 0 },
          ]}
          caption="Source: /api/analytics → metrics"
        />
      </div>

      <div className="mt-20 mb-16 rounded-2xl border border-[var(--hig-separator)] bg-muted/50 px-6 py-12 text-center sm:px-10">
        <h2 className="hig-display-2 mx-auto max-w-2xl text-balance">Add to the numbers</h2>
        <p className="hig-lead mx-auto mt-4 max-w-xl text-pretty">
          Publish surplus food and this page updates within seconds.
        </p>
        <Button size="lg" className="mt-8" asChild>
          <Link to="/register">
            Start donating
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  )
}

/* ======================================================= LEADERBOARD */
export function Leaderboard() {
  const { analytics, user } = useApp()
  const donors = analytics?.donor_volume ?? []
  const ngos = (analytics?.ngo_claims ?? []).filter((n) => n.name !== 'Unclaimed')

  function Podium({ title, rows, metric }) {
    const max = rows.length ? (metric === 'claims' ? rows[0].claims : rows[0].qty) : 1
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{metric === 'claims' ? 'By completed claims' : 'By kilograms published'}</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <Empty className="py-10">
              <EmptyHeader>
                <EmptyTitle>No rankings yet</EmptyTitle>
                <EmptyDescription>Rankings appear once activity starts.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ol className="space-y-0">
              {rows.map((row, i) => {
                const value = metric === 'claims' ? row.claims : row.qty
                return (
                  <li key={row.name} className="hig-row !items-start !border-b !border-[var(--hig-separator)] last:!border-b-0">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--hig-fill-tertiary)] text-[10px] font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="hig-row__title truncate">{row.name}</span>
                        <span className="shrink-0 text-[13px] font-[590] tabular-nums">
                          {metric === 'claims' ? `${value} claims` : `${formatNumber(value)} kg`}
                        </span>
                      </span>
                      <span className="hig-meter mt-1.5 block">
                        <span
                          className="hig-meter__fill block"
                          style={{ width: `${max ? Math.max(3, (value / max) * 100) : 0}%`, background: `var(--chart-${(i % 5) + 1})` }}
                        />
                      </span>
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="pt-14">
        <PageHeader
          eyebrow="Community"
          title="Leaderboard"
          description="Ranked from actual listing and claim records — no synthetic trends, no demo numbers."
        />
        <div className="mt-8 grid items-start gap-4 lg:grid-cols-2">
          <Podium title="Top donors" rows={donors} metric="qty" />
          <Podium title="Top NGOs" rows={ngos} metric="claims" />
        </div>
      </div>

      <div className="mt-14 mb-16">
        <SectionHeader eyebrow="Your standing" title="Where you sit" />
        <Card>
          <CardContent>
            {user ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="hig-stat">
                  <p className="hig-stat__label">Your role</p>
                  <p className="hig-stat__value !text-[22px]">
                    {user.role === 'DONOR' ? 'Donor' : user.role === 'NGO' ? 'NGO' : 'Admin'}
                  </p>
                </div>
                <div className="hig-stat">
                  <p className="hig-stat__label">
                    {user.role === 'DONOR' ? 'Your published volume' : 'Your claims'}
                  </p>
                  <p className="hig-stat__value !text-[22px]">
                    {user.role === 'DONOR'
                      ? `${formatNumber(donors.find((d) => d.name === user.username)?.qty ?? 0)} kg`
                      : formatNumber(ngos.find((n) => n.name === user.username)?.claims ?? 0)}
                  </p>
                </div>
                <div className="flex items-center">
                  <Button asChild>
                    <Link to="/home">
                      Go to your dashboard
                      <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Trophy />
                  </EmptyMedia>
                  <EmptyTitle>Sign in to see your standing</EmptyTitle>
                  <EmptyDescription>Create an account to start earning a place on the board.</EmptyDescription>
                </EmptyHeader>
                <div className="flex gap-2">
                  <Button variant="outline" asChild>
                    <Link to="/login">Sign in</Link>
                  </Button>
                  <Button asChild>
                    <Link to="/register">Get started</Link>
                  </Button>
                </div>
              </Empty>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* =========================================================== CONTACT */
export function Contact() {
  const { user } = useApp()
  const [values, setValues] = useState({ name: '', email: '', message: '' })
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  function submit(e) {
    e.preventDefault()
    if (!values.email || !values.message) {
      toast.error('Email and message are required.')
      return
    }
    setBusy(true)
    apiSend('/api/support', 'POST', values)
      .then(() => {
        setSent(true)
        setValues({ name: '', email: '', message: '' })
      })
      .catch((err) => toast.error('Could not send your message.', { description: err.message }))
      .finally(() => setBusy(false))
  }

  const faqs = [
    ['Can any organisation use FoodSave?', 'Yes. Create an account and pick the role that matches you — donor or NGO. Admins manage users and can promote accounts.'],
    ['How is the safe window decided?', 'A random-forest regressor scores temperature, hours since preparation, food category, storage conditions and packaging. The score updates whenever a donor edits those inputs.'],
    ['Which cities are supported?', 'Ten cities across Odisha, from Bhubaneswar and Cuttack to Jeypore. Distances are computed from each account’s saved coordinates.'],
  ]

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="pt-14">
        <PageHeader
          eyebrow="Contact"
          title="Talk to us"
          description="Partnerships, NGO onboarding, press, or a bug you found — this reaches the platform team directly."
        />
        <div className="mt-8 grid items-start gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Send a message</CardTitle>
              <CardDescription>We typically reply within one working day.</CardDescription>
            </CardHeader>
            <CardContent>
              {sent ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>Message sent</EmptyTitle>
                    <EmptyDescription>Thanks — your message reached the team. We reply by email.</EmptyDescription>
                  </EmptyHeader>
                  <Button variant="outline" onClick={() => setSent(false)}>
                    Send another
                  </Button>
                </Empty>
              ) : (
                <form onSubmit={submit} className="grid gap-4">
                  <Field>
                    <FieldLabel htmlFor="contact-name">Your name</FieldLabel>
                    <Input id="contact-name" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} placeholder="Priya Devi" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="contact-email">
                      Email <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input id="contact-email" type="email" required value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} placeholder="you@example.org" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="contact-message">
                      Message <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Textarea id="contact-message" required rows={6} value={values.message} onChange={(e) => setValues({ ...values, message: e.target.value })} placeholder="How can we help?" />
                    <FieldDescription>Tell us which city you operate in if it is relevant.</FieldDescription>
                  </Field>
                  <Button type="submit" disabled={busy} className="w-fit">
                    <Send /> Send message
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Common questions</CardTitle>
              </CardHeader>
              <CardContent className="!p-0">
                <ListGroup className="!rounded-none !border-0">
                  {faqs.map(([q, a]) => (
                    <div key={q} className="hig-row !flex-col !items-start !gap-0 !py-3.5">
                      <p className="hig-row__title !font-[590]">{q}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{a}</p>
                    </div>
                  ))}
                </ListGroup>
              </CardContent>
            </Card>
            {!user ? (
              <Card>
                <CardHeader>
                  <CardTitle>Ready to try it?</CardTitle>
                  <CardDescription>Demo accounts are seeded in this instance.</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Button variant="outline" asChild>
                    <Link to="/login">Sign in</Link>
                  </Button>
                  <Button asChild>
                    <Link to="/register">Create account</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}