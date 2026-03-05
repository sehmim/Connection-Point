window._settingsState = {
  section: 'workspaces',    // 'workspaces' | 'general'
  expandedWorkspace: null,  // index of expanded workspace card
}

window.renderSettings = function() {
  const container = document.querySelector('[data-view="settings"]')
  if (!container) return
  window._renderSettingsUI()
}

window._renderSettingsUI = function() {
  const container = document.querySelector('[data-view="settings"]')
  if (!container) return

  const s = window._settingsState
  const storedWorkSpace = window.localStorage.getItem("workplaces");
  // console.log("storedWorkSpaceObj", storedWorkSpaceObj);

  // const storedWorkSpaceObj = JSON.parse(storedWorkSpace);
  // console.log("storedWorkSpaceObj", storedWorkSpaceObj);

  const workspaces = (window._appState && window._appState.workspaces) || []

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
          { id: 'workspaces', icon: 'layers',   label: 'Workspaces' },
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
            ${item.id === 'workspaces' && workspaces.length > 0
              ? `<span style="
                  margin-left:auto; font-size:10px; font-weight:700;
                  background:var(--accent-muted); color:var(--accent);
                  border-radius:10px; padding:1px 6px; flex-shrink:0;
                ">${workspaces.length}</span>`
              : ''
            }
          </div>
        `).join('')}
      </div>

      <!-- ── Right content ── -->
      <div style="flex:1; overflow-y:auto; background:var(--bg-base);">
        <div style="max-width:640px; padding:32px 36px;">
          ${s.section === 'workspaces' ? window._renderSettingsWorkspaces() : s.section === 'tracking' ? window._renderSettingsTrackingSites() : window._renderSettingsGeneral()}
        </div>
      </div>

    </div>
  `

  if (typeof lucide !== 'undefined') lucide.createIcons()
}

window._settingsNav = function(section) {
  window._settingsState.section = section
  if (section === 'tracking') {
    window._settingsTrackingRepos = null  // clear cache so we reload
    window._loadTrackingRepos()
    return
  }
  window._renderSettingsUI()
}

window._settingsTrackingRepos = null  // [{ url, hostname, label }] loaded from DB

window._loadTrackingRepos = function() {
  if (!window.api || !window.api.githubGetData) {
    window._settingsTrackingRepos = []
    window._renderSettingsUI()
    return
  }
  window.api.githubGetData().then(function(data) {
    window._settingsTrackingRepos = data.repos || []
    window._renderSettingsUI()
  }).catch(function() {
    window._settingsTrackingRepos = []
    window._renderSettingsUI()
  })
}

// ── Workspaces section ────────────────────────────────────────────────────────

window._renderSettingsWorkspaces = function() {
  const workspaces = (window._appState && window._appState.workspaces) || []

  return `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:24px;">
      <div>
        <h2 style="font-size:18px; font-weight:600; color:var(--text-primary); margin:0 0 4px;">Workspaces</h2>
        <p style="font-size:13px; color:var(--text-muted); margin:0;">Manage integrations for each connected workspace.</p>
      </div>
      <button onclick="window.navigate('onboarding')" style="
        display:flex; align-items:center; gap:6px;
        padding:7px 14px;
        background:var(--accent); color:#fff;
        border:none; border-radius:var(--radius);
        font-size:13px; font-weight:600;
        font-family:'IBM Plex Sans',sans-serif;
        cursor:pointer; transition:opacity 0.15s; flex-shrink:0;
      " onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
        <i data-lucide="plus" style="width:13px; height:13px;"></i>
        Add Workspace
      </button>
    </div>

    ${workspaces.length === 0 ? `
      <div style="
        border:1px dashed var(--border); border-radius:var(--radius-lg);
        padding:48px 32px; text-align:center;
      ">
        <i data-lucide="layers" style="width:32px; height:32px; color:var(--text-muted); opacity:0.3; margin-bottom:12px;"></i>
        <div style="font-size:14px; color:var(--text-secondary); margin-bottom:6px;">No workspaces yet</div>
        <div style="font-size:13px; color:var(--text-muted);">Click "Add Workspace" to get started.</div>
      </div>
    ` : workspaces.map((ws, wsIdx) => window._renderWorkspaceCard(ws, wsIdx)).join('')}
  `
}

