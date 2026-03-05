const { createSession } = require('./browser')

// DOM scraper — navigates to the board URL in the user's logged-in Chrome session,
// waits for cards to render, extracts raw text from the DOM.
// No API calls — purely what the browser renders.

async function scrapeJiraBoardRaw(urls, profileDirName) {
  const allItems = []
  const session = await createSession(profileDirName)

  try {
    for (const boardUrl of urls) {
      try {
        await session.navigateTo(boardUrl)

        // Wait for board cards to appear — Jira SPA needs extra time after load event
        await session.evaluateInPage(`
          new Promise(resolve => {
            const check = () => {
              const cards = document.querySelectorAll(
                '[data-testid="platform-board-kit.ui.card.card"], ' +
                '[data-component-selector="board-card"], ' +
                'div[class*="card-container"], ' +
                'li[class*="issue-list-item"]'
              )
              if (cards.length > 0) return resolve()
              setTimeout(check, 500)
            }
            setTimeout(resolve, 15000)
            check()
          })
        `, { awaitPromise: true, timeout: 16000 })

        const result = await session.evaluateInPage(`
          (() => {
            const items = []

            const cardSelectors = [
              '[data-testid="platform-board-kit.ui.card.card"]',
              '[data-component-selector="board-card"]',
              '[class*="card--"][class*="issue"]',
              '[class*="ghx-issue"]',
            ]

            for (const sel of cardSelectors) {
              const cards = document.querySelectorAll(sel)
              if (cards.length === 0) continue
              cards.forEach(card => {
                const keyEl = card.querySelector(
                  '[data-testid*="issue-key"], [class*="issue-key"], [class*="card-key"], a[href*="/browse/"]'
                )
                const key = keyEl ? (keyEl.textContent.trim() || keyEl.getAttribute('href')?.match(/\\/browse\\/([A-Z]+-\\d+)/)?.[1] || '') : ''

                const summaryEl = card.querySelector(
                  '[data-testid*="summary"], [class*="summary"], [class*="card-summary"], [class*="ghx-summary"]'
                )
                const summary = summaryEl ? summaryEl.textContent.trim() : card.textContent.slice(0, 120).trim()

                const statusEl = card.querySelector('[class*="status"], [class*="lozenge"]')
                const status = statusEl ? statusEl.textContent.trim() : ''

                const priorityEl = card.querySelector('img[class*="priority"], [class*="priority"] img, [data-testid*="priority"]')
                const priority = priorityEl ? (priorityEl.getAttribute('alt') || priorityEl.textContent.trim()) : ''

                const assigneeEl = card.querySelector('img[class*="avatar"], [class*="assignee"] img, [data-testid*="assignee"]')
                const assignee = assigneeEl ? (assigneeEl.getAttribute('alt') || '') : ''

                items.push({ key, summary, status, priority, assignee, sourceUrl: window.location.href })
              })
              break
            }

            if (items.length === 0) {
              const rows = document.querySelectorAll(
                '[data-testid*="issue-row"], [class*="issue-list-item"], tr[class*="issuerow"], [class*="backlog-issue"]'
              )
              rows.forEach(row => {
                const key = (row.querySelector('[class*="issue-key"], [data-testid*="issue-key"], a[href*="/browse/"]') || {}).textContent?.trim() || ''
                const summary = (row.querySelector('[class*="summary"], [data-testid*="summary"]') || {}).textContent?.trim() || ''
                const status = (row.querySelector('[class*="status"], [class*="lozenge"]') || {}).textContent?.trim() || ''
                const priority = (row.querySelector('img[class*="priority"]') || {}).getAttribute?.('alt') || ''
                const assignee = (row.querySelector('img[class*="avatar"]') || {}).getAttribute?.('alt') || ''
                if (key || summary) items.push({ key, summary, status, priority, assignee, sourceUrl: window.location.href })
              })
            }

            const columns = []
            document.querySelectorAll(
              '[data-testid*="column-header"], [class*="column-header"], [class*="ghx-column"] h2'
            ).forEach(h => columns.push(h.textContent.trim()))

            return JSON.stringify({ items, columns, pageTitle: document.title, url: window.location.href })
          })()
        `)

        const parsed = JSON.parse(result)
        console.log('[jira-scraper] Raw DOM result from', boardUrl, ':', parsed)
        allItems.push({ boardUrl, ...parsed })

      } catch (err) {
        console.error('[jira-scraper] Error scraping', boardUrl, err.message)
        allItems.push({ boardUrl, items: [], error: err.message })
      }
    }

  } finally {
    try { await session.close() } catch {}
  }

  return { results: allItems, count: allItems.reduce((n, r) => n + (r.items || []).length, 0) }
}

module.exports = { scrapeJiraBoardRaw }
