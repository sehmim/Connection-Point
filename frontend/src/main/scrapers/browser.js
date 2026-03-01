const chromeLauncher = require('chrome-launcher')
const CDP = require('chrome-remote-interface')

let chromeInstance = null
let cdpClient = null

const STEALTH_SCRIPT = `
  Object.defineProperty(navigator, 'webdriver', { get: () => false })
  Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] })
  window.chrome = { runtime: {} }
`

function timeout(ms, msg) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(msg || 'Timeout')), ms))
}

async function launchBrowser(profileDirName) {
  if (cdpClient) return // already open

  const flags = [
    '--headless=new',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
    '--no-sandbox',
    `--profile-directory=${profileDirName}`,
    '--remote-debugging-port=9222'
  ]

  try {
    chromeInstance = await chromeLauncher.launch({
      chromeFlags: flags,
      port: 9222
    })
  } catch (err) {
    if (err.code === 'EADDRINUSE' || err.message?.includes('EADDRINUSE')) {
      // Chrome already running — attach to existing CDP session
      chromeInstance = null
    } else {
      throw err
    }
  }

  cdpClient = await CDP({ port: 9222 })

  const { Page, Runtime, Network, Fetch } = cdpClient
  await Promise.all([Page.enable(), Runtime.enable(), Network.enable(), Fetch.enable()])
  await Page.addScriptToEvaluateOnNewDocument({ source: STEALTH_SCRIPT })
}

async function navigateTo(url) {
  if (!cdpClient) throw new Error('Browser not launched')
  const { Page } = cdpClient

  await Promise.race([
    (async () => {
      await Page.navigate({ url })
      await Page.loadEventFired()
    })(),
    timeout(30000, 'Navigation timeout: ' + url)
  ])
}

async function fetchInPage(url, options = {}) {
  if (!cdpClient) throw new Error('Browser not launched')
  const { Runtime } = cdpClient

  const optionsJson = JSON.stringify({
    credentials: 'include',
    ...options
  })

  const expression = `
    (async () => {
      const r = await fetch(${JSON.stringify(url)}, ${optionsJson})
      const body = await r.text()
      return JSON.stringify({ ok: r.ok, status: r.status, body })
    })()
  `

  const result = await Runtime.evaluate({ expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) {
    throw new Error('fetchInPage error: ' + result.exceptionDetails.text)
  }
  return JSON.parse(result.result.value)
}

async function closeBrowser() {
  if (cdpClient) {
    try { await cdpClient.close() } catch {}
    cdpClient = null
  }
  if (chromeInstance) {
    try { await chromeInstance.kill() } catch {}
    chromeInstance = null
  }
}

module.exports = { launchBrowser, navigateTo, fetchInPage, closeBrowser }
