# Connection Point

A local-first Electron desktop app that aggregates Jira, GitHub, calendar, and chat data across multiple client workspaces — all in one place, without leaving your machine.

## What it does

- **Overview** — Morning briefing with meetings, items waiting on you, overdue tasks, and due-this-week items
- **All Items** — Unified table of Jira tickets and GitHub PRs/issues across all workspaces
- **Jira** — Filtered view with sprint, priority, and assignee columns
- **GitHub** — PRs and issues with repo, author, and status
- **Calendar** — Daily/weekly calendar view of events from Google Calendar and Outlook
- **Chat** — Unified channel list from Slack, Teams, and Discord
- **Browser profile filtering** — Switch between Chrome profiles (Work, Client A, Client B) to isolate context
- **Item detail drawer** — Resizable side panel with full detail for any selected item

## Getting started

```bash
cd frontend
npm install
npm start
```

Requires Node.js and Electron. The app opens at 1200×800 with macOS native traffic lights.

## Project structure

```
frontend/          # Electron app (Phase 1 — UI complete, mock data)
  main.js          # Main process: BrowserWindow, IPC handlers
  preload.js       # contextBridge: window.api (data stubs for Phase 2)
  renderer/
    index.html     # Entry point, CDN scripts, design tokens
    app.js         # navigate(), _appState, DOMContentLoaded init
    views/         # auth, onboarding, overview, dashboard, chat, settings
    components/    # sidebar, toast
    mock/          # jira.json, github.json, calendar.json, chats.json

backend/           # Phase 2 — server-side automation (not yet implemented)
```

## Tech stack

- **Electron 31** — desktop shell, no server required
- **No bundler** — all JS loaded via `<script src>` tags, globals on `window`
- **Tailwind v4** (CDN) + **Lucide Icons** (CDN)
- **IBM Plex Sans** — UI font
- **Mock JSON** — all data is local; `fetch('./mock/...json')` via `file://`

## Status

| Phase | Status |
|---|---|
| Phase 1 — UI | Complete |
| Phase 2 — Backend wiring (real IPC, OAuth, Chrome profile detection, persistence) | Not started |

Phase 2 integration points are all marked `// BACKEND: replace with real IPC calls` in `preload.js`.
