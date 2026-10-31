import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Eye, EyeOff, Shield, Sparkles, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription,  FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Brand } from '@/components/brand'
import { ListGroup, ListRow } from '@/components/common'
import { SiteFooter } from '@/components/portal'
import { apiGet, apiSend } from '@/lib/api'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'

const STEPS = [
  { icon: Wand2, title: 'Describe the surplus', text: 'Food type, weight, temperature, storage and packaging.' },
  { icon: Sparkles, title: 'Get a safety score', text: 'The model returns a safe window in hours, instantly.' },
  { icon: Shield, title: 'Matched and collected', text: 'Nearby NGOs claim it and collect with a pickup pass.' },
]

function AuthAside({ eyebrow, title, description }) {
  return (
    <aside className="sticky top-24 hidden flex-col gap-8 lg:flex">
      <Brand />
      <div>
        <p className="hig-eyebrow">{eyebrow}</p>
        <h2 className="mt-2 !text-[28px] !leading-[1.18] !font-bold !tracking-[-0.02em] text-balance">{title}</h2>
        <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <ol className="space-y-5">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
              <s.icon className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-[590] tracking-[-0.008em]">
                {i + 1}. {s.title}
              </p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  )
}

function PasswordInput({ id, value, onChange, placeholder, autoComplete, ...rest }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="!pr-10"
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute top-1/2 right-1 -translate-y-1/2 rounded p-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

function AuthLayout({
  eyebrow = 'How FoodSave works',
  asideTitle = 'Move surplus food before it moves to waste',
  asideText,
  title,
  subtitle,
  children,
  footer,
}) {
  return (
    <div className="min-h-full">
      <div className="mx-auto grid w-full max-w-6xl items-start gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8">
        <AuthAside eyebrow={eyebrow} title={asideTitle} description={asideText} />
        <div className="w-full max-w-md justify-self-center lg:justify-self-end">
          <h1 className="!text-[28px] !leading-[1.18] !font-bold !tracking-[-0.02em]">{title}</h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{subtitle}</p>
          <div className="mt-7">{children}</div>
          {footer ? (
            <div className="mt-7 border-t border-[var(--hig-separator)] pt-5 text-center text-[13px] text-muted-foreground">
              {footer}
            </div>
          ) : null}
          <div className="mt-4 text-center text-[13px] text-muted-foreground">
            <Link to="/home" className="inline-flex items-center gap-1 hover:text-foreground">
              <ArrowLeft className="size-3.5" /> Back to home
            </Link>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}

/* ------------------------------------------------------------- LOGIN */
export function Login() {
  const { login } = useApp()
  const navigate = useNavigate()
  const [values, setValues] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function submit(e) {
    e.preventDefault()
    if (!values.username || !values.password) {
      setError('Enter both your username and password.')
      return
    }
    setBusy(true)
    setError('')
    login(values.username, values.password)
      .then((user) => navigate(user.role === 'DONOR' ? '/donor/dashboard' : user.role === 'NGO' ? '/ngo/dashboard' : '/admin/overview'))
      .catch((err) => {
        setError(err.message)
        setBusy(false)
      })
  }

  const demo = (username) => {
    setBusy(true)
    setError('')
    login(username, 'pass123')
      .then((user) => navigate(user.role === 'DONOR' ? '/donor/dashboard' : user.role === 'NGO' ? '/ngo/dashboard' : '/admin/overview'))
      .catch((err) => {
        setError(err.message)
        setBusy(false)
      })
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to publish surplus, claim food or manage the platform."
      asideText="Every account is scoped to a role. Donors publish, NGOs claim, admins oversee — each with its own workspace."
      footer={
        <>
          New to FoodSave?{' '}
          <Link to="/register" className="text-foreground underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4">
        {error ? (
          <div role="alert" className="hig-alert hig-alert--error">
            {error}
          </div>
        ) : null}
        <Field>
          <FieldLabel htmlFor="login-username">Username</FieldLabel>
          <Input
            id="login-username"
            autoComplete="username"
            placeholder="donor1"
            value={values.username}
            onChange={(e) => setValues({ ...values, username: e.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="login-password">Password</FieldLabel>
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={values.password}
            onChange={(e) => setValues({ ...values, password: e.target.value })}
          />
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" disabled={busy}>
          Sign in
          <ArrowRight />
        </Button>
      </form>

      <Card className="mt-7">
        <CardHeader>
          <CardTitle>Demo accounts</CardTitle>
          <CardDescription>Seeded in this instance — one click to sign in</CardDescription>
        </CardHeader>
        <CardContent className="!p-0">
          <ListGroup className="!rounded-none !border-0 !border-t !border-t-[var(--hig-separator)]">
            {[
              ['donor1', 'Donor', 'Publish surplus and track rescues'],
              ['ngo1', 'NGO', 'Claim food and manage pickups'],
            ].map(([user, role, text]) => (
              <ListRow
                key={user}
                as="div"
                title={user}
                subtitle={text}
                accessory={
                  <>
                    <Badge variant="secondary">{role}</Badge>
                    <Button size="sm" variant="outline" onClick={() => demo(user)}>
                      Use
                    </Button>
                  </>
                }
              />
            ))}
          </ListGroup>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}

/* ---------------------------------------------------------- REGISTER */
export function Register() {
  const { register } = useApp()
  const navigate = useNavigate()
  const [values, setValues] = useState({ username: '', password: '', role: 'DONOR', city: 'Bhubaneswar' })
  const [cities, setCities] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    apiGet('/api/cities')
      .then((data) => setCities(data.cities || []))
      .catch(() => setCities([]))
  }, [])

  const strength = [values.password.length >= 6, values.password.length >= 10, /[A-Z]/.test(values.password) && /[0-9]/.test(values.password)].filter(Boolean).length

  function submit(e) {
    e.preventDefault()
    if (!values.username || values.password.length < 6) {
      setError('Pick a username and a password of at least 6 characters.')
      return
    }
    setBusy(true)
    setError('')
    register(values)
      .then((user) => navigate(user.role === 'DONOR' ? '/donor/dashboard' : '/ngo/dashboard'))
      .catch((err) => {
        setError(err.message)
        setBusy(false)
      })
  }

  function useLocation() {
    if (!navigator.geolocation) {
      setError('This browser cannot share a location.')
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
        if (nearest) setValues((v) => ({ ...v, city: nearest.name }))
        setLocating(false)
      },
      () => {
        setError('Could not read your location. Pick a city manually.')
        setLocating(false)
      },
      { timeout: 8000 },
    )
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="It takes about thirty seconds."
      asideText="Pick the role that matches how you will use FoodSave. You can start with one role and switch later."
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4">
        {error ? (
          <div role="alert" className="hig-alert hig-alert--error">
            {error}
          </div>
        ) : null}
        <Field>
          <FieldLabel htmlFor="reg-username">
            Username <span className="text-destructive">*</span>
          </FieldLabel>
          <Input id="reg-username" autoComplete="username" placeholder="your-name" value={values.username} onChange={(e) => setValues({ ...values, username: e.target.value })} />
        </Field>
        <Field>
          <FieldLabel htmlFor="reg-password">
            Password <span className="text-destructive">*</span>
          </FieldLabel>
          <PasswordInput
            id="reg-password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={values.password}
            onChange={(e) => setValues({ ...values, password: e.target.value })}
          />
          <FieldDescription>
            {values.password
              ? `Strength: ${['', 'weak', 'fair', 'strong'][strength]}`
              : 'At least 6 characters.'}
          </FieldDescription>
          {values.password ? (
            <div className="flex gap-1" aria-hidden="true">
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1 flex-1 rounded-full bg-[var(--hig-fill-tertiary)] transition-colors',
                    strength >= i && (strength === 1 ? 'bg-destructive' : strength === 2 ? 'bg-[var(--caution)]' : 'bg-[var(--safe)]'),
                  )}
                />
              ))}
            </div>
          ) : null}
        </Field>
        <Field>
          <FieldLabel>I am a</FieldLabel>
          <RadioGroup
            value={values.role}
            onValueChange={(v) => setValues({ ...values, role: v })}
            className="grid grid-cols-2 gap-2"
          >
            <Label className="hig-choice">
              <RadioGroupItem value="DONOR" id="role-donor" />
              <span className="text-[15px]">Donor</span>
            </Label>
            <Label className="hig-choice">
              <RadioGroupItem value="NGO" id="role-ngo" />
              <span className="text-[15px]">NGO</span>
            </Label>
          </RadioGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor="reg-city">City</FieldLabel>
          <Select value={values.city} onValueChange={(v) => setValues({ ...values, city: v })}>
            <SelectTrigger id="reg-city">
              <SelectValue placeholder="Select a city" />
            </SelectTrigger>
            <SelectContent>
              {cities.map((c) => (
                <SelectItem key={c.name} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>Used to match you with food nearby.</FieldDescription>
        </Field>
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={useLocation} disabled={locating}>
          Use my current location
        </Button>
        <Button type="submit" size="lg" disabled={busy}>
          Create account
          <ArrowRight />
        </Button>
      </form>
    </AuthLayout>
  )
}

/* ------------------------------------------------------ FORGOT PASSWORD */
export function ForgotPassword() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function submit(e) {
    e.preventDefault()
    if (!username) {
      setError('Enter the username on your account.')
      return
    }
    setBusy(true)
    setError('')
    apiSend('/api/auth/forgot-password', 'POST', { username })
      .then((data) => {
        setResult(data)
        setBusy(false)
      })
      .catch((err) => {
        setError(err.message)
        setBusy(false)
      })
  }

  return (
    <AuthLayout
      eyebrow="Account recovery"
      title="Reset your password"
      subtitle="We generate a single-use reset link valid for 30 minutes."
      asideTitle="Locked out? It happens"
      asideText="Reset links in this build are generated on demand and can be used once. Open the link, choose a new password, and you are back in."
      footer={
        <>
          Remembered it?{' '}
          <Link to="/login" className="text-foreground underline underline-offset-4">
            Back to sign in
          </Link>
        </>
      }
    >
      {result ? (
        <Card>
          <CardHeader>
            <CardTitle>Reset link ready</CardTitle>
            <CardDescription>{result.message}</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={() => navigate(`/reset-password/${result.token || ''}`)}>Open reset form</Button>
            <Button variant="ghost" onClick={() => setResult(null)}>
              Start over
            </Button>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={submit} className="grid gap-4">
          {error ? (
            <div role="alert" className="hig-alert hig-alert--error">
              {error}
            </div>
          ) : null}
          <Field>
            <FieldLabel htmlFor="forgot-username">
              Username <span className="text-destructive">*</span>
            </FieldLabel>
            <Input id="forgot-username" autoComplete="username" placeholder="donor1" value={username} onChange={(e) => setUsername(e.target.value)} />
          </Field>
          <Button type="submit" size="lg" disabled={busy}>
            Generate reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}

/* ------------------------------------------------------ RESET PASSWORD */
export function ResetPassword({ token: initialToken = '' }) {
  const navigate = useNavigate()
  const [token, setToken] = useState(initialToken)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  function submit(e) {
    e.preventDefault()
    if (!token) {
      setError('This reset link is missing its token. Generate a new one.')
      return
    }
    if (password.length < 6) {
      setError('Choose a password of at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Both passwords must match.')
      return
    }
    setBusy(true)
    setError('')
    apiSend('/api/auth/reset-password', 'POST', { token, new_password: password })
      .then(() => {
        setDone(true)
        setBusy(false)
      })
      .catch((err) => {
        setError(err.message)
        setBusy(false)
      })
  }

  return (
    <AuthLayout
      eyebrow="Account recovery"
      title="Choose a new password"
      subtitle="One change, and you are back in."
      asideTitle="Almost there"
      asideText="Pick something you have not used here before. Reset tokens expire after 30 minutes and can only be redeemed once."
      footer={
        <>
          Need a new link?{' '}
          <Link to="/forgot-password" className="text-foreground underline underline-offset-4">
            Request one
          </Link>
        </>
      }
    >
      {done ? (
        <Card>
          <CardHeader>
            <CardTitle>Password updated</CardTitle>
            <CardDescription>Your new password is active.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/login')}>Go to sign in</Button>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={submit} className="grid gap-4">
          {error ? (
            <div role="alert" className="hig-alert hig-alert--error">
              {error}
            </div>
          ) : null}
          {!initialToken ? (
            <Field>
              <FieldLabel htmlFor="reset-token">
                Reset token <span className="text-destructive">*</span>
              </FieldLabel>
              <Input id="reset-token" placeholder="Paste token" value={token} onChange={(e) => setToken(e.target.value)} />
              <FieldDescription>Paste the token from your reset link.</FieldDescription>
            </Field>
          ) : null}
          <Field>
            <FieldLabel htmlFor="reset-password">
              New password <span className="text-destructive">*</span>
            </FieldLabel>
            <PasswordInput id="reset-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="reset-confirm">
              Confirm password <span className="text-destructive">*</span>
            </FieldLabel>
            <PasswordInput id="reset-confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <Button type="submit" size="lg" disabled={busy}>
            Update password
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}