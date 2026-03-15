const { initDb } = require('./db')
const { startSyncEngine } = require('./services/sync-engine')
const { registerProfilesIpc } = require('./ipc/profiles.ipc')
const { registerSyncIpc } = require('./ipc/sync.ipc')
const { registerDataIpc } = require('./ipc/data.ipc')
const { registerLlmIpc } = require('./ipc/llm.ipc')
const { registerSettingsIpc } = require('./ipc/settings.ipc')
const { registerGithubAuthIpc } = require('./ipc/github-auth.ipc')
const { registerJiraAuthIpc } = require('./ipc/jira-auth.ipc')
const { registerCalendarAuthIpc } = require('./ipc/calendar-auth.ipc')

function init(win) {
  initDb()
  registerGithubAuthIpc()
  registerJiraAuthIpc()
  registerCalendarAuthIpc()
  registerProfilesIpc()
  registerSyncIpc(win)
  registerDataIpc()
  registerLlmIpc()
  registerSettingsIpc()
  startSyncEngine(win)
}

module.exports = { init }
