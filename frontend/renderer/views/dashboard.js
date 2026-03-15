window._dashboardFilters = { search: '', type: 'all', status: 'all', workspace: 'all' }
window._selectedItem = null

window.renderDashboard = function() {
  const container = document.querySelector('[data-view="dashboard"]')
  if (!container) return

  const dashView = (window._appState && window._appState.dashboardView) || 'all'

  // Clear selection when switching between sub-views
  if (window._lastDashView && window._lastDashView !== dashView) window._selectedItem = null
  window._lastDashView = dashView

  // Log raw scraped data to console whenever the dashboard loads
  const raw = window._appState.rawScrapedData
  if (raw && Object.keys(raw).length > 0) {
    console.group('[dashboard] Raw scraped data')
    for (const [profilePath, services] of Object.entries(raw)) {
      console.group('Profile: ' + profilePath)
      for (const [service, result] of Object.entries(services)) {
        if (result.error) {
          console.warn(service + ' — error:', result.error)
        } else {
          console.log(service + ' — ' + result.count + ' item(s):', result.results || result)
        }
      }
      console.groupEnd()
    }
    console.groupEnd()
  }

  // Calendar view — load from DB if available, else mock
  if (dashView === 'calendar') {
    const loadCal = window.api && window.api.calendarGetData
      ? window.api.calendarGetData().then(data => {
          console.log('[Calendar] raw DB data:', data)
          if ((data.events || []).length > 0) {
            window._appState.calendarItems = data.events.map(e => ({
              id: e.id,
              title: e.title,
              start: e.start || '',
              end: e.end || '',
              date: (e.start || '').slice(0, 10),
              all_day: !!e.all_day,
              allDay: !!e.all_day,
              source: e.source || 'gcal',
              account: e.account || '',
              color: e.color || '#4285F4',
              profile: 'work',
            }))
            console.log('[Calendar] mapped calendarItems:', window._appState.calendarItems)
          } else {
            console.warn('[Calendar] no events in DB')
          }
        })
      : fetch('./mock/calendar.json').then(r => r.json()).then(data => { window._appState.calendarItems = data })
    loadCal.then(() => window._renderCalendarUI()).catch(err => {
      container.innerHTML = `<div style="padding:40px; color:var(--danger);">Failed to load calendar: ${err.message}</div>`
    })
    return
  }

  // GitHub tab: always load fresh from DB
  if (dashView === 'github' && window.api && window.api.githubGetData) {
    window.api.githubGetData().then(data => {
      console.group('[GitHub] DB data')
      const issues = data.items.filter(i => i.type === 'issue')
      const prs = data.items.filter(i => i.type === 'pr')
      if (issues.length) { console.log('Issues:'); console.table(issues.map(i => JSON.parse(i.raw_json))) }
      if (prs.length) { console.log('Pull Requests:'); console.table(prs.map(i => JSON.parse(i.raw_json))) }
      console.groupEnd()
      // Map DB rows to the shape _renderGithubTable expects
      window._appState.githubItems = data.items.map(row => {
        const raw = JSON.parse(row.raw_json)
        return {
          id: row.id,
          type: row.type,
          title: row.title,
          status: row.status || 'open',
          repo: row.repo,
          author: row.author,
          url: row.url,
          updatedAt: row.updated_at,
          labels: raw.labels || [],
          assignees: raw.assignees || [],
          source: 'github',
          profile: 'work',
        }
      })
      window._renderDashboardUI(dashView)
    }).catch(err => {
      console.warn('[GitHub] Failed to load DB data:', err)
      window._appState.githubItems = []
      window._renderDashboardUI(dashView)
    })
    return
  }

  // Jira tab: always load fresh from DB
  if (dashView === 'jira' && window.api && window.api.jiraGetData) {
    window.api.jiraGetData().then(data => {
      console.group('[Jira] DB data')
      console.table(data.items.map(i => ({ id: i.id, title: i.title, status: i.status, assignee: i.assignee, board_url: i.board_url })))
      console.groupEnd()
      window._appState.jiraItems = data.items.map(row => {
        const raw = row.raw_json ? JSON.parse(row.raw_json) : {}
        return {
          id: row.id,
          title: row.title,
          status: row.status || '',
          priority: row.priority || '',
          assignee: row.assignee || '',
          sprint: row.sprint || '',
          dueDate: row.due_date || '',
          url: row.url || '',
          board_url: row.board_url,
          source: 'jira',
          profile: 'work',
          _raw: raw,
        }
      })
      window._renderDashboardUI(dashView)
    }).catch(err => {
      console.warn('[Jira] Failed to load DB data:', err)
      window._appState.jiraItems = []
      window._renderDashboardUI(dashView)
    })
    return
  }

  // All other tabs: load mock data
  const loadData = (window._appState.jiraItems && window._appState.githubItems)
    ? Promise.resolve()
    : Promise.all([
        fetch('./mock/jira.json').then(r => r.json()),
        fetch('./mock/github.json').then(r => r.json())
      ]).then(([jira, github]) => {
        window._appState.jiraItems = jira
        window._appState.githubItems = github
      })

  loadData.then(() => {
    window._renderDashboardUI(dashView)
  }).catch(err => {
    container.innerHTML = `<div style="padding:40px; color:var(--danger);">Failed to load data: ${err.message}</div>`
  })
}

