const { getDb } = require('../db')
const { classifyItems } = require('./llm-classifier')
const { v4: uuidv4 } = require('uuid')

const STALE_THRESHOLD_MS = 3600 * 1000 // 1 hour

let _win = null

function startSyncEngine(win) {
  _win = win
  _checkStaleness()
  setInterval(_checkStaleness, 60 * 1000)
}

function _checkStaleness() {
  const db = getDb()
  const integrations = db.prepare('SELECT * FROM integrations WHERE enabled = 1').all()
  for (const integration of integrations) {
    const isStale = !integration.last_sync || (Date.now() - integration.last_sync > STALE_THRESHOLD_MS)
    if (isStale && integration.status !== 'syncing') {
      _runIntegrationSync(integration).catch(err => {
        console.error('[sync-engine] Unhandled error for integration', integration.id, err.message)
      })
    }
  }
}

async function _runIntegrationSync(integration) {
  const db = getDb()
  const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(integration.profile_id)
  if (!profile) return

  const urls = JSON.parse(integration.urls || '[]')
  if (urls.length === 0) return

  const startedAt = Date.now()
  db.prepare("UPDATE integrations SET status = 'syncing' WHERE id = ?").run(integration.id)
  if (_win) _win.webContents.send('sync:status', { integrationId: integration.id, status: 'syncing' })

  const { launchBrowser, closeBrowser } = require('../scrapers/browser')
  let totalCount = 0

  try {
    for (const url of urls) {
      let result
      if (integration.service === 'jira') {
        const { scrapeJiraBoard } = require('../scrapers/jira.scraper')
        result = await scrapeJiraBoard(url, profile.dir_name, integration.workspace_id, integration.profile_id, integration.id)
      } else if (integration.service === 'github') {
        const { scrapeGithubRepo } = require('../scrapers/github.scraper')
        result = await scrapeGithubRepo(url, profile.dir_name, integration.workspace_id, integration.profile_id, integration.id)
      } else if (integration.service === 'calendar') {
        const { scrapeCalendar } = require('../scrapers/calendar.scraper')
        result = await scrapeCalendar(url, profile.dir_name, integration.workspace_id, integration.profile_id, integration.id)
      }
      if (result && result.count) totalCount += result.count
    }

    await classifyItems(integration.workspace_id)

    const now = Date.now()
    db.prepare("UPDATE integrations SET status = 'ok', last_sync = ?, error = NULL WHERE id = ?").run(now, integration.id)
    db.prepare(`
      INSERT INTO sync_log (id, workspace_id, integration_id, started_at, finished_at, status, item_count)
      VALUES (?, ?, ?, ?, ?, 'ok', ?)
    `).run(uuidv4(), integration.workspace_id, integration.id, startedAt, now, totalCount)

    if (_win) _win.webContents.send('sync:status', { integrationId: integration.id, status: 'ok', count: totalCount })
  } catch (err) {
    const now = Date.now()
    db.prepare("UPDATE integrations SET status = 'error', error = ? WHERE id = ?").run(err.message, integration.id)
    db.prepare(`
      INSERT INTO sync_log (id, workspace_id, integration_id, started_at, finished_at, status, error)
      VALUES (?, ?, ?, ?, ?, 'error', ?)
    `).run(uuidv4(), integration.workspace_id, integration.id, startedAt, now, err.message)

    if (_win) _win.webContents.send('sync:status', { integrationId: integration.id, status: 'error', error: err.message })

    try { await closeBrowser() } catch {}
  }
}

async function triggerManualSync(integrationId, win) {
  if (win) _win = win
  const db = getDb()
  const integration = db.prepare('SELECT * FROM integrations WHERE id = ?').get(integrationId)
  if (!integration) throw new Error('Integration not found: ' + integrationId)
  await _runIntegrationSync(integration)
}

async function triggerManualSyncAll(workspaceId, win) {
  if (win) _win = win
  const db = getDb()
  const integrations = db.prepare('SELECT * FROM integrations WHERE workspace_id = ? AND enabled = 1').all(workspaceId)
  for (const integration of integrations) {
    await _runIntegrationSync(integration).catch(err => {
      console.error('[sync-engine] Error syncing integration', integration.id, err.message)
    })
  }
}

module.exports = { startSyncEngine, triggerManualSync, triggerManualSyncAll }
