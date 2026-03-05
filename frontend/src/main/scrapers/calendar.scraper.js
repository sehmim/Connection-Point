const { createSession } = require('./browser')

// DOM scraper — navigates to the calendar URL in the user's logged-in Chrome session,
// extracts event tiles from the rendered week/month view.
// No API calls — purely what the browser renders.

async function scrapeCalendarRaw(urls, profileDirName) {
  const allResults = []
  const session = await createSession(profileDirName)

  try {
    for (const calendarUrl of urls) {
      try {
        await session.navigateTo(calendarUrl)

        // Wait for event chips to appear
        await session.evaluateInPage(`
          new Promise(resolve => {
            const check = () => {
              const events = document.querySelectorAll(
                '[data-eventid], [data-eventchip], ' +
                '[class*="event-chip"], [class*="KF4T3b"], ' +
                'li[class*="event"], [role="gridcell"] [data-eventid]'
              )
              if (events.length > 0) return resolve()
              setTimeout(check, 600)
            }
            setTimeout(resolve, 15000)
            check()
          })
        `, { awaitPromise: true, timeout: 16000 })

        const result = await session.evaluateInPage(`
          (() => {
            const events = []
            const seen = new Set()

            const chipSelectors = [
              '[data-eventid]',
              '[data-eventchip]',
              '[class*="event-chip"]',
              'li[class*="event"]',
              '[role="gridcell"] a[class*="event"]',
              '[class*="event-title-container"]',
              '[class*="calendarEventTitle"]',
              '.ms-CalendarDayGrid-event',
              '[class*="eventItem"]',
            ]

            for (const sel of chipSelectors) {
              const chips = document.querySelectorAll(sel)
              if (chips.length === 0) continue

              chips.forEach(chip => {
                const titleEl = chip.querySelector(
                  '[data-eventid-title], [class*="event-title"], [class*="title"], ' +
                  '[class*="Yi8ynd"], h4, [aria-label]'
                )
                const title = titleEl
                  ? titleEl.textContent.trim()
                  : (chip.getAttribute('aria-label') || chip.textContent.slice(0, 80).trim())

                if (!title || seen.has(title + chip.className)) return
                seen.add(title + chip.className)

                const timeEl = chip.querySelector('[class*="time"], [class*="KF4T3b"] span, time, [datetime]')
                let time = timeEl ? timeEl.textContent.trim() : ''
                if (!time) {
                  const ariaLabel = chip.getAttribute('aria-label') || ''
                  const timeMatch = ariaLabel.match(/^([\\d:apm\\s–]+),/)
                  if (timeMatch) time = timeMatch[1].trim()
                }

                const cell = chip.closest('[data-datekey], [data-date], [class*="date-column"], td[data-date]')
                const dateKey = cell
                  ? (cell.getAttribute('data-datekey') || cell.getAttribute('data-date') || '')
                  : ''

                const calNameEl = chip.querySelector('[class*="calendar-name"], [class*="calendarTitle"]')
                const calendarName = calNameEl ? calNameEl.textContent.trim() : ''

                const allDayRow = chip.closest('[class*="all-day"], [data-allday="true"]')
                const allDay = !!allDayRow

                events.push({ title, time, dateKey, calendarName, allDay, sourceUrl: window.location.href })
              })

              if (events.length > 0) break
            }

            const headingEl = document.querySelector(
              '[class*="current-date"], [class*="date-label"], ' +
              '[class*="YyltNb"], h2[class*="heading"], [aria-label*="week of"], [aria-label*="month of"]'
            )
            const viewHeading = headingEl ? headingEl.textContent.trim() : document.title

            return JSON.stringify({ events, viewHeading, url: window.location.href, pageTitle: document.title })
          })()
        `)

        const parsed = JSON.parse(result)
        console.log('[calendar-scraper] Raw DOM result from', calendarUrl, ':', parsed)
        allResults.push({ calendarUrl, ...parsed })

      } catch (err) {
        console.error('[calendar-scraper] Error scraping', calendarUrl, err.message)
        allResults.push({ calendarUrl, events: [], error: err.message })
      }
    }

  } finally {
    try { await session.close() } catch {}
  }

  return { results: allResults, count: allResults.reduce((n, r) => n + (r.events || []).length, 0) }
}

module.exports = { scrapeCalendarRaw }
