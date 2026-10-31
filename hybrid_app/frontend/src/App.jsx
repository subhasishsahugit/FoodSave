import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell, PublicNav } from '@/components/shell'
import { useApp } from '@/lib/store'
import { DEFAULT_ROUTE, ROLE_NAV, SETTINGS_NAV, SHARED_ROUTES } from '@/lib/routes'

const SETTINGS_ROUTES = SETTINGS_NAV.map((s) => s.to)
import { Home, About, Impact, Leaderboard, Contact } from '@/pages/public'
import { Login, Register, ForgotPassword, ResetPassword } from '@/pages/auth'
import { DonorActive, DonorDashboard, Donate, DonorHistory } from '@/pages/donor'
import {
  NgoActiveClaims,
  NgoAiAdvisor,
  NgoDashboard,
  NgoHistory,
  NgoLiveFeed,
  NgoMapView,
} from '@/pages/ngo'
import { AdminAiLogs, AdminOverview, AdminUsers } from '@/pages/admin'
import { AlertSettings, LocationSettings, ProfileSettings } from '@/pages/settings'
import { Visualizations } from '@/pages/visualizations'

function homeFor(user) {
  return user ? DEFAULT_ROUTE[user.role] || '/home' : '/home'
}

/** Blocks a route unless the session satisfies it. */
function Guard({ user, roles, children }) {
  const location = useLocation()
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />
  return children
}

function GuestOnly({ user, children }) {
  if (user) return <Navigate to={homeFor(user)} replace />
  return children
}

export default function App() {
  const { user } = useApp()
  const { pathname } = useLocation()
  const roleRoutes = (role) => (ROLE_NAV[role] || []).flatMap((g) => g.items.map((i) => i.to))

  const routes = (
    <Routes>
      {/* public */}
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/home" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/impact" element={<Impact />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/contact" element={<Contact />} />

      {/* auth */}
      <Route
        path="/login"
        element={
          <GuestOnly user={user}>
            <Login />
          </GuestOnly>
        }
      />
      <Route
        path="/register"
        element={
          <GuestOnly user={user}>
            <Register />
          </GuestOnly>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <GuestOnly user={user}>
            <ForgotPassword />
          </GuestOnly>
        }
      />
      <Route
        path="/reset-password"
        element={
          <GuestOnly user={user}>
            <ResetPassword />
          </GuestOnly>
        }
      />
      <Route
        path="/reset-password/:token"
        element={
          <GuestOnly user={user}>
            <ResetPasswordWithToken />
          </GuestOnly>
        }
      />

      {/* shared */}
      <Route
        path="/visualizations"
        element={
          <Guard user={user}>
            <Visualizations />
          </Guard>
        }
      />

      {/* donor */}
      <Route
        path="/donor/dashboard"
        element={
          <Guard user={user} roles={['DONOR']}>
            <DonorDashboard />
          </Guard>
        }
      />
      <Route
        path="/donor/donate"
        element={
          <Guard user={user} roles={['DONOR']}>
            <Donate />
          </Guard>
        }
      />
      <Route
        path="/donor/active"
        element={
          <Guard user={user} roles={['DONOR']}>
            <DonorActive />
          </Guard>
        }
      />
      <Route
        path="/donor/history"
        element={
          <Guard user={user} roles={['DONOR']}>
            <DonorHistory />
          </Guard>
        }
      />

      {/* ngo */}
      <Route
        path="/ngo/dashboard"
        element={
          <Guard user={user} roles={['NGO']}>
            <NgoDashboard />
          </Guard>
        }
      />
      <Route
        path="/ngo/live-feed"
        element={
          <Guard user={user} roles={['NGO']}>
            <NgoLiveFeed />
          </Guard>
        }
      />
      <Route
        path="/ngo/map-view"
        element={
          <Guard user={user} roles={['NGO']}>
            <NgoMapView />
          </Guard>
        }
      />
      <Route
        path="/ngo/active-claims"
        element={
          <Guard user={user} roles={['NGO']}>
            <NgoActiveClaims />
          </Guard>
        }
      />
      <Route
        path="/ngo/history"
        element={
          <Guard user={user} roles={['NGO']}>
            <NgoHistory />
          </Guard>
        }
      />
      <Route
        path="/ngo/ai-advisor"
        element={
          <Guard user={user} roles={['NGO']}>
            <NgoAiAdvisor />
          </Guard>
        }
      />

      {/* admin */}
      <Route
        path="/admin/overview"
        element={
          <Guard user={user} roles={['ADMIN']}>
            <AdminOverview />
          </Guard>
        }
      />
      <Route
        path="/admin/users"
        element={
          <Guard user={user} roles={['ADMIN']}>
            <AdminUsers />
          </Guard>
        }
      />
      <Route
        path="/admin/ai-logs"
        element={
          <Guard user={user} roles={['ADMIN']}>
            <AdminAiLogs />
          </Guard>
        }
      />

      {/* settings */}
      <Route
        path="/settings/profile"
        element={
          <Guard user={user}>
            <ProfileSettings />
          </Guard>
        }
      />
      <Route
        path="/settings/location"
        element={
          <Guard user={user}>
            <LocationSettings />
          </Guard>
        }
      />
      <Route
        path="/settings/alerts"
        element={
          <Guard user={user}>
            <AlertSettings />
          </Guard>
        }
      />

      <Route path="*" element={<Navigate to={user ? homeFor(user) : '/home'} replace />} />
    </Routes>
  )

  const portalRoutes = user ? [...roleRoutes(user.role), ...SETTINGS_ROUTES, ...SHARED_ROUTES] : []
  const isPortalRoute = Boolean(user && portalRoutes.includes(pathname))

  return isPortalRoute ? (
    <AppShell>{routes}</AppShell>
  ) : (
    <>
      <PublicNav />
      <main className="min-h-[calc(100vh-4rem)]">{routes}</main>
    </>
  )
}

function ResetPasswordWithToken() {
  const { pathname } = useLocation()
  const token = pathname.split('/').pop() || ''
  return <ResetPassword token={token} />
}