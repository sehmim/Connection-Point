const { ipcMain, BrowserWindow, session } = require('electron')
const { getDb } = require('../db')

function registerGithubAuthIpc() {
  const channels = [
    'connect-github-source',
    'scrape-github-issues',
    'github:save-scrape',
    'github:get-data',
    'github:scrape-detail',
    'github:delete-repo',
  ]
  channels.forEach(c => ipcMain.removeHandler(c))

  ipcMain.handle('connect-github-source', async (_, url) => {
    const { hostname } = new URL(url)
    const partition = 'persist:' + hostname
    const ses = session.fromPartition(partition)

    // Check for existing valid session cookie
    const cookies = await ses.cookies.get({ domain: hostname })
    const isAuthed = cookies.some(c =>
      c.name === 'user_session' || c.name === 'dotcom_user' || c.name === '_gh_sess'
    )
    if (isAuthed) return { authed: true, cached: true }

    // Open a login popup with persisted session partition
    return new Promise((resolve) => {
      const popup = new BrowserWindow({
        width: 1024, height: 768,
        webPreferences: { partition }
      })
      const loginUrl = `https://${hostname}/login`
      popup.loadURL(loginUrl)

      let resolved = false

      async function checkCookies() {
        if (resolved) return
        const cookies = await ses.cookies.get({ domain: hostname })
        const authed = cookies.some(c =>
          c.name === 'user_session' || c.name === 'dotcom_user' || c.name === '_gh_sess'
        )
        if (authed) {
          resolved = true
          popup.close()
          resolve({ authed: true, cached: false })
        }
      }

      // Check after each navigation completes (covers SSO redirects back to github.com)
      popup.webContents.on('did-navigate', () => checkCookies())
      popup.webContents.on('did-navigate-in-page', () => checkCookies())

      popup.on('closed', () => {
        if (!resolved) resolve({ authed: false, cached: false })
      })
    })
  })

  // Scrape issues and PRs from a GitHub repo URL using the persisted session
  ipcMain.handle('scrape-github-issues', async (_, repoUrl) => {
    const { hostname } = new URL(repoUrl)
    const partition = 'persist:' + hostname
    const base = repoUrl.replace(/\/$/, '')

    function scrapeUrl(url, type) {
      return new Promise((resolve, reject) => {
        const win = new BrowserWindow({ show: false, webPreferences: { partition } })
        win.loadURL(url)
        win.webContents.once('did-finish-load', async () => {
          try {
            const result = await win.webContents.executeJavaScript(`
              (function() {
                var type = ${JSON.stringify(type)};
                var hrefFragment = type === 'pr' ? '/pull/' : '/issues/';
                var hrefRe = type === 'pr' ? /\\/pull\\/\\d+$/ : /\\/issues\\/\\d+$/;

                // GitHub uses data-listview-component="items-list" on issues; try that first,
                // then fall back to any <ul>/<div> that contains multiple issue/pr links
                var list = document.querySelector('[data-listview-component="items-list"]');
                if (!list) {
                  // fallback: find the container holding the most issue/PR anchor links
                  var candidates = Array.from(document.querySelectorAll('ul, div[role="group"]'));
                  var best = null, bestCount = 0;
                  candidates.forEach(function(c) {
                    var n = c.querySelectorAll('a[href*="' + hrefFragment + '"]').length;
                    if (n > bestCount) { bestCount = n; best = c; }
                  });
                  list = best;
                }

                if (!list) return { _debug: 'no container found', _childCount: 0, items: [] };

                var children = Array.from(list.children);
                var firstChildPreview = children[0] ? children[0].outerHTML.slice(0, 600) : 'none';

                var parsed = children.map(function(el) {
                  var links = Array.from(el.querySelectorAll('a[href*="' + hrefFragment + '"]'));
                  var titleLink = links.find(function(a) { return hrefRe.test(a.getAttribute('href')); });
                  var timeEl = el.querySelector('relative-time, time');
                  var labelsEl = el.querySelectorAll('[class*="label" i], [data-testid*="label" i]');
                  var assigneesEl = el.querySelectorAll('img[alt^="@"]');
                  var text = el.innerText || '';
                  var numMatch = text.match(/#(\\d+)/);
                  return {
                    type: type,
                    title: titleLink ? titleLink.textContent.trim() : null,
                    number: numMatch ? numMatch[1] : null,
                    url: titleLink ? titleLink.href : null,
                    labels: Array.from(labelsEl).map(function(l) { return l.textContent.trim(); }).filter(Boolean),
                    assignees: Array.from(assigneesEl).map(function(a) { return a.getAttribute('alt'); }).filter(Boolean),
                    date: timeEl ? (timeEl.getAttribute('datetime') || timeEl.textContent.trim()) : null,
                  };
                }).filter(function(item) { return item.title; });

                return { _debug: firstChildPreview, _childCount: children.length, items: parsed };
              })()
            `)
            console.log('[github-auth]', type, '— childCount:', result._childCount, '\nfirstChild preview:\n', result._debug)
            win.close()
            resolve(result.items || [])
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

    const [issues, prs] = await Promise.all([
      scrapeUrl(base + '/issues', 'issue'),
      scrapeUrl(base + '/pulls', 'pr'),
    ])

    return { url: base, issues, prs }
  })

  // Save repos + scraped items to DB
  ipcMain.handle('github:save-scrape', (_, { repos, scrapes }) => {
    const db = getDb()
    const now = Date.now()

    const insertRepo = db.prepare(`
      INSERT OR REPLACE INTO github_repos (url, hostname, label, added_at)
      VALUES (@url, @hostname, @label, @added_at)
    `)
    const insertItem = db.prepare(`
      INSERT INTO github_items
        (workspace_id, profile_id, integration_id, repo_url, type, title, status, repo, author, updated_at, url, body, synced_at, raw_json)
      VALUES
        ('', '', '', @repo_url, @type, @title, 'open', @repo, @author, @updated_at, @url, '', @synced_at, @raw_json)
      ON CONFLICT(url) DO UPDATE SET
        title=excluded.title, updated_at=excluded.updated_at, synced_at=excluded.synced_at, raw_json=excluded.raw_json
    `)

    db.transaction(() => {
      for (const repo of repos) {
        insertRepo.run({ url: repo.url, hostname: repo.hostname, label: repo.label, added_at: now })
      }
      for (const { repoUrl, items } of scrapes) {
        const repo = new URL(repoUrl).pathname.slice(1)
        for (const item of items) {
          insertItem.run({
            repo_url: repoUrl,
            type: item.type,
            title: item.title || '',
            repo,
            author: (item.assignees && item.assignees[0]) || '',
            updated_at: item.date || null,
            url: item.url || '',
            synced_at: now,
            raw_json: JSON.stringify(item),
          })
        }
      }
    })()

    return { ok: true }
  })

  // Read all repos and their items from DB
  ipcMain.handle('github:get-data', () => {
    const db = getDb()
    const repos = db.prepare('SELECT * FROM github_repos ORDER BY added_at DESC').all()
    const items = db.prepare(`SELECT * FROM github_items WHERE repo_url != '' ORDER BY updated_at DESC`).all()
    return { repos, items }
  })

  // Scrape detail page for a single issue or PR
  ipcMain.handle('github:scrape-detail', async (_, { url, type }) => {
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
              function attr(sel, a) {
                var el = document.querySelector(sel);
                return el ? el.getAttribute(a) : null;
              }

              // Body / description
              var bodyEl = document.querySelector('.comment-body, [data-testid="issue-body"], .markdown-body');
              var body = bodyEl ? bodyEl.innerHTML.trim() : null;

              // Labels
              var labels = Array.from(document.querySelectorAll('[data-testid="issue-label"], .IssueLabel, .js-issue-labels .label, [id^="label-"]'))
                .map(function(l) { return l.textContent.trim(); }).filter(Boolean);

              // Assignees
              var assignees = Array.from(document.querySelectorAll('.assignee .user-mention, .js-issue-assignees a, [data-testid="assignee"]'))
                .map(function(a) { return a.textContent.trim(); }).filter(Boolean);

              // Author
              var author = text('[data-testid="issue-author"] a, .gh-header-meta .author, .timeline-comment-header a.author');

              // State
              var stateEl = document.querySelector('[data-testid="issue-state-header"], .State, .gh-header-meta .State');
              var state = stateEl ? stateEl.textContent.trim() : null;

              // Comments
              var comments = Array.from(document.querySelectorAll('.timeline-comment, [data-testid="issue-comment"]')).map(function(c) {
                var userEl = c.querySelector('.author, [data-testid="comment-author"]');
                var bodyEl = c.querySelector('.comment-body, .markdown-body');
                var timeEl = c.querySelector('relative-time, time');
                return {
                  user: userEl ? userEl.textContent.trim() : null,
                  body: bodyEl ? bodyEl.textContent.trim().slice(0, 400) : null,
                  date: timeEl ? (timeEl.getAttribute('datetime') || timeEl.textContent.trim()) : null,
                };
              }).filter(function(c) { return c.user || c.body; });

              // PR-specific: reviewers, changed files count
              var reviewers = Array.from(document.querySelectorAll('.reviewer .user-mention, [data-testid="reviewer"]'))
                .map(function(r) { return r.textContent.trim(); }).filter(Boolean);

              var filesChanged = text('.js-diff-progressive-container .file-info, [data-testid="files-changed-count"]');

              return { body, labels, assignees, author, state, comments, reviewers, filesChanged };
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

  // Delete a repo and its items from DB
  ipcMain.handle('github:delete-repo', (_, url) => {
    const db = getDb()
    db.transaction(() => {
      db.prepare('DELETE FROM github_repos WHERE url = ?').run(url)
      db.prepare('DELETE FROM github_items WHERE repo_url = ?').run(url)
    })()
    return { ok: true }
  })
}

module.exports = { registerGithubAuthIpc }
