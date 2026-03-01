const { launchBrowser, navigateTo, fetchInPage, closeBrowser } = require('./browser')
const { getDb } = require('../db')
const { v4: uuidv4 } = require('uuid')

function detectCalendarSource(calendarUrl) {
  if (calendarUrl.includes('calendar.google.com')) return 'gcal'
  if (calendarUrl.includes('outlook.office.com')) return 'outlook'
  return 'unknown'
}

function extractCid(calendarUrl) {
  try {
    const url = new URL(calendarUrl)
    return url.searchParams.get('cid') || null
  } catch {
    return null
  }
}

async function scrapeCalendar(calendarUrl, profileDirName, workspaceId, profileId, integrationId) {
  const source = detectCalendarSource(calendarUrl)

  await launchBrowser(profileDirName)
  await navigateTo(calendarUrl)

  const db = getDb()
  let totalFetched = 0

  const insertEvent = db.prepare(`
    INSERT OR REPLACE INTO calendar_events
      (id, workspace_id, profile_id, integration_id, calendar_url, title, start, end, all_day, source, account, color, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  if (source === 'gcal') {
    const cid = extractCid(calendarUrl)
    const calendarId = cid ? encodeURIComponent(cid) : 'primary'

    const now = new Date()
    const timeMin = now.toISOString()
    const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=100`

    const resp = await fetchInPage(apiUrl)
    if (resp.ok) {
      const data = JSON.parse(resp.body)
      const events = data.items || []

      db.transaction(() => {
        for (const event of events) {
          const allDay = !event.start?.dateTime
          const start = event.start?.dateTime || event.start?.date || null
          const end = event.end?.dateTime || event.end?.date || null
          insertEvent.run(
            event.id || uuidv4(),
            workspaceId,
            profileId,
            integrationId,
            calendarUrl,
            event.summary || '(No title)',
            start,
            end,
            allDay ? 1 : 0,
            'gcal',
            event.organizer?.email || null,
            event.colorId || null,
            Date.now()
          )
        }
      })()

      totalFetched = events.length
    }
  } else if (source === 'outlook') {
    // Try Microsoft Graph API — available if user is signed into outlook.office.com
    const now = new Date()
    const startDateTime = now.toISOString()
    const endDateTime = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const resp = await fetchInPage(
      `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$top=100&$orderby=start/dateTime`,
      { headers: { 'Content-Type': 'application/json' } }
    )
    if (resp.ok) {
      const data = JSON.parse(resp.body)
      const events = data.value || []

      db.transaction(() => {
        for (const event of events) {
          const allDay = event.isAllDay ? 1 : 0
          insertEvent.run(
            event.id || uuidv4(),
            workspaceId,
            profileId,
            integrationId,
            calendarUrl,
            event.subject || '(No title)',
            event.start?.dateTime || null,
            event.end?.dateTime || null,
            allDay,
            'outlook',
            event.organizer?.emailAddress?.address || null,
            event.categories?.[0] || null,
            Date.now()
          )
        }
      })()

      totalFetched = events.length
    }
  }

  await closeBrowser()
  return { count: totalFetched }
}

module.exports = { scrapeCalendar }
