// Onboarding: GitHub + Jira source connector
// Single-step flow — enter GitHub repo URLs and Jira board URLs

window._onboardingState = {
  repos: [],     // [{ url, hostname, label, sessionLabel }]  — GitHub
  boards: [],    // [{ url, hostname, label, sessionLabel }]  — Jira
  calendars: [], // [{ email, label, sessionLabel }]          — Google Calendar
}

// ── GitHub helpers ────────────────────────────────────────────────────────────

function _isValidGithubUrl(url) {
  return /^https?:\/\/[^/]+\/[^/]+\/[^/]+/.test(url)
}

function _onboardingInputChanged() {
  const input = document.getElementById('ob-url-input')
  const btn = document.getElementById('ob-connect-btn')
  if (!input || !btn) return
  const url = input.value.trim()
  const valid = _isValidGithubUrl(url)
  const duplicate = window._onboardingState.repos.some(r => r.url === url)
  btn.style.display = valid ? 'inline-flex' : 'none'
  btn.disabled = duplicate
  btn.title = duplicate ? 'Already connected' : ''
}

async function _onboardingConnect() {
  const input = document.getElementById('ob-url-input')
  const btn = document.getElementById('ob-connect-btn')
  if (!input) return
  const url = input.value.trim()
  if (!_isValidGithubUrl(url)) return

  btn.disabled = true
  btn.textContent = 'Connecting…'

  try {
    const result = await window.api.connectGithubSource(url)
    const parsed = new URL(url)
    const hostname = parsed.hostname
    const pathParts = parsed.pathname.split('/').filter(Boolean)
    const label = hostname + ' · ' + pathParts.slice(0, 2).join('/')
    const sessionLabel = result.cached ? 'session reused' : 'session saved'
    window._onboardingState.repos.push({ url, hostname, label, sessionLabel })
    input.value = ''
    _renderOnboardingRepos()
    _updateContinueBtn()
  } catch (err) {
    window.showToast('Failed to connect: ' + (err.message || err), 'error')
  } finally {
    btn.textContent = 'Connect'
    btn.disabled = false
    btn.style.display = 'none'
  }
}

function _onboardingRemoveRepo(idx) {
  window._onboardingState.repos.splice(idx, 1)
  _renderOnboardingRepos()
  _updateContinueBtn()
}

function _renderOnboardingRepos() {
  const container = document.getElementById('ob-repos-container')
  if (!container) return

  const repos = window._onboardingState.repos
  if (repos.length === 0) {
    container.innerHTML = ''
    return
  }

  container.innerHTML = `
    <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">Connected repos:</div>
    <div style="display:flex; flex-wrap:wrap; gap:8px;">
      ${repos.map((r, i) => `
        <span style="
          display:inline-flex; align-items:center; gap:6px;
          background:var(--bg-raised); border:1px solid var(--border);
          border-radius:var(--radius); padding:4px 10px; font-size:12px;
          color:var(--text-primary);
        ">
          ${r.label}
          <span style="font-size:10px; color:var(--text-muted);">(${r.sessionLabel})</span>
          <button
            onclick="window._onboardingRemoveRepo(${i})"
            style="background:none; border:none; cursor:pointer; color:var(--text-muted); font-size:14px; line-height:1; padding:0 2px; margin-left:2px;"
            title="Remove"
          >×</button>
        </span>
      `).join('')}
    </div>
  `
}

// ── Jira helpers ──────────────────────────────────────────────────────────────

function _isValidJiraUrl(url) {
  // Accept any https URL with at least a hostname
  return /^https?:\/\/[^/]+/.test(url)
}

function _onboardingJiraInputChanged() {
  const input = document.getElementById('ob-jira-input')
  const btn = document.getElementById('ob-jira-connect-btn')
  if (!input || !btn) return
  const url = input.value.trim()
  const valid = _isValidJiraUrl(url)
  const duplicate = window._onboardingState.boards.some(b => b.url === url)
  btn.style.display = valid ? 'inline-flex' : 'none'
  btn.disabled = duplicate
  btn.title = duplicate ? 'Already connected' : ''
}

