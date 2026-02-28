window._dashboardFilters = { search: '', type: 'all', status: 'all', workspace: 'all' }
window._selectedItem = null

window.renderDashboard = function() {
  const container = document.querySelector('[data-view="dashboard"]')
  if (!container) return

  const dashView = (window._appState && window._appState.dashboardView) || 'all'

  // Clear selection when switching between sub-views
  if (window._lastDashView && window._lastDashView !== dashView) window._selectedItem = null
  window._lastDashView = dashView

  // Fetch mock data if not yet loaded
  const loadData = (window._appState.jiraItems && window._appState.githubItems)
    ? Promise.resolve()
    : Promise.all([
        fetch('./mock/jira.json').then(r => r.json()),
        fetch('./mock/github.json').then(r => r.json())
      ]).then(([jira, github]) => {
        window._appState.jiraItems = jira
        window._appState.githubItems = github
      })

  // Calendar view has its own data fetch path
  if (dashView === 'calendar') {
    const loadCal = window._appState.calendarItems
      ? Promise.resolve()
      : fetch('./mock/calendar.json').then(r => r.json()).then(data => { window._appState.calendarItems = data })
    loadCal.then(() => window._renderCalendarUI()).catch(err => {
      container.innerHTML = `<div style="padding:40px; color:var(--danger);">Failed to load calendar: ${err.message}</div>`
    })
    return
  }

  loadData.then(() => {
    window._renderDashboardUI(dashView)
  }).catch(err => {
    container.innerHTML = `<div style="padding:40px; color:var(--danger);">Failed to load data: ${err.message}</div>`
  })
}