window._renderDashboardUI = function(dashView) {
  const container = document.querySelector('[data-view="dashboard"]')
  if (!container) return

  // Reset registry once at the top — briefing + table functions both add to it
  window._itemRegistry = {}

  const filters = window._dashboardFilters

  // Collect all workspaces for dropdown
  const allWorkspaces = [...new Set([
    ...(window._appState.jiraItems || []).map(i => i.workspace),
    ...(window._appState.githubItems || []).map(i => i.workspace)
  ])]

  // Filter + combine items
  let items = []
  if (dashView === 'all' || dashView === 'jira') {
    items = items.concat((window._appState.jiraItems || []).map(i => ({ ...i, source: 'jira' })))
  }
  if (dashView === 'all' || dashView === 'github') {
    items = items.concat((window._appState.githubItems || []).map(i => ({ ...i, source: 'github' })))
  }

  // Apply filters
  const activeProfile = window._briefingProfile || 'all'
  const allItems = items  // unfiltered — used for navbar badge counts
  if (activeProfile !== 'all') {
    items = items.filter(i => i.profile === activeProfile)
  }
  if (filters.search) {
    const q = filters.search.toLowerCase()
    items = items.filter(i =>
      (i.title || '').toLowerCase().includes(q) ||
      (i.id || String(i.id) || '').toLowerCase().includes(q) ||
      (i.repo || '').toLowerCase().includes(q)
    )
  }
  if (filters.type !== 'all') {
    if (filters.type === 'jira') items = items.filter(i => i.source === 'jira')
    else if (filters.type === 'github') items = items.filter(i => i.source === 'github')
    else items = items.filter(i => i.type === filters.type)
  }
  if (filters.status !== 'all') {
    items = items.filter(i => (i.status || '').toLowerCase() === filters.status.toLowerCase())
  }
  if (filters.workspace !== 'all') {
    items = items.filter(i => i.workspace === filters.workspace)
  }

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; height:100%; overflow:hidden;">

      <!-- Filter bar -->
      <div style="
        padding:12px 20px; background:var(--bg-surface);
        border-bottom:1px solid var(--border);
        display:flex; align-items:center; gap:10px; flex-shrink:0;
        flex-wrap:wrap;
      ">
        <!-- Search -->
        <div style="position:relative; flex:1; min-width:180px; max-width:300px;">
          <i data-lucide="search" style="
            position:absolute; left:10px; top:50%; transform:translateY(-50%);
            width:14px; height:14px; color:var(--text-muted); pointer-events:none;
          "></i>
          <input
            id="dash-search"
            type="text"
            placeholder="Search…"
            value="${filters.search}"
            oninput="window._dashFilterChange('search', this.value)"
            style="
              width:100%; box-sizing:border-box;
              background:var(--bg-raised); border:1px solid var(--border);
              border-radius:var(--radius); padding:7px 10px 7px 32px;
              font-size:13px; color:var(--text-primary);
              font-family:'IBM Plex Sans',sans-serif; outline:none;
              transition:border-color 0.15s;
            "
            onfocus="this.style.borderColor='var(--accent)'"
            onblur="this.style.borderColor='var(--border)'"
          />
        </div>

        <!-- Type dropdown -->
        <select
          onchange="window._dashFilterChange('type', this.value)"
          style="
            background:var(--bg-raised); border:1px solid var(--border);
            border-radius:var(--radius); padding:7px 10px;
            font-size:13px; color:var(--text-primary);
            font-family:'IBM Plex Sans',sans-serif; outline:none; cursor:pointer;
          "
        >
          <option value="all" ${filters.type === 'all' ? 'selected' : ''}>All Types</option>
          ${dashView === 'all' || dashView === 'jira' ? '<option value="jira" ' + (filters.type === 'jira' ? 'selected' : '') + '>Jira</option>' : ''}
          ${dashView === 'all' || dashView === 'github' ? '<option value="github" ' + (filters.type === 'github' ? 'selected' : '') + '>GitHub</option>' : ''}
          ${dashView === 'github' ? '<option value="pr" ' + (filters.type === 'pr' ? 'selected' : '') + '>Pull Request</option><option value="issue" ' + (filters.type === 'issue' ? 'selected' : '') + '>Issue</option>' : ''}
        </select>

        <!-- Status dropdown -->
        <select
          onchange="window._dashFilterChange('status', this.value)"
          style="
            background:var(--bg-raised); border:1px solid var(--border);
            border-radius:var(--radius); padding:7px 10px;
            font-size:13px; color:var(--text-primary);
            font-family:'IBM Plex Sans',sans-serif; outline:none; cursor:pointer;
          "
        >
          <option value="all" ${filters.status === 'all' ? 'selected' : ''}>All Statuses</option>
          <option value="Open" ${filters.status === 'Open' ? 'selected' : ''}>Open</option>
          <option value="In Progress" ${filters.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
          <option value="Review" ${filters.status === 'Review' ? 'selected' : ''}>Review</option>
          <option value="Done" ${filters.status === 'Done' ? 'selected' : ''}>Done</option>
          <option value="Merged" ${filters.status === 'Merged' ? 'selected' : ''}>Merged</option>
          <option value="Closed" ${filters.status === 'Closed' ? 'selected' : ''}>Closed</option>
        </select>

        <!-- Workspace dropdown -->
        <select
          onchange="window._dashFilterChange('workspace', this.value)"
          style="
            background:var(--bg-raised); border:1px solid var(--border);
            border-radius:var(--radius); padding:7px 10px;
            font-size:13px; color:var(--text-primary);
            font-family:'IBM Plex Sans',sans-serif; outline:none; cursor:pointer;
          "
        >
          <option value="all" ${filters.workspace === 'all' ? 'selected' : ''}>All Workspaces</option>
          ${allWorkspaces.map(w => `<option value="${w}" ${filters.workspace === w ? 'selected' : ''}>${w}</option>`).join('')}
        </select>

        <span style="font-size:12px; color:var(--text-muted); margin-left:4px;">${items.length} item${items.length !== 1 ? 's' : ''}</span>
      </div>

      <!-- Browser profile navbar -->
      ${window._renderProfileNavbar(allItems)}

      <!-- Table + detail panel -->
      <div style="flex:1; display:flex; overflow:hidden;">

        <!-- Table area -->
        <div id="dash-table-scroll" style="flex:1; overflow-y:auto; overflow-x:auto; display:flex; flex-direction:column;">
          ${items.length === 0
            ? `<div style="display:flex; align-items:center; justify-content:center; height:200px; color:var(--text-muted); font-size:14px;">No items match your filters.</div>`
            : dashView === 'jira'
              ? window._renderJiraTable(items)
              : dashView === 'github'
                ? window._renderGithubTable(items)
                : window._renderAllTable(items)
          }
        </div>

        <!-- Item detail panel -->
        ${window._renderDetailPanel(window._selectedItem)}
      </div>
    </div>
  `

  if (typeof lucide !== 'undefined') lucide.createIcons()
}

window._dashFilterChange = function(key, value) {
  window._dashboardFilters[key] = value
  window._selectedItem = null
  const dashView = (window._appState && window._appState.dashboardView) || 'all'
  window._renderDashboardUI(dashView)
}

window._itemRegistry = {}

// ── Drawer width state ────────────────────────────────────────────────────────
window._drawerWidth = null  // null = use default for item type

window._drawerDefaultWidth = function(sel) {
  if (!sel) return 0
  if (sel.source === 'github' && sel.type === 'pr') return 800
  if (sel.source === 'meeting') return 320
  return 520
}

window._renderDetailPanel = function(sel) {
  if (!sel) {
    return `<div id="item-detail-panel" style="width:0;min-width:0;overflow:hidden;display:flex;flex-shrink:0;position:relative;background:var(--bg-raised);"></div>`
  }
  const w = window._drawerWidth !== null ? window._drawerWidth : window._drawerDefaultWidth(sel)
  return `
    <div id="item-detail-panel" style="
      width:${w}px; min-width:${w}px;
      overflow:hidden;
      border-left:1px solid var(--border);
      background:var(--bg-raised);
      transition:none;
      display:flex; flex-shrink:0; position:relative;
    ">
      <div id="drawer-resize-handle" style="
        position:absolute; left:0; top:0; bottom:0; width:5px;
        cursor:col-resize; z-index:10;
        background:transparent; transition:background 0.15s;
      "
        onmouseover="this.style.background='var(--accent)44'"
        onmouseout="if(!window._drawerDragging)this.style.background='transparent'"
        onmousedown="window._drawerResizeStart(event)"
      ></div>
      <div style="flex:1;overflow:hidden;display:flex;">
        ${window._renderItemDetail(sel)}
      </div>
    </div>
  `
}

window._drawerDragging = false

window._drawerResizeStart = function(e) {
  e.preventDefault()
  window._drawerDragging = true
  const startX = e.clientX
  const panel = document.getElementById('item-detail-panel')
  const startW = panel ? panel.offsetWidth : window._drawerDefaultWidth(window._selectedItem)
  const MIN_W = 280
  const MAX_W = 900

  const onMove = (mv) => {
    const newW = Math.min(MAX_W, Math.max(MIN_W, startW + (startX - mv.clientX)))
    window._drawerWidth = newW
    if (panel) {
      panel.style.width = newW + 'px'
      panel.style.minWidth = newW + 'px'
    }
  }

  const onUp = () => {
    window._drawerDragging = false
    const handle = document.getElementById('drawer-resize-handle')
    if (handle) handle.style.background = 'transparent'
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

window._reRenderCurrentView = function() {
  const activeView = window._appState && window._appState._activeView
  if (activeView === 'overview') {
    window.renderOverview()
  } else {
    const dashView = (window._appState && window._appState.dashboardView) || 'all'
    window._renderDashboardUI(dashView)
  }
}

window._selectItem = function(uid) {
  const item = window._itemRegistry[uid]
  if (!item) return
  if (window._selectedItem && window._selectedItem._uid === uid) {
    window._selectedItem = null
    window._drawerWidth = null
  } else {
    const prevType = window._selectedItem && window._selectedItem.source
    if (prevType !== item.source) window._drawerWidth = null
    window._selectedItem = item
  }
  const scroll = document.getElementById('dash-table-scroll')
  const savedScroll = scroll ? scroll.scrollTop : 0
  window._reRenderCurrentView()
  const newScroll = document.getElementById('dash-table-scroll')
  if (newScroll) newScroll.scrollTop = savedScroll
}

// GitHub-specific select: open drawer with loading state, then fetch detail
window._selectGithubItem = function(uid) {
  const item = window._itemRegistry[uid]
  if (!item) return

  // Toggle off if same item clicked again
  if (window._selectedItem && window._selectedItem._uid === uid) {
    window._selectedItem = null
    window._drawerWidth = null
    const scroll = document.getElementById('dash-table-scroll')
    const saved = scroll ? scroll.scrollTop : 0
    window._reRenderCurrentView()
    const ns = document.getElementById('dash-table-scroll')
    if (ns) ns.scrollTop = saved
    return
  }

  const prevType = window._selectedItem && window._selectedItem.source
  if (prevType !== 'github') window._drawerWidth = null
  window._selectedItem = { ...item, _loading: true }

  const scroll = document.getElementById('dash-table-scroll')
  const saved = scroll ? scroll.scrollTop : 0
  window._reRenderCurrentView()
  const ns = document.getElementById('dash-table-scroll')
  if (ns) ns.scrollTop = saved

  // Fetch real detail from the issue/PR page
  window.api.githubScrapeDetail({ url: item.url, type: item.type })
    .then(function(detail) {
      window._selectedItem = { ...item, _detail: detail }
      const s2 = document.getElementById('dash-table-scroll')
      const sv2 = s2 ? s2.scrollTop : 0
      window._reRenderCurrentView()
      const ns2 = document.getElementById('dash-table-scroll')
      if (ns2) ns2.scrollTop = sv2
    })
    .catch(function(err) {
      console.warn('[drawer] detail fetch failed:', err)
      window._selectedItem = { ...item, _detail: null, _detailError: err.message }
      window._reRenderCurrentView()
    })
}

// Jira-specific select: open drawer with loading state, then fetch detail
window._selectJiraItem = function(uid) {
  const item = window._itemRegistry[uid]
  if (!item) return

  if (window._selectedItem && window._selectedItem._uid === uid) {
    window._selectedItem = null
    window._drawerWidth = null
    const scroll = document.getElementById('dash-table-scroll')
    const saved = scroll ? scroll.scrollTop : 0
    window._reRenderCurrentView()
    const ns = document.getElementById('dash-table-scroll')
    if (ns) ns.scrollTop = saved
    return
  }

  const prevType = window._selectedItem && window._selectedItem.source
  if (prevType !== 'jira') window._drawerWidth = null
  window._selectedItem = { ...item, _loading: true }

  const scroll = document.getElementById('dash-table-scroll')
  const saved = scroll ? scroll.scrollTop : 0
  window._reRenderCurrentView()
  const ns = document.getElementById('dash-table-scroll')
  if (ns) ns.scrollTop = saved

  if (!item.url) return

  window.api.jiraScrapeDetail({ url: item.url })
    .then(function(detail) {
      window._selectedItem = { ...item, _detail: detail }
      const s2 = document.getElementById('dash-table-scroll')
      const sv2 = s2 ? s2.scrollTop : 0
      window._reRenderCurrentView()
      const ns2 = document.getElementById('dash-table-scroll')
      if (ns2) ns2.scrollTop = sv2
    })
    .catch(function(err) {
      console.warn('[drawer] jira detail fetch failed:', err)
      window._selectedItem = { ...item, _detail: null, _detailError: err.message }
      window._reRenderCurrentView()
    })
}

window._closeItemDetail = function() {
  window._selectedItem = null
  window._drawerWidth = null
  const scroll = document.getElementById('dash-table-scroll')
  const savedScroll = scroll ? scroll.scrollTop : 0
  window._reRenderCurrentView()
  const newScroll = document.getElementById('dash-table-scroll')
  if (newScroll) newScroll.scrollTop = savedScroll
}

window._renderItemDetail = function(item) {
  if (!item) return ''
  if (item.source === 'meeting') return window._renderMeetingDetail(item)
  if (item.source === 'jira') return window._renderJiraDetail(item)
  if (item.type === 'pr')    return window._renderPRDetail(item)
  return window._renderGHIssueDetail(item)
}

// ── shared close button ──────────────────────────────────────────────────────
window._drawerCloseBtn = function() {
  return `<button onclick="window._closeItemDetail()" style="
    width:24px; height:24px; flex-shrink:0;
    background:transparent; border:1px solid var(--border);
    border-radius:var(--radius); cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    color:var(--text-muted); transition:border-color 0.15s, color 0.15s;
  " onmouseover="this.style.borderColor='var(--text-secondary)';this.style.color='var(--text-primary)'"
     onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-muted)'">
    <i data-lucide="x" style="width:11px; height:11px;"></i>
  </button>`
}

window._drawerMetaRow = function(label, value) {
  return `<div style="display:flex; align-items:center; gap:8px; min-height:22px;">
    <span style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; width:72px; flex-shrink:0;">${label}</span>
    <span style="font-size:13px; color:var(--text-secondary);">${value}</span>
  </div>`
}

window._drawerOpenLink = function(url, label) {
  const escaped = (url || '').replace(/'/g, "\\'")
  return `<button onclick="window.api.openExternal('${escaped}')" style="
    display:flex; align-items:center; justify-content:center; gap:6px;
    width:100%; padding:8px 12px; border-radius:var(--radius);
    background:var(--bg-raised); border:1px solid var(--border);
    color:var(--text-secondary); font-size:13px; font-weight:500;
    cursor:pointer; font-family:'IBM Plex Sans',sans-serif;
    transition:border-color 0.15s, color 0.15s;
  " onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'"
     onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-secondary)'">
    <i data-lucide="external-link" style="width:13px; height:13px;"></i>
    ${label}
  </button>`
}

// ── Jira issue detail ────────────────────────────────────────────────────────
window._renderJiraDetail = function(item) {
  if (item._loading) {
    return `
      <div style="width:100%; display:flex; flex-direction:column; height:100%; overflow-y:auto;">
        <div style="padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
            <div>
              <span style="font-size:11px; font-weight:600; color:#60a5fa; background:rgba(59,130,246,0.1); padding:2px 7px; border-radius:4px;">Jira</span>
              <div style="font-size:14px; font-weight:600; color:var(--text-primary); margin-top:6px;">${item.title}</div>
            </div>
            ${window._drawerCloseBtn()}
          </div>
          <div style="display:flex; align-items:center; gap:8px; color:var(--text-muted); font-size:13px; margin-top:24px;">
            <div style="width:14px;height:14px;border-radius:50%;border:2px solid var(--border);border-top-color:var(--accent);animation:spin 0.7s linear infinite;"></div>
            Fetching details…
          </div>
        </div>
      </div>`
  }

  const d = item._detail || {}
  const title = d.title || item.title
  const status = d.status || item.status || ''
  const priority = d.priority || item.priority || ''
  const assignee = d.assignee || item.assignee || '—'
  const reporter = d.reporter || '—'
  const sprint = d.sprint || item.sprint || '—'
  const dueDate = item.dueDate || '—'
  const labels = d.labels || []
  const description = d.description || ''
  const comments = d.comments || []

  return `
    <div style="width:100%; min-width:0; display:flex; flex-direction:column; height:100%; overflow-y:auto;">
      <div style="padding:16px 16px 0;">

        <!-- Header -->
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px; margin-bottom:12px;">
          <div style="flex:1; min-width:0;">
            <div style="margin-bottom:5px; display:flex; align-items:center; gap:6px;">
              <span style="font-size:11px; font-weight:600; color:#60a5fa; background:rgba(59,130,246,0.1); padding:2px 7px; border-radius:4px;">Jira</span>
              ${status ? window._statusBadge(status) : ''}
            </div>
            <div style="font-size:14px; font-weight:600; color:var(--text-primary); line-height:1.4; margin-bottom:3px;">${title}</div>
          </div>
          ${window._drawerCloseBtn()}
        </div>

        <div style="border-top:1px solid var(--border-subtle); margin-bottom:14px;"></div>

        <!-- Metadata -->
        <div style="display:flex; flex-direction:column; gap:9px; margin-bottom:16px;">
          ${priority ? window._drawerMetaRow('Priority',  window._priorityDot(priority)) : ''}
          ${window._drawerMetaRow('Assignee',  assignee)}
          ${window._drawerMetaRow('Reporter',  reporter)}
          ${sprint !== '—' ? window._drawerMetaRow('Sprint', sprint) : ''}
          ${dueDate !== '—' ? window._drawerMetaRow('Due', dueDate) : ''}
          ${labels.length ? window._drawerMetaRow('Labels', labels.map(l => `<span style="font-size:11px;background:var(--bg-raised);border:1px solid var(--border);border-radius:4px;padding:1px 6px;margin-right:3px;">${l}</span>`).join('')) : ''}
        </div>

        ${description ? `
          <div style="border-top:1px solid var(--border-subtle); margin-bottom:14px;"></div>
          <div style="margin-bottom:16px;">
            <div style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:8px;">Description</div>
            <div style="font-size:13px; color:var(--text-secondary); line-height:1.6; background:var(--bg-raised); border-radius:var(--radius); padding:10px 12px; white-space:pre-wrap; word-break:break-word;">
              ${description}
            </div>
          </div>
        ` : ''}

        ${comments.length ? `
          <div style="border-top:1px solid var(--border-subtle); margin-bottom:14px;"></div>
          <div style="margin-bottom:16px;">
            <div style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:10px;">Comments (${comments.length})</div>
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${comments.map(c => `
                <div style="background:var(--bg-raised); border:1px solid var(--border-subtle); border-radius:var(--radius); padding:9px 11px;">
                  <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:5px;">
                    <span style="font-size:12px; font-weight:600; color:var(--text-primary);">${c.user || '—'}</span>
                    ${c.date ? `<span style="font-size:11px; color:var(--text-muted);">${c.date}</span>` : ''}
                  </div>
                  <div style="font-size:12px; color:var(--text-secondary); line-height:1.5;">${c.body || ''}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${item._detailError ? `
          <div style="font-size:12px; color:var(--warning); margin-bottom:12px;">
            Could not fetch full details: ${item._detailError}
          </div>
        ` : ''}

        <div style="border-top:1px solid var(--border-subtle); margin-bottom:14px;"></div>
        ${item.url ? window._drawerOpenLink(item.url, 'Open in Jira') : ''}
        <div style="height:16px;"></div>
      </div>
    </div>
  `
}

// ── GitHub Issue detail ──────────────────────────────────────────────────────
window._renderGHIssueDetail = function(item) {
  if (item._loading) {
    return `
      <div style="width:100%; display:flex; flex-direction:column; height:100%; overflow-y:auto;">
        <div style="padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
            <div>
              <span style="font-size:11px; font-weight:600; color:#a78bfa; background:rgba(139,92,246,0.1); padding:2px 7px; border-radius:4px;">Issue</span>
              <div style="font-size:14px; font-weight:600; color:var(--text-primary); margin-top:6px;">${item.title}</div>
            </div>
            ${window._drawerCloseBtn()}
          </div>
          <div style="display:flex; align-items:center; gap:8px; color:var(--text-muted); font-size:13px; margin-top:24px;">
            <div style="width:14px;height:14px;border-radius:50%;border:2px solid var(--border);border-top-color:var(--accent);animation:spin 0.7s linear infinite;"></div>
            Fetching details…
          </div>
        </div>
      </div>`
  }

  const d = item._detail || {}
  const labels = (d.labels && d.labels.length) ? d.labels : (item.labels || [])
  const assignees = (d.assignees && d.assignees.length) ? d.assignees : (item.assignees || [])
  const comments = d.comments || []
  const author = d.author || item.author || '—'
  const state = d.state || item.status || '—'

  return `
    <div style="width:100%; min-width:0; display:flex; flex-direction:column; height:100%; overflow-y:auto;">
      <div style="padding:16px 16px 0;">

        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px; margin-bottom:12px;">
          <div style="flex:1; min-width:0;">
            <div style="margin-bottom:5px; display:flex; align-items:center; gap:6px;">
              <span style="font-size:11px; font-weight:600; color:#a78bfa; background:rgba(139,92,246,0.1); padding:2px 7px; border-radius:4px;">Issue</span>
              ${window._statusBadge(state)}
            </div>
            <div style="font-size:14px; font-weight:600; color:var(--text-primary); line-height:1.4; margin-bottom:3px;">${item.title}</div>
            <div style="font-size:12px; color:var(--text-muted); font-family:monospace;">${item.repo}#${item.number || item.id}</div>
          </div>
          ${window._drawerCloseBtn()}
        </div>

        <div style="border-top:1px solid var(--border-subtle); margin-bottom:14px;"></div>

        <div style="display:flex; flex-direction:column; gap:9px; margin-bottom:16px;">
          ${window._drawerMetaRow('Repo',      `<span style="font-family:monospace;font-size:12px;">${item.repo}</span>`)}
          ${window._drawerMetaRow('Author',    author)}
          ${window._drawerMetaRow('Updated',   item.updatedAt ? window.timeAgo(item.updatedAt) : '—')}
          ${assignees.length ? window._drawerMetaRow('Assignees', assignees.join(', ')) : ''}
          ${labels.length ? window._drawerMetaRow('Labels', labels.map(l =>
            `<span style="font-size:11px;padding:1px 7px;border-radius:10px;background:rgba(99,102,241,0.12);color:var(--accent);margin-right:4px;">${window._normGithubLabel(l)}</span>`
          ).join('')) : ''}
        </div>

        ${d.body ? `
          <div style="border-top:1px solid var(--border-subtle); margin-bottom:14px;"></div>
          <div style="margin-bottom:16px;">
            <div style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:8px;">Description</div>
            <div style="font-size:13px; color:var(--text-secondary); line-height:1.6; background:var(--bg-raised); border-radius:var(--radius); padding:10px 12px; max-height:200px; overflow-y:auto;">
              ${d.body}
            </div>
          </div>
        ` : ''}

        ${comments.length ? `
          <div style="border-top:1px solid var(--border-subtle); margin-bottom:14px;"></div>
          <div style="margin-bottom:16px;">
            <div style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:10px;">Comments · ${comments.length}</div>
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${comments.map(c => `
                <div style="display:flex; gap:9px;">
                  <div style="
                    width:26px; height:26px; border-radius:50%; flex-shrink:0;
                    background:var(--bg-hover); border:1px solid var(--border);
                    display:flex; align-items:center; justify-content:center;
                    font-size:11px; font-weight:600; color:var(--text-secondary);
                  ">${(c.user || '?')[0].toUpperCase()}</div>
                  <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                      <span style="font-size:12px; font-weight:600; color:var(--text-primary);">${c.user || '—'}</span>
                      <span style="font-size:11px; color:var(--text-muted);">${c.date ? window.timeAgo(c.date) : ''}</span>
                    </div>
                    <div style="font-size:12px; color:var(--text-secondary); line-height:1.5; background:var(--bg-raised); border-radius:var(--radius); padding:8px 10px;">${c.body || ''}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${item._detailError ? `<div style="font-size:12px;color:var(--danger);margin-bottom:12px;">Could not load details: ${item._detailError}</div>` : ''}

        <div style="border-top:1px solid var(--border-subtle); margin-bottom:14px;"></div>
        ${window._drawerOpenLink(item.url, 'Open in GitHub')}
        <div style="height:16px;"></div>
      </div>
    </div>
  `
}

// ── GitHub PR detail — split screen ─────────────────────────────────────────
window._renderPRDetail = function(item) {
  if (item._loading) {
    return `
      <div style="width:100%; display:flex; flex-direction:column; height:100%; overflow-y:auto;">
        <div style="padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
            <div>
              <span style="font-size:11px; font-weight:600; color:#818cf8; background:rgba(99,102,241,0.12); padding:2px 7px; border-radius:4px;">PR</span>
              <div style="font-size:14px; font-weight:600; color:var(--text-primary); margin-top:6px;">${item.title}</div>
            </div>
            ${window._drawerCloseBtn()}
          </div>
          <div style="display:flex; align-items:center; gap:8px; color:var(--text-muted); font-size:13px; margin-top:24px;">
            <div style="width:14px;height:14px;border-radius:50%;border:2px solid var(--border);border-top-color:var(--accent);animation:spin 0.7s linear infinite;"></div>
            Fetching details…
          </div>
        </div>
      </div>`
  }

  const d = item._detail || {}
  const labels = (d.labels && d.labels.length) ? d.labels : (item.labels || [])
  const assignees = (d.assignees && d.assignees.length) ? d.assignees : (item.assignees || [])
  const reviewers = d.reviewers || []
  const comments = d.comments || []
  const author = d.author || item.author || '—'
  const state = d.state || item.status || '—'

  return `
    <div style="width:100%; min-width:0; display:flex; flex-direction:column; height:100%; overflow-y:auto;">
      <div style="padding:16px 16px 0;">

        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px; margin-bottom:12px;">
          <div style="flex:1; min-width:0;">
            <div style="margin-bottom:5px; display:flex; align-items:center; gap:6px;">
              <span style="font-size:11px; font-weight:600; color:#818cf8; background:rgba(99,102,241,0.12); padding:2px 7px; border-radius:4px;">PR</span>
              ${window._statusBadge(state)}
            </div>
            <div style="font-size:14px; font-weight:600; color:var(--text-primary); line-height:1.4; margin-bottom:3px;">${item.title}</div>
            <div style="font-size:12px; color:var(--text-muted); font-family:monospace;">${item.repo}#${item.number || item.id}</div>
          </div>
          ${window._drawerCloseBtn()}
        </div>

        <div style="border-top:1px solid var(--border-subtle); margin-bottom:14px;"></div>

        <div style="display:flex; flex-direction:column; gap:9px; margin-bottom:16px;">
          ${window._drawerMetaRow('Repo',      `<span style="font-family:monospace;font-size:12px;">${item.repo}</span>`)}
          ${window._drawerMetaRow('Author',    author)}
          ${window._drawerMetaRow('Updated',   item.updatedAt ? window.timeAgo(item.updatedAt) : '—')}
          ${assignees.length ? window._drawerMetaRow('Assignees', assignees.join(', ')) : ''}
          ${reviewers.length ? window._drawerMetaRow('Reviewers', reviewers.join(', ')) : ''}
          ${labels.length ? window._drawerMetaRow('Labels', labels.map(l =>
            `<span style="font-size:11px;padding:1px 7px;border-radius:10px;background:rgba(99,102,241,0.12);color:var(--accent);margin-right:4px;">${window._normGithubLabel(l)}</span>`
          ).join('')) : ''}
          ${d.filesChanged ? window._drawerMetaRow('Files', d.filesChanged) : ''}
        </div>

        ${d.body ? `
          <div style="border-top:1px solid var(--border-subtle); margin-bottom:14px;"></div>
          <div style="margin-bottom:16px;">
            <div style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:8px;">Description</div>
            <div style="font-size:13px; color:var(--text-secondary); line-height:1.6; background:var(--bg-raised); border-radius:var(--radius); padding:10px 12px; max-height:200px; overflow-y:auto;">
              ${d.body}
            </div>
          </div>
        ` : ''}

        ${comments.length ? `
          <div style="border-top:1px solid var(--border-subtle); margin-bottom:14px;"></div>
          <div style="margin-bottom:16px;">
            <div style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:10px;">Comments · ${comments.length}</div>
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${comments.map(c => `
                <div style="display:flex; gap:9px;">
                  <div style="
                    width:26px; height:26px; border-radius:50%; flex-shrink:0;
                    background:var(--bg-hover); border:1px solid var(--border);
                    display:flex; align-items:center; justify-content:center;
                    font-size:11px; font-weight:600; color:var(--text-secondary);
                  ">${(c.user || '?')[0].toUpperCase()}</div>
                  <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                      <span style="font-size:12px; font-weight:600; color:var(--text-primary);">${c.user || '—'}</span>
                      <span style="font-size:11px; color:var(--text-muted);">${c.date ? window.timeAgo(c.date) : ''}</span>
                    </div>
                    <div style="font-size:12px; color:var(--text-secondary); line-height:1.5; background:var(--bg-raised); border-radius:var(--radius); padding:8px 10px;">${c.body || ''}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${item._detailError ? `<div style="font-size:12px;color:var(--danger);margin-bottom:12px;">Could not load details: ${item._detailError}</div>` : ''}

        <div style="border-top:1px solid var(--border-subtle); margin-bottom:14px;"></div>
        ${window._drawerOpenLink(item.url, 'Open in GitHub')}
        <div style="height:16px;"></div>
      </div>
    </div>
  `
}

window._statusBadge = function(status) {
  const map = {
    'Open': { bg: 'var(--accent-muted)', color: 'var(--accent)' },
    'In Progress': { bg: 'var(--accent-muted)', color: 'var(--accent)' },
    'Review': { bg: 'var(--warning-muted)', color: 'var(--warning)' },
    'Done': { bg: 'var(--success-muted)', color: 'var(--success)' },
    'Merged': { bg: 'var(--success-muted)', color: 'var(--success)' },
    'Closed': { bg: 'rgba(100,100,100,0.15)', color: 'var(--text-muted)' }
  }
  const s = map[status] || { bg: 'var(--bg-raised)', color: 'var(--text-secondary)' }
  return `<span style="
    background:${s.bg}; color:${s.color};
    border-radius:var(--radius-sm); font-size:11px;
    padding:2px 7px; white-space:nowrap; font-weight:500;
  ">${status}</span>`
}

window._normGithubLabel = function(label) {
  const map = {
    "something isn't working": 'bug',
    'improvements or additions to documentation': 'documentation',
  }
  return map[label.toLowerCase()] || label
}

window._typeBadge = function(type) {
  const map = {
    'pr': { bg: 'rgba(99,102,241,0.15)', color: '#818cf8' },
    'issue': { bg: 'rgba(239,68,68,0.12)', color: '#f87171' },
    'jira': { bg: 'rgba(59,130,246,0.12)', color: '#60a5fa' }
  }
  const s = map[type] || { bg: 'var(--bg-raised)', color: 'var(--text-secondary)' }
  const labels = { pr: 'PR', issue: 'Issue', jira: 'Jira' }
  return `<span style="
    background:${s.bg}; color:${s.color};
    border-radius:var(--radius-sm); font-size:11px;
    padding:2px 7px; white-space:nowrap; font-weight:500;
  ">${labels[type] || type}</span>`
}

window._priorityDot = function(priority) {
  const colors = { High: 'var(--danger)', Medium: 'var(--warning)', Low: 'var(--success)' }
  const c = colors[priority] || 'var(--text-muted)'
  return `<span title="${priority}" style="display:inline-flex; align-items:center; gap:5px;">
    <span style="width:8px; height:8px; border-radius:50%; background:${c}; display:inline-block;"></span>
    <span style="font-size:12px; color:var(--text-secondary);">${priority}</span>
  </span>`
}

window._workspaceDot = function(workspace) {
  // Find color from app state workspaces
  const ws = (window._appState.workspaces || []).find(w => w.name === workspace)
  const color = ws ? ws.color : 'var(--accent)'
  return `<span style="width:8px; height:8px; border-radius:50%; background:${color}; display:inline-block;" title="${workspace}"></span>`
}

window.timeAgo = function(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now - date
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor(diff / 3600000)
  const mins = Math.floor(diff / 60000)
  if (days > 30) return date.toLocaleDateString()
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (mins > 0) return `${mins}m ago`
  return 'just now'
}

const thStyle = `padding:10px 14px; text-align:left; font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; border-bottom:1px solid var(--border); white-space:nowrap; position:sticky; top:0; background:var(--bg-base); z-index:1;`
const tdStyle = `padding:10px 14px; font-size:13px; color:var(--text-primary); border-bottom:1px solid var(--border-subtle); vertical-align:middle;`

// ── Morning Briefing ──────────────────────────────────────────────────────────

// Browser profiles that appear in the briefing navbar
const _BRIEFING_PROFILES = [
  { id: 'work',     name: 'Work',     avatar: 'W', email: 'you@company.com',  color: '#6366f1' },
  { id: 'client-a', name: 'Client A', avatar: 'C', email: 'you@clienta.com', color: '#10b981' },
  { id: 'client-b', name: 'Client B', avatar: 'B', email: 'you@clientb.com', color: '#f59e0b' },
]

window._briefingProfile = 'all'

const _BRIEFING = {
  meetings: [
    { time: '09:30', duration: '30m', title: 'Daily Standup',         workspace: 'Client Alpha', wsColor: '#6366f1', source: 'gcal',    attendees: 4, profile: 'work'      },
    { time: '11:00', duration: '1h',  title: 'Q1 Roadmap Sync',       workspace: 'Client Alpha', wsColor: '#6366f1', source: 'gcal',    attendees: 7, profile: 'work'      },
    { time: '14:00', duration: '1h',  title: 'Stakeholder Update',    workspace: 'Client Beta',  wsColor: '#10b981', source: 'outlook', attendees: 5, profile: 'client-b'  },
    { time: '15:30', duration: '30m', title: '1:1 with Sarah K.',     workspace: 'Client Alpha', wsColor: '#6366f1', source: 'gcal',    attendees: 2, profile: 'client-a'  },
    { time: '16:30', duration: '1h',  title: 'Infrastructure Review', workspace: 'Client Beta',  wsColor: '#10b981', source: 'outlook', attendees: 3, profile: 'client-b'  },
  ],
  dueThisWeek: [
    { id: 'ALPHA-12', title: 'Auth flow — SSO integration',           workspace: 'Client Alpha', wsColor: '#6366f1', dueDate: '2026-03-01', source: 'jira',   status: 'In Progress', profile: 'work'     },
    { id: 'BETA-08',  title: 'Add GitHub auth to API calls',          workspace: 'Client Beta',  wsColor: '#10b981', dueDate: '2026-03-02', source: 'jira',   status: 'Open',        profile: 'client-b' },
    { id: 'ALPHA-16', title: 'Dashboard filter performance',          workspace: 'Client Alpha', wsColor: '#6366f1', dueDate: '2026-03-03', source: 'jira',   status: 'In Progress', profile: 'client-a' },
    { id: '#201',     title: 'Webhook retry logic',                   workspace: 'Client Beta',  wsColor: '#10b981', dueDate: '2026-03-04', source: 'github', status: 'Review',      profile: 'client-b' },
    { id: 'ALPHA-14', title: 'Fix payment gateway timeout on staging', workspace: 'Client Alpha', wsColor: '#6366f1', dueDate: '2026-03-05', source: 'jira',   status: 'In Progress', profile: 'work'    },
  ],
  waitingForYou: [
    { id: '#198',     title: 'JWT middleware refactor needs your approval', workspace: 'Client Alpha', wsColor: '#6366f1', source: 'github', waiting: '3 days', action: 'Review requested', profile: 'work'     },
    { id: 'ALPHA-11', title: 'Redis cache layer — blocked on your spec',    workspace: 'Client Alpha', wsColor: '#6366f1', source: 'jira',   waiting: '2 days', action: 'Awaiting input',   profile: 'client-a' },
    { id: '#203',     title: 'Sendgrid key rotation — PR open for merge',   workspace: 'Client Beta',  wsColor: '#10b981', source: 'github', waiting: '1 day',  action: 'Ready to merge',   profile: 'client-b' },
    { id: 'BETA-06',  title: 'CI config update — your sign-off needed',     workspace: 'Client Beta',  wsColor: '#10b981', source: 'jira',   waiting: '4 days', action: 'Awaiting approval', profile: 'client-b' },
  ],
  overdue: [
    { id: 'ALPHA-09', title: 'Deprecate legacy auth endpoints', workspace: 'Client Alpha', wsColor: '#6366f1', dueDate: '2026-02-24', source: 'jira', status: 'Open',        profile: 'work'     },
    { id: 'BETA-04',  title: 'Rate limiting on public API',     workspace: 'Client Beta',  wsColor: '#10b981', dueDate: '2026-02-26', source: 'jira', status: 'In Progress', profile: 'client-b' },
  ]
}

window._renderMeetingDetail = function(meeting) {
  if (!meeting) return ''
  const calColors = { gcal: '#4285F4', outlook: '#0078D4' }
  const color = calColors[meeting.source] || '#6366f1'
  const calLabel = meeting.source === 'gcal' ? 'Google Calendar' : 'Outlook Calendar'
  const calIcon = meeting.source === 'gcal'
    ? `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="4" width="12" height="10" rx="2" fill="none" stroke="#4285F4" stroke-width="1.5"/><path d="M5 2v4M11 2v4" stroke="#4285F4" stroke-width="1.5" stroke-linecap="round"/><path d="M2 8h12" stroke="#4285F4" stroke-width="1"/></svg>`
    : `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="4" width="12" height="10" rx="2" fill="none" stroke="#0078D4" stroke-width="1.5"/><path d="M5 2v4M11 2v4" stroke="#0078D4" stroke-width="1.5" stroke-linecap="round"/><path d="M2 8h12" stroke="#0078D4" stroke-width="1"/></svg>`

  const p = _BRIEFING_PROFILES.find(p => p.id === meeting.profile)

  // Parse duration for display
  const dH = meeting.duration.includes('h') ? parseFloat(meeting.duration) : parseFloat(meeting.duration) / 60
  const endH = (() => {
    const [h, m] = meeting.time.split(':').map(Number)
    const totalMins = h * 60 + m + dH * 60
    const eH = Math.floor(totalMins / 60)
    const eM = totalMins % 60
    return `${eH}:${eM.toString().padStart(2, '0')}`
  })()

  return `
    <div style="
      width:100%; min-width:0; height:100%; overflow-y:auto;
    ">
      <div style="padding:16px 16px 0;">

        <!-- Header -->
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:12px;">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
              <div style="width:10px;height:10px;border-radius:50%;background:${meeting.wsColor};flex-shrink:0;"></div>
              <span style="font-size:11px;color:var(--text-muted);">${meeting.workspace}</span>
            </div>
            <div style="font-size:14px;font-weight:600;color:var(--text-primary);line-height:1.4;margin-bottom:4px;">${meeting.title}</div>
            <div style="display:flex;align-items:center;gap:5px;">
              ${calIcon}
              <span style="font-size:11px;color:${color};">${calLabel}</span>
            </div>
          </div>
          ${window._drawerCloseBtn()}
        </div>

        <div style="border-top:1px solid var(--border-subtle);margin-bottom:14px;"></div>

        <!-- Time block -->
        <div style="
          display:flex;align-items:center;gap:10px;
          background:${color}12;border:1px solid ${color}30;
          border-radius:var(--radius);padding:10px 12px;margin-bottom:14px;
        ">
          <i data-lucide="clock" style="width:14px;height:14px;color:${color};flex-shrink:0;"></i>
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${meeting.time} – ${endH}</div>
            <div style="font-size:11px;color:var(--text-muted);">${meeting.duration} · Today</div>
          </div>
        </div>

        <!-- Metadata rows -->
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:8px;min-height:22px;">
            <span style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;width:72px;flex-shrink:0;">Calendar</span>
            <div style="display:flex;align-items:center;gap:5px;">
              ${calIcon}
              <span style="font-size:13px;color:var(--text-secondary);">${calLabel}</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;min-height:22px;">
            <span style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;width:72px;flex-shrink:0;">Attendees</span>
            <div style="display:flex;align-items:center;gap:5px;">
              <i data-lucide="users" style="width:13px;height:13px;color:var(--text-muted);"></i>
              <span style="font-size:13px;color:var(--text-secondary);">${meeting.attendees} people</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;min-height:22px;">
            <span style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;width:72px;flex-shrink:0;">Profile</span>
            ${p ? `<span style="
              display:inline-flex;align-items:center;gap:5px;
              font-size:12px;color:${p.color};font-weight:600;
              background:${p.color}18;border-radius:10px;padding:2px 8px;
            ">
              <span style="width:7px;height:7px;border-radius:50%;background:${p.color};display:inline-block;"></span>
              ${p.name}
            </span>` : '<span style="font-size:13px;color:var(--text-secondary);">—</span>'}
          </div>
          <div style="display:flex;align-items:center;gap:8px;min-height:22px;">
            <span style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;width:72px;flex-shrink:0;">Workspace</span>
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="width:8px;height:8px;border-radius:50%;background:${meeting.wsColor};display:inline-block;"></span>
              <span style="font-size:13px;color:var(--text-secondary);">${meeting.workspace}</span>
            </div>
          </div>
        </div>

        <div style="border-top:1px solid var(--border-subtle);margin-bottom:14px;"></div>

        <!-- Attendee avatars -->
        <div style="margin-bottom:16px;">
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">Attendees</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${['S', 'J', 'M', 'A', 'D', 'R', 'K'].slice(0, meeting.attendees).map((a, i) => {
              const colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899']
              return `<div style="
                width:28px;height:28px;border-radius:50%;
                background:${colors[i % colors.length]}22;
                border:1px solid ${colors[i % colors.length]}44;
                display:flex;align-items:center;justify-content:center;
                font-size:11px;font-weight:600;color:${colors[i % colors.length]};
              ">${a}</div>`
            }).join('')}
          </div>
        </div>

        <div style="border-top:1px solid var(--border-subtle);margin-bottom:14px;"></div>

        <!-- Join button -->
        <button style="
          width:100%;padding:9px 12px;
          background:${color};border:none;
          border-radius:var(--radius);cursor:pointer;
          font-size:13px;font-weight:600;color:#fff;
          font-family:'IBM Plex Sans',sans-serif;
          display:flex;align-items:center;justify-content:center;gap:6px;
          transition:opacity 0.15s;
        " onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
          <i data-lucide="video" style="width:14px;height:14px;"></i>
          Join Meeting
        </button>
        <div style="height:16px;"></div>
      </div>
    </div>
  `
}

window._briefingProfileClick = function(id) {
  window._briefingProfile = id
  const activeView = window._appState && window._appState._activeView
  if (activeView === 'overview') {
    window.renderOverview()
  } else if (activeView === 'chat') {
    window._renderChatUI()
  } else {
    const dashView = (window._appState && window._appState.dashboardView) || 'all'
    if (dashView === 'calendar') {
      window._renderCalendarUI()
    } else {
      window._renderDashboardUI(dashView)
    }
  }
}

window._renderProfileNavbar = function(countsSource) {
  const activeProfile = window._briefingProfile || 'all'

  const getCount = (profileId) => {
    if (countsSource) return countsSource.filter(i => i.profile === profileId).length
    return [_BRIEFING.meetings, _BRIEFING.dueThisWeek, _BRIEFING.waitingForYou, _BRIEFING.overdue]
      .reduce((sum, arr) => sum + arr.filter(i => i.profile === profileId).length, 0)
  }

  return ``

  // return `
  //   <div style="
  //     display:flex; align-items:center; gap:6px;
  //     padding:10px 20px; background:var(--bg-surface);
  //     border-bottom:1px solid var(--border);
  //     flex-shrink:0; overflow-x:auto;
  //   ">
  //     <!-- Chrome icon -->
  //     <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;margin-right:2px;">
  //       <circle cx="8" cy="8" r="3" fill="#4285F4"/>
  //       <path d="M8 5h6.5" stroke="#EA4335" stroke-width="2.5" stroke-linecap="round"/>
  //       <path d="M8 5 L1.75 11" stroke="#FBBC04" stroke-width="2.5" stroke-linecap="round"/>
  //       <path d="M14.5 8 Q13 13 8 11 Q3 9 1.75 11" stroke="#34A853" stroke-width="2.5" stroke-linecap="round" fill="none"/>
  //     </svg>

  //     <button onclick="window._briefingProfileClick('all')" style="
  //       display:flex; align-items:center; gap:5px;
  //       padding:4px 10px; border-radius:12px; cursor:pointer;
  //       font-size:12px; font-weight:600;
  //       font-family:'IBM Plex Sans',sans-serif;
  //       border:1px solid ${activeProfile === 'all' ? 'var(--accent)' : 'var(--border)'};
  //       background:${activeProfile === 'all' ? 'var(--accent-muted)' : 'transparent'};
  //       color:${activeProfile === 'all' ? 'var(--accent)' : 'var(--text-secondary)'};
  //       transition:all 0.1s; white-space:nowrap;
  //     ">
  //       <i data-lucide="layers" style="width:11px;height:11px;"></i>
  //       All Browsers
  //     </button>

  //     <div style="width:1px;height:16px;background:var(--border-subtle);flex-shrink:0;"></div>

  //     ${_BRIEFING_PROFILES.map(p => {
  //       const isActive = activeProfile === p.id
  //       const itemCounts = getCount(p.id)
  //       return `
  //         <button onclick="window._briefingProfileClick('${p.id}')" style="
  //           display:flex; align-items:center; gap:6px;
  //           padding:4px 10px; border-radius:12px; cursor:pointer;
  //           font-size:12px; font-weight:600;
  //           font-family:'IBM Plex Sans',sans-serif;
  //           border:1px solid ${isActive ? p.color : 'var(--border)'};
  //           background:${isActive ? p.color + '22' : 'transparent'};
  //           color:${isActive ? p.color : 'var(--text-secondary)'};
  //           transition:all 0.1s; white-space:nowrap;
  //         ">
  //           <span style="
  //             width:18px; height:18px; border-radius:50%; flex-shrink:0;
  //             background:${p.color}; color:#fff;
  //             display:inline-flex; align-items:center; justify-content:center;
  //             font-size:9px; font-weight:700;
  //           ">${p.avatar}</span>
  //           ${p.name}
  //           <span style="
  //             font-size:10px; font-weight:700;
  //             background:${isActive ? p.color + '30' : 'var(--bg-hover)'};
  //             color:${isActive ? p.color : 'var(--text-muted)'};
  //             border-radius:8px; padding:0 5px; min-width:16px; text-align:center;
  //           ">${itemCounts}</span>
  //         </button>
  //       `
  //     }).join('')}

  //     <div style="flex:1;"></div>
  //     <span style="font-size:11px;color:var(--text-muted);white-space:nowrap;flex-shrink:0;">
  //       ${activeProfile === 'all' ? 'Showing all profiles' : `Filtered to ${_BRIEFING_PROFILES.find(p => p.id === activeProfile)?.email || ''}`}
  //     </span>
  //   </div>
  // `
}

