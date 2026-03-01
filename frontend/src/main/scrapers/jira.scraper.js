const { launchBrowser, navigateTo, fetchInPage, closeBrowser } = require('./browser')
const { getDb } = require('../db')
const { v4: uuidv4 } = require('uuid')

function parseJiraBoardUrl(boardUrl) {
  const url = new URL(boardUrl)
  const baseUrl = url.origin
  // Extract projectKey from path like /jira/software/projects/ALPHA/boards/12
  const match = url.pathname.match(/\/projects\/([A-Z0-9]+)/)
  const projectKey = match ? match[1] : null
  return { baseUrl, projectKey }
}

function buildJql(projectKey) {
  if (projectKey) {
    return `assignee = currentUser() AND project = ${projectKey} AND updated >= -30d`
  }
  return `assignee = currentUser() AND updated >= -30d`
}

async function scrapeJiraBoard(boardUrl, profileDirName, workspaceId, profileId, integrationId) {
  const { baseUrl, projectKey } = parseJiraBoardUrl(boardUrl)

  await launchBrowser(profileDirName)
  await navigateTo(baseUrl)

  // Verify we're authenticated
  const myselfResp = await fetchInPage(`${baseUrl}/rest/api/3/myself`)
  if (!myselfResp.ok) {
    await closeBrowser()
    return { count: 0, error: 'Not authenticated to Jira — please sign in via browser' }
  }

  const jql = encodeURIComponent(buildJql(projectKey))
  const db = getDb()
  let totalFetched = 0
  let startAt = 0
  const maxResults = 50

  while (true) {
    const resp = await fetchInPage(
      `${baseUrl}/rest/api/3/search?jql=${jql}&maxResults=${maxResults}&startAt=${startAt}&expand=changelog`
    )
    if (!resp.ok) break

    const data = JSON.parse(resp.body)
    const issues = data.issues || []

    const insertItem = db.prepare(`
      INSERT OR REPLACE INTO jira_items
        (id, workspace_id, profile_id, integration_id, board_url, title, status, priority, assignee, sprint, due_date, url, description, synced_at, raw_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertActivity = db.prepare(`
      INSERT OR REPLACE INTO jira_activity (id, jira_id, author, field, from_val, to_val, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    db.transaction(() => {
      for (const issue of issues) {
        const fields = issue.fields || {}
        const sprintField = fields.sprint || (fields.customfield_10020 && fields.customfield_10020[0])

        insertItem.run(
          issue.key,
          workspaceId,
          profileId,
          integrationId,
          boardUrl,
          fields.summary || '',
          fields.status?.name || '',
          fields.priority?.name || '',
          fields.assignee?.displayName || '',
          sprintField?.name || null,
          fields.duedate || null,
          `${baseUrl}/browse/${issue.key}`,
          fields.description ? JSON.stringify(fields.description) : null,
          Date.now(),
          JSON.stringify(issue)
        )

        // changelog / activity
        const histories = issue.changelog?.histories || []
        for (const hist of histories) {
          for (const item of (hist.items || [])) {
            insertActivity.run(
              uuidv4(),
              issue.key,
              hist.author?.displayName || '',
              item.field || '',
              item.fromString || null,
              item.toString || null,
              hist.created || null
            )
          }
        }
      }
    })()

    totalFetched += issues.length

    if (startAt + maxResults >= data.total) break
    startAt += maxResults
  }

  await closeBrowser()
  return { count: totalFetched }
}

module.exports = { scrapeJiraBoard }
