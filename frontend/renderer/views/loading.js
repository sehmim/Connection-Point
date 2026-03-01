// ── Shared fetch state ────────────────────────────────────────────────────────
// Keyed by "wsName:serviceId" → { status: 'idle'|'fetching'|'done'|'error', message: '', count: null, ts: null }
// Persists across navigations so Settings can read it.
window._fetchState = window._fetchState || {}

// ── Service definitions ───────────────────────────────────────────────────────
window._ALL_SERVICES = [
  { key: 'jira',    label: 'Jira',             logo: '../assets/jira.svg'            },
  { key: 'github',  label: 'GitHub',            logo: '../assets/github.svg'          },
  { key: 'gmail',   label: 'Gmail',             logo: '../assets/gmail.svg'           },
  { key: 'gcal',    label: 'Google Calendar',   logo: '../assets/google-calendar.svg' },
  { key: 'outlook', label: 'Outlook Calendar',  logo: '../assets/outlook.svg'         },
]

// ── Fetch via IPC (Phase 2) ───────────────────────────────────────────────────
window._mockFetchService = function(wsName, serviceId) {
  const key = wsName + ':' + serviceId
  window._fetchState[key] = { status: 'fetching', message: '', count: null, ts: null }

  if (window.api && window.api.fetchService) {
    return window.api.fetchService(wsName, serviceId)
      .then(function(r) {
        window._fetchState[key] = { status: 'done', message: '', count: r.count || 0, ts: Date.now() }
        return r
      })
      .catch(function(e) {
        const msg = (e && e.message) || 'Sync failed'
        window._fetchState[key] = { status: 'error', message: msg, count: null, ts: Date.now() }
        throw e
      })
  }

  // Fallback mock when running without backend
  const delay = 800 + Math.random() * 1200
  const succeed = Math.random() < 0.8
  return new Promise(function(resolve, reject) {
    setTimeout(function() {
      if (succeed) {
        const count = Math.floor(Math.random() * 24) + 1
        window._fetchState[key] = { status: 'done', message: '', count: count, ts: Date.now() }
        resolve({ ok: true, count: count })
      } else {
        const msg = 'Needs manual login via browser'
        window._fetchState[key] = { status: 'error', message: msg, count: null, ts: Date.now() }
        reject({ message: msg })
      }
    }, delay)
  })
}

// ── Retry (loading screen) ────────────────────────────────────────────────────
window._retryFetchService = function(wsName, serviceId) {
  const key = wsName + ':' + serviceId
  // Patch the row back to fetching state immediately
  _patchFetchRow(wsName, serviceId)

  window._mockFetchService(wsName, serviceId).then(function() {
    _patchFetchRow(wsName, serviceId)
    _checkAllSettled(wsName)
  }).catch(function() {
    _patchFetchRow(wsName, serviceId)
    _checkAllSettled(wsName)
  })
}

