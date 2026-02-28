# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Run the app
npm start
```

There are no tests, linting scripts, or build steps — this is a no-bundler Electron app that runs directly.

## Architecture

Connection Point is a local-first Electron desktop app that aggregates Jira and GitHub data across multiple client workspaces. The UI phase is complete (built against mock data); backend IPC wiring is Phase 2.

### Process boundary

- **`main.js`** — Main process. Creates `BrowserWindow` (1200×800, `titleBarStyle: 'hiddenInset'` for macOS native traffic lights). Handles three IPC events: `window-minimize`, `window-maximize`, `window-close`.
- **`preload.js`** — Exposes `window.api` via `contextBridge`. Contains data stubs marked `// BACKEND: replace with real IPC calls` — this is where Phase 2 wiring goes.
- **`renderer/`** — Renderer process. Served as `file://` from `renderer/index.html`. No Node access; communicates with main only through `window.api`.

### Renderer: no bundler, global-only

All JS is loaded via `<script src>` tags in `index.html` in dependency order:
```
toast.js → sidebar.js → auth.js → onboarding.js → dashboard.js → chat.js → app.js
```
There are no ES modules or `import/export`. Every function meant to be shared across files is assigned to `window` (e.g. `window.navigate`, `window.renderSidebar`, `window.showToast`).

### View rendering pattern

Each view file (`renderer/views/*.js`) exposes one render function: `renderAuth()`, `renderOnboarding()`, `renderDashboard()`, `renderChat()`.

`navigate(view)` in `app.js`:
1. Adds `.hidden` to all `[data-view="..."]` containers
2. Removes `.hidden` from the target view's container
3. Hides/shows `#sidebar-container` (hidden on `auth` and `onboarding`)
4. Calls `updateSidebarActive(view)` (defined in `sidebar.js`)
5. Calls the view's render function

Views write their full UI via `innerHTML` into their container on every activation. **After every `innerHTML` write, call `lucide.createIcons()`** — this is required for Lucide icons to render.

### Global state

```js
window._appState = {
  workspaces: [],        // populated after onboarding; passed to sidebar workspace list
  activeWorkspace: null,
  dashboardView: 'all',  // 'all' | 'jira' | 'github' — controls which table renders
  jiraItems: null,       // cached after first fetch of mock/jira.json
  githubItems: null      // cached after first fetch of mock/github.json
}

window._dashboardFilters = { search: '', type: 'all', status: 'all', workspace: 'all' }
window._onboardingState  = { step: 1, name: '', color: '', profile: null, jiraEnabled: false, jiraUrl: '', githubEnabled: false }
window._chatMessages     = []   // array of { role: 'user'|'assistant', content: string }
```

### Sidebar navigation → dashboard sub-views

Sidebar nav items (`all-items`, `jira`, `github`, `chat`) call `window._sidebarNavClick(nav)`. For dashboard sub-views this sets `window._appState.dashboardView` then calls `navigate('dashboard')`. For chat, it calls `navigate('chat')` directly.

Workspace items in the sidebar call `window._workspaceClick(name)` which sets `window._dashboardFilters.workspace` and re-navigates to dashboard.

### Mock data

`renderer/mock/jira.json` — 15 Jira items across "Client Alpha" and "Client Beta".
`renderer/mock/github.json` — 10 GitHub items (PRs + issues) across the same two workspaces.

Fetched lazily in `renderDashboard()` via `fetch('./mock/jira.json')` — works under `file://` because CSP uses `connect-src 'self'`.

### Design tokens

All colors and radii are CSS custom properties defined in the `<style>` block in `index.html`. Use these variables throughout — never hardcode colors.

Key tokens: `--bg-base`, `--bg-surface`, `--bg-raised`, `--bg-hover`, `--text-primary`, `--text-secondary`, `--text-muted`, `--border`, `--border-subtle`, `--accent`, `--accent-muted`, `--success`, `--warning`, `--danger` (each with a `-muted` variant), `--radius`, `--radius-sm`, `--radius-lg`.

### Phase 2 wiring points

All stub functions in `preload.js` are marked `// BACKEND: replace with real IPC calls`. In `app.js`, the `DOMContentLoaded` handler is similarly marked. Adding a real integration means:
1. Add an `ipcMain.handle(...)` in `main.js`
2. Replace the corresponding `Promise.resolve(...)` stub in `preload.js` with `ipcRenderer.invoke(...)`
3. No renderer code changes needed if the data shape matches
