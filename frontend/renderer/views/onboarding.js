window._onboardingState = { step: 1, name: '', color: '', profiles: [], detectedProfiles: null, llmModelName: '', llmApiKey: '', jiraEnabled: false, jiraUrl: '', githubEnabled: false, githubUrl: '', gmailEnabled: false, gmailUrl: '', gcalEnabled: false, gcalUrl: '', outlookEnabled: false, outlookUrl: '', customLinks: [] }

window.renderOnboarding = function() {
  const container = document.querySelector('[data-view="onboarding"]')
  if (!container) return

  // Reset state on fresh render
  window._onboardingState = { step: 1, name: '', color: '', profiles: [], detectedProfiles: null, llmModelName: '', llmApiKey: '', jiraEnabled: false, jiraUrl: '', githubEnabled: false, githubUrl: '', gmailEnabled: false, gmailUrl: '', gcalEnabled: false, gcalUrl: '', outlookEnabled: false, outlookUrl: '', customLinks: [] }

  container.innerHTML = `
    <div style="
      display: flex; align-items: center; justify-content: center;
      height: 100%; background: var(--bg-base); overflow-y: auto;
    ">
      <div id="onboarding-card" style="width: 520px; padding: 20px 0;">
        <!-- Step indicator -->
        <div style="text-align:center; margin-bottom:28px;">
          <div style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">Step 1 of 4</div>
          <div style="display:flex; gap:6px; justify-content:center;">
            <div class="step-dot" data-step="1" style="width:6px; height:6px; border-radius:50%; background:var(--accent);"></div>
            <div class="step-dot" data-step="2" style="width:6px; height:6px; border-radius:50%; background:var(--border);"></div>
            <div class="step-dot" data-step="3" style="width:6px; height:6px; border-radius:50%; background:var(--border);"></div>
            <div class="step-dot" data-step="4" style="width:6px; height:6px; border-radius:50%; background:var(--border);"></div>
          </div>
        </div>
        <div id="step-content"></div>
      </div>
    </div>
  `

  window._renderOnboardingStep(1)
}

