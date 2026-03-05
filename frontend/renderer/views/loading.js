// ── Scrape state ──────────────────────────────────────────────────────────────
// Keyed by "profilePath::service" → { status, count, error, result }
window._scrapeState = window._scrapeState || {}

// ── Raw scraped data — dashboard reads this ───────────────────────────────────
// Guard: app.js may not have run yet when this file is parsed
window._appState = window._appState || {}
window._appState.rawScrapedData = window._appState.rawScrapedData || {}

// ── Service helpers ───────────────────────────────────────────────────────────
function _svcLogo(service) {
  const map = {
    jira: '../assets/jira.svg',
    github: '../assets/github.svg',
    calendar: '../assets/google-calendar.svg'
  }
  return map[service] || ''
}

function _svcLabel(service) {
  const map = { jira: 'Jira', github: 'GitHub', calendar: 'Calendar' }
  return map[service] || service
}

function _safeId(str) {
  return (str || '').replace(/[^a-zA-Z0-9_-]/g, '_')
}

function _scrapeKey(profilePath, service) {
  return profilePath + '::' + service
}

// ── DOM patching ──────────────────────────────────────────────────────────────
function _patchServiceRow(profilePath, service) {
  const key = _scrapeKey(profilePath, service)
  const state = window._scrapeState[key] || { status: 'idle' }
  const rowEl = document.getElementById('srow-' + _safeId(key))
  if (!rowEl) return
  rowEl.innerHTML = _serviceRowStatus(state)
  if (typeof lucide !== 'undefined') lucide.createIcons()
}

function _serviceRowStatus(state) {
  if (state.status === 'scraping') {
    return `
      <div style="display:flex;align-items:center;gap:6px;">
        <div style="width:11px;height:11px;border-radius:50%;border:2px solid var(--border);border-top-color:var(--accent);animation:spin 0.7s linear infinite;flex-shrink:0;"></div>
        <span style="font-size:11px;color:var(--text-muted);">Scraping…</span>
      </div>`
  }
  if (state.status === 'done') {
    return `
      <div style="display:flex;align-items:center;gap:6px;">
        <i data-lucide="check-circle" style="width:12px;height:12px;color:var(--success);flex-shrink:0;"></i>
        <span style="font-size:11px;color:var(--success);font-weight:500;">${state.count} item${state.count !== 1 ? 's' : ''}</span>
      </div>`
  }
  if (state.status === 'error') {
    return `
      <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
        <i data-lucide="x-circle" style="width:12px;height:12px;color:var(--danger);flex-shrink:0;"></i>
        <span style="font-size:11px;color:var(--danger);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${(state.error||'').replace(/"/g,'&quot;')}">${state.error || 'Error'}</span>
      </div>`
  }
  return `<span style="font-size:11px;color:var(--text-muted);">Waiting…</span>`
}

