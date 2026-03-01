const { ipcMain } = require('electron')
const { getDb } = require('../db')
const { v4: uuidv4 } = require('uuid')

function registerDataIpc() {
  ipcMain.handle('data:get-workspaces', () => {
    const db = getDb()
    const workspaces = db.prepare('SELECT * FROM workspaces').all()
    return workspaces.map(ws => {
      const integrations = db.prepare(`
        SELECT i.*, p.dir_name, p.name as profile_name, p.email as profile_email
        FROM integrations i
        JOIN profiles p ON i.profile_id = p.id
        WHERE i.workspace_id = ?
      `).all(ws.id)
      return {
        id: ws.id,
        name: ws.name,
        color: ws.color,
        jiraEnabled: integrations.some(i => i.service === 'jira' && i.enabled),
        githubEnabled: integrations.some(i => i.service === 'github' && i.enabled),
        gcalEnabled: integrations.some(i => i.service === 'calendar' && i.enabled),
        integrations
      }
    })
  })

  ipcMain.handle('data:save-workspace', async (_, config) => {
    const { safeStorage } = require('electron')
    const db = getDb()
    const wsId = uuidv4()

    db.transaction(() => {
      // 1. Insert workspace
      db.prepare('INSERT OR REPLACE INTO workspaces (id, name, color, llm_model, created_at) VALUES (?,?,?,?,?)')
        .run(wsId, config.name, config.color, config.llmModelName || null, Date.now())

      // 2. Save API key via safeStorage if provided
      if (config.llmApiKey) {
        const val = safeStorage.isEncryptionAvailable()
          ? safeStorage.encryptString(config.llmApiKey).toString('base64')
          : Buffer.from(config.llmApiKey).toString('base64')
        db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('llm_api_key', ?, ?)")
          .run(val, Date.now())
      }

      // 3. Upsert profiles and insert integrations
      for (const integration of (config.integrations || [])) {
        const profileRow = db.prepare('SELECT id FROM profiles WHERE dir_name = ?').get(integration.profilePath)
        const profileId = profileRow?.id || uuidv4()
        if (!profileRow) {
          db.prepare(`
            INSERT INTO profiles (id, browser, dir_name, name, email, avatar_text, color, is_active, created_at)
            VALUES (?,?,?,?,?,?,?,1,?)
          `).run(
            profileId,
            'chrome',
            integration.profilePath,
            integration.profileName || integration.profilePath,
            integration.profileEmail || '',
            (integration.profileName || integration.profilePath).charAt(0).toUpperCase(),
            '#6366f1',
            Date.now()
          )
        }

        db.prepare(`
          INSERT OR REPLACE INTO integrations (id, workspace_id, profile_id, service, urls, enabled, last_sync, status)
          VALUES (?,?,?,?,?,1,NULL,'never')
        `).run(uuidv4(), wsId, profileId, integration.service, JSON.stringify(integration.urls || []))
      }

      // 4. Insert custom links
      for (const link of (config.customLinks || [])) {
        if (!link.url || !link.url.trim()) continue
        db.prepare(`
          INSERT INTO custom_links (id, workspace_id, url, label, description, created_at)
          VALUES (?,?,?,?,?,?)
        `).run(uuidv4(), wsId, link.url.trim(), link.label || '', link.description || '', Date.now())
      }
    })()

    return { ok: true, workspaceId: wsId }
  })

  ipcMain.handle('data:dashboard', (_, workspaceId) => {
    const db = getDb()
    const wsId = workspaceId || (db.prepare('SELECT id FROM workspaces ORDER BY created_at DESC LIMIT 1').get()?.id)
    if (!wsId) return { meetings: [], waitingForYou: [], overdue: [], allItems: [] }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const meetings = db.prepare(`
      SELECT * FROM calendar_events
      WHERE workspace_id = ?
        AND start >= ? AND start <= ?
      ORDER BY start
    `).all(wsId, todayStart.toISOString(), todayEnd.toISOString())

    const waitingForYou = db.prepare(`
      SELECT * FROM work_items
      WHERE workspace_id = ? AND category = 'waiting_for_you'
      ORDER BY classified_at DESC LIMIT 20
    `).all(wsId)

    const overdue = db.prepare(`
      SELECT * FROM work_items
      WHERE workspace_id = ? AND category = 'overdue'
      ORDER BY classified_at DESC LIMIT 20
    `).all(wsId)

    const jiraItems = db.prepare('SELECT * FROM jira_items WHERE workspace_id = ? ORDER BY synced_at DESC').all(wsId)
    const githubItems = db.prepare('SELECT * FROM github_items WHERE workspace_id = ? ORDER BY synced_at DESC').all(wsId)

    return {
      meetings,
      waitingForYou,
      overdue,
      allItems: [..._mapJiraItems(jiraItems), ..._mapGithubItems(githubItems)]
    }
  })

  ipcMain.handle('data:jira', (_, filters = {}) => {
    const db = getDb()
    const wsId = filters.workspaceId || (db.prepare('SELECT id FROM workspaces ORDER BY created_at DESC LIMIT 1').get()?.id)
    if (!wsId) return []
    const items = db.prepare('SELECT * FROM jira_items WHERE workspace_id = ? ORDER BY synced_at DESC').all(wsId)
    return _mapJiraItems(items)
  })

  ipcMain.handle('data:jira-detail', (_, id) => {
    const db = getDb()
    const item = db.prepare('SELECT * FROM jira_items WHERE id = ?').get(id)
    if (!item) return null
    const activity = db.prepare('SELECT * FROM jira_activity WHERE jira_id = ? ORDER BY created_at DESC').all(id)
    return { ..._mapJiraItem(item), activity }
  })

  ipcMain.handle('data:github', (_, filters = {}) => {
    const db = getDb()
    const wsId = filters.workspaceId || (db.prepare('SELECT id FROM workspaces ORDER BY created_at DESC LIMIT 1').get()?.id)
    if (!wsId) return []
    const items = db.prepare('SELECT * FROM github_items WHERE workspace_id = ? ORDER BY synced_at DESC').all(wsId)
    return _mapGithubItems(items)
  })

  ipcMain.handle('data:github-detail', (_, id) => {
    const db = getDb()
    const item = db.prepare('SELECT * FROM github_items WHERE id = ?').get(id)
    if (!item) return null
    const reviews = db.prepare('SELECT * FROM github_reviews WHERE github_id = ?').all(id)
    const files = db.prepare('SELECT * FROM github_changed_files WHERE github_id = ?').all(id)
    return { ..._mapGithubItem(item), reviews, files }
  })

  ipcMain.handle('data:calendar', (_, range = {}) => {
    const db = getDb()
    const wsId = range.workspaceId || (db.prepare('SELECT id FROM workspaces ORDER BY created_at DESC LIMIT 1').get()?.id)
    if (!wsId) return []
    const events = db.prepare('SELECT * FROM calendar_events WHERE workspace_id = ? ORDER BY start ASC').all(wsId)
    return events
  })
}

function _mapJiraItem(item) {
  return {
    id: item.id,
    title: item.title,
    status: item.status,
    priority: item.priority,
    assignee: item.assignee,
    sprint: item.sprint,
    dueDate: item.due_date,
    url: item.url,
    description: item.description,
    syncedAt: item.synced_at,
    source: 'jira',
    profile: item.profile_id
  }
}

function _mapJiraItems(items) {
  return items.map(_mapJiraItem)
}

function _mapGithubItem(item) {
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    status: item.status,
    repo: item.repo,
    author: item.author,
    updatedAt: item.updated_at,
    url: item.url,
    body: item.body,
    syncedAt: item.synced_at,
    source: 'github',
    profile: item.profile_id
  }
}

function _mapGithubItems(items) {
  return items.map(_mapGithubItem)
}

module.exports = { registerDataIpc }
