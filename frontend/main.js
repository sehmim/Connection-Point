const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const { init } = require('./src/main')

let win

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 10 },
    backgroundColor: '#0f0f0f',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  win.loadFile('renderer/index.html')
  win.webContents.on('did-finish-load', () => init(win))
}

ipcMain.on('open-external', (_, url) => shell.openExternal(url))
ipcMain.on('window-minimize', () => win && win.minimize())
ipcMain.on('window-maximize', () => {
  if (!win) return
  win.isMaximized() ? win.unmaximize() : win.maximize()
})
ipcMain.on('window-close', () => win && win.close())

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
