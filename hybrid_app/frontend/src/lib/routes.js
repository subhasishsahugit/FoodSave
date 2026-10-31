export const DEFAULT_ROUTE = {
  DONOR: '/donor/dashboard',
  NGO: '/ngo/dashboard',
  ADMIN: '/admin/overview',
}

export const PUBLIC_NAV = [
  { to: '/home', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/impact', label: 'Impact' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/contact', label: 'Contact' },
]

export const ROLE_NAV = {
  DONOR: [
    { title: 'Overview', items: [{ to: '/donor/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' }] },
    {
      title: 'Donations',
      items: [
        { to: '/donor/donate', label: 'Donate food', icon: 'Wand2' },
        { to: '/donor/active', label: 'Active listings', icon: 'Boxes' },
        { to: '/donor/history', label: 'History', icon: 'History' },
      ],
    },
    {
      title: 'Insights',
      items: [
        { to: '/leaderboard', label: 'Leaderboard', icon: 'Trophy' },
        { to: '/visualizations', label: 'Visual Lab', icon: 'ChartPie' },
      ],
    },
  ],
  NGO: [
    { title: 'Overview', items: [{ to: '/ngo/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' }] },
    {
      title: 'Rescue',
      items: [
        { to: '/ngo/live-feed', label: 'Live feed', icon: 'Zap' },
        { to: '/ngo/map-view', label: 'Map view', icon: 'Map' },
        { to: '/ngo/ai-advisor', label: 'AI advisor', icon: 'Bot' },
      ],
    },
    {
      title: 'Claims',
      items: [
        { to: '/ngo/active-claims', label: 'Active claims', icon: 'IdCard' },
        { to: '/ngo/history', label: 'History', icon: 'History' },
      ],
    },
    {
      title: 'Insights',
      items: [
        { to: '/leaderboard', label: 'Leaderboard', icon: 'Trophy' },
        { to: '/visualizations', label: 'Visual Lab', icon: 'ChartPie' },
      ],
    },
  ],
  ADMIN: [
    { title: 'Overview', items: [{ to: '/admin/overview', label: 'Overview', icon: 'LayoutDashboard' }] },
    {
      title: 'Administration',
      items: [
        { to: '/admin/users', label: 'Users', icon: 'Users' },
        { to: '/admin/ai-logs', label: 'AI & audit logs', icon: 'Cpu' },
      ],
    },
    {
      title: 'Insights',
      items: [
        { to: '/leaderboard', label: 'Leaderboard', icon: 'Trophy' },
        { to: '/visualizations', label: 'Visual Lab', icon: 'ChartPie' },
      ],
    },
  ],
}

export const SHARED_ROUTES = ['/visualizations']

export const SETTINGS_NAV = [
  { to: '/settings/profile', label: 'Profile', icon: 'Users' },
  { to: '/settings/location', label: 'Location', icon: 'MapPin' },
  { to: '/settings/alerts', label: 'Alerts', icon: 'Bell' },
]

export const ROUTE_TITLES = {
  '/home': 'Food rescue, before it goes to waste',
  '/about': 'About FoodSave',
  '/impact': 'Impact',
  '/leaderboard': 'Leaderboard',
  '/contact': 'Contact us',
  '/login': 'Sign in',
  '/register': 'Create an account',
  '/forgot-password': 'Reset your password',
  '/reset-password': 'Choose a new password',
  '/visualizations': 'Visual Lab',
  '/donor/dashboard': 'Dashboard',
  '/donor/donate': 'Donate food',
  '/donor/active': 'Active listings',
  '/donor/history': 'Donation history',
  '/ngo/dashboard': 'Dashboard',
  '/ngo/live-feed': 'Live feed',
  '/ngo/map-view': 'Map view',
  '/ngo/active-claims': 'Active claims',
  '/ngo/history': 'Claim history',
  '/ngo/ai-advisor': 'AI advisor',
  '/admin/overview': 'Platform overview',
  '/admin/users': 'User management',
  '/admin/ai-logs': 'AI & audit logs',
  '/settings/profile': 'Profile settings',
  '/settings/location': 'Location settings',
  '/settings/alerts': 'Alert settings',
}

export const FOOD_CATEGORIES = [
  { value: 'prepared', label: 'Prepared' },
  { value: 'protein', label: 'Protein' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'produce', label: 'Produce' },
  { value: 'grains', label: 'Grains' },
]

export const STORAGE_OPTIONS = [
  { value: 'refrigerated', label: 'Refrigerated' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'ambient', label: 'Ambient' },
]

export const PACKAGING_OPTIONS = [
  { value: 'sealed', label: 'Sealed' },
  { value: 'bulk', label: 'Bulk' },
  { value: 'open', label: 'Open' },
]