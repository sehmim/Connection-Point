// Onboarding: GitHub source connector
// Single-step flow — user enters GitHub repo URLs, session cookies are persisted per hostname

window._onboardingState = {
  repos: [] // [{ url, hostname, label, sessionLabel }]
}

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
}

function _renderOnboardingRepos() {
  const container = document.getElementById('ob-repos-container')
  const continueBtn = document.getElementById('ob-continue-btn')
  if (!container) return

  const repos = window._onboardingState.repos
  if (repos.length === 0) {
    container.innerHTML = ''
    if (continueBtn) continueBtn.style.display = 'none'
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
            style="
              background:none; border:none; cursor:pointer;
              color:var(--text-muted); font-size:14px; line-height:1;
              padding:0 2px; margin-left:2px;
            "
            title="Remove"
          >×</button>
        </span>
      `).join('')}
    </div>
  `

  if (continueBtn) continueBtn.style.display = 'inline-flex'
}

async function _onboardingContinue() {
  const btn = document.getElementById('ob-continue-btn')
  if (btn) { btn.disabled = true; btn.textContent = 'Syncing…' }

  const repos = window._onboardingState.repos
  try {
    const scrapes = await Promise.all(
      repos.map(async r => {
        const result = await window.api.scrapeGithubIssues(r.url)
        return { repoUrl: r.url, items: [...(result.issues || []), ...(result.prs || [])] }
      })
    )
    await window.api.githubSaveScrape({ repos, scrapes })
  } catch (err) {
    console.warn('[onboarding] Scrape/save failed:', err)
  }

  localStorage.setItem('onboarded', '1')
  window.navigate('overview')
}

window.renderOnboarding = function () {
  const container = document.querySelector('[data-view="onboarding"]')
  if (!container) return

  container.innerHTML = `
    <div style="
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      height:100%; padding:40px 24px;
    ">
      <div style="
        background:var(--bg-surface); border:1px solid var(--border);
        border-radius:var(--radius-lg); padding:40px;
        width:100%; max-width:560px;
        box-shadow:0 2px 12px rgba(0,0,0,0.06);
      ">
        <h2 style="margin:0 0 6px; font-size:20px; font-weight:600; color:var(--text-primary);">
          Connect a GitHub source
        </h2>
        <p style="margin:0 0 28px; font-size:13px; color:var(--text-muted); line-height:1.5;">
          Enter a GitHub or GitHub Enterprise repository URL. Your browser session will be reused — no tokens stored.
        </p>

        <div style="display:flex; gap:8px; margin-bottom:20px;">
          <input
            id="ob-url-input"
            type="url"
            placeholder="https://github.com/your-org/repo"
            oninput="window._onboardingInputChanged()"
            onkeydown="if(event.key==='Enter' && !document.getElementById('ob-connect-btn').disabled) window._onboardingConnect()"
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

        <div id="ob-repos-container" style="margin-bottom:20px;"></div>

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

  // Re-render repos if state already has entries (e.g. navigated away and back)
  if (window._onboardingState.repos.length > 0) {
    _renderOnboardingRepos()
  }
}

// Expose helpers on window for inline event handlers
window._onboardingInputChanged = _onboardingInputChanged
window._onboardingConnect = _onboardingConnect
window._onboardingRemoveRepo = _onboardingRemoveRepo
window._onboardingContinue = _onboardingContinue