async function _onboardingJiraConnect() {
  const input = document.getElementById('ob-jira-input')
  const btn = document.getElementById('ob-jira-connect-btn')
  if (!input) return
  const url = input.value.trim()
  if (!_isValidJiraUrl(url)) return

  btn.disabled = true
  btn.textContent = 'Connecting…'

  try {
    const result = await window.api.connectJiraSource(url)
    const parsed = new URL(url)
    const hostname = parsed.hostname
    const label = hostname
    const sessionLabel = result.cached ? 'session reused' : 'session saved'
    window._onboardingState.boards.push({ url, hostname, label, sessionLabel })
    input.value = ''
    _renderOnboardingBoards()
    _updateContinueBtn()
  } catch (err) {
    window.showToast('Failed to connect Jira: ' + (err.message || err), 'error')
  } finally {
    btn.textContent = 'Connect'
    btn.disabled = false
    btn.style.display = 'none'
  }
}

function _onboardingRemoveBoard(idx) {
  window._onboardingState.boards.splice(idx, 1)
  _renderOnboardingBoards()
  _updateContinueBtn()
}

function _renderOnboardingBoards() {
  const container = document.getElementById('ob-boards-container')
  if (!container) return

  const boards = window._onboardingState.boards
  if (boards.length === 0) {
    container.innerHTML = ''
    return
  }

  container.innerHTML = `
    <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">Connected boards:</div>
    <div style="display:flex; flex-wrap:wrap; gap:8px;">
      ${boards.map((b, i) => `
        <span style="
          display:inline-flex; align-items:center; gap:6px;
          background:var(--bg-raised); border:1px solid var(--border);
          border-radius:var(--radius); padding:4px 10px; font-size:12px;
          color:var(--text-primary);
        ">
          ${b.label}
          <span style="font-size:10px; color:var(--text-muted);">(${b.sessionLabel})</span>
          <button
            onclick="window._onboardingRemoveBoard(${i})"
            style="background:none; border:none; cursor:pointer; color:var(--text-muted); font-size:14px; line-height:1; padding:0 2px; margin-left:2px;"
            title="Remove"
          >×</button>
        </span>
      `).join('')}
    </div>
  `
}

// ── Google Calendar helpers ───────────────────────────────────────────────────

function _isValidCalendarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function _onboardingCalInputChanged() {
  const input = document.getElementById('ob-cal-input')
  const btn = document.getElementById('ob-cal-connect-btn')
  if (!input || !btn) return
  const email = input.value.trim()
  const valid = _isValidCalendarEmail(email)
  const duplicate = window._onboardingState.calendars.some(c => c.email === email)
  btn.style.display = valid ? 'inline-flex' : 'none'
  btn.disabled = duplicate
  btn.title = duplicate ? 'Already connected' : ''
}

async function _onboardingCalConnect() {
  const input = document.getElementById('ob-cal-input')
  const btn = document.getElementById('ob-cal-connect-btn')
  if (!input) return
  const email = input.value.trim()
  if (!_isValidCalendarEmail(email)) return

  btn.disabled = true
  btn.textContent = 'Connecting…'

  try {
    const result = await window.api.connectCalendarSource(email)
    if (!result.authed) {
      window.showToast('Login cancelled — try again', 'error')
      return
    }
    const sessionLabel = result.cached ? 'session reused' : 'session saved'
    window._onboardingState.calendars.push({ email, label: email, sessionLabel })
    input.value = ''
    _renderOnboardingCalendars()
    _updateContinueBtn()
  } catch (err) {
    window.showToast('Failed to connect calendar: ' + (err.message || err), 'error')
  } finally {
    btn.textContent = 'Connect'
    btn.disabled = false
    btn.style.display = 'none'
  }
}

function _onboardingRemoveCalendar(idx) {
  window._onboardingState.calendars.splice(idx, 1)
  _renderOnboardingCalendars()
  _updateContinueBtn()
}

function _renderOnboardingCalendars() {
  const container = document.getElementById('ob-calendars-container')
  if (!container) return

  const calendars = window._onboardingState.calendars
  if (calendars.length === 0) {
    container.innerHTML = ''
    return
  }

  container.innerHTML = `
    <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">Connected accounts:</div>
    <div style="display:flex; flex-wrap:wrap; gap:8px;">
      ${calendars.map((c, i) => `
        <span style="
          display:inline-flex; align-items:center; gap:6px;
          background:var(--bg-raised); border:1px solid var(--border);
          border-radius:var(--radius); padding:4px 10px; font-size:12px;
          color:var(--text-primary);
        ">
          ${c.email}
          <span style="font-size:10px; color:var(--text-muted);">(${c.sessionLabel})</span>
          <button
            onclick="window._onboardingRemoveCalendar(${i})"
            style="background:none; border:none; cursor:pointer; color:var(--text-muted); font-size:14px; line-height:1; padding:0 2px; margin-left:2px;"
            title="Remove"
          >×</button>
        </span>
      `).join('')}
    </div>
  `
}

