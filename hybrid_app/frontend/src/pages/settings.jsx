import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Bell, Navigation, MapPin, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { PageHeader, ListGroup } from '@/components/common'
import { apiGet, apiSend } from '@/lib/api'
import { useApp } from '@/lib/store'
import { formatNumber } from '@/lib/format'

function useSettings(username) {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    apiGet(`/api/settings/profile?username=${encodeURIComponent(username)}`)
      .then((res) => {
        if (!alive) return
        setSettings(res.settings || {})
        setLoading(false)
      })
      .catch(() => {
        if (!alive) return
        setSettings({})
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [username])

  const save = async (patch) => {
    const next = { ...settings, ...patch }
    await apiSend('/api/settings/profile', 'PUT', { username, values: next })
    setSettings(next)
    return next
  }

  return { settings, loading, save }
}

function SaveBar({ busy, onSave, hint }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-[var(--hig-separator)] pt-4">
      <span className="text-xs text-muted-foreground">{hint || 'Changes apply immediately.'}</span>
      <Button onClick={onSave} disabled={busy}>
        <Save /> Save changes
      </Button>
    </div>
  )
}

/* =========================================================== PROFILE */
export function ProfileSettings() {
  const { user } = useApp()
  const { settings, loading, save } = useSettings(user.username)
  const [values, setValues] = useState({ org_name: '', phone: '', avatar: '', timezone: 'Asia/Kolkata' })
  const [busy, setBusy] = useState(false)
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current || loading) return
    loaded.current = true
    setValues({
      org_name: settings.org_name || '',
      phone: settings.phone || '',
      avatar: settings.avatar || '',
      timezone: settings.timezone || 'Asia/Kolkata',
    })
  }, [loading, settings])

  const timezones = ['Asia/Kolkata', 'UTC', 'Europe/London', 'America/New_York', 'Asia/Dubai', 'Asia/Singapore']

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Profile settings"
        description="How your organisation appears to donors, NGOs and administrators."
      />
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Organisation details</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-full bg-[var(--hig-fill-secondary)] text-[19px] font-[590]">
                  {user.username.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <p className="!text-[17px] font-[590] tracking-[-0.011em]">{user.username}</p>
                  <p className="text-[13px] text-muted-foreground">
                    Signed in as {user.role === 'DONOR' ? 'a donor' : user.role === 'NGO' ? 'an NGO' : 'an administrator'}
                  </p>
                </div>
              </div>
              <Field>
                <FieldLabel htmlFor="org-name">Organisation name</FieldLabel>
                <Input id="org-name" placeholder="Sai Annapurna Trust" value={values.org_name} onChange={(e) => setValues({ ...values, org_name: e.target.value })} />
                <FieldDescription>Shown on every listing you publish.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="org-phone">Phone</FieldLabel>
                <Input id="org-phone" placeholder="+91 98765 43210" value={values.phone} onChange={(e) => setValues({ ...values, phone: e.target.value })} />
              </Field>
              <Field>
                <FieldLabel htmlFor="org-avatar">Avatar URL</FieldLabel>
                <Input id="org-avatar" placeholder="https://…" value={values.avatar} onChange={(e) => setValues({ ...values, avatar: e.target.value })} />
                <FieldDescription>Optional image URL used in the sidebar and leaderboard.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="org-tz">Timezone</FieldLabel>
                <Select value={values.timezone} onValueChange={(v) => setValues({ ...values, timezone: v })}>
                  <SelectTrigger id="org-tz">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <SaveBar
                busy={busy}
                onSave={() => {
                  setBusy(true)
                  save(values)
                    .then(() => toast.success('Profile updated', { description: 'Your details were saved.' }))
                    .catch((err) => toast.error('Could not save', { description: err.message }))
                    .finally(() => setBusy(false))
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

/* =========================================================== LOCATION */
export function LocationSettings() {
  const { user, refresh } = useApp()
  const { settings, loading, save } = useSettings(user.username)
  const [cities, setCities] = useState([])
  const [values, setValues] = useState({ city: '', latitude: 20.2961, longitude: 85.8245, radius_km: 15 })
  const [busy, setBusy] = useState(false)
  const [locating, setLocating] = useState(false)
  const loaded = useRef(false)

  useEffect(() => {
    apiGet('/api/cities')
      .then((res) => setCities(res.cities || []))
      .catch(() => setCities([]))
  }, [])

  useEffect(() => {
    if (loaded.current || loading) return
    loaded.current = true
    setValues({
      city: '',
      latitude: settings.latitude != null ? settings.latitude : 20.2961,
      longitude: settings.longitude != null ? settings.longitude : 85.8245,
      radius_km: settings.radius_km != null ? settings.radius_km : 15,
    })
  }, [loading, settings])

  function useLocation() {
    if (!navigator.geolocation) {
      toast.error('Not supported', { description: 'This browser cannot share a location.' })
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        let nearest = cities[0]
        let best = Infinity
        cities.forEach((c) => {
          const d = (c.lat - latitude) ** 2 + (c.lng - longitude) ** 2
          if (d < best) {
            best = d
            nearest = c
          }
        })
        setValues({
          city: nearest ? nearest.name : values.city,
          latitude: Number(latitude.toFixed(6)),
          longitude: Number(longitude.toFixed(6)),
          radius_km: values.radius_km,
        })
        setLocating(false)
      },
      () => {
        toast.error('Location unavailable', { description: 'Pick a city manually instead.' })
        setLocating(false)
      },
      { timeout: 8000 },
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Location settings"
        description="Where you are and how far you are willing to travel for a pickup."
      />
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Rescue location</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <div className="grid gap-4">
              <Field>
                <FieldLabel htmlFor="loc-city">City</FieldLabel>
                <Select
                  value={values.city || '__custom'}
                  onValueChange={(v) => {
                    if (v === '__custom') return
                    const city = cities.find((c) => c.name === v)
                    if (city) setValues((prev) => ({ ...prev, city: city.name, latitude: city.lat, longitude: city.lng }))
                  }}
                >
                  <SelectTrigger id="loc-city">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__custom">Custom coordinates</SelectItem>
                    {cities.map((c) => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>Supported cities come straight from the server.</FieldDescription>
              </Field>

              <Button variant="outline" className="w-fit" onClick={useLocation} disabled={locating}>
                <Navigation /> Use my current location
              </Button>

              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="loc-lat">Latitude</FieldLabel>
                  <Input
                    id="loc-lat"
                    type="number"
                    step="any"
                    value={values.latitude}
                    onChange={(e) => setValues((v) => ({ ...v, latitude: e.target.value, city: '' }))}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="loc-lng">Longitude</FieldLabel>
                  <Input
                    id="loc-lng"
                    type="number"
                    step="any"
                    value={values.longitude}
                    onChange={(e) => setValues((v) => ({ ...v, longitude: e.target.value, city: '' }))}
                  />
                </Field>
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <p className="text-[15px] font-[590] tracking-[-0.008em]">Rescue radius</p>
                  <p className="text-[15px] font-[590] tabular-nums">{Number(values.radius_km)} km</p>
                </div>
                <Slider
                  value={[Number(values.radius_km)]}
                  min={1}
                  max={50}
                  step={1}
                  onValueChange={([v]) => setValues((prev) => ({ ...prev, radius_km: v }))}
                  aria-label="Rescue radius"
                />
                <div className="grid grid-cols-3 items-baseline text-xs text-muted-foreground tabular-nums">
                  <span>1km</span>
                  <span className="text-center">15km</span>
                  <span className="text-right">50km</span>
                </div>
              </div>

              <div className="hig-row !py-0 !pr-0">
                <span className="hig-row__icon">
                  <MapPin className="size-4" />
                </span>
                <span className="hig-row__body">
                  <span className="hig-row__title block">Coverage preview</span>
                  <span className="hig-row__subtitle block">Listings within this radius are matched to you.</span>
                </span>
                <span className="hig-row__accessory text-[15px] font-[590] tabular-nums">
                  {formatNumber(values.radius_km)} km
                </span>
              </div>

              <SaveBar
                busy={busy}
                hint="Distances to listings are computed with the haversine formula."
                onSave={() => {
                  setBusy(true)
                  save({
                    latitude: Number(values.latitude),
                    longitude: Number(values.longitude),
                    radius_km: Number(values.radius_km),
                  })
                    .then(() => {
                      toast.success('Location saved', { description: 'Matching now uses this radius.' })
                      refresh()
                    })
                    .catch((err) => toast.error('Could not save', { description: err.message }))
                    .finally(() => setBusy(false))
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

/* ============================================================ ALERTS */
export function AlertSettings() {
  const { user } = useApp()
  const { settings, loading, save } = useSettings(user.username)
  const [values, setValues] = useState({ alert_email: true, alert_sms: false, alert_critical: true, risk_threshold: 2 })
  const [busy, setBusy] = useState(false)
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current || loading) return
    loaded.current = true
    setValues({
      alert_email: settings.alert_email !== false,
      alert_sms: !!settings.alert_sms,
      alert_critical: settings.alert_critical !== false,
      risk_threshold: settings.risk_threshold != null ? settings.risk_threshold : 2,
    })
  }, [loading, settings])

  const rows = [
    ['alert_email', Bell, 'Email alerts', 'Notify me when new food matches my rescue radius.'],
    ['alert_sms', Bell, 'SMS alerts', 'Send a text for listings inside one hour of expiry.'],
    ['alert_critical', Bell, 'Critical only', 'Only notify me about listings that are about to expire.'],
  ]

  return (
    <>
      <PageHeader eyebrow="Account" title="Alert settings" description="Choose how urgently FoodSave should reach you." />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="!p-0">
          {loading ? (
            <div className="grid gap-2 p-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <ListGroup className="!rounded-none !border-0 !border-t !border-t-[var(--hig-separator)]">
              {rows.map(([key, Icon, title, desc]) => (
                <div key={key} className="hig-row">
                  <span className="hig-row__icon">
                    <Icon className="size-4" />
                  </span>
                  <span className="hig-row__body">
                    <span className="hig-row__title block !font-[590]">{title}</span>
                    <span className="hig-row__subtitle block !whitespace-normal">{desc}</span>
                  </span>
                  <Switch
                    checked={values[key]}
                    onCheckedChange={(v) => setValues((prev) => ({ ...prev, [key]: v }))}
                    aria-label={title}
                    className="shrink-0"
                  />
                </div>
              ))}
            </ListGroup>
          )}
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Risk threshold</CardTitle>
          <CardDescription>Used to classify listings as high risk</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <p className="text-[15px] font-[590] tracking-[-0.008em]">Flag listings at or below</p>
              <p className="text-[15px] font-[590] tabular-nums">{Number(values.risk_threshold)}h</p>
            </div>
            <Slider
              value={[Number(values.risk_threshold)]}
              min={1}
              max={12}
              step={1}
              onValueChange={([v]) => setValues((prev) => ({ ...prev, risk_threshold: v }))}
              aria-label="Risk threshold"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Anything scoring {Number(values.risk_threshold)}h or less is treated as high risk across the platform.
          </p>
          <SaveBar
            busy={busy}
            onSave={() => {
              setBusy(true)
              save({
                alert_email: values.alert_email,
                alert_sms: values.alert_sms,
                alert_critical: values.alert_critical,
                risk_threshold: Number(values.risk_threshold),
              })
                .then(() => toast.success('Alerts updated', { description: 'Your preferences were saved.' }))
                .catch((err) => toast.error('Could not save', { description: err.message }))
                .finally(() => setBusy(false))
            }}
          />
        </CardContent>
      </Card>
    </>
  )
}