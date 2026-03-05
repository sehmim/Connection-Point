// chrome-launcher is ESM-only — must use dynamic import()
const CDP = require('chrome-remote-interface')

const STEALTH_SCRIPT = `
  Object.defineProperty(navigator, 'webdriver', { get: () => false })
  Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] })
  window.chrome = { runtime: {} }
`

// Track which ports are in use so parallel scrapes get different ports
const _usedPorts = new Set()

function _allocatePort() {
  for (let port = 9222; port < 9322; port++) {
    if (!_usedPorts.has(port)) {
      _usedPorts.add(port)
      return port
    }
  }
  throw new Error('No free CDP ports available (9222–9321)')
}

function timeout(ms, msg) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(msg || 'Timeout')), ms))
}

// ── Browser session ────────────────────────────────────────────────────────────
// Returns a session object { navigateTo, evaluateInPage, close }.
// Each call to createSession() gets its own Chrome instance on its own port.
async function createSession(profileDirName) {
  const { launch } = await import('chrome-launcher')
  const port = _allocatePort()

  let chromeInstance = null
  let cdpClient = null

  const flags = [
    '--headless=new',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
    '--no-sandbox',
    '--disable-extensions',
    '--disable-notifications',
    '--disable-infobars',
    '--window-position=-10000,-10000',
    '--window-size=1280,800',
    `--profile-directory=${profileDirName}`,
    `--remote-debugging-port=${port}`
  ]

  try {
    chromeInstance = await launch({
      chromeFlags: flags,
      port,
      logLevel: 'silent',
      handleSIGINT: false,
      startingUrl: 'about:blank'
    })
  } catch (err) {
    _usedPorts.delete(port)
    throw err
  }

  try {
    cdpClient = await CDP({ port })
    const { Page, Runtime } = cdpClient
    await Promise.all([Page.enable(), Runtime.enable()])
    await Page.addScriptToEvaluateOnNewDocument({ source: STEALTH_SCRIPT })
  } catch (err) {
    // Clean up chrome if CDP connect fails
    try { await chromeInstance.kill() } catch {}
    _usedPorts.delete(port)
    throw err
  }

  async function navigateTo(url) {
    const { Page } = cdpClient
    await Promise.race([
      (async () => {
        await Page.navigate({ url })
        await Page.loadEventFired()
      })(),
      timeout(30000, 'Navigation timeout: ' + url)
    ])
  }

  async function evaluateInPage(expression, opts) {
    const { Runtime } = cdpClient
    const options = Object.assign({ returnByValue: true }, opts || {})
    const result = await Runtime.evaluate({ expression, ...options })
    if (result.exceptionDetails) {
      throw new Error('evaluateInPage error: ' + (result.exceptionDetails.text || JSON.stringify(result.exceptionDetails)))
    }
    return result.result.value
  }

  async function close() {
    if (cdpClient) {
      try { await cdpClient.close() } catch {}
      cdpClient = null
    }
    if (chromeInstance) {
      try { await chromeInstance.kill() } catch {}
      chromeInstance = null
    }
    _usedPorts.delete(port)
  }

  return { navigateTo, evaluateInPage, close }
}

module.exports = { createSession }
