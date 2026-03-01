const { getDb } = require('../db')
const store = require('./store')
const { v4: uuidv4 } = require('uuid')

function _decryptApiKey() {
  const { safeStorage } = require('electron')
  const db = getDb()
  const row = db.prepare("SELECT value FROM settings WHERE key = 'llm_api_key'").get()
  if (!row) return null
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.decryptString(Buffer.from(row.value, 'base64'))
  }
  return Buffer.from(row.value, 'base64').toString('utf8')
}

async function classifyItems(workspaceId) {
  const db = getDb()

  const apiKey = _decryptApiKey()
  if (!apiKey) {
    console.warn('[llm-classifier] No API key set — skipping classification')
    return
  }

  const items = db.prepare(`
    SELECT 'jira' as source, id, title, status, priority, due_date, assignee, workspace_id
    FROM jira_items
    WHERE workspace_id = ?
      AND synced_at > COALESCE(
        (SELECT classified_at FROM work_items WHERE source_id = jira_items.id AND source = 'jira' LIMIT 1), 0
      )
    UNION ALL
    SELECT 'github' as source, CAST(id AS TEXT) as id, title, status, null as priority, null as due_date, null as assignee, workspace_id
    FROM github_items
    WHERE workspace_id = ?
      AND synced_at > COALESCE(
        (SELECT classified_at FROM work_items WHERE source_id = CAST(github_items.id AS TEXT) AND source = 'github' LIMIT 1), 0
      )
  `).all(workspaceId, workspaceId)

  if (items.length === 0) return

  const model = store.get('llmModel') || 'gpt-4o-mini'
  const { OpenAI } = require('openai')
  const client = new OpenAI({ apiKey })

  const inputPayload = items.map(i => ({
    id: i.id,
    source: i.source,
    title: i.title,
    status: i.status,
    priority: i.priority,
    due_date: i.due_date,
    assignee: i.assignee
  }))

  let results
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a work prioritization engine. For each item classify into: overdue, waiting_for_you, due_this_week, in_progress. Assign urgency_score 0.0-1.0. Write a 1-line summary. For waiting_for_you, write waiting_reason. Respond ONLY as JSON array: [{id, source, category, urgency_score, summary, waiting_reason}]'
        },
        {
          role: 'user',
          content: JSON.stringify(inputPayload)
        }
      ]
    })

    results = JSON.parse(response.choices[0].message.content)
  } catch (err) {
    console.error('[llm-classifier] Classification failed:', err.message)
    db.prepare(`
      INSERT INTO sync_log (id, workspace_id, started_at, finished_at, status, error)
      VALUES (?, ?, ?, ?, 'error', ?)
    `).run(uuidv4(), workspaceId, Date.now(), Date.now(), err.message)
    return
  }

  const upsert = db.prepare(`
    INSERT OR REPLACE INTO work_items (id, source, source_id, workspace_id, title, status, category, priority, summary, classified_at, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertAll = db.transaction((results) => {
    const now = Date.now()
    for (const r of results) {
      const orig = items.find(i => String(i.id) === String(r.id) && i.source === r.source)
      upsert.run(
        uuidv4(),
        r.source,
        String(r.id),
        workspaceId,
        orig?.title || '',
        orig?.status || '',
        r.category || 'in_progress',
        orig?.priority || null,
        r.summary || '',
        now,
        now
      )
    }
  })

  insertAll(results)
}

module.exports = { classifyItems, _decryptApiKey }
