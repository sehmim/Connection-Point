const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Platform info
  platform: process.platform,

  // Window controls
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),

  // Data stubs — BACKEND: replace with real IPC calls
  getWorkspaces: () => Promise.resolve([]),
  getItems: (filters) => Promise.resolve([]),
  getChromeProfiles: () => Promise.resolve([
    { name: 'Work', avatar: 'W', path: 'Profile 1' },
    { name: 'Personal', avatar: 'P', path: 'Default' },
    { name: 'Client A', avatar: 'C', path: 'Profile 2' }
  ]),
  sendChat: (message) => Promise.resolve({ text: 'Mock response' })
})