// ── Continue button ───────────────────────────────────────────────────────────

function _updateContinueBtn() {
  const btn = document.getElementById('ob-continue-btn')
  if (!btn) return
  const hasAny = window._onboardingState.repos.length > 0 || window._onboardingState.boards.length > 0 || window._onboardingState.calendars.length > 0
  btn.style.display = hasAny ? 'inline-flex' : 'none'
}

async function _onboardingContinue() {
  const btn = document.getElementById('ob-continue-btn')
  if (btn) { btn.disabled = true; btn.textContent = 'Syncing…' }

  const repos = window._onboardingState.repos
  const boards = window._onboardingState.boards
  const calendars = window._onboardingState.calendars

  try {
    // Sync GitHub repos
    if (repos.length > 0) {
      const scrapes = await Promise.all(
        repos.map(async r => {
          const result = await window.api.scrapeGithubIssues(r.url)
          return { repoUrl: r.url, items: [...(result.issues || []), ...(result.prs || [])] }
        })
      )
      await window.api.githubSaveScrape({ repos, scrapes })
    }

    // Sync Jira boards
    if (boards.length > 0) {
      const scrapes = await Promise.all(
        boards.map(async b => {
          const result = await window.api.scrapeJiraBoard(b.url)
          return { boardUrl: b.url, items: result.items || [] }
        })
      )
      await window.api.jiraSaveScrape({ boards, scrapes })
    }

    // Sync Google Calendar accounts
    if (calendars.length > 0) {
      await Promise.all(
        calendars.map(async c => {
          const result = await window.api.scrapeCalendarEvents(c.email)
          await window.api.calendarSaveScrape({ email: c.email, label: c.label, events: result.events || [] })
        })
      )
    }
  } catch (err) {
    console.warn('[onboarding] Scrape/save failed:', err)
  }

  localStorage.setItem('onboarded', '1')
  window.navigate('overview')
}

// ── Render ────────────────────────────────────────────────────────────────────