function _checkAllSettled() {
  const keys = Object.keys(window._scrapeState)
  if (!keys.length) return
  const allDone = keys.every(k => {
    const s = window._scrapeState[k]
    return s.status === 'done' || s.status === 'error'
  })
  if (allDone) {
    const btn = document.getElementById('fetch-continue-btn')
    if (btn) { btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'; btn.style.transform = 'translateY(0)' }
  }
}

// ── Build profile tree from workspace.integrations ───────────────────────────
function _buildProfileTree(workspace) {
  // integrations: [{profilePath, profileName, profileEmail, service, urls:[]}]
  const map = {}
  for (const intg of (workspace.integrations || [])) {
    const path = intg.profilePath || intg.dir_name || 'Unknown'
    if (!map[path]) map[path] = { profilePath: path, profileName: intg.profileName || intg.profile_name || path, profileEmail: intg.profileEmail || intg.profile_email || '', services: [] }
    map[path].services.push({ service: intg.service, urls: Array.isArray(intg.urls) ? intg.urls : [] })
  }
  return Object.values(map)
}

// ── Main render ───────────────────────────────────────────────────────────────
window.renderLoading = function() {
  const container = document.querySelector('[data-view="loading"]')
  if (!container) return

  const workspace = window._appState.workspaces && window._appState.workspaces.length > 0
    ? window._appState.workspaces[window._appState.workspaces.length - 1]
    : null

  const wsName = workspace ? workspace.name : 'Your Workspace'
  const tree = workspace ? _buildProfileTree(workspace) : []

  // Reset scrape state
  window._scrapeState = {}
  window._appState.rawScrapedData = {}

  // Pre-populate state as 'waiting'
  tree.forEach(function(profile) {
    profile.services.forEach(function(svc) {
      if (svc.urls.length === 0) return
      const key = _scrapeKey(profile.profilePath, svc.service)
      window._scrapeState[key] = { status: 'waiting' }
    })
  })

  const hasWork = Object.keys(window._scrapeState).length > 0

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100%;background:var(--bg-base);padding:40px 20px;box-sizing:border-box;">

      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${workspace ? workspace.color : 'var(--accent)'};flex-shrink:0;"></div>
        <span style="font-size:16px;font-weight:600;color:var(--text-primary);">${wsName}</span>
      </div>
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:28px;">
        ${hasWork ? 'Scraping your configured pages…' : 'No integrations configured.'}
      </div>

      <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);width:100%;max-width:520px;overflow:hidden;">
        ${!hasWork
          ? `<div style="padding:24px;text-align:center;font-size:13px;color:var(--text-muted);">Go back and add some board, repo, or calendar URLs.</div>`
          : tree.map(function(profile, pi) {
              const profileServices = profile.services.filter(s => s.urls.length > 0)
              if (!profileServices.length) return ''
              return `
                <div style="${pi > 0 ? 'border-top:1px solid var(--border-subtle);' : ''}padding:16px 18px 0;">
                  <!-- Profile header -->
                  <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                    <div style="width:30px;height:30px;border-radius:50%;background:var(--bg-raised);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:var(--text-secondary);flex-shrink:0;">
                      ${(profile.profileName || '?').charAt(0).toUpperCase()}
                    </div>
                    <div style="flex:1;min-width:0;">
                      <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${profile.profileName}</div>
                      ${profile.profileEmail ? `<div style="font-size:11px;color:var(--text-muted);">${profile.profileEmail}</div>` : ''}
                    </div>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style="opacity:0.4;flex-shrink:0;">
                      <circle cx="8" cy="8" r="3" fill="#4285F4"/>
                      <path d="M8 5h6.5" stroke="#EA4335" stroke-width="2.5" stroke-linecap="round"/>
                      <path d="M8 5 L1.75 11" stroke="#FBBC04" stroke-width="2.5" stroke-linecap="round"/>
                      <path d="M14.5 8 Q13 13 8 11 Q3 9 1.75 11" stroke="#34A853" stroke-width="2.5" stroke-linecap="round" fill="none"/>
                    </svg>
                  </div>

                  <!-- Services tree -->
                  <div style="margin-left:15px;padding-left:16px;border-left:1.5px solid var(--border-subtle);padding-bottom:16px;">
                    ${profileServices.map(function(svc, si) {
                        const key = _scrapeKey(profile.profilePath, svc.service)
                        const isLastSvc = si === profileServices.length - 1
                        return `
                          <div style="margin-bottom:${isLastSvc ? '0' : '14px'};">
                            <!-- Service row -->
                            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">
                              <div style="display:flex;align-items:center;gap:7px;">
                                <div style="width:20px;height:20px;border-radius:4px;background:var(--bg-raised);border:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                                  <img src="${_svcLogo(svc.service)}" style="width:13px;height:13px;object-fit:contain;" onerror="this.style.display='none'">
                                </div>
                                <span style="font-size:12px;font-weight:600;color:var(--text-secondary);">${_svcLabel(svc.service)}</span>
                              </div>
                              <div id="srow-${_safeId(key)}" style="display:flex;align-items:center;">
                                ${_serviceRowStatus(window._scrapeState[key] || { status: 'waiting' })}
                              </div>
                            </div>
                            <!-- URL list -->
                            <div style="margin-left:13px;padding-left:14px;border-left:1.5px solid var(--border-subtle);display:flex;flex-direction:column;gap:3px;">
                              ${svc.urls.map(function(url) {
                                  let display = url
                                  try { const u = new URL(url); display = u.hostname + u.pathname.replace(/\/$/, ''); if (display.length > 44) display = display.slice(0, 42) + '…' } catch {}
                                  return `<div style="font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${url}">${display}</div>`
                                }).join('')}
                            </div>
                          </div>
                        `
                      }).join('')}
                  </div>
                </div>
              `
            }).join('')
        }
      </div>

      <div style="margin-top:24px;height:40px;">
        <button id="fetch-continue-btn" onclick="window._loadingContinue()"
          style="padding:10px 24px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius);font-size:14px;font-weight:600;font-family:'IBM Plex Sans',sans-serif;cursor:pointer;display:flex;align-items:center;gap:8px;opacity:0;pointer-events:none;transform:translateY(6px);transition:opacity 0.3s,transform 0.3s;"
          onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
          Continue to Dashboard
          <i data-lucide="arrow-right" style="width:14px;height:14px;"></i>
        </button>
      </div>
    </div>
  `

  if (typeof lucide !== 'undefined') lucide.createIcons()

  if (!hasWork) {
    const btn = document.getElementById('fetch-continue-btn')
    if (btn) { btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'; btn.style.transform = 'translateY(0)' }
    return
  }

  // Fire one scrape per profile×service (sequential within a profile — same Chrome instance)
  // Group by profilePath so same browser session handles all services for that profile
  const profileGroups = {}
  tree.forEach(function(profile) {
    profile.services.filter(s => s.urls.length > 0).forEach(function(svc) {
      if (!profileGroups[profile.profilePath]) profileGroups[profile.profilePath] = { profile, tasks: [] }
      profileGroups[profile.profilePath].tasks.push(svc)
    })
  })

  Object.values(profileGroups).forEach(function(group) {
    const { profile, tasks } = group

    // Run tasks for this profile sequentially (they share a browser instance)
    var chain = Promise.resolve()
    tasks.forEach(function(svc) {
      chain = chain.then(function() {
        const key = _scrapeKey(profile.profilePath, svc.service)
        window._scrapeState[key] = { status: 'scraping' }
        _patchServiceRow(profile.profilePath, svc.service)

        if (!window.api || !window.api.scrapeRaw) {
          // No backend — mark done immediately with 0 items
          window._scrapeState[key] = { status: 'done', count: 0 }
          _patchServiceRow(profile.profilePath, svc.service)
          _checkAllSettled()
          return Promise.resolve()
        }

        return window.api.scrapeRaw({
          profileDirName: profile.profilePath,
          service: svc.service,
          urls: svc.urls
        }).then(function(result) {
          const count = result.count || 0
          window._scrapeState[key] = { status: result.error ? 'error' : 'done', count: count, error: result.error || null }
          // Store raw result for dashboard logging
          if (!window._appState.rawScrapedData[profile.profilePath]) {
            window._appState.rawScrapedData[profile.profilePath] = {}
          }
          window._appState.rawScrapedData[profile.profilePath][svc.service] = result
          _patchServiceRow(profile.profilePath, svc.service)
          _checkAllSettled()
        }).catch(function(err) {
          const msg = (err && err.message) || 'Scrape failed'
          window._scrapeState[key] = { status: 'error', count: 0, error: msg }
          _patchServiceRow(profile.profilePath, svc.service)
          _checkAllSettled()
        })
      })
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

  window.localStorage.setItem("onboarded", true);
  window.localStorage.setItem("workplaces", window._appState.workspaces);
}
