const { ipcMain } = require('electron')
const { scanProfiles, saveProfiles } = require('../services/profile-scanner')
const { getDb } = require('../db')

function registerProfilesIpc() {
  ipcMain.handle('profiles:scan', async () => {
    return scanProfiles()
  })

  ipcMain.handle('profiles:get', () => {
    const db = getDb()
    return db.prepare('SELECT * FROM profiles WHERE is_active = 1').all()
  })

  ipcMain.handle('profiles:save', (_, profiles) => {
    saveProfiles(profiles)
    return { ok: true }
  })
}

module.exports = { registerProfilesIpc }
