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

  // Sync
  startSync: (integrationId) => ipcRenderer.invoke('sync:start', integrationId),
  startSyncAll: (workspaceId) => ipcRenderer.invoke('sync:start-all', workspaceId),
  getSyncStatus: () => ipcRenderer.invoke('sync:get-status'),
  // loading.js compat — fetchService(wsName, serviceId)
  fetchService: (wsName, serviceId) => ipcRenderer.invoke('sync:start', wsName, serviceId),

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

  // Legacy stub (getItems) — keep for compatibility
  getItems: (filters) => ipcRenderer.invoke('data:jira', filters)
})
