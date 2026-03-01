const { ipcMain } = require('electron')
const { triggerManualSync, triggerManualSyncAll } = require('../services/sync-engine')
const { getDb } = require('../db')

function registerSyncIpc(win) {
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
