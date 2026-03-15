const { ipcMain } = require('electron')
const { getDb } = require('../db')
const store = require('../services/store')

function registerSettingsIpc() {
  ipcMain.removeHandler('settings:get')
  ipcMain.handle('settings:get', () => {
    return {
      llmProvider: store.get('llmProvider'),
      llmModel: store.get('llmModel'),
      theme: store.get('theme')
    }
  })

  ipcMain.removeHandler('settings:set')
  ipcMain.handle('settings:set', (_, key, value) => {
    store.set(key, value)
    const db = getDb()
    db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)")
      .run(key, JSON.stringify(value), Date.now())
    return { ok: true }
  })

  ipcMain.removeHandler('session:list-partitions')
  ipcMain.handle('session:list-partitions', () => {
    const db = getDb()
    const partitions = []

    try {
      const repos = db.prepare('SELECT url, hostname, label FROM github_repos ORDER BY added_at ASC').all()
      for (const r of repos) {
        const partition = 'persist:' + r.hostname
        let entry = partitions.find(p => p.partition === partition)
        if (!entry) { entry = { partition, type: 'github', label: r.hostname, sources: [] }; partitions.push(entry) }
        entry.sources.push({ label: r.label, url: r.url })
      }
    } catch (_) {}

    try {
      const boards = db.prepare('SELECT url, hostname, label FROM jira_boards ORDER BY added_at ASC').all()
      for (const b of boards) {
        const partition = 'persist:' + b.hostname
        let entry = partitions.find(p => p.partition === partition)
        if (!entry) { entry = { partition, type: 'jira', label: b.hostname, sources: [] }; partitions.push(entry) }
        entry.sources.push({ label: b.label, url: b.url })
      }
    } catch (_) {}

    try {
      const cals = db.prepare('SELECT email, label, partition FROM calendar_sources ORDER BY added_at ASC').all()
      for (const c of cals) {
        let entry = partitions.find(p => p.partition === c.partition)
        if (!entry) { entry = { partition: c.partition, type: 'calendar', label: c.label || c.email, sources: [] }; partitions.push(entry) }
        entry.sources.push({ label: c.label || c.email, url: c.email })
      }
    } catch (_) {}

    return { partitions }
  })
}

module.exports = { registerSettingsIpc }