window._renderMorningBriefing = function() {
  const today    = new Date('2026-03-01')
  const todayStr = today.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })
  const activeProfile = window._briefingProfile || 'all'

  // ── filter by selected profile ──
  const byProfile = (arr) => activeProfile === 'all' ? arr : arr.filter(i => i.profile === activeProfile)
  const meetings      = byProfile(_BRIEFING.meetings)
  const dueThisWeek   = byProfile(_BRIEFING.dueThisWeek)
  const waitingForYou = byProfile(_BRIEFING.waitingForYou)
  const overdue       = byProfile(_BRIEFING.overdue)

  // ── helpers ──
  const dueBadge = (dateStr) => {
    const d = new Date(dateStr)
    const diff = Math.floor((d - today) / 86400000)
    if (diff < 0)   return `<span style="font-size:10px;font-weight:700;color:var(--danger);background:var(--danger-muted);border-radius:3px;padding:1px 5px;">Overdue</span>`
    if (diff === 0) return `<span style="font-size:10px;font-weight:700;color:var(--warning);background:var(--warning-muted);border-radius:3px;padding:1px 5px;">Today</span>`
    return `<span style="font-size:11px;color:var(--text-muted);">${d.toLocaleDateString('default',{month:'short',day:'numeric'})}</span>`
  }

  const wsDot = (color) =>
    `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color};flex-shrink:0;"></span>`

  const sourceIcon = (source) => source === 'jira'
    ? `<span style="font-size:9px;font-weight:700;color:#60a5fa;background:rgba(59,130,246,0.12);padding:1px 5px;border-radius:3px;flex-shrink:0;">J</span>`
    : `<span style="font-size:9px;font-weight:700;color:#a78bfa;background:rgba(139,92,246,0.12);padding:1px 5px;border-radius:3px;flex-shrink:0;">GH</span>`

  const profileChip = (profileId) => {
    const p = _BRIEFING_PROFILES.find(p => p.id === profileId)
    if (!p) return ''
    return `<span style="
      display:inline-flex; align-items:center; gap:4px; flex-shrink:0;
      font-size:10px; color:${p.color}; font-weight:600;
      background:${p.color}15; border-radius:10px; padding:1px 6px;
    ">
      <span style="width:5px;height:5px;border-radius:50%;background:${p.color};display:inline-block;"></span>
      ${p.name}
    </span>`
  }

  const calColors = { gcal: '#4285F4', outlook: '#0078D4' }

  // ── Register all briefing items into the shared registry ──
  // Meetings use uid 'mtg-N', jira/github items use their natural uid
  _BRIEFING.meetings.forEach((m, i) => {
    window._itemRegistry['mtg-' + i] = { ...m, source: 'meeting', _uid: 'mtg-' + i }
  })
  const briefingJiraItems = [..._BRIEFING.dueThisWeek, ..._BRIEFING.waitingForYou, ..._BRIEFING.overdue]
    .filter(i => i.source === 'jira')
  briefingJiraItems.forEach(item => {
    const uid = 'j-' + item.id
    if (!window._itemRegistry[uid]) window._itemRegistry[uid] = { ...item, _uid: uid }
  })
  const briefingGithubItems = [..._BRIEFING.dueThisWeek, ..._BRIEFING.waitingForYou, ..._BRIEFING.overdue]
    .filter(i => i.source === 'github')
  briefingGithubItems.forEach(item => {
    const rawId = String(item.id).replace(/^#/, '')
    const uid = 'gh-' + rawId
    // GitHub items from briefing need type to route to the right drawer
    if (!window._itemRegistry[uid]) window._itemRegistry[uid] = { ...item, id: rawId, type: 'issue', _uid: uid }
  })

  const selUid = window._selectedItem && window._selectedItem._uid

  // ── Timeline (taller, clickable blocks) ──
  const hours = [8,9,10,11,12,13,14,15,16,17]
  const timeToFrac = (t) => { const [h,m] = t.split(':').map(Number); return (h + m/60 - 8) / 10 }

  const timelineHTML = `
    <div style="position:relative;height:80px;margin:0 2px;">
      ${hours.map(h => `
        <div style="position:absolute;top:0;bottom:0;left:${((h-8)/10)*100}%;border-left:1px solid var(--border-subtle);pointer-events:none;">
          <span style="position:absolute;top:0;left:3px;font-size:9px;color:var(--text-muted);white-space:nowrap;">${h>12?h-12:h}${h>=12?'pm':'am'}</span>
        </div>
      `).join('')}
      <div style="position:absolute;top:0;bottom:0;left:12.5%;border-left:1.5px solid var(--accent);z-index:2;pointer-events:none;">
        <div style="position:absolute;top:-3px;left:-4px;width:7px;height:7px;border-radius:50%;background:var(--accent);"></div>
      </div>
      ${meetings.map((m) => {
        const globalIdx = _BRIEFING.meetings.indexOf(m)
        const uid = 'mtg-' + globalIdx
        const isSelected = selUid === uid
        const left = timeToFrac(m.time) * 100
        const dH = m.duration.includes('h') ? parseFloat(m.duration) : parseFloat(m.duration)/60
        const width = Math.max((dH/10)*100, 4)
        const color = calColors[m.source] || '#6366f1'
        const p = _BRIEFING_PROFILES.find(p => p.id === m.profile)
        return `
          <div onclick="window._selectItem('${uid}')" style="
            position:absolute;top:18px;height:44px;
            left:${left}%;width:${width}%;
            background:${isSelected ? color + '44' : color + '22'};
            border-left:3px solid ${color};
            border:1px solid ${isSelected ? color : color + '55'};
            border-left:3px solid ${color};
            border-radius:4px;overflow:hidden;
            display:flex;flex-direction:column;justify-content:center;padding:0 7px;gap:2px;
            cursor:pointer;
            box-shadow:${isSelected ? '0 0 0 2px ' + color + '55' : 'none'};
            transition:box-shadow 0.1s, background 0.1s;
          ">
            ${p ? `<span style="position:absolute;top:4px;right:5px;width:5px;height:5px;border-radius:50%;background:${p.color};"></span>` : ''}
            <span style="font-size:10px;font-weight:700;color:${color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.title}</span>
            <span style="font-size:9px;color:${color}aa;white-space:nowrap;">${m.time} · ${m.duration}</span>
          </div>`
      }).join('')}
    </div>
  `

  // ── helper: uid for jira/github briefing item ──
  const briefingItemUid = (item) => {
    if (item.source === 'jira') return 'j-' + item.id
    return 'gh-' + String(item.id).replace(/^#/, '')
  }

  // ── Due this week rows ──
  const dueRowsHTML = dueThisWeek.length === 0
    ? `<div style="font-size:12px;color:var(--text-muted);padding:8px 2px;">Nothing due this week.</div>`
    : dueThisWeek.map(item => {
        const uid = briefingItemUid(item)
        const isSel = selUid === uid
        return `
          <div onclick="window._selectItem('${uid}')" style="
            display:flex;align-items:center;gap:8px;padding:7px 10px;
            border:1px solid ${isSel ? 'var(--accent)' : 'var(--border)'};
            border-radius:var(--radius);
            background:${isSel ? 'var(--accent-muted)' : 'var(--bg-raised)'};
            margin-bottom:5px;cursor:pointer;transition:background 0.1s,border-color 0.1s;
          "
          onmouseover="this.style.background='var(--bg-hover)'"
          onmouseout="this.style.background='${isSel ? 'var(--accent-muted)' : 'var(--bg-raised)'}'"
          >
            ${wsDot(item.wsColor)}
            ${sourceIcon(item.source)}
            <span style="font-size:11px;color:var(--text-muted);font-family:monospace;white-space:nowrap;">${item.id}</span>
            <span style="flex:1;font-size:12px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.title}</span>
            ${profileChip(item.profile)}
            ${dueBadge(item.dueDate)}
          </div>
        `
      }).join('')

  // ── Waiting for you rows ──
  const waitingRowsHTML = waitingForYou.length === 0
    ? `<div style="font-size:12px;color:var(--text-muted);padding:8px 2px;">Nothing waiting for you.</div>`
    : waitingForYou.map(item => {
        const uid = briefingItemUid(item)
        const isSel = selUid === uid
        return `
          <div onclick="window._selectItem('${uid}')" style="
            display:flex;align-items:center;gap:8px;padding:8px 10px;
            border:1px solid ${isSel ? 'var(--accent)' : 'var(--border)'};
            border-radius:var(--radius);
            background:${isSel ? 'var(--accent-muted)' : 'var(--bg-raised)'};
            margin-bottom:5px;cursor:pointer;transition:background 0.1s,border-color 0.1s;
          "
          onmouseover="this.style.background='var(--bg-hover)'"
          onmouseout="this.style.background='${isSel ? 'var(--accent-muted)' : 'var(--bg-raised)'}'"
          >
            ${sourceIcon(item.source)}
            <div style="flex:1;min-width:0;">
              <div style="font-size:12px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.title}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:1px;display:flex;align-items:center;gap:5px;">
                ${wsDot(item.wsColor)}
                <span>${item.workspace}</span>
                <span style="color:var(--border);">·</span>
                <span>${item.action}</span>
              </div>
            </div>
            ${profileChip(item.profile)}
            <span style="font-size:11px;color:var(--text-muted);white-space:nowrap;flex-shrink:0;">${item.waiting} ago</span>
          </div>
        `
      }).join('')

  // ── Overdue rows ──
  const overdueRowsHTML = overdue.length === 0
    ? `<div style="text-align:center;padding:14px 0;color:var(--success);font-size:13px;display:flex;align-items:center;justify-content:center;gap:6px;">
        <i data-lucide="check-circle-2" style="width:14px;height:14px;"></i> All caught up!
       </div>`
    : overdue.map(item => {
        const uid = briefingItemUid(item)
        const isSel = selUid === uid
        const d = new Date(item.dueDate)
        const daysAgo = Math.floor((today - d) / 86400000)
        return `
          <div onclick="window._selectItem('${uid}')" style="
            display:flex;align-items:center;gap:8px;padding:7px 10px;
            border:1px solid ${isSel ? 'var(--danger)' : 'rgba(239,68,68,0.25)'};
            border-radius:var(--radius);
            background:${isSel ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.05)'};
            margin-bottom:5px;cursor:pointer;transition:background 0.1s,border-color 0.1s;
          "
          onmouseover="this.style.background='rgba(239,68,68,0.1)'"
          onmouseout="this.style.background='${isSel ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.05)'}'"
          >
            ${wsDot(item.wsColor)}
            ${sourceIcon(item.source)}
            <span style="font-size:11px;color:var(--text-muted);font-family:monospace;white-space:nowrap;">${item.id}</span>
            <span style="flex:1;font-size:12px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.title}</span>
            ${profileChip(item.profile)}
            <span style="font-size:11px;color:var(--danger);font-weight:600;white-space:nowrap;flex-shrink:0;">${daysAgo}d overdue</span>
          </div>`
      }).join('')

  const sectionHead = (icon, label, count, accentColor) => `
    <div style="display:flex;align-items:center;gap:7px;margin-bottom:10px;">
      <div style="width:24px;height:24px;border-radius:5px;flex-shrink:0;background:${accentColor}18;display:flex;align-items:center;justify-content:center;">
        <i data-lucide="${icon}" style="width:12px;height:12px;color:${accentColor};"></i>
      </div>
      <span style="font-size:12px;font-weight:600;color:var(--text-primary);">${label}</span>
      <span style="font-size:10px;font-weight:700;color:${accentColor};background:${accentColor}18;border-radius:9px;padding:1px 6px;">${count}</span>
    </div>
  `

  return `
    <div style="padding:20px 20px 4px;flex-shrink:0;">

      <!-- Briefing header -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
        <span style="font-size:13px;color:var(--text-secondary);">☀️ ${todayStr}</span>
        <div style="width:1px;height:12px;background:var(--border);"></div>
        <span style="font-size:12px;color:var(--accent);">${meetings.length} meeting${meetings.length !== 1 ? 's' : ''}</span>
        <span style="font-size:12px;color:var(--warning);">${dueThisWeek.length} due this week</span>
        ${overdue.length > 0 ? `<span style="font-size:12px;color:var(--danger);">${overdue.length} overdue</span>` : `<span style="font-size:12px;color:var(--success);">nothing overdue</span>`}
      </div>

      <!-- Two-column layout: Meetings left, stack of 3 right -->
      <div style="display:flex;gap:12px;margin-bottom:20px;align-items:flex-start;">

        <!-- ① Meetings Today — full left column -->
        <div style="flex:1;min-width:0;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;">
          ${sectionHead('calendar', 'Meetings Today', meetings.length, '#4285F4')}
          <div style="margin-bottom:12px;">${timelineHTML}</div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            ${meetings.length === 0
              ? `<div style="font-size:12px;color:var(--text-muted);padding:4px 2px;">No meetings today.</div>`
              : meetings.map(m => {
                  const globalIdx = _BRIEFING.meetings.indexOf(m)
                  const uid = 'mtg-' + globalIdx
                  const isSel = selUid === uid
                  const mColor = calColors[m.source] || '#6366f1'
                  return `
                    <div onclick="window._selectItem('${uid}')"
                      style="
                        display:flex;align-items:center;gap:8px;padding:6px 9px;border-radius:var(--radius);
                        background:${isSel ? mColor + '18' : 'var(--bg-raised)'};
                        border:1px solid ${isSel ? mColor + '55' : 'var(--border-subtle)'};
                        cursor:pointer;transition:background 0.1s,border-color 0.1s;
                      "
                      onmouseover="this.style.background='${mColor}12';this.style.borderColor='${mColor}44'"
                      onmouseout="this.style.background='${isSel ? mColor + '18' : 'var(--bg-raised)'}';this.style.borderColor='${isSel ? mColor + '55' : 'var(--border-subtle)'}'"
                    >
                      <span style="font-size:11px;font-weight:600;color:${mColor};white-space:nowrap;min-width:36px;">${m.time}</span>
                      <div style="width:1px;height:14px;background:var(--border-subtle);flex-shrink:0;"></div>
                      ${wsDot(m.wsColor)}
                      <span style="flex:1;font-size:12px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.title}</span>
                      ${profileChip(m.profile)}
                      <span style="font-size:10px;color:var(--text-muted);flex-shrink:0;">${m.duration}</span>
                      <span style="font-size:10px;color:var(--text-muted);flex-shrink:0;display:flex;align-items:center;gap:3px;">
                        <i data-lucide="users" style="width:10px;height:10px;"></i>${m.attendees}
                      </span>
                      <i data-lucide="chevron-right" style="width:11px;height:11px;color:var(--text-muted);flex-shrink:0;"></i>
                    </div>
                  `
                }).join('')
            }
          </div>
        </div>

        <!-- Right column: stack of 3 -->
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:12px;">

          <!-- ② Waiting For You -->
          <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;">
            ${sectionHead('clock', 'Waiting For You', waitingForYou.length, '#f59e0b')}
            ${waitingRowsHTML}
          </div>

          <!-- ③ Due This Week -->
          <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;">
            ${sectionHead('calendar-clock', 'Due This Week', dueThisWeek.length, '#f59e0b')}
            ${dueRowsHTML}
          </div>

          <!-- ④ Overdue -->
          <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-color:rgba(239,68,68,0.2);border-radius:var(--radius-lg);padding:16px;align-self:stretch;">
            ${sectionHead('alert-circle', 'Overdue', overdue.length, '#ef4444')}
            ${overdueRowsHTML}
          </div>

        </div>

      </div>

      <!-- Divider before table -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:0;padding-bottom:0;">
        <div style="flex:1;height:1px;background:var(--border-subtle);"></div>
        <span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.07em;">All Items</span>
        <div style="flex:1;height:1px;background:var(--border-subtle);"></div>
      </div>

    </div>
  `
}

window._renderAllTable = function(items) {
  items.forEach(item => {
    const uid = (item.source === 'jira' ? 'j-' : 'gh-') + item.id
    window._itemRegistry[uid] = { ...item, _uid: uid }
  })
  return `
    <table style="width:100%; border-collapse:collapse; min-width:700px;">
      <thead>
        <tr>
          <th style="${thStyle}">Source</th>
          <th style="${thStyle}">Workspace</th>
          <th style="${thStyle}">ID</th>
          <th style="${thStyle}">Title</th>
          <th style="${thStyle}">Type</th>
          <th style="${thStyle}">Status</th>
          <th style="${thStyle}">Assignee / Author</th>
          <th style="${thStyle}">Updated</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => {
          const uid = (item.source === 'jira' ? 'j-' : 'gh-') + item.id
          const isSelected = window._selectedItem && window._selectedItem._uid === uid
          return `
          <tr data-uid="${uid}" data-selected="${isSelected ? '1' : '0'}"
            style="cursor:pointer; transition:background 0.1s; background:${isSelected ? 'var(--accent-muted)' : 'transparent'};"
            onmouseover="if(this.getAttribute('data-selected')==='0') this.style.background='var(--bg-hover)'"
            onmouseout="if(this.getAttribute('data-selected')==='0') this.style.background='transparent'"
            onclick="window._selectItem('${uid}')"
          >
            <td style="${tdStyle}">
              ${item.source === 'jira'
                ? `<span style="font-size:11px; font-weight:600; color:#60a5fa; background:rgba(59,130,246,0.1); padding:2px 6px; border-radius:4px;">J</span>`
                : `<span style="font-size:11px; font-weight:600; color:#a78bfa; background:rgba(139,92,246,0.1); padding:2px 6px; border-radius:4px;">GH</span>`
              }
            </td>
            <td style="${tdStyle}">${window._workspaceDot(item.workspace)}</td>
            <td style="${tdStyle} font-family:monospace; color:var(--text-muted);">${item.source === 'jira' ? item.id : '#' + item.id}</td>
            <td style="${tdStyle} max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.title}</td>
            <td style="${tdStyle}">${window._typeBadge(item.source === 'jira' ? 'jira' : item.type)}</td>
            <td style="${tdStyle}">${window._statusBadge(item.status)}</td>
            <td style="${tdStyle} color:var(--text-secondary);">${item.assignee || item.author || '—'}</td>
            <td style="${tdStyle} color:var(--text-muted); white-space:nowrap;">${window.timeAgo(item.dueDate || item.updatedAt)}</td>
          </tr>
        `}).join('')}
      </tbody>
    </table>
  `
}

window._renderJiraTable = function(items) {
  if (items.length === 0) {
    return `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:200px; gap:10px;">
        <i data-lucide="layout-dashboard" style="width:28px; height:28px; color:var(--text-muted); opacity:0.3;"></i>
        <div style="color:var(--text-muted); font-size:14px;">No Jira items yet</div>
        <div style="color:var(--text-muted); font-size:12px;">Add a Jira board in Settings → Tracking Sites and click Sync</div>
      </div>`
  }
  items.forEach(item => {
    const uid = 'j-' + item.id
    window._itemRegistry[uid] = { ...item, _uid: uid, source: 'jira' }
  })
  return `
    <table style="width:100%; border-collapse:collapse; min-width:600px;">
      <thead>
        <tr>
          <th style="${thStyle}">Title</th>
          <th style="${thStyle}">Status</th>
          <th style="${thStyle}">Priority</th>
          <th style="${thStyle}">Epic</th>
          <th style="${thStyle}">Estimate</th>
          <th style="${thStyle}">Type</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => {
          const uid = 'j-' + item.id
          const isSelected = window._selectedItem && window._selectedItem._uid === uid
          const escapedUrl = (item.url || '').replace(/'/g, "\\'")
          return `
          <tr class="jira-row" data-uid="${uid}" data-selected="${isSelected ? '1' : '0'}"
            style="cursor:pointer; transition:background 0.1s; background:${isSelected ? 'var(--accent-muted)' : 'transparent'};"
            onmouseover="this.style.background='${isSelected ? 'var(--accent-muted)' : 'var(--bg-hover)'}'; var b=this.querySelector('.jira-open-btn'); if(b) b.style.opacity='1'"
            onmouseout="this.style.background='${isSelected ? 'var(--accent-muted)' : 'transparent'}'; var b=this.querySelector('.jira-open-btn'); if(b) b.style.opacity='0'"
            onclick="window._selectJiraItem('${uid}')"
          >
            <td style="${tdStyle} max-width:340px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; position:relative;">
              ${item.title}
              ${item.url ? `<button class="jira-open-btn" onclick="event.stopPropagation(); window.api.openExternal('${escapedUrl}');" style="
                position:absolute; right:8px; top:50%; transform:translateY(-50%);
                opacity:0; background:var(--bg-surface); border:1px solid var(--border);
                border-radius:var(--radius-sm); padding:2px 6px; cursor:pointer;
                display:inline-flex; align-items:center; gap:4px; font-size:11px; color:var(--text-secondary);
                transition:opacity 0.15s; font-family:'IBM Plex Sans',sans-serif;
              ">
                <i data-lucide="external-link" style="width:11px;height:11px;"></i>
              </button>` : ''}
            </td>
            <td style="${tdStyle}">${window._statusBadge(item.status)}</td>
            <td style="${tdStyle}">${window._priorityDot(item.priority)}</td>
            <td style="${tdStyle} color:var(--text-muted); max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.epic || '—'}</td>
            <td style="${tdStyle} color:var(--text-secondary);">${item.estimate || '—'}</td>
            <td style="${tdStyle}">${item.issue_type || item.issueType || 'Story'}</td>
          </tr>
        `}).join('')}
      </tbody>
    </table>
  `
}

// ─── Calendar ────────────────────────────────────────────────────────────────

window._calState = {
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
  weekOffset: 0,      // 0 = current week, -1 = last week, +1 = next week
  selectedDay: null,
  accountFilter: 'all',
}

// Return Monday of the week at weekOffset from today
window._calWeekStart = function() {
  const now = new Date()
  const dow = now.getDay() // 0=Sun
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1) + window._calState.weekOffset * 7)
  monday.setHours(0, 0, 0, 0)
  return monday
}