window.renderOnboarding = function () {
  const container = document.querySelector('[data-view="onboarding"]')
  if (!container) return

  container.innerHTML = `
    <div style="
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      height:100%; padding:40px 24px; overflow-y:auto;
    ">
      <div style="
        background:var(--bg-surface); border:1px solid var(--border);
        border-radius:var(--radius-lg); padding:40px;
        width:100%; max-width:580px;
        box-shadow:0 2px 12px rgba(0,0,0,0.06);
      ">
        <h2 style="margin:0 0 6px; font-size:20px; font-weight:600; color:var(--text-primary);">
          Connect your sources
        </h2>
        <p style="margin:0 0 28px; font-size:13px; color:var(--text-muted); line-height:1.5;">
          Add GitHub repos and Jira boards. Your browser sessions are reused — no tokens stored.
        </p>

        <!-- GitHub section -->
        <div style="margin-bottom:28px;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
            <img src="../assets/github.svg" style="width:14px; height:14px; filter:invert(0.4);"
              onerror="this.style.display='none'">
            <span style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.06em;">GitHub</span>
          </div>
          <div style="display:flex; gap:8px; margin-bottom:12px;">
            <input
              id="ob-url-input"
              type="url"
              placeholder="https://github.com/your-org/repo"
              oninput="window._onboardingInputChanged()"
              onkeydown="if(event.key==='Enter'){ const b=document.getElementById('ob-connect-btn'); if(b&&!b.disabled) window._onboardingConnect() }"
              style="
                flex:1; padding:9px 12px; border:1px solid var(--border);
                border-radius:var(--radius); background:var(--bg-base);
                color:var(--text-primary); font-size:13px; outline:none;
                transition:border-color 0.15s;
              "
              onfocus="this.style.borderColor='var(--accent)'"
              onblur="this.style.borderColor='var(--border)'"
            />
            <button
              id="ob-connect-btn"
              onclick="window._onboardingConnect()"
              style="
                display:none; align-items:center; gap:6px;
                padding:9px 16px; background:var(--accent); color:#fff;
                border:none; border-radius:var(--radius); font-size:13px;
                font-weight:500; cursor:pointer; white-space:nowrap;
              "
            >Connect</button>
          </div>
          <div id="ob-repos-container"></div>
        </div>

        <!-- Divider -->
        <div style="border-top:1px solid var(--border-subtle); margin-bottom:28px;"></div>

        <!-- Jira section -->
        <div style="margin-bottom:28px;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
            <img src="../assets/jira.svg" style="width:14px; height:14px;"
              onerror="this.style.display='none'">
            <span style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.06em;">Jira</span>
          </div>
          <div style="display:flex; gap:8px; margin-bottom:12px;">
            <input
              id="ob-jira-input"
              type="url"
              placeholder="https://yourcompany.atlassian.net"
              oninput="window._onboardingJiraInputChanged()"
              onkeydown="if(event.key==='Enter'){ const b=document.getElementById('ob-jira-connect-btn'); if(b&&!b.disabled) window._onboardingJiraConnect() }"
              style="
                flex:1; padding:9px 12px; border:1px solid var(--border);
                border-radius:var(--radius); background:var(--bg-base);
                color:var(--text-primary); font-size:13px; outline:none;
                transition:border-color 0.15s;
              "
              onfocus="this.style.borderColor='var(--accent)'"
              onblur="this.style.borderColor='var(--border)'"
            />
            <button
              id="ob-jira-connect-btn"
              onclick="window._onboardingJiraConnect()"
              style="
                display:none; align-items:center; gap:6px;
                padding:9px 16px; background:var(--accent); color:#fff;
                border:none; border-radius:var(--radius); font-size:13px;
                font-weight:500; cursor:pointer; white-space:nowrap;
              "
            >Connect</button>
          </div>
          <div id="ob-boards-container"></div>
        </div>

        <!-- Divider -->
        <div style="border-top:1px solid var(--border-subtle); margin-bottom:28px;"></div>

        <!-- Google Calendar section -->
        <div style="margin-bottom:28px;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
            <img src="../assets/google-calendar.svg" style="width:14px; height:14px;"
              onerror="this.style.display='none'">
            <span style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.06em;">Google Calendar</span>
          </div>
          <div style="display:flex; gap:8px; margin-bottom:12px;">
            <input
              id="ob-cal-input"
              type="email"
              placeholder="you@gmail.com or you@company.com"
              oninput="window._onboardingCalInputChanged()"
              onkeydown="if(event.key==='Enter'){ const b=document.getElementById('ob-cal-connect-btn'); if(b&&!b.disabled) window._onboardingCalConnect() }"
              style="
                flex:1; padding:9px 12px; border:1px solid var(--border);
                border-radius:var(--radius); background:var(--bg-base);
                color:var(--text-primary); font-size:13px; outline:none;
                transition:border-color 0.15s;
              "
              onfocus="this.style.borderColor='var(--accent)'"
              onblur="this.style.borderColor='var(--border)'"
            />
            <button
              id="ob-cal-connect-btn"
              onclick="window._onboardingCalConnect()"
              style="
                display:none; align-items:center; gap:6px;
                padding:9px 16px; background:var(--accent); color:#fff;
                border:none; border-radius:var(--radius); font-size:13px;
                font-weight:500; cursor:pointer; white-space:nowrap;
              "
            >Connect</button>
          </div>
          <div id="ob-calendars-container"></div>
        </div>

        <button
          id="ob-continue-btn"
          onclick="window._onboardingContinue()"
          style="
            display:none; align-items:center; gap:6px;
            padding:10px 20px; background:var(--accent); color:#fff;
            border:none; border-radius:var(--radius); font-size:13px;
            font-weight:500; cursor:pointer;
          "
        >Continue →</button>
      </div>
    </div>
  `

  lucide.createIcons()

  // Re-render state if navigated away and back
  if (window._onboardingState.repos.length > 0) _renderOnboardingRepos()
  if (window._onboardingState.boards.length > 0) _renderOnboardingBoards()
  if (window._onboardingState.calendars.length > 0) _renderOnboardingCalendars()
  _updateContinueBtn()
}

// Expose helpers on window for inline event handlers
window._onboardingInputChanged = _onboardingInputChanged
window._onboardingConnect = _onboardingConnect
window._onboardingRemoveRepo = _onboardingRemoveRepo
window._onboardingJiraInputChanged = _onboardingJiraInputChanged
window._onboardingJiraConnect = _onboardingJiraConnect
window._onboardingRemoveBoard = _onboardingRemoveBoard
window._onboardingCalInputChanged = _onboardingCalInputChanged
window._onboardingCalConnect = _onboardingCalConnect
window._onboardingRemoveCalendar = _onboardingRemoveCalendar
window._onboardingContinue = _onboardingContinue