window._renderDashboardUI = function(dashView) {
  const container = document.querySelector('[data-view="dashboard"]')
  if (!container) return

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

      <!-- Table + detail panel -->
      <div style="flex:1; display:flex; overflow:hidden;">

        <!-- Table area -->
        <div style="flex:1; overflow-y:auto; overflow-x:auto;">
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
        ${(function() {
          const sel = window._selectedItem
          const isPR = sel && sel.source === 'github' && sel.type === 'pr'
          const panelW = !sel ? '0' : isPR ? '800px' : '520px'
          const borderL = sel ? '1px solid var(--border)' : 'none'
          return `<div id="item-detail-panel" style="
            width:${panelW}; min-width:${panelW};
            overflow:hidden;
            border-left:${borderL};
            background:var(--bg-surface);
            transition:width 0.22s ease, min-width 0.22s ease;
            display:flex; flex-shrink:0;
          ">
            ${window._renderItemDetail(sel)}
          </div>`
        })()}
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

window._selectItem = function(uid) {
  const item = window._itemRegistry[uid]
  if (!item) return
  // Toggle off if same item clicked again
  if (window._selectedItem && window._selectedItem._uid === uid) {
    window._selectedItem = null
  } else {
    window._selectedItem = item
  }
  const dashView = (window._appState && window._appState.dashboardView) || 'all'
  window._renderDashboardUI(dashView)
}

window._closeItemDetail = function() {
  window._selectedItem = null
  const dashView = (window._appState && window._appState.dashboardView) || 'all'
  window._renderDashboardUI(dashView)
}

window._renderItemDetail = function(item) {
  if (!item) return ''
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
  return `<a href="${url}" style="
    display:flex; align-items:center; justify-content:center; gap:6px;
    padding:8px 12px; border-radius:var(--radius);
    background:var(--bg-raised); border:1px solid var(--border);
    color:var(--text-secondary); font-size:13px; font-weight:500;
    text-decoration:none; transition:border-color 0.15s, color 0.15s;
  " onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'"
     onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-secondary)'">
    <i data-lucide="external-link" style="width:13px; height:13px;"></i>
    ${label}
  </a>`
}

// ── Jira issue detail ────────────────────────────────────────────────────────
window._renderJiraDetail = function(item) {
  const activity = [
    { user: 'Sarah K.', action: 'changed status to', target: item.status, time: '2h ago', avatar: 'S' },
    { user: 'James T.', action: 'left a comment', target: 'Looks good, will pick this up in the next sprint.', time: '5h ago', avatar: 'J' },
    { user: 'Maya R.',  action: 'set priority to', target: item.priority, time: '1d ago', avatar: 'M' },
    { user: 'Dev Bot',  action: 'linked PR', target: '#184', time: '2d ago', avatar: 'D' },
  ]

  return `
    <div style="width:520px; min-width:520px; display:flex; flex-direction:column; height:100%; overflow-y:auto;">
      <div style="padding:16px 16px 0;">

        <!-- Header -->
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px; margin-bottom:12px;">
          <div style="flex:1; min-width:0;">
            <div style="margin-bottom:5px;">
              <span style="font-size:11px; font-weight:600; color:#60a5fa; background:rgba(59,130,246,0.1); padding:2px 7px; border-radius:4px;">Jira</span>
            </div>
            <div style="font-size:14px; font-weight:600; color:var(--text-primary); line-height:1.4; margin-bottom:3px;">${item.title}</div>
            <div style="font-size:12px; color:var(--text-muted); font-family:monospace;">${item.id}</div>
          </div>
          ${window._drawerCloseBtn()}
        </div>

        <div style="border-top:1px solid var(--border-subtle); margin-bottom:14px;"></div>

        <!-- Metadata -->
        <div style="display:flex; flex-direction:column; gap:9px; margin-bottom:16px;">
          ${window._drawerMetaRow('Status',    window._statusBadge(item.status))}
          ${window._drawerMetaRow('Priority',  window._priorityDot(item.priority))}
          ${window._drawerMetaRow('Assignee',  item.assignee || '—')}
          ${window._drawerMetaRow('Sprint',    item.sprint || '—')}
          ${window._drawerMetaRow('Due',       item.dueDate || '—')}
          ${window._drawerMetaRow('Workspace', item.workspace || '—')}
        </div>

        <div style="border-top:1px solid var(--border-subtle); margin-bottom:14px;"></div>

        <!-- Description -->
        <div style="margin-bottom:16px;">
          <div style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:8px;">Description</div>
          <div style="font-size:13px; color:var(--text-secondary); line-height:1.6; background:var(--bg-raised); border-radius:var(--radius); padding:10px 12px;">
            Implement the full authentication flow including login, logout, session persistence, and token refresh. Ensure compatibility with SSO providers configured per workspace.
          </div>
        </div>

        <div style="border-top:1px solid var(--border-subtle); margin-bottom:14px;"></div>

        <!-- Activity -->
        <div style="margin-bottom:16px;">
          <div style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:10px;">Activity</div>
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${activity.map(a => `
              <div style="display:flex; gap:9px;">
                <div style="
                  width:26px; height:26px; border-radius:50%; flex-shrink:0;
                  background:var(--bg-hover); border:1px solid var(--border);
                  display:flex; align-items:center; justify-content:center;
                  font-size:11px; font-weight:600; color:var(--text-secondary);
                ">${a.avatar}</div>
                <div style="flex:1; min-width:0;">
                  <div style="font-size:12px; color:var(--text-secondary); line-height:1.4;">
                    <span style="font-weight:600; color:var(--text-primary);">${a.user}</span>
                    ${a.action}
                    <span style="color:var(--accent);">${a.target}</span>
                  </div>
                  <div style="font-size:11px; color:var(--text-muted); margin-top:1px;">${a.time}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="border-top:1px solid var(--border-subtle); margin-bottom:14px;"></div>
        ${window._drawerOpenLink(item.url, 'Open in Jira')}
        <div style="height:16px;"></div>
      </div>
    </div>
  `
}

// ── GitHub Issue detail ──────────────────────────────────────────────────────
window._renderGHIssueDetail = function(item) {
  const comments = [
    { user: 'maya-r',  avatar: 'M', body: 'Can confirm this is happening on main too. Seems related to the session handler changes in #182.', time: '3h ago' },
    { user: 'james-t', avatar: 'J', body: 'I can take a look. Will need to check the auth middleware stack.', time: '1h ago' },
  ]
  const labels = item.status === 'Open' ? ['bug', 'needs-triage'] : ['resolved']

  return `
    <div style="width:520px; min-width:520px; display:flex; flex-direction:column; height:100%; overflow-y:auto;">
      <div style="padding:16px 16px 0;">

        <!-- Header -->
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px; margin-bottom:12px;">
          <div style="flex:1; min-width:0;">
            <div style="margin-bottom:5px;">
              <span style="font-size:11px; font-weight:600; color:#a78bfa; background:rgba(139,92,246,0.1); padding:2px 7px; border-radius:4px;">Issue</span>
            </div>
            <div style="font-size:14px; font-weight:600; color:var(--text-primary); line-height:1.4; margin-bottom:3px;">${item.title}</div>
            <div style="font-size:12px; color:var(--text-muted); font-family:monospace;">${item.repo}#${item.id}</div>
          </div>
          ${window._drawerCloseBtn()}
        </div>

        <div style="border-top:1px solid var(--border-subtle); margin-bottom:14px;"></div>

        <!-- Metadata -->
        <div style="display:flex; flex-direction:column; gap:9px; margin-bottom:16px;">
          ${window._drawerMetaRow('Status',  window._statusBadge(item.status))}
          ${window._drawerMetaRow('Repo',    `<span style="font-family:monospace;font-size:12px;">${item.repo}</span>`)}
          ${window._drawerMetaRow('Author',  item.author || '—')}
          ${window._drawerMetaRow('Updated', item.updatedAt || '—')}
          ${window._drawerMetaRow('Labels',  labels.map(l => `<span style="font-size:11px; padding:1px 7px; border-radius:10px; background:rgba(239,68,68,0.12); color:#f87171; margin-right:4px;">${l}</span>`).join(''))}
        </div>

        <div style="border-top:1px solid var(--border-subtle); margin-bottom:14px;"></div>

        <!-- Body -->
        <div style="margin-bottom:16px;">
          <div style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:8px;">Description</div>
          <div style="font-size:13px; color:var(--text-secondary); line-height:1.6; background:var(--bg-raised); border-radius:var(--radius); padding:10px 12px;">
            Getting a 500 error when calling <code style="background:var(--bg-hover);padding:1px 5px;border-radius:3px;font-size:12px;">POST /auth/reset-password</code> with a valid token. The error occurs inconsistently — roughly 30% of requests. Stack trace points to the session cleanup handler.
          </div>
        </div>

        <div style="border-top:1px solid var(--border-subtle); margin-bottom:14px;"></div>

        <!-- Comments -->
        <div style="margin-bottom:16px;">
          <div style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:10px;">Comments · ${comments.length}</div>
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${comments.map(c => `
              <div style="display:flex; gap:9px;">
                <div style="
                  width:26px; height:26px; border-radius:50%; flex-shrink:0;
                  background:var(--bg-hover); border:1px solid var(--border);
                  display:flex; align-items:center; justify-content:center;
                  font-size:11px; font-weight:600; color:var(--text-secondary);
                ">${c.avatar}</div>
                <div style="flex:1; min-width:0;">
                  <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                    <span style="font-size:12px; font-weight:600; color:var(--text-primary);">${c.user}</span>
                    <span style="font-size:11px; color:var(--text-muted);">${c.time}</span>
                  </div>
                  <div style="font-size:12px; color:var(--text-secondary); line-height:1.5; background:var(--bg-raised); border-radius:var(--radius); padding:8px 10px;">${c.body}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="border-top:1px solid var(--border-subtle); margin-bottom:14px;"></div>
        ${window._drawerOpenLink(item.url, 'Open in GitHub')}
        <div style="height:16px;"></div>
      </div>
    </div>
  `
}

// ── GitHub PR detail — split screen ─────────────────────────────────────────
window._renderPRDetail = function(item) {
  const mockFiles = [
    { path: 'src/auth/session.ts',       additions: 24, deletions: 8,  selected: true },
    { path: 'src/auth/middleware.ts',     additions: 12, deletions: 3,  selected: false },
    { path: 'src/api/routes/auth.ts',     additions: 6,  deletions: 1,  selected: false },
    { path: 'tests/auth.test.ts',         additions: 41, deletions: 0,  selected: false },
    { path: 'package.json',               additions: 2,  deletions: 2,  selected: false },
  ]

  const mockDiff = [
    { type: 'header',  text: '@ src/auth/session.ts' },
    { type: 'context', text: '  import { Redis } from "ioredis"', ln: 1 },
    { type: 'context', text: '  import { SessionConfig } from "./types"', ln: 2 },
    { type: 'context', text: '', ln: 3 },
    { type: 'del',     text: '- export async function destroySession(id: string) {', ln: 4 },
    { type: 'del',     text: '-   await redis.del(id)', ln: 5 },
    { type: 'del',     text: '- }', ln: 6 },
    { type: 'add',     text: '+ export async function destroySession(', ln: null },
    { type: 'add',     text: '+   id: string,', ln: null },
    { type: 'add',     text: '+   opts: { force?: boolean } = {}', ln: null },
    { type: 'add',     text: '+ ) {', ln: null },
    { type: 'add',     text: '+   const key = `session:${id}`', ln: null },
    { type: 'add',     text: '+   if (opts.force || await redis.exists(key)) {', ln: null },
    { type: 'add',     text: '+     await redis.del(key)', ln: null },
    { type: 'add',     text: '+     await redis.publish("session:expired", id)', ln: null },
    { type: 'add',     text: '+   }', ln: null },
    { type: 'add',     text: '+ }', ln: null },
    { type: 'context', text: '', ln: 14 },
    { type: 'context', text: '  export async function refreshSession(id: string) {', ln: 15 },
    { type: 'context', text: '    const session = await redis.get(`session:${id}`)', ln: 16 },
    { type: 'del',     text: '-   if (!session) throw new Error("Not found")', ln: 17 },
    { type: 'add',     text: '+   if (!session) return null', ln: null },
    { type: 'context', text: '    return JSON.parse(session)', ln: 18 },
    { type: 'context', text: '  }', ln: 19 },
  ]

  const mockReviews = [
    { user: 'sarah-k', avatar: 'S', state: 'approved',         time: '1h ago' },
    { user: 'james-t', avatar: 'J', state: 'changes-requested', time: '3h ago' },
  ]

  const reviewStateStyle = {
    'approved':           { color: 'var(--success)', bg: 'var(--success-muted)', icon: 'check-circle', label: 'Approved' },
    'changes-requested':  { color: 'var(--danger)',  bg: 'var(--danger-muted)',  icon: 'x-circle',     label: 'Changes requested' },
  }

  const totalAdd = mockFiles.reduce((s, f) => s + f.additions, 0)
  const totalDel = mockFiles.reduce((s, f) => s + f.deletions, 0)

  // Left pane: metadata + file list + reviews
  const leftPane = `
    <div style="
      width:300px; min-width:300px; flex-shrink:0;
      border-right:1px solid var(--border);
      display:flex; flex-direction:column; height:100%; overflow-y:auto;
    ">
      <div style="padding:14px 14px 0;">

        <!-- Header -->
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:6px; margin-bottom:10px;">
          <div style="flex:1; min-width:0;">
            <div style="margin-bottom:5px; display:flex; align-items:center; gap:6px;">
              <span style="font-size:11px; font-weight:600; color:#818cf8; background:rgba(99,102,241,0.12); padding:2px 7px; border-radius:4px;">PR</span>
              ${window._statusBadge(item.status)}
            </div>
            <div style="font-size:13px; font-weight:600; color:var(--text-primary); line-height:1.4; margin-bottom:2px;">${item.title}</div>
            <div style="font-size:11px; color:var(--text-muted); font-family:monospace;">${item.repo}#${item.id}</div>
          </div>
          ${window._drawerCloseBtn()}
        </div>

        <div style="border-top:1px solid var(--border-subtle); margin-bottom:12px;"></div>

        <!-- Meta -->
        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:14px;">
          ${window._drawerMetaRow('Author',  item.author || '—')}
          ${window._drawerMetaRow('Repo',    `<span style="font-family:monospace;font-size:11px;">${item.repo}</span>`)}
          ${window._drawerMetaRow('Updated', item.updatedAt || '—')}
        </div>

        <div style="border-top:1px solid var(--border-subtle); margin-bottom:12px;"></div>

        <!-- Stats -->
        <div style="display:flex; gap:10px; margin-bottom:14px;">
          <div style="display:flex; align-items:center; gap:5px;">
            <i data-lucide="file-diff" style="width:13px;height:13px;color:var(--text-muted);"></i>
            <span style="font-size:12px; color:var(--text-muted);">${mockFiles.length} files</span>
          </div>
          <span style="font-size:12px; color:var(--success);">+${totalAdd}</span>
          <span style="font-size:12px; color:var(--danger);">−${totalDel}</span>
        </div>

        <!-- Reviews -->
        <div style="margin-bottom:14px;">
          <div style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:8px;">Reviews</div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${mockReviews.map(r => {
              const st = reviewStateStyle[r.state]
              return `<div style="display:flex; align-items:center; gap:8px; padding:6px 8px; background:${st.bg}; border-radius:var(--radius);">
                <div style="width:22px;height:22px;border-radius:50%;background:var(--bg-hover);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:var(--text-secondary);">${r.avatar}</div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:12px;font-weight:500;color:var(--text-primary);">${r.user}</div>
                  <div style="font-size:11px;color:${st.color};">${st.label}</div>
                </div>
                <i data-lucide="${st.icon}" style="width:13px;height:13px;color:${st.color};flex-shrink:0;"></i>
              </div>`
            }).join('')}
          </div>
        </div>

        <div style="border-top:1px solid var(--border-subtle); margin-bottom:12px;"></div>

        <!-- File list -->
        <div style="margin-bottom:14px;">
          <div style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:8px;">Changed Files</div>
          <div style="display:flex; flex-direction:column; gap:2px;">
            ${mockFiles.map((f, idx) => `
              <div onclick="window._prSelectFile(${idx})" style="
                display:flex; align-items:center; gap:6px;
                padding:5px 6px; border-radius:var(--radius); cursor:pointer;
                background:${f.selected ? 'var(--accent-muted)' : 'transparent'};
                border-left:2px solid ${f.selected ? 'var(--accent)' : 'transparent'};
                transition:background 0.1s;
              " onmouseover="if(!${f.selected})this.style.background='var(--bg-hover)'" onmouseout="if(!${f.selected})this.style.background='transparent'">
                <i data-lucide="file-code" style="width:12px;height:12px;color:var(--text-muted);flex-shrink:0;"></i>
                <span style="font-size:11px; color:var(--text-secondary); font-family:monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">${f.path.split('/').pop()}</span>
                <span style="font-size:10px; color:var(--success); flex-shrink:0;">+${f.additions}</span>
                <span style="font-size:10px; color:var(--danger); flex-shrink:0;">−${f.deletions}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="border-top:1px solid var(--border-subtle); margin-bottom:12px;"></div>
        ${window._drawerOpenLink(item.url, 'Open in GitHub')}
        <div style="height:14px;"></div>
      </div>
    </div>
  `

  // Right pane: diff viewer
  const diffBg  = { add: 'rgba(16,185,129,0.08)', del: 'rgba(239,68,68,0.08)', header: 'rgba(99,102,241,0.08)', context: 'transparent' }
  const diffCol  = { add: 'var(--success)', del: 'var(--danger)', header: 'var(--accent)', context: 'var(--text-secondary)' }

  const rightPane = `
    <div style="flex:1; min-width:0; display:flex; flex-direction:column; height:100%; overflow:hidden;">

      <!-- Diff toolbar -->
      <div style="
        padding:8px 14px; background:var(--bg-surface);
        border-bottom:1px solid var(--border); flex-shrink:0;
        display:flex; align-items:center; gap:8px;
      ">
        <i data-lucide="file-code" style="width:13px;height:13px;color:var(--text-muted);"></i>
        <span style="font-size:12px; color:var(--text-secondary); font-family:monospace; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${mockFiles[0].path}</span>
        <span style="font-size:11px; color:var(--success);">+${mockFiles[0].additions}</span>
        <span style="font-size:11px; color:var(--danger);">−${mockFiles[0].deletions}</span>
      </div>

      <!-- Diff lines -->
      <div style="flex:1; overflow-y:auto; font-family:monospace; font-size:12px;">
        ${mockDiff.map((line, i) => `
          <div style="
            display:flex; align-items:stretch;
            background:${diffBg[line.type]};
            border-bottom:1px solid rgba(255,255,255,0.02);
            min-height:20px;
          ">
            <div style="
              width:32px; flex-shrink:0; padding:2px 6px;
              font-size:11px; color:var(--text-muted);
              border-right:1px solid var(--border-subtle);
              text-align:right; user-select:none;
            ">${line.ln || ''}</div>
            <div style="
              flex:1; padding:2px 10px; white-space:pre;
              color:${diffCol[line.type]}; overflow-x:auto;
            ">${line.text}</div>
            ${line.type !== 'header' ? `
              <div class="add-comment-btn" style="
                width:22px; flex-shrink:0; padding:2px 4px;
                display:flex; align-items:center; justify-content:center;
                opacity:0; transition:opacity 0.1s; cursor:pointer;
              " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'"
                 title="Add comment">
                <i data-lucide="message-circle" style="width:12px;height:12px;color:var(--accent);"></i>
              </div>
            ` : '<div style="width:22px;"></div>'}
          </div>
        `).join('')}

        <!-- Inline comment box mock -->
        <div style="margin:10px 12px; background:var(--bg-raised); border:1px solid var(--border); border-radius:var(--radius);">
          <div style="padding:8px 10px; border-bottom:1px solid var(--border-subtle); display:flex; align-items:center; gap:8px;">
            <div style="width:22px;height:22px;border-radius:50%;background:var(--accent-muted);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:var(--accent);">Y</div>
            <span style="font-size:12px; color:var(--text-muted);">Leave a comment on line 8…</span>
          </div>
          <div style="padding:6px 10px 8px; display:flex; justify-content:flex-end; gap:6px;">
            <button style="padding:4px 10px; background:transparent; border:1px solid var(--border); border-radius:var(--radius); font-size:12px; color:var(--text-muted); cursor:pointer; font-family:'IBM Plex Sans',sans-serif;">Cancel</button>
            <button style="padding:4px 10px; background:var(--accent); border:none; border-radius:var(--radius); font-size:12px; font-weight:600; color:#fff; cursor:pointer; font-family:'IBM Plex Sans',sans-serif;">Comment</button>
          </div>
        </div>
      </div>
    </div>
  `

  return leftPane + rightPane
}

window._prSelectFile = function(idx) {
  // Re-render with new selected file — for now just re-render the whole panel
  // In Phase 2 this would swap the diff content
  const dashView = (window._appState && window._appState.dashboardView) || 'all'
  window._renderDashboardUI(dashView)
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

window._renderAllTable = function(items) {
  window._itemRegistry = {}
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
          <tr style="cursor:pointer; transition:background 0.1s; background:${isSelected ? 'var(--accent-muted)' : 'transparent'};"
            onmouseover="if(!${isSelected}) this.style.background='var(--bg-hover)'"
            onmouseout="if(!${isSelected}) this.style.background='transparent'"
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
  window._itemRegistry = {}
  items.forEach(item => {
    const uid = 'j-' + item.id
    window._itemRegistry[uid] = { ...item, _uid: uid, source: 'jira' }
  })
  return `
    <table style="width:100%; border-collapse:collapse; min-width:700px;">
      <thead>
        <tr>
          <th style="${thStyle}">ID</th>
          <th style="${thStyle}">Title</th>
          <th style="${thStyle}">Status</th>
          <th style="${thStyle}">Priority</th>
          <th style="${thStyle}">Assignee</th>
          <th style="${thStyle}">Sprint</th>
          <th style="${thStyle}">Due Date</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => {
          const uid = 'j-' + item.id
          const isSelected = window._selectedItem && window._selectedItem._uid === uid
          return `
          <tr style="cursor:pointer; transition:background 0.1s; background:${isSelected ? 'var(--accent-muted)' : 'transparent'};"
            onmouseover="if(!${isSelected}) this.style.background='var(--bg-hover)'"
            onmouseout="if(!${isSelected}) this.style.background='transparent'"
            onclick="window._selectItem('${uid}')"
          >
            <td style="${tdStyle} font-family:monospace; color:var(--text-muted);">${item.id}</td>
            <td style="${tdStyle} max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.title}</td>
            <td style="${tdStyle}">${window._statusBadge(item.status)}</td>
            <td style="${tdStyle}">${window._priorityDot(item.priority)}</td>
            <td style="${tdStyle} color:var(--text-secondary);">${item.assignee || '—'}</td>
            <td style="${tdStyle} color:var(--text-muted);">${item.sprint || '—'}</td>
            <td style="${tdStyle} color:var(--text-muted); white-space:nowrap;">${item.dueDate || '—'}</td>
          </tr>
        `}).join('')}
      </tbody>
    </table>
  `
}

// ─── Calendar ────────────────────────────────────────────────────────────────

window._calState = {
  year: new Date().getFullYear(),
  month: new Date().getMonth(), // 0-indexed
  selectedDay: null,
  accountFilter: 'all',
  workspaceFilter: 'all'
}

window._renderCalendarUI = function() {
  const container = document.querySelector('[data-view="dashboard"]')
  if (!container) return

  const cs = window._calState
  const events = window._appState.calendarItems || []

  const accounts = [...new Set(events.map(e => e.account))]
  const workspaces = [...new Set(events.map(e => e.workspace))]

  // Filter events
  let filtered = events
  if (cs.accountFilter !== 'all') filtered = filtered.filter(e => e.account === cs.accountFilter)
  if (cs.workspaceFilter !== 'all') filtered = filtered.filter(e => e.workspace === cs.workspaceFilter)

  const monthName = new Date(cs.year, cs.month, 1).toLocaleString('default', { month: 'long', year: 'numeric' })

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; height:100%; overflow:hidden;">

      <!-- Toolbar -->
      <div style="
        padding:12px 20px; background:var(--bg-surface);
        border-bottom:1px solid var(--border);
        display:flex; align-items:center; gap:12px; flex-shrink:0;
      ">
        <!-- Month nav -->
        <div style="display:flex; align-items:center; gap:4px;">
          <button onclick="window._calNav(-1)" style="
            width:28px; height:28px; border-radius:var(--radius);
            background:transparent; border:1px solid var(--border);
            color:var(--text-secondary); cursor:pointer; display:flex; align-items:center; justify-content:center;
            transition:border-color 0.15s;
          " onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
            <i data-lucide="chevron-left" style="width:13px; height:13px;"></i>
          </button>
          <span style="font-size:14px; font-weight:600; color:var(--text-primary); min-width:148px; text-align:center;">${monthName}</span>
          <button onclick="window._calNav(1)" style="
            width:28px; height:28px; border-radius:var(--radius);
            background:transparent; border:1px solid var(--border);
            color:var(--text-secondary); cursor:pointer; display:flex; align-items:center; justify-content:center;
            transition:border-color 0.15s;
          " onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
            <i data-lucide="chevron-right" style="width:13px; height:13px;"></i>
          </button>
        </div>

        <button onclick="window._calGoToday()" style="
          padding:5px 12px; border-radius:var(--radius);
          background:transparent; border:1px solid var(--border);
          color:var(--text-secondary); font-size:12px; font-weight:600;
          font-family:'IBM Plex Sans',sans-serif; cursor:pointer;
          transition:border-color 0.15s;
        " onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">Today</button>

        <div style="flex:1;"></div>

        <!-- Source legend -->
        <div style="display:flex; align-items:center; gap:12px; margin-right:4px;">
          <span style="display:flex; align-items:center; gap:5px; font-size:12px; color:var(--text-muted);">
            <img src="../assets/google-calendar.svg" style="width:13px; height:13px; opacity:0.8;" /> Google Cal
          </span>
          <span style="display:flex; align-items:center; gap:5px; font-size:12px; color:var(--text-muted);">
            <img src="../assets/outlook.svg" style="width:13px; height:13px; opacity:0.8;" /> Outlook
          </span>
        </div>

        <!-- Account filter -->
        <select onchange="window._calFilter('account', this.value)" style="
          background:var(--bg-raised); border:1px solid var(--border);
          border-radius:var(--radius); padding:6px 10px;
          font-size:12px; color:var(--text-primary);
          font-family:'IBM Plex Sans',sans-serif; outline:none; cursor:pointer;
        ">
          <option value="all" ${cs.accountFilter === 'all' ? 'selected' : ''}>All Accounts</option>
          ${accounts.map(a => `<option value="${a}" ${cs.accountFilter === a ? 'selected' : ''}>${a}</option>`).join('')}
        </select>

        <!-- Workspace filter -->
        <select onchange="window._calFilter('workspace', this.value)" style="
          background:var(--bg-raised); border:1px solid var(--border);
          border-radius:var(--radius); padding:6px 10px;
          font-size:12px; color:var(--text-primary);
          font-family:'IBM Plex Sans',sans-serif; outline:none; cursor:pointer;
        ">
          <option value="all" ${cs.workspaceFilter === 'all' ? 'selected' : ''}>All Workspaces</option>
          ${workspaces.map(w => `<option value="${w}" ${cs.workspaceFilter === w ? 'selected' : ''}>${w}</option>`).join('')}
        </select>
      </div>

      <!-- Calendar grid + detail panel -->
      <div style="flex:1; display:flex; overflow:hidden;">

        <!-- Grid -->
        <div style="flex:1; overflow-y:auto; padding:0;">
          ${window._renderCalGrid(cs.year, cs.month, filtered, cs.selectedDay)}
        </div>

        <!-- Day detail panel -->
        <div id="cal-detail" style="
          width:260px; min-width:260px; flex-shrink:0;
          border-left:1px solid var(--border);
          background:var(--bg-surface);
          overflow-y:auto;
          transition:width 0.2s;
        ">
          ${window._renderDayDetail(cs.selectedDay, filtered)}
        </div>
      </div>
    </div>
  `

  if (typeof lucide !== 'undefined') lucide.createIcons()
}

window._renderCalGrid = function(year, month, events, selectedDay) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = firstDay.getDay() // 0=Sun
  const totalDays = lastDay.getDate()
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

  // Build a map: dateStr → events[]
  const eventMap = {}
  events.forEach(ev => {
    const dateStr = ev.start.slice(0, 10)
    if (!eventMap[dateStr]) eventMap[dateStr] = []
    eventMap[dateStr].push(ev)
  })

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  let cells = ''

  // Empty cells before month start
  for (let i = 0; i < startDow; i++) {
    cells += `<div style="min-height:90px; padding:6px; background:var(--bg-base); border-right:1px solid var(--border-subtle); border-bottom:1px solid var(--border-subtle);"></div>`
  }

  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const dayEvents = eventMap[dateStr] || []
    const isToday = dateStr === todayStr
    const isSelected = dateStr === selectedDay
    const isWeekend = (startDow + d - 1) % 7 === 0 || (startDow + d - 1) % 7 === 6

    cells += `
      <div onclick="window._calSelectDay('${dateStr}')" style="
        min-height:90px; padding:6px; cursor:pointer;
        background:${isSelected ? 'var(--accent-muted)' : isWeekend ? 'rgba(255,255,255,0.01)' : 'var(--bg-base)'};
        border-right:1px solid var(--border-subtle);
        border-bottom:1px solid var(--border-subtle);
        border-left:${isSelected ? '2px solid var(--accent)' : '2px solid transparent'};
        transition:background 0.1s;
      " onmouseover="if(!${isSelected}) this.style.background='var(--bg-hover)'" onmouseout="if(!${isSelected}) this.style.background='${isWeekend ? 'rgba(255,255,255,0.01)' : 'var(--bg-base)'}'">
        <div style="
          font-size:12px; font-weight:${isToday ? '700' : '400'};
          color:${isToday ? '#fff' : isSelected ? 'var(--accent)' : isWeekend ? 'var(--text-muted)' : 'var(--text-secondary)'};
          margin-bottom:4px;
          ${isToday ? `background:var(--accent); width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center;` : ''}
        ">${d}</div>
        <div style="display:flex; flex-direction:column; gap:2px;">
          ${dayEvents.slice(0, 3).map(ev => `
            <div style="
              font-size:11px; color:#fff;
              background:${ev.color || 'var(--accent)'};
              border-radius:3px; padding:1px 5px;
              white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
              opacity:0.9;
            ">
              ${ev.allDay ? '' : `<span style="opacity:0.75;">${window._fmtTime(ev.start)} </span>`}${ev.title}
            </div>
          `).join('')}
          ${dayEvents.length > 3 ? `<div style="font-size:10px; color:var(--text-muted); padding-left:2px;">+${dayEvents.length - 3} more</div>` : ''}
        </div>
      </div>
    `
  }

  // Fill trailing cells to complete the last row
  const totalCells = startDow + totalDays
  const remainder = totalCells % 7
  if (remainder !== 0) {
    for (let i = 0; i < 7 - remainder; i++) {
      cells += `<div style="min-height:90px; padding:6px; background:var(--bg-base); border-right:1px solid var(--border-subtle); border-bottom:1px solid var(--border-subtle);"></div>`
    }
  }

  return `
    <div style="display:grid; grid-template-columns:repeat(7,1fr); border-top:1px solid var(--border); border-left:1px solid var(--border-subtle);">
      ${days.map(d => `
        <div style="
          padding:8px 8px 6px; text-align:left;
          font-size:11px; font-weight:600; color:var(--text-muted);
          text-transform:uppercase; letter-spacing:0.06em;
          background:var(--bg-surface); border-right:1px solid var(--border-subtle);
          border-bottom:1px solid var(--border); position:sticky; top:0; z-index:1;
        ">${d}</div>
      `).join('')}
      ${cells}
    </div>
  `
}