window._renderCalendarUI = function() {
  const container = document.querySelector('[data-view="dashboard"]')
  if (!container) return

  const cs = window._calState
  const allEvents = window._appState.calendarItems || []

  const accounts = [...new Set(allEvents.map(e => e.account).filter(Boolean))]
  const activeProfile = window._briefingProfile || 'all'

  let events = allEvents
  if (activeProfile !== 'all') events = events.filter(e => e.profile === activeProfile)
  if (cs.accountFilter !== 'all') events = events.filter(e => e.account === cs.accountFilter)

  // Week range
  const weekStart = window._calWeekStart()
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })
  const weekEnd = weekDays[6]

  const todayStr = new Date().toISOString().split('T')[0]

  // Format week label
  const fmtShort = d => d.toLocaleDateString('default', { month: 'short', day: 'numeric' })
  const weekLabel = fmtShort(weekStart) + ' – ' + fmtShort(weekEnd) + ', ' + weekStart.getFullYear()

  // Build event map keyed by YYYY-MM-DD
  const eventMap = {}
  events.forEach(ev => {
    const key = (ev.start || ev.date || '').slice(0, 10)
    if (!key) return
    if (!eventMap[key]) eventMap[key] = []
    eventMap[key].push(ev)
  })

  // Upcoming events = everything from today forward, next 14 days
  const upcoming = events
    .filter(ev => {
      const d = (ev.start || ev.date || '').slice(0, 10)
      return d >= todayStr
    })
    .sort((a, b) => (a.start || '').localeCompare(b.start || ''))
    .slice(0, 20)

  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; height:100%; overflow:hidden;">

      <!-- Toolbar -->
      <div style="
        padding:10px 20px; background:var(--bg-surface);
        border-bottom:1px solid var(--border);
        display:flex; align-items:center; gap:10px; flex-shrink:0;
      ">
        <div style="display:flex; align-items:center; gap:4px;">
          <button onclick="window._calNav(-1)" style="
            width:27px; height:27px; border-radius:var(--radius);
            background:transparent; border:1px solid var(--border);
            color:var(--text-secondary); cursor:pointer;
            display:flex; align-items:center; justify-content:center;
          " onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
            <i data-lucide="chevron-left" style="width:13px;height:13px;"></i>
          </button>
          <span style="font-size:13px; font-weight:600; color:var(--text-primary); min-width:180px; text-align:center; padding:0 4px;">
            ${weekLabel}
          </span>
          <button onclick="window._calNav(1)" style="
            width:27px; height:27px; border-radius:var(--radius);
            background:transparent; border:1px solid var(--border);
            color:var(--text-secondary); cursor:pointer;
            display:flex; align-items:center; justify-content:center;
          " onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
            <i data-lucide="chevron-right" style="width:13px;height:13px;"></i>
          </button>
        </div>

        <button onclick="window._calGoToday()" style="
          padding:5px 11px; border-radius:var(--radius);
          background:transparent; border:1px solid var(--border);
          color:var(--text-secondary); font-size:12px; font-weight:500;
          font-family:'IBM Plex Sans',sans-serif; cursor:pointer;
        " onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-secondary)'">
          Today
        </button>

        <div style="flex:1;"></div>

        <span style="display:flex; align-items:center; gap:5px; font-size:12px; color:var(--text-muted);">
          <img src="../assets/google-calendar.svg" style="width:13px;height:13px;opacity:0.75;"> Google Calendar
        </span>

        ${accounts.length > 1 ? `
          <select onchange="window._calFilter('account', this.value)" style="
            background:var(--bg-raised); border:1px solid var(--border);
            border-radius:var(--radius); padding:5px 9px;
            font-size:12px; color:var(--text-primary);
            font-family:'IBM Plex Sans',sans-serif; outline:none; cursor:pointer;
          ">
            <option value="all" ${cs.accountFilter === 'all' ? 'selected' : ''}>All accounts</option>
            ${accounts.map(a => `<option value="${a}" ${cs.accountFilter === a ? 'selected' : ''}>${a}</option>`).join('')}
          </select>
        ` : ''}
      </div>

      <!-- Profile navbar -->
      ${window._renderProfileNavbar(allEvents)}

      <!-- Body: week grid + upcoming sidebar -->
      <div style="flex:1; display:flex; overflow:hidden;">

        <!-- Week grid -->
        <div style="flex:1; overflow-y:auto; background:var(--bg-base);">

          <!-- Day header row -->
          <div style="
            display:grid; grid-template-columns: repeat(7, 1fr);
            background:var(--bg-surface);
            border-bottom:1px solid var(--border);
            position:sticky; top:0; z-index:2;
          ">
            ${weekDays.map((d, i) => {
              const ds = d.toISOString().split('T')[0]
              const isToday = ds === todayStr
              const dayEvCount = (eventMap[ds] || []).length
              return `
                <div onclick="window._calSelectDay('${ds}')" style="
                  padding:10px 10px 8px; cursor:pointer; text-align:center;
                  border-right:${i < 6 ? '1px solid var(--border-subtle)' : 'none'};
                  background:${cs.selectedDay === ds ? 'var(--accent-muted)' : 'transparent'};
                  transition:background 0.1s;
                " onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='${cs.selectedDay === ds ? 'var(--accent-muted)' : 'transparent'}'">
                  <div style="font-size:10px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em; margin-bottom:4px;">${DAY_LABELS[i]}</div>
                  <div style="
                    width:28px; height:28px; border-radius:50%; margin:0 auto;
                    display:flex; align-items:center; justify-content:center;
                    font-size:13px; font-weight:${isToday ? '700' : '500'};
                    background:${isToday ? 'var(--accent)' : 'transparent'};
                    color:${isToday ? '#fff' : cs.selectedDay === ds ? 'var(--accent)' : 'var(--text-primary)'};
                  ">${d.getDate()}</div>
                  ${dayEvCount > 0 ? `<div style="margin-top:3px; font-size:10px; color:${isToday ? 'var(--accent)' : 'var(--text-muted)'};">${dayEvCount} event${dayEvCount > 1 ? 's' : ''}</div>` : '<div style="margin-top:3px; height:14px;"></div>'}
                </div>
              `
            }).join('')}
          </div>

          <!-- Event rows per day -->
          <div style="display:grid; grid-template-columns:repeat(7,1fr); min-height:calc(100% - 72px);">
            ${weekDays.map((d, i) => {
              const ds = d.toISOString().split('T')[0]
              const dayEvs = (eventMap[ds] || []).sort((a,b) => (a.start||'').localeCompare(b.start||''))
              const isToday = ds === todayStr
              const isSelected = cs.selectedDay === ds
              const isWeekend = i >= 5

              return `
                <div onclick="window._calSelectDay('${ds}')" style="
                  min-height:180px; padding:8px 6px; cursor:pointer;
                  border-right:${i < 6 ? '1px solid var(--border-subtle)' : 'none'};
                  border-top:1px solid var(--border-subtle);
                  background:${isSelected ? 'var(--accent-muted)' : isWeekend ? 'rgba(0,0,0,0.01)' : 'transparent'};
                  transition:background 0.1s;
                " onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='${isSelected ? 'var(--accent-muted)' : isWeekend ? 'rgba(0,0,0,0.01)' : 'transparent'}'">
                  ${dayEvs.length === 0
                    ? `<div style="height:100%; display:flex; align-items:flex-start; justify-content:center; padding-top:20px;">
                        <span style="font-size:11px; color:var(--border); user-select:none;">—</span>
                       </div>`
                    : dayEvs.map(ev => {
                        const hasTime = ev.start && ev.start.includes('T') && !ev.all_day
                        const timeLabel = hasTime ? window._calFmtTime(ev.start) : ''
                        const endLabel = (hasTime && ev.end && ev.end.includes('T')) ? window._calFmtTime(ev.end) : ''
                        const color = ev.color || '#4285F4'
                        return `
                          <div style="
                            margin-bottom:4px; padding:5px 7px;
                            background:${color}18; border-left:3px solid ${color};
                            border-radius:0 var(--radius-sm) var(--radius-sm) 0;
                            cursor:pointer;
                          ">
                            <div style="font-size:12px; font-weight:500; color:var(--text-primary); line-height:1.3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${ev.title}</div>
                            ${timeLabel ? `<div style="font-size:10px; color:var(--text-muted); margin-top:1px;">${timeLabel}${endLabel ? ' – ' + endLabel : ''}</div>` : `<div style="font-size:10px; color:${color}; margin-top:1px;">All day</div>`}
                          </div>
                        `
                      }).join('')
                  }
                </div>
              `
            }).join('')}
          </div>
        </div>

        <!-- Upcoming sidebar -->
        <div style="
          width:240px; min-width:240px; flex-shrink:0;
          border-left:1px solid var(--border);
          background:var(--bg-surface);
          overflow-y:auto; display:flex; flex-direction:column;
        ">
          <div style="padding:14px 16px 10px; border-bottom:1px solid var(--border-subtle); flex-shrink:0;">
            <div style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em;">Upcoming</div>
          </div>

          ${upcoming.length === 0 ? `
            <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:24px; text-align:center;">
              <i data-lucide="calendar-x" style="width:22px;height:22px;color:var(--border);margin-bottom:10px;"></i>
              <div style="font-size:12px; color:var(--text-muted);">No upcoming events</div>
            </div>
          ` : (() => {
            // Group upcoming by date
            const groups = {}
            upcoming.forEach(ev => {
              const ds = (ev.start || ev.date || '').slice(0, 10)
              if (!groups[ds]) groups[ds] = []
              groups[ds].push(ev)
            })
            return Object.entries(groups).map(([ds, evs]) => {
              const d = new Date(ds + 'T00:00:00')
              const isToday = ds === todayStr
              const isTomorrow = ds === new Date(Date.now() + 86400000).toISOString().split('T')[0]
              const dayLabel = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : d.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' })
              return `
                <div style="padding:10px 16px 6px; border-bottom:1px solid var(--border-subtle);">
                  <div style="font-size:11px; font-weight:600; color:${isToday ? 'var(--accent)' : 'var(--text-secondary)'}; margin-bottom:6px;">${dayLabel}</div>
                  ${evs.map(ev => {
                    const hasTime = ev.start && ev.start.includes('T') && !ev.all_day
                    const timeLabel = hasTime ? window._calFmtTime(ev.start) : 'All day'
                    const color = ev.color || '#4285F4'
                    return `
                      <div style="
                        display:flex; gap:8px; align-items:flex-start;
                        margin-bottom:6px; padding:6px 8px;
                        background:var(--bg-raised); border-radius:var(--radius);
                        border-left:3px solid ${color};
                      ">
                        <div style="flex:1; min-width:0;">
                          <div style="font-size:12px; font-weight:500; color:var(--text-primary); line-height:1.3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${ev.title}</div>
                          <div style="font-size:11px; color:var(--text-muted); margin-top:1px;">${timeLabel}</div>
                          ${ev.account ? `<div style="font-size:10px; color:var(--text-muted); margin-top:1px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${ev.account}</div>` : ''}
                        </div>
                      </div>
                    `
                  }).join('')}
                </div>
              `
            }).join('')
          })()}
        </div>

      </div>
    </div>
  `

  if (typeof lucide !== 'undefined') lucide.createIcons()
}

window._calFmtTime = function(isoStr) {
  if (!isoStr || !isoStr.includes('T')) return ''
  const [, timePart] = isoStr.split('T')
  const [h, m] = timePart.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return `${h12}${m > 0 ? ':' + String(m).padStart(2,'0') : ''}${ampm}`
}

window._calNav = function(delta) {
  window._calState.weekOffset += delta
  window._calState.selectedDay = null
  window._renderCalendarUI()
}

window._calGoToday = function() {
  window._calState.weekOffset = 0
  window._calState.selectedDay = null
  window._renderCalendarUI()
}

window._calSelectDay = function(dateStr) {
  window._calState.selectedDay = window._calState.selectedDay === dateStr ? null : dateStr
  window._renderCalendarUI()
}

window._calFilter = function(key, value) {
  window._calState[key + 'Filter'] = value
  window._renderCalendarUI()
}

// ─── GitHub table ─────────────────────────────────────────────────────────────

window._ghNotifState = window._ghNotifState || { status: 'idle', results: null } // idle | loading | done | error

window._loadGithubNotifications = async function() {
  // get all tracked repo URLs from DB
  let repos = []
  try {
    const data = await window.api.githubGetData()
    repos = (data.repos || []).map(r => r.url)
  } catch(e) { /* no-op */ }

  if (!repos.length) {
    window._ghNotifState = { status: 'done', results: [] }
    window._reRenderCurrentView()
    return
  }

  window._ghNotifState = { status: 'loading', results: null }
  window._reRenderCurrentView()

  try {
    const results = await window.api.githubScrapeNotifications(repos)
    window._ghNotifState = { status: 'done', results }
  } catch(err) {
    window._ghNotifState = { status: 'error', results: null, error: err.message }
  }
  window._reRenderCurrentView()
}

window._renderGithubNotifBar = function() {
  const s = window._ghNotifState
  const notifCount = s.results ? s.results.reduce(function(acc, r) { return acc + r.notifications.length }, 0) : 0

  return `
    <div style="
      display:flex; align-items:center; gap:10px; flex-wrap:wrap;
      padding:10px 16px; border-bottom:1px solid var(--border-subtle);
      background:var(--bg-surface);
    ">
      <button
        onclick="window._loadGithubNotifications()"
        ${s.status === 'loading' ? 'disabled' : ''}
        style="
          display:inline-flex; align-items:center; gap:6px;
          padding:5px 12px; border-radius:var(--radius);
          background:var(--bg-raised); border:1px solid var(--border);
          font-size:12px; font-weight:600; color:var(--text-secondary);
          cursor:${s.status === 'loading' ? 'default' : 'pointer'};
          font-family:'IBM Plex Sans',sans-serif; transition:border-color 0.15s;
        "
        onmouseover="this.style.borderColor='var(--accent)'"
        onmouseout="this.style.borderColor='var(--border)'"
      >
        ${s.status === 'loading'
          ? `<div style="width:11px;height:11px;border-radius:50%;border:2px solid var(--border);border-top-color:var(--accent);animation:spin 0.7s linear infinite;"></div> Checking…`
          : `<i data-lucide="bell" style="width:12px;height:12px;"></i> Check notifications`
        }
      </button>

      ${s.status === 'done' && notifCount === 0
        ? `<span style="font-size:12px; color:var(--text-muted);">No unread notifications</span>`
        : ''
      }
      ${s.status === 'error'
        ? `<span style="font-size:12px; color:var(--danger);">Error: ${s.error}</span>`
        : ''
      }
      ${s.status === 'done' && notifCount > 0
        ? `<span style="
            font-size:11px; font-weight:700;
            background:var(--accent-muted); color:var(--accent);
            border-radius:10px; padding:1px 8px;
          ">${notifCount} unread</span>`
        : ''
      }
    </div>

    ${s.status === 'done' && notifCount > 0 ? window._renderGithubNotifList(s.results) : ''}
  `
}

window._renderGithubNotifList = function(results) {
  return `
    <div style="border-bottom:1px solid var(--border-subtle); background:var(--bg-surface);">
      ${results.filter(function(r) { return r.notifications.length > 0 }).map(function(r) {
        return `
          <div style="padding:8px 16px 4px;">
            <div style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px;">
              ${r.repoPath}
            </div>
            ${r.notifications.map(function(n) {
              const escapedUrl = (n.url || '').replace(/'/g, "\\'")
              const typeColor = n.type === 'pr' ? '#818cf8' : n.type === 'issue' ? '#f87171' : 'var(--text-muted)'
              const typeBg    = n.type === 'pr' ? 'rgba(99,102,241,0.12)' : n.type === 'issue' ? 'rgba(239,68,68,0.1)' : 'var(--bg-raised)'
              const typeLabel = n.type === 'pr' ? 'PR' : n.type === 'issue' ? 'Issue' : n.type === 'commit' ? 'Commit' : n.type === 'release' ? 'Release' : 'Other'
              return `
                <div style="
                  display:flex; align-items:center; gap:10px;
                  padding:7px 0; border-bottom:1px solid var(--border-subtle);
                ">
                  <span style="
                    font-size:10px; font-weight:600; padding:1px 6px;
                    border-radius:var(--radius-sm); white-space:nowrap; flex-shrink:0;
                    background:${typeBg}; color:${typeColor};
                  ">${typeLabel}</span>
                  <span style="flex:1; min-width:0; font-size:13px; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${n.title}</span>
                  ${n.date ? `<span style="font-size:11px; color:var(--text-muted); flex-shrink:0; white-space:nowrap;">${n.date}</span>` : ''}
                  ${n.url ? `
                    <button onclick="window.api.openExternal('${escapedUrl}')" style="
                      flex-shrink:0; background:none; border:1px solid var(--border);
                      border-radius:var(--radius-sm); padding:2px 6px; cursor:pointer;
                      display:inline-flex; align-items:center; color:var(--text-muted);
                      font-family:'IBM Plex Sans',sans-serif; transition:border-color 0.15s, color 0.15s;
                    "
                    onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'"
                    onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-muted)'"
                    >
                      <i data-lucide="external-link" style="width:11px;height:11px;"></i>
                    </button>
                  ` : ''}
                </div>
              `
            }).join('')}
          </div>
        `
      }).join('')}
    </div>
  `
}

window._renderGithubTable = function(items) {
  const notifBar = window._renderGithubNotifBar()

  if (items.length === 0) {
    return notifBar + `<div style="display:flex; align-items:center; justify-content:center; height:200px; color:var(--text-muted); font-size:14px;">No GitHub items found. Connect a repo in onboarding and sync.</div>`
  }
  return notifBar + `
    <table style="width:100%; border-collapse:collapse; min-width:600px;">
      <thead>
        <tr>
          <th style="${thStyle}">Repo</th>
          <th style="${thStyle}">Title</th>
          <th style="${thStyle}">Type</th>
          <th style="${thStyle}">Status</th>
          <th style="${thStyle}">Author</th>
          <th style="${thStyle}">Updated</th>
          <th style="${thStyle} width:40px;"></th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => {
          const uid = 'gh-' + item.id
          window._itemRegistry[uid] = { ...item, _uid: uid, source: 'github' }
          const isSelected = window._selectedItem && window._selectedItem._uid === uid
          const escapedUrl = (item.url || '').replace(/'/g, "\\'")
          return `
          <tr class="gh-row" data-uid="${uid}" data-selected="${isSelected ? '1' : '0'}"
            style="cursor:pointer; transition:background 0.1s; background:${isSelected ? 'var(--accent-muted)' : 'transparent'};"
            onmouseover="this.style.background='${isSelected ? 'var(--accent-muted)' : 'var(--bg-hover)'}'; this.querySelector('.gh-open-btn').style.opacity='1'"
            onmouseout="this.style.background='${isSelected ? 'var(--accent-muted)' : 'transparent'}'; this.querySelector('.gh-open-btn').style.opacity='0'"
            onclick="window._selectGithubItem('${uid}')"
          >
            <td style="${tdStyle} color:var(--text-muted); white-space:nowrap; font-size:12px;">${item.repo || '—'}</td>
            <td style="${tdStyle} max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.title}</td>
            <td style="${tdStyle}">${window._typeBadge(item.type)}</td>
            <td style="${tdStyle}">${window._statusBadge(item.status)}</td>
            <td style="${tdStyle} color:var(--text-secondary);">${item.author || '—'}</td>
            <td style="${tdStyle} color:var(--text-muted); white-space:nowrap;">${window.timeAgo(item.updatedAt)}</td>
            <td style="${tdStyle} text-align:center; padding:0 8px;">
              <button
                class="gh-open-btn"
                onclick="event.stopPropagation(); window.api.openExternal('${escapedUrl}')"
                title="Open in browser"
                style="
                  opacity:0; transition:opacity 0.15s;
                  background:none; border:1px solid var(--border);
                  border-radius:var(--radius-sm); padding:3px 5px;
                  cursor:pointer; color:var(--text-muted);
                  display:inline-flex; align-items:center;
                "
                onmouseover="this.style.borderColor='var(--accent)'; this.style.color='var(--accent)'"
                onmouseout="this.style.borderColor='var(--border)'; this.style.color='var(--text-muted)'"
              >
                <i data-lucide="external-link" style="width:12px; height:12px;"></i>
              </button>
            </td>
          </tr>
        `}).join('')}
      </tbody>
    </table>
  `
}
