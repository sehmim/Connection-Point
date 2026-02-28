# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies (run from connection-point/)
cd connection-point && npm install

# Run the app
cd connection-point && npm start
```

There are no tests, linting scripts, or build steps — this is a no-bundler Electron app that runs directly. The `backend/` directory at the repo root is currently empty and reserved for Phase 2 server-side code.

## Architecture

Connection Point is a local-first Electron desktop app that aggregates Jira, GitHub, calendar, and chat data across multiple client workspaces. The UI is complete and built against mock data; backend IPC wiring is Phase 2.

### Process boundary

- **`main.js`** — Main process. Creates `BrowserWindow` (1200×800, `titleBarStyle: 'hiddenInset'` for macOS native traffic lights). Handles three IPC events: `window-minimize`, `window-maximize`, `window-close`.
- **`preload.js`** — Exposes `window.api` via `contextBridge`. Contains data stubs marked `// BACKEND: replace with real IPC calls` — this is where Phase 2 wiring goes.
- **`renderer/`** — Renderer process. Served as `file://` from `renderer/index.html`. No Node access; communicates with main only through `window.api`.

### Renderer: no bundler, global-only

All JS is loaded via `<script src>` tags in `index.html` in dependency order:
```
toast.js → sidebar.js → auth.js → onboarding.js → dashboard.js → overview.js → chat.js → settings.js → app.js
```
There are no ES modules or `import/export`. Every function meant to be shared across files is assigned to `window` (e.g. `window.navigate`, `window.renderSidebar`, `window.showToast`).

### View rendering pattern

Each view file (`renderer/views/*.js`) exposes one render function on `window`:

| View | Function | Notes |
|---|---|---|
| `auth` | `renderAuth()` | Passphrase screen → onboarding |
| `onboarding` | `renderOnboarding()` | 3-step wizard; on finish → `navigate('overview')` |
| `overview` | `renderOverview()` | Morning briefing; default landing view |
| `dashboard` | `renderDashboard()` | Sub-views: all / jira / github / calendar |
| `chat` | `renderChat()` | Multi-platform channel list + message pane |
| `settings` | `renderSettings()` | Workspace config, general settings |

`navigate(view)` in `app.js`:
1. Sets `window._appState._activeView = view`
2. Adds `.hidden` to all `[data-view="..."]` containers, removes it from the target
3. Hides/shows `#sidebar-container` (hidden on `auth` and `onboarding`)
4. Calls `updateSidebarActive(view)` (defined in `sidebar.js`)
5. Calls the view's render function

Views write their full UI via `innerHTML` into their container on every activation. **After every `innerHTML` write, call `lucide.createIcons()`** — required for Lucide icons to render.

### Global state

```js
window._appState = {
  workspaces: [],         // populated after onboarding
  activeWorkspace: null,
  dashboardView: 'all',   // 'all' | 'jira' | 'github' | 'calendar'
  jiraItems: null,        // cached after first fetch
  githubItems: null,      // cached after first fetch
  calendarItems: null,    // cached after first fetch
  _activeView: null       // set by navigate(); used by profile filter re-dispatch
}

window._dashboardFilters = { search: '', type: 'all', status: 'all', workspace: 'all' }
window._onboardingState  = { step: 1, name: '', color: '', profiles: [], detectedProfiles: null,
                              jiraEnabled: false, jiraUrl: '', githubEnabled: false, githubUrl: '',
                              gmailEnabled: false, gmailUrl: '', gcalEnabled: false, gcalUrl: '',
                              outlookEnabled: false, outlookUrl: '', customLinks: [] }
window._settingsState    = { section: 'workspaces', expandedWorkspace: null }
window._chatState        = { channels: [], messages: {}, activeChannel: null, loaded: false }
window._briefingProfile  = 'all'   // active browser profile filter — see profile filtering below
```

### Sidebar

