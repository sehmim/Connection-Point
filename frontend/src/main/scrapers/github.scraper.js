const { createSession } = require('./browser')
const { classifyGithubRepo } = require('../agents/github-classifier')


// ── In-browser extractor ──────────────────────────────────────────────────────
// Runs inside the page via evaluateInPage.
// Targets data-listview-component="items-list" — the exact container GitHub
// uses for both issues and PRs in its modern list view.
async function extractListViewItems(session, defaultType) {
  const raw = await session.evaluateInPage(`
    (() => {
      const list = document.querySelector('[data-listview-component="items-list"]')
      if (!list) return JSON.stringify([])

      const items = []
      const listItems = list.querySelectorAll('li[role="listitem"]')

      listItems.forEach(li => {
        // ── Title + URL ──────────────────────────────────────────────────────
        const titleLink = li.querySelector('[data-testid="issue-pr-title-link"]')
        const title = titleLink ? titleLink.textContent.trim() : ''
        const href = titleLink ? titleLink.getAttribute('href') : ''
        if (!title || !href) return

        // ── Number + type from href ──────────────────────────────────────────
        const numMatch = href.match(/\\/(issues|pull)\\/(\\d+)/)
        const number = numMatch ? parseInt(numMatch[2]) : null
        const type = numMatch ? (numMatch[1] === 'pull' ? 'pr' : 'issue') : '${defaultType}'
        const url = 'https://github.com' + href

        // ── Status from SVG class or aria-label on the state icon ────────────
        const stateIcon = li.querySelector('[data-testid="list-row-state-icon"] svg')
        const stateClass = stateIcon ? stateIcon.getAttribute('class') || '' : ''
        const ariaLabel = li.getAttribute('aria-label') || ''
        let status = 'open'
        if (/octicon-git-merge|merged/i.test(stateClass)) status = 'merged'
        else if (/octicon-issue-closed|octicon-git-pull-request-closed|closed/i.test(stateClass)) status = 'closed'
        else if (/octicon-git-pull-request-draft|draft/i.test(stateClass + ariaLabel)) status = 'draft'

        // ── Author from created-at section ───────────────────────────────────
        const createdAtEl = li.querySelector('[data-testid="created-at"]')
        const authorLink = createdAtEl ? createdAtEl.querySelector('a[data-hovercard-type="user"]') : null
        const author = authorLink ? authorLink.textContent.trim() : ''

        // ── Timestamp ────────────────────────────────────────────────────────
        const relTime = li.querySelector('relative-time')
        const createdAt = relTime ? relTime.getAttribute('datetime') || '' : ''

        // ── Assignees from avatar stack ───────────────────────────────────────
        const assignees = []
        li.querySelectorAll('[data-testid="list-row-assignees"] img').forEach(img => {
          const name = (img.getAttribute('alt') || '').trim()
          if (name && !assignees.includes(name)) assignees.push(name)
        })

        // ── Labels ────────────────────────────────────────────────────────────
        const labels = []
        li.querySelectorAll('[data-testid="list-row-labels"] a, [class*="IssueLabel"], [class*="Label--"]').forEach(el => {
          const l = el.textContent.trim()
          if (l && !labels.includes(l)) labels.push(l)
        })

        // ── Comment count ─────────────────────────────────────────────────────
        const commentsEl = li.querySelector('[data-testid="list-row-comments"]')
        const commentCount = commentsEl ? parseInt(commentsEl.textContent.trim()) || 0 : 0

        // ── Review status (PRs) ───────────────────────────────────────────────
        let reviewStatus = ''
        const reviewEl = li.querySelector('[data-testid="list-row-review-decision"], [aria-label*="review"]')
        if (reviewEl) {
          const rt = reviewEl.textContent.toLowerCase()
          if (/approved/.test(rt)) reviewStatus = 'approved'
          else if (/changes.requested/.test(rt)) reviewStatus = 'changes requested'
          else if (/review.required|awaiting/.test(rt)) reviewStatus = 'review required'
        }

        // ── Milestone ─────────────────────────────────────────────────────────
        const milestoneEl = li.querySelector('[data-testid="list-row-milestone"]')
        const milestone = milestoneEl ? milestoneEl.textContent.trim() : ''

        items.push({ number, type, title, status, author, assignees, labels, milestone, createdAt, updatedAt: createdAt, commentCount, reviewStatus, url })
      })

      return JSON.stringify(items)
    })()
  `)

  const items = JSON.parse(raw)
  const summary = items.map(i => '#' + i.number + '(' + i.type + ') "' + i.title + '" by ' + (i.author || '?') + ' assignees=[' + i.assignees.join(',') + ']').join(' | ')
  console.log('[github-scraper] extractListViewItems:', summary || '(none)')
  return items
}

