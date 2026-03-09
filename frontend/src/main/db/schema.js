const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  browser TEXT NOT NULL,
  dir_name TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  avatar_text TEXT,
  color TEXT,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  llm_model TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  service TEXT NOT NULL,
  urls TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER DEFAULT 1,
  last_sync INTEGER,
  status TEXT DEFAULT 'never',
  error TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (profile_id) REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS jira_items (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  integration_id TEXT NOT NULL,
  board_url TEXT,
  title TEXT,
  status TEXT,
  priority TEXT,
  assignee TEXT,
  sprint TEXT,
  due_date TEXT,
  url TEXT,
  description TEXT,
  epic TEXT,
  estimate TEXT,
  issue_type TEXT,
  synced_at INTEGER,
  raw_json TEXT
);

CREATE TABLE IF NOT EXISTS jira_activity (
  id TEXT PRIMARY KEY,
  jira_id TEXT NOT NULL,
  author TEXT,
  field TEXT,
  from_val TEXT,
  to_val TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS github_items (
  id INTEGER PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  integration_id TEXT NOT NULL,
  repo_url TEXT,
  type TEXT,
  title TEXT,
  status TEXT,
  repo TEXT,
  author TEXT,
  updated_at TEXT,
  url TEXT,
  body TEXT,
  synced_at INTEGER,
  raw_json TEXT
);

CREATE TABLE IF NOT EXISTS github_reviews (
  id TEXT PRIMARY KEY,
  github_id INTEGER NOT NULL,
  reviewer TEXT,
  state TEXT,
  submitted_at TEXT
);

CREATE TABLE IF NOT EXISTS github_changed_files (
  id TEXT PRIMARY KEY,
  github_id INTEGER NOT NULL,
  filename TEXT,
  status TEXT,
  additions INTEGER,
  deletions INTEGER
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  integration_id TEXT NOT NULL,
  calendar_url TEXT,
  title TEXT,
  start TEXT,
  end TEXT,
  all_day INTEGER DEFAULT 0,
  source TEXT,
  account TEXT,
  color TEXT,
  synced_at INTEGER
);

CREATE TABLE IF NOT EXISTS work_items (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  profile_id TEXT,
  title TEXT,
  status TEXT,
  category TEXT,
  priority TEXT,
  summary TEXT,
  classified_at INTEGER,
  synced_at INTEGER
);

CREATE TABLE IF NOT EXISTS sync_log (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  integration_id TEXT,
  started_at INTEGER,
  finished_at INTEGER,
  status TEXT,
  item_count INTEGER,
  error TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS custom_links (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  url TEXT NOT NULL,
  label TEXT,
  description TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jira_workspace ON jira_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_jira_profile ON jira_items(profile_id);
CREATE INDEX IF NOT EXISTS idx_github_workspace ON github_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_calendar_workspace ON calendar_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_calendar_start ON calendar_events(start);
CREATE INDEX IF NOT EXISTS idx_integrations_workspace_service ON integrations(workspace_id, service);
`

module.exports = { SCHEMA_SQL }
