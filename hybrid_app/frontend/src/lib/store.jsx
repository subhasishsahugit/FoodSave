import { createContext, useCallback, useContext, useEffect, useMemo,  useState } from 'react'
import { apiGet, apiSend } from '@/lib/api'
import { DEFAULT_ROUTE } from '@/lib/routes'
import { toast } from 'sonner'

const USER_KEY = 'foodsave_user'
const THEME_KEY = 'foodsave_theme'

const AppContext = createContext(null)
const ThemeContext = createContext(null)

function readUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && parsed.username && parsed.role ? parsed : null
  } catch {
    return null
  }
}

/* ------------------------------------------------------------- theme */
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
    } catch {
      return 'dark'
    }
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* private mode — theme just won't persist */
    }
  }, [theme])

  const value = useMemo(
    () => ({ theme, toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }),
    [theme],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}

/* -------------------------------------------------------------- store */
export function AppProvider({ children }) {
  const [user, setUser] = useState(readUser)
  const [data, setData] = useState({
    analytics: null,
    rows: [],
    notifications: [],
    unreadCount: 0,
    adminUsers: [],
    aiLogs: [],
    auditLogs: [],
    loading: false,
  })
  const [filters, setFilters] = useState({ q: '', status: 'all', minSafe: '', maxSafe: '' })
  const [selectedId, setSelectedId] = useState(null)
  const [claimingId, setClaimingId] = useState(null)
  const [chat, setChat] = useState({ threads: [], messages: [], activeChatFoodId: null, draft: '', busy: false, loading: false })
  const [resetToken, setResetToken] = useState(() => {
    const m = /\/reset-password\/([^/?#]+)/.exec(window.location.pathname || '')
    if (m) return m[1]
    return new URLSearchParams(window.location.search).get('token') || ''
  })

  const refresh = useCallback(async () => {
    const jobs = [
      apiGet('/api/analytics').then((analytics) => setData((d) => ({ ...d, analytics }))),
      /* /api/food/all is public: the marketing pages render real figures from it too. */
      apiGet('/api/food/all' + (user ? `?ngo_username=${encodeURIComponent(user.username)}` : '')).then((res) =>
        setData((d) => ({ ...d, rows: res.food || [] })),
      ),
    ]

    if (!user) {
      await Promise.all(jobs.map((p) => p.catch(() => {})))
      return
    }

    setData((d) => ({ ...d, loading: true }))
    jobs.push(
      apiGet(`/api/notifications?username=${encodeURIComponent(user.username)}&role=${encodeURIComponent(user.role)}`).then(
        (res) => setData((d) => ({ ...d, notifications: res.notifications || [], unreadCount: res.unread_count || 0 })),
      ),
    )

    if (user.role === 'ADMIN') {
      jobs.push(
        apiGet('/api/admin/users').then((res) => setData((d) => ({ ...d, adminUsers: res.users || [] }))),
        apiGet('/api/admin/ai-logs').then((res) => setData((d) => ({ ...d, aiLogs: res.logs || [] }))),
        apiGet('/api/admin/audit-logs?limit=120').then((res) => setData((d) => ({ ...d, auditLogs: res.logs || [] }))),
      )
    }

    await Promise.all(jobs.map((p) => p.catch(() => {})))
    setData((d) => ({ ...d, loading: false }))
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  /* Poll while a session is live and the tab is visible. */
  useEffect(() => {
    if (!user) return
    const id = setInterval(() => {
      if (!document.hidden) refresh()
    }, 8000)
    return () => clearInterval(id)
  }, [user, refresh])

  const persistUser = useCallback((next) => {
    setUser(next)
    try {
      if (next) localStorage.setItem(USER_KEY, JSON.stringify(next))
      else localStorage.removeItem(USER_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const login = useCallback(
    (username, password) =>
      apiSend('/api/auth/login', 'POST', { username, password }).then((res) => {
        persistUser(res.user)
        toast.success('Welcome back', { description: `Signed in as ${res.user.username} (${res.user.role}).` })
        return res.user
      }),
    [persistUser],
  )

  const register = useCallback(
    (values) =>
      apiSend('/api/auth/register', 'POST', {
        username: values.username,
        password: values.password,
        role: values.role,
        city: values.city,
      }).then((res) => {
        persistUser(res.user)
        toast.success('Account created', { description: `Welcome to FoodSave, ${res.user.username}.` })
        return res.user
      }),
    [persistUser],
  )

  const logout = useCallback(() => {
    apiSend('/api/auth/logout', 'POST', { username: user ? user.username : '' }).catch(() => {})
    persistUser(null)
    setData((d) => ({ ...d, rows: [], notifications: [], unreadCount: 0, adminUsers: [], aiLogs: [], auditLogs: [] }))
    setChat({ threads: [], messages: [], activeChatFoodId: null, draft: '', busy: false, loading: false })
    toast.info('Signed out', { description: 'Your session on this device has ended.' })
  }, [user, persistUser])

  const claimListing = useCallback(
    async (row) => {
      if (!user) return
      setClaimingId(row.id)
      try {
        const res = await apiSend(`/api/food/${row.id}/claim`, 'POST', { claimed_by: user.username })
        const pass = res.pickup_pass || {}
        toast.success('Food claimed', { description: `Pickup pass ${pass.pass_code || ''} generated.` })
      } catch (err) {
        toast.error('Could not claim', { description: err.message })
      } finally {
        setClaimingId(null)
        refresh()
      }
    },
    [user, refresh],
  )

  const retractListing = useCallback(
    async (row) => {
      if (!window.confirm(`Retract “${row.food_name}”? NGOs will no longer see it.`)) return
      try {
        await apiSend(`/api/food/${row.id}`, 'DELETE', { donor_name: user.username })
        toast.success('Listing retracted', { description: `${row.food_name} was removed.` })
      } catch (err) {
        toast.error('Could not retract', { description: err.message })
      }
      refresh()
    },
    [user, refresh],
  )

  const saveListing = useCallback(
    async (id, form) => {
      try {
        await apiSend(`/api/food/${id}`, 'PUT', {
          updates: {
            food_name: form.food_name,
            qty: Number(form.qty),
            temp: Number(form.temp),
            hours_ago: Number(form.hours_ago),
          },
        })
        toast.success('Listing updated', { description: 'The safety window was recalculated.' })
        refresh()
      } catch (err) {
        toast.error('Could not save', { description: err.message })
        throw err
      }
    },
    [refresh],
  )

  /* -------------------------------------------------------------- chat */
  const syncThreads = useCallback(() => {
    if (!user) return
    apiGet(`/api/chats?username=${encodeURIComponent(user.username)}`)
      .then((res) => setChat((c) => ({ ...c, threads: res.threads || [] })))
      .catch(() => {})
  }, [user])

  const loadChat = useCallback(
    (foodId) => {
      if (!user || !foodId) return
      apiGet(`/api/food/${foodId}/chat?username=${encodeURIComponent(user.username)}&limit=120`)
        .then((res) => setChat((c) => ({ ...c, messages: res.messages || [], loading: false })))
        .catch((err) => {
          setChat((c) => ({ ...c, loading: false }))
          toast.error('Chat unavailable', { description: err.message })
        })
    },
    [user],
  )

  const setActiveChatFoodId = useCallback(
    (foodId) => {
      setChat((c) => ({ ...c, activeChatFoodId: foodId, loading: true, messages: [] }))
      loadChat(foodId)
    },
    [loadChat],
  )

  const setChatDraft = useCallback((draft) => setChat((c) => ({ ...c, draft })), [])

  const sendChatMessage = useCallback(
    (text) => {
      const draft = (text || '').trim()
      const foodId = chat.activeChatFoodId
      if (!draft || !foodId || !user) return
      const nonce = `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
      const optimistic = {
        id: null,
        client_nonce: nonce,
        sender: user.username,
        message: draft,
        status: 'sending',
        created_at: new Date().toISOString(),
      }
      setChat((c) => ({ ...c, draft: '', busy: true, messages: [...c.messages, optimistic] }))

      apiSend(`/api/food/${foodId}/chat`, 'POST', { username: user.username, message: draft, client_nonce: nonce })
        .then((res) => {
          const saved = res.message || {}
          setChat((c) => ({
            ...c,
            busy: false,
            messages: [
              ...c.messages.filter((m) => m.client_nonce !== nonce),
              { ...saved, status: saved.status || 'sent' },
            ],
          }))
        })
        .catch((err) => {
          setChat((c) => ({
            ...c,
            busy: false,
            draft,
            messages: c.messages.map((m) => (m.client_nonce === nonce ? { ...m, status: 'failed', failed: true } : m)),
          }))
          toast.error('Message not sent', { description: `${err.message} Press send to retry.` })
        })
    },
    [chat.activeChatFoodId, user],
  )

  useEffect(() => {
    if (!user) return
    syncThreads()
    if (!chat.activeChatFoodId) return
    const foodId = chat.activeChatFoodId
    const id = setInterval(() => {
      if (!document.hidden) loadChat(foodId)
    }, 2500)
    return () => clearInterval(id)
  }, [user, chat.activeChatFoodId, syncThreads, loadChat])

  const filteredRows = useMemo(() => {
    const q = (filters.q || '').toLowerCase().trim()
    return data.rows.filter((r) => {
      if (filters.status === 'open' && r.is_claimed) return false
      if (filters.status === 'claimed' && !r.is_claimed) return false
      if (q) {
        const hay = `${r.food_name || ''} ${r.donor_name || ''} ${r.claimed_by || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (filters.minSafe !== '' && Number(r.safe_hours) < Number(filters.minSafe)) return false
      if (filters.maxSafe !== '' && Number(r.safe_hours) > Number(filters.maxSafe)) return false
      return true
    })
  }, [data.rows, filters])

  const markAllNotificationsRead = useCallback(() => {
    if (!user) return
    apiSend('/api/notifications/read-all', 'PATCH', { username: user.username })
      .then(() => setData((d) => ({ ...d, unreadCount: 0 })))
      .catch(() => {})
  }, [user])

  const value = useMemo(
    () => ({
      user,
      home: user ? DEFAULT_ROUTE[user.role] || '/home' : '/home',
      analytics: data.analytics,
      rows: data.rows,
      filteredRows,
      notifications: data.notifications,
      unreadCount: data.unreadCount,
      adminUsers: data.adminUsers,
      aiLogs: data.aiLogs,
      auditLogs: data.auditLogs,
      loading: data.loading,
      filters,
      setFilters,
      selectedId,
      setSelectedId,
      claimingId,
      resetToken,
      refresh,
      login,
      register,
      logout,
      claimListing,
      retractListing,
      saveListing,
      markAllNotificationsRead,
      chat,
      setChat,
      setActiveChatFoodId,
      setChatDraft,
      sendChatMessage,
    }),
    [
      user, data, filteredRows, filters, selectedId, claimingId, resetToken, refresh,
      login, register, logout, claimListing, retractListing, saveListing,
      markAllNotificationsRead, chat, setActiveChatFoodId, setChatDraft, sendChatMessage,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}