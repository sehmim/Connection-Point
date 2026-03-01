window._sidebarCollapsed = false

window.renderSidebar = function() {
  const container = document.getElementById('sidebar-container')
  if (!container) return

  const workspaces = window._appState ? window._appState.workspaces : []
  const collapsed = window._sidebarCollapsed

  const w = collapsed ? '44px' : '185px'

  container.innerHTML = `
    <div id="sidebar" style="
      width: ${w};
      min-width: ${w};
      height: 100%;
      background: var(--bg-surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: width 0.2s ease, min-width 0.2s ease;
    ">

      <!-- Logo row -->
      <div style="
        padding: ${collapsed ? '0' : '16px 16px 12px'};
        height: 44px;
        display: flex; align-items: center;
        ${collapsed ? 'justify-content:center;' : 'gap: 8px; justify-content:space-between;'}
        flex-shrink: 0;
      ">
        ${collapsed ? '' : `
          <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
            <div style="width:8px; height:8px; border-radius:50%; background:var(--accent); flex-shrink:0;"></div>
            <span style="font-size:13px; font-weight:600; color:var(--text-primary); letter-spacing:-0.01em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Connection Point</span>
          </div>
        `}
        <!-- Collapse toggle -->
        <button onclick="window._toggleSidebar()" title="${collapsed ? 'Expand sidebar' : 'Collapse sidebar'}" style="
          width:26px; height:26px; border-radius:5px; flex-shrink:0;
          background:transparent; border:1px solid transparent;
          color:var(--text-muted); cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          transition:background 0.1s, border-color 0.1s, color 0.1s;
        "
          onmouseover="this.style.background='var(--bg-hover)';this.style.borderColor='var(--border)';this.style.color='var(--text-primary)'"
          onmouseout="this.style.background='transparent';this.style.borderColor='transparent';this.style.color='var(--text-muted)'"
        >
          <i data-lucide="${collapsed ? 'chevrons-right' : 'chevrons-left'}" style="width:14px; height:14px;"></i>
        </button>
      </div>

      <!-- Nav Items -->
      <nav style="padding: 4px ${collapsed ? '4px' : '8px'}; flex-shrink:0;">
        ${[
          { nav: 'overview',  icon: 'layout-dashboard', label: 'Overview'  },
        ].map(item => `
          <div
            class="nav-item"
            data-nav="${item.nav}"
            onclick="window._sidebarNavClick('${item.nav}')"
            title="${collapsed ? item.label : ''}"
            style="
              display: flex; align-items: center; gap: ${collapsed ? '0' : '8px'};
              padding: 7px ${collapsed ? '0' : '10px'}; border-radius: 6px; cursor: pointer;
              font-size: 13px; margin-bottom: 1px;
              border-left: 2px solid transparent;
              transition: background 0.1s;
              ${collapsed ? 'justify-content:center;' : ''}
            "
          >
            <i data-lucide="${item.icon}" style="width:15px; height:15px; flex-shrink:0;"></i>
            ${collapsed ? '' : `<span>${item.label}</span>`}
          </div>
        `).join('')}

        <div style="height:1px; background:var(--border-subtle); margin: 6px ${collapsed ? '4px' : '2px'};"></div>

        ${[
          { nav: 'all-items', icon: 'layout-list',      label: 'All Items' },
          { nav: 'jira',      icon: 'ticket',           label: 'Jira'      },
          { nav: 'github',    icon: 'git-pull-request', label: 'GitHub'    },
          { nav: 'calendar',  icon: 'calendar-days',    label: 'Calendar'  },
          { nav: 'chat',      icon: 'message-square',   label: 'Chat'      },
        ].map(item => `
          <div
            class="nav-item"
            data-nav="${item.nav}"
            onclick="window._sidebarNavClick('${item.nav}')"
            title="${collapsed ? item.label : ''}"
            style="
              display: flex; align-items: center; gap: ${collapsed ? '0' : '8px'};
              padding: 7px ${collapsed ? '0' : '10px'}; border-radius: 6px; cursor: pointer;
              font-size: 13px; margin-bottom: 1px;
              border-left: 2px solid transparent;
              transition: background 0.1s;
              ${collapsed ? 'justify-content:center;' : ''}
            "
          >
            <i data-lucide="${item.icon}" style="width:15px; height:15px; flex-shrink:0;"></i>
            ${collapsed ? '' : `<span>${item.label}</span>`}
          </div>
        `).join('')}
      </nav>

      ${collapsed ? `
        <!-- Collapsed spacer -->
        <div style="flex:1;"></div>

        <!-- Collapsed bottom icons -->
        <div style="padding:4px; border-top:1px solid var(--border-subtle); flex-shrink:0; display:flex; flex-direction:column; gap:2px;">
          <div onclick="window.navigate('onboarding')" title="Add Workspace" style="
            width:36px; height:36px; border-radius:6px; cursor:pointer;
            display:flex; align-items:center; justify-content:center;
            color:var(--text-muted); transition:background 0.1s; margin:0 auto;
          " onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='transparent'">
            <i data-lucide="plus" style="width:15px; height:15px;"></i>
          </div>
          <div onclick="window.navigate('settings')" title="Settings" style="
            width:36px; height:36px; border-radius:6px; cursor:pointer;
            display:flex; align-items:center; justify-content:center;
            color:var(--text-muted); transition:background 0.1s; margin:0 auto;
          " onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='transparent'">
            <i data-lucide="settings" style="width:15px; height:15px;"></i>
          </div>
          <div onclick="window._sidebarLogout()" title="Log out" style="
            width:36px; height:36px; border-radius:6px; cursor:pointer;
            display:flex; align-items:center; justify-content:center;
            color:var(--text-muted); transition:background 0.1s, color 0.1s; margin:0 auto;
          "
            onmouseover="this.style.background='var(--danger-muted)';this.style.color='var(--danger)'"
            onmouseout="this.style.background='transparent';this.style.color='var(--text-muted)'"
          >
            <i data-lucide="log-out" style="width:15px; height:15px;"></i>
          </div>
        </div>
      ` : `

        <!-- Spacer -->
        <div style="flex:1;"></div>

        <!-- Bottom actions -->
        <div style="padding:8px; border-top:1px solid var(--border-subtle); flex-shrink:0;">
          <div onclick="window.navigate('settings')" style="
            display:flex; align-items:center; gap:8px;
            padding:7px 10px; border-radius:6px; cursor:pointer;
            font-size:13px; color:var(--text-secondary);
            transition:background 0.1s;
          " onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='transparent'">
            <i data-lucide="settings" style="width:15px; height:15px; flex-shrink:0;"></i>
            <span>Settings</span>
          </div>
          <div onclick="window._sidebarLogout()" style="
            display:flex; align-items:center; gap:8px;
            padding:7px 10px; border-radius:6px; cursor:pointer;
            font-size:13px; color:var(--text-secondary);
            transition:background 0.1s, color 0.1s;
          "
            onmouseover="this.style.background='var(--danger-muted)';this.style.color='var(--danger)'"
            onmouseout="this.style.background='transparent';this.style.color='var(--text-secondary)'"
          >
            <i data-lucide="log-out" style="width:15px; height:15px; flex-shrink:0;"></i>
            <span>Log out</span>
          </div>
        </div>
      `}
    </div>
  `

  // Apply active state to current view
  const currentView = window._currentView || 'dashboard'
  window.updateSidebarActive(currentView)

  if (typeof lucide !== 'undefined') lucide.createIcons()
}