window._renderWorkspaceCard = function(ws, wsIdx) {
  const expanded = window._settingsState.expandedWorkspace === wsIdx

  const integrations = [
    { id: 'jira',    label: 'Jira',             sub: 'Atlassian Jira tickets and sprints',  logo: '../assets/jira.svg',            logoBg: 'transparent', enabledKey: 'jiraEnabled',    urlKey: 'jiraUrl',    placeholder: 'https://yourcompany.atlassian.net' },
    { id: 'github',  label: 'GitHub',           sub: 'Pull requests and issues',            logo: '../assets/github.svg',          logoBg: '#24292e',     enabledKey: 'githubEnabled',  urlKey: 'githubUrl',  placeholder: 'https://github.com/your-org' },
    { id: 'gmail',   label: 'Gmail',            sub: 'Emails and threads',                  logo: '../assets/gmail.svg',           logoBg: 'transparent', enabledKey: 'gmailEnabled',   urlKey: 'gmailUrl',   placeholder: 'https://mail.google.com' },
    { id: 'gcal',    label: 'Google Calendar',  sub: 'Events and scheduled meetings',       logo: '../assets/google-calendar.svg', logoBg: 'transparent', enabledKey: 'gcalEnabled',    urlKey: 'gcalUrl',    placeholder: 'https://calendar.google.com' },
    { id: 'outlook', label: 'Outlook Calendar', sub: 'Microsoft calendar events',           logo: '../assets/outlook.svg',         logoBg: 'transparent', enabledKey: 'outlookEnabled', urlKey: 'outlookUrl', placeholder: 'https://outlook.office.com/calendar' },
  ]

  const enabledCount = integrations.filter(i => ws[i.enabledKey]).length

  return `
    <div style="
      border:1px solid var(--border); border-radius:var(--radius-lg);
      margin-bottom:12px; overflow:hidden;
      background:var(--bg-surface);
    ">
      <!-- Card header -->
      <div
        onclick="window._toggleSettingsWorkspace(${wsIdx})"
        style="
          display:flex; align-items:center; gap:12px;
          padding:16px 18px; cursor:pointer;
          transition:background 0.1s;
        "
        onmouseover="this.style.background='var(--bg-hover)'"
        onmouseout="this.style.background='transparent'"
      >
        <!-- Color dot -->
        <div style="
          width:10px; height:10px; border-radius:50%; flex-shrink:0;
          background:${ws.color || 'var(--accent)'};
        "></div>

        <!-- Name + meta -->
        <div style="flex:1; min-width:0;">
          <div style="font-size:14px; font-weight:600; color:var(--text-primary);">${ws.name}</div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:1px;">
            ${enabledCount === 0
              ? 'No integrations enabled'
              : `${enabledCount} integration${enabledCount !== 1 ? 's' : ''} enabled`
            }
            ${ws.profiles && ws.profiles.length > 0
              ? ` · ${ws.profiles.length} browser profile${ws.profiles.length !== 1 ? 's' : ''}`
              : ''
            }
          </div>
        </div>

        <!-- Integration logo strip -->
        <div style="display:flex; gap:4px; align-items:center; flex-shrink:0;">
          ${integrations.filter(i => ws[i.enabledKey]).map(i => `
            <div style="
              width:22px; height:22px; border-radius:4px;
              background:${i.logoBg !== 'transparent' ? i.logoBg : 'var(--bg-raised)'};
              border:1px solid var(--border);
              display:flex; align-items:center; justify-content:center;
              overflow:hidden;
            ">
              <img src="${i.logo}" alt="${i.label}" style="width:13px; height:13px; object-fit:contain;"
                onerror="this.style.display='none'"
              />
            </div>
          `).join('')}
          ${enabledCount === 0 ? `<span style="font-size:12px; color:var(--text-muted);">None</span>` : ''}
        </div>

        <!-- Chevron -->
        <i data-lucide="${expanded ? 'chevron-up' : 'chevron-down'}" style="
          width:14px; height:14px; color:var(--text-muted); flex-shrink:0; margin-left:4px;
        "></i>
      </div>

      <!-- Expanded body -->
      ${expanded ? `
        <div style="border-top:1px solid var(--border-subtle); padding:20px 18px;">

          <!-- Workspace name + color -->
          <div style="display:flex; gap:12px; align-items:flex-end; margin-bottom:20px;">
            <div style="flex:1;">
              <label style="display:block; font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px;">Workspace Name</label>
              <input
                type="text"
                value="${ws.name}"
                oninput="window._settingsUpdateWs(${wsIdx}, 'name', this.value)"
                style="
                  width:100%; box-sizing:border-box;
                  background:var(--bg-raised); border:1px solid var(--border);
                  border-radius:var(--radius); padding:8px 12px;
                  font-size:13px; color:var(--text-primary);
                  font-family:'IBM Plex Sans',sans-serif; outline:none;
                  transition:border-color 0.15s;
                "
                onfocus="this.style.borderColor='var(--accent)'"
                onblur="this.style.borderColor='var(--border)'"
              />
            </div>
            <div>
              <label style="display:block; font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px;">Color</label>
              <div style="display:flex; gap:6px;">
                ${['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'].map(c => `
                  <div
                    onclick="window._settingsUpdateWs(${wsIdx}, 'color', '${c}')"
                    style="
                      width:22px; height:22px; border-radius:50%; background:${c}; cursor:pointer;
                      border:2px solid ${ws.color === c ? '#fff' : 'transparent'};
                      box-shadow:${ws.color === c ? '0 0 0 2px ' + c : 'none'};
                      display:flex; align-items:center; justify-content:center;
                      transition:transform 0.1s;
                    "
                    onmouseover="this.style.transform='scale(1.15)'"
                    onmouseout="this.style.transform='scale(1)'"
                  >
                    ${ws.color === c ? `<i data-lucide="check" style="width:10px;height:10px;color:white;stroke-width:3;"></i>` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Integrations label -->
          <div style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em; margin-bottom:10px;">Integrations</div>

          <!-- Integration cards -->
          ${integrations.map(intg => window._renderSettingsIntegrationCard(ws, wsIdx, intg)).join('')}

          <!-- Sync Status -->
          ${window._renderSettingsSyncStatus(ws, wsIdx)}

          <!-- Custom links -->
          ${window._renderSettingsCustomLinks(ws, wsIdx)}

          <!-- Danger zone -->
          <div style="
            margin-top:24px; padding:14px 16px;
            border:1px solid rgba(239,68,68,0.2); border-radius:var(--radius);
            background:rgba(239,68,68,0.04);
            display:flex; align-items:center; justify-content:space-between; gap:12px;
          ">
            <div>
              <div style="font-size:13px; font-weight:600; color:var(--danger);">Remove Workspace</div>
              <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">This cannot be undone.</div>
            </div>
            <button onclick="window._settingsRemoveWorkspace(${wsIdx})" style="
              padding:6px 14px;
              background:transparent; color:var(--danger);
              border:1px solid var(--danger); border-radius:var(--radius);
              font-size:12px; font-weight:600;
              font-family:'IBM Plex Sans',sans-serif;
              cursor:pointer; transition:background 0.15s;
              flex-shrink:0;
            " onmouseover="this.style.background='var(--danger-muted)'" onmouseout="this.style.background='transparent'">
              Remove
            </button>
          </div>

        </div>
      ` : ''}
    </div>
  `
}

window._renderSettingsIntegrationCard = function(ws, wsIdx, intg) {
  const enabled = !!ws[intg.enabledKey]
  const url = ws[intg.urlKey] || ''

  return `
    <div style="border:1px solid var(--border); border-radius:var(--radius); margin-bottom:8px; overflow:hidden;">
      <div style="
        display:flex; align-items:center; justify-content:space-between;
        padding:11px 14px; background:var(--bg-raised); cursor:pointer;
      " onclick="window._settingsToggleIntegration(${wsIdx}, '${intg.id}', '${intg.enabledKey}')">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="
            width:26px; height:26px; border-radius:5px; flex-shrink:0;
            background:${intg.logoBg}; display:flex; align-items:center; justify-content:center;
            overflow:hidden; border:${intg.logoBg !== 'transparent' ? 'none' : '1px solid var(--border-subtle)'};
          ">
            <img src="${intg.logo}" alt="${intg.label}" style="width:16px; height:16px; object-fit:contain;"
              onerror="this.style.display='none'; this.parentElement.innerHTML='<span style=\\'font-size:10px;color:var(--text-muted);\\'>?</span>'"
            />
          </div>
          <div>
            <div style="font-size:13px; font-weight:500; color:var(--text-primary);">${intg.label}</div>
            <div style="font-size:11px; color:var(--text-muted);">${intg.sub}</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          ${enabled ? `<span style="font-size:11px; color:var(--success); font-weight:600;">Enabled</span>` : ''}
          <div style="
            width:34px; height:19px; border-radius:10px;
            background:${enabled ? 'var(--accent)' : 'var(--border)'};
            position:relative; transition:background 0.2s; flex-shrink:0;
          ">
            <div style="
              width:15px; height:15px; border-radius:50%; background:#fff;
              position:absolute; top:2px;
              left:${enabled ? '17px' : '2px'};
              transition:left 0.2s;
            "></div>
          </div>
        </div>
      </div>
      <div style="
        overflow:hidden;
        max-height:${enabled ? '72px' : '0'};
        transition:max-height 0.25s ease;
      ">
        <div style="padding:10px 14px; border-top:1px solid var(--border-subtle);">
          <input
            type="url"
            placeholder="${intg.placeholder}"
            value="${url}"
            oninput="window._settingsUpdateWs(${wsIdx}, '${intg.urlKey}', this.value)"
            style="
              width:100%; box-sizing:border-box;
              background:var(--bg-base); border:1px solid var(--border);
              border-radius:var(--radius); padding:7px 11px;
              font-size:13px; color:var(--text-primary);
              font-family:'IBM Plex Sans',sans-serif; outline:none;
              transition:border-color 0.15s;
            "
            onfocus="this.style.borderColor='var(--accent)'"
            onblur="this.style.borderColor='var(--border)'"
          />
        </div>
      </div>
    </div>
  `
}

window._renderSettingsSyncStatus = function(ws, wsIdx) {
  const integrations = [
    { id: 'jira',    label: 'Jira',             logo: '../assets/jira.svg',            enabledKey: 'jiraEnabled'    },
    { id: 'github',  label: 'GitHub',            logo: '../assets/github.svg',          enabledKey: 'githubEnabled'  },
    { id: 'gmail',   label: 'Gmail',             logo: '../assets/gmail.svg',           enabledKey: 'gmailEnabled'   },
    { id: 'gcal',    label: 'Google Calendar',   logo: '../assets/google-calendar.svg', enabledKey: 'gcalEnabled'    },
    { id: 'outlook', label: 'Outlook Calendar',  logo: '../assets/outlook.svg',         enabledKey: 'outlookEnabled' },
  ]

  const enabled = integrations.filter(function(i) { return ws[i.enabledKey] })

  function _syncBadge(key) {
    const st = (window._fetchState || {})[key]
    if (!st || st.status === 'idle') {
      return `<span style="font-size:11px; color:var(--text-muted);">Not fetched yet</span>`
    }
    if (st.status === 'fetching') {
      return `
        <span style="display:inline-flex; align-items:center; gap:5px; font-size:11px; color:var(--text-muted);">
          <div style="
            width:10px; height:10px; border-radius:50%;
            border:2px solid var(--border); border-top-color:var(--accent);
            animation:spin 0.7s linear infinite; flex-shrink:0;
          "></div>
          Fetching…
        </span>`
    }
    if (st.status === 'done') {
      const ago = st.ts ? _timeAgo(st.ts) : ''
      return `<span style="font-size:11px; color:var(--success); font-weight:500;">Synced${ago ? ' ' + ago : ''} · ${st.count} item${st.count !== 1 ? 's' : ''}</span>`
    }
    if (st.status === 'error') {
      return `<span style="font-size:11px; color:var(--danger);">Error: ${st.message || 'Failed'}</span>`
    }
    return ''
  }

  return `
    <div style="margin-top:20px; margin-bottom:4px;">
      <div style="
        display:flex; align-items:center; justify-content:space-between;
        margin-bottom:10px;
      ">
        <div style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em;">Sync Status</div>
        ${enabled.length > 0 ? `
          <button
            onclick="window._settingsResyncAll(${wsIdx})"
            style="
              display:flex; align-items:center; gap:5px;
              padding:4px 10px;
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
            Re-sync all
          </button>
        ` : ''}
      </div>

      ${enabled.length === 0
        ? `<div style="font-size:12px; color:var(--text-muted); padding:4px 2px;">No integrations enabled.</div>`
        : `<div style="border:1px solid var(--border); border-radius:var(--radius); overflow:hidden;">
            ${enabled.map(function(intg, idx) {
              const key = ws.name + ':' + intg.id
              return `
                <div style="
                  display:flex; align-items:center; gap:10px;
                  padding:10px 14px;
                  ${idx < enabled.length - 1 ? 'border-bottom:1px solid var(--border-subtle);' : ''}
                ">
                  <img src="${intg.logo}" alt="${intg.label}" style="width:14px; height:14px; object-fit:contain; flex-shrink:0;"
                    onerror="this.style.display='none'">
                  <span style="font-size:13px; color:var(--text-primary); font-weight:500; min-width:120px; flex-shrink:0;">${intg.label}</span>
                  <div style="flex:1; min-width:0;">${_syncBadge(key)}</div>
                  <button
                    onclick="window._settingsResyncService(${wsIdx}, '${intg.id}')"
                    style="
                      display:flex; align-items:center; gap:4px;
                      padding:3px 8px; flex-shrink:0;
                      background:transparent; color:var(--text-secondary);
                      border:1px solid var(--border); border-radius:var(--radius);
                      font-size:11px; font-weight:500;
                      font-family:'IBM Plex Sans',sans-serif;
                      cursor:pointer; transition:border-color 0.15s, color 0.15s;
                    "
                    onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'"
                    onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-secondary)'"
                  >
                    <i data-lucide="refresh-cw" style="width:10px; height:10px;"></i>
                    Re-sync
                  </button>
                </div>
              `
            }).join('')}
          </div>`
      }
    </div>
  `
}

function _timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 5)  return 'just now'
  if (diff < 60) return diff + 's ago'
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago'
  return Math.floor(diff / 3600) + 'h ago'
}

window._settingsResyncService = function(wsIdx, serviceId) {
  const ws = window._appState && window._appState.workspaces[wsIdx]
  if (!ws) return

  const key = ws.name + ':' + serviceId
  if (!window._fetchState) window._fetchState = {}
  window._fetchState[key] = { status: 'fetching', message: '', count: null, ts: null }
  window._renderSettingsUI()

  window._mockFetchService(ws.name, serviceId).then(function() {
    window._renderSettingsUI()
  }).catch(function() {
    window._renderSettingsUI()
  })
}

window._settingsResyncAll = function(wsIdx) {
  const ws = window._appState && window._appState.workspaces[wsIdx]
  if (!ws) return

  const integrations = [
    { id: 'jira',    enabledKey: 'jiraEnabled'    },
    { id: 'github',  enabledKey: 'githubEnabled'  },
    { id: 'gmail',   enabledKey: 'gmailEnabled'   },
    { id: 'gcal',    enabledKey: 'gcalEnabled'    },
    { id: 'outlook', enabledKey: 'outlookEnabled' },
  ]
  const enabled = integrations.filter(function(i) { return ws[i.enabledKey] })

  if (!window._fetchState) window._fetchState = {}
  enabled.forEach(function(intg) {
    window._fetchState[ws.name + ':' + intg.id] = { status: 'fetching', message: '', count: null, ts: null }
  })
  window._renderSettingsUI()

  enabled.forEach(function(intg) {
    window._mockFetchService(ws.name, intg.id).then(function() {
      window._renderSettingsUI()
    }).catch(function() {
      window._renderSettingsUI()
    })
  })
}

window._renderSettingsCustomLinks = function(ws, wsIdx) {
  const links = ws.customLinks || []

  return `
    <div style="margin-top:4px;">
      <div style="
        display:flex; align-items:center; justify-content:space-between;
        margin-bottom:8px;
      ">
        <div>
          <span style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em;">Custom Links</span>
          <span style="font-size:12px; color:var(--text-muted); margin-left:8px;">Confluence, Notion, Linear, etc.</span>
        </div>
        <button onclick="window._settingsOpenCustomLinkModal(${wsIdx})" style="
          display:flex; align-items:center; gap:5px;
          padding:4px 10px;
          background:transparent; color:var(--accent);
          border:1px solid var(--accent); border-radius:var(--radius);
          font-size:12px; font-weight:600;
          font-family:'IBM Plex Sans',sans-serif;
          cursor:pointer; transition:background 0.15s;
        " onmouseover="this.style.background='var(--accent-muted)'" onmouseout="this.style.background='transparent'">
          <i data-lucide="plus" style="width:11px; height:11px;"></i>
          Add link
        </button>
      </div>

      ${links.length === 0
        ? `<div style="font-size:12px; color:var(--text-muted); padding:4px 2px;">No custom links added yet.</div>`
        : links.map((link, li) => `
          <div style="
            display:flex; align-items:center; gap:10px;
            padding:9px 12px; margin-bottom:6px;
            background:var(--bg-raised); border:1px solid var(--border);
            border-radius:var(--radius);
          ">
            <i data-lucide="link-2" style="width:13px; height:13px; color:var(--accent); flex-shrink:0;"></i>
            <div style="flex:1; min-width:0;">
              <div style="font-size:13px; color:var(--text-primary); font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                ${link.label || link.url}
              </div>
              ${link.url && link.label && link.url !== link.label
                ? `<div style="font-size:11px; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${link.url}</div>`
                : ''
              }
              ${link.description
                ? `<div style="font-size:11px; color:var(--text-muted); margin-top:1px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${link.description.replace(/"/g,'&quot;')}">${link.description}</div>`
                : ''
              }
            </div>
            <button onclick="window._settingsRemoveCustomLink(${wsIdx}, ${li})" style="
              width:24px; height:24px; flex-shrink:0;
              background:transparent; border:1px solid var(--border);
              border-radius:var(--radius); cursor:pointer;
              display:flex; align-items:center; justify-content:center;
              color:var(--text-muted); transition:border-color 0.15s, color 0.15s;
            " onmouseover="this.style.borderColor='var(--danger)';this.style.color='var(--danger)'"
               onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-muted)'">
              <i data-lucide="x" style="width:11px; height:11px;"></i>
            </button>
          </div>
        `).join('')
      }
    </div>
  `
}

