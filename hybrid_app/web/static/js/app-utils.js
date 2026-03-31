(function () {
  function normalizeRoutePath(rawPath) {
    const value = String(rawPath || '/').trim();
    if (value === '/' || value === '') return '/home';
    if (value.startsWith('/reset-password/')) return '/reset-password';
    const normalized = value.endsWith('/') ? value.slice(0, -1) : value;
    return normalized || '/home';
  }

  function getDefaultRouteForUser(user) {
    if (!user) return '/home';
    if (user.role === 'DONOR') return '/donor/dashboard';
    if (user.role === 'NGO') return '/ngo/dashboard';
    if (user.role === 'ADMIN') return '/admin/overview';
    return '/home';
  }

  function navigate(setPath, path) {
    const nextPath = normalizeRoutePath(path);
    const currentPath = normalizeRoutePath(window.location.pathname);
    if (currentPath === nextPath) return;

    const routeHost = document.getElementById('route-content');
    if (!routeHost) {
      window.history.pushState({}, '', nextPath);
      setPath(nextPath);
      return;
    }

    if (window.__fsRouteTransitionLock) {
      window.history.pushState({}, '', nextPath);
      setPath(nextPath);
      routeHost.classList.remove('route-exit');
      return;
    }
    window.__fsRouteTransitionLock = true;

    routeHost.classList.remove('route-enter');
    routeHost.classList.add('route-exit');

    window.setTimeout(() => {
      try {
        window.history.pushState({}, '', nextPath);
        setPath(nextPath);
      } finally {
        window.setTimeout(() => {
          window.__fsRouteTransitionLock = false;
          routeHost.classList.remove('route-exit');
        }, 40);
      }
    }, 140);
  }

  function isRouteActive(currentPath, targetPath) {
    const current = normalizeRoutePath(currentPath);
    const target = normalizeRoutePath(targetPath);
    return current === target || current.startsWith(`${target}/`);
  }

  function getToneVars(tone) {
    const palette = {
      neutral: {
        text: 'var(--mono-text-muted)',
        bg: 'var(--surface-elev-2)',
        border: 'var(--mono-border)',
      },
      success: {
        text: 'var(--theme-success)',
        bg: 'var(--theme-success-bg)',
        border: 'var(--theme-success-border)',
      },
      warning: {
        text: 'var(--theme-warning)',
        bg: 'var(--theme-warning-bg)',
        border: 'var(--theme-warning-border)',
      },
      danger: {
        text: 'var(--theme-danger)',
        bg: 'var(--theme-danger-bg)',
        border: 'var(--theme-danger-border)',
      },
      info: {
        text: 'var(--theme-info)',
        bg: 'var(--theme-info-bg)',
        border: 'var(--theme-info-border)',
      },
      rank2: {
        text: 'var(--theme-rank-2)',
        bg: 'var(--theme-rank-2-bg)',
        border: 'var(--theme-rank-2-border)',
      },
      rank3: {
        text: 'var(--theme-rank-3)',
        bg: 'var(--theme-rank-3-bg)',
        border: 'var(--theme-rank-3-border)',
      },
    };
    return palette[tone] || palette.neutral;
  }

  function getSafeHoursTone(hours) {
    if (hours <= 2) return getToneVars('danger');
    if (hours <= 5) return getToneVars('warning');
    return getToneVars('success');
  }

  function getRankTone(index) {
    if (index === 0) return getToneVars('warning');
    if (index === 1) return getToneVars('rank2');
    if (index === 2) return getToneVars('rank3');
    return getToneVars('info');
  }

  function buildMonotonicFunnelStages(stages) {
    let previousValue = Number.POSITIVE_INFINITY;
    return stages.map((stage) => {
      const rawValue = Math.max(0, Number(stage.value || 0));
      const value = Math.min(previousValue, rawValue);
      previousValue = value;
      return { ...stage, rawValue, value };
    });
  }

  window.FoodSaveUtils = {
    normalizeRoutePath,
    getDefaultRouteForUser,
    navigate,
    isRouteActive,
    getToneVars,
    getSafeHoursTone,
    getRankTone,
    buildMonotonicFunnelStages,
  };
})();