window._toggleSidebar = function() {
  window._sidebarCollapsed = !window._sidebarCollapsed
  window.renderSidebar()
}

window.updateSidebarActive = function(view) {
  window._currentView = view

  // Map view names to nav items
  const viewToNav = {
    overview:  'overview',
    dashboard: 'all-items',
    chat:      'chat'
  }
  const activeNav = viewToNav[view] || view

  // Also handle dashboard sub-views
  const dashView = window._appState && window._appState.dashboardView
  const subViewToNav = { jira: 'jira', github: 'github', calendar: 'calendar' }
  const finalActive = (view === 'dashboard' && dashView && subViewToNav[dashView])
    ? subViewToNav[dashView]
    : activeNav

  document.querySelectorAll('.nav-item').forEach(el => {
    const nav = el.getAttribute('data-nav')
    if (nav === finalActive) {
      el.style.borderLeft = '2px solid var(--accent)'
      el.style.color = 'var(--text-primary)'
      el.style.background = 'var(--bg-raised)'
    } else {
      el.style.borderLeft = '2px solid transparent'
      el.style.color = 'var(--text-secondary)'
      el.style.background = 'transparent'
    }
  })
}

window._sidebarNavClick = function(nav) {
  if (nav === 'overview') {
    window.navigate('overview')
    return
  }
  if (nav === 'chat') {
    window.navigate('chat')
    return
  }
  if (nav === 'calendar') {
    if (window._appState) window._appState.dashboardView = 'calendar'
    window.navigate('dashboard')
    return
  }
  // Map to dashboard sub-views
  const navMap = { 'all-items': 'all', 'jira': 'jira', 'github': 'github' }
  if (navMap[nav] !== undefined) {
    if (window._appState) window._appState.dashboardView = navMap[nav]
    window.navigate('dashboard')
  }
}

window._workspaceClick = function(name) {
  if (window._dashboardFilters) window._dashboardFilters.workspace = name
  window.navigate('dashboard')
}

window._sidebarLogout = function() {
  if (typeof window._authClearSession === 'function') window._authClearSession()
  // Reset in-memory state
  if (window._appState) {
    window._appState.workspaces = []
    window._appState.activeWorkspace = null
    window._appState.jiraItems = null
    window._appState.githubItems = null
    window._appState.calendarItems = null
  }
  if (window._fetchState) window._fetchState = {}
  window.navigate('auth')
  window.showToast('Signed out.', 'info')
}
