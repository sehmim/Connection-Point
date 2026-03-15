window._settingsState = {
  section: 'partitions',    // 'partitions' | 'tracking' | 'general'
}

window.renderSettings = function() {
  const container = document.querySelector('[data-view="settings"]')
  if (!container) return
  if (window._settingsState.section === 'partitions' && window._settingsPartitionsCache === null) {
    window._renderSettingsUI()
    window._loadPartitions()
  } else {
    window._renderSettingsUI()
  }
}

window._renderSettingsUI = function() {
  const container = document.querySelector('[data-view="settings"]')
  if (!container) return

  const s = window._settingsState

  container.innerHTML = `
    <div style="display:flex; height:100%; overflow:hidden;">

      <!-- ── Left nav ── -->
      <div style="
        width:180px; min-width:180px; flex-shrink:0;
        background:var(--bg-surface); border-right:1px solid var(--border);
        display:flex; flex-direction:column; padding:20px 8px;
        overflow-y:auto;
      ">
        <div style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em; padding:0 8px; margin-bottom:8px;">Settings</div>

        ${[
          { id: 'partitions', icon: 'layers', label: 'Partitions' },
          { id: 'tracking',   icon: 'git-branch', label: 'Tracking Sites' },
          { id: 'general',    icon: 'sliders-horizontal', label: 'General' },
        ].map(item => `
          <div
            onclick="window._settingsNav('${item.id}')"
            style="
              display:flex; align-items:center; gap:8px;
              padding:7px 10px; border-radius:6px; cursor:pointer;
              font-size:13px; margin-bottom:1px;
              border-left:2px solid ${s.section === item.id ? 'var(--accent)' : 'transparent'};
              background:${s.section === item.id ? 'var(--bg-raised)' : 'transparent'};
              color:${s.section === item.id ? 'var(--text-primary)' : 'var(--text-secondary)'};
              transition:background 0.1s;
            "
            onmouseover="if('${s.section}' !== '${item.id}') { this.style.background='var(--bg-hover)' }"
            onmouseout="if('${s.section}' !== '${item.id}') { this.style.background='transparent' }"
          >
            <i data-lucide="${item.icon}" style="width:14px; height:14px; flex-shrink:0;"></i>
            <span>${item.label}</span>
          </div>
        `).join('')}
      </div>

      <!-- ── Right content ── -->
      <div style="flex:1; overflow-y:auto; background:var(--bg-base);">
        <div style="max-width:640px; padding:32px 36px;">
          ${s.section === 'partitions' ? window._renderSettingsPartitions() : s.section === 'tracking' ? window._renderSettingsTrackingSites() : window._renderSettingsGeneral()}
        </div>
      </div>

    </div>
  `

  if (typeof lucide !== 'undefined') lucide.createIcons()
}

window._settingsNav = function(section) {
  window._settingsState.section = section
  if (section === 'tracking') {
    window._settingsTrackingRepos = null
    window._loadTrackingRepos()
    return
  }
  if (section === 'partitions') {
    window._settingsPartitionsCache = null
    window._renderSettingsUI()
    window._loadPartitions()
    return
  }
  window._renderSettingsUI()
}

window._settingsTrackingRepos = null      // GitHub repos loaded from DB
window._settingsTrackingBoards = null     // Jira boards loaded from DB
window._settingsTrackingCalendars = null  // Google Calendar sources loaded from DB

window._loadTrackingRepos = function() {
  window._settingsTrackingRepos = null
  window._settingsTrackingBoards = null
  window._settingsTrackingCalendars = null

  var ghPromise = (window.api && window.api.githubGetData)
    ? window.api.githubGetData().then(function(d) { window._settingsTrackingRepos = d.repos || [] }).catch(function() { window._settingsTrackingRepos = [] })
    : Promise.resolve().then(function() { window._settingsTrackingRepos = [] })

  var jiraPromise = (window.api && window.api.jiraGetData)
    ? window.api.jiraGetData().then(function(d) { window._settingsTrackingBoards = d.boards || [] }).catch(function() { window._settingsTrackingBoards = [] })
    : Promise.resolve().then(function() { window._settingsTrackingBoards = [] })

  var calPromise = (window.api && window.api.calendarGetData)
    ? window.api.calendarGetData().then(function(d) { window._settingsTrackingCalendars = d.sources || [] }).catch(function() { window._settingsTrackingCalendars = [] })
    : Promise.resolve().then(function() { window._settingsTrackingCalendars = [] })

  Promise.all([ghPromise, jiraPromise, calPromise]).then(function() {
    window._renderSettingsUI()
  })
}

