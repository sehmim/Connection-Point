// ── Auth helpers ──────────────────────────────────────────────────────────────
// Session stored in localStorage under 'cp_auth':
//   { email: string, ts: number }

window._authGetSession = function() {
  try {
    const raw = localStorage.getItem('cp_auth')
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

window._authSaveSession = function(email) {
  localStorage.setItem('cp_auth', JSON.stringify({ email: email, ts: Date.now() }))
}

window._authClearSession = function() {
  localStorage.removeItem('cp_auth')
}

// ── Render ─────────────────────────────────────────────────────────────────────
window.renderAuth = function() {
  const container = document.querySelector('[data-view="auth"]')
  if (!container) return

  container.innerHTML = `
    <div style="
      display:flex; align-items:center; justify-content:center;
      height:100%; background:var(--bg-base);
    ">
      <div style="
        width:380px;
        background:var(--bg-surface);
        border:1px solid var(--border);
        border-radius:var(--radius-lg);
        padding:40px 40px 36px;
      ">
        <!-- Heading -->
        <h1 style="
          font-size:22px; font-weight:600; color:var(--text-primary);
          margin:0 0 6px; text-align:center;
        ">Welcome</h1>
        <p style="
          font-size:14px; color:var(--text-secondary);
          margin:0 0 28px; text-align:center; line-height:1.5;
        ">Sign in to your account to continue.</p>

        <!-- Error message -->
        <div id="auth-error" style="
          display:none;
          background:var(--danger-muted); border:1px solid rgba(220,38,38,0.25);
          border-radius:var(--radius); padding:10px 14px;
          font-size:13px; color:var(--danger);
          margin-bottom:16px;
        "></div>

        <!-- Email -->
        <div style="margin-bottom:12px;">
          <label style="
            display:block; font-size:12px; font-weight:600;
            color:var(--text-secondary); margin-bottom:6px;
            letter-spacing:0.03em;
          ">Email</label>
          <input
            id="auth-email"
            type="email"
            placeholder="you@example.com"
            autocomplete="email"
            style="
              width:100%; box-sizing:border-box;
              background:var(--bg-raised); border:1px solid var(--border);
              border-radius:var(--radius); padding:10px 14px;
              font-size:14px; color:var(--text-primary);
              font-family:'IBM Plex Sans',sans-serif;
              outline:none; transition:border-color 0.15s;
            "
            onfocus="this.style.borderColor='var(--accent)'"
            onblur="this.style.borderColor='var(--border)'"
            onkeydown="if(event.key==='Enter') document.getElementById('auth-password').focus()"
          />
        </div>

        <!-- Password -->
        <div style="margin-bottom:24px;">
          <label style="
            display:block; font-size:12px; font-weight:600;
            color:var(--text-secondary); margin-bottom:6px;
            letter-spacing:0.03em;
          ">Password</label>
          <div style="position:relative;">
            <input
              id="auth-password"
              type="password"
              placeholder="••••••••"
              autocomplete="current-password"
              style="
                width:100%; box-sizing:border-box;
                background:var(--bg-raised); border:1px solid var(--border);
                border-radius:var(--radius); padding:10px 40px 10px 14px;
                font-size:14px; color:var(--text-primary);
                font-family:'IBM Plex Sans',sans-serif;
                outline:none; transition:border-color 0.15s;
              "
              onfocus="this.style.borderColor='var(--accent)'"
              onblur="this.style.borderColor='var(--border)'"
              onkeydown="if(event.key==='Enter') window._authSubmit()"
            />
            <!-- Show/hide toggle -->
            <button
              id="auth-pw-toggle"
              type="button"
              onclick="window._authTogglePassword()"
              style="
                position:absolute; right:10px; top:50%; transform:translateY(-50%);
                background:none; border:none; cursor:pointer;
                color:var(--text-muted); padding:4px;
                display:flex; align-items:center; justify-content:center;
                transition:color 0.15s;
              "
              onmouseover="this.style.color='var(--text-secondary)'"
              onmouseout="this.style.color='var(--text-muted)'"
              title="Show/hide password"
            >
              <i id="auth-pw-icon" data-lucide="eye" style="width:15px; height:15px; pointer-events:none;"></i>
            </button>
          </div>
        </div>

        <!-- Sign in button -->
        <button
          id="auth-submit-btn"
          onclick="window._authSubmit()"
          style="
            width:100%; padding:11px 14px;
            background:var(--accent); color:#fff;
            border:none; border-radius:var(--radius);
            font-size:14px; font-weight:600;
            font-family:'IBM Plex Sans',sans-serif;
            cursor:pointer; transition:opacity 0.15s;
            display:flex; align-items:center; justify-content:center; gap:8px;
          "
          onmouseover="this.style.opacity='0.85'"
          onmouseout="this.style.opacity='1'"
        >
          Sign in
        </button>

        <!-- Divider -->
        <div style="
          display:flex; align-items:center; gap:12px;
          margin:20px 0;
        ">
          <div style="flex:1; height:1px; background:var(--border-subtle);"></div>
          <span style="font-size:12px; color:var(--text-muted);">Don't have an account?</span>
          <div style="flex:1; height:1px; background:var(--border-subtle);"></div>
        </div>

        <!-- Sign up link -->
        <button
          onclick="window._authOpenSignup()"
          style="
            width:100%; padding:10px 14px;
            background:transparent; color:var(--accent);
            border:1px solid var(--accent); border-radius:var(--radius);
            font-size:14px; font-weight:600;
            font-family:'IBM Plex Sans',sans-serif;
            cursor:pointer; transition:background 0.15s;
          "
          onmouseover="this.style.background='var(--accent-muted)'"
          onmouseout="this.style.background='transparent'"
        >
          Create an account
        </button>

        <!-- Footer -->
        <p style="
          font-size:12px; color:var(--text-muted);
          margin:20px 0 0; text-align:center;
        ">Everything stays on your machine.</p>
      </div>
    </div>
  `

  if (typeof lucide !== 'undefined') lucide.createIcons()

  setTimeout(function() {
    const el = document.getElementById('auth-email')
    if (el) el.focus()
  }, 50)
}

// ── Actions ───────────────────────────────────────────────────────────────────
window._authTogglePassword = function() {
  const input = document.getElementById('auth-password')
  const icon  = document.getElementById('auth-pw-icon')
  if (!input) return
  const isHidden = input.type === 'password'
  input.type = isHidden ? 'text' : 'password'
  if (icon) {
    icon.setAttribute('data-lucide', isHidden ? 'eye-off' : 'eye')
    if (typeof lucide !== 'undefined') lucide.createIcons()
  }
}

window._authShowError = function(msg) {
  const el = document.getElementById('auth-error')
  if (!el) return
  el.textContent = msg
  el.style.display = 'block'
}

window._authHideError = function() {
  const el = document.getElementById('auth-error')
  if (el) el.style.display = 'none'
}

window._authSetLoading = function(loading) {
  const btn = document.getElementById('auth-submit-btn')
  if (!btn) return
  if (loading) {
    btn.disabled = true
    btn.style.opacity = '0.65'
    btn.innerHTML = `
      <div style="
        width:14px; height:14px; border-radius:50%;
        border:2px solid rgba(255,255,255,0.4);
        border-top-color:#fff;
        animation:spin 0.7s linear infinite;
      "></div>
      Signing in…
    `
  } else {
    btn.disabled = false
    btn.style.opacity = '1'
    btn.textContent = 'Sign in'
  }
}

window._authSubmit = function() {
  const email    = (document.getElementById('auth-email')    || {}).value || ''
  const password = (document.getElementById('auth-password') || {}).value || ''

  window._authHideError()

  if (!email.trim()) {
    window._authShowError('Please enter your email address.')
    const el = document.getElementById('auth-email')
    if (el) el.focus()
    return
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRe.test(email.trim())) {
    window._authShowError('Please enter a valid email address.')
    const el = document.getElementById('auth-email')
    if (el) el.focus()
    return
  }

  if (!password) {
    window._authShowError('Please enter your password.')
    const el = document.getElementById('auth-password')
    if (el) el.focus()
    return
  }

  // Phase 1 mock: any non-empty email + password → authenticated
  window._authSetLoading(true)
  setTimeout(function() {
    window._authSetLoading(false)
    window._authSaveSession(email.trim())
    const workspaces = (window._appState && window._appState.workspaces) || []
    window.navigate(workspaces.length > 0 ? 'overview' : 'onboarding')
    if (typeof window.renderSidebar === 'function') window.renderSidebar()
  }, 700)
}

window._authOpenSignup = function() {
  if (window.api && typeof window.api.openExternal === 'function') {
    window.api.openExternal('https://google.com')
  }
}
