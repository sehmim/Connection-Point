const fs = require('fs')
const path = require('path')
const os = require('os')
const { v4: uuidv4 } = require('uuid')
const { getDb } = require('../db')

const COLOR_PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'
]

function getBrowserPaths() {
  const home = os.homedir()
  const platform = process.platform

  const browsers = []

  if (platform === 'darwin') {
    browsers.push(
      { browser: 'chrome', path: path.join(home, 'Library/Application Support/Google/Chrome') },
      { browser: 'brave',  path: path.join(home, 'Library/Application Support/BraveSoftware/Brave-Browser') },
      { browser: 'arc',    path: path.join(home, 'Library/Application Support/Arc/User Data') }
    )
  } else if (platform === 'linux') {
    browsers.push(
      { browser: 'chrome', path: path.join(home, '.config/google-chrome') }
    )
  } else if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData/Local')
    browsers.push(
      { browser: 'chrome', path: path.join(localAppData, 'Google/Chrome/User Data') }
    )
  }

  return browsers
}

function readProfileInfo(profileDir) {
  try {
    const prefsPath = path.join(profileDir, 'Preferences')
    if (!fs.existsSync(prefsPath)) return null
    const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'))
    const accountInfo = prefs.account_info && prefs.account_info[0]
    const name = accountInfo?.full_name || prefs.profile?.name || path.basename(profileDir)
    const email = accountInfo?.email || ''
    return { name, email }
  } catch {
    return { name: path.basename(profileDir), email: '' }
  }
}

function scanProfiles() {
  const results = []
  const browserPaths = getBrowserPaths()
  let colorIndex = 0

  for (const { browser, path: userDataPath } of browserPaths) {
    if (!fs.existsSync(userDataPath)) continue

    let entries
    try {
      entries = fs.readdirSync(userDataPath)
    } catch {
      continue
    }

    for (const entry of entries) {
      if (entry !== 'Default' && !/^Profile \d+$/.test(entry)) continue
      const profileDir = path.join(userDataPath, entry)
      let stat
      try { stat = fs.statSync(profileDir) } catch { continue }
      if (!stat.isDirectory()) continue

      const info = readProfileInfo(profileDir)
      if (!info) continue

      const color = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length]
      colorIndex++

      results.push({
        id: uuidv4(),
        browser,
        dirName: entry,
        name: info.name,
        email: info.email,
        avatarText: info.name.charAt(0).toUpperCase(),
        color
      })
    }
  }

  return results
}

function saveProfiles(profiles) {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO profiles (id, browser, dir_name, name, email, avatar_text, color, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
  `)
  const insertMany = db.transaction((profiles) => {
    for (const p of profiles) {
      stmt.run(p.id, p.browser, p.dirName, p.name, p.email, p.avatarText, p.color, Date.now())
    }
  })
  insertMany(profiles)
}

module.exports = { scanProfiles, saveProfiles }
