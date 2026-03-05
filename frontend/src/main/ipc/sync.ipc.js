const { ipcMain } = require('electron')
const { triggerManualSync, triggerManualSyncAll } = require('../services/sync-engine')
const { getDb } = require('../db')

function registerSyncIpc(win) {
  // Scrape without touching the DB — for verification during onboarding
  ipcMain.handle('scrape:run', async (_, opts) => {
    const { profileDirName, service, urls } = opts || {}
    console.log('[scrape:run] received', { profileDirName, service, urlCount: (urls || []).length })

    if (!service || !urls || urls.length === 0) {
      return { results: [], count: 0, error: 'Missing service or urls' }
    }

    try {
      let result
      if (service === 'jira') {
        const { scrapeJiraBoardRaw } = require('../scrapers/jira.scraper')
        result = await scrapeJiraBoardRaw(urls, profileDirName)
      } else if (service === 'github') {
        const { scrapeGithubRepoRaw } = require('../scrapers/github.scraper')
        result = await scrapeGithubRepoRaw(urls, profileDirName)
      } else if (service === 'calendar') {
        const { scrapeCalendarRaw } = require('../scrapers/calendar.scraper')
        result = await scrapeCalendarRaw(urls, profileDirName)
      } else {
        return { results: [], count: 0, error: 'Unknown service: ' + service }
      }
      console.log('[scrape:run] done', service, '— count:', result.count)
      return result
    } catch (err) {
      console.error('[scrape:run] error', service, err.message)
      return { results: [], count: 0, error: err.message }
    }
  })

  ipcMain.handle('sync:start', async (_, integrationIdOrWsName, serviceId) => {
    // Support both direct integrationId and wsName:serviceId from loading.js compat
    if (serviceId !== undefined) {
      // Called as fetchService(wsName, serviceId) from loading.js
      const db = getDb()
      const ws = db.prepare('SELECT id FROM workspaces WHERE name = ?').get(integrationIdOrWsName)
      if (!ws) return { count: 0, error: 'Workspace not found' }
      const integration = db.prepare(
        "SELECT * FROM integrations WHERE workspace_id = ? AND service = ? AND enabled = 1 LIMIT 1"
      ).get(ws.id, serviceId)
      if (!integration) return { count: 0, error: 'Integration not found' }
      await triggerManualSync(integration.id, win)
      return { count: 0 }
    } else {
      await triggerManualSync(integrationIdOrWsName, win)
      return { ok: true }
    }
  })

  ipcMain.handle('sync:start-all', async (_, workspaceId) => {
    await triggerManualSyncAll(workspaceId, win)
    return { ok: true }
  })

  ipcMain.handle('sync:get-status', () => {
    const db = getDb()
    const integrations = db.prepare('SELECT id, workspace_id, service, status, last_sync, error FROM integrations').all()
    return integrations
  })
}

module.exports = { registerSyncIpc }