// ── Tracking Sites section ────────────────────────────────────────────────────

window._renderSettingsTrackingSites = function() {
  const repos = window._settingsTrackingRepos

  if (repos === null) {
    return `
      <h2 style="font-size:18px; font-weight:600; color:var(--text-primary); margin:0 0 4px;">Tracking Sites</h2>
      <p style="font-size:13px; color:var(--text-muted); margin:0 0 24px;">GitHub repositories from all accounts.</p>
      <div style="color:var(--text-muted); font-size:13px;">Loading…</div>
    `
  }

  return `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
      <h2 style="font-size:18px; font-weight:600; color:var(--text-primary); margin:0;">Tracking Sites</h2>
    </div>
    <p style="font-size:13px; color:var(--text-muted); margin:0 0 20px;">GitHub repositories from any account. Each hostname uses its own browser session.</p>

    <!-- Add repo input -->
    <div style="display:flex; gap:8px; margin-bottom:24px;">
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

    <!-- Repo list -->
    ${repos.length === 0 ? `
      <div style="
        border:1px dashed var(--border); border-radius:var(--radius-lg);
        padding:40px 32px; text-align:center;
      ">
        <i data-lucide="git-branch" style="width:28px; height:28px; color:var(--text-muted); opacity:0.3; margin-bottom:10px;"></i>
        <div style="font-size:14px; color:var(--text-secondary); margin-bottom:4px;">No repos connected yet</div>
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

window._toggleSettingsWorkspace = function(wsIdx) {
  window._settingsState.expandedWorkspace =
    window._settingsState.expandedWorkspace === wsIdx ? null : wsIdx
  window._renderSettingsUI()
}

window._settingsUpdateWs = function(wsIdx, key, value) {
  const ws = window._appState.workspaces[wsIdx]
  if (!ws) return
  ws[key] = value
  // Re-render sidebar in case name/color changed
  if (key === 'name' || key === 'color') {
    if (typeof window.renderSidebar === 'function') window.renderSidebar()
  }
}

window._settingsToggleIntegration = function(wsIdx, id, enabledKey) {
  const ws = window._appState.workspaces[wsIdx]
  if (!ws) return
  ws[enabledKey] = !ws[enabledKey]
  window._renderSettingsUI()
}

window._settingsRemoveWorkspace = function(wsIdx) {
  const ws = window._appState.workspaces[wsIdx]
  if (!ws) return
  if (!confirm(`Remove workspace "${ws.name}"? This cannot be undone.`)) return
  window._appState.workspaces.splice(wsIdx, 1)
  window._settingsState.expandedWorkspace = null
  if (typeof window.renderSidebar === 'function') window.renderSidebar()
  window._renderSettingsUI()
  window.showToast(`Workspace "${ws.name}" removed.`, 'info')
}

window._settingsRemoveCustomLink = function(wsIdx, linkIdx) {
  const ws = window._appState.workspaces[wsIdx]
  if (!ws || !ws.customLinks) return
  ws.customLinks.splice(linkIdx, 1)
  window._renderSettingsUI()
}

// ── Custom link modal (reuses same pattern as onboarding) ─────────────────────

window._settingsOpenCustomLinkModal = function(wsIdx) {
  const existing = document.getElementById('custom-link-modal')
  if (existing) existing.remove()

  const modal = document.createElement('div')
  modal.id = 'custom-link-modal'
  modal.style.cssText = `
    position:fixed; inset:0; z-index:9999;
    background:rgba(0,0,0,0.6);
    display:flex; align-items:center; justify-content:center;
    padding:20px;
    backdrop-filter:blur(2px);
  `
  modal.innerHTML = `
    <div style="
      background:var(--bg-surface); border:1px solid var(--border);
      border-radius:var(--radius-lg); padding:32px 36px;
      width:100%; max-width:480px;
      box-shadow:0 24px 48px rgba(0,0,0,0.5);
    ">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px;">
        <div style="
          width:36px; height:36px; border-radius:var(--radius);
          background:var(--accent-muted); border:1px solid rgba(99,102,241,0.3);
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
        ">
          <i data-lucide="link-2" style="width:16px; height:16px; color:var(--accent);"></i>
        </div>
        <button onclick="window._settingsCloseCustomLinkModal()" style="
          width:28px; height:28px; border-radius:var(--radius);
          background:transparent; border:1px solid var(--border);
          color:var(--text-muted); cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          transition:border-color 0.15s, color 0.15s; flex-shrink:0;
        " onmouseover="this.style.borderColor='var(--text-secondary)';this.style.color='var(--text-primary)'"
           onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-muted)'">
          <i data-lucide="x" style="width:13px; height:13px;"></i>
        </button>
      </div>

      <h3 style="font-size:16px; font-weight:600; color:var(--text-primary); margin:0 0 8px;">Add a Custom Link</h3>
      <p style="font-size:13px; color:var(--text-secondary); line-height:1.6; margin:0 0 28px;">
        Since we don't automatically support every kind of site by default, we need to understand a bit about it so we can pull the right data.
      </p>

      <div style="margin-bottom:20px;">
        <label style="display:block; font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:8px;">
          <span style="color:var(--accent); margin-right:6px;">1.</span>What is this site?
        </label>
        <div style="position:relative;">
          <i data-lucide="globe" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); width:13px; height:13px; color:var(--text-muted); pointer-events:none;"></i>
          <input id="scl-modal-url" type="url" placeholder="https://yourcompany.notion.so" style="
            width:100%; box-sizing:border-box;
            background:var(--bg-raised); border:1px solid var(--border);
            border-radius:var(--radius); padding:9px 12px 9px 30px;
            font-size:13px; color:var(--text-primary);
            font-family:'IBM Plex Sans',sans-serif; outline:none; transition:border-color 0.15s;
          " onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'" />
        </div>
        <input id="scl-modal-label" type="text" placeholder="Give it a name  (e.g. Notion Docs, Confluence Wiki)" style="
          width:100%; box-sizing:border-box; margin-top:6px;
          background:var(--bg-raised); border:1px solid var(--border);
          border-radius:var(--radius); padding:9px 12px;
          font-size:13px; color:var(--text-primary);
          font-family:'IBM Plex Sans',sans-serif; outline:none; transition:border-color 0.15s;
        " onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'" />
      </div>

      <div style="margin-bottom:28px;">
        <label style="display:block; font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:8px;">
          <span style="color:var(--accent); margin-right:6px;">2.</span>What data do you want to track from this page?
        </label>
        <textarea id="scl-modal-description" placeholder="e.g. I want to track open tasks assigned to me, sprint status, and any pages I've been mentioned in." rows="3" style="
          width:100%; box-sizing:border-box;
          background:var(--bg-raised); border:1px solid var(--border);
          border-radius:var(--radius); padding:9px 12px;
          font-size:13px; color:var(--text-primary); line-height:1.55;
          font-family:'IBM Plex Sans',sans-serif; outline:none; resize:vertical;
          transition:border-color 0.15s;
        " onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'"></textarea>
      </div>

      <div style="display:flex; gap:8px;">
        <button onclick="window._settingsCloseCustomLinkModal()" style="
          flex:1; padding:9px 14px;
          background:var(--bg-raised); color:var(--text-secondary);
          border:1px solid var(--border); border-radius:var(--radius);
          font-size:13px; font-weight:600; font-family:'IBM Plex Sans',sans-serif;
          cursor:pointer; transition:opacity 0.15s;
        " onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">Cancel</button>
        <button onclick="window._settingsSubmitCustomLinkModal(${wsIdx})" style="
          flex:2; padding:9px 14px;
          background:var(--accent); color:#fff;
          border:none; border-radius:var(--radius);
          font-size:13px; font-weight:600; font-family:'IBM Plex Sans',sans-serif;
          cursor:pointer; transition:opacity 0.15s;
        " onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">Add Link</button>
      </div>
    </div>
  `

  modal.addEventListener('click', function(e) {
    if (e.target === modal) window._settingsCloseCustomLinkModal()
  })

  document.body.appendChild(modal)
  if (typeof lucide !== 'undefined') lucide.createIcons()
  setTimeout(() => { const el = document.getElementById('scl-modal-url'); if (el) el.focus() }, 50)
}

window._settingsCloseCustomLinkModal = function() {
  const modal = document.getElementById('custom-link-modal')
  if (modal) modal.remove()
}

window._settingsSubmitCustomLinkModal = function(wsIdx) {
  const url = (document.getElementById('scl-modal-url') || {}).value || ''
  const label = (document.getElementById('scl-modal-label') || {}).value || ''
  const description = (document.getElementById('scl-modal-description') || {}).value || ''

  if (!url.trim()) {
    const input = document.getElementById('scl-modal-url')
    if (input) {
      input.style.borderColor = 'var(--danger)'
      input.focus()
      setTimeout(() => { input.style.borderColor = 'var(--border)' }, 1500)
    }
    return
  }

  const ws = window._appState.workspaces[wsIdx]
  if (!ws) return
  if (!ws.customLinks) ws.customLinks = []
  ws.customLinks.push({ url: url.trim(), label: label.trim(), description: description.trim() })

  window._settingsCloseCustomLinkModal()
  window._renderSettingsUI()
}
