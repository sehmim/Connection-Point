window._chatState = {
  channels: [],
  messages: {},
  activeChannel: null,
  loaded: false
}

// ── platform config ───────────────────────────────────────────────────────────
const _PLATFORMS = {
  slack:   { label: 'Slack',         color: '#E01E5A', prefix: '#', logo: '../assets/slack.svg' },
  teams:   { label: 'Teams',         color: '#6264A7', prefix: '',  logo: '../assets/teams.svg' },
  discord: { label: 'Discord',       color: '#5865F2', prefix: '#', logo: '../assets/discord.svg' }
}

// ── entry point ───────────────────────────────────────────────────────────────
window.renderChat = function() {
  const container = document.querySelector('[data-view="chat"]')
  if (!container) return

  const load = window._chatState.loaded
    ? Promise.resolve()
    : fetch('./mock/chats.json').then(r => r.json()).then(data => {
        window._chatState.channels = data.channels
        window._chatState.messages = data.messages
        window._chatState.loaded   = true
        if (!window._chatState.activeChannel && data.channels.length > 0) {
          window._chatState.activeChannel = data.channels[0].id
        }
      })

  load.then(() => window._renderChatUI()).catch(err => {
    container.innerHTML = `<div style="padding:40px; color:var(--danger);">Failed to load chats: ${err.message}</div>`
  })
}

