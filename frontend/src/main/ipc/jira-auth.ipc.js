const { ipcMain, BrowserWindow, session } = require('electron')
const { getDb } = require('../db')

function registerJiraAuthIpc() {
  const channels = [
    'connect-jira-source',
    'scrape-jira-board',
    'jira:save-scrape',
    'jira:get-data',
    'jira:scrape-detail',
    'jira:delete-board',
  ]
  channels.forEach(c => ipcMain.removeHandler(c))

  // Authenticate to a Jira instance — opens popup if no session cookie found
  ipcMain.handle('connect-jira-source', async (_, url) => {
    const { hostname } = new URL(url)
    const partition = 'persist:' + hostname
    const ses = session.fromPartition(partition)

    const cookies = await ses.cookies.get({ domain: hostname })
    const isAuthed = cookies.some(c =>
      c.name === 'JSESSIONID' ||
      c.name === 'cloud.session.token' ||
      c.name === 'atlassian.xsrf.token' ||
      c.name === 'ajs_anonymous_id' ||
      c.name === 'tenant.session.token'
    )
    if (isAuthed) return { authed: true, cached: true }

    return new Promise((resolve) => {
      const loginUrl = hostname.endsWith('.atlassian.net')
        ? `https://id.atlassian.com/login`
        : `https://${hostname}/login`

      const popup = new BrowserWindow({
        width: 1024, height: 768,
        webPreferences: { partition }
      })
      popup.loadURL(loginUrl)

      let resolved = false

      async function checkCookies() {
        if (resolved) return
        const cookies = await ses.cookies.get({ domain: hostname })
        const authed = cookies.some(c =>
          c.name === 'JSESSIONID' ||
          c.name === 'cloud.session.token' ||
          c.name === 'atlassian.xsrf.token' ||
          c.name === 'tenant.session.token'
        )
        if (authed) {
          resolved = true
          popup.close()
          resolve({ authed: true, cached: false })
        }
      }

      popup.webContents.on('did-navigate', () => checkCookies())
      popup.webContents.on('did-navigate-in-page', () => checkCookies())

      popup.on('closed', () => {
        if (!resolved) resolve({ authed: false, cached: false })
      })
    })
  })

  // Scrape Jira board backlog — only items where user was mentioned/assigned/created
  ipcMain.handle('scrape-jira-board', async (_, boardUrl) => {
    const { hostname } = new URL(boardUrl)
    const partition = 'persist:' + hostname

    // Derive backlog URL: strip trailing slash, append /backlog if not already there
    const base = boardUrl.replace(/\/$/, '')
    const backlogUrl = base.endsWith('/backlog') ? base : base + '/backlog'

    function scrapeUrl(url) {
      return new Promise((resolve, reject) => {
        const win = new BrowserWindow({ show: false, webPreferences: { partition } })
        win.loadURL(url)
        win.webContents.once('did-finish-load', async () => {
          try {
            const result = await win.webContents.executeJavaScript(`
              (function() {
                var wrapper = document.querySelector('[data-onboarding-observer-id="backlog-wrapper"]');

                if (!wrapper) {
                  return {
                    found: false,
                    url: window.location.href,
                    bodyPreview: document.body.innerHTML.slice(0, 1000),
                    items: [],
                    currentUser: null,
                  };
                }

                // Log every direct child node for inspection
                var children = Array.from(wrapper.children);
                var childInfo = children.map(function(el, i) {
                  return {
                    index: i,
                    tag: el.tagName,
                    id: el.id || null,
                    className: el.className || null,
                    dataAttrs: Array.from(el.attributes)
                      .filter(function(a) { return a.name.startsWith('data-'); })
                      .reduce(function(acc, a) { acc[a.name] = a.value; return acc; }, {}),
                    innerText: el.innerText ? el.innerText.trim().slice(0, 200) : null,
                    outerHTMLPreview: el.outerHTML.slice(0, 400),
                  };
                });

                return {
                  found: true,
                  url: window.location.href,
                  wrapperTag: wrapper.tagName,
                  wrapperClass: wrapper.className,
                  childCount: children.length,
                  children: childInfo,
                  items: [],
                  currentUser: null,
                };
              })()
            `)
            if (!result.found) {
              console.warn('[jira-auth] backlog-wrapper NOT FOUND at:', result.url)
              console.warn('[jira-auth] body preview:\n', result.bodyPreview)
            } else {
              console.log('[jira-auth] backlog-wrapper found — tag:', result.wrapperTag, '— class:', result.wrapperClass)
              console.log('[jira-auth] child count:', result.childCount)
              result.children.forEach(function(c) {
                console.log('[jira-auth] child[' + c.index + ']', c.tag, c.id ? '#' + c.id : '', c.className ? '.' + c.className.split(' ').join('.') : '')
                if (Object.keys(c.dataAttrs).length) console.log('  data-attrs:', c.dataAttrs)
                if (c.innerText) console.log('  text:', c.innerText)
                console.log('  html:', c.outerHTMLPreview)
              })
            }
            win.close()
            resolve({ items: result.items, currentUser: result.currentUser })
          } catch (err) {
            win.close()
            reject(err)
          }
        })
        win.webContents.once('did-fail-load', (_, _code, errDesc) => {
          win.close()
          reject(new Error(errDesc))
        })
      })
    }

    console.log('[jira-auth] loading backlog URL:', backlogUrl)
    const result = await scrapeUrl(backlogUrl)
    return { url: boardUrl, items: result.items, currentUser: result.currentUser }
  })

  // Save boards + scraped items to DB
  ipcMain.handle('jira:save-scrape', (_, { boards, scrapes }) => {
    const db = getDb()
    const now = Date.now()

    const insertBoard = db.prepare(`
      INSERT OR IGNORE INTO jira_boards (url, hostname, label, added_at)
      VALUES (@url, @hostname, @label, @added_at)
    `)
    const insertItem = db.prepare(`
      INSERT INTO jira_items
        (id, workspace_id, profile_id, integration_id, board_url, title, status, priority, assignee, sprint, due_date, url, description, synced_at, raw_json)
      VALUES
        (@id, '', '', '', @board_url, @title, @status, @priority, @assignee, '', '', @url, '', @synced_at, @raw_json)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title, status=excluded.status, assignee=excluded.assignee,
        synced_at=excluded.synced_at, raw_json=excluded.raw_json
    `)

    db.transaction(() => {
      for (const board of boards) {
        insertBoard.run({ url: board.url, hostname: board.hostname, label: board.label, added_at: now })
      }
      for (const { boardUrl, items } of scrapes) {
        for (const item of items) {
          const id = boardUrl + '#' + (item.key || item.url || Math.random().toString(36).slice(2))
          insertItem.run({
            id,
            board_url: boardUrl,
            title: item.title || '',
            status: item.status || '',
            priority: item.priority || '',
            assignee: item.assignee || '',
            url: item.url || '',
            synced_at: now,
            raw_json: JSON.stringify(item),
          })
        }
      }
    })()

    return { ok: true }
  })

  // Read all boards and their items from DB
  ipcMain.handle('jira:get-data', () => {
    const db = getDb()
    const boards = db.prepare('SELECT * FROM jira_boards ORDER BY added_at DESC').all()
    const items = db.prepare(`SELECT * FROM jira_items WHERE board_url != '' ORDER BY synced_at DESC`).all()
    return { boards, items }
  })

  // Scrape detail page for a single Jira issue
  ipcMain.handle('jira:scrape-detail', async (_, { url }) => {
    const { hostname } = new URL(url)
    const partition = 'persist:' + hostname

    return new Promise((resolve, reject) => {
      const win = new BrowserWindow({ show: false, webPreferences: { partition } })
      win.loadURL(url)
      win.webContents.once('did-finish-load', async () => {
        try {
          const detail = await win.webContents.executeJavaScript(`
            (function() {
              function text(sel) {
                var el = document.querySelector(sel);
                return el ? el.textContent.trim() : null;
              }

              // Title
              var title = text('h1[data-testid*="issue.views.issue-base.foundation.summary"], h1.issue-header-summary, #summary-val, [data-testid="issue.views.issue-base.foundation.summary.heading"]');
              if (!title) title = text('h1');

              // Description
              var descEl = document.querySelector('[data-testid="issue.views.field.rich-text.description"], #description-val, .user-content-block, [data-component-selector="issue-field-description"]');
              var description = descEl ? descEl.textContent.trim().slice(0, 2000) : null;

              // Status
              var status = text('[data-testid*="status"], #status-val, .status-view, [class*="StatusLozenge"]');

              // Priority
              var priority = text('[data-testid*="priority"], #priority-val, [class*="PriorityField"]');

              // Assignee
              var assignee = text('[data-testid*="assignee"] [class*="name"], #assignee-val, [class*="user-avatar-item"] [class*="name"]');

              // Reporter
              var reporter = text('[data-testid*="reporter"] [class*="name"], #reporter-val');

              // Labels
              var labels = Array.from(document.querySelectorAll('[data-testid*="labels"] a, #labels-val a, .labels a'))
                .map(function(l) { return l.textContent.trim(); }).filter(Boolean);

              // Sprint
              var sprint = text('[data-testid*="sprint"], #sprint-val, [class*="SprintField"]');

              // Comments
              var comments = Array.from(document.querySelectorAll(
                '[data-testid="issue.views.field.comment.comment-activity-view"] [data-testid*="comment"], .activity-comment, .comment-item'
              )).map(function(c) {
                var userEl = c.querySelector('[class*="author"], [data-testid*="author"], .user-mention');
                var bodyEl = c.querySelector('[class*="comment-body"], .user-content-block, [data-testid*="content"]');
                var timeEl = c.querySelector('time, relative-time, [datetime]');
                return {
                  user: userEl ? userEl.textContent.trim() : null,
                  body: bodyEl ? bodyEl.textContent.trim().slice(0, 400) : null,
                  date: timeEl ? (timeEl.getAttribute('datetime') || timeEl.textContent.trim()) : null,
                };
              }).filter(function(c) { return c.user || c.body; });

              return { title, description, status, priority, assignee, reporter, labels, sprint, comments };
            })()
          `)
          win.close()
          resolve(detail)
        } catch (err) {
          win.close()
          reject(err)
        }
      })
      win.webContents.once('did-fail-load', (_, _c, errDesc) => {
        win.close()
        reject(new Error(errDesc))
      })
    })
  })

  // Delete a board and its items from DB
  ipcMain.handle('jira:delete-board', (_, url) => {
    const db = getDb()
    db.transaction(() => {
      db.prepare('DELETE FROM jira_boards WHERE url = ?').run(url)
      db.prepare('DELETE FROM jira_items WHERE board_url = ?').run(url)
    })()
    return { ok: true }
  })
}

module.exports = { registerJiraAuthIpc }
