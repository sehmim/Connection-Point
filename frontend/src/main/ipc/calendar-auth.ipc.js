const { ipcMain, BrowserWindow, session } = require('electron')
const { getDb } = require('../db')

// Google auth cookies that confirm a completed login
const GOOGLE_AUTH_COOKIES = ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID', '__Secure-1PSID']

function _isAuthed(cookies) {
  return cookies.some(c => GOOGLE_AUTH_COOKIES.includes(c.name))
}

function registerCalendarAuthIpc() {
  const channels = [
    'connect-calendar-source',
    'scrape-calendar-events',
    'calendar:save-scrape',
    'calendar:get-data',
    'calendar:delete-source',
  ]
  channels.forEach(c => ipcMain.removeHandler(c))

  // Open a Google login popup scoped to a per-email Electron session partition.
  // Returns { authed, cached, email } — email is detected from the signed-in account.
  ipcMain.handle('connect-calendar-source', async (_, email) => {
    const partition = 'persist:gcal-' + email
    const ses = session.fromPartition(partition)

    // Check if already signed in
    const existing = await ses.cookies.get({ domain: '.google.com' })
    if (_isAuthed(existing)) return { authed: true, cached: true, email }

    return new Promise((resolve) => {
      const popup = new BrowserWindow({
        width: 1024, height: 768,
        webPreferences: { partition }
      })
      popup.loadURL('https://accounts.google.com/signin/v2/identifier?service=cl&flowName=GlifWebSignIn')

      let resolved = false

      async function checkCookies() {
        if (resolved) return
        const cookies = await ses.cookies.get({ domain: '.google.com' })
        if (!_isAuthed(cookies)) return

        // Try to detect the signed-in email from the calendar page
        let detectedEmail = email
        try {
          const profileCookies = await ses.cookies.get({ domain: 'calendar.google.com' })
          // COMPASS cookie encodes account index but not email — skip it.
          // Instead we rely on the email the user typed, or detect via page later.
        } catch {}

        resolved = true
        popup.close()
        resolve({ authed: true, cached: false, email: detectedEmail })
      }

      popup.webContents.on('did-navigate', () => checkCookies())
      popup.webContents.on('did-navigate-in-page', () => checkCookies())

      popup.on('closed', () => {
        if (!resolved) resolve({ authed: false, cached: false, email })
      })
    })
  })

  // Scrape the current week's events from Google Calendar using the stored session
  ipcMain.handle('scrape-calendar-events', async (_, email) => {
    const partition = 'persist:gcal-' + email
    const calendarUrl = 'https://calendar.google.com/calendar/r/week'

    // Verify session is still valid before opening a hidden window
    const ses = session.fromPartition(partition)
    const cookies = await ses.cookies.get({ domain: '.google.com' })
    console.log('[calendar-scraper] Cookies for', email, ':', cookies.map(c => c.name).join(', '))
    if (!_isAuthed(cookies)) {
      console.warn('[calendar-scraper] No valid auth cookies found for', email)
      return { events: [], count: 0, error: 'not_authed' }
    }

    // Navigate to an explicit date URL so we can compute dates from column position
    // /r/week/YYYY/M/D navigates to the week containing that date
    const now = new Date()
    const weekUrl = `https://calendar.google.com/calendar/r/week/${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()}`

    return new Promise((resolve, reject) => {
      const win = new BrowserWindow({ show: false, webPreferences: { partition } })

      // Track final URL after all redirects
      let finalUrl = weekUrl
      win.webContents.on('did-navigate', (_, url) => { finalUrl = url })
      win.webContents.on('did-navigate-in-page', (_, url) => { finalUrl = url })

      win.loadURL(weekUrl)

      win.webContents.on('did-fail-load', (event, _code, errDesc, validatedUrl, isMainFrame) => {
        if (!isMainFrame) return
        win.close()
        reject(new Error(errDesc))
      })

      win.webContents.on('did-finish-load', () => {
        // Ignore sub-frame loads (iframes like the Google contacts hovercard)
        const url = win.webContents.getURL()
        if (!url.includes('calendar.google.com')) return
        console.log('[calendar-scraper] Main frame loaded:', url)

        // If we ended up on an accounts/login page, the session isn't valid
        const currentUrl = win.webContents.getURL()
        if (currentUrl.includes('accounts.google.com') || currentUrl.includes('/signin')) {
          win.close()
          return resolve({ events: [], count: 0, error: 'not_authed', finalUrl: currentUrl })
        }

        // Dump a sample of data-* attributes and class names to find real event selectors
        win.webContents.executeJavaScript(`
          (function() {
            var title = document.title
            var url = window.location.href
            // Sample first 5 elements with data-eventid or data-eventchip
            var withEventId = Array.from(document.querySelectorAll('[data-eventid]')).slice(0,3).map(function(el) { return el.outerHTML.slice(0,200) })
            var withEventChip = Array.from(document.querySelectorAll('[data-eventchip]')).slice(0,3).map(function(el) { return el.outerHTML.slice(0,200) })
            // Find elements with 'event' in their class
            var byClass = Array.from(document.querySelectorAll('[class*="event"]')).slice(0,5).map(function(el) { return el.tagName + '.' + (el.className||'').toString().slice(0,80) })
            // Find li elements (Google Calendar often uses li for chips)
            var liCount = document.querySelectorAll('li').length
            var liSample = Array.from(document.querySelectorAll('li')).slice(0,3).map(function(el) { return (el.className||'').toString().slice(0,80) })
            return JSON.stringify({ title:title, url:url, withEventId:withEventId, withEventChip:withEventChip, byClass:byClass, liCount:liCount, liSample:liSample })
          })()
        `).then(function(info) {
          console.log('[calendar-scraper] DOM dump:', info)
        }).catch(() => {})

        // Single script: poll until chips appear, then extract — avoids timing gap between two executeJavaScript calls
        const pollAndExtractScript = `
          new Promise(function(resolve) {
            var attempts = 0
            var maxAttempts = 60

            function extract() {
              var events = []
              var seen = new Set()

              var chips = document.querySelectorAll('[data-eventchip][data-eventid]')

              // Log first chip structure + ancestor date attributes
              if (chips.length > 0) {
                var fc = chips[0]
                console.log('[cal] First chip outerHTML:', fc.outerHTML.slice(0, 500))
                // Walk up ancestors looking for date attrs
                var el = fc.parentElement
                var ancestorInfo = []
                for (var d = 0; d < 10 && el; d++) {
                  var attrs = ['data-date','data-datekey','data-column-key','data-day']
                  var found = {}
                  attrs.forEach(function(a) { if (el.getAttribute(a)) found[a] = el.getAttribute(a) })
                  if (Object.keys(found).length) ancestorInfo.push({ tag: el.tagName, attrs: found })
                  el = el.parentElement
                }
                console.log('[cal] Ancestor date attrs:', JSON.stringify(ancestorInfo))
              }

              // Compute the Monday of the displayed week from the URL: /r/week/YYYY/M/D
              // Google Calendar always shows Mon–Sun, so col 0 = Monday of that week.
              var weekMonday = null
              var urlMatch = window.location.href.match(/\\/r\\/week\\/(\\d{4})\\/(\\d{1,2})\\/(\\d{1,2})/)
              if (urlMatch) {
                var anchorDate = new Date(parseInt(urlMatch[1]), parseInt(urlMatch[2])-1, parseInt(urlMatch[3]))
                var dow = anchorDate.getDay() // 0=Sun
                var daysToMon = dow === 0 ? -6 : 1 - dow
                weekMonday = new Date(anchorDate)
                weekMonday.setDate(anchorDate.getDate() + daysToMon)
              }
              console.log('[cal] weekMonday:', weekMonday ? weekMonday.toISOString().split('T')[0] : 'unknown')

              // Build column → date map by finding the 7 day header cells
              // Google Calendar renders a header row with 7 cells, one per day
              var columnDates = []
              var headerCells = document.querySelectorAll('[role="columnheader"]')
              if (headerCells.length >= 7 && weekMonday) {
                // Just use weekMonday + offset — header count confirms 7-day view
                for (var ci = 0; ci < 7; ci++) {
                  var cd = new Date(weekMonday)
                  cd.setDate(weekMonday.getDate() + ci)
                  columnDates.push(cd.toISOString().split('T')[0])
                }
              }
              console.log('[cal] columnDates:', JSON.stringify(columnDates))

              chips.forEach(function(chip) {
                var eventId = chip.getAttribute('data-eventid') || ''

                // Collect visible leaf text, skipping aria-hidden
                var visibleParts = []
                chip.querySelectorAll('*').forEach(function(el) {
                  if (el.getAttribute('aria-hidden') === 'true') return
                  if (el.children.length === 0 && el.textContent.trim()) {
                    visibleParts.push(el.textContent.trim())
                  }
                })
                var fullText = visibleParts.join(', ')
                if (!fullText) return

                // Format: "startTime to endTime, Title, ..." or all-day "Title, ..."
                var parts = fullText.split(', ')
                var title = ''
                var time = ''
                var allDay = false

                var firstPart = parts[0] || ''
                var isTimePart = /\\d/.test(firstPart) && /(am|pm|to|\\u2013|-|:)/.test(firstPart)
                if (isTimePart) {
                  time = firstPart
                  title = parts[1] || firstPart
                } else {
                  allDay = true
                  title = firstPart
                }
                title = title.trim()
                if (!title) return

                // Determine column index by finding which column container this chip lives in
                var dateKey = ''
                if (columnDates.length === 7) {
                  // Find this chip's position among all chips, grouped by their x-position
                  var chipRect = chip.getBoundingClientRect()
                  var chipCenterX = chipRect.left + chipRect.width / 2

                  // Find which column header (day) this x-position falls under
                  var bestCol = 0
                  var bestDist = Infinity
                  headerCells.forEach(function(hc, idx) {
                    if (idx >= 7) return
                    var r = hc.getBoundingClientRect()
                    var dist = Math.abs((r.left + r.width/2) - chipCenterX)
                    if (dist < bestDist) { bestDist = dist; bestCol = idx }
                  })
                  dateKey = columnDates[bestCol] || ''
                }

                console.log('[cal] parsed:', title, '|', time, '| col date:', dateKey)

                var key = eventId || (title + '|' + dateKey)
                if (seen.has(key)) return
                seen.add(key)

                events.push({ title: title, time: time, dateKey: dateKey, allDay: allDay, eventId: eventId })
              })

              return events
            }

            function check() {
              var chips = document.querySelectorAll('[data-eventchip][data-eventid]')
              var grid = document.querySelector('[role="main"]')
              if (chips.length > 0) {
                resolve({ events: extract(), pageTitle: document.title, chipCount: chips.length })
                return
              }
              // Grid loaded but no chips = empty week
              if (grid && attempts > 10) {
                resolve({ events: [], pageTitle: document.title, chipCount: 0 })
                return
              }
              attempts++
              if (attempts >= maxAttempts) {
                resolve({ events: [], pageTitle: document.title, chipCount: 0, timeout: true })
                return
              }
              setTimeout(check, 500)
            }
            check()
          })
        `

        win.webContents.executeJavaScript(pollAndExtractScript, true).then(function(result) {
          console.log('[calendar-scraper] chipCount:', result.chipCount, 'events:', result.events.length, 'timeout:', result.timeout)
          console.log('[calendar-scraper] events:', JSON.stringify(result.events).slice(0, 400))
          win.close()
          resolve({ events: result.events || [], count: (result.events || []).length, finalUrl })
        }).catch(function(err) {
          console.error('[calendar-scraper] script error:', err.message)
          win.close()
          reject(err)
        })
      })
    })
  })

  // Save a calendar source (email) and its scraped events to DB
  ipcMain.handle('calendar:save-scrape', (_, { email, label, events }) => {
    const db = getDb()
    const partition = 'persist:gcal-' + email
    const now = Date.now()

    const insertSource = db.prepare(`
      INSERT OR IGNORE INTO calendar_sources (email, label, partition, added_at)
      VALUES (@email, @label, @partition, @added_at)
    `)
    const insertEvent = db.prepare(`
      INSERT OR REPLACE INTO calendar_events
        (id, workspace_id, profile_id, integration_id, calendar_url, title, start, end, all_day, source, account, color, synced_at)
      VALUES
        (@id, '', '', '', @calendar_url, @title, @start, @end, @all_day, @source, @account, @color, @synced_at)
    `)

    // dateKey is now always YYYY-MM-DD from the scraper
    function parseDateKey(dateKey) {
      if (!dateKey) return ''
      // Already YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey
      // Fallback for any human string
      const cleaned = dateKey.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+/i, '').trim()
      const d = new Date(cleaned)
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
      return ''
    }

    db.transaction(() => {
      insertSource.run({ email, label, partition, added_at: now })
      for (const ev of (events || [])) {
        const dateStr = parseDateKey(ev.dateKey)
        const id = 'gcal:' + email + ':' + (ev.eventId || ev.title + ':' + dateStr)
        // Parse "7pm to 11pm" or "9:00 – 9:30am" into start/end ISO time strings
        function parseTimeRange(timeStr) {
          if (!timeStr) return { startTime: '', endTime: '' }
          // Normalise en-dash and "to"
          const norm = timeStr.replace(/\u2013/g, '-').replace(/\s+to\s+/i, '-')
          const parts = norm.split('-').map(s => s.trim())
          function toISO(t) {
            if (!t) return ''
            // e.g. "7pm", "11am", "9:30pm"
            const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i)
            if (!m) return ''
            let h = parseInt(m[1])
            const min = m[2] ? parseInt(m[2]) : 0
            const ampm = m[3] ? m[3].toLowerCase() : ''
            if (ampm === 'pm' && h < 12) h += 12
            if (ampm === 'am' && h === 12) h = 0
            return String(h).padStart(2,'0') + ':' + String(min).padStart(2,'0') + ':00'
          }
          return { startTime: toISO(parts[0]), endTime: toISO(parts[1]) }
        }

        const { startTime, endTime } = parseTimeRange(ev.time)
        insertEvent.run({
          id,
          calendar_url: 'https://calendar.google.com/calendar/r/week',
          title: ev.title || '',
          start: dateStr + (startTime ? 'T' + startTime : ''),
          end: dateStr + (endTime ? 'T' + endTime : ''),
          all_day: ev.allDay ? 1 : 0,
          source: 'gcal',
          account: email,
          color: '#4285F4',
          synced_at: now,
        })
      }
    })()

    return { ok: true }
  })

  // Return all connected calendar sources and their events
  ipcMain.handle('calendar:get-data', () => {
    const db = getDb()
    const sources = db.prepare('SELECT * FROM calendar_sources ORDER BY added_at DESC').all()
    const events = db.prepare(`SELECT * FROM calendar_events WHERE source = 'gcal' ORDER BY start ASC`).all()
    return { sources, events }
  })

  // Remove a calendar source and its events
  ipcMain.handle('calendar:delete-source', (_, email) => {
    const db = getDb()
    db.transaction(() => {
      db.prepare('DELETE FROM calendar_sources WHERE email = ?').run(email)
      db.prepare("DELETE FROM calendar_events WHERE account = ? AND source = 'gcal'").run(email)
    })()
    return { ok: true }
  })
}

module.exports = { registerCalendarAuthIpc }
