import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  Bell,
  Bot,
  Boxes,
  ChartPie,
  Cpu,
  History,
  IdCard,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Map,
  MapPin,
  Menu,
  Moon,
  Sun,
  Trophy,
  Users,
  Wand2,
  Zap,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PUBLIC_NAV, ROLE_NAV, ROUTE_TITLES, SETTINGS_NAV } from '@/lib/routes'
import { useApp, useTheme } from '@/lib/store'
import { formatRelative } from '@/lib/format'

const ICONS = {
  LayoutDashboard,
  Wand2,
  Boxes,
  History,
  Trophy,
  ChartPie,
  Zap,
  Map,
  Bot,
  IdCard,
  Users,
  Cpu,
  MapPin,
  Bell,
  LayoutGrid,
}

const ROLE_LABEL = { DONOR: 'Donor', NGO: 'NGO', ADMIN: 'Admin' }

/* -------------------------------------------------------- theme toggle */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const dark = theme === 'dark'
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={dark ? 'Switch to light appearance' : 'Switch to dark appearance'}
          onClick={toggleTheme}
        >
          {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{dark ? 'Light appearance' : 'Dark appearance'}</TooltipContent>
    </Tooltip>
  )
}

/* ------------------------------------------------------ notification bell */
function NotificationBell() {
  const { notifications, unreadCount, markAllNotificationsRead } = useApp()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open && unreadCount > 0) markAllNotificationsRead()
  }, [open, unreadCount, markAllNotificationsRead])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        >
          <Bell className="size-[18px]" />
          {unreadCount > 0 ? (
            <span className="absolute top-1 right-1 flex size-[18px] items-center justify-center rounded-full bg-[var(--destructive)] text-[10px] font-semibold text-white tabular-nums">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between border-b border-[var(--hig-separator)] px-4 py-3">
          <p className="text-sm font-[590]">Notifications</p>
          <span className="text-xs text-muted-foreground">{notifications.length} total</span>
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            notifications.slice(0, 12).map((n) => (
              <div
                key={n.id}
                className={`border-b border-[var(--hig-separator)] px-4 py-3 last:border-b-0 ${
                  n.is_read ? '' : 'bg-[var(--hig-fill-quaternary)]'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[13px] font-[590]">{n.title}</p>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{formatRelative(n.created_at)}</span>
                </div>
                {n.message ? <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p> : null}
              </div>
            ))
          )}
          <ScrollBar orientation="vertical" />
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

/* ----------------------------------------------------------- public nav */
export function PublicNav() {
  const { user, home, logout } = useApp()

  return (
    <header className="hig-navbar">
      <div className="hig-navbar__inner mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Link to={user ? home : '/home'} className="flex shrink-0 items-center gap-1.5">
          <span className="text-[17px] font-semibold tracking-[-0.011em]">FoodSave</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-0.5 md:flex">
          {PUBLIC_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-lg px-3 py-1.5 text-[13px] font-[590] tracking-[-0.002em] transition-colors duration-150 ${
                  isActive ? 'bg-[var(--hig-fill-tertiary)] text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          {user ? (
            <>
              <NotificationBell />
              <Button variant="ghost" size="sm" onClick={logout}>
                Sign out
              </Button>
              <Button size="sm" asChild>
                <Link to={home}>Dashboard</Link>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/register">Get started</Link>
              </Button>
            </>
          )}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Show navigation">
                <Menu className="size-[18px]" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px]">
              <SheetHeader>
                <SheetTitle className="text-left">Menu</SheetTitle>
              </SheetHeader>
              <nav className="hig-group mt-6 border-0">
                {PUBLIC_NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `hig-row hig-row--tappable ${isActive ? 'bg-[var(--hig-fill-tertiary)]' : ''}`}
                  >
                    <span className="hig-row__title">{item.label}</span>
                  </NavLink>
                ))}
              </nav>
              {!user ? (
                <div className="mt-4 grid gap-2">
                  <Button asChild>
                    <Link to="/register">Create account</Link>
                  </Button>
                  <Button variant="secondary" asChild>
                    <Link to="/login">Sign in</Link>
                  </Button>
                </div>
              ) : null}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

/* ----------------------------------------------------- authenticated app */
function NavGroup({ title, items, pathname, onNavigate }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{title}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const Icon = ICONS[item.icon] || LayoutGrid
            return (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton asChild isActive={pathname === item.to} tooltip={item.label} onClick={onNavigate}>
                  <Link to={item.to}>
                    <Icon className="size-[17px]" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function SidebarNav({ children }) {
  const { user, home, logout } = useApp()
  const { setOpenMobile } = useSidebar()
  const { pathname } = useLocation()
  const groups = ROLE_NAV[user.role] || []
  const close = () => setOpenMobile(false)

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <Link to={home} className="px-1 text-[17px] font-semibold tracking-[-0.011em]">
            FoodSave
          </Link>
        </SidebarHeader>
        <SidebarContent>
          {groups.map((g) => (
            <NavGroup key={g.title} title={g.title} items={g.items} pathname={pathname} onNavigate={close} />
          ))}
          <NavGroup title="Account" items={SETTINGS_NAV} pathname={pathname} onNavigate={close} />
        </SidebarContent>
        <SidebarFooter>
          <div className="hig-account group-data-[collapsible=icon]:justify-center">
            <Avatar className="size-8">
              <AvatarFallback>{user.username.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-[13px] font-[590]">{user.username}</p>
              <p className="text-[11px] text-muted-foreground">{ROLE_LABEL[user.role] || user.role}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="hig-row hig-row--tappable w-full rounded-lg px-2 text-[13px] font-[450]"
            onClick={logout}
          >
            <LogOut className="size-[17px]" />
            <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="hig-navbar">
          <div className="hig-navbar__inner px-4 md:px-6 lg:px-8">
            <SidebarTrigger className="-ml-1.5" />
            <p className="hig-navbar__title truncate">{ROUTE_TITLES[pathname] || 'FoodSave'}</p>
            <div className="ml-auto flex items-center gap-0.5">
              <ThemeToggle />
              <NotificationBell />
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-6 md:py-8 lg:px-8">
          <div className="mx-auto w-full max-w-7xl space-y-10">{children}</div>
        </main>
      </SidebarInset>
    </>
  )
}

export function AppShell({ children }) {
  return (
    <SidebarProvider>
      <SidebarNav>{children}</SidebarNav>
    </SidebarProvider>
  )
}