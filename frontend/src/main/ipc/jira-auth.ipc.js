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

  // Scrape Jira active sprint board — only items where user was mentioned/assigned/created
  ipcMain.handle('scrape-jira-board', async (_, boardUrl) => {
    const { hostname } = new URL(boardUrl)
    const partition = 'persist:' + hostname
    const ses = session.fromPartition(partition)

    // Build board URL with assignee filter
    const base = boardUrl.replace(/\/$/, '')
    
    // First load the page to get the user ID, then scrape
    function scrapeUrl(url) {
      return new Promise((resolve, reject) => {
        const win = new BrowserWindow({ show: false, webPreferences: { partition } })
        console.log('[jira-auth] Loading URL:', url)
        win.loadURL(url)

        win.webContents.once('did-fail-load', (_, _code, errDesc) => {
          console.log('[jira-auth] Failed to load:', errDesc)
          win.close()
          reject(new Error(errDesc))
        })

        win.webContents.once('did-finish-load', () => {
          console.log('[jira-auth] Page loaded, waiting for elements...')
          doScrape(win, resolve, reject)
        })
      })
    }

    function doScrape(win, resolve, reject) {
      console.log('[jira-auth] Starting scrape...')
      const pollScript = `
        new Promise(function(resolve) {
          var attempts = 0;
          var maxAttempts = 30;
          function check() {
            var wrapper = document.querySelector('[data-testid="platform-board-kit.ui.swimlane.swimlane-wrapper"]');
            if (wrapper) { resolve({ found: true }); return; }
            attempts++;
            if (attempts >= maxAttempts) { resolve({ found: false }); return; }
            setTimeout(check, 500);
          }
          check();
        })
      `

      win.webContents.executeJavaScript(pollScript).then(function(result) {
        if (!result.found) {
          console.warn('[jira-auth] swimlane-wrapper NOT FOUND')
          win.close()
          resolve({ items: [], currentUser: null })
          return
        }

        const extractScript = `
          (function() {
            var wrappers = document.querySelectorAll('[data-testid="platform-board-kit.ui.swimlane.swimlane-wrapper"]');
            console.log('[jira-auth] Found wrappers:', wrappers.length);
            
            // Get the wrapper with the most cards (likely active sprint)
            var wrapper = null;
            var maxCards = 0;
            for (var i = 0; i < wrappers.length; i++) {
              var cards = wrappers[i].querySelectorAll('[data-testid="software-context-menu.ui.context-menu.children-wrapper"]');
              console.log('[jira-auth] Wrapper', i, 'has cards:', cards.length);
              if (cards.length > maxCards) {
                maxCards = cards.length;
                wrapper = wrappers[i];
              }
            }
            
            console.log('[jira-auth] Using wrapper with', maxCards, 'cards');
            if (!wrapper) return { found: false };

            var sprintName = '', sprintDates = '';
            var sprintEl = wrapper.querySelector('[data-testid="platform-board-kit.ui.plan-mode-header"]');
            if (sprintEl) {
              var text = sprintEl.textContent.trim();
              var match = text.match(/(.+?)\\s+(\\d+\\s+\\w+\\s*[-–]\\s*\\d+\\s+\\w+)/);
              if (match) { sprintName = match[1].trim(); sprintDates = match[2].trim(); }
              else sprintName = text;
            }

            // Try to get sprint name from anywhere on the page if not found in wrapper
            if (!sprintName) {
              var anySprintEl = document.querySelector('[data-testid="platform-board-kit.ui.plan-mode-header"]');
              if (anySprintEl) {
                var text = anySprintEl.textContent.trim();
                var match = text.match(/(.+?)\\s+(\\d+\\s+\\w+\\s*[-–]\\s*\\d+\\s+\\w+)/);
                if (match) { sprintName = match[1].trim(); sprintDates = match[2].trim(); }
                else sprintName = text;
              }
            }

            var allIssues = [];
            var cards = wrapper.querySelectorAll('[data-testid="software-context-menu.ui.context-menu.children-wrapper"]');
            console.log('[jira-auth] Found cards:', cards.length);
            
            cards.forEach(function(card) {
              var keyLink = card.querySelector('[data-testid="platform-card.common.ui.key.key"] a');
              var href = keyLink ? keyLink.href : '';
              var keyMatch = href.match(/\\/browse\\/([A-Z]+-\\d+)/);
              var key = keyMatch ? keyMatch[1] : '';
              
              var titleEl = card.querySelector('[data-component-selector="platform-card.ui.card.card-content.content-section"]');
              var title = titleEl ? titleEl.textContent.trim().replace(/\\s+/g, ' ').slice(0, 200) : '';
              
              var statusEl = card.querySelector('[data-testid="platform-card.common.ui.custom-fields.card-custom-field.text-card-custom-field-content.field"]');
              var status = statusEl ? statusEl.textContent.trim() : '';
              
              var priorityEl = card.querySelector('[data-testid="platform-card.common.ui.priority.icon"] img');
              var priority = '';
              if (priorityEl && priorityEl.alt) {
                var m = priorityEl.alt.match(/P\\d+\\s*-\\s*(\\w+)/);
                priority = m ? m[1] : priorityEl.alt;
              }
              
              var estimateEl = card.querySelector('[data-testid="software-board.common.fields.estimate-field.static.estimate-wrapper"]');
              var estimate = estimateEl ? estimateEl.textContent.trim() : '';
              
              var epicEl = card.querySelector('[data-testid="issue-field-parent-switcher.common.ui.epic-lozenge.epic-lozenge"]');
              var epic = epicEl ? epicEl.textContent.trim() : '';
              
              if (key) {
                allIssues.push({
                  key: key, title: title, status: status, priority: priority,
                  estimate: estimate, epic: epic,
                  url: window.location.origin + '/browse/' + key
                });
              }
            });

            console.log('[jira-auth] === SEMANTIC DATA ===');
            console.log('[jira-auth] Sprint:', sprintName);
            console.log('[jira-auth] Total issues:', allIssues.length);
            console.log('[jira-auth] Issues:', JSON.stringify(allIssues, null, 2));

            return { found: true, sprintName: sprintName, sprintDates: sprintDates, issues: allIssues, debug: { wrapperCount: wrappers ? wrappers.length : 0, cardCount: cards ? cards.length : 0 } };
          })()
        `

        win.webContents.executeJavaScript(extractScript).then(function(data) {
          console.log('[jira-auth] Extraction complete, items:', data.issues ? data.issues.length : 0)
          console.log('[jira-auth] Debug:', data.debug)
          console.log('[jira-auth] Sprint:', data.sprintName)
          win.close()
          resolve({ items: data.issues || [], currentUser: null, sprintName: data.sprintName, sprintDates: data.sprintDates, totalItems: (data.issues || []).length })
        }).catch(function(err) {
          win.close()
          reject(err)
        })
      }).catch(function(err) {
        win.close()
        reject(err)
      })
    }

    console.log('[jira-auth] loading board URL:', base)
    const result = await scrapeUrl(base)
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
        (id, workspace_id, profile_id, integration_id, board_url, title, status, priority, assignee, sprint, due_date, url, description, epic, estimate, issue_type, synced_at, raw_json)
      VALUES
        (@id, '', '', '', @board_url, @title, @status, @priority, '', '', '', @url, '', @epic, @estimate, @issue_type, @synced_at, @raw_json)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title, status=excluded.status, priority=excluded.priority,
        epic=excluded.epic, estimate=excluded.estimate, issue_type=excluded.issue_type,
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
            epic: item.epic || '',
            estimate: item.estimate || '',
            issue_type: item.issueType || '',
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