// ── Partitions section ────────────────────────────────────────────────────────

window._settingsPartitionsCache = null  // null = loading, [] = loaded

window._loadPartitions = function() {
  if (window.api && window.api.listPartitions) {
    window.api.listPartitions().then(function(res) {
      window._settingsPartitionsCache = res.partitions || []
      window._renderSettingsUI()
    }).catch(function() {
      window._settingsPartitionsCache = []
      window._renderSettingsUI()
    })
  } else {
    window._settingsPartitionsCache = []
    window._renderSettingsUI()
  }
}

window._renderSettingsPartitions = function() {
  const cache = window._settingsPartitionsCache
  const partitions = cache || []

  const typeLogo  = { github: '../assets/github.svg', jira: '../assets/jira.svg', calendar: '../assets/google-calendar.svg' }
  const typeLabel = { github: 'GitHub', jira: 'Jira', calendar: 'Google Calendar' }

  return `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
      <h2 style="font-size:18px; font-weight:600; color:var(--text-primary); margin:0;">Partitions</h2>
      <button
        onclick="window._settingsPartitionsCache=null; window._renderSettingsUI(); window._loadPartitions()"
        style="
          display:flex; align-items:center; gap:5px;
          padding:6px 12px;
          background:transparent; color:var(--accent);
          border:1px solid var(--accent); border-radius:var(--radius);
          font-size:12px; font-weight:600;
          font-family:'IBM Plex Sans',sans-serif;
          cursor:pointer; transition:background 0.15s;
        "
        onmouseover="this.style.background='var(--accent-muted)'"
        onmouseout="this.style.background='transparent'"
      >
        <i data-lucide="refresh-cw" style="width:11px; height:11px;"></i>
        Refresh
      </button>
    </div>
    <p style="font-size:13px; color:var(--text-muted); margin:0 0 24px;">Active Electron session partitions — one per connected site. Each partition holds its own cookies and login state.</p>

    ${cache === null ? `
      <div style="display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text-muted);">
        <div style="
          width:12px; height:12px; border-radius:50%;
          border:2px solid var(--border); border-top-color:var(--accent);
          animation:spin 0.7s linear infinite; flex-shrink:0;
        "></div>
        Loading…
      </div>
    ` : partitions.length === 0 ? `
      <div style="
        border:1px dashed var(--border); border-radius:var(--radius-lg);
        padding:48px 32px; text-align:center;
      ">
        <i data-lucide="layers" style="width:32px; height:32px; color:var(--text-muted); opacity:0.3; margin-bottom:12px;"></i>
        <div style="font-size:14px; color:var(--text-secondary); margin-bottom:6px;">No partitions yet</div>
        <div style="font-size:13px; color:var(--text-muted);">Connect a GitHub repo, Jira board, or calendar account in Tracking Sites to create one.</div>
      </div>
    ` : `
      <div style="border:1px solid var(--border); border-radius:var(--radius-lg); overflow:hidden;">
        ${partitions.map(function(p, idx) {
          const logo  = typeLogo[p.type]  || ''
          const tLabel = typeLabel[p.type] || p.type
          return `
            <div style="
              padding:14px 18px;
              ${idx < partitions.length - 1 ? 'border-bottom:1px solid var(--border-subtle);' : ''}
            ">
              <div style="display:flex; align-items:center; gap:10px;">
                ${logo ? `<img src="${logo}" style="width:15px; height:15px; object-fit:contain; flex-shrink:0;" onerror="this.style.display='none'">` : ''}
                <div style="flex:1; min-width:0;">
                  <div style="display:flex; align-items:center; gap:8px; margin-bottom:3px;">
                    <span style="font-size:13px; font-weight:600; color:var(--text-primary);">${p.label}</span>
                    <span style="
                      font-size:10px; font-weight:600; padding:1px 7px;
                      border-radius:10px; background:var(--accent-muted); color:var(--accent);
                      text-transform:uppercase; letter-spacing:0.05em; flex-shrink:0;
                    ">${tLabel}</span>
                  </div>
                  <div style="
                    font-size:11px; color:var(--text-muted);
                    font-family:'IBM Plex Mono',monospace;
                  ">${p.partition}</div>
                </div>
              </div>
              ${p.sources && p.sources.length > 0 ? `
                <div style="margin-top:10px; padding-left:25px; display:flex; flex-direction:column; gap:4px;">
                  ${p.sources.map(function(s) { return `
                    <div style="display:flex; align-items:center; gap:6px;">
                      <i data-lucide="corner-down-right" style="width:11px; height:11px; color:var(--text-muted); flex-shrink:0;"></i>
                      <span style="font-size:12px; color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${s.url}">${s.label}</span>
                    </div>
                  `}).join('')}
                </div>
              ` : ''}
            </div>
          `
        }).join('')}
      </div>
    `}
  `
}