window._renderOnboardingStep = function(step) {
  window._onboardingState.step = step

  // Update step indicator
  document.querySelectorAll('.step-dot').forEach(dot => {
    const dotStep = parseInt(dot.getAttribute('data-step'))
    dot.style.background = dotStep === step ? 'var(--accent)' : dotStep < step ? 'var(--accent-muted)' : 'var(--border)'
  })
  const stepLabel = document.querySelector('[data-step-label]')
  // Update "Step N of 4" text
  const stepTexts = document.querySelectorAll('#onboarding-card > div:first-child > div:first-child')
  stepTexts.forEach(el => { el.textContent = `Step ${step} of 4` })

  const content = document.getElementById('step-content')
  if (!content) return

  if (step === 1) {
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
    content.innerHTML = `
      <div style="
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 40px;
      ">
        <h2 style="font-size:20px; font-weight:600; color:var(--text-primary); margin:0 0 6px;">Create a Workspace</h2>
        <p style="font-size:14px; color:var(--text-secondary); margin:0 0 24px;">Group your Jira and GitHub data for a client or project.</p>

        <div style="margin-bottom:20px;">
          <label style="display:block; font-size:12px; font-weight:600; color:var(--text-secondary); margin-bottom:6px; text-transform:uppercase; letter-spacing:0.06em;">Workspace Name</label>
          <input
            id="ws-name"
            type="text"
            placeholder="e.g. Client Alpha"
            value="${window._onboardingState.name}"
            style="
              width:100%; box-sizing:border-box;
              background:var(--bg-raised); border:1px solid var(--border);
              border-radius:var(--radius); padding:10px 14px;
              font-size:14px; color:var(--text-primary);
              font-family:'IBM Plex Sans',sans-serif; outline:none;
              transition:border-color 0.15s;
            "
            onfocus="this.style.borderColor='var(--accent)'"
            onblur="this.style.borderColor='var(--border)'"
          />
        </div>

        <div style="margin-bottom:28px;">
          <label style="display:block; font-size:12px; font-weight:600; color:var(--text-secondary); margin-bottom:10px; text-transform:uppercase; letter-spacing:0.06em;">Color</label>
          <div style="display:flex; gap:10px;">
            ${colors.map(c => `
              <div
                class="color-swatch"
                data-color="${c}"
                onclick="window._selectColor('${c}')"
                style="
                  width:28px; height:28px; border-radius:50%;
                  background:${c}; cursor:pointer;
                  display:flex; align-items:center; justify-content:center;
                  border:2px solid ${c === window._onboardingState.color ? 'white' : 'transparent'};
                  transition:transform 0.1s, border-color 0.1s;
                  box-shadow:${c === window._onboardingState.color ? '0 0 0 2px ' + c : 'none'};
                "
                title="${c}"
              >
                ${c === window._onboardingState.color ? `<i data-lucide="check" style="width:14px;height:14px;color:white;stroke-width:3;"></i>` : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <button onclick="window._onboardingNext(1)" style="
          width:100%; padding:10px 14px;
          background:var(--accent); color:#fff;
          border:none; border-radius:var(--radius);
          font-size:14px; font-weight:600;
          font-family:'IBM Plex Sans',sans-serif;
          cursor:pointer; transition:opacity 0.15s;
        " onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
          Continue
        </button>
      </div>
    `
  } else if (step === 2) {
    const s = window._onboardingState
    content.innerHTML = `
      <div style="
        background:var(--bg-surface);
        border:1px solid var(--border);
        border-radius:var(--radius);
        padding:40px;
      ">
        <h2 style="font-size:20px; font-weight:600; color:var(--text-primary); margin:0 0 6px;">LLM Setup</h2>
        <p style="font-size:14px; color:var(--text-secondary); margin:0 0 4px;">
          Connection Point uses an LLM to power chat and intelligent briefing summaries.
        </p>
        <p style="font-size:13px; color:var(--text-muted); margin:0 0 28px;">
          Your credentials are stored locally and never leave your machine.
        </p>

        <div style="margin-bottom:20px;">
          <label style="display:block; font-size:12px; font-weight:600; color:var(--text-secondary); margin-bottom:6px; text-transform:uppercase; letter-spacing:0.06em;">Model Name</label>
          <input
            id="llm-model-name"
            type="text"
            placeholder="e.g. claude-sonnet-4-6, gpt-4o, llama3.2"
            value="${s.llmModelName}"
            oninput="window._onboardingState.llmModelName=this.value"
            style="
              width:100%; box-sizing:border-box;
              background:var(--bg-raised); border:1px solid var(--border);
              border-radius:var(--radius); padding:10px 14px;
              font-size:14px; color:var(--text-primary);
              font-family:'IBM Plex Sans',sans-serif; outline:none;
              transition:border-color 0.15s;
            "
            onfocus="this.style.borderColor='var(--accent)'"
            onblur="this.style.borderColor='var(--border)'"
          />
        </div>

        <div style="margin-bottom:28px;">
          <label style="display:block; font-size:12px; font-weight:600; color:var(--text-secondary); margin-bottom:6px; text-transform:uppercase; letter-spacing:0.06em;">API Key <span style="font-weight:400; text-transform:none; letter-spacing:0; color:var(--text-muted);">(optional for local models)</span></label>
          <div style="position:relative;">
            <input
              id="llm-api-key"
              type="password"
              placeholder="sk-ant-... / sk-... / AIza..."
              value="${s.llmApiKey}"
              oninput="window._onboardingState.llmApiKey=this.value"
              style="
                width:100%; box-sizing:border-box;
                background:var(--bg-raised); border:1px solid var(--border);
                border-radius:var(--radius); padding:10px 40px 10px 14px;
                font-size:14px; color:var(--text-primary);
                font-family:'IBM Plex Sans',sans-serif; outline:none;
                transition:border-color 0.15s;
              "
              onfocus="this.style.borderColor='var(--accent)'"
              onblur="this.style.borderColor='var(--border)'"
            />
            <button id="llm-key-toggle" onclick="window._toggleApiKeyVisibility()" title="Show/hide key" style="
              position:absolute; right:10px; top:50%; transform:translateY(-50%);
              background:transparent; border:none; cursor:pointer; padding:0;
              color:var(--text-muted); display:flex; align-items:center;
              transition:color 0.15s;
            " onmouseover="this.style.color='var(--text-primary)'" onmouseout="this.style.color='var(--text-muted)'">
              <i data-lucide="eye" style="width:14px; height:14px;"></i>
            </button>
          </div>
        </div>

        <div style="display:flex; gap:10px;">
          <button onclick="window._renderOnboardingStep(1)" style="
            flex:1; padding:10px 14px;
            background:var(--bg-raised); color:var(--text-secondary);
            border:1px solid var(--border); border-radius:var(--radius);
            font-size:14px; font-weight:600;
            font-family:'IBM Plex Sans',sans-serif;
            cursor:pointer; transition:opacity 0.15s;
          " onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">Back</button>
          <button onclick="window._onboardingNext(2)" style="
            flex:2; padding:10px 14px;
            background:var(--accent); color:#fff;
            border:none; border-radius:var(--radius);
            font-size:14px; font-weight:600;
            font-family:'IBM Plex Sans',sans-serif;
            cursor:pointer; transition:opacity 0.15s;
          " onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">Continue</button>
        </div>
      </div>
    `
  } else if (step === 3) {
    const hasDetected = !!window._onboardingState.detectedProfiles

    content.innerHTML = `
      <div style="
        background:var(--bg-surface);
        border:1px solid var(--border);
        border-radius:var(--radius);
        padding:40px;
      ">
        <h2 style="font-size:20px; font-weight:600; color:var(--text-primary); margin:0 0 6px;">Browser Profiles</h2>
        <p style="font-size:14px; color:var(--text-secondary); margin:0 0 6px;">
          Connection Point uses your existing browser sessions to access Jira and GitHub.
          Select one or more profiles you use for this workspace.
        </p>
        <p style="font-size:13px; color:var(--text-muted); margin:0 0 20px;">
          Your credentials stay in your browser — nothing is stored by this app.
        </p>

        <!-- Detect button -->
        <button id="detect-btn" onclick="window._detectProfiles()" style="
          display:flex; align-items:center; gap:8px;
          padding:8px 14px; margin-bottom:20px;
          background:var(--bg-raised); color:var(--text-primary);
          border:1px solid var(--border); border-radius:var(--radius);
          font-size:13px; font-weight:600;
          font-family:'IBM Plex Sans',sans-serif;
          cursor:pointer; transition:border-color 0.15s, background 0.15s;
        " onmouseover="this.style.borderColor='var(--accent)';this.style.background='var(--bg-hover)'" onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--bg-raised)'">
          <i data-lucide="scan-search" style="width:14px; height:14px; color:var(--accent);"></i>
          Detect Browser Profiles
        </button>

        <!-- Browser sections -->
        <div id="browser-sections">
          ${hasDetected ? window._renderBrowserSections() : `
            <div style="
              border:1px dashed var(--border); border-radius:var(--radius);
              padding:32px 20px; text-align:center; color:var(--text-muted); font-size:13px;
            ">
              <i data-lucide="mouse-pointer-click" style="width:24px; height:24px; margin-bottom:10px; opacity:0.4; display:block; margin-left:auto; margin-right:auto;"></i>
              Click "Detect Browser Profiles" to scan for available profiles.
            </div>
          `}
        </div>

        <div style="display:flex; gap:10px; margin-top:24px;">
          <button onclick="window._renderOnboardingStep(2)" style="
            flex:1; padding:10px 14px;
            background:var(--bg-raised); color:var(--text-secondary);
            border:1px solid var(--border); border-radius:var(--radius);
            font-size:14px; font-weight:600;
            font-family:'IBM Plex Sans',sans-serif;
            cursor:pointer; transition:opacity 0.15s;
          " onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">Back</button>
          <button onclick="window._onboardingNext(3)" style="
            flex:2; padding:10px 14px;
            background:var(--accent); color:#fff;
            border:none; border-radius:var(--radius);
            font-size:14px; font-weight:600;
            font-family:'IBM Plex Sans',sans-serif;
            cursor:pointer; transition:opacity 0.15s;
          " onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">Continue</button>
        </div>
      </div>
    `
  } else if (step === 4) {
    const s = window._onboardingState
    content.innerHTML = `
      <div style="
        background:var(--bg-surface);
        border:1px solid var(--border);
        border-radius:var(--radius);
        padding:40px;
      ">
        <h2 style="font-size:20px; font-weight:600; color:var(--text-primary); margin:0 0 6px;">What should we pull?</h2>
        <p style="font-size:14px; color:var(--text-secondary); margin:0 0 20px;">Choose which integrations to enable for this workspace.</p>

        ${window._integrationCard({ id:'jira',     label:'Jira',             sub:'Atlassian Jira tickets and sprints',   logo:'../assets/jira.svg',             enabled:s.jiraEnabled,    url:s.jiraUrl,     placeholder:'https://yourcompany.atlassian.net',  stateKey:'jiraUrl' })}
        ${window._integrationCard({ id:'github',   label:'GitHub',           sub:'Pull requests and issues',            logo:'../assets/github.svg',           enabled:s.githubEnabled,  url:s.githubUrl,   placeholder:'https://github.com/your-org',        stateKey:'githubUrl', logoBg:'#24292e' })}
        ${window._integrationCard({ id:'gmail',    label:'Gmail',            sub:'Emails and threads',                  logo:'../assets/gmail.svg',            enabled:s.gmailEnabled,   url:s.gmailUrl,    placeholder:'https://mail.google.com',            stateKey:'gmailUrl' })}
        ${window._integrationCard({ id:'gcal',     label:'Google Calendar',  sub:'Events and scheduled meetings',       logo:'../assets/google-calendar.svg',  enabled:s.gcalEnabled,    url:s.gcalUrl,     placeholder:'https://calendar.google.com',        stateKey:'gcalUrl' })}
        ${window._integrationCard({ id:'outlook',  label:'Outlook Calendar', sub:'Microsoft calendar events',           logo:'../assets/outlook.svg',          enabled:s.outlookEnabled, url:s.outlookUrl,  placeholder:'https://outlook.office.com/calendar', stateKey:'outlookUrl' })}

        <!-- Custom links section -->
        <div style="margin-bottom:28px;">
          <div style="
            display:flex; align-items:center; justify-content:space-between;
            margin-bottom:8px; margin-top:16px;
          ">
            <div>
              <span style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.06em;">Custom Links</span>
              <span style="font-size:12px; color:var(--text-muted); margin-left:8px;">Confluence, Notion, Linear, etc.</span>
            </div>
            <button onclick="window._addCustomLink()" style="
              display:flex; align-items:center; gap:5px;
              padding:5px 10px;
              background:transparent; color:var(--accent);
              border:1px solid var(--accent); border-radius:var(--radius);
              font-size:12px; font-weight:600;
              font-family:'IBM Plex Sans',sans-serif;
              cursor:pointer; transition:background 0.15s;
            " onmouseover="this.style.background='var(--accent-muted)'" onmouseout="this.style.background='transparent'">
              <i data-lucide="plus" style="width:12px; height:12px;"></i>
              Add link
            </button>
          </div>
          <div id="custom-links-list" style="display:flex; flex-direction:column; gap:6px;">
            ${window._renderCustomLinks()}
          </div>
        </div>

        <div style="display:flex; gap:10px;">
          <button onclick="window._renderOnboardingStep(3)" style="
            flex:1; padding:10px 14px;
            background:var(--bg-raised); color:var(--text-secondary);
            border:1px solid var(--border); border-radius:var(--radius);
            font-size:14px; font-weight:600;
            font-family:'IBM Plex Sans',sans-serif;
            cursor:pointer; transition:opacity 0.15s;
          " onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">Back</button>
          <button onclick="window._onboardingFinish()" style="
            flex:2; padding:10px 14px;
            background:var(--accent); color:#fff;
            border:none; border-radius:var(--radius);
            font-size:14px; font-weight:600;
            font-family:'IBM Plex Sans',sans-serif;
            cursor:pointer; transition:opacity 0.15s;
          " onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">Finish Setup</button>
        </div>
      </div>
    `
  }

  if (typeof lucide !== 'undefined') lucide.createIcons()
}

window._selectColor = function(color) {
  const nameInput = document.getElementById('ws-name')
  if (nameInput) window._onboardingState.name = nameInput.value
  window._onboardingState.color = color
  window._renderOnboardingStep(1)
}

window._detectProfiles = function() {
  const btn = document.getElementById('detect-btn')
  if (btn) {
    btn.disabled = true
    btn.innerHTML = `<i data-lucide="loader" style="width:14px; height:14px; color:var(--accent); animation:spin 1s linear infinite;"></i> Scanning…`
    if (typeof lucide !== 'undefined') lucide.createIcons()
  }

  // Mock detection — simulate a brief scan delay
  setTimeout(() => {
    window._onboardingState.detectedProfiles = {
      chrome: [
        { name: 'Personal',  avatar: 'P', path: 'Default',   email: 'you@gmail.com' },
        { name: 'Work',      avatar: 'W', path: 'Profile 1', email: 'you@company.com' },
        { name: 'Client A',  avatar: 'C', path: 'Profile 2', email: 'you@clienta.com' },
        { name: 'Client B',  avatar: 'B', path: 'Profile 3', email: 'you@clientb.com' }
      ]
    }

    const sections = document.getElementById('browser-sections')
    if (sections) {
      sections.innerHTML = window._renderBrowserSections()
      if (typeof lucide !== 'undefined') lucide.createIcons()
    }

    if (btn) {
      btn.disabled = false
      btn.innerHTML = `<i data-lucide="check" style="width:14px; height:14px; color:var(--success);"></i> Profiles detected`
      if (typeof lucide !== 'undefined') lucide.createIcons()
    }
  }, 900)
}

window._renderBrowserSections = function() {
  const detected = window._onboardingState.detectedProfiles
  if (!detected) return ''
  const selectedPaths = window._onboardingState.profiles

  const chromeProfiles = detected.chrome || []

  const chromeHTML = `
    <!-- Chrome section -->
    <div style="margin-bottom:16px;">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
        <!-- Chrome colour circle as a simple stand-in icon -->
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="8" cy="8" r="7.5" stroke="var(--border)"/>
          <circle cx="8" cy="8" r="3" fill="#4285F4"/>
          <path d="M8 5h6.5" stroke="#EA4335" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M8 5 L1.75 11" stroke="#FBBC04" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M8 5 L8 11" stroke="none"/>
          <path d="M14.5 8 Q13 13 8 11 Q3 9 1.75 11" stroke="#34A853" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        </svg>
        <span style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.06em;">Chrome</span>
        <span style="font-size:11px; color:var(--text-muted);">${chromeProfiles.length} profile${chromeProfiles.length !== 1 ? 's' : ''} found</span>
      </div>
      <div style="display:flex; flex-direction:column; gap:6px;">
        ${chromeProfiles.map(p => {
          const isSelected = selectedPaths.includes(p.path)
          return `
            <div
              class="profile-card"
              data-profile="${p.path}"
              onclick="window._toggleProfile('${p.path}')"
              style="
                display:flex; align-items:center; gap:12px;
                padding:11px 14px; border-radius:var(--radius);
                border:1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'};
                background:${isSelected ? 'var(--accent-muted)' : 'var(--bg-raised)'};
                cursor:pointer; transition:border-color 0.15s, background 0.15s;
              "
            >
              <!-- Checkbox -->
              <div style="
                width:16px; height:16px; border-radius:4px; flex-shrink:0;
                border:1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'};
                background:${isSelected ? 'var(--accent)' : 'transparent'};
                display:flex; align-items:center; justify-content:center;
                transition:border-color 0.15s, background 0.15s;
              ">
                ${isSelected ? `<i data-lucide="check" style="width:10px; height:10px; color:#fff; stroke-width:3;"></i>` : ''}
              </div>
              <!-- Avatar -->
              <div style="
                width:32px; height:32px; border-radius:50%; flex-shrink:0;
                background:var(--bg-hover); border:1px solid var(--border);
                display:flex; align-items:center; justify-content:center;
                font-size:13px; font-weight:600; color:var(--text-secondary);
              ">${p.avatar}</div>
              <!-- Info -->
              <div style="flex:1; min-width:0;">
                <div style="font-size:13px; color:var(--text-primary); font-weight:500;">${p.name}</div>
                <div style="font-size:12px; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p.email}</div>
              </div>
            </div>
          `
        }).join('')}
      </div>
    </div>

    <!-- Firefox section — coming soon -->
    <div style="
      border:1px solid var(--border-subtle); border-radius:var(--radius);
      padding:12px 14px;
      display:flex; align-items:center; gap:10px;
      opacity:0.5;
    ">
      <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="6" fill="#FF7139" opacity="0.7"/>
        <circle cx="8" cy="8" r="3" fill="#FFA500" opacity="0.9"/>
      </svg>
      <span style="font-size:13px; color:var(--text-secondary);">Firefox</span>
      <span style="
        font-size:10px; font-weight:600; color:var(--text-muted);
        background:var(--bg-raised); border:1px solid var(--border);
        border-radius:var(--radius-sm); padding:2px 6px; letter-spacing:0.04em; text-transform:uppercase;
      ">Coming soon</span>
    </div>
  `

  return chromeHTML
}

window._toggleProfile = function(path) {
  const profiles = window._onboardingState.profiles
  const idx = profiles.indexOf(path)
  if (idx === -1) {
    profiles.push(path)
  } else {
    profiles.splice(idx, 1)
  }

  // Re-render just the browser sections
  const sections = document.getElementById('browser-sections')
  if (sections) {
    sections.innerHTML = window._renderBrowserSections()
    if (typeof lucide !== 'undefined') lucide.createIcons()
  }
}

window._integrationCard = function({ id, label, sub, logo, enabled, url, placeholder, stateKey, logoBg }) {
  const bg = logoBg || 'transparent'
  return `
    <div style="border:1px solid var(--border); border-radius:var(--radius); margin-bottom:8px; overflow:hidden;">
      <div style="
        display:flex; align-items:center; justify-content:space-between;
        padding:12px 16px; background:var(--bg-raised); cursor:pointer;
      " onclick="window._toggleIntegration('${id}')">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="
            width:28px; height:28px; border-radius:6px; flex-shrink:0;
            background:${bg}; display:flex; align-items:center; justify-content:center;
            overflow:hidden;
          ">
            <img src="${logo}" alt="${label}" style="width:18px; height:18px; object-fit:contain;"
              onerror="this.style.display='none'; this.parentElement.innerHTML='<span style=\\'font-size:11px;font-weight:600;color:var(--text-muted);\\'>?</span>'"
            />
          </div>
          <div>
            <div style="font-size:14px; font-weight:500; color:var(--text-primary);">${label}</div>
            <div style="font-size:12px; color:var(--text-muted);">${sub}</div>
          </div>
        </div>
        <div id="${id}-toggle" style="
          width:36px; height:20px; border-radius:10px;
          background:${enabled ? 'var(--accent)' : 'var(--border)'};
          position:relative; transition:background 0.2s; flex-shrink:0;
        ">
          <div style="
            width:16px; height:16px; border-radius:50%; background:#fff;
            position:absolute; top:2px;
            left:${enabled ? '18px' : '2px'};
            transition:left 0.2s;
          "></div>
        </div>
      </div>
      <div id="${id}-expand" style="
        overflow:hidden;
        max-height:${enabled ? '80px' : '0'};
        transition:max-height 0.25s ease;
      ">
        <div style="padding:12px 16px; border-top:1px solid var(--border-subtle);">
          <input
            id="${id}-url"
            type="url"
            placeholder="${placeholder}"
            value="${url}"
            oninput="window._onboardingState.${stateKey}=this.value"
            style="
              width:100%; box-sizing:border-box;
              background:var(--bg-base); border:1px solid var(--border);
              border-radius:var(--radius); padding:8px 12px;
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

window._toggleIntegration = function(type) {
  window._onboardingState[type + 'Enabled'] = !window._onboardingState[type + 'Enabled']
  const enabled = window._onboardingState[type + 'Enabled']

  const toggle = document.getElementById(type + '-toggle')
  if (toggle) {
    toggle.style.background = enabled ? 'var(--accent)' : 'var(--border)'
    toggle.querySelector('div').style.left = enabled ? '18px' : '2px'
  }

  const expand = document.getElementById(type + '-expand')
  if (expand) expand.style.maxHeight = enabled ? '80px' : '0'
}

window._renderCustomLinks = function() {
  const links = window._onboardingState.customLinks
  if (links.length === 0) {
    return `<div style="font-size:12px; color:var(--text-muted); padding:4px 2px;">No custom links added yet.</div>`
  }
  return links.map((link, i) => `
    <div style="
      display:flex; align-items:center; gap:10px;
      padding:10px 12px;
      background:var(--bg-raised); border:1px solid var(--border);
      border-radius:var(--radius);
    ">
      <i data-lucide="link-2" style="width:13px; height:13px; color:var(--accent); flex-shrink:0;"></i>
      <div style="flex:1; min-width:0;">
        <div style="font-size:13px; color:var(--text-primary); font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          ${link.label || link.url}
        </div>
        ${link.url !== link.label && link.label ? `<div style="font-size:11px; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${link.url}</div>` : ''}
        ${link.description ? `<div style="font-size:11px; color:var(--text-muted); margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${link.description.replace(/"/g, '&quot;')}">${link.description}</div>` : ''}
      </div>
      <button onclick="window._removeCustomLink(${i})" style="
        width:26px; height:26px; flex-shrink:0;
        background:transparent; border:1px solid var(--border);
        border-radius:var(--radius); cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        color:var(--text-muted); transition:border-color 0.15s, color 0.15s;
      " onmouseover="this.style.borderColor='var(--danger)';this.style.color='var(--danger)'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-muted)'">
        <i data-lucide="x" style="width:11px; height:11px;"></i>
      </button>
    </div>
  `).join('')
}

window._addCustomLink = function() {
  window._openCustomLinkModal()
}

window._openCustomLinkModal = function() {
  // Remove any existing modal
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
      <!-- Header -->
      <div style="display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px;">
        <div style="
          width:36px; height:36px; border-radius:var(--radius);
          background:var(--accent-muted); border:1px solid rgba(99,102,241,0.3);
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
        ">
          <i data-lucide="link-2" style="width:16px; height:16px; color:var(--accent);"></i>
        </div>
        <button onclick="window._closeCustomLinkModal()" style="
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

      <!-- Q1 -->
      <div style="margin-bottom:20px;">
        <label style="
          display:block; font-size:12px; font-weight:600;
          color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.06em;
          margin-bottom:8px;
        ">
          <span style="color:var(--accent); margin-right:6px;">1.</span>What is this site?
        </label>
        <div style="position:relative;">
          <i data-lucide="globe" style="
            position:absolute; left:10px; top:50%; transform:translateY(-50%);
            width:13px; height:13px; color:var(--text-muted); pointer-events:none;
          "></i>
          <input
            id="cl-modal-url"
            type="url"
            placeholder="https://yourcompany.notion.so"
            style="
              width:100%; box-sizing:border-box;
              background:var(--bg-raised); border:1px solid var(--border);
              border-radius:var(--radius); padding:9px 12px 9px 30px;
              font-size:13px; color:var(--text-primary);
              font-family:'IBM Plex Sans',sans-serif; outline:none;
              transition:border-color 0.15s;
            "
            onfocus="this.style.borderColor='var(--accent)'"
            onblur="this.style.borderColor='var(--border)'"
          />
        </div>
        <input
          id="cl-modal-label"
          type="text"
          placeholder="Give it a name  (e.g. Notion Docs, Confluence Wiki)"
          style="
            width:100%; box-sizing:border-box; margin-top:6px;
            background:var(--bg-raised); border:1px solid var(--border);
            border-radius:var(--radius); padding:9px 12px;
            font-size:13px; color:var(--text-primary);
            font-family:'IBM Plex Sans',sans-serif; outline:none;
            transition:border-color 0.15s;
          "
          onfocus="this.style.borderColor='var(--accent)'"
          onblur="this.style.borderColor='var(--border)'"
        />
      </div>

      <!-- Q2 -->
      <div style="margin-bottom:28px;">
        <label style="
          display:block; font-size:12px; font-weight:600;
          color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.06em;
          margin-bottom:8px;
        ">
          <span style="color:var(--accent); margin-right:6px;">2.</span>What data do you want to track from this page?
        </label>
        <textarea
          id="cl-modal-description"
          placeholder="e.g. I want to track open tasks assigned to me, sprint status, and any pages I've been mentioned in."
          rows="3"
          style="
            width:100%; box-sizing:border-box;
            background:var(--bg-raised); border:1px solid var(--border);
            border-radius:var(--radius); padding:9px 12px;
            font-size:13px; color:var(--text-primary); line-height:1.55;
            font-family:'IBM Plex Sans',sans-serif; outline:none; resize:vertical;
            transition:border-color 0.15s;
          "
          onfocus="this.style.borderColor='var(--accent)'"
          onblur="this.style.borderColor='var(--border)'"
        ></textarea>
      </div>

      <!-- Actions -->
      <div style="display:flex; gap:8px;">
        <button onclick="window._closeCustomLinkModal()" style="
          flex:1; padding:9px 14px;
          background:var(--bg-raised); color:var(--text-secondary);
          border:1px solid var(--border); border-radius:var(--radius);
          font-size:13px; font-weight:600;
          font-family:'IBM Plex Sans',sans-serif;
          cursor:pointer; transition:opacity 0.15s;
        " onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">Cancel</button>
        <button onclick="window._submitCustomLinkModal()" style="
          flex:2; padding:9px 14px;
          background:var(--accent); color:#fff;
          border:none; border-radius:var(--radius);
          font-size:13px; font-weight:600;
          font-family:'IBM Plex Sans',sans-serif;
          cursor:pointer; transition:opacity 0.15s;
        " onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">Add Link</button>
      </div>
    </div>
  `

  // Close on backdrop click
  modal.addEventListener('click', function(e) {
    if (e.target === modal) window._closeCustomLinkModal()
  })

  document.body.appendChild(modal)
  if (typeof lucide !== 'undefined') lucide.createIcons()

  // Focus the URL field
  const urlInput = document.getElementById('cl-modal-url')
  if (urlInput) setTimeout(() => urlInput.focus(), 50)
}

window._closeCustomLinkModal = function() {
  const modal = document.getElementById('custom-link-modal')
  if (modal) modal.remove()
}

window._submitCustomLinkModal = function() {
  const url = (document.getElementById('cl-modal-url') || {}).value || ''
  const label = (document.getElementById('cl-modal-label') || {}).value || ''
  const description = (document.getElementById('cl-modal-description') || {}).value || ''

  if (!url.trim()) {
    const input = document.getElementById('cl-modal-url')
    if (input) {
      input.style.borderColor = 'var(--danger)'
      input.focus()
      setTimeout(() => { input.style.borderColor = 'var(--border)' }, 1500)
    }
    return
  }

  window._onboardingState.customLinks.push({ url: url.trim(), label: label.trim(), description: description.trim() })
  window._closeCustomLinkModal()

  const list = document.getElementById('custom-links-list')
  if (list) {
    list.innerHTML = window._renderCustomLinks()
    if (typeof lucide !== 'undefined') lucide.createIcons()
  }
}

window._removeCustomLink = function(i) {
  window._onboardingState.customLinks.splice(i, 1)
  const list = document.getElementById('custom-links-list')
  if (list) {
    list.innerHTML = window._renderCustomLinks()
    if (typeof lucide !== 'undefined') lucide.createIcons()
  }
}

window._updateCustomLink = function(i, field, value) {
  if (window._onboardingState.customLinks[i]) {
    window._onboardingState.customLinks[i][field] = value
  }
}

window._onboardingNext = function(currentStep) {
  if (currentStep === 1) {
    const nameInput = document.getElementById('ws-name')
    if (nameInput) window._onboardingState.name = nameInput.value.trim()
    if (!window._onboardingState.name) {
      window.showToast('Please enter a workspace name.', 'error')
      return
    }
    if (!window._onboardingState.color) {
      window.showToast('Please select a color.', 'error')
      return
    }
    window._renderOnboardingStep(2)
  } else if (currentStep === 2) {
    const modelInput = document.getElementById('llm-model-name')
    if (modelInput) window._onboardingState.llmModelName = modelInput.value.trim()
    const keyInput = document.getElementById('llm-api-key')
    if (keyInput) window._onboardingState.llmApiKey = keyInput.value
    if (!window._onboardingState.llmModelName) {
      window.showToast('Please enter a model name.', 'error')
      return
    }
    window._renderOnboardingStep(3)
  } else if (currentStep === 3) {
    window._renderOnboardingStep(4)
  }
}

window._onboardingFinish = function() {
  const state = window._onboardingState
  const workspace = {
    name: state.name,
    color: state.color,
    profiles: state.profiles,
    llmModelName: state.llmModelName,
    llmApiKey: state.llmApiKey,
    jiraEnabled: state.jiraEnabled,     jiraUrl: state.jiraUrl,
    githubEnabled: state.githubEnabled, githubUrl: state.githubUrl,
    gmailEnabled: state.gmailEnabled,   gmailUrl: state.gmailUrl,
    gcalEnabled: state.gcalEnabled,     gcalUrl: state.gcalUrl,
    outlookEnabled: state.outlookEnabled, outlookUrl: state.outlookUrl,
    customLinks: state.customLinks.filter(l => l.url.trim())
  }
  if (!window._appState.workspaces) window._appState.workspaces = []
  window._appState.workspaces.push(workspace)
  window._appState.activeWorkspace = workspace.name

  window.navigate('loading')
  if (typeof window.renderSidebar === 'function') window.renderSidebar()
}


window._toggleApiKeyVisibility = function() {
  const input = document.getElementById('llm-api-key')
  const btn = document.getElementById('llm-key-toggle')
  if (!input) return
  const isHidden = input.type === 'password'
  input.type = isHidden ? 'text' : 'password'
  if (btn) {
    btn.innerHTML = `<i data-lucide="${isHidden ? 'eye-off' : 'eye'}" style="width:14px; height:14px;"></i>`
    if (typeof lucide !== 'undefined') lucide.createIcons()
  }
}