window._renderDayDetail = function(dateStr, events) {
  if (!dateStr) {
    return `
      <div style="
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        height:100%; padding:24px; text-align:center;
      ">
        <i data-lucide="calendar" style="width:28px; height:28px; color:var(--text-muted); margin-bottom:12px;"></i>
        <p style="font-size:13px; color:var(--text-muted); margin:0;">Select a day to see its events.</p>
      </div>
    `
  }

  const date = new Date(dateStr + 'T00:00:00')
  const label = date.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })
  const dayEvents = events.filter(e => e.start.slice(0, 10) === dateStr)
    .sort((a, b) => a.start.localeCompare(b.start))

  const sourceIcon = {
    gcal: `<img src="../assets/google-calendar.svg" style="width:12px;height:12px;flex-shrink:0;" />`,
    outlook: `<img src="../assets/outlook.svg" style="width:12px;height:12px;flex-shrink:0;" />`
  }

  return `
    <div style="padding:16px;">
      <div style="font-size:13px; font-weight:600; color:var(--text-primary); margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid var(--border-subtle);">${label}</div>
      ${dayEvents.length === 0
        ? `<div style="font-size:12px; color:var(--text-muted); text-align:center; padding:24px 0;">No events</div>`
        : dayEvents.map(ev => `
          <div style="
            margin-bottom:8px; padding:10px 12px;
            background:var(--bg-raised); border-radius:var(--radius);
            border-left:3px solid ${ev.color || 'var(--accent)'};
          ">
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:6px; margin-bottom:4px;">
              <div style="font-size:13px; font-weight:500; color:var(--text-primary); line-height:1.3;">${ev.title}</div>
              ${sourceIcon[ev.source] || ''}
            </div>
            <div style="font-size:11px; color:var(--text-muted);">
              ${ev.allDay
                ? `<span style="color:var(--accent);">All day</span>`
                : `${window._fmtTime(ev.start)} – ${window._fmtTime(ev.end)}`
              }
            </div>
            ${ev.account ? `<div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${ev.account}</div>` : ''}
            ${ev.workspace ? `<div style="display:inline-block; margin-top:5px; font-size:10px; font-weight:600; color:var(--text-muted); background:var(--bg-hover); border-radius:3px; padding:1px 6px;">${ev.workspace}</div>` : ''}
          </div>
        `).join('')
      }
    </div>
  `
}

