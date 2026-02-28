window.renderOverview = function() {
  // Ensure briefing item registry is fresh
  window._itemRegistry = window._itemRegistry || {}

  _BRIEFING.meetings.forEach((m, i) => {
    window._itemRegistry['mtg-' + i] = { ...m, source: 'meeting', _uid: 'mtg-' + i }
  })
  const allBriefingItems = [..._BRIEFING.dueThisWeek, ..._BRIEFING.waitingForYou, ..._BRIEFING.overdue]
  allBriefingItems.filter(i => i.source === 'jira').forEach(item => {
    const uid = 'j-' + item.id
    if (!window._itemRegistry[uid]) window._itemRegistry[uid] = { ...item, _uid: uid }
  })
  allBriefingItems.filter(i => i.source === 'github').forEach(item => {
    const rawId = String(item.id).replace(/^#/, '')
    const uid = 'gh-' + rawId
    if (!window._itemRegistry[uid]) window._itemRegistry[uid] = { ...item, id: rawId, type: 'issue', _uid: uid }
  })

  const container = document.querySelector('[data-view="overview"]')
  if (!container) return

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;overflow:hidden;">
      <!-- Profile navbar -->
      ${window._renderProfileNavbar()}

      <!-- Scrollable content + detail panel -->
      <div style="flex:1;display:flex;overflow:hidden;">

        <!-- Scrollable cards -->
        <div style="flex:1;overflow-y:auto;padding:20px;">
          ${window._renderOverviewContent()}
        </div>

        <!-- Item detail panel -->
        ${window._renderDetailPanel(window._selectedItem)}
      </div>
    </div>
  `

  if (typeof lucide !== 'undefined') lucide.createIcons()
}

window._renderOverviewContent = function() {
  const today    = new Date('2026-03-01')
  const todayStr = today.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })
  const activeProfile = window._briefingProfile || 'all'

  const byProfile = (arr) => activeProfile === 'all' ? arr : arr.filter(i => i.profile === activeProfile)
  const meetings      = byProfile(_BRIEFING.meetings)
  const dueThisWeek   = byProfile(_BRIEFING.dueThisWeek)
  const waitingForYou = byProfile(_BRIEFING.waitingForYou)
  const overdue       = byProfile(_BRIEFING.overdue)

  const selUid = window._selectedItem && window._selectedItem._uid

  // ── helpers ──
  const dueBadge = (dateStr) => {
    const d = new Date(dateStr)
    const diff = Math.floor((d - today) / 86400000)
    if (diff < 0)   return `<span style="font-size:10px;font-weight:700;color:var(--danger);background:var(--danger-muted);border-radius:3px;padding:1px 5px;">Overdue</span>`
    if (diff === 0) return `<span style="font-size:10px;font-weight:700;color:var(--warning);background:var(--warning-muted);border-radius:3px;padding:1px 5px;">Today</span>`
    return `<span style="font-size:11px;color:var(--text-muted);">${d.toLocaleDateString('default',{month:'short',day:'numeric'})}</span>`
  }

  const wsDot = (color) =>
    `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color};flex-shrink:0;"></span>`

  const sourceIcon = (source) => source === 'jira'
    ? `<span style="font-size:9px;font-weight:700;color:#60a5fa;background:rgba(59,130,246,0.12);padding:1px 5px;border-radius:3px;flex-shrink:0;">J</span>`
    : `<span style="font-size:9px;font-weight:700;color:#a78bfa;background:rgba(139,92,246,0.12);padding:1px 5px;border-radius:3px;flex-shrink:0;">GH</span>`

  const profileChip = (profileId) => {
    const p = _BRIEFING_PROFILES.find(p => p.id === profileId)
    if (!p) return ''
    return `<span style="display:inline-flex;align-items:center;gap:4px;flex-shrink:0;font-size:10px;color:${p.color};font-weight:600;background:${p.color}15;border-radius:10px;padding:1px 6px;">
      <span style="width:5px;height:5px;border-radius:50%;background:${p.color};display:inline-block;"></span>
      ${p.name}
    </span>`
  }

  const briefingItemUid = (item) => {
    if (item.source === 'jira') return 'j-' + item.id
    return 'gh-' + String(item.id).replace(/^#/, '')
  }

  const sectionHead = (icon, label, count, accentColor) => `
    <div style="display:flex;align-items:center;gap:7px;margin-bottom:14px;">
      <div style="width:28px;height:28px;border-radius:6px;flex-shrink:0;background:${accentColor}18;display:flex;align-items:center;justify-content:center;">
        <i data-lucide="${icon}" style="width:14px;height:14px;color:${accentColor};"></i>
      </div>
      <span style="font-size:14px;font-weight:600;color:var(--text-primary);">${label}</span>
      <span style="font-size:11px;font-weight:700;color:${accentColor};background:${accentColor}18;border-radius:9px;padding:2px 8px;">${count}</span>
    </div>
  `

  const calColors = { gcal: '#4285F4', outlook: '#0078D4' }

  // ── Timeline ──
  const hours = [8,9,10,11,12,13,14,15,16,17]
  const timeToFrac = (t) => { const [h,m] = t.split(':').map(Number); return (h + m/60 - 8) / 10 }

  const timelineHTML = `
    <div style="position:relative;height:80px;margin:0 2px 16px;">
      ${hours.map(h => `
        <div style="position:absolute;top:0;bottom:0;left:${((h-8)/10)*100}%;border-left:1px solid var(--border-subtle);pointer-events:none;">
          <span style="position:absolute;top:0;left:3px;font-size:9px;color:var(--text-muted);white-space:nowrap;">${h>12?h-12:h}${h>=12?'pm':'am'}</span>
        </div>
      `).join('')}
      <div style="position:absolute;top:0;bottom:0;left:12.5%;border-left:1.5px solid var(--accent);z-index:2;pointer-events:none;">
        <div style="position:absolute;top:-3px;left:-4px;width:7px;height:7px;border-radius:50%;background:var(--accent);"></div>
      </div>
      ${meetings.map((m) => {
        const globalIdx = _BRIEFING.meetings.indexOf(m)
        const uid = 'mtg-' + globalIdx
        const isSelected = selUid === uid
        const left = timeToFrac(m.time) * 100
        const dH = m.duration.includes('h') ? parseFloat(m.duration) : parseFloat(m.duration)/60
        const width = Math.max((dH/10)*100, 4)
        const color = calColors[m.source] || '#6366f1'
        const p = _BRIEFING_PROFILES.find(p => p.id === m.profile)
        return `
          <div onclick="window._selectItem('${uid}')" style="
            position:absolute;top:18px;height:44px;
            left:${left}%;width:${width}%;
            background:${isSelected ? color + '44' : color + '22'};
            border-left:3px solid ${color};
            border:1px solid ${isSelected ? color : color + '55'};
            border-radius:4px;overflow:hidden;
            display:flex;flex-direction:column;justify-content:center;padding:0 7px;gap:2px;
            cursor:pointer;
            box-shadow:${isSelected ? '0 0 0 2px ' + color + '55' : 'none'};
            transition:box-shadow 0.1s,background 0.1s;
          ">
            ${p ? `<span style="position:absolute;top:4px;right:5px;width:5px;height:5px;border-radius:50%;background:${p.color};"></span>` : ''}
            <span style="font-size:10px;font-weight:700;color:${color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.title}</span>
            <span style="font-size:9px;color:${color}aa;white-space:nowrap;">${m.time} · ${m.duration}</span>
          </div>`
      }).join('')}
    </div>
  `

  // ── Card wrapper ──
  const card = (content) => `
    <div style="
      width:100%;background:var(--bg-surface);
      border:1px solid var(--border);border-radius:var(--radius-lg);
      padding:20px;margin-bottom:12px;
    ">${content}</div>
  `

  // ── Meetings rows ──
  const meetingRowsHTML = meetings.length === 0
    ? `<div style="font-size:13px;color:var(--text-muted);padding:4px 0;">No meetings today.</div>`
    : meetings.map(m => {
        const globalIdx = _BRIEFING.meetings.indexOf(m)
        const uid = 'mtg-' + globalIdx
        const isSel = selUid === uid
        const mColor = calColors[m.source] || '#6366f1'
        return `
          <div data-uid="${uid}" data-selected="${isSel ? '1' : '0'}"
            onclick="window._selectItem('${uid}')"
            style="
              display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:var(--radius);
              background:${isSel ? mColor + '18' : 'var(--bg-raised)'};
              border:1px solid ${isSel ? mColor + '55' : 'var(--border-subtle)'};
              cursor:pointer;transition:background 0.1s,border-color 0.1s;margin-bottom:6px;
            "
            onmouseover="if(this.getAttribute('data-selected')==='0'){this.style.background='${mColor}12';this.style.borderColor='${mColor}44'}"
            onmouseout="if(this.getAttribute('data-selected')==='0'){this.style.background='var(--bg-raised)';this.style.borderColor='var(--border-subtle)'}"
          >
            <span style="font-size:12px;font-weight:600;color:${mColor};white-space:nowrap;min-width:40px;">${m.time}</span>
            <div style="width:1px;height:16px;background:var(--border-subtle);flex-shrink:0;"></div>
            ${wsDot(m.wsColor)}
            <span style="flex:1;font-size:13px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.title}</span>
            ${profileChip(m.profile)}
            <span style="font-size:11px;color:var(--text-muted);flex-shrink:0;">${m.duration}</span>
            <span style="font-size:11px;color:var(--text-muted);flex-shrink:0;display:flex;align-items:center;gap:3px;">
              <i data-lucide="users" style="width:11px;height:11px;"></i>${m.attendees}
            </span>
            <i data-lucide="chevron-right" style="width:12px;height:12px;color:var(--text-muted);flex-shrink:0;"></i>
          </div>
        `
      }).join('')

  // ── Waiting rows ──
  const waitingRowsHTML = waitingForYou.length === 0
    ? `<div style="font-size:13px;color:var(--text-muted);padding:4px 0;">Nothing waiting for you.</div>`
    : waitingForYou.map(item => {
        const uid = briefingItemUid(item)
        const isSel = selUid === uid
        return `
          <div data-uid="${uid}" data-selected="${isSel ? '1' : '0'}"
            onclick="window._selectItem('${uid}')" style="
            display:flex;align-items:center;gap:10px;padding:10px 12px;
            border:1px solid ${isSel ? 'var(--accent)' : 'var(--border)'};
            border-radius:var(--radius);
            background:${isSel ? 'var(--accent-muted)' : 'var(--bg-raised)'};
            margin-bottom:6px;cursor:pointer;transition:background 0.1s,border-color 0.1s;
          "
          onmouseover="if(this.getAttribute('data-selected')==='0')this.style.background='var(--bg-hover)'"
          onmouseout="if(this.getAttribute('data-selected')==='0')this.style.background='var(--bg-raised)'"
          >
            ${sourceIcon(item.source)}
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.title}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;display:flex;align-items:center;gap:5px;">
                ${wsDot(item.wsColor)}
                <span>${item.workspace}</span>
                <span style="color:var(--border);">·</span>
                <span>${item.action}</span>
              </div>
            </div>
            ${profileChip(item.profile)}
            <span style="font-size:12px;color:var(--text-muted);white-space:nowrap;flex-shrink:0;">${item.waiting} ago</span>
          </div>
        `
      }).join('')

  // ── Due rows ──
  const dueRowsHTML = dueThisWeek.length === 0
    ? `<div style="font-size:13px;color:var(--text-muted);padding:4px 0;">Nothing due this week.</div>`
    : dueThisWeek.map(item => {
        const uid = briefingItemUid(item)
        const isSel = selUid === uid
        return `
          <div data-uid="${uid}" data-selected="${isSel ? '1' : '0'}"
            onclick="window._selectItem('${uid}')" style="
            display:flex;align-items:center;gap:10px;padding:10px 12px;
            border:1px solid ${isSel ? 'var(--accent)' : 'var(--border)'};
            border-radius:var(--radius);
            background:${isSel ? 'var(--accent-muted)' : 'var(--bg-raised)'};
            margin-bottom:6px;cursor:pointer;transition:background 0.1s,border-color 0.1s;
          "
          onmouseover="if(this.getAttribute('data-selected')==='0')this.style.background='var(--bg-hover)'"
          onmouseout="if(this.getAttribute('data-selected')==='0')this.style.background='var(--bg-raised)'"
          >
            ${wsDot(item.wsColor)}
            ${sourceIcon(item.source)}
            <span style="font-size:12px;color:var(--text-muted);font-family:monospace;white-space:nowrap;">${item.id}</span>
            <span style="flex:1;font-size:13px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.title}</span>
            ${profileChip(item.profile)}
            ${dueBadge(item.dueDate)}
          </div>
        `
      }).join('')

  // ── Overdue rows ──
  const overdueRowsHTML = overdue.length === 0
    ? `<div style="text-align:center;padding:16px 0;color:var(--success);font-size:13px;display:flex;align-items:center;justify-content:center;gap:6px;">
        <i data-lucide="check-circle-2" style="width:14px;height:14px;"></i> All caught up!
       </div>`
    : overdue.map(item => {
        const uid = briefingItemUid(item)
        const isSel = selUid === uid
        const d = new Date(item.dueDate)
        const daysAgo = Math.floor((today - d) / 86400000)
        return `
          <div data-uid="${uid}" data-selected="${isSel ? '1' : '0'}"
            onclick="window._selectItem('${uid}')" style="
            display:flex;align-items:center;gap:10px;padding:10px 12px;
            border:1px solid ${isSel ? 'var(--danger)' : 'rgba(239,68,68,0.25)'};
            border-radius:var(--radius);
            background:${isSel ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.05)'};
            margin-bottom:6px;cursor:pointer;transition:background 0.1s,border-color 0.1s;
          "
          onmouseover="this.style.background='rgba(239,68,68,0.1)'"
          onmouseout="if(this.getAttribute('data-selected')==='0')this.style.background='rgba(239,68,68,0.05)'"
          >
            ${wsDot(item.wsColor)}
            ${sourceIcon(item.source)}
            <span style="font-size:12px;color:var(--text-muted);font-family:monospace;white-space:nowrap;">${item.id}</span>
            <span style="flex:1;font-size:13px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.title}</span>
            ${profileChip(item.profile)}
            <span style="font-size:12px;color:var(--danger);font-weight:600;white-space:nowrap;flex-shrink:0;">${daysAgo}d overdue</span>
          </div>`
      }).join('')

  return `
    <!-- Page header -->
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
      <span style="font-size:16px;font-weight:600;color:var(--text-primary);">Overview</span>
      <div style="width:1px;height:14px;background:var(--border);"></div>
      <span style="font-size:13px;color:var(--text-secondary);">☀️ ${todayStr}</span>
      <div style="width:1px;height:14px;background:var(--border);"></div>
      <span style="font-size:12px;color:var(--accent);">${meetings.length} meeting${meetings.length !== 1 ? 's' : ''}</span>
      <span style="font-size:12px;color:var(--warning);">${dueThisWeek.length} due this week</span>
      ${overdue.length > 0 ? `<span style="font-size:12px;color:var(--danger);">${overdue.length} overdue</span>` : `<span style="font-size:12px;color:var(--success);">nothing overdue</span>`}
    </div>

    ${card(`
      ${sectionHead('calendar', 'Meetings Today', meetings.length, '#4285F4')}
      ${timelineHTML}
      ${meetingRowsHTML}
    `)}

    <!-- Waiting For You + Overdue side by side -->
    <div style="display:flex;gap:12px;margin-bottom:12px;align-items:flex-start;">
      <div style="flex:1;min-width:0;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px;">
        ${sectionHead('clock', 'Waiting For You', waitingForYou.length, '#f59e0b')}
        ${waitingRowsHTML}
      </div>
      <div style="flex:1;min-width:0;background:var(--bg-surface);border:1px solid var(--border-subtle);border-color:rgba(239,68,68,0.2);border-radius:var(--radius-lg);padding:20px;align-self:stretch;">
        ${sectionHead('alert-circle', 'Overdue', overdue.length, '#ef4444')}
        ${overdueRowsHTML}
      </div>
    </div>

    ${card(`
      ${sectionHead('calendar-clock', 'Due This Week', dueThisWeek.length, '#f59e0b')}
      ${dueRowsHTML}
    `)}
  `
}
