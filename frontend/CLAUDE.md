# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Rebuild native modules (required after npm install — better-sqlite3 uses Electron ABI)
npm run rebuild

# Run the app
npm start
```

There are no tests, linting scripts, or build steps. This is a no-bundler Electron app.

## Architecture Overview

Connection Point is a local-first Electron desktop app that aggregates GitHub and Jira data across multiple workspaces. Data is collected via headless Chrome scraping (CDP + chrome-launcher), classified by an LLM, and persisted in SQLite.

### Process Boundary

```
main.js  →  src/main/index.js  (Node: DB, IPC, scrapers, sync engine)
                ↕  contextBridge via preload.js
renderer/index.html  (no Node, file:// served, no bundler)
```

- **`main.js`** — Entry point. Loads `.env`, creates BrowserWindow, registers `open-external`/window-control IPC, calls `src/main/index.js init(win)`.
- **`preload.js`** — Exposes `window.api` via contextBridge. All renderer↔main communication goes through the channels defined here.
- **`src/main/index.js`** — Initializes DB, registers all IPC handlers, starts sync engine.

### Renderer: No Bundler, Global-Only

All JS loaded via `<script src>` in `renderer/index.html` in this order:
```
toast.js → sidebar.js → auth.js → loading.js → onboarding.js →
dashboard.js → overview.js → chat.js → settings.js → app.js
```

No ES modules or `import/export`. Shared functions are assigned to `window` (e.g., `window.navigate`, `window.renderSidebar`, `window.showToast`). **After every `innerHTML` write, call `lucide.createIcons()`.**

### Backend: `src/main/`

| Directory | Purpose |
|---|---|
| `db/` | SQLite via better-sqlite3 (WAL mode). `index.js` exposes `getDb()`. `migrations.js` runs versioned migrations. `schema.js` holds base CREATE TABLE SQL. |
| `ipc/` | One file per domain. Each file exports a `register*Ipc()` function. **Always call `ipcMain.removeHandler(channel)` before re-registering** to prevent double-registration crashes. |
| `scrapers/` | `browser.js` — CDP session factory (`createSession(profileDirName)` → `{ navigateTo, evaluateInPage, close }`). Port range 9222–9321, allocated dynamically. Each scraper (`jira.scraper.js`, `github.scraper.js`, `calendar.scraper.js`) takes a URL + profileDirName and returns scraped items. |
| `services/` | `profile-scanner.js` — reads Chrome/Brave/Arc Preferences JSON. `sync-engine.js` — checks staleness every 60s, triggers scrape+classify per integration. `llm-classifier.js` — OpenAI batch classification. `store.js` — electron-store for llmProvider/llmModel. |
| `agents/` | `github-classifier.js` — LLM agent that takes raw GitHub HTML and returns structured items with priority + summary. |

### Authentication & Sessions

- **GitHub**: Session stored in `persist:<hostname>` Electron partition. Login popup opens `https://<hostname>/login`; polls for `user_session`/`dotcom_user`/`_gh_sess` cookies.
- **Jira**: Same pattern. Cloud login at `https://id.atlassian.com/login`; detects `JSESSIONID`/`cloud.session.token`/`atlassian.xsrf.token`.
- **LLM API key**: Stored in `settings` table, encrypted via `safeStorage`. Falls back to `process.env.OPEN_AI_KEY` if not set. Set via Settings UI or `.env` file at repo root.

### Data Flow

1. User adds repo/board URL via Onboarding or Settings → Tracking Sites
2. `connect-github-source` / `connect-jira-source` IPC opens login popup; cookies persist in Electron session partition
3. Scraper uses CDP session with that partition's profile to fetch pages
4. Raw HTML passed to LLM classifier agent → structured items saved to `github_items` / `jira_items` tables
5. `sync-engine.js` re-runs scrape+classify every hour for stale integrations
6. `sync:status` event pushed to renderer; Settings → Tracking Sites shows sync badges

### DB Schema (current migrations v5)

Core tables: `profiles`, `workspaces`, `integrations`, `jira_items`, `jira_boards`, `jira_activity`, `github_items`, `github_repos`, `github_reviews`, `github_changed_files`, `calendar_events`, `work_items`, `sync_log`, `settings`, `custom_links`

To add a migration: append to `MIGRATIONS` array in `src/main/db/migrations.js` with the next version number.

### Adding a New IPC Channel

1. Add handler in the relevant `src/main/ipc/*.ipc.js` file (call `ipcMain.removeHandler` first)
2. Expose in `preload.js` contextBridge
3. Call via `window.api.<method>()` in renderer — no other changes needed

### Design Tokens (Light Mode)

Never hardcode colors — use CSS variables from `renderer/index.html`:
```
--bg-base: #f5f5f5    --bg-surface: #ffffff    --bg-raised: #f0f0f0
--text-primary: #111111    --text-secondary: #555555    --text-muted: #999999
--border: #d8d8d8    --accent: #6366f1    --accent-muted: rgba(99,102,241,0.1)
--success: #059669    --warning: #d97706    --danger: #dc2626
--radius: 6px    --radius-sm: 4px    --radius-lg: 10px
```

### Key Constraints

- **No third-party APIs**: All data collection is via web scraping using the user's browser session (CDP). Never add direct API calls to GitHub/Jira/Google.
- **No bundler**: Cannot use `import`/`export` in renderer code. Use `window.*` globals.
- **Native module**: better-sqlite3 requires `npm run rebuild` after `npm install`. Use v12+ for Electron 31 compatibility.