window._fmtTime = function(isoStr) {
  if (!isoStr || !isoStr.includes('T')) return ''
  const d = new Date(isoStr)
  return d.toLocaleTimeString('default', { hour: 'numeric', minute: '2-digit', hour12: true })
}

window._calNav = function(delta) {
  window._calState.month += delta
  if (window._calState.month > 11) { window._calState.month = 0; window._calState.year++ }
  if (window._calState.month < 0)  { window._calState.month = 11; window._calState.year-- }
  window._calState.selectedDay = null
  window._renderCalendarUI()
}

window._calGoToday = function() {
  const now = new Date()
  window._calState.year = now.getFullYear()
  window._calState.month = now.getMonth()
  window._calState.selectedDay = null
  window._renderCalendarUI()
}

window._calSelectDay = function(dateStr) {
  window._calState.selectedDay = window._calState.selectedDay === dateStr ? null : dateStr
  // Re-render just the grid and panel cheaply
  window._renderCalendarUI()
}

window._calFilter = function(key, value) {
  window._calState[key + 'Filter'] = value
  window._renderCalendarUI()
}

// ─── GitHub table ─────────────────────────────────────────────────────────────

window._renderGithubTable = function(items) {
  window._itemRegistry = {}
  items.forEach(item => {
    const uid = 'gh-' + item.id
    window._itemRegistry[uid] = { ...item, _uid: uid, source: 'github' }
  })
  return `
    <table style="width:100%; border-collapse:collapse; min-width:600px;">
      <thead>
        <tr>
          <th style="${thStyle}">Repo</th>
          <th style="${thStyle}">Title</th>
          <th style="${thStyle}">Type</th>
          <th style="${thStyle}">Status</th>
          <th style="${thStyle}">Author</th>
          <th style="${thStyle}">Updated</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => {
          const uid = 'gh-' + item.id
          const isSelected = window._selectedItem && window._selectedItem._uid === uid
          return `
          <tr style="cursor:pointer; transition:background 0.1s; background:${isSelected ? 'var(--accent-muted)' : 'transparent'};"
            onmouseover="if(!${isSelected}) this.style.background='var(--bg-hover)'"
            onmouseout="if(!${isSelected}) this.style.background='transparent'"
            onclick="window._selectItem('${uid}')"
          >
            <td style="${tdStyle} color:var(--text-muted); white-space:nowrap; font-size:12px;">${item.repo || '—'}</td>
            <td style="${tdStyle} max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.title}</td>
            <td style="${tdStyle}">${window._typeBadge(item.type)}</td>
            <td style="${tdStyle}">${window._statusBadge(item.status)}</td>
            <td style="${tdStyle} color:var(--text-secondary);">${item.author || '—'}</td>
            <td style="${tdStyle} color:var(--text-muted); white-space:nowrap;">${window.timeAgo(item.updatedAt)}</td>
          </tr>
        `}).join('')}
      </tbody>
    </table>
  `
}
