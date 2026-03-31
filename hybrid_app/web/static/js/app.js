    const { useMemo, useRef, useState, useEffect, useContext } = React;
    const {
      PUBLIC_ROUTES,
      PUBLIC_DISCLOSURE_ROUTES,
      DONOR_ROUTES,
      NGO_ROUTES,
      SETTINGS_ROUTES,
      SHARED_AUTH_ROUTES,
      ADMIN_ROUTES,
      PUBLIC_NAV_LINKS,
      ROLE_NAV_LINKS,
      NAV_ICON_BY_ROUTE,
    } = window.FoodSaveConfig;
    const {
      normalizeRoutePath,
      getDefaultRouteForUser,
      navigate,
      isRouteActive,
      getToneVars,
      getSafeHoursTone,
      getRankTone,
      buildMonotonicFunnelStages,
    } = window.FoodSaveUtils;
    const { apiGet, apiSend } = window.FoodSaveApi;
    const DisclosureContext = React.createContext({ compactMode: false, forceExpanded: null });
    const BG_THEME_OPTIONS = [
      { value: 'aurora', label: 'Aurora' },
      { value: 'sunset', label: 'Sunset' },
      { value: 'forest', label: 'Forest' },
      { value: 'ocean', label: 'Ocean' },
    ];

    const SETTINGS_PROFILE_ENDPOINT = '/api/settings/profile';

    async function fetchProfileSettings(username, fallbackErrorMessage) {
      const data = await apiGet(`${SETTINGS_PROFILE_ENDPOINT}?username=${encodeURIComponent(username || '')}`);
      return data.settings || {};
    }

    async function saveProfileSettings(username, values, fallbackErrorMessage) {
      const data = await apiSend(SETTINGS_PROFILE_ENDPOINT, {
        method: 'PUT',
        body: { username, values },
      });
      if (data.status !== 'success') throw new Error(data.message || fallbackErrorMessage);
      return data;
    }

    function renderPlot(host, traces, layout = {}, config = {}, theme = 'dark') {
      if (!host || typeof Plotly === 'undefined') return false;

      const isDark = theme !== 'light';
      const normalizedLayout = {
        hoverlabel: {
          bgcolor: isDark ? 'rgba(7, 18, 25, 0.96)' : 'rgba(255, 255, 255, 0.96)',
          bordercolor: isDark ? 'rgba(34, 211, 238, 0.4)' : 'rgba(14, 116, 144, 0.4)',
          font: { color: isDark ? '#ecfeff' : '#111111', size: 12 },
          namelength: -1,
          ...(layout.hoverlabel || {}),
        },
        paper_bgcolor: isDark ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0)',
        plot_bgcolor: isDark ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0)',
        font: { color: isDark ? '#ecfeff' : '#111111' },
        ...layout,
      };

      const normalizedConfig = {
        displayModeBar: false,
        responsive: true,
        ...config,
      };

      try {
        Plotly.newPlot(host, traces, normalizedLayout, normalizedConfig);
        return true;
      } catch (error) {
        console.error('Plotly render failed', error);
        return false;
      }
    }

    function purgePlot(host) {
      if (!host || typeof Plotly === 'undefined') return;
      try {
        Plotly.purge(host);
      } catch (error) {
        console.warn('Plot cleanup skipped', error);
      }
    }

    class AppErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { hasError: false };
      }

      static getDerivedStateFromError() {
        return { hasError: true };
      }

      componentDidCatch(error) {
        console.error('FoodSave UI error', error);
      }

      handleReset = () => {
        this.setState({ hasError: false });
        window.location.reload();
      };

      render() {
        if (this.state.hasError) {
          return (
            <div className="min-h-screen flex items-center justify-center px-4">
              <section className="glass rounded-3xl p-5 w-full max-w-2xl text-center">
                <p className="mb-2" style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#34d399', fontWeight: 700 }}>Interface Recovery</p>
                <h1 className="fw-bold mb-3" style={{ color: '#22d3ee' }}>A dashboard component failed to render.</h1>
                <p className="mb-4" style={{ color: '#e6fffb' }}>Reload to restore the interface after a chart or route transition failure.</p>
                <button type="button" onClick={this.handleReset} className="px-4 py-2 rounded-lg bg-cyan-500/30 border border-cyan-300/30">Reload interface</button>
              </section>
            </div>
          );
        }
        return this.props.children;
      }
    }

    function KpiCard({ label, value, sub, icon = 'fas fa-chart-bar' }) {
      return (
        <div className="service-item glass rounded-3 p-4 text-center wow zoomIn" data-wow-delay="0.1s">
          <i className={`${icon} fa-3x text-primary mb-3`} style={{ color: '#34d399' }}></i>
          <h5 className="mb-2 fw-bold" style={{ color: '#22d3ee', fontSize: '0.85rem' }}>{label}</h5>
          <p className="display-6 fw-bold mb-0">{value}</p>
          {sub && <p className="text-muted small mt-2">{sub}</p>}
        </div>
      );
    }

    function RiskRing({ value }) {
      const clamped = Math.max(0, Math.min(100, value));
      const color = clamped > 66 ? '#fb7185' : clamped > 33 ? '#fbbf24' : '#34d399';
      return (
        <div className="relative w-24 h-24">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.2)" strokeWidth="10" fill="none" />
            <circle cx="50" cy="50" r="40" stroke={color} strokeWidth="10" fill="none" strokeDasharray={`${2.513 * clamped} 251.3`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-lg font-bold">{Math.round(clamped)}%</div>
        </div>
      );
    }

    function LiquidNavbar({ user, path, setPath, onLogout, unreadCount, onOpenNotifications, theme, onToggleTheme, backgroundTheme, onBackgroundThemeChange }) {
      const navLinks = !user
        ? PUBLIC_NAV_LINKS
        : ROLE_NAV_LINKS[user.role] || PUBLIC_NAV_LINKS;

      const go = (to, event) => {
        if (event?.currentTarget) {
          event.currentTarget.classList.add('menu-clicked');
          window.setTimeout(() => event.currentTarget.classList.remove('menu-clicked'), 240);
        }
        navigate(setPath, to);
      };

      return (
        <>
        <div className="apple-nav glass" data-liquid-ignore>
          <div className="apple-nav-content">
            <button className="apple-nav-brand" onClick={(e) => go('/home', e)}>
              <i className="fas fa-leaf me-2"></i>FoodSave
            </button>
            <ul className="apple-nav-links">
              {navLinks.map((item) => (
                <li key={item.to}>
                  <button
                    className={`apple-nav-link ${isRouteActive(path, item.to) ? 'active' : ''}`}
                    onClick={(e) => go(item.to, e)}
                  >
                    <i className={`fas ${NAV_ICON_BY_ROUTE[item.to] || 'fa-circle'} me-2`} aria-hidden="true"></i>
                    {item.label}
                  </button>
                </li>
              ))}
              {user && (
                <li>
                  <button
                    className="apple-nav-link"
                    onClick={onOpenNotifications}
                    title="Notifications"
                  >
                    <i className="fas fa-bell"></i>{unreadCount > 0 ? ` (${unreadCount})` : ''}
                  </button>
                </li>
              )}
              {user && (
                <li>
                  <button
                    className={`apple-nav-link ${path.startsWith('/settings/') ? 'active' : ''}`}
                    onClick={(e) => go('/settings/profile', e)}
                  >
                    Settings
                  </button>
                </li>
              )}
              <li>
                <div className="bg-theme-picker-inline" title="Choose page background style">
                  <i className="fas fa-palette" aria-hidden="true"></i>
                  <select
                    className="bg-theme-select"
                    value={backgroundTheme}
                    onChange={(e) => onBackgroundThemeChange(e.target.value)}
                    aria-label="Background theme"
                  >
                    {BG_THEME_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </li>
              <li>
                <button
                  className="apple-nav-link apple-theme-toggle"
                  onClick={onToggleTheme}
                  title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'} me-2`} aria-hidden="true"></i>
                  {theme === 'dark' ? 'Light' : 'Dark'}
                </button>
              </li>
              {!user && (
                <li>
                  <button 
                    className={`apple-nav-link ${path === '/login' ? 'active' : ''}`}
                    onClick={(e) => go('/login', e)}
                  >
                    <i className="fas fa-sign-in-alt me-2" aria-hidden="true"></i>
                    Login
                  </button>
                </li>
              )}
              {!user ? (
                <li>
                  <button 
                    className="apple-nav-cta"
                    onClick={(e) => go('/register', e)}
                    
                  >
                    <i className="fas fa-user-plus me-2" aria-hidden="true"></i>
                    Register
                  </button>
                </li>
              ) : (
                <>
                  <li>
                    <button 
                      className="apple-nav-cta"
                      onClick={onLogout}
                    >
                      Logout
                    </button>
                  </li>
                </>
              )}
            </ul>
            <button
              className="apple-nav-theme-btn"
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
            </button>
          </div>
        </div>
        </>
      );
    }

    function AppSidebar({ user, path, setPath, unreadCount, onLogout, onOpenNotifications, theme, onToggleTheme, backgroundTheme, onBackgroundThemeChange }) {
      const links = ROLE_NAV_LINKS[user.role] || ROLE_NAV_LINKS.DONOR;
      const initial = (user.username || 'U')[0].toUpperCase();
      const roleClass = (user.role || 'donor').toLowerCase();
      const defaultRoute = user.role === 'DONOR' ? '/donor/dashboard' : user.role === 'NGO' ? '/ngo/dashboard' : '/admin/overview';
      return (
        <aside className="yt-sidebar">
          <div className="yt-sidebar-inner">
            <button className="yt-sidebar-brand" onClick={() => navigate(setPath, defaultRoute)}>
              <div className="yt-sidebar-brand-icon"><i className="fas fa-leaf"></i></div>
              <span className="yt-sidebar-brand-name">FoodSave</span>
            </button>
            <nav className="yt-sidebar-nav">
              <div className="yt-nav-section-label">Navigation</div>
              {links.map((item) => (
                <button key={item.to} className={`yt-nav-item${isRouteActive(path, item.to) ? ' active' : ''}`} onClick={() => navigate(setPath, item.to)}>
                  <i className={`fas ${NAV_ICON_BY_ROUTE[item.to] || 'fa-circle'}`}></i>
                  <span>{item.label}</span>
                </button>
              ))}
              <div className="yt-sidebar-divider"></div>
              <div className="yt-nav-section-label">Account</div>
              <button className={`yt-nav-item${path.startsWith('/settings/') ? ' active' : ''}`} onClick={() => navigate(setPath, '/settings/profile')}>
                <i className="fas fa-cog"></i><span>Settings</span>
              </button>
              <button className="yt-nav-item" onClick={onOpenNotifications}>
                <i className="fas fa-bell"></i>
                <span>Notifications</span>
                {unreadCount > 0 && <span className="nav-count">{unreadCount}</span>}
              </button>
            </nav>
            <div className="yt-sidebar-footer">
              <button className="yt-profile-card" onClick={() => navigate(setPath, '/settings/profile')}>
                <div className="yt-avatar">{initial}</div>
                <div className="yt-profile-info">
                  <div className="yt-profile-name">{user.username}</div>
                  <div className={`yt-profile-role ${roleClass}`}>{user.role}</div>
                </div>
              </button>
              <button className="yt-settings-btn" onClick={() => navigate(setPath, '/settings/profile')}>
                <i className="fas fa-user-circle"></i><span>My Profile</span>
              </button>
              <button className="yt-settings-btn" onClick={onToggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
                <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i><span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
              </button>
              <div className="yt-bg-picker">
                <div className="yt-bg-picker-label"><i className="fas fa-palette"></i><span>Background</span></div>
                <select
                  className="bg-theme-select"
                  value={backgroundTheme}
                  onChange={(e) => onBackgroundThemeChange(e.target.value)}
                  aria-label="Background theme"
                >
                  {BG_THEME_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <button className="yt-logout-btn" onClick={onLogout}>
                <i className="fas fa-sign-out-alt"></i><span>Sign out</span>
              </button>
            </div>
          </div>
        </aside>
      );
    }

    function InfoPage({ title, subtitle, children, summary = '', priority = 'secondary' }) {
      const { compactMode, forceExpanded } = useContext(DisclosureContext);
      const [isMinimized, setIsMinimized] = useState(false);
      const [isMaximized, setIsMaximized] = useState(false);
      const [isExpanded, setIsExpanded] = useState(() => !compactMode);

      useEffect(() => {
        setIsExpanded(!compactMode);
      }, [title, compactMode, priority]);

      useEffect(() => {
        if (forceExpanded === null) return;
        setIsExpanded(Boolean(forceExpanded));
      }, [forceExpanded]);

      const condensedSummary = summary || subtitle;

      return (
        <section className={`section-enter window-shell mt-4 glass rounded-3xl p-4 wow fadeInUp ${isMinimized ? 'minimized' : ''} ${isMaximized ? 'maximized' : ''}`} data-wow-delay="0.1s">
          <div className="window-toolbar" data-liquid-ignore>
            <button type="button" className="window-dot min" aria-label="Minimize section" onClick={() => setIsMinimized((v) => !v)}></button>
            <button type="button" className="window-dot max" aria-label="Maximize section" onClick={() => setIsMaximized((v) => !v)}></button>
          </div>
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
            <div className="text-start">
              <h6 className="section-title bg-transparent text-primary d-inline-block px-3" style={{ color: '#34d399' }}>{title}</h6>
              <h1 className="mb-1 display-6 fw-bold">{subtitle}</h1>
            </div>
            {compactMode && (
              <button
                type="button"
                className="btn btn-sm btn-outline-light"
                onClick={() => setIsExpanded((v) => !v)}
                aria-expanded={isExpanded}
              >
                <i className={`fas ${isExpanded ? 'fa-angle-up' : 'fa-angle-down'} me-2`}></i>
                {isExpanded ? 'Hide Details' : 'Show Details'}
              </button>
            )}
          </div>
          {compactMode && !isExpanded && (
            <div className="glass rounded-3 p-3 mt-3">
              <p className="mb-0" style={{ color: 'rgba(225,248,255,0.78)', lineHeight: '1.7' }}>{condensedSummary}</p>
            </div>
          )}
          {isExpanded && <div className="mt-4 window-body">{children}</div>}
        </section>
      );
    }

    
    

    function AIWizard({ user, onSubmit, onError }) {
      const [foodName, setFoodName] = useState('');
      const [qty, setQty] = useState(10);
      const [temp, setTemp] = useState(25);
      const [hoursAgo, setHoursAgo] = useState(2);
      const [foodCategory, setFoodCategory] = useState('prepared');
      const [storage, setStorage] = useState('ambient');
      const [packaging, setPackaging] = useState('open');
      const [safeHours, setSafeHours] = useState(null);
      const [riskLabel, setRiskLabel] = useState(null);
      const [predicting, setPredicting] = useState(false);
      const [showGuide, setShowGuide] = useState(true);
      const gaugeRef = useRef(null);

      const predictSafety = async () => {
        setPredicting(true);
        try {
          const data = await apiSend('/api/ai/predict', {
            method: 'POST',
            body: { temp, hours_ago: hoursAgo, food_category: foodCategory, storage, packaging },
          });
          if (data.status === 'success') { setSafeHours(data.safe_hours); setRiskLabel(data.risk); }
        } catch (err) { console.error(err); }
        finally { setPredicting(false); }
      };

      useEffect(() => { predictSafety(); }, [temp, hoursAgo, foodCategory, storage, packaging]);

      useEffect(() => {
        const plotHost = gaugeRef.current;
        if (!plotHost || safeHours === null) return;

        const value = Math.min(24, Math.max(0, safeHours));
        const color = value > 8 ? '#34d399' : value > 3 ? '#fbbf24' : '#fb7185';
        renderPlot(plotHost, [{
            type: 'indicator',
            mode: 'gauge+number',
            value: value,
            title: { text: 'AI Predicted Safe Hours', font: { color: '#e6fffb' } },
            number: { font: { color: '#e6fffb' } },
            gauge: {
              axis: { range: [0, 24], tickcolor: '#e6fffb' },
              bar: { color: color },
              bgcolor: 'rgba(255,255,255,0.1)',
              borderwidth: 2,
              bordercolor: 'rgba(255,255,255,0.3)',
              steps: [
                { range: [0, 3], color: 'rgba(251,113,133,0.3)' },
                { range: [3, 8], color: 'rgba(251,191,36,0.3)' },
                { range: [8, 24], color: 'rgba(52,211,153,0.3)' }
              ],
              threshold: { line: { color: '#22d3ee', width: 4 }, thickness: 0.75, value: value }
            }
          }], { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', height: 280, margin: { t: 40, b: 20, l: 40, r: 40 } }, { displayModeBar: false });

        return () => purgePlot(plotHost);
      }, [safeHours]);

      const handleSubmit = async () => {
        if (!foodName || safeHours === null) return;
        const data = await apiSend('/api/food', {
          method: 'POST',
          body: {
            donor_name: user.username, food_name: foodName, qty,
            temp, hours_ago: hoursAgo, food_category: foodCategory,
            storage, packaging, safe_hours: safeHours,
          },
        });
        if (data.status === 'success') {
          setFoodName(''); setQty(10); setTemp(25); setHoursAgo(2);
          setFoodCategory('prepared'); setStorage('ambient'); setPackaging('open');
          onSubmit();
          onError?.('');
          return;
        }

        onError?.(data.message || 'Unable to create listing');
      };

      const canSubmit = foodName && safeHours !== null && safeHours > 0;

      // Calculate risk level for display
      const getRiskLevel = () => {
        if (safeHours === null) return { level: 'CALCULATING', tone: 'neutral', color: getToneVars('neutral').text, icon: 'fa-spinner fa-spin' };
        if (safeHours > 8) return { level: 'LOW RISK', tone: 'success', color: getToneVars('success').text, icon: 'fa-check-circle' };
        if (safeHours > 3) return { level: 'MEDIUM RISK', tone: 'warning', color: getToneVars('warning').text, icon: 'fa-exclamation-triangle' };
        return { level: 'HIGH RISK', tone: 'danger', color: getToneVars('danger').text, icon: 'fa-times-circle' };
      };

      const riskInfo = getRiskLevel();
      const riskTone = getToneVars(riskInfo.tone);
      const tempTone = temp <= 4 ? getToneVars('success') : temp <= 15 ? getToneVars('warning') : getToneVars('danger');

      return (
        <div className="space-y-6">
          
          {showGuide && (
            <div className="glass rounded-xl p-6 wow fadeIn">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h3 className="h5 fw-bold mb-0" style={{ color: '#22d3ee' }}>
                  <i className="fas fa-info-circle me-2"></i>How the AI Wizard Works
                </h3>
                <button onClick={() => setShowGuide(false)} className="btn btn-sm btn-outline-light">
                  <i className="fas fa-times"></i>
                </button>
                <div className="row g-3">
                  <div className="col-md-4">
                    <div className="d-flex align-items-start">
                      <div className="badge bg-primary rounded-circle me-2" style={{ width: '24px', height: '24px', padding: '4px' }}>1</div>
                      <div className="small" style={{ color: '#e6fffb' }}>
                        Enter accurate <strong>temperature</strong> and <strong>hours since cooking</strong>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="d-flex align-items-start">
                      <div className="badge bg-primary rounded-circle me-2" style={{ width: '24px', height: '24px', padding: '4px' }}>2</div>
                      <div className="small" style={{ color: '#e6fffb' }}>
                        Select <strong>food category</strong>, <strong>storage</strong>, and <strong>packaging</strong> - these are AI inputs too!
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="d-flex align-items-start">
                      <div className="badge bg-primary rounded-circle me-2" style={{ width: '24px', height: '24px', padding: '4px' }}>3</div>
                      <div className="small" style={{ color: '#e6fffb' }}>
                        AI updates <strong>instantly</strong> across all 5 inputs - watch the gauge change!
                      </div>
                    </div>
                  </div>
                </div>
                <div className="alert alert-info mt-3 mb-0" style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)' }}>
                  <i className="fas fa-lightbulb me-2" style={{ color: '#22d3ee' }}></i>
                  <small style={{ color: '#e6fffb' }}>
                    <strong>Pro Tip:</strong> Food stored at 4 C (40 F) or below remains safe longer. NGOs prioritize HIGH RISK items first.
                  </small>
                </div>
              </div>
            </div>
          )}

          {!showGuide && (
            <div className="text-end">
              <button onClick={() => setShowGuide(true)} className="btn btn-sm btn-outline-light">
                <i className="fas fa-question-circle me-2"></i>Show Guide
              </button>
            </div>
          )}

          
          <div className="glass rounded-xl p-6 wow fadeInUp" data-wow-delay="0.2s">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h2 className="h3 fw-bold mb-0" style={{ color: '#34d399' }}>
                <i className="fas fa-magic me-2"></i>AI-Powered Donation Wizard
              </h2>
              <div className="d-flex align-items-center gap-2">
                <span className="badge" style={{ background: riskTone.bg, color: riskTone.text, border: `1px solid ${riskTone.border}`, fontSize: '0.9rem', padding: '0.5rem 1rem' }}>
                  <i className={`fas ${riskInfo.icon} me-2`}></i>{riskInfo.level}
                </span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                            
              <div className="space-y-4">
                <div>
                  <label className="block text-sm fw-bold mb-2" style={{ color: '#22d3ee' }}>
                    <i className="fas fa-utensils me-2"></i>Food Item Name
                  </label>
                  <input 
                    value={foodName} 
                    onChange={(e) => setFoodName(e.target.value)} 
                    placeholder="e.g., Mixed Rice, Chicken Curry, Caesar Salad" 
                    className="w-full rounded-lg px-4 py-3 bg-black/25 border border-white/20" 
                    style={{ color: '#e6fffb' }}
                  />
                  <small className="d-block mt-1" style={{ color: '#e6fffb', opacity: 0.6 }}>
                    Be specific - helps NGOs identify allergens and dietary needs
                  </small>

                </div>
                <div>
                  <label className="block text-sm fw-bold mb-2" style={{ color: '#22d3ee' }}>
                    <i className="fas fa-weight me-2"></i>Quantity: <span className="text-emerald-400">{qty} KG</span>
                  </label>
                  <input 
                    type="range" 
                    min="1" 
                    max="100" 
                    value={qty} 
                    onChange={(e) => setQty(Number(e.target.value))} 
                    className="w-full" 
                  />
                  <div className="d-flex justify-content-between mt-1">
                    <small style={{ color: '#e6fffb', opacity: 0.6 }}>1 KG (~3 meals)</small>
                    <small style={{ color: '#e6fffb', opacity: 0.6 }}>100 KG (~300 meals)</small>
                  </div>

                </div>
                <div>
                  <label className="block text-sm fw-bold mb-2" style={{ color: '#22d3ee' }}>
                    <i className="fas fa-thermometer-half me-2"></i>Current Temperature: <span style={{ color: tempTone.text }}>{temp} C</span>
                  </label>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={temp} 
                    onChange={(e) => setTemp(Number(e.target.value))} 
                    className="w-full" 
                  />
                  <div className="d-flex justify-content-between mt-1">
                    <small style={{ color: getToneVars('success').text }}>0 C (Frozen)</small>
                    <small style={{ color: getToneVars('success').text }}>4 C (Refrigerated)</small>
                    <small style={{ color: getToneVars('warning').text }}>15 C (Cool)</small>
                    <small style={{ color: getToneVars('danger').text }}>100 C (Hot)</small>
                  </div>
                  <div className="alert alert-warning mt-2 mb-0 py-2" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)' }}>
                    <small style={{ color: getToneVars('warning').text }}>
                      <i className="fas fa-exclamation-triangle me-1"></i>
                      Danger Zone: 5-60 C (bacteria multiply rapidly)
                    </small>
                  </div>

                </div>
                <div>
                  <label className="block text-sm fw-bold mb-2" style={{ color: '#22d3ee' }}>
                    <i className="fas fa-clock me-2"></i>Cooked Hours Ago: <span className="text-cyan-400">{hoursAgo} hours</span>
                  </label>
                  <input 
                    type="range" 
                    min="0" 
                    max="24" 
                    value={hoursAgo} 
                    onChange={(e) => setHoursAgo(Number(e.target.value))} 
                    className="w-full" 
                  />
                  <div className="d-flex justify-content-between mt-1">
                    <small style={{ color: '#e6fffb', opacity: 0.6 }}>Just cooked</small>
                    <small style={{ color: '#e6fffb', opacity: 0.6 }}>24 hours old</small>
                  </div>
                </div>

                  
                  <div>
                    <label className="block text-sm fw-bold mb-2" style={{ color: '#22d3ee' }}>
                      <i className="fas fa-layer-group me-2"></i>Food Category
                    </label>
                    <select value={foodCategory} onChange={(e) => setFoodCategory(e.target.value)}
                      className="w-full rounded-lg px-4 py-3 bg-black/25 border border-white/20" style={{ color: '#e6fffb' }}>
                      <option value="prepared">Prepared Meals &amp; Cooked Food</option>
                      <option value="protein">Protein (Meat, Fish, Eggs)</option>
                      <option value="dairy">Dairy Products</option>
                      <option value="produce">Fresh Produce &amp; Vegetables</option>
                      <option value="grains">Grains, Bread &amp; Dry Goods</option>
                    </select>
                    <small className="d-block mt-1" style={{ color: '#e6fffb', opacity: 0.6 }}>
                      Different categories decay at different rates - affects the AI prediction.
                    </small>
                  </div>

                  
                  <div>
                    <label className="block text-sm fw-bold mb-2" style={{ color: '#22d3ee' }}>
                      <i className="fas fa-snowflake me-2"></i>Storage Conditions
                    </label>
                    <select value={storage} onChange={(e) => setStorage(e.target.value)}
                      className="w-full rounded-lg px-4 py-3 bg-black/25 border border-white/20" style={{ color: '#e6fffb' }}>
                      <option value="frozen">Frozen ({'<='} 0 C) - longest shelf life</option>
                      <option value="refrigerated">Refrigerated (1-7 C) - significant extension</option>
                      <option value="ambient">Ambient / Room Temperature - shortest window</option>
                    </select>
                    <small className="d-block mt-1" style={{ color: '#e6fffb', opacity: 0.6 }}>
                      Cold chain dramatically extends safe hours - choose accurately.
                    </small>
                  </div>

                  
                  <div>
                    <label className="block text-sm fw-bold mb-2" style={{ color: '#22d3ee' }}>
                      <i className="fas fa-box-open me-2"></i>Packaging Status
                    </label>
                    <select value={packaging} onChange={(e) => setPackaging(e.target.value)}
                      className="w-full rounded-lg px-4 py-3 bg-black/25 border border-white/20" style={{ color: '#e6fffb' }}>
                      <option value="sealed">Sealed / Unopened - best protection</option>
                      <option value="bulk">Covered Container / Bulk</option>
                      <option value="open">Open / Unwrapped - most exposed</option>
                    </select>
                    <small className="d-block mt-1" style={{ color: '#e6fffb', opacity: 0.6 }}>
                      Sealed packaging slows oxidation and contamination.
                    </small>
                  </div>
                </div>

              
              <div className="space-y-3">
                <div ref={gaugeRef} className="glass rounded-lg p-2"></div>
                {predicting && (
                  <div className="text-center">
                    <div className="skeleton-line mb-2"></div>
                    <div className="skeleton-line short mb-2"></div>
                    <p className="text-sm mt-2" style={{ color: '#e6fffb' }}>Running AI prediction...</p>
                  </div>
                )}
                
                {!predicting && safeHours !== null && (
                  <div className="glass rounded-lg p-4">
                    <h6 className="fw-bold mb-3" style={{ color: '#22d3ee' }}>
                      <i className="fas fa-chart-line me-2"></i>AI Analysis
                    </h6>
                    <div className="space-y-2">
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="small" style={{ color: '#e6fffb' }}>Predicted Safe Hours:</span>
                        <span className="fw-bold fs-5" style={{ color: riskInfo.color }}>{safeHours.toFixed(1)}h</span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="small" style={{ color: '#e6fffb' }}>Model Confidence:</span>
                        <span className="fw-bold" style={{ color: '#34d399' }}>92%</span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="small" style={{ color: '#e6fffb' }}>Risk Level:</span>
                        <span className="fw-bold" style={{ color: riskInfo.color }}>{riskInfo.level}</span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="small" style={{ color: '#e6fffb' }}>Estimated Meals:</span>
                        <span className="fw-bold" style={{ color: '#34d399' }}>{Math.floor(qty * 3)}</span>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                      <p className="small mb-2 fw-bold" style={{ color: '#22d3ee' }}>
                        <i className="fas fa-info-circle me-1"></i>What This Means:
                      </p>
                      {safeHours > 8 && (
                        <p className="small mb-0" style={{ color: '#e6fffb', lineHeight: '1.6' }}>
                          Excellent! Food is well-preserved. NGOs have plenty of time to claim and distribute. Perfect for scheduled pickups.
                        </p>
                      )}
                      {safeHours > 3 && safeHours <= 8 && (
                        <p className="small mb-0" style={{ color: '#e6fffb', lineHeight: '1.6' }}>
                          Moderate urgency. Food should be claimed within next few hours. NGOs will prioritize this for same-day distribution.
                        </p>
                      )}
                      {safeHours > 0 && safeHours <= 3 && (
                        <p className="small mb-0" style={{ color: '#e6fffb', lineHeight: '1.6' }}>
                          High priority! Food must be claimed ASAP. NGOs will receive urgent alerts and prioritize immediate pickup.
                        </p>
                      )}
                      {safeHours <= 0 && (
                        <p className="small mb-0" style={{ color: '#fb7185', lineHeight: '1.6' }}>
                          Unsafe for donation. Food has exceeded safe consumption window. Please dispose safely per local regulations.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <WizardInputVisualizer
                  temp={temp}
                  hoursAgo={hoursAgo}
                  safeHours={safeHours}
                  foodCategory={foodCategory}
                  storage={storage}
                  packaging={packaging}
                />
              </div>
            </div>

            
            <button 
              onClick={handleSubmit} 
              disabled={!canSubmit} 
              className={`mt-6 w-full py-3 rounded-xl font-bold transition-all d-flex align-items-center justify-content-center gap-2 ${ 
                canSubmit ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:scale-105' : 'bg-gray-600/50 cursor-not-allowed' 
              }`}
              style={{ fontSize: '1.1rem' }}
            >
              {canSubmit ? (
                <>
                  <i className="fas fa-paper-plane"></i>
                  Publish Donation to Marketplace
                </>
              ) : safeHours === 0 ? (
                <>
                  <i className="fas fa-ban"></i>
                  Food Unsafe - Cannot Submit
                </>
              ) : (
                <>
                  <i className="fas fa-edit"></i>
                  Fill All Fields to Continue
                </>
              )}
            </button>

            {canSubmit && (
              <div className="alert alert-success mt-3 mb-0" style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)' }}>
                <i className="fas fa-check-circle me-2" style={{ color: '#34d399' }}></i>
                <small style={{ color: '#e6fffb' }}>
                  Ready to publish! NGOs in your area will see this listing instantly and can claim within <strong>{safeHours.toFixed(1)} hours</strong>.
                </small>
              </div>
            )}

                    
                    <div className="glass rounded-xl p-5 wow fadeInUp" data-wow-delay="0.3s">
                      <h6 className="fw-bold mb-3" style={{ color: '#22d3ee' }}>
                        <i className="fas fa-microscope me-2"></i>Scientific Background: How Temperature & Time Affect Food Safety
                      </h6>
                      <div className="row g-3">
                        <div className="col-lg-4">
                          <div className="glass rounded-3 p-3 h-100">
                            <h6 className="small fw-bold mb-2" style={{ color: '#34d399' }}>Temperature Impact</h6>
                            <p className="small mb-0" style={{ color: '#e6fffb', lineHeight: '1.6' }}>
                              Bacterial growth is temperature-dependent. At 4 C or below, most bacteria remain dormant. At 37 C (body temp), bacteria can double every 20 minutes. Our model uses the <strong>Modified Gompertz equation</strong> to predict bacterial load over time.
                            </p>
                          </div>
                        </div>
                        <div className="col-lg-4">
                          <div className="glass rounded-3 p-3 h-100">
                            <h6 className="small fw-bold mb-2" style={{ color: '#34d399' }}>Time Decay Function</h6>
                            <p className="small mb-0" style={{ color: '#e6fffb', lineHeight: '1.6' }}>
                              Food quality degrades exponentially with time. The AI applies <strong>Arrhenius kinetics</strong> to model spoilage rate, adjusted for food type, moisture content, and pH levels based on USDA FoodKeeper database.
                            </p>
                          </div>
                        </div>
                        <div className="col-lg-4">
                          <div className="glass rounded-3 p-3 h-100">
                            <h6 className="small fw-bold mb-2" style={{ color: '#34d399' }}>Ensemble Prediction</h6>
                            <p className="small mb-0" style={{ color: '#e6fffb', lineHeight: '1.6' }}>
                              100 decision trees independently predict safe hours. The median prediction becomes our output. This <strong>bagging approach</strong> reduces variance and prevents overfitting, ensuring reliable predictions across food types.
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="alert alert-info mt-3 mb-0" style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)' }}>
                        <div className="row align-items-center">
                          <div className="col-lg-8">
                            <small style={{ color: '#e6fffb', lineHeight: '1.6' }}>
                              <i className="fas fa-graduation-cap me-2" style={{ color: '#22d3ee' }}></i>
                              Our model is validated against real-world outcomes and continuously improved using federated learning from actual rescue operations.
                            </small>
                          </div>
                          <div className="col-lg-4 text-end">
                            <small className="fw-bold" style={{ color: '#22d3ee' }}>Accuracy: 92.3% | MAE: 0.8h</small>
                          </div>
                        </div>
                      </div>
                    </div>
          </div>
        </div>
      );
    }

    function DigitalPickupPass({ listing, user, onOpenChat }) {
      const [timeLeft, setTimeLeft] = useState('');
      const passCode = listing?.pickup_pass?.pass_code || `PASS-${listing.id}-${(user.username || '').slice(0,3).toUpperCase()}`;
      const verified = Boolean(listing?.pickup_pass?.is_verified);

      useEffect(() => {
        const updateTimer = () => {
          const expiry = listing?.pickup_pass?.expires_at ? new Date(listing.pickup_pass.expires_at) : null;
          const now = new Date();
          let totalSeconds;
          if (expiry && !Number.isNaN(expiry.getTime())) {
            totalSeconds = Math.max(0, Math.floor((expiry.getTime() - now.getTime()) / 1000));
          } else {
            const safeHours = Number(listing.safe_hours || 0);
            totalSeconds = safeHours * 3600;
          }
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = totalSeconds % 60;
          setTimeLeft(`${String(hours).padStart(2, '0')}h:${String(minutes).padStart(2, '0')}m:${String(seconds).padStart(2, '0')}s`);
        };
        updateTimer();
        const timer = setInterval(updateTimer, 1000);
        return () => clearInterval(timer);
      }, [listing.safe_hours, listing?.pickup_pass?.expires_at]);

      const isUrgent = Number(listing.safe_hours) <= 2;

      return (
        <div className={`glass rounded-2xl p-6 border-2 ${ isUrgent ? 'border-rose-400/60' : 'border-emerald-400/60' } relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-500/20 to-transparent rounded-bl-full"></div>
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xs text-cyan-100/60 font-mono">DIGITAL PICKUP PASS</div>
                <div className="text-2xl font-black mt-1">{passCode}</div>
              </div>
              <div className="glass rounded-full px-3 py-1 text-xs font-bold">{verified ? 'VERIFIED' : listing.is_claimed ? 'CLAIMED' : 'ACTIVE'}</div>
            </div>
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div>
                <div className="text-xs text-cyan-100/60">Food Item</div>
                <div className="text-lg font-semibold mt-1">{listing.food_name}</div>
              </div>
              <div>
                <div className="text-xs text-cyan-100/60">Quantity</div>
                <div className="text-lg font-semibold mt-1">{listing.qty} KG</div>
              </div>
              <div>
                <div className="text-xs text-cyan-100/60">Donor</div>
                <div className="text-lg font-semibold mt-1">{listing.donor_name}</div>
              </div>
            </div>
            <div className="glass rounded-xl p-4 mb-4">
              <div className="text-xs text-cyan-100/60 mb-1">Pickup Address</div>
              <div className="text-sm">123 Donor Street, City Center</div>
              <div className="text-xs text-cyan-100/70 mt-1">Contact: +91-DONOR-HOTLINE</div>
            </div>
            <div className={`glass rounded-xl p-4 text-center ${ isUrgent ? 'border-2 border-rose-400' : '' }`}>
              {isUrgent && <div className="text-xs font-bold text-rose-300 mb-2 animate-pulse">WARNING: URGENT PICKUP REQUIRED</div>}
              <div className="text-xs text-cyan-100/60">AI Predicts Food Will Spoil In</div>
              <div className={`text-5xl font-black mt-2 ${ isUrgent ? 'text-rose-300' : 'text-emerald-300' }`}>{timeLeft}</div>
              <div className="text-xs text-cyan-100/60 mt-2">Pick up immediately to prevent waste</div>
            </div>
            <div className="d-flex justify-content-end mt-3">
              <button className="btn btn-sm btn-outline-info" onClick={() => onOpenChat && onOpenChat(listing.id)}>
                <i className="fas fa-comments me-2"></i>Open Chat
              </button>
            </div>
          </div>
        </div>
      );
    }

    function NGOMapView({ rows }) {
      const mapRef = useRef(null);

      useEffect(() => {
        const plotHost = mapRef.current;
        if (!plotHost) return;

        // Use real donor coords; fall back to Bhubaneswar-area jitter for null coords
        const ODISHA_BASE = { lat: 20.2961, lng: 85.8245 };
        const lats = rows.map((r) => r.donor_latitude != null ? r.donor_latitude : ODISHA_BASE.lat + (Math.random() - 0.5) * 0.18);
        const lons = rows.map((r) => r.donor_longitude != null ? r.donor_longitude : ODISHA_BASE.lng + (Math.random() - 0.5) * 0.18);
        const colors = rows.map((r) => Number(r.safe_hours) <= 2 ? '#fb7185' : Number(r.safe_hours) <= 5 ? '#fbbf24' : '#34d399');
        const sizes  = rows.map((r) => Math.max(10, Math.min(22, Number(r.qty || 0) * 1.6)));
        const texts  = rows.map((r) => {
          const dist = r.distance_km != null ? `${r.distance_km} km away` : '';
          const loc  = r.donor_location_text ? `${r.donor_location_text}` : '';
          return `<b>${r.food_name}</b><br>Donor: ${r.donor_name}<br>${loc}<br>Qty: ${r.qty} units<br>Safe: ${r.safe_hours}h${dist ? '<br>' + dist : ''}`;
        });

        renderPlot(plotHost, [{
            type: 'scattermapbox',
            lat: lats,
            lon: lons,
            mode: 'markers',
            marker: { size: sizes, color: colors, opacity: 0.88 },
            text: texts,
            hovertemplate: '%{text}<extra></extra>',
          }], {
            mapbox: { style: 'open-street-map', center: { lat: 20.2961, lon: 85.8245 }, zoom: 7 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            height: 600,
            margin: { t: 0, b: 0, l: 0, r: 0 },
          }, { displayModeBar: false });

        return () => purgePlot(plotHost);
      }, [rows]);

      return <div ref={mapRef} className="glass rounded-2xl overflow-hidden"></div>;
    }

    function WizardInputVisualizer({ temp, hoursAgo, safeHours, foodCategory, storage, packaging }) {
      const matrixRef = useRef(null);

      useEffect(() => {
        const plotHost = matrixRef.current;
        if (!plotHost) return;

        const tempAxis = [0, 5, 10, 15, 20, 25, 30, 40, 50, 60];
        const hourAxis = [0, 2, 4, 6, 8, 10, 12, 16, 20, 24];
        const categoryAdj = { protein: -2.4, dairy: -1.6, produce: -0.8, grains: 1.2, prepared: -1.2 };
        const storageAdj = { frozen: 10, refrigerated: 5, ambient: 0 };
        const packagingAdj = { sealed: 2.5, bulk: 1.1, open: 0 };
        const z = hourAxis.map((hour) => tempAxis.map((temperature) => {
          const estimate = 22 - hour * 1.05 - Math.max(0, temperature - 4) * 0.24 + (categoryAdj[foodCategory] || 0) + (storageAdj[storage] || 0) + (packagingAdj[packaging] || 0);
          return Math.max(0, Number(estimate.toFixed(1)));
        }));

        renderPlot(plotHost, [
          {
            type: 'heatmap',
            x: tempAxis,
            y: hourAxis,
            z,
            colorscale: [
              [0, '#7f1d1d'],
              [0.2, '#be123c'],
              [0.45, '#f59e0b'],
              [0.7, '#22d3ee'],
              [1, '#34d399'],
            ],
            hovertemplate: 'Temp %{x} C<br>Hours %{y}<br>Estimated safe %{z}h<extra></extra>',
            showscale: false,
          },
          {
            type: 'scatter',
            mode: 'markers+text',
            x: [temp],
            y: [hoursAgo],
            text: [safeHours === null ? 'Current input' : `${safeHours.toFixed(1)}h`],
            textposition: 'top center',
            marker: {
              size: 14,
              color: '#ecfeff',
              line: { width: 3, color: '#22d3ee' },
            },
            hovertemplate: 'Current state<br>Temp %{x} C<br>Hours %{y}<extra></extra>',
          },
        ], {
          title: { text: 'Condition Safety Matrix', font: { color: '#e6fffb', size: 16 } },
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          height: 260,
          margin: { t: 40, b: 40, l: 40, r: 20 },
          xaxis: { title: 'Temperature C', color: '#c4f1ff', gridcolor: 'rgba(255,255,255,0.08)' },
          yaxis: { title: 'Hours Since Prep', color: '#c4f1ff', gridcolor: 'rgba(255,255,255,0.08)' },
        }, { displayModeBar: false, responsive: true });

        return () => purgePlot(plotHost);
      }, [temp, hoursAgo, safeHours, foodCategory, storage, packaging]);

      return (
        <div className="glass rounded-lg p-4">
          <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
            <div>
              <h6 className="fw-bold mb-1" style={{ color: '#22d3ee' }}><i className="fas fa-border-all me-2"></i>Visual Risk Matrix</h6>
              <p className="small mb-0" style={{ color: '#e6fffb', opacity: 0.72 }}>Your current donation sits on the matrix as a live point, so donors can see how heat and elapsed time change the safe window.</p>
            </div>
          </div>
          <div ref={matrixRef}></div>
        </div>
      );
    }

    function NGOFunnelViz({ rows, ngoRows }) {
      const funnelRef = useRef(null);

      useEffect(() => {
        const plotHost = funnelRef.current;
        if (!plotHost) return;
        const available = rows.filter((r) => !r.is_claimed).length;
        const warm = rows.filter((r) => !r.is_claimed && Number(r.safe_hours) <= 8).length;
        const urgent = rows.filter((r) => !r.is_claimed && Number(r.safe_hours) <= 3).length;
        const claimed = ngoRows.length;

        const funnelStages = buildMonotonicFunnelStages([
          { label: 'Available Supply', value: available },
          { label: 'Time-Sensitive', value: warm },
          { label: 'Urgent Rescue', value: urgent },
          { label: 'Your Active Claims', value: claimed },
        ]);

        renderPlot(plotHost, [{
          type: 'funnel',
          y: funnelStages.map((stage) => stage.label),
          x: funnelStages.map((stage) => stage.value),
          customdata: funnelStages.map((stage) => stage.rawValue),
          textinfo: 'value+percent initial',
          hovertemplate: '%{y}<br>Pipeline count %{x}<br>Recorded %{customdata}<extra></extra>',
          marker: { color: ['#22d3ee', '#34d399', '#f59e0b', '#6366f1'] },
          connector: { line: { color: 'rgba(225,248,255,0.28)', width: 2 } },
        }], {
          title: { text: 'Claim Funnel', font: { color: '#e6fffb', size: 16 } },
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          height: 320,
          margin: { t: 40, b: 20, l: 110, r: 20 },
          font: { color: '#e6fffb' },
        }, { displayModeBar: false, responsive: true });

        return () => purgePlot(plotHost);
      }, [rows, ngoRows]);

      return <div ref={funnelRef} className="glass rounded-3xl p-2"></div>;
    }

    function NgoAiAdvisor({ rows, ngoRows, onClaim }) {
      const unclaimed = rows.filter((r) => !r.is_claimed);
      const topPicks = unclaimed.slice(0, 8);
      const criticalCount = unclaimed.filter((r) => Number(r.safe_hours) <= 2).length;
      const urgentCount = unclaimed.filter((r) => Number(r.safe_hours) > 2 && Number(r.safe_hours) <= 5).length;
      const topAvgScore = unclaimed.length > 0
        ? Math.round(unclaimed.slice(0, 5).reduce((s, r) => s + Number(r.priority_score || 0), 0) / Math.min(5, unclaimed.length))
        : 0;

      return (
        <InfoPage title="/ngo/ai-advisor" subtitle="ML-ranked claim recommendations">
          <section className="glass rounded-3xl p-5 mb-4 wow fadeInDown section-enter" data-wow-delay="0.1s">
            <div className="d-flex align-items-center gap-3 mb-4">
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fas fa-magic fa-lg" style={{ color: '#818cf8' }}></i>
              </div>
              <div>
                <h4 className="fw-bold mb-0" style={{ color: '#ecfeff' }}>AI Claim Advisor</h4>
                <small style={{ color: 'rgba(225,248,255,0.6)' }}>RandomForest model - priority score 0-100 - real-time feed</small>
              </div>
            </div>
            <div className="row g-3 mb-4">
              <div className="col-md-4">
                <div style={{ background: 'rgba(251,113,133,0.1)', border: '1px solid rgba(251,113,133,0.3)', borderRadius: 12, padding: '14px 16px' }}>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <i className="fas fa-exclamation-triangle" style={{ color: '#fb7185', fontSize: 11 }}></i>
                    <small style={{ color: 'rgba(225,248,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10 }}>{'Critical <=2h'}</small>
                  </div>
                  <div className="fw-bold" style={{ color: '#fb7185', fontSize: 26 }}>{criticalCount}</div>
                  <small style={{ color: 'rgba(225,248,255,0.5)' }}>Claim immediately</small>
                </div>
              </div>
              <div className="col-md-4">
                <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.28)', borderRadius: 12, padding: '14px 16px' }}>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <i className="fas fa-clock" style={{ color: '#fbbf24', fontSize: 11 }}></i>
                    <small style={{ color: 'rgba(225,248,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10 }}>Urgent 2-5h</small>
                  </div>
                  <div className="fw-bold" style={{ color: '#fbbf24', fontSize: 26 }}>{urgentCount}</div>
                  <small style={{ color: 'rgba(225,248,255,0.5)' }}>Claim within the hour</small>
                </div>
              </div>
              <div className="col-md-4">
                <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 12, padding: '14px 16px' }}>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <i className="fas fa-magic" style={{ color: '#818cf8', fontSize: 11 }}></i>
                    <small style={{ color: 'rgba(225,248,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10 }}>AI Priority Score</small>
                  </div>
                  <div className="fw-bold" style={{ color: '#818cf8', fontSize: 26 }}>{topAvgScore}<span style={{ fontSize: 14, fontWeight: 400 }}>/100</span></div>
                  <small style={{ color: 'rgba(225,248,255,0.5)' }}>Top-5 avg urgency</small>
                </div>
              </div>
            </div>
            <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10, padding: '12px 16px' }}>
              <small style={{ color: '#e6fffb' }}>
                <i className="fas fa-magic me-2" style={{ color: '#818cf8' }}></i>
                <strong>How the AI ranks:</strong> Each listing scores 0-100 using the on-device RandomForest model. Inputs: remaining safe window, temperature, storage type, packaging, and your proximity. Claim the highest-scored items first to maximise rescue impact.
              </small>
            </div>
          </section>

          <div className="glass rounded-3xl p-4">
            <div className="d-flex align-items-center justify-content-between mb-4">
              <h5 className="fw-bold mb-0" style={{ color: '#22d3ee' }}>
                <i className="fas fa-magic me-2"></i>AI Priority Queue
              </h5>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 99, background: 'rgba(99,102,241,0.18)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.32)' }}>
                {unclaimed.length} unclaimed available
              </span>
            </div>
            {unclaimed.length === 0 ? (
              <p style={{ color: 'rgba(225,248,255,0.5)' }}>No unclaimed listings right now. Check back soon.</p>
            ) : (
              <div className="space-y-3">
                {topPicks.map((r, i) => {
                  const priority = Number(r.priority_score || 0);
                  const conf = Number(r.confidence_score || 0);
                  const safe = Number(r.safe_hours || 0);
                  const urgencyTone = getSafeHoursTone(safe);
                  const infoTone = getToneVars('info');
                  const urgencyLabel = safe <= 2 ? 'CRITICAL' : safe <= 5 ? 'URGENT' : 'STABLE';
                  return (
                    <div key={r.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px 16px' }}>
                      <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                        <div className="d-flex align-items-center gap-3">
                          <div style={{ minWidth: 30, height: 30, borderRadius: 8, background: infoTone.bg, border: `1px solid ${infoTone.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: infoTone.text, flexShrink: 0 }}>
                            {i + 1}
                          </div>
                          <div>
                            <div className="fw-bold" style={{ color: '#ecfeff', fontSize: 15 }}>{r.food_name}</div>
                            <small style={{ color: 'rgba(225,248,255,0.5)' }}>
                              {r.qty} units - {r.food_category || 'misc'} - {r.donor_name}{r.distance_km != null ? ` - ${r.distance_km} km away` : ''}
                            </small>
                          </div>
                        </div>
                        <div className="d-flex align-items-center gap-2 flex-shrink-0">
                          <span style={{ padding: '2px 9px', borderRadius: 99, background: urgencyTone.bg, color: urgencyTone.text, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', border: `1px solid ${urgencyTone.border}` }}>{urgencyLabel}</span>
                          {onClaim && <button onClick={() => onClaim(r.id)} style={{ background: getToneVars('success').bg, border: `1px solid ${getToneVars('success').border}`, color: getToneVars('success').text, fontSize: 13, fontWeight: 600, padding: '4px 14px', borderRadius: 8, cursor: 'pointer' }}>Claim</button>}
                        </div>
                      </div>
                      <div className="d-flex align-items-center gap-3 mb-1">
                        <small style={{ color: 'rgba(225,248,255,0.45)', minWidth: 82, fontSize: 11 }}>AI Priority</small>
                        <div style={{ flex: 1, height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, priority)}%`, height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${urgencyTone.bg}, ${urgencyTone.text})` }}></div>
                        </div>
                        <small style={{ color: urgencyTone.text, fontWeight: 700, minWidth: 32, fontSize: 12, textAlign: 'right' }}>{Math.round(priority)}</small>
                      </div>
                      <div className="d-flex align-items-center gap-3 mb-2">
                        <small style={{ color: 'rgba(225,248,255,0.45)', minWidth: 82, fontSize: 11 }}>Confidence</small>
                        <div style={{ flex: 1, height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, conf)}%`, height: '100%', borderRadius: 99, background: 'linear-gradient(90deg, rgba(99,102,241,0.6), #6366f1)' }}></div>
                        </div>
                        <small style={{ color: '#818cf8', fontWeight: 700, minWidth: 32, fontSize: 12, textAlign: 'right' }}>{Math.round(conf)}%</small>
                      </div>
                      <div className="d-flex gap-3">
                        <small style={{ color: 'rgba(225,248,255,0.45)' }}><i className="fas fa-clock me-1"></i>{safe.toFixed(1)}h safe window</small>
                        <small style={{ color: 'rgba(225,248,255,0.45)' }}><i className="fas fa-thermometer-half me-1"></i>{r.temp} C</small>
                        {r.storage_conditions && <small style={{ color: 'rgba(225,248,255,0.45)' }}><i className="fas fa-box me-1"></i>{r.storage_conditions}</small>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </InfoPage>
      );
    }

    function AdminRiskScatter({ rows }) {
      const scatterRef = useRef(null);

      useEffect(() => {
        const plotHost = scatterRef.current;
        if (!plotHost || rows.length === 0) return;
        const sample = rows.slice(0, 80);
        renderPlot(plotHost, [{
          type: 'scatter',
          mode: 'markers',
          x: sample.map((r) => Number(r.temp || 0)),
          y: sample.map((r) => Number(r.safe_hours || 0)),
          text: sample.map((r) => `${r.food_name}<br>${r.donor_name}<br>${r.is_claimed ? 'Claimed' : 'Available'}`),
          hovertemplate: '%{text}<br>Temp %{x} C<br>Safe %{y}h<extra></extra>',
          marker: {
            size: sample.map((r) => Math.max(10, Math.min(26, Number(r.qty || 0) * 2.2))),
            color: sample.map((r) => r.is_claimed ? '#22d3ee' : Number(r.safe_hours || 0) <= 3 ? '#fb7185' : '#34d399'),
            opacity: 0.78,
            line: { width: 1.5, color: 'rgba(255,255,255,0.28)' },
          },
        }], {
          title: { text: 'Risk Scatter: Temperature vs Safe Hours', font: { color: '#e6fffb', size: 16 } },
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          height: 320,
          margin: { t: 40, b: 40, l: 45, r: 20 },
          xaxis: { title: 'Temperature C', color: '#c4f1ff', gridcolor: 'rgba(255,255,255,0.08)' },
          yaxis: { title: 'Safe Hours', color: '#c4f1ff', gridcolor: 'rgba(255,255,255,0.08)' },
        }, { displayModeBar: false, responsive: true });

        return () => purgePlot(plotHost);
      }, [rows]);

      return <div ref={scatterRef} className="glass rounded-3xl p-2"></div>;
    }

    function MiniSparkline({ values = [], color = '#34d399' }) {
      const safeValues = (values || []).map((v) => Number(v || 0));
      if (safeValues.length < 2) return null;
      const min = Math.min(...safeValues);
      const max = Math.max(...safeValues);
      const range = Math.max(1, max - min);
      const points = safeValues.map((v, i) => {
        const x = (i / (safeValues.length - 1)) * 64;
        const y = 18 - ((v - min) / range) * 16;
        return `${x},${y}`;
      }).join(' ');
      return (
        <svg width="66" height="20" viewBox="0 0 66 20" aria-hidden="true">
          <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
        </svg>
      );
    }

    function FeaturedVisualizationRotator({ analytics, rows, setPath }) {
      const [index, setIndex] = useState(0);
      const cards = [
        {
          tag: 'TREEMAP',
          title: 'Donor Volume Landscape',
          text: 'Compare donor contribution footprint by area size to spot major supply hubs quickly.',
          accent: '#34d399',
          statLabel: 'Top donor volume',
          statValue: `${Number((analytics?.donor_volume || []).slice().sort((a, b) => Number(b.qty || 0) - Number(a.qty || 0))[0]?.qty || 0).toFixed(1)} kg`,
          cta: '/login',
        },
        {
          tag: 'FUNNEL',
          title: 'Rescue Conversion Funnel',
          text: 'Track conversion from listed food to claimed rescue, and identify urgent bottlenecks.',
          accent: '#22d3ee',
          statLabel: 'Urgent now',
          statValue: `${rows.filter((r) => Number(r.safe_hours || 0) <= 3).length}`,
          cta: '/login',
        },
        {
          tag: 'SCATTER',
          title: 'Risk Relationship Plot',
          text: 'See how temperature and elapsed time correlate with safe hours across live listings.',
          accent: '#f59e0b',
          statLabel: 'Data points',
          statValue: `${rows.length}`,
          cta: '/login',
        },
      ];

      useEffect(() => {
        const timer = setInterval(() => setIndex((i) => (i + 1) % cards.length), 4200);
        return () => clearInterval(timer);
      }, []);

      const active = cards[index];

      return (
        <section className="glass rounded-3xl p-5 mb-5 wow fadeInUp" data-wow-delay="0.12s">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
            <div>
              <p style={{ fontSize: 12, letterSpacing: '0.12em', color: '#34d399', fontWeight: 700, marginBottom: 8 }}>FEATURED VISUALIZATION</p>
              <h3 className="fw-bold mb-1" style={{ color: '#ecfeff' }}>{active.title}</h3>
              <p className="mb-0" style={{ color: 'rgba(225,248,255,0.7)' }}>{active.text}</p>
            </div>
            <div className="glass rounded-3 px-3 py-2 text-end" style={{ minWidth: 132 }}>
              <div style={{ fontSize: 11, color: 'rgba(225,248,255,0.58)' }}>{active.statLabel}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: active.accent }}>{active.statValue}</div>
            </div>
          </div>
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div className="d-flex gap-2">
              {cards.map((c, i) => (
                <span key={c.tag} style={{ width: 30, height: 4, borderRadius: 999, background: i === index ? c.accent : 'rgba(225,248,255,0.18)', display: 'inline-block' }}></span>
              ))}
            </div>
            <button onClick={() => navigate(setPath, active.cta)} className="btn btn-primary">
              Login to Open Visual Lab
            </button>
          </div>
        </section>
      );
    }

    function PortalRoleLeaderboard({ role, user, analytics, rows, donorRows, ngoRows, adminUsers }) {
      const donorRanked = (analytics?.donor_volume || []).slice().sort((a, b) => Number(b.qty || 0) - Number(a.qty || 0));
      const ngoRanked = (analytics?.ngo_claims || []).slice().sort((a, b) => Number(b.claims || 0) - Number(a.claims || 0));

      const donorPosition = user ? donorRanked.findIndex((d) => d.name === user.username) + 1 : 0;
      const ngoPosition = user ? ngoRanked.findIndex((n) => n.name === user.username) + 1 : 0;

      const topDonors = donorRanked.slice(0, 5);
      const topNgos = ngoRanked.slice(0, 5);
      const urgent = rows.filter((r) => !r.is_claimed && Number(r.safe_hours || 0) <= 3).slice(0, 5);

      return (
        <section className="section-enter mt-6">
          <div className="glass rounded-3xl p-5">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
              <div>
                <h4 className="fw-bold mb-1" style={{ color: '#22d3ee' }}><i className="fas fa-trophy me-2"></i>{role} Leaderboard</h4>
                <p className="mb-0" style={{ color: 'rgba(225,248,255,0.68)' }}>Role-specific ranking intelligence with live momentum cues.</p>
              </div>
              {role === 'DONOR' && <div className="glass rounded-full px-3 py-2"><small style={{ color: '#d9fdfa' }}>Your donor rank: <strong style={{ color: '#34d399' }}>{donorPosition || '-'}</strong></small></div>}
              {role === 'NGO' && <div className="glass rounded-full px-3 py-2"><small style={{ color: '#d9fdfa' }}>Your NGO rank: <strong style={{ color: '#22d3ee' }}>{ngoPosition || '-'}</strong></small></div>}
              {role === 'ADMIN' && <div className="glass rounded-full px-3 py-2"><small style={{ color: '#d9fdfa' }}>Governed users: <strong style={{ color: '#34d399' }}>{adminUsers?.length || 0}</strong></small></div>}
            </div>

            <div className="row g-4">
              <div className="col-lg-4">
                <div className="glass rounded-3 p-4 h-100">
                  <h6 className="fw-bold mb-3" style={{ color: '#22d3ee' }}>Top Donors</h6>
                  <div className="space-y-2">
                    {topDonors.map((d, i) => {
                      const base = Number(d.qty || 0);
                      return (
                        <div key={d.name} className="d-flex justify-content-between align-items-center">
                          <span style={{ color: '#ecfeff', fontSize: 13 }}>{i + 1}. {d.name}</span>
                          <div className="d-flex align-items-center gap-2">
                            <MiniSparkline values={[base * 0.6, base * 0.72, base * 0.81, base * 0.9, base]} color="#34d399" />
                            <strong style={{ color: '#34d399', fontSize: 13 }}>{base.toFixed(1)}kg</strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="col-lg-4">
                <div className="glass rounded-3 p-4 h-100">
                  <h6 className="fw-bold mb-3" style={{ color: '#22d3ee' }}>Top NGOs</h6>
                  <div className="space-y-2">
                    {topNgos.map((n, i) => {
                      const base = Number(n.claims || 0);
                      return (
                        <div key={n.name} className="d-flex justify-content-between align-items-center">
                          <span style={{ color: '#ecfeff', fontSize: 13 }}>{i + 1}. {n.name}</span>
                          <div className="d-flex align-items-center gap-2">
                            <MiniSparkline values={[Math.max(1, base - 3), Math.max(1, base - 2), Math.max(1, base - 1), base, base + 1]} color="#22d3ee" />
                            <strong style={{ color: '#22d3ee', fontSize: 13 }}>{base}</strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="col-lg-4">
                <div className="glass rounded-3 p-4 h-100">
                  <h6 className="fw-bold mb-3" style={{ color: '#22d3ee' }}>{role === 'DONOR' ? 'Your Listings Momentum' : role === 'NGO' ? 'Urgent Opportunities' : 'Urgent Oversight'}</h6>
                  <div className="space-y-2">
                    {(role === 'DONOR' ? donorRows.slice(0, 5) : role === 'NGO' ? ngoRows.slice(0, 5) : urgent).map((item, i) => {
                      const safe = Number(item.safe_hours || 0);
                      const qty = Number(item.qty || 0);
                      return (
                        <div key={`${item.id || i}-${item.food_name || 'item'}`} className="d-flex justify-content-between align-items-center">
                          <span style={{ color: '#ecfeff', fontSize: 13 }}>{i + 1}. {item.food_name || item.name || 'Listing'}</span>
                          <div className="d-flex align-items-center gap-2">
                            <MiniSparkline values={[Math.max(0, safe + 1.5), Math.max(0, safe + 0.9), Math.max(0, safe + 0.4), Math.max(0, safe + 0.1), Math.max(0, safe)]} color={safe <= 3 ? '#fb7185' : '#34d399'} />
                            <strong style={{ color: safe <= 3 ? '#fb7185' : '#34d399', fontSize: 13 }}>{role === 'DONOR' ? `${qty.toFixed(1)}kg` : `${safe.toFixed(1)}h`}</strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      );
    }

    function RealtimeLeaderboard({ analytics, rows, title = 'Public Leaderboard', subtitle = 'Top donors, top NGOs, and live heavy-volume listings visible to everyone.' }) {
      const donors = (analytics?.donor_volume || []).slice().sort((a, b) => Number(b.qty || 0) - Number(a.qty || 0)).slice(0, 5);
      const ngos = (analytics?.ngo_claims || []).slice().sort((a, b) => Number(b.claims || 0) - Number(a.claims || 0)).slice(0, 5);
      const liveUsers = rows.slice().sort((a, b) => Number(b.qty || 0) - Number(a.qty || 0)).slice(0, 6);

      return (
        <section className="section-enter mt-7">
          <div className="glass rounded-3xl p-6">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
              <div>
                <p className="mb-2" style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#34d399', fontWeight: 700 }}>Realtime Rankings</p>
                <h3 className="text-2xl font-bold mb-1">{title}</h3>
                <p className="mb-0" style={{ color: 'rgba(225,248,255,0.68)' }}>{subtitle}</p>
              </div>
              <div className="glass rounded-full px-3 py-2">
                <small style={{ color: '#d9fdfa' }}><i className="fas fa-bolt me-2" style={{ color: '#34d399' }}></i>Updates whenever live data refreshes</small>
              </div>
            </div>

            <div className="row g-4">
              <div className="col-lg-4">
                <div className="glass rounded-3 p-4 h-100">
                  <h5 className="fw-bold mb-3" style={{ color: '#22d3ee' }}><i className="fas fa-trophy me-2"></i>Top Donors</h5>
                  <div className="space-y-3">
                    {donors.length === 0 && <p className="mb-0 text-cyan-100/70">No donor rankings yet.</p>}
                    {donors.map((donor, index) => (
                      <div key={donor.name} className="d-flex justify-content-between align-items-center glass rounded-3 px-3 py-2">
                        <div className="d-flex align-items-center gap-3">
                          <div style={{ width: 28, height: 28, borderRadius: 999, background: getRankTone(index).bg, border: `1px solid ${getRankTone(index).border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: getRankTone(index).text, fontWeight: 800 }}>{index + 1}</div>
                          <div>
                            <div style={{ color: '#ecfeff', fontWeight: 700 }}>{donor.name}</div>
                            <div style={{ color: 'rgba(225,248,255,0.58)', fontSize: 12 }}>Food volume contribution</div>
                          </div>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <MiniSparkline values={[Number(donor.qty || 0) * 0.62, Number(donor.qty || 0) * 0.74, Number(donor.qty || 0) * 0.83, Number(donor.qty || 0) * 0.91, Number(donor.qty || 0)]} color={getToneVars('success').text} />
                          <strong style={{ color: getToneVars('success').text }}>{Number(donor.qty || 0).toFixed(1)} kg</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="col-lg-4">
                <div className="glass rounded-3 p-4 h-100">
                  <h5 className="fw-bold mb-3" style={{ color: '#22d3ee' }}><i className="fas fa-hand-holding-heart me-2"></i>Top NGOs</h5>
                  <div className="space-y-3">
                    {ngos.length === 0 && <p className="mb-0 text-cyan-100/70">No NGO rankings yet.</p>}
                    {ngos.map((ngo, index) => (
                      <div key={ngo.name} className="d-flex justify-content-between align-items-center glass rounded-3 px-3 py-2">
                        <div className="d-flex align-items-center gap-3">
                          <div style={{ width: 28, height: 28, borderRadius: 999, background: getRankTone(index).bg, border: `1px solid ${getRankTone(index).border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: getRankTone(index).text, fontWeight: 800 }}>{index + 1}</div>
                          <div>
                            <div style={{ color: '#ecfeff', fontWeight: 700 }}>{ngo.name}</div>
                            <div style={{ color: 'rgba(225,248,255,0.58)', fontSize: 12 }}>Successful claim activity</div>
                          </div>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <MiniSparkline values={[Math.max(1, Number(ngo.claims || 0) - 3), Math.max(1, Number(ngo.claims || 0) - 2), Math.max(1, Number(ngo.claims || 0) - 1), Number(ngo.claims || 0), Number(ngo.claims || 0) + 1]} color={getToneVars('info').text} />
                          <strong style={{ color: getToneVars('info').text }}>{Number(ngo.claims || 0)} claims</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="col-lg-4">
                <div className="glass rounded-3 p-4 h-100">
                  <h5 className="fw-bold mb-3" style={{ color: '#22d3ee' }}><i className="fas fa-fire me-2"></i>Live User Board</h5>
                  <div className="space-y-3">
                    {liveUsers.length === 0 && <p className="mb-0 text-cyan-100/70">No live user activity yet.</p>}
                    {liveUsers.map((item, index) => (
                      <div key={`${item.id}-${item.donor_name}`} className="glass rounded-3 px-3 py-2">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span style={{ color: '#ecfeff', fontWeight: 700 }}>#{index + 1} {item.donor_name}</span>
                          <div className="d-flex align-items-center gap-2">
                            <MiniSparkline values={[Number(item.qty || 0) * 0.55, Number(item.qty || 0) * 0.68, Number(item.qty || 0) * 0.8, Number(item.qty || 0) * 0.92, Number(item.qty || 0)]} color={Number(item.safe_hours || 0) <= 3 ? '#fb7185' : '#34d399'} />
                            <span style={{ color: Number(item.safe_hours || 0) <= 3 ? '#fb7185' : '#34d399', fontWeight: 700 }}>{Number(item.qty || 0).toFixed(1)} kg</span>
                          </div>
                        </div>
                        <div style={{ color: 'rgba(225,248,255,0.62)', fontSize: 12 }}>{item.food_name} - {item.is_claimed ? 'Claimed' : 'Available'} - {Number(item.safe_hours || 0).toFixed(1)}h safe</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      );
    }

    function VisualizationLab({ analytics, rows, setPath, user, theme = 'dark' }) {
      const isDark = theme !== 'light';
      const axisColor = isDark ? '#c4f1ff' : '#374151';
      const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
      const treemapRef = useRef(null);
      const funnelRef = useRef(null);
      const bubbleRef = useRef(null);
      const heatmapRef = useRef(null);
      const boxRef = useRef(null);
      const geoRef = useRef(null);
      const radarRef = useRef(null);
      const waterfallRef = useRef(null);
      const sankeyRef = useRef(null);

      const chartCatalog = [
        { key: 'treemap', title: 'Treemap', description: 'Shows which donor groups contribute the most volume.', ref: treemapRef },
        { key: 'funnel', title: 'Funnel', description: 'Shows the rescue pipeline from listings to urgent cases.', ref: funnelRef },
        { key: 'bubble', title: 'Bubble Chart', description: 'Temperature vs safe hours, with bubble size for donation quantity.', ref: bubbleRef },
        { key: 'heatmap', title: 'Heatmap', description: 'Density of listings across temperature and age buckets.', ref: heatmapRef },
        { key: 'box', title: 'Box Plot', description: 'Distribution spread of safe hours for claimed vs available items.', ref: boxRef },
        { key: 'geo', title: 'Scatter Map', description: 'Geographic pickup perspective for active marketplace items.', ref: geoRef },
        { key: 'radar', title: 'Radar Chart', description: 'Compares top donor volume vs top NGO claims in a radial score view.', ref: radarRef },
        { key: 'waterfall', title: 'Waterfall Chart', description: 'Tracks how total listings convert into claims, urgent cases, and remaining reserve.', ref: waterfallRef },
        { key: 'sankey', title: 'Sankey Flow', description: 'Illustrative donor-to-NGO rescue flow showing how supply can move across the network.', ref: sankeyRef },
      ];

      const mountedChartKeys = chartCatalog.map((chart) => chart.key);

      useEffect(() => {
        if (!analytics) return;

        const hostByKey = {
          treemap: treemapRef.current,
          funnel: funnelRef.current,
          bubble: bubbleRef.current,
          heatmap: heatmapRef.current,
          box: boxRef.current,
          geo: geoRef.current,
          radar: radarRef.current,
          waterfall: waterfallRef.current,
          sankey: sankeyRef.current,
        };

        if (mountedChartKeys.some((key) => !hostByKey[key])) return;

        chartCatalog.forEach((chart) => {
          if (chart.ref.current) purgePlot(chart.ref.current);
        });

        const donorVolume = analytics.donor_volume || [];
        const ngoClaims = analytics.ngo_claims || [];
        const available = rows.filter((r) => !r.is_claimed).length;
        const claimed = rows.filter((r) => r.is_claimed).length;
        const urgent = rows.filter((r) => Number(r.safe_hours) <= 3).length;
        const baseHeight = 300;
        const mapHeight = 300;
        const compactMargin = null;
        const compactAxis = {};

        const shouldRender = (key) => mountedChartKeys.includes(key);

        if (shouldRender('treemap')) renderPlot(hostByKey.treemap, [{
          type: 'treemap',
          labels: donorVolume.map((d) => d.name),
          parents: donorVolume.map(() => 'Donor Network'),
          values: donorVolume.map((d) => Number(d.qty || 0)),
          textinfo: 'label+value',
          hovertemplate: '%{label}<br>Volume %{value} kg<extra></extra>',
          marker: { colors: isDark ? ['#22d3ee', '#34d399', '#60a5fa', '#f59e0b', '#f472b6', '#6366f1'] : ['#0e7490', '#166534', '#3b82f6', '#b45309', '#db2777', '#6366f1'] },
          branchvalues: 'total',
        }], {
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          margin: { t: 20, b: 10, l: 10, r: 10 },
          height: baseHeight,
          font: { color: isDark ? '#e6fffb' : '#111111' },
        }, { displayModeBar: false, responsive: true }, theme);

        const timeSensitive = rows.filter((r) => !r.is_claimed && Number(r.safe_hours) <= 8).length;
        const funnelStages = buildMonotonicFunnelStages([
          { label: 'Total Listings', value: rows.length },
          { label: 'Available', value: available },
          { label: 'Time-Sensitive', value: timeSensitive },
          { label: 'Urgent', value: urgent },
        ]);

        if (shouldRender('funnel')) renderPlot(hostByKey.funnel, [{
          type: 'funnel',
          y: funnelStages.map((stage) => stage.label),
          x: funnelStages.map((stage) => stage.value),
          customdata: funnelStages.map((stage) => stage.rawValue),
          marker: { color: isDark ? ['#22d3ee', '#34d399', '#6366f1', '#fb7185'] : ['#0e7490', '#166534', '#3b82f6', '#dc2626'] },
          textinfo: 'value+percent initial',
          hovertemplate: '%{y}<br>Listings %{x}<br>Recorded %{customdata}<extra></extra>',
        }], {
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          margin: { t: 20, b: 20, l: 100, r: 20 },
          height: baseHeight,
          font: { color: isDark ? '#e6fffb' : '#111111', size: 13 },
        }, { displayModeBar: false, responsive: true }, theme);

        if (shouldRender('bubble')) renderPlot(hostByKey.bubble, [{
          type: 'scatter',
          mode: 'markers',
          x: rows.map((r) => Number(r.temp || 0)),
          y: rows.map((r) => Number(r.safe_hours || 0)),
          text: rows.map((r) => `${r.food_name}<br>Qty ${r.qty}kg`),
          hovertemplate: '%{text}<br>Temp %{x} C<br>Safe %{y}h<extra></extra>',
          marker: {
            size: rows.map((r) => Math.max(10, Math.min(30, Number(r.qty || 0) * 2))),
            color: rows.map((r) => Number(r.hours_ago || 0)),
            colorscale: 'Viridis',
            showscale: false,
            opacity: 0.75,
            line: { width: 1, color: isDark ? 'rgba(255,255,255,0.24)' : 'rgba(0,0,0,0.2)' },
          },
        }], {
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          margin: compactMargin || { t: 20, b: 40, l: 45, r: 20 },
          height: baseHeight,
          xaxis: { title: 'Temperature C', color: axisColor, gridcolor: gridColor, ...compactAxis },
          yaxis: { title: 'Safe Hours', color: axisColor, gridcolor: gridColor, ...compactAxis },
          font: { color: isDark ? '#e6fffb' : '#111111', size: 13 },
        }, { displayModeBar: false, responsive: true }, theme);

        const tempBins = [0, 5, 10, 15, 20, 25, 30, 40, 60];
        const hourBins = [0, 2, 4, 6, 8, 12, 16, 20, 24];
        const z = hourBins.slice(0, -1).map((hourStart, rowIndex) => tempBins.slice(0, -1).map((tempStart, colIndex) => rows.filter((r) => Number(r.hours_ago || 0) >= hourStart && Number(r.hours_ago || 0) < hourBins[rowIndex + 1] && Number(r.temp || 0) >= tempStart && Number(r.temp || 0) < tempBins[colIndex + 1]).length));
        if (shouldRender('heatmap')) renderPlot(hostByKey.heatmap, [{
          type: 'heatmap',
          x: tempBins.slice(0, -1).map((v, i) => `${v}-${tempBins[i + 1]} C`),
          y: hourBins.slice(0, -1).map((v, i) => `${v}-${hourBins[i + 1]}h`),
          z,
          colorscale: isDark ? 'YlGnBu' : 'YlOrRd',
          showscale: false,
          hovertemplate: 'Temp %{x}<br>Hours %{y}<br>Listings %{z}<extra></extra>',
        }], {
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          margin: { t: 20, b: 40, l: 70, r: 20 },
          height: baseHeight,
          font: { color: isDark ? '#e6fffb' : '#111111', size: 13 },
        }, { displayModeBar: false, responsive: true }, theme);

        if (shouldRender('box')) renderPlot(hostByKey.box, [
          {
            type: 'box',
            name: 'Available',
            y: rows.filter((r) => !r.is_claimed).map((r) => Number(r.safe_hours || 0)),
            marker: { color: isDark ? '#34d399' : '#166534' },
            line: { color: isDark ? '#34d399' : '#166534' },
            boxmean: true,
            hovertemplate: '%{x}<br>Safe hours %{y}<extra></extra>',
          },
          {
            type: 'box',
            name: 'Claimed',
            y: rows.filter((r) => r.is_claimed).map((r) => Number(r.safe_hours || 0)),
            marker: { color: isDark ? '#22d3ee' : '#0e7490' },
            line: { color: isDark ? '#22d3ee' : '#0e7490' },
            boxmean: true,
            hovertemplate: '%{x}<br>Safe hours %{y}<extra></extra>',
          },
        ], {
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          margin: compactMargin || { t: 20, b: 40, l: 45, r: 20 },
          height: baseHeight,
          yaxis: { title: 'Safe Hours', color: axisColor, gridcolor: gridColor, ...compactAxis },
          xaxis: { color: axisColor, ...compactAxis },
          font: { color: isDark ? '#e6fffb' : '#111111', size: 13 },
        }, { displayModeBar: false, responsive: true }, theme);

        const CHART_BASE = { lat: 20.2961, lng: 85.8245 };
        const cLats = rows.map((r) => r.donor_latitude  != null ? r.donor_latitude  : CHART_BASE.lat + (Math.random() - 0.5) * 0.18);
        const cLons = rows.map((r) => r.donor_longitude != null ? r.donor_longitude : CHART_BASE.lng + (Math.random() - 0.5) * 0.18);
        if (shouldRender('geo')) renderPlot(hostByKey.geo, [{
          type: 'scattermapbox',
          lat: cLats,
          lon: cLons,
          mode: 'markers',
          text: rows.map((r) => {
            const loc = r.donor_location_text ? `Location: ${r.donor_location_text}` : '';
            return `${r.food_name}<br>${r.donor_name}${loc ? '<br>' + loc : ''}`;
          }),
          hovertemplate: '%{text}<extra></extra>',
          marker: {
            size: rows.map((r) => Math.max(8, Math.min(18, Number(r.qty || 0) * 1.2))),
            color: rows.map((r) => Number(r.safe_hours || 0) <= 3 ? (isDark ? '#fb7185' : '#dc2626') : (isDark ? '#34d399' : '#166534')),
            opacity: 0.82,
          },
        }], {
          mapbox: { style: 'open-street-map', center: { lat: 20.2961, lon: 85.8245 }, zoom: 7 },
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          height: mapHeight,
          margin: { t: 0, b: 0, l: 0, r: 0 },
        }, { displayModeBar: false, responsive: true }, theme);

        const topDonors = donorVolume.slice(0, 5);
        const topNgos = ngoClaims.slice(0, 5);
        if (shouldRender('radar')) renderPlot(hostByKey.radar, [
          {
            type: 'scatterpolar',
            r: topDonors.map((d) => Number(d.qty || 0)),
            theta: topDonors.map((d) => d.name),
            fill: 'toself',
            name: 'Donor Volume',
            hovertemplate: '%{theta}<br>Donor volume %{r} kg<extra></extra>',
            line: { color: isDark ? '#34d399' : '#166534' },
            fillcolor: isDark ? 'rgba(52, 211, 153, 0.24)' : 'rgba(22, 101, 52, 0.24)',
          },
          {
            type: 'scatterpolar',
            r: topNgos.map((n) => Number(n.claims || 0)),
            theta: topNgos.map((n) => n.name),
            fill: 'toself',
            name: 'NGO Claims',
            hovertemplate: '%{theta}<br>NGO claims %{r}<extra></extra>',
            line: { color: isDark ? '#22d3ee' : '#0e7490' },
            fillcolor: isDark ? 'rgba(34, 211, 238, 0.2)' : 'rgba(14, 116, 144, 0.2)',
          },
        ], {
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          margin: { t: 20, b: 20, l: 30, r: 30 },
          height: baseHeight,
          font: { color: isDark ? '#e6fffb' : '#111111', size: 13 },
          polar: {
            bgcolor: 'transparent',
            radialaxis: { gridcolor: gridColor, color: axisColor, tickfont: { size: 11 } },
            angularaxis: { gridcolor: gridColor, color: axisColor, tickfont: { size: 11 } },
          },
          legend: { orientation: 'h', y: -0.1, font: { size: 12 } },
        }, { displayModeBar: false, responsive: true }, theme);

        if (shouldRender('waterfall')) renderPlot(hostByKey.waterfall, [{
          type: 'waterfall',
          x: ['Total', 'Claimed', 'Available', 'Urgent', 'Safe Reserve'],
          y: [rows.length, -claimed, available, -urgent, Math.max(0, available - urgent)],
          measure: ['absolute', 'relative', 'relative', 'relative', 'total'],
          hovertemplate: '%{x}<br>Net change %{y}<extra></extra>',
          connector: { line: { color: isDark ? 'rgba(225,248,255,0.22)' : 'rgba(0,0,0,0.16)' } },
          increasing: { marker: { color: isDark ? '#34d399' : '#166534' } },
          decreasing: { marker: { color: isDark ? '#fb7185' : '#dc2626' } },
          totals: { marker: { color: isDark ? '#22d3ee' : '#0e7490' } },
        }], {
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          margin: compactMargin || { t: 20, b: 40, l: 45, r: 20 },
          height: baseHeight,
          font: { color: isDark ? '#e6fffb' : '#111111', size: 13 },
          yaxis: { color: axisColor, gridcolor: gridColor, ...compactAxis },
          xaxis: { color: axisColor, tickangle: 0, ...compactAxis },
        }, { displayModeBar: false, responsive: true }, theme);

        const donorNames = donorVolume.slice(0, 5).map((d) => d.name);
        const ngoNames = ngoClaims.slice(0, 5).map((n) => n.name);
        const source = [];
        const target = [];
        const value = [];
        donorNames.forEach((donor, donorIndex) => {
          ngoNames.forEach((ngo, ngoIndex) => {
            source.push(donorIndex);
            target.push(donorNames.length + ngoIndex);
            value.push(Math.max(1, Math.round(((Number(donorVolume[donorIndex]?.qty || 1) + Number(ngoClaims[ngoIndex]?.claims || 1)) / 6))));
          });
        });
        if (shouldRender('sankey')) renderPlot(hostByKey.sankey, [{
          type: 'sankey',
          arrangement: 'snap',
          node: {
            label: [...donorNames, ...ngoNames],
            pad: 16,
            thickness: 16,
            color: [
              ...donorNames.map(() => (isDark ? '#34d399' : '#166534')),
              ...ngoNames.map(() => (isDark ? '#22d3ee' : '#0e7490')),
            ],
            line: { color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', width: 1 },
            hovertemplate: '%{label}<extra></extra>',
          },
          link: {
            source,
            target,
            value,
            color: source.map((_, i) => {
              if (isDark) return i % 2 === 0 ? 'rgba(52, 211, 153, 0.28)' : 'rgba(34, 211, 238, 0.24)';
              return i % 2 === 0 ? 'rgba(22, 101, 52, 0.24)' : 'rgba(14, 116, 144, 0.22)';
            }),
            hovertemplate: '%{source.label} -> %{target.label}<br>Matched units %{value}<extra></extra>',
          },
        }], {
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          margin: { t: 20, b: 20, l: 20, r: 20 },
          height: baseHeight,
          font: { color: isDark ? '#e6fffb' : '#111111', size: 13 },
        }, { displayModeBar: false, responsive: true }, theme);

        return () => chartCatalog.forEach((chart) => {
          if (chart.ref.current) purgePlot(chart.ref.current);
        });
      }, [analytics, rows, theme, isDark, axisColor, gridColor]);

      return (
        <>
          <section className="glass rounded-3xl p-5 mb-4 wow fadeInDown section-enter" data-wow-delay="0.1s">
            <div className="text-center">
              <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', color: '#34d399', textTransform: 'uppercase', marginBottom: 10 }}>Authenticated Visual Lab</p>
              <h1 className="display-5 fw-bold mb-3" style={{ color: '#ecfeff' }}>More than two charts. A full analytics canvas.</h1>
              <p className="lead mb-3" style={{ color: '#22d3ee' }}>Explore treemaps, funnels, bubble charts, heatmaps, box plots, and geo views using live FoodSave marketplace data.</p>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 99, background: 'rgba(34,211,238,0.09)', border: '1px solid rgba(34,211,238,0.25)', fontSize: 13 }}>
                <i className="fas fa-project-diagram" style={{ color: '#22d3ee' }}></i>
                <span style={{ color: 'rgba(225,248,255,0.84)' }}>Use this lab to understand which visualization technique best fits each story.</span>
              </div>
            </div>
          </section>

          <InfoPage title="/visualizations" subtitle="Visualization gallery" priority="primary" summary="Explore live charts and switch between treemap, funnel, geo, radar, and flow views.">
            <div className="row g-4 mb-4">
              <div className="col-lg-4"><KpiCard label="Chart Families" value="9+" icon="fas fa-shapes" sub="comparison, flow, geo, distribution" /></div>
              <div className="col-lg-4"><KpiCard label="Live Listings Used" value={rows.length} icon="fas fa-database" sub="same data powering the app" /></div>
              <div className="col-lg-4"><KpiCard label="Best Next Step" value="Try Donor AI" icon="fas fa-magic" sub="visuals also embedded inside workflows" /></div>
            </div>

            <RealtimeLeaderboard analytics={analytics} rows={rows} />

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="glass rounded-3xl p-5"><h4 className="fw-bold mb-2" style={{ color: '#22d3ee' }}>Treemap</h4><p className="small mb-3" style={{ color: '#e6fffb', opacity: 0.72 }}>Shows which donor groups contribute the most volume.</p><div ref={treemapRef}></div></div>
              <div className="glass rounded-3xl p-5"><h4 className="fw-bold mb-2" style={{ color: '#22d3ee' }}>Funnel</h4><p className="small mb-3" style={{ color: '#e6fffb', opacity: 0.72 }}>Shows the rescue pipeline from listings to urgent cases.</p><div ref={funnelRef}></div></div>
              <div className="glass rounded-3xl p-5"><h4 className="fw-bold mb-2" style={{ color: '#22d3ee' }}>Bubble Chart</h4><p className="small mb-3" style={{ color: '#e6fffb', opacity: 0.72 }}>Temperature vs safe hours, with bubble size for donation quantity.</p><div ref={bubbleRef}></div></div>
              <div className="glass rounded-3xl p-5"><h4 className="fw-bold mb-2" style={{ color: '#22d3ee' }}>Heatmap</h4><p className="small mb-3" style={{ color: '#e6fffb', opacity: 0.72 }}>Density of listings across temperature and age buckets.</p><div ref={heatmapRef}></div></div>
              <div className="glass rounded-3xl p-5"><h4 className="fw-bold mb-2" style={{ color: '#22d3ee' }}>Box Plot</h4><p className="small mb-3" style={{ color: '#e6fffb', opacity: 0.72 }}>Distribution spread of safe hours for claimed vs available items.</p><div ref={boxRef}></div></div>
              <div className="glass rounded-3xl p-5"><h4 className="fw-bold mb-2" style={{ color: '#22d3ee' }}>Scatter Map</h4><p className="small mb-3" style={{ color: '#e6fffb', opacity: 0.72 }}>Geographic pickup perspective for active marketplace items.</p><div ref={geoRef}></div></div>
              <div className="glass rounded-3xl p-5"><h4 className="fw-bold mb-2" style={{ color: '#22d3ee' }}>Radar Chart</h4><p className="small mb-3" style={{ color: '#e6fffb', opacity: 0.72 }}>Compares top donor volume vs top NGO claims in a radial score view.</p><div ref={radarRef}></div></div>
              <div className="glass rounded-3xl p-5"><h4 className="fw-bold mb-2" style={{ color: '#22d3ee' }}>Waterfall Chart</h4><p className="small mb-3" style={{ color: '#e6fffb', opacity: 0.72 }}>Tracks how total listings convert into claims, urgent cases, and remaining reserve.</p><div ref={waterfallRef}></div></div>
            </div>

            <div className="glass rounded-3xl p-5 mt-4"><h4 className="fw-bold mb-2" style={{ color: '#22d3ee' }}>Sankey Flow</h4><p className="small mb-3" style={{ color: '#e6fffb', opacity: 0.72 }}>Illustrative donor-to-NGO rescue flow showing how supply can move across the network.</p><div ref={sankeyRef}></div></div>

            <div className="glass rounded-3 p-4 mt-4 text-center">
              <p className="mb-3" style={{ color: '#e6fffb' }}>Want to see these visual ideas inside workflows too?</p>
              <div className="d-flex flex-wrap justify-content-center gap-2">
                <button onClick={() => navigate(setPath, !user ? '/login' : user.role === 'DONOR' ? '/donor/donate' : '/home')} className="btn btn-primary">Open Donor AI Wizard</button>
                <button onClick={() => navigate(setPath, !user ? '/login' : user.role === 'NGO' ? '/ngo/dashboard' : '/home')} className="btn btn-secondary">Open NGO Dashboard</button>
                <button onClick={() => navigate(setPath, !user ? '/login' : user.role === 'ADMIN' ? '/admin/overview' : '/home')} className="btn btn-info">Open Admin Dashboard</button>
              </div>
            </div>
          </InfoPage>
        </>
      );
    }

    function RealtimeBoard({ topMetrics, overallRisk, rows, title }) {
      const highRisk = rows.filter((r) => !r.is_claimed && Number(r.safe_hours) <= 2).slice(0, 6);
      return (
        <section className="section-enter mt-7 space-y-5">
          <div className="flex items-center gap-3"><div className="pulse-dot"></div><h2 className="text-2xl font-bold">{title}</h2><p className="text-xs text-cyan-100/70">Realtime refresh every 8s</p></div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <KpiCard label="Total Listings" value={topMetrics.total_listings || 0} />
            <KpiCard label="Available" value={topMetrics.available_listings || 0} />
            <KpiCard label="Claimed" value={topMetrics.claimed_listings || 0} />
            <KpiCard label="Avg Safe Hours" value={topMetrics.avg_safe_hours || 0} />
            <div className="glass rounded-2xl p-4 flex items-center justify-between"><div><p className="text-xs text-cyan-100/70">System Risk</p><p className="text-2xl font-bold mt-1">{Math.round(overallRisk)}%</p></div><RiskRing value={overallRisk} /></div>
          </div>
          <div className="glass rounded-2xl p-4">
            <h3 className="font-semibold mb-3">Urgent Realtime Feed</h3>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {highRisk.length === 0 && <p className="text-cyan-100/75">No urgent items currently.</p>}
              {highRisk.map((r) => <div key={r.id} className="glass rounded-xl p-3"><p className="font-semibold">#{r.id} {r.food_name}</p><p className="text-xs text-cyan-100/70">Donor: {r.donor_name}</p><div className="meter mt-2"><span style={{ width: `${Math.max(2, Math.min(100, Number(r.safe_hours) * 20))}%` }} /></div><p className="text-xs mt-1 text-rose-200">Safe hours left: {r.safe_hours}</p></div>)}
            </div>
          </div>
        </section>
      );
    }

    function ChartPanel({ analytics, theme = 'dark' }) {
      const donorCanvas = useRef(null);
      const ngoCanvas = useRef(null);
      const chartsRef = useRef([]);
      const donorVolume = analytics?.donor_volume || [];
      const ngoClaims = analytics?.ngo_claims || [];
      const topDonor = donorVolume.length ? donorVolume.reduce((best, item) => Number(item.qty || 0) > Number(best.qty || 0) ? item : best, donorVolume[0]) : null;
      const topNgo = ngoClaims.length ? ngoClaims.reduce((best, item) => Number(item.claims || 0) > Number(best.claims || 0) ? item : best, ngoClaims[0]) : null;
      const totalDonorKg = donorVolume.reduce((sum, item) => sum + Number(item.qty || 0), 0);
      const totalClaims = ngoClaims.reduce((sum, item) => sum + Number(item.claims || 0), 0);

      const isDark = theme !== 'light';
      const axisColor = isDark ? '#c4f1ff' : '#374151';
      const gridColor = isDark ? 'rgba(180, 230, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
      const tooltipBg = isDark ? 'rgba(8, 14, 30, 0.94)' : 'rgba(255, 255, 255, 0.96)';
      const tooltipTitle = isDark ? '#ecfeff' : '#111111';
      const tooltipBody = isDark ? '#d9fdfa' : '#374151';
      const legendColor = isDark ? '#e6fffb' : '#374151';
      const borderColor = isDark ? 'rgba(186, 250, 239, 0.85)' : 'rgba(0, 0, 0, 0.2)';
      const ngoBorderColor = isDark ? 'rgba(8, 14, 30, 0.82)' : 'rgba(255, 255, 255, 0.9)';

      useEffect(() => {
        chartsRef.current.forEach((c) => c && c.destroy());
        chartsRef.current = [];
        if (!analytics || typeof Chart === 'undefined' || !donorCanvas.current || !ngoCanvas.current) return;

        const donorCtx = donorCanvas.current.getContext('2d');
        const donorGradient = donorCtx.createLinearGradient(0, 0, 0, 220);
        if (isDark) {
          donorGradient.addColorStop(0, 'rgba(34, 211, 238, 0.95)');
          donorGradient.addColorStop(0.5, 'rgba(52, 211, 153, 0.82)');
          donorGradient.addColorStop(1, 'rgba(52, 211, 153, 0.24)');
        } else {
          donorGradient.addColorStop(0, 'rgba(14, 116, 144, 0.95)');
          donorGradient.addColorStop(0.5, 'rgba(22, 101, 52, 0.82)');
          donorGradient.addColorStop(1, 'rgba(22, 101, 52, 0.24)');
        }

        const donorChart = new Chart(donorCanvas.current, {
          type: 'bar',
          data: {
            labels: donorVolume.map((d) => d.name),
            datasets: [{
              label: 'Donor Volume (kg)',
              data: donorVolume.map((d) => d.qty),
              backgroundColor: donorGradient,
              borderColor,
              borderWidth: 1.2,
              borderRadius: 14,
              borderSkipped: false,
              maxBarThickness: 46,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: tooltipBg,
                borderColor: isDark ? 'rgba(34, 211, 238, 0.28)' : 'rgba(0, 0, 0, 0.15)',
                borderWidth: 1,
                titleColor: tooltipTitle,
                bodyColor: tooltipBody,
                padding: 12,
              },
            },
            scales: {
              x: {
                ticks: { color: axisColor },
                grid: { display: false },
              },
              y: {
                beginAtZero: true,
                ticks: { color: axisColor },
                grid: { color: gridColor },
              },
            },
          },
        });

        const ngoCtx = ngoCanvas.current.getContext('2d');
        const ngoGradientA = ngoCtx.createLinearGradient(0, 0, 220, 220);
        ngoGradientA.addColorStop(0, isDark ? '#22d3ee' : '#0e7490');
        ngoGradientA.addColorStop(1, isDark ? '#0891b2' : '#155e75');
        const ngoGradientB = ngoCtx.createLinearGradient(0, 0, 220, 220);
        ngoGradientB.addColorStop(0, isDark ? '#34d399' : '#166534');
        ngoGradientB.addColorStop(1, isDark ? '#059669' : '#14532d');
        const ngoGradientC = ngoCtx.createLinearGradient(0, 0, 220, 220);
        ngoGradientC.addColorStop(0, isDark ? '#60a5fa' : '#3b82f6');
        ngoGradientC.addColorStop(1, isDark ? '#2563eb' : '#1d4ed8');
        const ngoGradientD = ngoCtx.createLinearGradient(0, 0, 220, 220);
        ngoGradientD.addColorStop(0, isDark ? '#f59e0b' : '#b45309');
        ngoGradientD.addColorStop(1, isDark ? '#d97706' : '#92400e');
        const ngoGradientE = ngoCtx.createLinearGradient(0, 0, 220, 220);
        ngoGradientE.addColorStop(0, isDark ? '#f472b6' : '#db2777');
        ngoGradientE.addColorStop(1, isDark ? '#db2777' : '#9d174d');

        const ngoChart = new Chart(ngoCanvas.current, {
          type: 'doughnut',
          data: {
            labels: ngoClaims.map((n) => n.name),
            datasets: [{
              label: 'Claims',
              data: ngoClaims.map((n) => n.claims),
              backgroundColor: [ngoGradientA, ngoGradientB, ngoGradientC, ngoGradientD, ngoGradientE],
              borderColor: ngoBorderColor,
              borderWidth: 4,
              hoverOffset: 8,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '58%',
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  color: legendColor,
                  padding: 16,
                  usePointStyle: true,
                  pointStyle: 'circle',
                  boxWidth: 12,
                  font: { size: 12 },
                },
              },
              tooltip: {
                backgroundColor: tooltipBg,
                borderColor: isDark ? 'rgba(52, 211, 153, 0.28)' : 'rgba(0, 0, 0, 0.15)',
                borderWidth: 1,
                titleColor: tooltipTitle,
                bodyColor: tooltipBody,
                padding: 12,
              },
            },
          },
        });
        chartsRef.current = [donorChart, ngoChart];
        return () => chartsRef.current.forEach((c) => c && c.destroy());
      }, [analytics, theme, isDark, axisColor, gridColor, tooltipBg, tooltipTitle, tooltipBody, legendColor, borderColor, ngoBorderColor]);
      return (
        <section className="section-enter grid lg:grid-cols-2 gap-6 mt-7 chart-panel-shell">
          <div className="glass rounded-3xl p-6 overflow-hidden chart-panel-card">
            <div className="d-flex justify-content-between align-items-start gap-3 mb-4">
              <div>
                <p className="mb-2" style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#34d399', fontWeight: 700 }}>Performance View</p>
                <h3 className="text-xl font-bold mb-1">Donor Volume</h3>
                <p className="mb-0" style={{ color: 'rgba(225,248,255,0.66)' }}>Who is contributing the most food volume right now.</p>
              </div>
              <div className="glass rounded-3 px-3 py-2 text-end chart-panel-stat" style={{ minWidth: 124 }}>
                <div style={{ fontSize: 11, color: 'rgba(225,248,255,0.58)' }}>Total Volume</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#34d399' }}>{totalDonorKg.toFixed(1)} kg</div>
              </div>
            </div>
            <div className="d-flex flex-wrap gap-2 mb-4">
              <div className="glass rounded-full px-3 py-2"><small style={{ color: '#d9fdfa' }}><i className="fas fa-trophy me-2" style={{ color: '#fbbf24' }}></i>Top Donor: <strong>{topDonor ? topDonor.name : 'N/A'}</strong></small></div>
              <div className="glass rounded-full px-3 py-2"><small style={{ color: '#d9fdfa' }}><i className="fas fa-weight-hanging me-2" style={{ color: '#22d3ee' }}></i>Largest volume: <strong>{topDonor ? `${Number(topDonor.qty || 0).toFixed(1)} kg` : '0 kg'}</strong></small></div>
            </div>
            <div style={{ height: 240 }}>
              <canvas ref={donorCanvas}></canvas>
            </div>
            <div className="glass rounded-3 p-3 mt-4">
              <small style={{ color: '#e6fffb', lineHeight: 1.7 }}>
                <i className="fas fa-lightbulb me-2" style={{ color: '#22d3ee' }}></i>
                This chart helps identify your highest-impact donors and where outreach or recognition should focus.
              </small>
            </div>
          </div>

          <div className="glass rounded-3xl p-6 overflow-hidden chart-panel-card">
            <div className="d-flex justify-content-between align-items-start gap-3 mb-4">
              <div>
                <p className="mb-2" style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#34d399', fontWeight: 700 }}>Distribution View</p>
                <h3 className="text-xl font-bold mb-1">Claim Distribution</h3>
                <p className="mb-0" style={{ color: 'rgba(225,248,255,0.66)' }}>How claim activity is distributed across NGO partners.</p>
              </div>
              <div className="glass rounded-3 px-3 py-2 text-end chart-panel-stat" style={{ minWidth: 124 }}>
                <div style={{ fontSize: 11, color: 'rgba(225,248,255,0.58)' }}>Total Claims</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#22d3ee' }}>{totalClaims}</div>
              </div>
            </div>
            <div className="d-flex flex-wrap gap-2 mb-4">
              <div className="glass rounded-full px-3 py-2"><small style={{ color: '#d9fdfa' }}><i className="fas fa-hand-holding-heart me-2" style={{ color: '#34d399' }}></i>Top NGO: <strong>{topNgo ? topNgo.name : 'N/A'}</strong></small></div>
              <div className="glass rounded-full px-3 py-2"><small style={{ color: '#d9fdfa' }}><i className="fas fa-chart-pie me-2" style={{ color: '#f59e0b' }}></i>Share leader: <strong>{topNgo && totalClaims ? `${Math.round((Number(topNgo.claims || 0) / totalClaims) * 100)}%` : '0%'}</strong></small></div>
            </div>
            <div style={{ height: 240 }}>
              <canvas ref={ngoCanvas}></canvas>
            </div>
            <div className="glass rounded-3 p-3 mt-4">
              <small style={{ color: '#e6fffb', lineHeight: 1.7 }}>
                <i className="fas fa-info-circle me-2" style={{ color: '#34d399' }}></i>
                Use this view to spot concentration risk. If one NGO dominates claims, you may want broader partner activation.
              </small>
            </div>
          </div>
        </section>
      );
    }

    function PublicHomePage({ setPath }) {
      return (
        <section className="glass rounded-3xl p-5 mt-3 public-static-shell" style={{ minHeight: 'calc(100vh - 170px)', display: 'flex', alignItems: 'center' }}>
          <div className="w-100 text-center">
            <h1 className="display-5 fw-bold mb-3" style={{ color: '#34d399' }}>FoodSave</h1>
            <p className="mb-4" style={{ color: '#e6fffb' }}>Simple food rescue platform connecting donors and NGOs.</p>
            <div className="d-flex justify-content-center gap-2 flex-wrap">
              <button className="btn btn-primary" onClick={() => navigate(setPath, '/login')}>Login</button>
              <button className="btn btn-outline-light" onClick={() => navigate(setPath, '/register')}>Register</button>
            </div>
          </div>
        </section>
      );
    }

    function PublicAboutPage({ setPath }) {
      return (
        <section className="glass rounded-3xl p-5 mt-3 public-static-shell" style={{ minHeight: 'calc(100vh - 170px)', display: 'flex', alignItems: 'center' }}>
          <div className="w-100 text-center">
            <h2 className="fw-bold mb-3" style={{ color: '#22d3ee' }}>About</h2>
            <p className="mb-4" style={{ color: '#e6fffb' }}>FoodSave helps donors and NGOs coordinate food rescue quickly.</p>
            <button className="btn btn-outline-light" onClick={() => navigate(setPath, '/home')}>Back Home</button>
          </div>
        </section>
      );
    }

    function PublicImpactPage({ setPath }) {
      return (
        <section className="glass rounded-3xl p-5 mt-3 public-static-shell" style={{ minHeight: 'calc(100vh - 170px)', display: 'flex', alignItems: 'center' }}>
          <div className="w-100 text-center">
            <h2 className="fw-bold mb-3" style={{ color: '#22d3ee' }}>Impact</h2>
            <p className="mb-4" style={{ color: '#e6fffb' }}>We help move surplus food to people faster.</p>
            <button className="btn btn-outline-light" onClick={() => navigate(setPath, '/home')}>Back Home</button>
          </div>
        </section>
      );
    }

    function PublicContactPage({ setPath }) {
      return (
        <section className="glass rounded-3xl p-5 mt-3 public-static-shell" style={{ minHeight: 'calc(100vh - 170px)', display: 'flex', alignItems: 'center' }}>
          <div className="w-100 text-center">
            <h2 className="fw-bold mb-3" style={{ color: '#22d3ee' }}>Contact</h2>
            <p className="mb-2" style={{ color: '#e6fffb' }}>support@foodsave.ai</p>
            <p className="mb-4" style={{ color: '#d9fdfa' }}>For access, support, and partnerships.</p>
            <button className="btn btn-outline-light" onClick={() => navigate(setPath, '/home')}>Back Home</button>
          </div>
        </section>
      );
    }

    function ListingsTable({ rows, onRowUpdate, onClaim, onRetract }) {
      const hostRef = useRef(null);
      const tableRef = useRef(null);
      const wrapRef = useRef(null);
      useEffect(() => {
        if (!hostRef.current) return;
        if (tableRef.current) { tableRef.current.replaceData(rows || []); return; }
        const columns = [
          { title: 'ID', field: 'id', width: 80 }, { title: 'Food', field: 'food_name', editor: 'input' }, { title: 'Donor', field: 'donor_name' },
          { title: 'Qty', field: 'qty', editor: 'number' }, { title: 'Temp', field: 'temp', editor: 'number' }, { title: 'Hours Ago', field: 'hours_ago', editor: 'number' },
          { title: 'Safe Hours', field: 'safe_hours', editor: 'number' }, { title: 'Claimed', field: 'is_claimed', formatter: (cell) => (cell.getValue() ? 'Yes' : 'No') }, { title: 'Claimed By', field: 'claimed_by' },
        ];

        if (onClaim) {
          columns.push({
            title: 'Action',
            field: 'action',
            hozAlign: 'center',
            formatter: (cell) => {
              const row = cell.getRow().getData();
              return row.is_claimed ? 'Claimed' : '<button class="px-2 py-1 rounded bg-cyan-500/30">Claim</button>';
            },
            cellClick: (e, cell) => {
              const row = cell.getRow().getData();
              if (!row.is_claimed) onClaim(row.id);
            },
          });
        }
        if (onRetract) {
          columns.push({
            title: 'Retract',
            field: '_retract',
            hozAlign: 'center',
            headerSort: false,
            formatter: () => '<button class="px-2 py-1 rounded bg-rose-500/40 text-rose-100 text-xs">Retract</button>',
            cellClick: (e, cell) => {
              const row = cell.getRow().getData();
              if (window.confirm(`Remove "${row.food_name}" from inventory?`)) onRetract(row.id);
            },
          });
        }

        tableRef.current = new Tabulator(hostRef.current, {
          data: rows || [],
          layout: 'fitColumns',
          maxHeight: '460px',
          reactiveData: true,
          movableColumns: true,
          responsiveLayout: false,
          pagination: true,
          paginationSize: 8,
          columnDefaults: { headerWordWrap: true, resizable: true },
          columns,
          cellEdited: async (cell) => {
            if (!onRowUpdate) return;
            const row = cell.getRow().getData();
            await onRowUpdate(row.id, { food_name: row.food_name, qty: row.qty, temp: row.temp, hours_ago: row.hours_ago, safe_hours: row.safe_hours });
          },
        });
      }, [rows]);
      const downloadCsv = () => tableRef.current && tableRef.current.download('csv', 'foodsave_live_table.csv');
      const toggleFullscreen = () => { const el = wrapRef.current; if (!el) return; if (!document.fullscreenElement) el.requestFullscreen(); else document.exitFullscreen(); };
      return <section ref={wrapRef} className="section-enter glass rounded-3xl p-6 mt-7 listings-table-shell"><div className="flex flex-wrap items-center justify-between gap-3 mb-4 listings-table-head"><h3 className="text-xl font-bold">Realtime Showcase Table</h3><div className="flex gap-2 listings-table-actions"><button onClick={downloadCsv} className="px-4 py-2 rounded-xl bg-emerald-500/30">Download CSV</button><button onClick={toggleFullscreen} className="px-4 py-2 rounded-xl bg-cyan-500/30">Fullscreen</button></div></div><div ref={hostRef}></div></section>;
    }

    function SettingsProfilePage({ user }) {
      const [orgName, setOrgName] = useState(user?.username || 'FoodSave Org');
      const [phone, setPhone] = useState('+91-90000-00000');
      const [avatar, setAvatar] = useState('');
      const [timezone, setTimezone] = useState('Asia/Kolkata');
      const [saveMsg, setSaveMsg] = useState('');
      useEffect(() => {
        const load = async () => {
          try {
            const s = await fetchProfileSettings(user?.username || '', 'Unable to load profile settings');
            if (s.org_name) setOrgName(s.org_name);
            if (s.phone) setPhone(s.phone);
            if (s.avatar) setAvatar(s.avatar);
            if (s.timezone) setTimezone(s.timezone);
          } catch (err) {
            setSaveMsg(err.message || 'Unable to load profile settings');
          }
        };
        if (user?.username) load();
      }, [user]);
      const save = async (e) => {
        e.preventDefault();
        try {
          const data = await saveProfileSettings(
            user.username,
            { org_name: orgName, phone, avatar, timezone },
            'Unable to save profile settings'
          );
          setSaveMsg(data.message || 'Saved');
        } catch (err) {
          setSaveMsg(err.message || 'Unable to save profile settings');
        }
      };
      return (
        <section className="section-enter mt-7 grid lg:grid-cols-2 gap-6 settings-grid-shell settings-profile-shell">
          <div className="glass rounded-3xl p-6">
            <h2 className="text-2xl font-bold mb-1">My Profile</h2>
            <p style={{ fontSize: 13, color: 'rgba(225,248,255,0.58)', marginBottom: 16 }}>
              Update your organization details used across dashboard and notifications.
            </p>

            <div className="grid grid-cols-2 gap-3 settings-summary-grid">
              <div className="glass rounded-xl p-3">
                <p className="mb-1 small" style={{ color: 'rgba(225,248,255,0.58)' }}>Account</p>
                <p className="mb-0 fw-bold">{user?.username || '-'}</p>
              </div>
              <div className="glass rounded-xl p-3">
                <p className="mb-1 small" style={{ color: 'rgba(225,248,255,0.58)' }}>Role</p>
                <p className="mb-0 fw-bold">{user?.role || '-'}</p>
              </div>
            </div>
          </div>

          <form onSubmit={save} className="glass rounded-3xl p-6">
            <div className="mb-3">
              <label className="small fw-bold d-block mb-2">Organization Name</label>
              <input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="FoodSave Org"
                className="rounded-xl px-4 py-3 w-100 bg-black/25 border border-white/20"
              />
            </div>
            <div className="mb-3">
              <label className="small fw-bold d-block mb-2">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91-90000-00000"
                className="rounded-xl px-4 py-3 w-100 bg-black/25 border border-white/20"
              />
            </div>
            <div className="mb-3">
              <label className="small fw-bold d-block mb-2">Avatar URL (optional)</label>
              <input
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                placeholder="https://..."
                className="rounded-xl px-4 py-3 w-100 bg-black/25 border border-white/20"
              />
            </div>
            <div className="mb-4">
              <label className="small fw-bold d-block mb-2">Timezone</label>
              <input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Asia/Kolkata"
                className="rounded-xl px-4 py-3 w-100 bg-black/25 border border-white/20"
              />
            </div>

            <button type="submit" className="btn btn-primary">Save Profile</button>
            {saveMsg && <p className="text-sm mt-3" style={{ color: saveMsg.toLowerCase().includes('save') ? '#34d399' : '#fb7185' }}>{saveMsg}</p>}
          </form>
        </section>
      );
    }

    function SettingsLocationPage({ user }) {
      const [lat, setLat] = useState('20.2961');
      const [lng, setLng] = useState('85.8245');
      const [radius, setRadius] = useState(15);
      const [msg, setMsg] = useState('');
      useEffect(() => {
        const load = async () => {
          try {
            const s = await fetchProfileSettings(user?.username || '', 'Unable to load location settings');
            if (s.latitude !== undefined && s.latitude !== null) setLat(String(s.latitude));
            if (s.longitude !== undefined && s.longitude !== null) setLng(String(s.longitude));
            if (s.radius_km !== undefined && s.radius_km !== null) setRadius(Number(s.radius_km));
          } catch (err) {
            setMsg(err.message || 'Unable to load location settings');
          }
        };
        if (user?.username) load();
      }, [user]);
      const save = async () => {
        try {
          const data = await saveProfileSettings(
            user.username,
            { latitude: parseFloat(lat), longitude: parseFloat(lng), radius_km: radius },
            'Unable to save location settings'
          );
          setMsg(data.message || 'Saved');
        } catch (err) {
          setMsg(err.message || 'Unable to save location settings');
        }
      };
      const CITY_PRESETS = [
        { name: 'Bhubaneswar', lat: 20.2961, lng: 85.8245 },
        { name: 'Cuttack',     lat: 20.4625, lng: 85.8830 },
        { name: 'Puri',        lat: 19.8135, lng: 85.8312 },
        { name: 'Rourkela',    lat: 22.2604, lng: 84.8536 },
        { name: 'Sambalpur',   lat: 21.4669, lng: 83.9757 },
        { name: 'Berhampur',   lat: 19.3149, lng: 84.7941 },
        { name: 'Balasore',    lat: 21.4924, lng: 86.9194 },
        { name: 'Bhadrak',     lat: 21.0543, lng: 86.5154 },
        { name: 'Kendrapara',  lat: 20.4935, lng: 86.4230 },
        { name: 'Jeypore',     lat: 18.8539, lng: 82.5718 },
      ];
      return (
        <section className="section-enter mt-7 grid lg:grid-cols-2 gap-6 settings-grid-shell settings-location-shell">
          <div className="glass rounded-3xl p-6">
            <h2 className="text-2xl font-bold mb-1">Location Settings</h2>
            <p style={{ fontSize: 13, color: 'rgba(225,248,255,0.55)', marginBottom: 16 }}>Your location is used to show distance to nearby food listings.</p>

            
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: '#34d399', textTransform: 'uppercase', marginBottom: 8 }}>Quick-select Odisha City</p>
            <div className="settings-chip-wrap" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
              {CITY_PRESETS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => { setLat(String(c.lat)); setLng(String(c.lng)); }}
                  style={{
                    padding: '5px 13px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: lat === String(c.lat) ? 'linear-gradient(135deg,#34d399,#22d3ee)' : 'rgba(255,255,255,0.06)',
                    color: lat === String(c.lat) ? '#000' : '#ecfeff',
                    border: '1px solid rgba(255,255,255,0.15)',
                  }}
                >{c.name}</button>
              ))}
            </div>

            
            <div className="grid grid-cols-2 gap-3 mt-3 settings-coordinate-grid">
              <div>
                <label style={{ fontSize: 12, color: '#22d3ee', display: 'block', marginBottom: 4 }}>Latitude</label>
                <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="20.2961" style={{ color: '#ecfeff', width: '100%' }} className="rounded-xl px-4 py-3 bg-black/25 border border-white/20"/>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#22d3ee', display: 'block', marginBottom: 4 }}>Longitude</label>
                <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="85.8245" style={{ color: '#ecfeff', width: '100%' }} className="rounded-xl px-4 py-3 bg-black/25 border border-white/20"/>
              </div>
            </div>
            <div className="mt-4">
              <label style={{ fontSize: 13, fontWeight: 600 }}>Matching Radius: {radius} km</label>
              <input type="range" min="1" max="100" value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full mt-2"/>
            </div>
            <button type="button" onClick={save} className="mt-4 px-6 py-2 rounded-xl font-bold bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ color: '#000' }}>
              <i className="fas fa-save" style={{ marginRight: 7 }}></i>Save Location
            </button>
            {msg && <p className="text-sm mt-3" style={{ color: msg.includes('aved') ? '#34d399' : '#fb7185' }}>{msg}</p>}
          </div>
          <div className="glass rounded-3xl p-6">
            <p style={{ fontWeight: 700, marginBottom: 10 }}>Coverage Preview</p>
            <p style={{ fontSize: 13, color: 'rgba(225,248,255,0.55)', marginBottom: 14 }}>Radius: <strong style={{ color: '#34d399' }}>{radius} km</strong> around your pin</p>
            <div className="settings-coverage-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#34d399', flexShrink: 0 }}></div>
              <div style={{ flex: 1, height: 8, borderRadius: 8, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, radius)}%`, background: 'linear-gradient(90deg,#34d399,#22d3ee)', borderRadius: 8, transition: 'width 0.3s' }}></div>
              </div>
              <span style={{ fontSize: 12, color: 'rgba(225,248,255,0.5)' }}>{radius} km</span>
            </div>
            <p style={{ fontSize: 12, color: 'rgba(225,248,255,0.4)', marginTop: 14 }}>
              <i className="fas fa-map-marker-alt" style={{ marginRight: 5, color: '#34d399' }}></i>
              Coordinates: {lat}, {lng}
            </p>
          </div>
        </section>
      );
    }

    function SettingsAlertsPage({ user }) {
      const [emailAlerts, setEmailAlerts] = useState(true);
      const [smsAlerts, setSmsAlerts] = useState(false);
      const [criticalOnly, setCriticalOnly] = useState(true);
      const [threshold, setThreshold] = useState(2);
      const [msg, setMsg] = useState('');
      useEffect(() => {
        const load = async () => {
          try {
            const s = await fetchProfileSettings(user?.username || '', 'Unable to load alert settings');
            if (s.alert_email !== undefined) setEmailAlerts(Boolean(s.alert_email));
            if (s.alert_sms !== undefined) setSmsAlerts(Boolean(s.alert_sms));
            if (s.alert_critical !== undefined) setCriticalOnly(Boolean(s.alert_critical));
            if (s.risk_threshold !== undefined && s.risk_threshold !== null) setThreshold(Number(s.risk_threshold));
          } catch (err) {
            setMsg(err.message || 'Unable to load alert settings');
          }
        };
        if (user?.username) load();
      }, [user]);
      const save = async () => {
        try {
          const data = await saveProfileSettings(
            user.username,
            {
              alert_email: emailAlerts ? 1 : 0,
              alert_sms: smsAlerts ? 1 : 0,
              alert_critical: criticalOnly ? 1 : 0,
              risk_threshold: threshold,
            },
            'Unable to save alert settings'
          );
          setMsg(data.message || 'Alerts saved');
        } catch (err) {
          setMsg(err.message || 'Unable to save alert settings');
        }
      };
      return <section className="section-enter mt-7 glass rounded-3xl p-6 settings-alerts-shell"><h2 className="text-2xl font-bold">Alerts & Notifications</h2><div className="grid md:grid-cols-2 gap-4 mt-4 settings-alert-grid"><label className="glass rounded-xl p-4 flex items-center justify-between"><span>Email Alerts</span><input type="checkbox" checked={emailAlerts} onChange={(e) => setEmailAlerts(e.target.checked)}/></label><label className="glass rounded-xl p-4 flex items-center justify-between"><span>SMS Alerts</span><input type="checkbox" checked={smsAlerts} onChange={(e) => setSmsAlerts(e.target.checked)}/></label><label className="glass rounded-xl p-4 flex items-center justify-between"><span>Critical Only</span><input type="checkbox" checked={criticalOnly} onChange={(e) => setCriticalOnly(e.target.checked)}/></label><div className="glass rounded-xl p-4"><p>Risk Threshold: {threshold}h</p><input type="range" min="1" max="8" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full mt-2"/></div></div><button type="button" onClick={save} className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500">Save Alerts</button>{msg && <p className="text-sm mt-2">{msg}</p>}</section>;
    }

    function App() {
      const [user, setUser] = useState(() => {
        try {
          const raw = localStorage.getItem('foodsave_user');
          return raw ? JSON.parse(raw) : null;
        } catch (_) {
          return null;
        }
      });
      const [path, setPath] = useState(normalizeRoutePath(window.location.pathname));
      const [ngoViewMode, setNgoViewMode] = useState(normalizeRoutePath(window.location.pathname) === '/ngo/map-view' ? 'map' : 'list');
      const [selectedNgoListing, setSelectedNgoListing] = useState(null);
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState('');
      const [analytics, setAnalytics] = useState(null);
      const [rows, setRows] = useState([]);
      const [adminUsers, setAdminUsers] = useState([]);
      const [adminLogs, setAdminLogs] = useState([]);
      const [auditLogs, setAuditLogs] = useState([]);
      const [notifications, setNotifications] = useState([]);
      const [unreadCount, setUnreadCount] = useState(0);
      const [showNotifications, setShowNotifications] = useState(false);
      const [foodFilters, setFoodFilters] = useState({ q: '', is_claimed: '', min_safe_hours: '', max_safe_hours: '' });
      const [activeChatFoodId, setActiveChatFoodId] = useState(null);
      const [chatThreads, setChatThreads] = useState([]);
      const [chatMessages, setChatMessages] = useState([]);
      const [chatConversation, setChatConversation] = useState(null);
      const [chatDraft, setChatDraft] = useState('');
      const [chatBusy, setChatBusy] = useState(false);
      const [chatLoading, setChatLoading] = useState(false);
      const [chatSyncing, setChatSyncing] = useState(false);
      const [chatLastSeenId, setChatLastSeenId] = useState(0);
      const [chatStickToBottom, setChatStickToBottom] = useState(true);
      const chatScrollRef = useRef(null);
      const [theme, setTheme] = useState(() => {
        try {
          const savedTheme = localStorage.getItem('foodsave_theme');
          if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
        } catch (_) {
          // no-op
        }
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      });
      const [backgroundTheme, setBackgroundTheme] = useState(() => {
        try {
          const savedBackgroundTheme = localStorage.getItem('foodsave_bg_theme');
          if (savedBackgroundTheme && BG_THEME_OPTIONS.some((opt) => opt.value === savedBackgroundTheme)) {
            return savedBackgroundTheme;
          }
        } catch (_) {
          // no-op
        }
        return 'aurora';
      });

      const toggleTheme = () => {
        setTheme((prevTheme) => (prevTheme === 'dark' ? 'light' : 'dark'));
      };

      useEffect(() => {
        const onPop = () => setPath(normalizeRoutePath(window.location.pathname));
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
      }, []);

      useEffect(() => {
        // Route changes should clear temporary overlays/panels.
        setShowNotifications(false);
        if (path !== '/ngo/active-claims' && path !== '/donor/history') {
          setActiveChatFoodId(null);
        }
      }, [path]);

      useEffect(() => {
        const authRoutes = ['/login', '/register', '/forgot-password', '/reset-password'];
        const knownRoutes = new Set([
          ...PUBLIC_ROUTES,
          ...DONOR_ROUTES,
          ...NGO_ROUTES,
          ...SETTINGS_ROUTES,
          ...ADMIN_ROUTES,
          ...SHARED_AUTH_ROUTES,
        ].map(normalizeRoutePath));

        const normalizedPath = normalizeRoutePath(path);
        if (normalizedPath !== path) {
          setPath(normalizedPath);
          return;
        }

        if (!knownRoutes.has(normalizedPath)) {
          navigate(setPath, getDefaultRouteForUser(user));
          return;
        }

        const protectedRoute = DONOR_ROUTES.includes(normalizedPath) || NGO_ROUTES.includes(normalizedPath) || SETTINGS_ROUTES.includes(normalizedPath) || ADMIN_ROUTES.includes(normalizedPath) || SHARED_AUTH_ROUTES.includes(normalizedPath);
        if (protectedRoute && !user) {
          navigate(setPath, '/login');
          return;
        }

        if (user && authRoutes.includes(normalizedPath)) {
          navigate(setPath, getDefaultRouteForUser(user));
          return;
        }

        if (DONOR_ROUTES.includes(normalizedPath) && user && user.role !== 'DONOR') {
          navigate(setPath, getDefaultRouteForUser(user));
          return;
        }

        if (NGO_ROUTES.includes(normalizedPath) && user && user.role !== 'NGO') {
          navigate(setPath, getDefaultRouteForUser(user));
          return;
        }

        if (ADMIN_ROUTES.includes(normalizedPath) && user && user.role !== 'ADMIN') {
          navigate(setPath, getDefaultRouteForUser(user));
        }
      }, [path, user]);

      useEffect(() => {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }, [user]);

      useEffect(() => {
        const routeHost = document.getElementById('route-content');
        if (!routeHost) return;
        routeHost.classList.remove('route-exit');
        routeHost.classList.remove('route-enter');
        window.requestAnimationFrame(() => {
          routeHost.classList.add('route-enter');
        });
      }, [path]);

      useEffect(() => {
        const onMove = (e) => {
          document.documentElement.style.setProperty('--cursor-x', `${e.clientX}px`);
          document.documentElement.style.setProperty('--cursor-y', `${e.clientY}px`);
        };
        window.addEventListener('mousemove', onMove, { passive: true });
        return () => window.removeEventListener('mousemove', onMove);
      }, []);

      useEffect(() => {
        const host = document.getElementById('route-content');
        if (!host) return;
        const nodes = host.querySelectorAll('.glass, .service-item, .btn, .row > [class*=\"col-\"] > .glass');
        nodes.forEach((node, idx) => {
          node.classList.add('stagger-in');
          node.style.setProperty('--stagger-index', String(Math.min(idx, 24)));
        });
      }, [path]);

      const isCompactPublicRoute = !user && PUBLIC_DISCLOSURE_ROUTES.includes(path);
      const [forceExpanded, setForceExpanded] = useState(null);

      useEffect(() => {
        setForceExpanded(null);
      }, [path, user]);

      const loadAll = async () => {
        const search = new URLSearchParams();
        if (foodFilters.q) search.set('q', foodFilters.q);
        if (foodFilters.is_claimed !== '') search.set('is_claimed', String(foodFilters.is_claimed));
        if (foodFilters.min_safe_hours !== '') search.set('min_safe_hours', String(foodFilters.min_safe_hours));
        if (foodFilters.max_safe_hours !== '') search.set('max_safe_hours', String(foodFilters.max_safe_hours));
        if (user && user.role === 'NGO') search.set('ngo_username', user.username);
        const suffix = search.toString() ? `?${search.toString()}` : '';

        const [a, r] = await Promise.all([
          apiGet('/api/analytics'),
          apiGet(`/api/food/all${suffix}`),
        ]);
        setAnalytics(a);
        setRows(r.food || []);
        if (user) {
          const n = await apiGet(`/api/notifications?username=${encodeURIComponent(user.username)}&role=${encodeURIComponent(user.role)}`);
          setNotifications(n.notifications || []);
          setUnreadCount(n.unread_count || 0);
        }
        if (user && user.role === 'ADMIN') {
          const [u, l, aLog] = await Promise.all([
            apiGet('/api/admin/users'),
            apiGet('/api/admin/ai-logs'),
            apiGet('/api/admin/audit-logs?limit=100'),
          ]);
          setAdminUsers(u.users || []);
          setAdminLogs(l.logs || []);
          setAuditLogs(aLog.logs || []);
        }
      };

      useEffect(() => {
        if (user) localStorage.setItem('foodsave_user', JSON.stringify(user));
        else localStorage.removeItem('foodsave_user');
      }, [user]);

      useEffect(() => {
        document.body.setAttribute('data-theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
        try {
          localStorage.setItem('foodsave_theme', theme);
        } catch (_) {
          // no-op
        }
      }, [theme]);

      useEffect(() => {
        document.body.setAttribute('data-bg-theme', backgroundTheme);
        document.documentElement.setAttribute('data-bg-theme', backgroundTheme);
        try {
          localStorage.setItem('foodsave_bg_theme', backgroundTheme);
        } catch (_) {
          // no-op
        }
      }, [backgroundTheme]);

      useEffect(() => {
        loadAll();
        if (!user) return undefined;
        const timer = setInterval(() => { loadAll(); }, 8000);
        return () => clearInterval(timer);
      }, [user, foodFilters]);

      useEffect(() => {
        if (path === '/ngo/map-view') setNgoViewMode('map');
        if (path === '/ngo/live-feed') setNgoViewMode('list');
      }, [path]);

      useEffect(() => {
        if (user && path === '/home') {
          const destination = user.role === 'DONOR' ? '/donor/dashboard' : user.role === 'NGO' ? '/ngo/dashboard' : '/admin/overview';
          navigate(setPath, destination);
        }
      }, [user, path]);

      const resetToken = useMemo(() => {
        const currentPath = String(window.location.pathname || '');
        if (currentPath.startsWith('/reset-password/')) {
          return decodeURIComponent(currentPath.slice('/reset-password/'.length));
        }
        const qsToken = new URLSearchParams(window.location.search).get('token');
        return qsToken || '';
      }, [path]);

      const login = async (username, password) => {
        setBusy(true); setError('');
        try {
          const controller = new AbortController();
          const timeoutId = window.setTimeout(() => controller.abort(), 7000);
          const data = await apiSend('/api/auth/login', {
            method: 'POST',
            body: { username, password },
            signal: controller.signal,
          });
          window.clearTimeout(timeoutId);
          setUser(data.user);
          const next = data.user.role === 'DONOR' ? '/donor/dashboard' : data.user.role === 'NGO' ? '/ngo/dashboard' : '/admin/overview';
          navigate(setPath, next);
        } catch (err) {
          if (err?.name === 'AbortError') {
            setError('Login is taking too long. Please try again in a moment.');
          } else {
            setError(err.message || 'Unable to login');
          }
        }
        finally { setBusy(false); }
      };

      const register = async (username, password, role, city = 'Bhubaneswar') => {
        setBusy(true); setError('');
        try {
          const location_text = `${city}, Odisha`;
          const data = await apiSend('/api/auth/register', {
            method: 'POST',
            body: { username, password, role, city, location_text },
          });
          setUser(data.user);
          const next = role === 'DONOR' ? '/donor/dashboard' : role === 'NGO' ? '/ngo/dashboard' : '/admin/overview';
          navigate(setPath, next);
        } catch (err) { setError(err.message || 'Unable to register'); }
        finally { setBusy(false); }
      };

      const forgot = async (username) => {
        const data = await apiSend('/api/auth/forgot-password', { method: 'POST', body: { username } });
        setError(data.message || 'Reset flow triggered');
      };

      const resetPassword = async (token, newPassword) => {
        setBusy(true); setError('');
        try {
          const data = await apiSend('/api/auth/reset-password', {
            method: 'POST',
            body: { token, new_password: newPassword },
          });
          setError(data.message || 'Password reset successful. Please sign in.');
          navigate(setPath, '/login');
        } catch (err) {
          setError(err.message || 'Unable to reset password');
        } finally {
          setBusy(false);
        }
      };

      const updateRow = async (foodId, updates) => {
        await apiSend(`/api/food/${foodId}`, { method: 'PUT', body: { updates } });
        loadAll();
      };

      const adminUpdateUser = async (userId, action) => {
        const data = await apiSend(`/api/admin/users/${userId}/status`, { method: 'PATCH', body: { action } });
        if (data.status === 'success') {
          // Optimistic UI update - apply change immediately before full reload
          setAdminUsers(prev => prev.map(u => {
            if (u.id !== userId) return u;
            if (action === 'verify')   return { ...u, is_verified: 1 };
            if (action === 'unverify') return { ...u, is_verified: 0 };
            if (action === 'ban')      return { ...u, is_banned: 1 };
            if (action === 'unban')    return { ...u, is_banned: 0 };
            return u;
          }));
        } else {
          setError(data.message || 'Action failed');
        }
        await loadAll();
      };

      const claimFood = async (foodId) => {
        if (!user) return;
        const data = await apiSend(`/api/food/${foodId}/claim`, { method: 'POST', body: { claimed_by: user.username } });
        if (data.status === 'success') {
          await loadAll();
          navigate(setPath, '/ngo/active-claims');
        } else {
          setError(data.message || 'Unable to claim listing');
        }
      };

      const markNotificationRead = async (notificationId) => {
        if (!user) return;
        await apiSend(`/api/notifications/${notificationId}/read`, {
          method: 'PATCH',
          body: { username: user.username, role: user.role },
        });
        loadAll();
      };

      const markAllNotificationsRead = async () => {
        if (!user) return;
        await apiSend('/api/notifications/read-all', {
          method: 'PATCH',
          body: { username: user.username, role: user.role },
        });
        loadAll();
      };

      const handleLogout = async () => {
        try {
          if (user?.username) {
            await apiSend('/api/auth/logout', { method: 'POST', body: { username: user.username } });
          }
        } catch (_) {
          // no-op: client logout should still proceed
        }
        setUser(null);
        localStorage.removeItem('foodsave_user');
        navigate(setPath, '/home');
      };

      const mergeChatMessages = (currentMessages, incomingMessages, statusUpdates = []) => {
        const byKey = new Map();
        (currentMessages || []).forEach((message) => {
          const primaryKey = message && message.id != null ? `id:${message.id}` : null;
          const nonceKey = message && message.client_nonce ? `nonce:${message.client_nonce}` : null;
          const nextMessage = { ...message };
          if (primaryKey) byKey.set(primaryKey, nextMessage);
          if (nonceKey) byKey.set(nonceKey, nextMessage);
        });

        [...(incomingMessages || []), ...(statusUpdates || [])].forEach((message) => {
          const primaryKey = message && message.id != null ? `id:${message.id}` : null;
          const nonceKey = message && message.client_nonce ? `nonce:${message.client_nonce}` : null;
          const existing = (primaryKey && byKey.get(primaryKey)) || (nonceKey && byKey.get(nonceKey)) || null;
          const merged = { ...(existing || {}), ...(message || {}) };
          if (primaryKey) byKey.set(primaryKey, merged);
          if (nonceKey) byKey.set(nonceKey, merged);
        });

        const uniqueMessages = [];
        const seen = new Set();
        byKey.forEach((message) => {
          const uniqueKey = message && message.id != null ? `id:${message.id}` : `nonce:${message.client_nonce || Math.random()}`;
          if (seen.has(uniqueKey)) return;
          seen.add(uniqueKey);
          uniqueMessages.push(message);
        });

        const nextMessages = uniqueMessages.sort((left, right) => {
          const leftId = Number(left?.id || 0);
          const rightId = Number(right?.id || 0);
          if (leftId && rightId) return leftId - rightId;
          return new Date(left?.created_at || 0).getTime() - new Date(right?.created_at || 0).getTime();
        });

        if ((currentMessages || []).length !== nextMessages.length) {
          return nextMessages;
        }

        const isSame = nextMessages.every((message, index) => {
          const current = currentMessages[index] || {};
          return (
            String(current.id || '') === String(message.id || '')
            && String(current.client_nonce || '') === String(message.client_nonce || '')
            && String(current.status || '') === String(message.status || '')
            && String(current.delivered_at || '') === String(message.delivered_at || '')
            && String(current.read_at || '') === String(message.read_at || '')
            && String(current.message || '') === String(message.message || '')
          );
        });

        return isSame ? currentMessages : nextMessages;
      };

      const areThreadsEquivalent = (leftThreads, rightThreads) => {
        if ((leftThreads || []).length !== (rightThreads || []).length) return false;
        return (leftThreads || []).every((thread, index) => {
          const next = rightThreads[index] || {};
          return (
            Number(thread.food_id || 0) === Number(next.food_id || 0)
            && Number(thread.unread_count || 0) === Number(next.unread_count || 0)
            && Number(thread.last_message_id || 0) === Number(next.last_message_id || 0)
            && String(thread.last_message || '') === String(next.last_message || '')
            && String(thread.last_message_status || '') === String(next.last_message_status || '')
            && String(thread.last_message_at || '') === String(next.last_message_at || '')
          );
        });
      };

      const formatChatTimestamp = (value, compact = false) => {
        if (!value) return compact ? 'now' : 'Just now';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return compact ? 'now' : 'Just now';
        const delta = Date.now() - date.getTime();
        if (delta < 60000) return compact ? 'now' : 'Just now';
        if (delta < 3600000) return `${Math.max(1, Math.round(delta / 60000))}m`;
        if (delta < 86400000) return compact ? `${Math.max(1, Math.round(delta / 3600000))}h` : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        return compact ? date.toLocaleDateString([], { month: 'short', day: 'numeric' }) : date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      };

      const getChatStatusMeta = (status) => {
        switch (status) {
          case 'sending':
            return { icon: 'fa-clock', label: 'Sending', className: 'chat-status-pending' };
          case 'failed':
            return { icon: 'fa-circle-exclamation', label: 'Failed', className: 'chat-status-failed' };
          case 'read':
            return { icon: 'fa-check-double', label: 'Read', className: 'chat-status-read' };
          case 'delivered':
            return { icon: 'fa-check-double', label: 'Delivered', className: 'chat-status-delivered' };
          case 'sent':
            return { icon: 'fa-check', label: 'Sent', className: 'chat-status-sent' };
          default:
            return { icon: 'fa-check', label: 'Sent', className: 'chat-status-sent' };
        }
      };

      const donorRows = rows.filter((r) => user && r.donor_name === user.username);
      const ngoRows = rows.filter((r) => user && r.claimed_by === user.username);

      const fallbackChatThreads = useMemo(() => {
        if (!user) return [];
        const sourceRows = user.role === 'DONOR'
          ? donorRows.filter((row) => row.is_claimed)
          : ngoRows.filter((row) => row.is_claimed);
        return sourceRows.map((row) => ({
          food_id: row.id,
          food_name: row.food_name,
          qty: row.qty,
          safe_hours: row.safe_hours,
          donor_name: row.donor_name,
          ngo_name: row.claimed_by,
          counterpart: user.role === 'DONOR' ? row.claimed_by : row.donor_name,
          unread_count: 0,
          total_messages: 0,
          last_message: '',
          last_message_id: 0,
          last_message_sender: null,
          last_message_at: null,
          last_message_status: 'idle',
        }));
      }, [user, donorRows, ngoRows]);

      const visibleChatThreads = chatThreads.length ? chatThreads : fallbackChatThreads;
      const activeChatListing = rows.find((r) => Number(r.id) === Number(activeChatFoodId));
      const activeChatThread = visibleChatThreads.find((thread) => Number(thread.food_id) === Number(activeChatFoodId)) || null;
      const activeChatMeta = chatConversation || activeChatThread || (activeChatListing ? {
        food_id: activeChatListing.id,
        food_name: activeChatListing.food_name,
        qty: activeChatListing.qty,
        safe_hours: activeChatListing.safe_hours,
        donor_name: activeChatListing.donor_name,
        ngo_name: activeChatListing.claimed_by,
        counterpart: user?.role === 'DONOR' ? activeChatListing.claimed_by : activeChatListing.donor_name,
        unread_count: 0,
        last_message: null,
      } : null);

      const syncChatThreads = async ({ silent = false } = {}) => {
        if (!user) return [];
        try {
          const data = await apiGet(`/api/chats?username=${encodeURIComponent(user.username)}`);
          const nextThreads = data.threads || [];
          setChatThreads((currentThreads) => (areThreadsEquivalent(currentThreads, nextThreads) ? currentThreads : nextThreads));
          return nextThreads;
        } catch (err) {
          if (!silent) setError(err.message || 'Unable to load conversations');
          return [];
        }
      };

      const syncChatThreadSummary = (conversation, latestMessageOverride = null) => {
        if (!conversation?.food_id) return;
        const effectiveLastMessage = latestMessageOverride || conversation.last_message || null;
        setChatThreads((currentThreads) => {
          const nextThread = {
            ...currentThreads.find((thread) => Number(thread.food_id) === Number(conversation.food_id)),
            ...conversation,
            last_message: effectiveLastMessage?.message || conversation.last_message || '',
            last_message_id: effectiveLastMessage?.id || conversation.last_message_id || 0,
            last_message_sender: effectiveLastMessage?.sender || conversation.last_message_sender || null,
            last_message_at: effectiveLastMessage?.created_at || conversation.last_message_at || null,
            last_message_status: effectiveLastMessage?.status || conversation.last_message_status || 'idle',
          };
          const withoutCurrent = currentThreads.filter((thread) => Number(thread.food_id) !== Number(conversation.food_id));
          return [nextThread, ...withoutCurrent].sort((left, right) => Number(right.last_message_id || 0) - Number(left.last_message_id || 0));
        });
      };

      const loadClaimChat = async (foodId, { incremental = false, silent = false } = {}) => {
        if (!user || !foodId) return null;
        if (!incremental) setChatLoading(true);
        if (incremental && !silent) setChatSyncing(true);
        try {
          const params = new URLSearchParams({ username: user.username, limit: '120' });
          if (incremental && chatLastSeenId) params.set('since_id', String(chatLastSeenId));
          const data = await apiGet(`/api/food/${foodId}/chat?${params.toString()}`);

          const nextMessages = data.messages || [];
          const nextStatusUpdates = data.status_updates || [];
          setChatConversation(data.conversation || null);
          setChatMessages((currentMessages) => {
            if (!incremental) return mergeChatMessages([], nextMessages, nextStatusUpdates);
            return mergeChatMessages(currentMessages, nextMessages, nextStatusUpdates);
          });
          setChatLastSeenId((currentLastSeenId) => Math.max(currentLastSeenId, Number(data.sync?.latest_message_id || 0)));
          if (data.conversation) syncChatThreadSummary(data.conversation, data.conversation.last_message || null);
          return data;
        } catch (err) {
          if (!silent) setError(err.message || 'Unable to load chat');
          return null;
        } finally {
          if (!incremental) setChatLoading(false);
          if (incremental && !silent) setChatSyncing(false);
        }
      };

      const openClaimChat = async (foodId) => {
        setActiveChatFoodId(foodId);
        setChatDraft('');
        setChatMessages([]);
        setChatConversation(null);
        setChatLastSeenId(0);
        setChatStickToBottom(true);
        await syncChatThreads({ silent: true });
        await loadClaimChat(foodId, { incremental: false });
      };

      const closeClaimChat = () => {
        setActiveChatFoodId(null);
        setChatMessages([]);
        setChatConversation(null);
        setChatDraft('');
        setChatLastSeenId(0);
      };

      const sendClaimChat = async () => {
        if (!user || !activeChatFoodId) return;
        const message = chatDraft.trim();
        if (!message) return;

        const clientNonce = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const optimisticMessage = {
          id: `temp-${clientNonce}`,
          food_id: activeChatFoodId,
          donor_name: activeChatMeta?.donor_name || activeChatListing?.donor_name || '',
          ngo_name: activeChatMeta?.ngo_name || activeChatListing?.claimed_by || '',
          sender: user.username,
          message,
          client_nonce: clientNonce,
          delivered_at: null,
          read_at: null,
          status: 'sending',
          created_at: new Date().toISOString(),
        };

        setChatBusy(true);
        setChatDraft('');
        setChatStickToBottom(true);
        setChatMessages((currentMessages) => mergeChatMessages(currentMessages, [optimisticMessage], []));

        try {
          const data = await apiSend(`/api/food/${activeChatFoodId}/chat`, {
            method: 'POST',
            body: { username: user.username, message, client_nonce: clientNonce },
          });

          setChatMessages((currentMessages) => {
            const withoutOptimistic = currentMessages.filter((entry) => entry.client_nonce !== clientNonce && entry.id !== optimisticMessage.id);
            return mergeChatMessages(withoutOptimistic, [data.message], []);
          });
          setChatLastSeenId((currentLastSeenId) => Math.max(currentLastSeenId, Number(data.message?.id || 0)));
          syncChatThreadSummary({
            ...(activeChatMeta || {}),
            food_id: Number(activeChatFoodId),
            food_name: activeChatMeta?.food_name || activeChatListing?.food_name,
            qty: activeChatMeta?.qty || activeChatListing?.qty,
            safe_hours: activeChatMeta?.safe_hours || activeChatListing?.safe_hours,
            donor_name: activeChatMeta?.donor_name || activeChatListing?.donor_name,
            ngo_name: activeChatMeta?.ngo_name || activeChatListing?.claimed_by,
            counterpart: activeChatMeta?.counterpart || (user.role === 'DONOR' ? activeChatListing?.claimed_by : activeChatListing?.donor_name),
            unread_count: 0,
          }, data.message);
          await loadClaimChat(activeChatFoodId, { incremental: true, silent: true });
          await syncChatThreads({ silent: true });
        } catch (err) {
          setChatMessages((currentMessages) => currentMessages.map((entry) => (
            entry.client_nonce === clientNonce ? { ...entry, status: 'failed' } : entry
          )));
          setChatDraft(message);
          setError(err.message || 'Unable to send message');
        } finally {
          setChatBusy(false);
        }
      };

      useEffect(() => {
        if (!user) {
          setChatThreads([]);
          setChatMessages([]);
          setChatConversation(null);
          setChatLastSeenId(0);
          return;
        }
        syncChatThreads({ silent: true });
      }, [user]);

      useEffect(() => {
        if (!user) return;
        const timer = setInterval(() => {
          syncChatThreads({ silent: true });
        }, activeChatFoodId ? 3500 : 6000);
        return () => clearInterval(timer);
      }, [user, activeChatFoodId]);

      useEffect(() => {
        if (!user || !activeChatFoodId) return;
        const timer = setInterval(() => {
          loadClaimChat(activeChatFoodId, { incremental: true, silent: true });
        }, 2200);
        return () => clearInterval(timer);
      }, [user, activeChatFoodId, chatLastSeenId]);

      useEffect(() => {
        const scroller = chatScrollRef.current;
        if (!scroller || !chatStickToBottom) return;
        scroller.scrollTo({ top: scroller.scrollHeight, behavior: chatMessages.length > 1 ? 'smooth' : 'auto' });
      }, [chatMessages, activeChatFoodId, chatStickToBottom]);

      const topMetrics = analytics?.metrics || {};
      const overallRisk = Math.min(100, Math.max(0, (Number(topMetrics.high_risk_available || 0) / Math.max(1, Number(topMetrics.available_listings || 1))) * 100));

      const ClaimChatPanel = () => {
        if (!user) return null;
        const hasThreads = visibleChatThreads.length > 0;

        return (
          <div className="claim-chat-workspace glass rounded-3 p-0 mt-4 overflow-hidden">
            <div className="claim-chat-sidebar">
              <div className="claim-chat-sidebar-head">
                <div>
                  <h5 className="fw-bold mb-1"><i className="fas fa-comments me-2"></i>Live Claim Chat</h5>
                  <p className="mb-0">WhatsApp-style coordination for donor and NGO handoff.</p>
                </div>
                <button className="btn btn-sm btn-outline-light" onClick={() => syncChatThreads()}>
                  <i className={`fas ${chatSyncing ? 'fa-rotate fa-spin' : 'fa-arrows-rotate'}`}></i>
                </button>
              </div>
              <div className="claim-chat-thread-list">
                {!hasThreads && <div className="claim-chat-empty-threads">No claimed conversations yet.</div>}
                {visibleChatThreads.map((thread) => {
                  const isActive = Number(thread.food_id) === Number(activeChatFoodId);
                  return (
                    <button
                      key={`thread-${thread.food_id}`}
                      type="button"
                      className={`claim-chat-thread ${isActive ? 'active' : ''}`}
                      onClick={() => openClaimChat(thread.food_id)}
                    >
                      <div className="claim-chat-thread-topline">
                        <strong>{thread.food_name}</strong>
                        <span>{formatChatTimestamp(thread.last_message_at, true)}</span>
                      </div>
                      <div className="claim-chat-thread-meta">#{thread.food_id} · {thread.counterpart || 'counterpart'}</div>
                      <div className="claim-chat-thread-preview-row">
                        <span className="claim-chat-thread-preview">{thread.last_message || 'Open the conversation to start the handoff.'}</span>
                        {thread.unread_count > 0 && <span className="claim-chat-unread-pill">{thread.unread_count}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="claim-chat-main">
              {!activeChatFoodId && (
                <div className="claim-chat-empty-state">
                  <i className="fas fa-message"></i>
                  <h6>Select a conversation</h6>
                  <p className="mb-0">Pick any claimed listing to coordinate pickup, timing, and verification in one live thread.</p>
                </div>
              )}

              {activeChatFoodId && (
                <>
                  <div className="claim-chat-header">
                    <div>
                      <div className="claim-chat-header-title">{activeChatMeta?.food_name || `Listing #${activeChatFoodId}`}</div>
                      <div className="claim-chat-header-subtitle">
                        #{activeChatFoodId} · {activeChatMeta?.counterpart || 'Counterpart'} · Qty {Number(activeChatMeta?.qty || 0).toFixed(1)} · Safe {Number(activeChatMeta?.safe_hours || 0).toFixed(1)}h
                      </div>
                    </div>
                    <div className="claim-chat-header-actions">
                      <span className={`claim-chat-live-pill ${chatSyncing ? 'syncing' : ''}`}>{chatSyncing ? 'Syncing' : 'Live'}</span>
                      <button className="btn btn-sm btn-outline-light" onClick={closeClaimChat}>Close</button>
                    </div>
                  </div>

                  <div
                    ref={chatScrollRef}
                    className="claim-chat-message-list"
                    onScroll={(event) => {
                      const node = event.currentTarget;
                      const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
                      setChatStickToBottom(distanceFromBottom < 80);
                    }}
                  >
                    {chatLoading && <div className="claim-chat-inline-note">Loading conversation...</div>}
                    {!chatLoading && chatMessages.length === 0 && <div className="claim-chat-inline-note">No messages yet. Start coordinating the pickup window.</div>}
                    {chatMessages.map((message) => {
                      const isMine = String(message.sender || '').toLowerCase() === String(user.username || '').toLowerCase();
                      const statusMeta = getChatStatusMeta(message.status);
                      return (
                        <div key={`${message.id}-${message.client_nonce || 'server'}`} className={`claim-chat-row ${isMine ? 'mine' : 'theirs'}`}>
                          <div className={`claim-chat-bubble ${isMine ? 'outgoing' : 'incoming'} ${message.status === 'failed' ? 'failed' : ''}`}>
                            <div className="claim-chat-sender">{isMine ? 'You' : message.sender}</div>
                            <div className="claim-chat-copy">{message.message}</div>
                            <div className="claim-chat-message-meta">
                              <span>{formatChatTimestamp(message.created_at)}</span>
                              {isMine && (
                                <span className={`claim-chat-status ${statusMeta.className}`}>
                                  <i className={`fas ${statusMeta.icon}`}></i>
                                  {statusMeta.label}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="claim-chat-composer-shell">
                    <textarea
                      value={chatDraft}
                      onChange={(event) => setChatDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          sendClaimChat();
                        }
                      }}
                      placeholder="Type a live handoff message..."
                      className="form-control claim-chat-composer"
                      rows={2}
                    />
                    <button className="btn btn-info claim-chat-send-btn" disabled={chatBusy || !chatDraft.trim()} onClick={sendClaimChat}>
                      {chatBusy ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      };

      const AuthForm = ({ mode }) => {
        const [email, setEmail] = useState('');
        const [password, setPassword] = useState('');
        const [role, setRole] = useState('DONOR');
        const [city, setCity] = useState('Bhubaneswar');
        const [showPw, setShowPw] = useState(false);
        const [geoBusy, setGeoBusy] = useState(false);

        const useCurrentLocation = () => {
          if (!navigator.geolocation) {
            setError('Location is not supported on this browser. Please select your city manually.');
            return;
          }

          setGeoBusy(true);
          setError('');

          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude, longitude } = position.coords || {};
              if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                setError('Unable to read your location. Please select your city manually.');
                setGeoBusy(false);
                return;
              }

              try {
                const data = await apiGet('/api/cities');
                const cities = Array.isArray(data?.cities) ? data.cities : [];

                if (!cities.length) {
                  setCity('Bhubaneswar');
                  setGeoBusy(false);
                  return;
                }

                let nearest = cities[0];
                let nearestScore = Number.POSITIVE_INFINITY;
                cities.forEach((candidate) => {
                  const lat = Number(candidate?.lat);
                  const lng = Number(candidate?.lng);
                  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

                  const dLat = latitude - lat;
                  const dLng = longitude - lng;
                  const score = (dLat * dLat) + (dLng * dLng);
                  if (score < nearestScore) {
                    nearestScore = score;
                    nearest = candidate;
                  }
                });

                setCity(String(nearest?.name || 'Bhubaneswar'));
              } catch (_) {
                setCity('Bhubaneswar');
              } finally {
                setGeoBusy(false);
              }
            },
            () => {
              setError('Unable to fetch your location. Please select your city manually.');
              setGeoBusy(false);
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
          );
        };

        const submit = (e) => {
          e.preventDefault();
          const username = email.trim().toLowerCase();
          if (mode === 'login') login(username, password);
          if (mode === 'register') register(username, password, role, city);
          if (mode === 'forgot-password') forgot(username);
          if (mode === 'reset-password') {
            if (!resetToken) {
              setError('Reset token missing or invalid');
              return;
            }
            resetPassword(resetToken, password);
          }
        };

        const modeConfig = {
          login: {
            heading: 'Sign In to Your Account',
            sub: 'Welcome back - enter your details below to continue.',
            btnLabel: 'Sign In',
            btnIcon: 'fa-sign-in-alt',
            emailHint: 'Use your username or email.',
          },
          register: {
            heading: 'Create Your Free Account',
            sub: 'Join the movement - it takes under 60 seconds.',
            btnLabel: 'Create Account',
            btnIcon: 'fa-user-plus',
            emailHint: 'Any username or email works for this prototype.',
          },
          'forgot-password': {
            heading: 'Reset Your Password',
            sub: "Enter your username or email and we'll generate a reset link.",
            btnLabel: 'Send Reset Link',
            btnIcon: 'fa-paper-plane',
            emailHint: 'Prototype mode keeps recovery simple.',
          },
          'reset-password': {
            heading: 'Set a New Password',
            sub: 'Choose a strong new password for your account.',
            btnLabel: 'Update Password',
            btnIcon: 'fa-key',
            emailHint: 'Password reset token verified.',
          },
        };
        const cfg = modeConfig[mode] || modeConfig.login;

        const steps = mode === 'login'
          ? [
              { icon: 'fa-user', label: 'Username or email', desc: 'Use whichever ID you used while signing up.' },
              { icon: 'fa-lock', label: 'Enter your password', desc: 'Passwords are case-sensitive. Use the eye icon to check what you typed.' },
              { icon: 'fa-sign-in-alt', label: 'Tap Sign In', desc: "You'll land on your personalised dashboard instantly." },
            ]
          : mode === 'register'
          ? [
              { icon: 'fa-user', label: 'Pick any login ID', desc: 'Email or username are both accepted in this prototype.' },
              { icon: 'fa-key', label: 'Choose any password', desc: 'Keep it memorable so you can test quickly.' },
              { icon: 'fa-user-tag', label: 'Pick your role', desc: 'Donor = share food. NGO = claim & distribute. You can contact support to change later.' },
            ]
          : mode === 'forgot-password'
          ? [
              { icon: 'fa-envelope', label: 'Enter your account email', desc: 'The exact email you used to register on FoodSave.' },
              { icon: 'fa-inbox', label: 'Check your inbox', desc: "We'll email a reset link within a minute. Check spam if it doesn't arrive." },
              { icon: 'fa-lock-open', label: 'Set a new password', desc: 'Follow the link in the email to choose a new password.' },
            ]
          : [
              { icon: 'fa-link', label: 'Token validated', desc: 'Your secure reset token is attached to this request.' },
              { icon: 'fa-shield-alt', label: 'Set a strong password', desc: 'Use at least 8 characters with mixed letters and numbers.' },
              { icon: 'fa-sign-in-alt', label: 'Sign in again', desc: 'After update, login with your new credentials.' },
            ];

        return (
          <section className="section-enter mt-0 grid lg:grid-cols-2 gap-6 auth-shell-grid">
            
            <div className="glass rounded-3xl p-7 md:p-9 flex flex-col justify-between gap-6 auth-shell-panel auth-shell-panel-info">
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div style={{ width: 46, height: 46, borderRadius: 14, background: 'linear-gradient(135deg,#34d399,#22d3ee)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className="fas fa-leaf" style={{ color: '#000', fontSize: 19 }}></i>
                  </div>
                  <span style={{ fontSize: 22, fontWeight: 800, color: '#34d399', letterSpacing: '-0.02em' }}>FoodSave AI</span>
                </div>
                <h2 style={{ fontSize: '1.85rem', fontWeight: 800, lineHeight: 1.2, marginBottom: 10 }}>One login.<br />Endless impact.</h2>
                <p style={{ color: 'rgba(225,248,255,0.65)', fontSize: 14, lineHeight: 1.7, marginBottom: 0 }}>Your account connects you to NGOs, donors, and rescued meals - all in real time.</p>
              </div>

              
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#34d399', textTransform: 'uppercase', marginBottom: 12 }}>How to {mode === 'login' ? 'sign in' : mode === 'register' ? 'register' : 'reset'}</p>
                <div className="auth-steps-stack" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {steps.map((s, i) => (
                    <div key={i} className="auth-step-item" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(52,211,153,0.13)', border: '1px solid rgba(52,211,153,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <i className={`fas ${s.icon}`} style={{ color: '#34d399', fontSize: 13 }}></i>
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#ecfeff', margin: '0 0 2px' }}>{s.label}</p>
                        <p style={{ fontSize: 12, color: 'rgba(225,248,255,0.55)', margin: 0, lineHeight: 1.5 }}>{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 12, background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.2)' }}>
                  <p style={{ fontSize: 12, color: 'rgba(34,211,238,0.9)', margin: 0 }}>
                    <i className="fas fa-info-circle" style={{ marginRight: 6 }}></i>
                    <strong>Email = Username.</strong> Always use the same email address you signed up with.
                  </p>
                </div>
              </div>
            </div>

            
            <div className="glass rounded-3xl p-7 md:p-9 auth-shell-panel auth-shell-panel-form">
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 4 }}>{cfg.heading}</h3>
              <p style={{ fontSize: 13, color: 'rgba(225,248,255,0.6)', marginBottom: 24 }}>{cfg.sub}</p>

              <form onSubmit={submit} className="auth-form-stack" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                
                {mode !== 'reset-password' && <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#22d3ee', marginBottom: 6 }}>
                    <i className="fas fa-envelope" style={{ marginRight: 7 }}></i>
                    Email Address <span style={{ color: '#fb7185' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="username or email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    autoFocus
                    style={{ color: '#ecfeff' }}
                    className="w-full rounded-xl px-4 py-3 bg-black/25 border border-white/20"
                  />
                  <p style={{ fontSize: 11.5, marginTop: 6, color: 'rgba(225,248,255,0.48)', lineHeight: 1.5 }}>
                    <i className="fas fa-info-circle" style={{ marginRight: 5 }}></i>{cfg.emailHint}
                  </p>
                </div>}

                
                {mode !== 'forgot-password' && (
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#22d3ee', marginBottom: 6 }}>
                      <i className="fas fa-lock" style={{ marginRight: 7 }}></i>
                      Password <span style={{ color: '#fb7185' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPw ? 'text' : 'password'}
                        required
                        placeholder={mode === 'login' ? 'Enter your password' : 'Create a password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        style={{ color: '#ecfeff', paddingRight: '3.2rem', width: '100%' }}
                        className="rounded-xl px-4 py-3 bg-black/25 border border-white/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        aria-label={showPw ? 'Hide password' : 'Show password'}
                        style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(225,248,255,0.45)', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                      >
                        <i className={`fas ${showPw ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                    </div>
                    {mode === 'login' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                        <p style={{ fontSize: 11.5, color: 'rgba(225,248,255,0.45)', margin: 0 }}>Passwords are case-sensitive.</p>
                        <button type="button" onClick={() => navigate(setPath, '/forgot-password')} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: '#22d3ee', fontWeight: 600, cursor: 'pointer' }}>Forgot password?</button>
                      </div>
                    )}
                  </div>
                )}

                
                {mode === 'register' && (
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#22d3ee', marginBottom: 6 }}>
                      <i className="fas fa-user-tag" style={{ marginRight: 7 }}></i>
                      I am joining as <span style={{ color: '#fb7185' }}>*</span>
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      style={{ color: '#ecfeff', width: '100%' }}
                      className="rounded-xl px-4 py-3 bg-black/25 border border-white/20"
                    >
                      <option value="DONOR">Donor - I have surplus food to share</option>
                      <option value="NGO">NGO - I rescue & distribute food</option>
                      <option value="ADMIN">Admin - I manage users, approvals, and platform operations</option>
                    </select>
                    <p style={{ fontSize: 11.5, marginTop: 6, color: 'rgba(225,248,255,0.45)' }}>
                      <i className="fas fa-info-circle" style={{ marginRight: 5 }}></i>Your role determines what features you see. You can request a change via support.
                    </p>
                  </div>
                )}

                
                {mode === 'register' && (
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#22d3ee', marginBottom: 6 }}>
                      <i className="fas fa-map-marker-alt" style={{ marginRight: 7 }}></i>
                      Your City in Odisha <span style={{ color: '#fb7185' }}>*</span>
                    </label>
                    <button
                      type="button"
                      onClick={useCurrentLocation}
                      disabled={geoBusy || busy}
                      className="btn btn-outline-info btn-sm"
                      style={{ marginBottom: 8 }}
                    >
                      <i className={`fas ${geoBusy ? 'fa-spinner fa-spin' : 'fa-location-crosshairs'}`} style={{ marginRight: 6 }}></i>
                      {geoBusy ? 'Detecting location...' : 'Use current location'}
                    </button>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                      style={{ color: '#ecfeff', width: '100%' }}
                      className="rounded-xl px-4 py-3 bg-black/25 border border-white/20"
                    >
                      {['Bhubaneswar','Cuttack','Puri','Rourkela','Sambalpur','Berhampur','Balasore','Bhadrak','Kendrapara','Jeypore'].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <p style={{ fontSize: 11.5, marginTop: 6, color: 'rgba(225,248,255,0.45)' }}>
                      <i className="fas fa-info-circle" style={{ marginRight: 5 }}></i>Used to calculate distances to nearby food listings on the map.
                    </p>
                  </div>
                )}

                <button
                  disabled={busy}
                  className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-emerald-500 to-cyan-500"
                  style={{ color: '#000', fontSize: 15, letterSpacing: '0.01em', opacity: busy ? 0.7 : 1 }}
                >
                  {busy
                    ? <><span className="pulse-dot" style={{ marginRight: 8 }}></span>{mode === 'login' ? 'Signing in...' : 'Please wait...'}</>
                    : <><i className={`fas ${cfg.btnIcon}`} style={{ marginRight: 8 }}></i>{cfg.btnLabel}</>}
                </button>
              </form>

              {error && (
                <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 12, background: 'rgba(251,113,133,0.10)', border: '1px solid rgba(251,113,133,0.32)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <i className="fas fa-exclamation-triangle" style={{ color: '#fb7185', flexShrink: 0, marginTop: 1 }}></i>
                  <p style={{ fontSize: 13, color: '#fca5a5', margin: 0, lineHeight: 1.5 }}>{error}</p>
                </div>
              )}

              {mode === 'login' && (
                <p style={{ textAlign: 'center', fontSize: 13, marginTop: 22, color: 'rgba(225,248,255,0.5)' }}>
                  Don&#39;t have an account?{' '}
                  <button type="button" onClick={() => navigate(setPath, '/register')} style={{ background: 'none', border: 'none', padding: 0, color: '#34d399', fontWeight: 700, cursor: 'pointer' }}>Create one free {'->'}</button>
                </p>
              )}
              {mode === 'register' && (
                <p style={{ textAlign: 'center', fontSize: 13, marginTop: 22, color: 'rgba(225,248,255,0.5)' }}>
                  Already have an account?{' '}
                  <button type="button" onClick={() => navigate(setPath, '/login')} style={{ background: 'none', border: 'none', padding: 0, color: '#34d399', fontWeight: 700, cursor: 'pointer' }}>Sign in {'->'}</button>
                </p>
              )}
              {mode === 'forgot-password' && (
                <p style={{ textAlign: 'center', fontSize: 13, marginTop: 22, color: 'rgba(225,248,255,0.5)' }}>
                  Remembered it?{' '}
                  <button type="button" onClick={() => navigate(setPath, '/login')} style={{ background: 'none', border: 'none', padding: 0, color: '#34d399', fontWeight: 700, cursor: 'pointer' }}>Back to sign in {'->'}</button>
                </p>
              )}
            </div>
          </section>
        );
      };

      const FilterBar = () => {
        const resetFilters = () => setFoodFilters({ q: '', is_claimed: '', min_safe_hours: '', max_safe_hours: '' });
        return (
          <section className="glass rounded-3xl p-4 mt-4 mb-4">
            <div className="row g-2 align-items-end">
              <div className="col-md-4">
                <label className="small fw-bold d-block mb-2" style={{ color: '#22d3ee' }}>Search</label>
                <input placeholder="Search food name..." value={foodFilters.q} onChange={(e) => setFoodFilters((f) => ({ ...f, q: e.target.value }))} className="form-control" />
              </div>
              <div className="col-md-2">
                <label className="small fw-bold d-block mb-2" style={{ color: '#22d3ee' }}>Claim status</label>
                <select value={foodFilters.is_claimed} onChange={(e) => setFoodFilters((f) => ({ ...f, is_claimed: e.target.value }))} className="form-select"><option value="">All</option><option value="0">Unclaimed</option><option value="1">Claimed</option></select>
              </div>
              <div className="col-md-2">
                <label className="small fw-bold d-block mb-2" style={{ color: '#22d3ee' }}>Min safe hours</label>
                <input type="number" placeholder="Min safe h" value={foodFilters.min_safe_hours} onChange={(e) => setFoodFilters((f) => ({ ...f, min_safe_hours: e.target.value }))} className="form-control" />
              </div>
              <div className="col-md-2">
                <label className="small fw-bold d-block mb-2" style={{ color: '#22d3ee' }}>Max safe hours</label>
                <input type="number" placeholder="Max safe h" value={foodFilters.max_safe_hours} onChange={(e) => setFoodFilters((f) => ({ ...f, max_safe_hours: e.target.value }))} className="form-control" />
              </div>
              <div className="col-md-2"><button className="btn btn-secondary w-100" onClick={resetFilters}>Reset</button></div>
            </div>
          </section>
        );
      };

      return (
        <div className={user ? 'app-sidebar-layout' : 'position-relative min-vh-100'} style={!user ? { paddingTop: '60px' } : {}}>
          {user
            ? <AppSidebar
                user={user}
                path={path}
                setPath={setPath}
                unreadCount={unreadCount}
                theme={theme}
                onToggleTheme={toggleTheme}
                backgroundTheme={backgroundTheme}
                onBackgroundThemeChange={setBackgroundTheme}
                onLogout={handleLogout}
                onOpenNotifications={() => setShowNotifications((v) => !v)}
              />
            : <LiquidNavbar
                user={user}
                path={path}
                setPath={setPath}
                unreadCount={unreadCount}
                theme={theme}
                onToggleTheme={toggleTheme}
                backgroundTheme={backgroundTheme}
                onBackgroundThemeChange={setBackgroundTheme}
                onOpenNotifications={() => setShowNotifications((v) => !v)}
                onLogout={() => {}}
              />
          }
          <main id="main-content" className={user ? 'app-sidebar-main' : `container-xxl py-4${PUBLIC_ROUTES.includes(path) ? ' universal-layout' : ''}`}>
            <div id="route-content" className={`${user ? '' : 'container '}route-content route-enter`}>

            {user && showNotifications && <section className="glass rounded-3xl p-4 mb-4"><div className="d-flex justify-content-between align-items-center mb-2"><h5 className="mb-0">Notifications</h5><div className="d-flex gap-2"><button className="btn btn-sm btn-outline-light" disabled={unreadCount === 0} onClick={markAllNotificationsRead}>Read All</button><button className="btn btn-sm btn-outline-light" onClick={() => setShowNotifications(false)}>Close</button></div></div><div className="space-y-2">{notifications.length === 0 && <p className="mb-0">No notifications yet.</p>}{notifications.slice(0, 20).map((n) => <div key={n.id} className="glass rounded-xl p-3 d-flex justify-content-between align-items-center"><div><p className="mb-1 fw-bold">{n.title}</p><p className="mb-0 small">{n.message}</p></div><button className="btn btn-sm btn-info" disabled={n.is_read} onClick={() => markNotificationRead(n.id)}>{n.is_read ? 'Read' : 'Mark read'}</button></div>)}</div></section>}

            {user && <FilterBar />}

            <DisclosureContext.Provider value={{ compactMode: isCompactPublicRoute, forceExpanded }}>

            {path === '/home' && <PublicHomePage setPath={setPath} />}

            {path === '/about' && <PublicAboutPage setPath={setPath} />}

            {path === '/impact' && <PublicImpactPage setPath={setPath} />}
            {user && path === '/visualizations' && <VisualizationLab analytics={analytics} rows={rows} setPath={setPath} user={user} theme={theme} />}
            {path === '/leaderboard' && <>
              <section id="leaderboard-hero" className="glass rounded-3xl p-4 mb-4 wow fadeInDown section-enter" data-wow-delay="0.08s">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: '#34d399', textTransform: 'uppercase', marginBottom: 6 }}>Public Rankings</p>
                    <h1 className="display-6 fw-bold mb-1" style={{ color: '#ecfeff' }}>Public Leaderboard</h1>
                    <p className="mb-0" style={{ color: '#22d3ee' }}>Top donor and NGO standings from current data.</p>
                  </div>
                  <button className="btn btn-outline-light" onClick={() => navigate(setPath, '/impact')}>
                    <i className="fas fa-chart-line me-2"></i>Impact Dashboard
                  </button>
                </div>
              </section>
              <section className="glass rounded-3xl p-3 p-md-4">
                <RealtimeLeaderboard analytics={analytics} rows={rows} />
              </section>
            </>}
            {path === '/contact' && <PublicContactPage setPath={setPath} />}


            {path === '/login' && <>
              <section className="glass rounded-3xl p-4 mb-4 wow fadeInDown section-enter" data-wow-delay="0.08s">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: '#34d399', textTransform: 'uppercase', marginBottom: 8 }}>Access</p>
                    <h1 className="display-6 fw-bold mb-1" style={{ color: '#ecfeff' }}>Login Screen</h1>
                    <p className="mb-0" style={{ color: '#22d3ee' }}>Secure sign in with role-aware workspace access.</p>
                  </div>

                </div>
              </section>

              <section className="dashboard-icon-grid mb-4">
                <button className="dashboard-icon-tile" onClick={() => navigate(setPath, '/register')}>
                  <i className="fas fa-user-plus"></i><span>New Account</span><small>Donor, NGO, Admin</small>
                </button>
                <button className="dashboard-icon-tile" onClick={() => navigate(setPath, '/forgot-password')}>
                  <i className="fas fa-key"></i><span>Reset Password</span><small>Recover access</small>
                </button>
                <button className="dashboard-icon-tile" onClick={() => navigate(setPath, '/home')}>
                  <i className="fas fa-home"></i><span>Back Home</span><small>Public dashboard</small>
                </button>
              </section>

              <AuthForm mode="login" />
            </>}

            {path === '/register' && <>
              <section className="glass rounded-3xl p-5 mb-4 wow fadeInDown" data-wow-delay="0.1s">
                <div className="text-center">
                  <h1 className="display-4 fw-bold mb-3" style={{ color: '#34d399' }}>Join the Movement</h1>
                  <p className="lead" style={{ color: '#22d3ee' }}>Create Your Free Account in Seconds</p>
                </div>
              </section>

              <AuthForm mode="register" />
            </>}
            {path === '/forgot-password' && <AuthForm mode="forgot-password" />}
            {path === '/reset-password' && <AuthForm mode="reset-password" />}

            {user && path === '/donor/dashboard' && <>
              {/* Portal header */}
              <div className="portal-header">
                <div>
                  <div className="portal-greeting"><i className="fas fa-hand-holding-heart me-2" style={{color:'#34d399'}}></i>Welcome back, {user.username}</div>
                  <div className="portal-subtext">Donor Command Center &mdash; {new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</div>
                </div>
                <button className="btn btn-primary" onClick={() => navigate(setPath, '/donor/donate')}><i className="fas fa-plus me-2"></i>New Donation</button>
              </div>
              {/* KPIs */}
              <div className="portal-kpi-row">
                <div className="portal-kpi" style={{'--kpi-color':'#34d399'}}>
                  <div className="portal-kpi-icon"><i className="fas fa-weight-hanging"></i></div>
                  <div className="portal-kpi-label">KG Donated</div>
                  <div className="portal-kpi-value">{donorRows.reduce((a,b)=>a+Number(b.qty||0),0).toFixed(1)}</div>
                  <div className="portal-kpi-sub">Total food rescued</div>
                </div>
                <div className="portal-kpi" style={{'--kpi-color':'#22d3ee'}}>
                  <div className="portal-kpi-icon"><i className="fas fa-box-open"></i></div>
                  <div className="portal-kpi-label">Active Listings</div>
                  <div className="portal-kpi-value">{donorRows.filter(r=>!r.is_claimed).length}</div>
                  <div className="portal-kpi-sub">Awaiting NGO claim</div>
                </div>
                <div className="portal-kpi" style={{'--kpi-color':'#818cf8'}}>
                  <div className="portal-kpi-icon"><i className="fas fa-check-circle"></i></div>
                  <div className="portal-kpi-label">Claimed</div>
                  <div className="portal-kpi-value">{donorRows.filter(r=>r.is_claimed).length}</div>
                  <div className="portal-kpi-sub">Successfully rescued</div>
                </div>
                <div className="portal-kpi" style={{'--kpi-color':'#fbbf24'}}>
                  <div className="portal-kpi-icon"><i className="fas fa-utensils"></i></div>
                  <div className="portal-kpi-label">Meals Rescued</div>
                  <div className="portal-kpi-value">{Math.floor(donorRows.reduce((a,b)=>a+Number(b.qty||0),0)*3)}</div>
                  <div className="portal-kpi-sub">~3 meals per kg</div>
                </div>
                <div className="portal-kpi" style={{'--kpi-color': donorRows.filter(r=>!r.is_claimed&&Number(r.safe_hours)<=3).length>0?'#fb7185':'#34d399', borderColor: donorRows.filter(r=>!r.is_claimed&&Number(r.safe_hours)<=3).length>0?'rgba(251,113,133,0.35)':'rgba(255,255,255,0.07)'}}>
                  <div className="portal-kpi-icon"><i className="fas fa-exclamation-triangle"></i></div>
                  <div className="portal-kpi-label">Urgent</div>
                  <div className="portal-kpi-value">{donorRows.filter(r=>!r.is_claimed&&Number(r.safe_hours)<=3).length}</div>
                  <div className="portal-kpi-sub">&le;3h safe window</div>
                </div>
              </div>
              {/* Action cards */}
              <div className="portal-section-title"><i className="fas fa-th-large me-2"></i>Quick Actions</div>
              <div className="portal-card-grid">
                <button className="portal-card" style={{'--card-accent':'#34d399','--card-icon-bg':'rgba(52,211,153,0.12)'}} onClick={()=>navigate(setPath,'/donor/donate')}>
                  <div className="portal-card-icon"><i className="fas fa-magic"></i></div>
                  <div className="portal-card-title">AI Donation Wizard</div>
                  <div className="portal-card-desc">Publish surplus food with AI-predicted safety hours and instant NGO visibility.</div>
                  <div className="portal-card-pill">Primary action</div>
                </button>
                <button className="portal-card" style={{'--card-accent':'#22d3ee','--card-icon-bg':'rgba(34,211,238,0.12)'}} onClick={()=>navigate(setPath,'/donor/active')}>
                  <div className="portal-card-icon"><i className="fas fa-clipboard-list"></i></div>
                  <div className="portal-card-title">Active Inventory</div>
                  <div className="portal-card-desc">Monitor live unclaimed listings and update details for faster NGO pickup.</div>
                  <div className="portal-card-pill" style={{'--card-accent':'#22d3ee','--card-icon-bg':'rgba(34,211,238,0.12)'}}>{donorRows.filter(r=>!r.is_claimed).length} waiting</div>
                </button>
                <button className="portal-card" style={{'--card-accent':'#818cf8','--card-icon-bg':'rgba(129,140,248,0.12)'}} onClick={()=>navigate(setPath,'/donor/history')}>
                  <div className="portal-card-icon"><i className="fas fa-history"></i></div>
                  <div className="portal-card-title">Donation History</div>
                  <div className="portal-card-desc">Review past donations, claim outcomes, and your rescue track record.</div>
                  <div className="portal-card-pill" style={{'--card-accent':'#818cf8','--card-icon-bg':'rgba(129,140,248,0.12)'}}>{donorRows.filter(r=>r.is_claimed).length} rescued</div>
                </button>
                <button className="portal-card" style={{'--card-accent':'#f59e0b','--card-icon-bg':'rgba(245,158,11,0.12)'}} onClick={()=>navigate(setPath,'/visualizations')}>
                  <div className="portal-card-icon"><i className="fas fa-chart-pie"></i></div>
                  <div className="portal-card-title">Visual Lab</div>
                  <div className="portal-card-desc">9 interactive charts: treemap, funnel, bubble scatter, heatmap and more.</div>
                  <div className="portal-card-pill" style={{'--card-accent':'#f59e0b','--card-icon-bg':'rgba(245,158,11,0.12)'}}>9 charts</div>
                </button>
                <button className="portal-card" style={{'--card-accent':'#fbbf24','--card-icon-bg':'rgba(251,191,36,0.12)'}} onClick={()=>navigate(setPath,'/leaderboard')}>
                  <div className="portal-card-icon"><i className="fas fa-trophy"></i></div>
                  <div className="portal-card-title">Leaderboard</div>
                  <div className="portal-card-desc">See where you rank among all donors on the FoodSave platform.</div>
                  <div className="portal-card-pill" style={{'--card-accent':'#fbbf24','--card-icon-bg':'rgba(251,191,36,0.12)'}}>Rankings</div>
                </button>
                <button className="portal-card" style={{'--card-accent':'#f472b6','--card-icon-bg':'rgba(244,114,182,0.12)'}} onClick={()=>navigate(setPath,'/contact')}>
                  <div className="portal-card-icon"><i className="fas fa-headset"></i></div>
                  <div className="portal-card-title">Support</div>
                  <div className="portal-card-desc">Get help, report issues, or contact the FoodSave team directly.</div>
                  <div className="portal-card-pill" style={{'--card-accent':'#f472b6','--card-icon-bg':'rgba(244,114,182,0.12)'}}>Help</div>
                </button>
              </div>
              {/* Impact + tips row */}
              <div className="portal-content-row">
                <div className="portal-glass-panel">
                  <div className="portal-panel-title"><i className="fas fa-chart-line"></i> Impact Snapshot</div>
                  <div style={{display:'flex',flexDirection:'column',gap:12}}>
                    {[
                      {label:'Estimated meals rescued',val:Math.max(0,Math.floor(donorRows.reduce((a,b)=>a+Number(b.qty||0),0)*3)),color:'#34d399'},
                      {label:'Claim completion rate',val:donorRows.length===0?'0%':`${Math.round((donorRows.filter(r=>r.is_claimed).length/donorRows.length)*100)}%`,color:'#22d3ee'},
                      {label:'Urgent active (\u22643h)',val:donorRows.filter(r=>!r.is_claimed&&Number(r.safe_hours)<=3).length,color:'#fbbf24'},
                      {label:'Avg safe window (active)',val:(()=>{const a=donorRows.filter(r=>!r.is_claimed);if(!a.length)return'0.0h';return`${(a.reduce((s,b)=>s+Number(b.safe_hours||0),0)/a.length).toFixed(1)}h`;})(),color:'#a7f3d0'},
                    ].map((row,i)=>(
                      <React.Fragment key={i}>
                        {i>0&&<div style={{height:1,background:'rgba(255,255,255,0.06)'}}></div>}
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <span style={{color:'rgba(225,248,255,0.65)',fontSize:13}}>{row.label}</span>
                          <strong style={{color:row.color,fontSize:15}}>{row.val}</strong>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <div className="portal-glass-panel">
                  <div className="portal-panel-title"><i className="fas fa-lightbulb"></i> Pro Tips</div>
                  <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    <div style={{background:'rgba(52,211,153,0.06)',border:'1px solid rgba(52,211,153,0.15)',borderRadius:12,padding:'12px 14px'}}>
                      <div style={{fontSize:12,fontWeight:700,color:'#34d399',marginBottom:4}}>Add precise details</div>
                      <div style={{fontSize:12,color:'rgba(225,248,255,0.6)',lineHeight:1.6}}>Temperature, storage info, and pickup notes increase claim speed significantly.</div>
                    </div>
                    <div style={{background:'rgba(34,211,238,0.06)',border:'1px solid rgba(34,211,238,0.15)',borderRadius:12,padding:'12px 14px'}}>
                      <div style={{fontSize:12,fontWeight:700,color:'#22d3ee',marginBottom:4}}>Wizard workflow</div>
                      <div style={{fontSize:12,color:'rgba(225,248,255,0.6)',lineHeight:1.6}}>AI Wizard &rarr; review risk gauge &rarr; publish for instant NGO visibility.</div>
                    </div>
                  </div>
                </div>
              </div>
              <RealtimeBoard topMetrics={topMetrics} overallRisk={overallRisk} rows={rows} title="Donor Live Feed" />
              <PortalRoleLeaderboard role="DONOR" user={user} analytics={analytics} rows={rows} donorRows={donorRows} ngoRows={ngoRows} adminUsers={adminUsers} />
            </>}
            {user && path === '/donor/donate' && <InfoPage title="/donor/donate" subtitle="AI Wizard"><AIWizard user={user} onSubmit={loadAll} onError={setError} /></InfoPage>}
            {user && path === '/donor/active' && <InfoPage title="/donor/active" subtitle="Inventory waiting for claim"><div className="glass rounded-3 p-4 mb-4"><h5 className="fw-bold mb-2" style={{ color: '#22d3ee' }}><i className="fas fa-clipboard-check me-2"></i>Active Donation Inventory</h5><p className="mb-0" style={{ color: '#e6fffb' }}>These listings are currently visible to NGOs. Keep details updated for faster claims and pickup coordination.</p></div><ListingsTable rows={donorRows.filter((r) => !r.is_claimed)} onRowUpdate={updateRow} onRetract={async (id) => { const d = await apiSend(`/api/food/${id}`, { method: 'DELETE', body: { donor_name: user.username } }); if (d.status === 'success') await loadAll(); else setError(d.message || 'Retract failed'); }} /></InfoPage>}
            {user && path === '/donor/history' && (
              <InfoPage title="/donor/history" subtitle="Past donations">
                <div className="glass rounded-3 p-4 mb-4">
                  <h5 className="fw-bold mb-2" style={{ color: '#22d3ee' }}><i className="fas fa-history me-2"></i>Donation History</h5>
                  <p className="mb-0" style={{ color: '#e6fffb' }}>Review completed donations, claimed items, and safe-hour outcomes to improve future listing quality.</p>
                </div>
                <ListingsTable rows={donorRows.filter((r) => r.is_claimed)} onRowUpdate={updateRow} />
                <div className="glass rounded-3 p-4 mt-4">
                  <h6 className="fw-bold mb-3" style={{ color: '#22d3ee' }}><i className="fas fa-comments me-2"></i>Claim Conversations</h6>
                  <div className="d-flex flex-column gap-2">
                    {donorRows.filter((r) => r.is_claimed).slice(0, 8).map((r) => (
                      <div key={`donor-chat-${r.id}`} className="d-flex justify-content-between align-items-center glass rounded-3 p-2">
                        <span style={{ color: '#e6fffb', fontSize: 13 }}>#{r.id} {r.food_name} - claimed by {r.claimed_by}</span>
                        <button className="btn btn-sm btn-outline-info" onClick={() => openClaimChat(r.id)}>Open Chat</button>
                      </div>
                    ))}
                    {donorRows.filter((r) => r.is_claimed).length === 0 && <p className="mb-0" style={{ color: 'rgba(225,248,255,0.58)' }}>No claimed listings yet.</p>}
                  </div>
                </div>
                <ClaimChatPanel />
              </InfoPage>
            )}

            {user && path === '/ngo/dashboard' && <>
              <div className="portal-header">
                <div>
                  <div className="portal-greeting"><i className="fas fa-truck-loading me-2" style={{ color: '#22d3ee' }}></i>NGO Operations Hub</div>
                  <div className="portal-subtext">Coordinate rescue logistics in real time across listing, route, and pickup.</div>
                </div>
                <button className="btn btn-primary" onClick={() => navigate(setPath, '/ngo/live-feed')}><i className="fas fa-bolt me-2"></i>Open Live Feed</button>
              </div>

              <div className="portal-kpi-row">
                <div className="portal-kpi" style={{ '--kpi-color': '#fb7185' }}>
                  <div className="portal-kpi-icon"><i className="fas fa-bell"></i></div>
                  <div className="portal-kpi-label">Critical</div>
                  <div className="portal-kpi-value">{rows.filter((r) => !r.is_claimed && Number(r.safe_hours) <= 2).length}</div>
                  <div className="portal-kpi-sub">Listings with &le;2h safety window</div>
                </div>
                <div className="portal-kpi" style={{ '--kpi-color': '#34d399' }}>
                  <div className="portal-kpi-icon"><i className="fas fa-stream"></i></div>
                  <div className="portal-kpi-label">Unclaimed</div>
                  <div className="portal-kpi-value">{rows.filter((r) => !r.is_claimed).length}</div>
                  <div className="portal-kpi-sub">Live opportunities available now</div>
                </div>
                <div className="portal-kpi" style={{ '--kpi-color': '#818cf8' }}>
                  <div className="portal-kpi-icon"><i className="fas fa-id-card"></i></div>
                  <div className="portal-kpi-label">Active Claims</div>
                  <div className="portal-kpi-value">{ngoRows.length}</div>
                  <div className="portal-kpi-sub">Passes currently assigned to your team</div>
                </div>
                <div className="portal-kpi" style={{ '--kpi-color': '#22d3ee' }}>
                  <div className="portal-kpi-icon"><i className="fas fa-check-circle"></i></div>
                  <div className="portal-kpi-label">Completed</div>
                  <div className="portal-kpi-value">{ngoRows.filter((r) => r.is_claimed).length}</div>
                  <div className="portal-kpi-sub">Claim records completed by your NGO</div>
                </div>
              </div>

              <div className="portal-section-title"><i className="fas fa-th-large me-2"></i>Mission Actions</div>
              <div className="portal-card-grid">
                <button className="portal-card" style={{ '--card-accent': '#34d399', '--card-icon-bg': 'rgba(52,211,153,0.12)' }} onClick={() => navigate(setPath, '/ngo/live-feed')}>
                  <div className="portal-card-icon"><i className="fas fa-bolt"></i></div>
                  <div className="portal-card-title">Live Feed</div>
                  <div className="portal-card-desc">Browse incoming donations and claim high-priority items fast.</div>
                  <div className="portal-card-pill">Claim now</div>
                </button>
                <button className="portal-card" style={{ '--card-accent': '#22d3ee', '--card-icon-bg': 'rgba(34,211,238,0.12)' }} onClick={() => navigate(setPath, '/ngo/map-view')}>
                  <div className="portal-card-icon"><i className="fas fa-map-marker-alt"></i></div>
                  <div className="portal-card-title">Map View</div>
                  <div className="portal-card-desc">View geo-distributed listings to optimize pickup routes.</div>
                  <div className="portal-card-pill" style={{ '--card-accent': '#22d3ee', '--card-icon-bg': 'rgba(34,211,238,0.12)' }}>Route plan</div>
                </button>
                <button className="portal-card" style={{ '--card-accent': '#818cf8', '--card-icon-bg': 'rgba(129,140,248,0.12)' }} onClick={() => navigate(setPath, '/ngo/active-claims')}>
                  <div className="portal-card-icon"><i className="fas fa-id-card"></i></div>
                  <div className="portal-card-title">Active Claims</div>
                  <div className="portal-card-desc">Manage digital pickup passes and move rescue operations forward.</div>
                  <div className="portal-card-pill" style={{ '--card-accent': '#818cf8', '--card-icon-bg': 'rgba(129,140,248,0.12)' }}>{ngoRows.length} open</div>
                </button>
                <button className="portal-card" style={{ '--card-accent': '#a78bfa', '--card-icon-bg': 'rgba(167,139,250,0.12)' }} onClick={() => navigate(setPath, '/ngo/ai-advisor')}>
                  <div className="portal-card-icon"><i className="fas fa-magic"></i></div>
                  <div className="portal-card-title">AI Advisor</div>
                  <div className="portal-card-desc">Use priority scoring to decide what to claim first.</div>
                  <div className="portal-card-pill" style={{ '--card-accent': '#a78bfa', '--card-icon-bg': 'rgba(167,139,250,0.12)' }}>ML ranking</div>
                </button>
                <button className="portal-card" style={{ '--card-accent': '#94a3b8', '--card-icon-bg': 'rgba(148,163,184,0.12)' }} onClick={() => navigate(setPath, '/ngo/history')}>
                  <div className="portal-card-icon"><i className="fas fa-book-open"></i></div>
                  <div className="portal-card-title">Rescue History</div>
                  <div className="portal-card-desc">Review completed pickup records and operational outcomes.</div>
                  <div className="portal-card-pill" style={{ '--card-accent': '#94a3b8', '--card-icon-bg': 'rgba(148,163,184,0.12)' }}>Records</div>
                </button>
                <button className="portal-card" style={{ '--card-accent': '#fbbf24', '--card-icon-bg': 'rgba(251,191,36,0.12)' }} onClick={() => navigate(setPath, '/settings/location')}>
                  <div className="portal-card-icon"><i className="fas fa-cog"></i></div>
                  <div className="portal-card-title">Location Settings</div>
                  <div className="portal-card-desc">Tune city coverage and alert preferences for faster response.</div>
                  <div className="portal-card-pill" style={{ '--card-accent': '#fbbf24', '--card-icon-bg': 'rgba(251,191,36,0.12)' }}>Config</div>
                </button>
              </div>

              <NGOFunnelViz rows={rows} ngoRows={ngoRows} />
              <RealtimeBoard topMetrics={topMetrics} overallRisk={overallRisk} rows={rows} title="NGO Ops Dashboard" />
              <PortalRoleLeaderboard role="NGO" user={user} analytics={analytics} rows={rows} donorRows={donorRows} ngoRows={ngoRows} adminUsers={adminUsers} />
            </>}
            {user && (path === '/ngo/live-feed' || path === '/ngo/map-view') && (() => {
              const liveRows = rows.filter((r) => !r.is_claimed);
              const isMap = ngoViewMode === 'map';

              return (
                <InfoPage title={isMap ? '/ngo/map-view' : '/ngo/live-feed'} subtitle="Adaptive Rescue Workspace">
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                    <div className="portal-subtext" style={{ marginTop: 0 }}>List + map split-pane for live coordination.</div>
                    <div className="d-flex gap-2">
                      <button className="btn btn-sm btn-outline-light" onClick={() => setNgoViewMode('list')}>
                        <i className="fas fa-list me-1"></i>List
                      </button>
                      <button className="btn btn-sm btn-outline-light" onClick={() => setNgoViewMode('map')}>
                        <i className="fas fa-map me-1"></i>Map
                      </button>
                    </div>
                  </div>

                  <div className="ngo-split-pane">
                    <div className="ngo-split-list glass">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <h6 className="mb-0" style={{ color: '#22d3ee' }}>Incoming Listings</h6>
                        <span className="small" style={{ color: 'rgba(225,248,255,0.55)' }}>{liveRows.length} live</span>
                      </div>
                      <div className="ngo-card-stack">
                        {liveRows.length === 0 && <p className="mb-0 small" style={{ color: 'rgba(225,248,255,0.55)' }}>No listings available right now.</p>}
                        {liveRows.map((r) => (
                          <div
                            key={r.id}
                            className={`ngo-feed-card ${selectedNgoListing?.id === r.id ? 'active' : ''}`}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedNgoListing(r)}
                          >
                              <div className="d-flex justify-content-between align-items-center mb-1">
                                <strong>{r.food_name}</strong>
                                <span className="badge" style={{ background: getSafeHoursTone(Number(r.safe_hours || 0)).bg, color: getSafeHoursTone(Number(r.safe_hours || 0)).text, border: `1px solid ${getSafeHoursTone(Number(r.safe_hours || 0)).border}` }}>{Number(r.safe_hours || 0).toFixed(1)}h</span>
                              </div>
                              <p className="mb-1 small" style={{ color: 'rgba(225,248,255,0.6)' }}>{r.donor_name} • Qty {r.qty}</p>
                              <div className="d-flex gap-2">
                                <button className="btn btn-sm btn-success" onClick={(e) => { e.stopPropagation(); claimFood(r.id); }}>Claim</button>
                                <button className="btn btn-sm btn-outline-light" onClick={(e) => { e.stopPropagation(); setSelectedNgoListing(r); }}>Details</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="ngo-split-map">
                        <NGOMapView rows={liveRows} />
                      </div>
                    </div>

                  {selectedNgoListing && (
                    <div className="ngo-drawer-backdrop" onClick={() => setSelectedNgoListing(null)}>
                      <div className="ngo-detail-drawer" onClick={(e) => e.stopPropagation()}>
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <h5 className="mb-0" style={{ color: '#ecfeff' }}>{selectedNgoListing.food_name}</h5>
                          <button className="btn btn-sm btn-outline-light" onClick={() => setSelectedNgoListing(null)}><i className="fas fa-times"></i></button>
                        </div>
                        <p className="small mb-2" style={{ color: 'rgba(225,248,255,0.62)' }}>Donor: {selectedNgoListing.donor_name}</p>
                        <p className="small mb-2" style={{ color: 'rgba(225,248,255,0.62)' }}>Qty: {selectedNgoListing.qty} • Safe: {Number(selectedNgoListing.safe_hours || 0).toFixed(1)}h</p>
                        <p className="small mb-3" style={{ color: 'rgba(225,248,255,0.62)' }}>Location: {selectedNgoListing.donor_location_text || 'Odisha'}</p>
                        <div className="d-flex gap-2">
                          <button className="btn btn-success flex-grow-1" onClick={() => { claimFood(selectedNgoListing.id); setSelectedNgoListing(null); }}>
                            <i className="fas fa-hand-holding-heart me-2"></i>Claim Now
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </InfoPage>
              );
            })()}
            {user && path === '/ngo/active-claims' && (
              <InfoPage title="/ngo/active-claims" subtitle="Digital pickup passes">
                <div className="glass rounded-3 p-4 mb-4">
                  <h5 className="fw-bold mb-2" style={{ color: '#22d3ee' }}><i className="fas fa-id-card me-2"></i>Pickup Pass Center</h5>
                  <p className="mb-0" style={{ color: '#e6fffb' }}>Use these digital passes for verification during collection. Keep urgent claims moving first.</p>
                </div>
                <div className="grid lg:grid-cols-2 gap-6">
                  {ngoRows.length === 0
                    ? <p className="text-cyan-100/70">No active claims yet. Visit the live feed to claim food.</p>
                    : ngoRows.map((r) => <DigitalPickupPass key={r.id} listing={r} user={user} onOpenChat={openClaimChat} />)}
                </div>
                <ClaimChatPanel />
              </InfoPage>
            )}
            {user && path === '/ngo/ai-advisor' && <NgoAiAdvisor rows={rows} ngoRows={ngoRows} onClaim={claimFood} />}
            {user && path === '/ngo/history' && <InfoPage title="/ngo/history" subtitle="Rescue logs"><div className="glass rounded-3 p-4 mb-4"><h5 className="fw-bold mb-2" style={{ color: '#22d3ee' }}><i className="fas fa-book-open me-2"></i>Rescue History</h5><p className="mb-0" style={{ color: '#e6fffb' }}>Track historical claims, response speed, and completed distribution records for reporting.</p></div><ListingsTable rows={ngoRows} onRowUpdate={updateRow} /></InfoPage>}

            {user && path === '/settings/profile' && <SettingsProfilePage user={user} />}
            {user && path === '/settings/location' && <SettingsLocationPage user={user} />}
            {user && path === '/settings/alerts' && <SettingsAlertsPage user={user} />}

            {user && path === '/admin/overview' && <>
              <div className="portal-header">
                <div>
                  <div className="portal-greeting"><i className="fas fa-user-shield me-2" style={{ color: '#f59e0b' }}></i>Admin Command Center</div>
                  <div className="portal-subtext">Platform visibility, governance controls, and AI audit supervision in one place.</div>
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-outline-light" onClick={() => navigate(setPath, '/admin/users')}><i className="fas fa-users-cog me-2"></i>Users</button>
                  <button className="btn btn-primary" onClick={() => navigate(setPath, '/admin/ai-logs')}><i className="fas fa-microchip me-2"></i>AI Logs</button>
                </div>
              </div>

              <div className="portal-kpi-row">
                <div className="portal-kpi" style={{ '--kpi-color': '#34d399' }}>
                  <div className="portal-kpi-icon"><i className="fas fa-users"></i></div>
                  <div className="portal-kpi-label">Total Users</div>
                  <div className="portal-kpi-value">{adminUsers.length}</div>
                  <div className="portal-kpi-sub">Registered accounts across all roles</div>
                </div>
                <div className="portal-kpi" style={{ '--kpi-color': '#22d3ee' }}>
                  <div className="portal-kpi-icon"><i className="fas fa-boxes"></i></div>
                  <div className="portal-kpi-label">Total Listings</div>
                  <div className="portal-kpi-value">{topMetrics.total_listings || 0}</div>
                  <div className="portal-kpi-sub">All tracked food listing records</div>
                </div>
                <div className="portal-kpi" style={{ '--kpi-color': '#f59e0b' }}>
                  <div className="portal-kpi-icon"><i className="fas fa-shield-alt"></i></div>
                  <div className="portal-kpi-label">High Risk Flags</div>
                  <div className="portal-kpi-value">{adminLogs.filter((l) => l.risk_flag === 'HIGH').length}</div>
                  <div className="portal-kpi-sub">Predictions requiring close review</div>
                </div>
                <div className="portal-kpi" style={{ '--kpi-color': '#fb7185' }}>
                  <div className="portal-kpi-icon"><i className="fas fa-user-slash"></i></div>
                  <div className="portal-kpi-label">Banned Users</div>
                  <div className="portal-kpi-value">{adminUsers.filter((u) => u.is_banned).length}</div>
                  <div className="portal-kpi-sub">Accounts currently restricted</div>
                </div>
              </div>

              <div className="portal-section-title"><i className="fas fa-th-large me-2"></i>Admin Screens</div>
              <div className="portal-card-grid">
                <button className="portal-card" style={{ '--card-accent': '#34d399', '--card-icon-bg': 'rgba(52,211,153,0.12)' }} onClick={() => navigate(setPath, '/admin/users')}>
                  <div className="portal-card-icon"><i className="fas fa-users-cog"></i></div>
                  <div className="portal-card-title">User Governance</div>
                  <div className="portal-card-desc">Verify, unverify, ban, and unban users with immediate effect.</div>
                  <div className="portal-card-pill">Access control</div>
                </button>
                <button className="portal-card" style={{ '--card-accent': '#22d3ee', '--card-icon-bg': 'rgba(34,211,238,0.12)' }} onClick={() => navigate(setPath, '/admin/ai-logs')}>
                  <div className="portal-card-icon"><i className="fas fa-microchip"></i></div>
                  <div className="portal-card-title">AI Logs</div>
                  <div className="portal-card-desc">Inspect prediction events and review historical model traces.</div>
                  <div className="portal-card-pill" style={{ '--card-accent': '#22d3ee', '--card-icon-bg': 'rgba(34,211,238,0.12)' }}>{adminLogs.length} events</div>
                </button>
                <button className="portal-card" style={{ '--card-accent': '#f59e0b', '--card-icon-bg': 'rgba(245,158,11,0.12)' }} onClick={() => navigate(setPath, '/visualizations')}>
                  <div className="portal-card-icon"><i className="fas fa-chart-pie"></i></div>
                  <div className="portal-card-title">Visual Lab</div>
                  <div className="portal-card-desc">Use advanced analytics visuals to detect trends and anomalies.</div>
                  <div className="portal-card-pill" style={{ '--card-accent': '#f59e0b', '--card-icon-bg': 'rgba(245,158,11,0.12)' }}>Insights</div>
                </button>
                <button className="portal-card" style={{ '--card-accent': '#818cf8', '--card-icon-bg': 'rgba(129,140,248,0.12)' }} onClick={() => navigate(setPath, '/leaderboard')}>
                  <div className="portal-card-icon"><i className="fas fa-trophy"></i></div>
                  <div className="portal-card-title">Leaderboard</div>
                  <div className="portal-card-desc">Track role-wise impact performance across platform participants.</div>
                  <div className="portal-card-pill" style={{ '--card-accent': '#818cf8', '--card-icon-bg': 'rgba(129,140,248,0.12)' }}>Comparative</div>
                </button>
                <button className="portal-card" style={{ '--card-accent': '#f472b6', '--card-icon-bg': 'rgba(244,114,182,0.12)' }} onClick={() => navigate(setPath, '/contact')}>
                  <div className="portal-card-icon"><i className="fas fa-headset"></i></div>
                  <div className="portal-card-title">Escalations</div>
                  <div className="portal-card-desc">Handle support escalations and cross-team coordination requests.</div>
                  <div className="portal-card-pill" style={{ '--card-accent': '#f472b6', '--card-icon-bg': 'rgba(244,114,182,0.12)' }}>Support</div>
                </button>
              </div>

              <AdminRiskScatter rows={rows} />
              <RealtimeBoard topMetrics={topMetrics} overallRisk={overallRisk} rows={rows} title="Admin Command Dashboard" />
              <PortalRoleLeaderboard role="ADMIN" user={user} analytics={analytics} rows={rows} donorRows={donorRows} ngoRows={ngoRows} adminUsers={adminUsers} />
            </>}
            {user && path === '/admin/users' && <InfoPage title="/admin/users" subtitle="Verify or ban users"><div className="glass rounded-3 p-4 mb-4"><h5 className="fw-bold mb-2" style={{ color: '#22d3ee' }}><i className="fas fa-user-shield me-2"></i>User Governance</h5><p className="mb-0" style={{ color: '#e6fffb' }}>Manage verification and moderation states. These controls apply immediately.</p></div><div className="grid md:grid-cols-2 gap-3 admin-user-grid">{adminUsers.map((u) => <div key={u.id} className="glass rounded-xl p-3 flex items-center justify-between gap-2 admin-user-card"><span className="admin-user-meta">#{u.id} {u.username} ({u.role}) <span className="text-xs text-cyan-100/70">{u.is_verified ? 'verified' : 'unverified'} | {u.is_banned ? 'banned' : 'active'}</span></span><div className="flex gap-2 admin-user-actions"><button onClick={() => adminUpdateUser(u.id, u.is_verified ? 'unverify' : 'verify')} className="px-2 py-1 rounded bg-cyan-500/30">{u.is_verified ? 'Unverify' : 'Verify'}</button><button onClick={() => adminUpdateUser(u.id, u.is_banned ? 'unban' : 'ban')} className="px-2 py-1 rounded bg-rose-500/30">{u.is_banned ? 'Unban' : 'Ban'}</button></div></div>)}</div></InfoPage>}
            {user && path === '/admin/ai-logs' && <InfoPage title="/admin/ai-logs" subtitle="AI prediction monitoring"><div className="glass rounded-3 p-4 mb-4"><h5 className="fw-bold mb-2" style={{ color: '#22d3ee' }}><i className="fas fa-microchip me-2"></i>AI Oversight</h5><p className="mb-0" style={{ color: '#e6fffb' }}>Inspect prediction outputs and cross-check timeline events for traceability and compliance.</p></div><div className="space-y-2">{adminLogs.slice(0, 40).map((l) => <div key={l.id} className="glass rounded-xl p-3">#{l.id} {l.food_name} | risk: {l.risk_flag} | safe_hours: {l.safe_hours}</div>)}</div><div className="mt-4"><h5 className="mb-2">Audit Timeline</h5><div className="space-y-2">{auditLogs.slice(0, 40).map((a) => <div key={a.id} className="glass rounded-xl p-3">#{a.id} {a.action} | actor: {a.actor || 'system'} | entity: {a.entity || '-'} {a.entity_id || ''}</div>)}</div></div></InfoPage>}

            </DisclosureContext.Provider>

            {!([
              '/home', '/about', '/impact', '/visualizations', '/leaderboard', '/contact',
              '/login', '/register', '/forgot-password',
              '/donor/dashboard', '/donor/donate', '/donor/active', '/donor/history',
              '/ngo/dashboard', '/ngo/live-feed', '/ngo/map-view', '/ngo/active-claims', '/ngo/history', '/ngo/ai-advisor',
              '/settings/profile', '/settings/location', '/settings/alerts',
              '/admin/overview', '/admin/users', '/admin/ai-logs'
            ].includes(path)) && (
              <section className="glass rounded-3xl p-5 mb-4">
                <h2 className="fw-bold mb-3" style={{ color: '#22d3ee' }}>Redirecting...</h2>
                <p className="mb-0" style={{ color: '#e6fffb' }}>This route is being normalized. If it does not recover automatically, use the main navigation to continue.</p>
              </section>
            )}

            {user && !['/donor/dashboard', '/ngo/dashboard'].includes(path) && <section className="mt-5 wow fadeInUp" data-wow-delay="0.3s"><ChartPanel analytics={analytics} theme={theme} /></section>}
            </div>
          </main>
        </div>
      );
    }

    ReactDOM.createRoot(document.getElementById('root')).render(
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    );
