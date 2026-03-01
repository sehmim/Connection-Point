const { ipcMain, safeStorage } = require('electron')
const { getDb } = require('../db')
const store = require('../services/store')

function _decryptApiKey() {
  const db = getDb()
  const row = db.prepare("SELECT value FROM settings WHERE key = 'llm_api_key'").get()
  if (!row) return null
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.decryptString(Buffer.from(row.value, 'base64'))
  }
  return Buffer.from(row.value, 'base64').toString('utf8')
}

function registerLlmIpc() {
  ipcMain.handle('llm:set-key', (_, key) => {
    const db = getDb()
    const val = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(key).toString('base64')
      : Buffer.from(key).toString('base64')
    db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('llm_api_key', ?, ?)")
      .run(val, Date.now())
    return { ok: true }
  })

  ipcMain.handle('llm:get-key-status', () => {
    const db = getDb()
    const row = db.prepare("SELECT value FROM settings WHERE key = 'llm_api_key'").get()
    return { isSet: !!row }
  })

  ipcMain.handle('llm:set-provider', (_, provider, model) => {
    store.set('llmProvider', provider)
    store.set('llmModel', model)
    return { ok: true }
  })

  ipcMain.handle('llm:test-key', async () => {
    const key = _decryptApiKey()
    if (!key) return { ok: false, error: 'No API key set' }
    const { OpenAI } = require('openai')
    const client = new OpenAI({ apiKey: key })
    await client.chat.completions.create({
      model: store.get('llmModel') || 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 5
    })
    return { ok: true }
  })
}

module.exports = { registerLlmIpc }