// ── DOM helpers ───────────────────────────────────────────────────────────────
function _safeId(str) {
  return str.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function _fetchRowId(wsName, serviceId) {
  return 'fetch-row-' + _safeId(wsName) + '-' + serviceId
}

function _patchFetchRow(wsName, serviceId) {
  const key = wsName + ':' + serviceId
  const state = window._fetchState[key] || { status: 'idle' }
  const svc = (window._ALL_SERVICES || []).find(s => s.key === serviceId)
  const rowEl = document.getElementById(_fetchRowId(wsName, serviceId))
  if (!rowEl) return

  rowEl.innerHTML = _fetchRowInnerHTML(svc, wsName, state)
  if (typeof lucide !== 'undefined') lucide.createIcons()
}

function _fetchRowInnerHTML(svc, wsName, state) {
  let icon = ''
  let statusText = ''
  let retryBtn = ''

  if (state.status === 'fetching') {
    icon = `<div style="
      width:14px; height:14px; border-radius:50%;
      border:2px solid var(--border);
      border-top-color:var(--accent);
      animation:spin 0.7s linear infinite;
      flex-shrink:0;
    "></div>`
    statusText = `<span style="font-size:12px; color:var(--text-muted);">Fetching…</span>`
  } else if (state.status === 'done') {
    icon = `<i data-lucide="check-circle" style="width:15px; height:15px; color:var(--success); flex-shrink:0;"></i>`
    statusText = `<span style="font-size:12px; color:var(--success); font-weight:500;">Fetched ${state.count} item${state.count !== 1 ? 's' : ''}</span>`
  } else if (state.status === 'error') {
    icon = `<i data-lucide="x-circle" style="width:15px; height:15px; color:var(--danger); flex-shrink:0;"></i>`
    statusText = `<span style="font-size:12px; color:var(--danger);">${state.message || 'Error'}</span>`
    retryBtn = `<button
      onclick="window._retryFetchService('${wsName.replace(/'/g, "\\'")}', '${svc.key}')"
      style="
        margin-left:8px; padding:3px 10px;
        background:transparent; color:var(--accent);
        border:1px solid var(--accent); border-radius:var(--radius);
        font-size:11px; font-weight:600;
        font-family:'IBM Plex Sans',sans-serif;
        cursor:pointer; flex-shrink:0;
        transition:background 0.15s;
      "
      onmouseover="this.style.background='var(--accent-muted)'"
      onmouseout="this.style.background='transparent'"
    >Retry</button>`
  } else {
    icon = `<div style="width:8px; height:8px; border-radius:50%; background:var(--border); flex-shrink:0;"></div>`
    statusText = `<span style="font-size:12px; color:var(--text-muted);">Waiting…</span>`
  }

  return `
    <div style="display:flex; align-items:center; gap:10px; width:20px; height:20px; flex-shrink:0; justify-content:center;">
      ${icon}
    </div>
    <div style="width:22px; height:22px; flex-shrink:0; display:flex; align-items:center; justify-content:center;">
      <img src="${svc.logo}" alt="${svc.label}" style="width:16px; height:16px; object-fit:contain;"
        onerror="this.style.display='none'">
    </div>
    <span style="font-size:13px; color:var(--text-primary); font-weight:500; flex:1;">${svc.label}</span>
    <div style="display:flex; align-items:center; gap:0; margin-left:auto; flex-shrink:0;">
      ${statusText}
      ${retryBtn}
    </div>
  `
}

function _checkAllSettled(wsName) {
  const enabledServices = _getEnabledServices(wsName)
  const allSettled = enabledServices.every(function(svc) {
    const key = wsName + ':' + svc.key
    const st = window._fetchState[key]
    return st && (st.status === 'done' || st.status === 'error')
  })
  if (allSettled) {
    const btn = document.getElementById('fetch-continue-btn')
    if (btn) {
      btn.style.opacity = '1'
      btn.style.pointerEvents = 'auto'
      btn.style.transform = 'translateY(0)'
    }
  }
}

function _getEnabledServices(wsName) {
  const ws = window._appState && window._appState.workspaces
    ? window._appState.workspaces.find(function(w) { return w.name === wsName })
    : null
  if (!ws) return []
  return (window._ALL_SERVICES || []).filter(function(s) { return ws[s.key + 'Enabled'] })
}

// ── Main render ───────────────────────────────────────────────────────────────
window.renderLoading = function() {
  const container = document.querySelector('[data-view="loading"]')
  if (!container) return

  const workspace = window._appState && window._appState.workspaces && window._appState.workspaces.length > 0
    ? window._appState.workspaces[window._appState.workspaces.length - 1]
    : null

  const wsName = workspace ? workspace.name : 'Your Workspace'
  const enabledServices = workspace
    ? (window._ALL_SERVICES || []).filter(function(s) { return workspace[s.key + 'Enabled'] })
    : []

  // Initialise all to fetching in state
  enabledServices.forEach(function(svc) {
    window._fetchState[wsName + ':' + svc.key] = { status: 'fetching', message: '', count: null, ts: null }
  })

  container.innerHTML = `
    <div style="
      display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      height:100%; background:var(--bg-base);
    ">
      <!-- Workspace header -->
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
        <div style="
          width:10px; height:10px; border-radius:50%; flex-shrink:0;
          background:${workspace ? workspace.color : 'var(--accent)'};
        "></div>
        <span style="font-size:16px; font-weight:600; color:var(--text-primary);">
          ${wsName}
        </span>
      </div>
      <div style="font-size:13px; color:var(--text-muted); margin-bottom:36px;">
        Fetching your data…
      </div>

      <!-- Service rows -->
      <div style="
        background:var(--bg-surface); border:1px solid var(--border);
        border-radius:var(--radius-lg); min-width:360px; max-width:440px; width:100%;
        overflow:hidden;
      ">
        ${enabledServices.length === 0
          ? `<div style="padding:24px 20px; text-align:center; font-size:13px; color:var(--text-muted);">No integrations enabled for this workspace.</div>`
          : enabledServices.map(function(svc, i) {
              const key = wsName + ':' + svc.key
              const state = window._fetchState[key] || { status: 'fetching' }
              return `
                <div
                  id="${_fetchRowId(wsName, svc.key)}"
                  style="
                    display:flex; align-items:center; gap:10px;
                    padding:14px 18px;
                    ${i < enabledServices.length - 1 ? 'border-bottom:1px solid var(--border-subtle);' : ''}
                  "
                >
                  ${_fetchRowInnerHTML(svc, wsName, state)}
                </div>
              `
            }).join('')
        }
      </div>

      <!-- Continue button (hidden until all settled) -->
      <div style="margin-top:28px; height:40px;">
        <button
          id="fetch-continue-btn"
          onclick="window._loadingContinue()"
          style="
            padding:10px 24px;
            background:var(--accent); color:#fff;
            border:none; border-radius:var(--radius);
            font-size:14px; font-weight:600;
            font-family:'IBM Plex Sans',sans-serif;
            cursor:pointer;
            display:flex; align-items:center; gap:8px;
            opacity:0; pointer-events:none;
            transform:translateY(6px);
            transition:opacity 0.3s, transform 0.3s;
          "
          onmouseover="this.style.opacity='0.85'"
          onmouseout="this.style.opacity='1'"
        >
          Continue to Overview
          <i data-lucide="arrow-right" style="width:14px; height:14px;"></i>
        </button>
      </div>
    </div>
  `

  if (typeof lucide !== 'undefined') lucide.createIcons()

  // If no services, show continue immediately
  if (enabledServices.length === 0) {
    const btn = document.getElementById('fetch-continue-btn')
    if (btn) {
      btn.style.opacity = '1'
      btn.style.pointerEvents = 'auto'
      btn.style.transform = 'translateY(0)'
    }
    return
  }

  // Fire all fetches in parallel
  enabledServices.forEach(function(svc) {
    window._mockFetchService(wsName, svc.key).then(function() {
      _patchFetchRow(wsName, svc.key)
      _checkAllSettled(wsName)
    }).catch(function() {
      _patchFetchRow(wsName, svc.key)
      _checkAllSettled(wsName)
    })
  })
}

window._loadingContinue = function() {
  const workspace = window._appState && window._appState.workspaces && window._appState.workspaces.length > 0
    ? window._appState.workspaces[window._appState.workspaces.length - 1]
    : null
  window.showToast('Workspace "' + (workspace ? workspace.name : '') + '" ready!', 'success')
  window.navigate('overview')
  if (typeof window.renderSidebar === 'function') window.renderSidebar()
}