window._renderChatUI = function() {
  const container = document.querySelector('[data-view="chat"]')
  if (!container) return

  const activeProfile = window._briefingProfile || 'all'
  const allChannels = window._chatState.channels
  const { activeChannel } = window._chatState

  // Filter channels by active browser profile
  const channels = activeProfile === 'all'
    ? allChannels
    : allChannels.filter(ch => ch.profile === activeProfile)

  // If active channel is not in filtered set, select first visible one
  const visibleActiveChannel = channels.find(ch => ch.id === activeChannel)
    ? activeChannel
    : (channels[0] ? channels[0].id : null)

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; height:100%; overflow:hidden;">

      <!-- Browser profile navbar -->
      ${typeof window._renderProfileNavbar === 'function' ? window._renderProfileNavbar(allChannels) : ''}

      <div style="display:flex; flex:1; overflow:hidden;">

      <!-- ── Channel sidebar ── -->
      <div style="
        width:220px; min-width:220px; flex-shrink:0;
        background:var(--bg-surface); border-right:1px solid var(--border);
        display:flex; flex-direction:column; overflow:hidden;
      ">
        <!-- Sidebar header -->
        <div style="
          padding:13px 14px 10px;
          border-bottom:1px solid var(--border-subtle);
          flex-shrink:0;
        ">
          <div style="font-size:13px; font-weight:600; color:var(--text-primary);">Messages</div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:1px;">${channels.length} channel${channels.length !== 1 ? 's' : ''}</div>
        </div>

        <!-- Channel list -->
        <div style="flex:1; overflow-y:auto; padding:6px 0;">
          ${window._renderChannelList(channels, visibleActiveChannel)}
        </div>
      </div>

      <!-- ── Message pane ── -->
      <div style="flex:1; display:flex; flex-direction:column; overflow:hidden; min-width:0;">
        ${window._renderMessagePane(visibleActiveChannel)}
      </div>

      </div>
    </div>
  `

  if (typeof lucide !== 'undefined') lucide.createIcons()
  window._scrollMessagesToBottom()
}

// ── channel list ─────────────────────────────────────────────────────────────
window._renderChannelList = function(channels, activeId) {
  // Group by platform
  const groups = {}
  channels.forEach(ch => {
    if (!groups[ch.platform]) groups[ch.platform] = []
    groups[ch.platform].push(ch)
  })

  return Object.entries(groups).map(([platform, chs]) => {
    const p = _PLATFORMS[platform] || { label: platform, color: 'var(--accent)', prefix: '#' }

    return `
      <!-- Platform group -->
      <div style="margin-bottom:4px;">
        <div style="
          display:flex; align-items:center; gap:6px;
          padding:6px 14px 4px;
        ">
          <div style="width:6px; height:6px; border-radius:2px; background:${p.color}; flex-shrink:0;"></div>
          <span style="font-size:10px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em;">${p.label}</span>
        </div>
        ${chs.map(ch => {
          const isActive = ch.id === activeId
          return `
            <div
              onclick="window._selectChannel('${ch.id}')"
              style="
                display:flex; align-items:center; gap:8px;
                padding:6px 14px; cursor:pointer;
                background:${isActive ? 'var(--accent-muted)' : 'transparent'};
                border-left:2px solid ${isActive ? 'var(--accent)' : 'transparent'};
                transition:background 0.1s;
              "
              onmouseover="if(!${isActive}) this.style.background='var(--bg-hover)'"
              onmouseout="if(!${isActive}) this.style.background='transparent'"
            >
              <span style="
                font-size:13px; color:${isActive ? 'var(--text-primary)' : 'var(--text-secondary)'};
                flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
                font-weight:${ch.unread > 0 ? '600' : '400'};
              ">${p.prefix}${ch.name}</span>
              ${ch.unread > 0 ? `
                <span style="
                  min-width:18px; height:18px; border-radius:9px;
                  background:${p.color}; color:#fff;
                  font-size:10px; font-weight:700;
                  display:flex; align-items:center; justify-content:center;
                  padding:0 5px; flex-shrink:0;
                ">${ch.unread}</span>
              ` : ''}
            </div>
          `
        }).join('')}
      </div>
    `
  }).join('')
}

// ── message pane ─────────────────────────────────────────────────────────────
window._renderMessagePane = function(channelId) {
  if (!channelId) {
    return `
      <div style="flex:1; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:10px; color:var(--text-muted);">
        <i data-lucide="message-square" style="width:32px; height:32px; opacity:0.3;"></i>
        <span style="font-size:13px;">Select a channel to start reading</span>
      </div>
    `
  }

  const ch = window._chatState.channels.find(c => c.id === channelId)
  if (!ch) return ''

  const p = _PLATFORMS[ch.platform] || { label: ch.platform, color: 'var(--accent)', prefix: '#' }
  const messages = window._chatState.messages[channelId] || []

  return `
    <!-- Channel header -->
    <div style="
      padding:11px 18px;
      background:var(--bg-surface); border-bottom:1px solid var(--border);
      display:flex; align-items:center; gap:10px; flex-shrink:0;
    ">
      <div style="
        width:8px; height:8px; border-radius:2px;
        background:${p.color}; flex-shrink:0;
      "></div>
      <span style="font-size:14px; font-weight:600; color:var(--text-primary);">${p.prefix}${ch.name}</span>
      <span style="font-size:12px; color:var(--text-muted);">${p.label} · ${ch.workspace}</span>
      <div style="flex:1;"></div>
      <span style="font-size:11px; color:var(--text-muted);">${messages.length} messages</span>
    </div>

    <!-- Messages -->
    <div id="chat-message-list" style="
      flex:1; overflow-y:auto; padding:16px 18px;
      display:flex; flex-direction:column; gap:0;
    ">
      ${messages.length === 0
        ? `<div style="margin:auto; text-align:center; color:var(--text-muted); font-size:13px;">No messages yet.</div>`
        : window._renderMessages(messages)
      }
    </div>

    <!-- Composer -->
    <div style="
      padding:10px 16px 12px;
      background:var(--bg-surface); border-top:1px solid var(--border);
      flex-shrink:0;
    ">
      <div style="
        display:flex; align-items:center; gap:8px;
        background:var(--bg-raised); border:1px solid var(--border);
        border-radius:var(--radius); padding:0 10px;
        transition:border-color 0.15s;
      " onfocusin="this.style.borderColor='var(--accent)'" onfocusout="this.style.borderColor='var(--border)'">
        <input
          id="chat-composer"
          type="text"
          placeholder="Message ${p.prefix}${ch.name}…"
          style="
            flex:1; background:transparent; border:none; outline:none;
            padding:10px 0; font-size:13px; color:var(--text-primary);
            font-family:'IBM Plex Sans',sans-serif;
          "
          onkeydown="if(event.key==='Enter' && !event.shiftKey){ event.preventDefault(); window._sendChatMessage('${channelId}'); }"
        />
        <button onclick="window._sendChatMessage('${channelId}')" style="
          width:30px; height:30px; border-radius:var(--radius-sm);
          background:var(--accent); border:none;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; flex-shrink:0; transition:opacity 0.15s;
        " onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
          <i data-lucide="send" style="width:13px; height:13px; color:#fff;"></i>
        </button>
      </div>
    </div>
  `
}

// ── message rendering ─────────────────────────────────────────────────────────
window._renderMessages = function(messages) {
  let html = ''
  let prevUser = null
  let prevDate = null

  messages.forEach((msg, i) => {
    const msgDate = new Date(msg.ts)
    const dateStr = msgDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })
    const timeStr = msgDate.toLocaleTimeString('default', { hour: 'numeric', minute: '2-digit', hour12: true })
    const isFirst = msg.user !== prevUser || msgDate - new Date(messages[i-1]?.ts || 0) > 5 * 60 * 1000

    // Date divider
    if (dateStr !== prevDate) {
      html += `
        <div style="
          display:flex; align-items:center; gap:10px;
          margin:16px 0 10px; flex-shrink:0;
        ">
          <div style="flex:1; height:1px; background:var(--border-subtle);"></div>
          <span style="font-size:11px; color:var(--text-muted); white-space:nowrap;">${dateStr}</span>
          <div style="flex:1; height:1px; background:var(--border-subtle);"></div>
        </div>
      `
      prevDate = dateStr
    }

    if (isFirst) {
      // Full message row with avatar + name
      const avatarBg = msg.isSelf ? 'var(--accent)' : msg.isBot ? 'var(--bg-hover)' : window._avatarColor(msg.user)
      const avatarColor = msg.isSelf ? '#fff' : msg.isBot ? 'var(--text-muted)' : '#fff'
      html += `
        <div style="
          display:flex; gap:10px; margin-top:12px;
          ${msg.isSelf ? 'flex-direction:row-reverse;' : ''}
        ">
          <!-- Avatar -->
          <div style="
            width:32px; height:32px; border-radius:50%; flex-shrink:0;
            background:${avatarBg}; color:${avatarColor};
            display:flex; align-items:center; justify-content:center;
            font-size:12px; font-weight:600;
            margin-top:1px;
            ${msg.isBot ? 'border:1px solid var(--border);' : ''}
          ">${msg.isBot ? `<i data-lucide="bot" style="width:14px;height:14px;"></i>` : msg.avatar}</div>

          <div style="flex:1; min-width:0; ${msg.isSelf ? 'align-items:flex-end;' : ''} display:flex; flex-direction:column;">
            <!-- Name + time -->
            <div style="
              display:flex; align-items:baseline; gap:7px; margin-bottom:3px;
              ${msg.isSelf ? 'flex-direction:row-reverse;' : ''}
            ">
              <span style="font-size:13px; font-weight:600; color:${msg.isSelf ? 'var(--accent)' : msg.isBot ? 'var(--text-muted)' : 'var(--text-primary)'};">${msg.isSelf ? 'you' : msg.user}</span>
              <span style="font-size:11px; color:var(--text-muted);">${timeStr}</span>
            </div>
            ${window._msgBubble(msg)}
          </div>
        </div>
      `
    } else {
      // Continuation — no avatar, tight spacing
      html += `
        <div style="
          padding-left:${msg.isSelf ? '0' : '42px'};
          padding-right:${msg.isSelf ? '42px' : '0'};
          margin-top:2px;
          display:flex;
          ${msg.isSelf ? 'justify-content:flex-end;' : ''}
        ">
          ${window._msgBubble(msg)}
        </div>
      `
    }

    prevUser = msg.user
  })

  return html
}

window._msgBubble = function(msg) {
  if (msg.isBot) {
    return `<div style="
      font-size:13px; color:var(--text-muted); line-height:1.5;
      background:var(--bg-raised); border:1px dashed var(--border);
      border-radius:var(--radius); padding:6px 10px;
      display:inline-block; max-width:100%;
    ">${msg.body}</div>`
  }
  if (msg.isSelf) {
    return `<div style="
      font-size:13px; color:var(--text-primary); line-height:1.5;
      background:var(--accent-muted); border:1px solid rgba(99,102,241,0.25);
      border-radius:var(--radius); padding:7px 12px;
      display:inline-block; max-width:80%; word-break:break-word;
    ">${msg.body}</div>`
  }
  return `<div style="
    font-size:13px; color:var(--text-primary); line-height:1.5;
    padding:2px 0; display:inline-block; max-width:90%; word-break:break-word;
  ">${msg.body}</div>`
}

window._avatarColor = function(name) {
  const colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

// ── interactions ──────────────────────────────────────────────────────────────
window._selectChannel = function(id) {
  window._chatState.activeChannel = id
  // Mark as read
  const ch = window._chatState.channels.find(c => c.id === id)
  if (ch) ch.unread = 0
  window._renderChatUI()
}

window._sendChatMessage = function(channelId) {
  const input = document.getElementById('chat-composer')
  if (!input) return
  const text = input.value.trim()
  if (!text) return
  input.value = ''

  if (!window._chatState.messages[channelId]) window._chatState.messages[channelId] = []
  window._chatState.messages[channelId].push({
    id: Date.now(),
    user: 'you',
    avatar: 'Y',
    body: text,
    ts: new Date().toISOString(),
    isSelf: true
  })

  window._renderChatUI()
}

window._scrollMessagesToBottom = function() {
  const el = document.getElementById('chat-message-list')
  if (el) el.scrollTop = el.scrollHeight
}
