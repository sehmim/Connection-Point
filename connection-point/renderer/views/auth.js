window.renderAuth = function() {
  const container = document.querySelector('[data-view="auth"]')
  if (!container) return

  container.innerHTML = `
    <div style="
      display: flex; align-items: center; justify-content: center;
      height: 100%; background: var(--bg-base);
    ">
      <div style="
        width: 360px;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 40px;
      ">
        <!-- Logo mark -->
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:24px; justify-content:center;">
          <div style="width:8px; height:8px; border-radius:50%; background:var(--accent);"></div>
          <span style="font-size:13px; font-weight:600; color:var(--text-secondary);">Connection Point</span>
        </div>

        <!-- Heading -->
        <h1 style="
          font-size: 22px; font-weight: 600; color: var(--text-primary);
          margin: 0 0 6px; text-align: center;
        ">Welcome back</h1>
        <p style="
          font-size: 14px; color: var(--text-secondary);
          margin: 0 0 28px; text-align: center;
        ">Your work, in one place.</p>

        <!-- Password input -->
        <div style="margin-bottom: 12px;">
          <input
            id="auth-password"
            type="password"
            placeholder="Enter passphrase"
            style="
              width: 100%; box-sizing: border-box;
              background: var(--bg-raised); border: 1px solid var(--border);
              border-radius: var(--radius); padding: 10px 14px;
              font-size: 14px; color: var(--text-primary);
              font-family: 'IBM Plex Sans', sans-serif;
              outline: none; transition: border-color 0.15s;
            "
            onfocus="this.style.borderColor='var(--accent)'"
            onblur="this.style.borderColor='var(--border)'"
            onkeydown="if(event.key==='Enter') window._authSubmit()"
          />
        </div>

        <!-- Enter button -->
        <button onclick="window._authSubmit()" style="
          width: 100%; padding: 10px 14px;
          background: var(--accent); color: #fff;
          border: none; border-radius: var(--radius);
          font-size: 14px; font-weight: 600;
          font-family: 'IBM Plex Sans', sans-serif;
          cursor: pointer; transition: opacity 0.15s;
        " onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
          Enter
        </button>

        <!-- Footnote -->
        <p style="
          font-size: 12px; color: var(--text-muted);
          margin: 20px 0 0; text-align: center;
        ">Everything stays on your machine.</p>
      </div>
    </div>
  `

  // Focus the password input
  setTimeout(() => {
    const input = document.getElementById('auth-password')
    if (input) input.focus()
  }, 50)

  if (typeof lucide !== 'undefined') lucide.createIcons()
}

window._authSubmit = function() {
  window.navigate('onboarding')
}