// ── Tracking Sites section ────────────────────────────────────────────────────

window._renderSettingsTrackingSites = function() {
  const repos = window._settingsTrackingRepos
  const boards = window._settingsTrackingBoards
  const calendars = window._settingsTrackingCalendars

  if (repos === null || boards === null || calendars === null) {
    return `
      <h2 style="font-size:18px; font-weight:600; color:var(--text-primary); margin:0 0 4px;">Tracking Sites</h2>
      <p style="font-size:13px; color:var(--text-muted); margin:0 0 24px;">GitHub repositories, Jira boards, and Google Calendar accounts.</p>
      <div style="color:var(--text-muted); font-size:13px;">Loading…</div>
    `
  }

  return `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
      <h2 style="font-size:18px; font-weight:600; color:var(--text-primary); margin:0;">Tracking Sites</h2>
    </div>
    <p style="font-size:13px; color:var(--text-muted); margin:0 0 28px;">Add GitHub repos, Jira boards, and Google Calendar accounts. Each uses its own browser session.</p>

    <!-- ── GitHub section ── -->
    <div style="margin-bottom:32px;">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
        <img src="../assets/github.svg" style="width:14px; height:14px; object-fit:contain;"
          onerror="this.style.display='none'">
        <span style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.06em;">GitHub Repos</span>
      </div>

      <div style="display:flex; gap:8px; margin-bottom:16px;">
        <input
          id="ts-url-input"
          type="url"
          placeholder="https://github.com/your-org/repo"
          oninput="window._trackingInputChanged()"
          onkeydown="if(event.key==='Enter'){ const b=document.getElementById('ts-add-btn'); if(b&&!b.disabled) window._trackingAddRepo() }"
          style="
            flex:1; padding:8px 12px; border:1px solid var(--border);
            border-radius:var(--radius); background:var(--bg-base);
            color:var(--text-primary); font-size:13px; outline:none;
            transition:border-color 0.15s;
          "
          onfocus="this.style.borderColor='var(--accent)'"
          onblur="this.style.borderColor='var(--border)'"
        />
        <button
          id="ts-add-btn"
          onclick="window._trackingAddRepo()"
          disabled
          style="
            display:flex; align-items:center; gap:6px;
            padding:8px 14px; background:var(--accent); color:#fff;
            border:none; border-radius:var(--radius); font-size:13px;
            font-weight:500; cursor:pointer; white-space:nowrap;
            opacity:0.4;
          "
        >
          <i data-lucide="plus" style="width:13px; height:13px;"></i>
          Add Repo
        </button>
      </div>

      ${repos.length === 0 ? `
        <div style="
          border:1px dashed var(--border); border-radius:var(--radius-lg);
          padding:28px 24px; text-align:center;
        ">
          <i data-lucide="git-branch" style="width:24px; height:24px; color:var(--text-muted); opacity:0.3; margin-bottom:8px;"></i>
          <div style="font-size:13px; color:var(--text-secondary); margin-bottom:3px;">No repos connected yet</div>
          <div style="font-size:12px; color:var(--text-muted);">Paste a GitHub URL above to get started.</div>
        </div>
      ` : `
        <div style="border:1px solid var(--border); border-radius:var(--radius-lg); overflow:hidden;">
          ${repos.map((r, i) => `
            <div style="
              display:flex; align-items:center; gap:12px;
              padding:13px 16px;
              ${i < repos.length - 1 ? 'border-bottom:1px solid var(--border-subtle);' : ''}
            ">
              <img src="../assets/github.svg" style="width:15px; height:15px; object-fit:contain; flex-shrink:0;"
                onerror="this.style.display='none'">
              <div style="flex:1; min-width:0;">
                <div style="font-size:13px; font-weight:500; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${r.label}</div>
                <div style="font-size:11px; color:var(--text-muted); margin-top:1px;">${r.url}</div>
              </div>
              <button
                id="sync-btn-${i}"
                onclick="window._syncTrackingSite(${i})"
                style="
                  display:flex; align-items:center; gap:5px;
                  padding:5px 10px; flex-shrink:0;
                  background:var(--accent); color:#fff;
                  border:none; border-radius:var(--radius);
                  font-size:12px; font-weight:600;
                  font-family:'IBM Plex Sans',sans-serif;
                  cursor:pointer; transition:opacity 0.15s;
                "
                onmouseover="this.style.opacity='0.85'"
                onmouseout="this.style.opacity='1'"
              >
                <i data-lucide="refresh-cw" style="width:11px; height:11px;"></i>
                Sync
              </button>
              <button
                onclick="window._trackingRemoveRepo(${i})"
                title="Remove"
                style="
                  display:flex; align-items:center; justify-content:center;
                  width:28px; height:28px; flex-shrink:0;
                  background:transparent; border:1px solid var(--border);
                  border-radius:var(--radius); cursor:pointer;
                  color:var(--text-muted); transition:border-color 0.15s, color 0.15s;
                "
                onmouseover="this.style.borderColor='var(--danger)'; this.style.color='var(--danger)'"
                onmouseout="this.style.borderColor='var(--border)'; this.style.color='var(--text-muted)'"
              >
                <i data-lucide="x" style="width:12px; height:12px;"></i>
              </button>
            </div>
          `).join('')}
        </div>
      `}
    </div>

    <!-- ── Jira section ── -->
    <div style="margin-bottom:32px;">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
        <img src="../assets/jira.svg" style="width:14px; height:14px; object-fit:contain;"
          onerror="this.style.display='none'">
        <span style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.06em;">Jira Boards</span>
      </div>

      <div style="display:flex; gap:8px; margin-bottom:16px;">
        <input
          id="ts-jira-input"
          type="url"
          placeholder="https://yourcompany.atlassian.net"
          oninput="window._trackingJiraInputChanged()"
          onkeydown="if(event.key==='Enter'){ const b=document.getElementById('ts-jira-add-btn'); if(b&&!b.disabled) window._trackingAddBoard() }"
          style="
            flex:1; padding:8px 12px; border:1px solid var(--border);
            border-radius:var(--radius); background:var(--bg-base);
            color:var(--text-primary); font-size:13px; outline:none;
            transition:border-color 0.15s;
          "
          onfocus="this.style.borderColor='var(--accent)'"
          onblur="this.style.borderColor='var(--border)'"
        />
        <button
          id="ts-jira-add-btn"
          onclick="window._trackingAddBoard()"
          disabled
          style="
            display:flex; align-items:center; gap:6px;
            padding:8px 14px; background:var(--accent); color:#fff;
            border:none; border-radius:var(--radius); font-size:13px;
            font-weight:500; cursor:pointer; white-space:nowrap;
            opacity:0.4;
          "
        >
          <i data-lucide="plus" style="width:13px; height:13px;"></i>
          Add Board
        </button>
      </div>

      ${boards.length === 0 ? `
        <div style="
          border:1px dashed var(--border); border-radius:var(--radius-lg);
          padding:28px 24px; text-align:center;
        ">
          <i data-lucide="layout-dashboard" style="width:24px; height:24px; color:var(--text-muted); opacity:0.3; margin-bottom:8px;"></i>
          <div style="font-size:13px; color:var(--text-secondary); margin-bottom:3px;">No boards connected yet</div>
          <div style="font-size:12px; color:var(--text-muted);">Paste a Jira URL above to get started.</div>
        </div>
      ` : `
        <div style="border:1px solid var(--border); border-radius:var(--radius-lg); overflow:hidden;">
          ${boards.map((b, i) => `
            <div style="
              display:flex; align-items:center; gap:12px;
              padding:13px 16px;
              ${i < boards.length - 1 ? 'border-bottom:1px solid var(--border-subtle);' : ''}
            ">
              <img src="../assets/jira.svg" style="width:15px; height:15px; object-fit:contain; flex-shrink:0;"
                onerror="this.style.display='none'">
              <div style="flex:1; min-width:0;">
                <div style="font-size:13px; font-weight:500; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${b.label}</div>
                <div style="font-size:11px; color:var(--text-muted); margin-top:1px;">${b.url}</div>
              </div>
              <button
                id="jira-sync-btn-${i}"
                onclick="window._syncTrackingBoard(${i})"
                style="
                  display:flex; align-items:center; gap:5px;
                  padding:5px 10px; flex-shrink:0;
                  background:var(--accent); color:#fff;
                  border:none; border-radius:var(--radius);
                  font-size:12px; font-weight:600;
                  font-family:'IBM Plex Sans',sans-serif;
                  cursor:pointer; transition:opacity 0.15s;
                "
                onmouseover="this.style.opacity='0.85'"
                onmouseout="this.style.opacity='1'"
              >
                <i data-lucide="refresh-cw" style="width:11px; height:11px;"></i>
                Sync
              </button>
              <button
                onclick="window._trackingRemoveBoard(${i})"
                title="Remove"
                style="
                  display:flex; align-items:center; justify-content:center;
                  width:28px; height:28px; flex-shrink:0;
                  background:transparent; border:1px solid var(--border);
                  border-radius:var(--radius); cursor:pointer;
                  color:var(--text-muted); transition:border-color 0.15s, color 0.15s;
                "
                onmouseover="this.style.borderColor='var(--danger)'; this.style.color='var(--danger)'"
                onmouseout="this.style.borderColor='var(--border)'; this.style.color='var(--text-muted)'"
              >
                <i data-lucide="x" style="width:12px; height:12px;"></i>
              </button>
            </div>
          `).join('')}
        </div>
      `}
    </div>

    <!-- ── Google Calendar section ── -->
    <div>
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
        <img src="../assets/google-calendar.svg" style="width:14px; height:14px; object-fit:contain;"
          onerror="this.style.display='none'">
        <span style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.06em;">Google Calendar</span>
      </div>

      <div style="display:flex; gap:8px; margin-bottom:16px;">
        <input
          id="ts-cal-input"
          type="email"
          placeholder="you@gmail.com or you@company.com"
          oninput="window._trackingCalInputChanged()"
          onkeydown="if(event.key==='Enter'){ const b=document.getElementById('ts-cal-add-btn'); if(b&&!b.disabled) window._trackingAddCalendar() }"
          style="
            flex:1; padding:8px 12px; border:1px solid var(--border);
            border-radius:var(--radius); background:var(--bg-base);
            color:var(--text-primary); font-size:13px; outline:none;
            transition:border-color 0.15s;
          "
          onfocus="this.style.borderColor='var(--accent)'"
          onblur="this.style.borderColor='var(--border)'"
        />
        <button
          id="ts-cal-add-btn"
          onclick="window._trackingAddCalendar()"
          disabled
          style="
            display:flex; align-items:center; gap:6px;
            padding:8px 14px; background:var(--accent); color:#fff;
            border:none; border-radius:var(--radius); font-size:13px;
            font-weight:500; cursor:pointer; white-space:nowrap;
            opacity:0.4;
          "
        >
          <i data-lucide="plus" style="width:13px; height:13px;"></i>
          Add Account
        </button>
      </div>

      ${calendars.length === 0 ? `
        <div style="
          border:1px dashed var(--border); border-radius:var(--radius-lg);
          padding:28px 24px; text-align:center;
        ">
          <i data-lucide="calendar" style="width:24px; height:24px; color:var(--text-muted); opacity:0.3; margin-bottom:8px;"></i>
          <div style="font-size:13px; color:var(--text-secondary); margin-bottom:3px;">No calendar accounts connected yet</div>
          <div style="font-size:12px; color:var(--text-muted);">Enter your Google account email above to get started.</div>
        </div>
      ` : `
        <div style="border:1px solid var(--border); border-radius:var(--radius-lg); overflow:hidden;">
          ${calendars.map((c, i) => `
            <div style="
              display:flex; align-items:center; gap:12px;
              padding:13px 16px;
              ${i < calendars.length - 1 ? 'border-bottom:1px solid var(--border-subtle);' : ''}
            ">
              <img src="../assets/google-calendar.svg" style="width:15px; height:15px; object-fit:contain; flex-shrink:0;"
                onerror="this.style.display='none'">
              <div style="flex:1; min-width:0;">
                <div style="font-size:13px; font-weight:500; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${c.label}</div>
                <div style="font-size:11px; color:var(--text-muted); margin-top:1px;">${c.email}</div>
              </div>
              <button
                id="cal-sync-btn-${i}"
                onclick="window._syncTrackingCalendar(${i})"
                style="
                  display:flex; align-items:center; gap:5px;
                  padding:5px 10px; flex-shrink:0;
                  background:var(--accent); color:#fff;
                  border:none; border-radius:var(--radius);
                  font-size:12px; font-weight:600;
                  font-family:'IBM Plex Sans',sans-serif;
                  cursor:pointer; transition:opacity 0.15s;
                "
                onmouseover="this.style.opacity='0.85'"
                onmouseout="this.style.opacity='1'"
              >
                <i data-lucide="refresh-cw" style="width:11px; height:11px;"></i>
                Sync
              </button>
              <button
                onclick="window._trackingRemoveCalendar(${i})"
                title="Remove"
                style="
                  display:flex; align-items:center; justify-content:center;
                  width:28px; height:28px; flex-shrink:0;
                  background:transparent; border:1px solid var(--border);
                  border-radius:var(--radius); cursor:pointer;
                  color:var(--text-muted); transition:border-color 0.15s, color 0.15s;
                "
                onmouseover="this.style.borderColor='var(--danger)'; this.style.color='var(--danger)'"
                onmouseout="this.style.borderColor='var(--border)'; this.style.color='var(--text-muted)'"
              >
                <i data-lucide="x" style="width:12px; height:12px;"></i>
              </button>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `
}

window._trackingInputChanged = function() {
  const input = document.getElementById('ts-url-input')
  const btn = document.getElementById('ts-add-btn')
  if (!input || !btn) return
  const url = input.value.trim()
  const valid = /^https?:\/\/[^/]+\/[^/]+\/[^/]+/.test(url)
  const duplicate = (window._settingsTrackingRepos || []).some(r => r.url === url)
  btn.disabled = !valid || duplicate
  btn.style.opacity = (!valid || duplicate) ? '0.4' : '1'
  btn.style.cursor = (!valid || duplicate) ? 'not-allowed' : 'pointer'
}

window._trackingAddRepo = async function() {
  const input = document.getElementById('ts-url-input')
  const btn = document.getElementById('ts-add-btn')
  if (!input) return
  const url = input.value.trim()
  if (!/^https?:\/\/[^/]+\/[^/]+\/[^/]+/.test(url)) return

  btn.disabled = true
  btn.innerHTML = '<i data-lucide="loader" style="width:13px;height:13px;"></i> Connecting…'
  if (typeof lucide !== 'undefined') lucide.createIcons()

  try {
    await window.api.connectGithubSource(url)
    const parsed = new URL(url)
    const hostname = parsed.hostname
    const pathParts = parsed.pathname.split('/').filter(Boolean)
    const label = hostname + ' · ' + pathParts.slice(0, 2).join('/')
    const repo = { url, hostname, label }

    // Save repo to DB (no items yet — user can Sync after)
    await window.api.githubSaveScrape({ repos: [repo], scrapes: [] })

    input.value = ''
    window.showToast('Repo added — click Sync to fetch issues & PRs', 'success')
    window._loadTrackingRepos()  // reload list from DB
  } catch (err) {
    window.showToast('Failed to connect: ' + (err.message || err), 'error')
    btn.disabled = false
    btn.innerHTML = '<i data-lucide="plus" style="width:13px;height:13px;"></i> Add Repo'
    if (typeof lucide !== 'undefined') lucide.createIcons()
  }
}

window._trackingRemoveRepo = async function(idx) {
  const repos = window._settingsTrackingRepos || []
  const repo = repos[idx]
  if (!repo) return
  try {
    await window.api.githubDeleteRepo(repo.url)
    window._loadTrackingRepos()
  } catch (err) {
    window.showToast('Failed to remove: ' + (err.message || err), 'error')
  }
}

window._syncTrackingSite = async function(idx) {
  const repos = window._settingsTrackingRepos || []
  const repo = repos[idx]
  if (!repo) return

  const btn = document.getElementById('sync-btn-' + idx)
  if (btn) {
    btn.disabled = true
    btn.innerHTML = '<i data-lucide="loader" style="width:11px;height:11px;"></i> Syncing…'
    if (typeof lucide !== 'undefined') lucide.createIcons()
  }

  try {
    const result = await window.api.scrapeGithubIssues(repo.url)
    const total = (result.issues ? result.issues.length : 0) + (result.prs ? result.prs.length : 0)
    if (total > 0) {
      await window.api.githubSaveScrape({
        repos: [repo],
        scrapes: [{ repoUrl: repo.url, items: [...(result.issues || []), ...(result.prs || [])] }]
      })
      console.log('[Tracking Sites] Issues:', result.issues)
      console.log('[Tracking Sites] PRs:', result.prs)
      window.showToast('Synced ' + result.issues.length + ' issues + ' + result.prs.length + ' PRs', 'success')
    } else {
      console.warn('[Tracking Sites] Nothing parsed — check main process terminal for debug info')
      window.showToast('Nothing parsed — check console', 'error')
    }
  } catch (err) {
    console.error('[Tracking Sites] Sync failed:', err)
    window.showToast('Sync failed: ' + (err.message || err), 'error')
  } finally {
    if (btn) {
      btn.disabled = false
      btn.innerHTML = '<i data-lucide="refresh-cw" style="width:11px;height:11px;"></i> Sync'
      if (typeof lucide !== 'undefined') lucide.createIcons()
    }
  }
}

// ── Jira tracking interactions ────────────────────────────────────────────────

window._trackingJiraInputChanged = function() {
  const input = document.getElementById('ts-jira-input')
  const btn = document.getElementById('ts-jira-add-btn')
  if (!input || !btn) return
  const url = input.value.trim()
  const valid = /^https?:\/\/[^/]+/.test(url)
  const duplicate = (window._settingsTrackingBoards || []).some(b => b.url === url)
  btn.disabled = !valid || duplicate
  btn.style.opacity = (!valid || duplicate) ? '0.4' : '1'
  btn.style.cursor = (!valid || duplicate) ? 'not-allowed' : 'pointer'
}

window._trackingAddBoard = async function() {
  const input = document.getElementById('ts-jira-input')
  const btn = document.getElementById('ts-jira-add-btn')
  if (!input) return
  const url = input.value.trim()
  if (!/^https?:\/\/[^/]+/.test(url)) return

  btn.disabled = true
  btn.innerHTML = '<i data-lucide="loader" style="width:13px;height:13px;"></i> Connecting…'
  if (typeof lucide !== 'undefined') lucide.createIcons()

  try {
    await window.api.connectJiraSource(url)
    const parsed = new URL(url)
    const hostname = parsed.hostname
    const label = hostname
    const board = { url, hostname, label }

    await window.api.jiraSaveScrape({ boards: [board], scrapes: [] })

    input.value = ''
    window.showToast('Jira board added — click Sync to fetch items', 'success')
    window._loadTrackingRepos()
  } catch (err) {
    window.showToast('Failed to connect Jira: ' + (err.message || err), 'error')
    btn.disabled = false
    btn.innerHTML = '<i data-lucide="plus" style="width:13px;height:13px;"></i> Add Board'
    if (typeof lucide !== 'undefined') lucide.createIcons()
  }
}

window._trackingRemoveBoard = async function(idx) {
  const boards = window._settingsTrackingBoards || []
  const board = boards[idx]
  if (!board) return
  try {
    await window.api.jiraDeleteBoard(board.url)
    window._loadTrackingRepos()
  } catch (err) {
    window.showToast('Failed to remove: ' + (err.message || err), 'error')
  }
}

window._syncTrackingBoard = async function(idx) {
  const boards = window._settingsTrackingBoards || []
  const board = boards[idx]
  if (!board) return

  const btn = document.getElementById('jira-sync-btn-' + idx)
  if (btn) {
    btn.disabled = true
    btn.innerHTML = '<i data-lucide="loader" style="width:11px;height:11px;"></i> Syncing…'
    if (typeof lucide !== 'undefined') lucide.createIcons()
  }

  try {
    const result = await window.api.scrapeJiraBoard(board.url)
    const items = result.items || []
    console.log('[Tracking Sites] Jira items scraped:', items)
    if (items.length > 0) {
      await window.api.jiraSaveScrape({
        boards: [board],
        scrapes: [{ boardUrl: board.url, items }]
      })
      window.showToast('Synced ' + items.length + ' Jira items', 'success')
    } else {
      console.warn('[Tracking Sites] No Jira items parsed — page may require login or JS rendering')
      window.showToast('No items found — check console for debug info', 'error')
    }
  } catch (err) {
    console.error('[Tracking Sites] Jira sync failed:', err)
    window.showToast('Jira sync failed: ' + (err.message || err), 'error')
  } finally {
    if (btn) {
      btn.disabled = false
      btn.innerHTML = '<i data-lucide="refresh-cw" style="width:11px;height:11px;"></i> Sync'
      if (typeof lucide !== 'undefined') lucide.createIcons()
    }
  }
}

// ── Calendar tracking interactions ───────────────────────────────────────────

window._trackingCalInputChanged = function() {
  const input = document.getElementById('ts-cal-input')
  const btn = document.getElementById('ts-cal-add-btn')
  if (!input || !btn) return
  const email = input.value.trim()
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const duplicate = (window._settingsTrackingCalendars || []).some(c => c.email === email)
  btn.disabled = !valid || duplicate
  btn.style.opacity = (!valid || duplicate) ? '0.4' : '1'
  btn.style.cursor = (!valid || duplicate) ? 'not-allowed' : 'pointer'
}

window._trackingAddCalendar = async function() {
  const input = document.getElementById('ts-cal-input')
  const btn = document.getElementById('ts-cal-add-btn')
  if (!input) return
  const email = input.value.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return

  btn.disabled = true
  btn.innerHTML = '<i data-lucide="loader" style="width:13px;height:13px;"></i> Connecting…'
  if (typeof lucide !== 'undefined') lucide.createIcons()

  try {
    const result = await window.api.connectCalendarSource(email)
    if (!result.authed) {
      window.showToast('Login cancelled or failed', 'error')
      btn.disabled = false
      btn.innerHTML = '<i data-lucide="plus" style="width:13px;height:13px;"></i> Add Account'
      if (typeof lucide !== 'undefined') lucide.createIcons()
      return
    }

    // Save source to DB (no events yet — user clicks Sync after)
    await window.api.calendarSaveScrape({ email, label: email, events: [] })

    input.value = ''
    window.showToast('Calendar account added — click Sync to fetch events', 'success')
    window._loadTrackingRepos()
  } catch (err) {
    window.showToast('Failed to connect calendar: ' + (err.message || err), 'error')
    btn.disabled = false
    btn.innerHTML = '<i data-lucide="plus" style="width:13px;height:13px;"></i> Add Account'
    if (typeof lucide !== 'undefined') lucide.createIcons()
  }
}

window._trackingRemoveCalendar = async function(idx) {
  const calendars = window._settingsTrackingCalendars || []
  const cal = calendars[idx]
  if (!cal) return
  try {
    await window.api.calendarDeleteSource(cal.email)
    window._loadTrackingRepos()
  } catch (err) {
    window.showToast('Failed to remove: ' + (err.message || err), 'error')
  }
}

window._syncTrackingCalendar = async function(idx) {
  const calendars = window._settingsTrackingCalendars || []
  const cal = calendars[idx]
  if (!cal) return

  const btn = document.getElementById('cal-sync-btn-' + idx)
  if (btn) {
    btn.disabled = true
    btn.innerHTML = '<i data-lucide="loader" style="width:11px;height:11px;"></i> Syncing…'
    if (typeof lucide !== 'undefined') lucide.createIcons()
  }

  try {
    const result = await window.api.scrapeCalendarEvents(cal.email)
    console.log('[Calendar Sync] result:', result)
    const events = result.events || []

    if (result.error === 'not_authed') {
      window.showToast('Session expired — remove this account and re-connect it', 'error')
    } else if (events.length > 0) {
      await window.api.calendarSaveScrape({ email: cal.email, label: cal.label, events })
      window.showToast('Synced ' + events.length + ' calendar events', 'success')
    } else {
      window.showToast('No events found this week (calendar may be empty)', 'info')
    }
  } catch (err) {
    console.error('[Tracking Sites] Calendar sync failed:', err)
    window.showToast('Calendar sync failed: ' + (err.message || err), 'error')
  } finally {
    if (btn) {
      btn.disabled = false
      btn.innerHTML = '<i data-lucide="refresh-cw" style="width:11px;height:11px;"></i> Sync'
      if (typeof lucide !== 'undefined') lucide.createIcons()
    }
  }
}

// ── General section ───────────────────────────────────────────────────────────

window._renderSettingsGeneral = function() {
  return `
    <h2 style="font-size:18px; font-weight:600; color:var(--text-primary); margin:0 0 4px;">General</h2>
    <p style="font-size:13px; color:var(--text-muted); margin:0 0 28px;">App-wide preferences.</p>

    <div style="border:1px solid var(--border); border-radius:var(--radius-lg); overflow:hidden;">

      <!-- Theme row -->
      <div style="
        display:flex; align-items:center; justify-content:space-between;
        padding:16px 18px; border-bottom:1px solid var(--border-subtle);
      ">
        <div>
          <div style="font-size:13px; font-weight:500; color:var(--text-primary);">Theme</div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Interface color scheme</div>
        </div>
        <div style="
          padding:5px 12px;
          background:var(--bg-raised); border:1px solid var(--border);
          border-radius:var(--radius); font-size:12px; color:var(--text-secondary);
          display:flex; align-items:center; gap:6px;
        ">
          <i data-lucide="moon" style="width:12px; height:12px;"></i>
          Dark
        </div>
      </div>

      <!-- Version row -->
      <div style="
        display:flex; align-items:center; justify-content:space-between;
        padding:16px 18px;
      ">
        <div>
          <div style="font-size:13px; font-weight:500; color:var(--text-primary);">Version</div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Connection Point</div>
        </div>
        <span style="font-size:12px; color:var(--text-muted); font-family:monospace;">v1.0.0</span>
      </div>

    </div>
  `
}

// ── Interaction handlers ──────────────────────────────────────────────────────

