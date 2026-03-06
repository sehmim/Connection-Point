const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Platform info
  platform: process.platform,

  // Window controls
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),

  // External links
  openExternal: (url) => ipcRenderer.send('open-external', url),

  // Profiles
  scanProfiles: () => ipcRenderer.invoke('profiles:scan'),
  getProfiles: () => ipcRenderer.invoke('profiles:get'),
  saveProfiles: (profiles) => ipcRenderer.invoke('profiles:save', profiles),

  // Workspaces
  getWorkspaces: () => ipcRenderer.invoke('data:get-workspaces'),
  saveWorkspace: (config) => ipcRenderer.invoke('data:save-workspace', config),

  // Data queries
  getDashboard: (workspaceId) => ipcRenderer.invoke('data:dashboard', workspaceId),
  getJiraItems: (filters) => ipcRenderer.invoke('data:jira', filters),
  getJiraDetail: (id) => ipcRenderer.invoke('data:jira-detail', id),
  getGithubItems: (filters) => ipcRenderer.invoke('data:github', filters),
  getGithubDetail: (id) => ipcRenderer.invoke('data:github-detail', id),
  getCalendarEvents: (range) => ipcRenderer.invoke('data:calendar', range),

  // Scrape — DOM-only, no DB writes, for verification
  // { profileDirName, service, urls } → { results, count, error? }
  scrapeRaw: (opts) => ipcRenderer.invoke('scrape:run', opts),

  // Live sync status push events
  onSyncStatus: (cb) => ipcRenderer.on('sync:status', (_, data) => cb(data)),

  // LLM
  setLlmKey: (key) => ipcRenderer.invoke('llm:set-key', key),
  getLlmKeyStatus: () => ipcRenderer.invoke('llm:get-key-status'),
  setLlmProvider: (provider, model) => ipcRenderer.invoke('llm:set-provider', provider, model),
  testLlmKey: () => ipcRenderer.invoke('llm:test-key'),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),

  // GitHub source auth — opens persisted session popup per hostname
  connectGithubSource: (url) => ipcRenderer.invoke('connect-github-source', url),
  scrapeGithubIssues: (repoUrl) => ipcRenderer.invoke('scrape-github-issues', repoUrl),
  githubSaveScrape: (data) => ipcRenderer.invoke('github:save-scrape', data),
  githubGetData: () => ipcRenderer.invoke('github:get-data'),
  githubDeleteRepo: (url) => ipcRenderer.invoke('github:delete-repo', url),
  githubScrapeDetail: (opts) => ipcRenderer.invoke('github:scrape-detail', opts),
  githubScrapeNotifications: (repoUrls) => ipcRenderer.invoke('github:scrape-notifications', repoUrls),

  // Jira source auth — opens persisted session popup per hostname
  connectJiraSource: (url) => ipcRenderer.invoke('connect-jira-source', url),
  scrapeJiraBoard: (boardUrl) => ipcRenderer.invoke('scrape-jira-board', boardUrl),
  jiraSaveScrape: (data) => ipcRenderer.invoke('jira:save-scrape', data),
  jiraGetData: () => ipcRenderer.invoke('jira:get-data'),
  jiraDeleteBoard: (url) => ipcRenderer.invoke('jira:delete-board', url),
  jiraScrapeDetail: (opts) => ipcRenderer.invoke('jira:scrape-detail', opts),

  // Legacy stub (getItems) — keep for compatibility
  getItems: (filters) => ipcRenderer.invoke('data:jira', filters)
})
