const { ipcMain } = require('electron')
const { getDb } = require('../db')
const store = require('../services/store')

function registerSettingsIpc() {
  ipcMain.handle('settings:get', () => {
    return {
      llmProvider: store.get('llmProvider'),
      llmModel: store.get('llmModel'),
      theme: store.get('theme')
    }
  })

  ipcMain.handle('settings:set', (_, key, value) => {
    store.set(key, value)
    const db = getDb()
    db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)")
      .run(key, JSON.stringify(value), Date.now())
    return { ok: true }
  })
}

module.exports = { registerSettingsIpc }
