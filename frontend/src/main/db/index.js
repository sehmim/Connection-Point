const Database = require('better-sqlite3')
const path = require('path')
const { app } = require('electron')
const { runMigrations } = require('./migrations')

let db

function initDb() {
  db = new Database(path.join(app.getPath('userData'), 'connectionpoint.db'))
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  return db
}

function getDb() {
  if (!db) throw new Error('DB not initialized — call initDb() first')
  return db
}

module.exports = { initDb, getDb }