- Sidebar has a divider after "Overview", separating it from the data views (All Items, Jira, GitHub, Calendar, Chat).
- Nav items call `window._sidebarNavClick(nav)`. For dashboard sub-views this sets `window._appState.dashboardView` then calls `navigate('dashboard')`. For chat it calls `navigate('chat')` directly. Overview calls `navigate('overview')`.
- The settings gear calls `navigate('settings')` directly (not via `_sidebarNavClick`).
- Workspace items call `window._workspaceClick(name)` which sets `window._dashboardFilters.workspace` and re-navigates to dashboard.
- Sidebar collapses to icon-only mode; expanded/collapsed state is toggled by `window._toggleSidebar()`.

### Browser profile filtering

All views have a "Showing all profiles" navbar (`_renderProfileNavbar`) that filters content by Chrome browser profile.

```js
const _BRIEFING_PROFILES = [
  { id: 'work',     name: 'Work',     email: 'you@company.com',  color: '#6366f1' },
  { id: 'client-a', name: 'Client A', email: 'you@clienta.com', color: '#10b981' },
  { id: 'client-b', name: 'Client B', email: 'you@clientb.com', color: '#f59e0b' },
]
```

- `window._briefingProfile` holds the active filter (`'all'` or a profile id).
- `_renderProfileNavbar(countsSource)` — pass an array of items to drive badge counts; omit to use morning briefing data.
- `_briefingProfileClick(id)` sets `_briefingProfile` and re-renders the current view by checking `_appState._activeView`.
- Filtering is applied in: overview briefing, dashboard items (all/jira/github), calendar events, chat channels.
- **Real data contract**: every item/event/channel must include a `"profile"` field matching one of the profile ids above.

### Mock data

All files live in `renderer/mock/`. Each record includes a `"profile"` field for browser profile filtering.

| File | Contents | Profile mapping |
|---|---|---|
| `jira.json` | 15 Jira items | ALPHA-12–16 → `work`, ALPHA-17–19 → `client-a`, BETA-* → `client-b` |
| `github.json` | 10 PRs + issues | 183–185 → `work`, 186–187 → `client-a`, 201–205 → `client-b` |
| `calendar.json` | 15 calendar events (gcal + outlook) | `you@company.com` → `work`, `you@clientb.com` → `client-b` |
| `chats.json` | 9 channels + messages (Slack/Teams/Discord) | Client Alpha → `work`, Client Beta → `client-b` |

All fetched lazily via `fetch('./mock/....json')` — works under `file://` because CSP uses `connect-src 'self'`.

### Item detail drawer

- Lives in the dashboard and overview views as a resizable right panel.
- Width stored in `window._drawerWidth`; dragged via `#drawer-resize-handle`.
- Inner content uses `width:100%; min-width:0` — fluid, responds to panel resize.
- `window._itemRegistry` maps uid strings to item objects; populated at render time.
- `_selectItem(uid)` / `_closeItemDetail()` preserve `#dash-table-scroll` scroll position to prevent the list jumping to the top on selection.
- Drawer types: Jira issue, GitHub issue, GitHub PR (split-screen diff view), Meeting.

### Design tokens (light mode)

All colors and radii are CSS custom properties in the `<style>` block in `index.html`. Never hardcode colors — always use these variables.

```
--bg-base: #f5f5f5    --bg-surface: #ffffff    --bg-raised: #f0f0f0    --bg-hover: #e8e8e8
--text-primary: #111111    --text-secondary: #555555    --text-muted: #999999
--border: #d8d8d8    --border-subtle: #ebebeb
--accent: #6366f1    --accent-muted: rgba(99,102,241,0.1)
--success: #059669    --warning: #d97706    --danger: #dc2626
--radius: 6px    --radius-sm: 4px    --radius-lg: 10px
```

### Phase 2 wiring points

All stub functions in `preload.js` are marked `// BACKEND: replace with real IPC calls`. Adding a real integration means:
1. Add an `ipcMain.handle(...)` in `main.js`
2. Replace the corresponding `Promise.resolve(...)` stub in `preload.js` with `ipcRenderer.invoke(...)`
3. No renderer code changes needed if the data shape matches (and items include a `profile` field)