// ─────────────────────────────────────────────────────────────────────────────

function parseGithubRepoUrl(repoUrl) {
  try {
    const url = new URL(repoUrl)
    const parts = url.pathname.replace(/^\//, '').replace(/\/$/, '').split('/')
    if (!parts[0] || !parts[1]) return null
    return { owner: parts[0], repo: parts[1], base: url.origin }
  } catch {
    return null
  }
}

async function _waitForPageLoad(session) {
  await session.evaluateInPage(`
    new Promise(resolve => {
      const check = () => {
        const ready = document.querySelector(
          '[data-listview-component="items-list"], ' +
          '.repository-content, [data-testid="issues-list-page"], ' +
          '[aria-label="Issues"], [aria-label="Pull requests"], ' +
          '#js-issues-toolbar, .js-navigation-container, ' +
          '.blankslate, [data-testid="issues-list-empty-state"]'
        )
        if (ready) return resolve()
        setTimeout(check, 500)
      }
      setTimeout(resolve, 12000)
      check()
    })
  `, { awaitPromise: true, timeout: 13000 })

  await new Promise(r => setTimeout(r, 800))
}

async function _getLoggedInUser(session) {
  try {
    const user = await session.evaluateInPage(`
      (() => {
        const meta = document.querySelector('meta[name="user-login"]')
        if (meta && meta.content) return meta.content
        const dataLogin = document.querySelector('[data-login]')
        if (dataLogin) return dataLogin.getAttribute('data-login')
        const hovercard = document.querySelector('[data-hovercard-url^="/users/"]')
        if (hovercard) {
          const m = hovercard.getAttribute('data-hovercard-url').match(/\\/users\\/([^\\/\\?]+)/)
          if (m) return m[1]
        }
        const headerLinks = document.querySelectorAll('header a[href^="/"], .AppHeader a[href^="/"]')
        for (const a of headerLinks) {
          const href = a.getAttribute('href')
          if (href && /^\\/[a-zA-Z0-9_-]+$/.test(href) && a.querySelector('img')) return href.slice(1)
        }
        for (const s of document.querySelectorAll('script:not([src])')) {
          const m = s.textContent.match(/"(?:login|viewer)"\s*:\s*"([a-zA-Z0-9_-]+)"/)
          if (m) return m[1]
        }
        return ''
      })()
    `)
    console.log('[github-scraper] User detection result:', JSON.stringify(user))
    return user || ''
  } catch (err) {
    console.warn('[github-scraper] User detection failed:', err.message)
    return ''
  }
}

async function scrapeGithubRepoRaw(urls, profileDirName) {
  const allResults = []
  const session = await createSession(profileDirName)

  try {
    for (const repoUrl of urls) {
      const normalizedUrl = repoUrl.replace(/\/$/, '')
      const parsed = parseGithubRepoUrl(normalizedUrl)
      if (!parsed) {
        allResults.push({ repoUrl, error: 'Invalid GitHub URL', items: [] })
        continue
      }
      const { owner, repo, base } = parsed
      console.log('[github-scraper] Crawling', owner + '/' + repo)

      try {
        // ── 1. Detect logged-in user ─────────────────────────────────────────
        await session.navigateTo(`${base}/${owner}/${repo}`)
        await _waitForPageLoad(session)
        const loggedInUser = await _getLoggedInUser(session)
        console.log('[github-scraper] Logged-in user:', loggedInUser || '(not detected)')

        // ── 2. Crawl issues page → extract rows from list component ─────────
        await session.navigateTo(`${base}/${owner}/${repo}/issues?q=is%3Aopen`)
        await _waitForPageLoad(session)
        const issuesData = await extractListViewItems(session, 'issue')
        console.log('[github-scraper] Issues page →', issuesData.length, 'rows')

        // ── 3. Crawl pulls page → extract rows from list component ───────────
        await session.navigateTo(`${base}/${owner}/${repo}/pulls?q=is%3Aopen`)
        await _waitForPageLoad(session)
        const pullsData = await extractListViewItems(session, 'pr')
        console.log('[github-scraper] Pulls page →', pullsData.length, 'rows')

        // ── 4. Classify with LLM ─────────────────────────────────────────────
        const classified = await classifyGithubRepo({ owner, repo, repoUrl, issuesData, pullsData, loggedInUser })
        allResults.push(classified)

      } catch (err) {
        console.error('[github-scraper] Error crawling', owner + '/' + repo, err.message)
        allResults.push({ repoUrl, owner, repo, error: err.message, items: [] })
      }
    }

  } finally {
    try { await session.close() } catch {}
  }

  const count = allResults.reduce((n, r) => n + (r.items || []).length, 0)
  return { results: allResults, count }
}

module.exports = { scrapeGithubRepoRaw }
