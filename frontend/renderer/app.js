window._appState = {
  workspaces: [],
  activeWorkspace: null,
  dashboardView: 'all',
  jiraItems: null,
  githubItems: null
}

function navigate(view) {
  window._appState._activeView = view

  // Hide all views
  document.querySelectorAll('[data-view]').forEach(el => el.classList.add('hidden'))
  // Show target
  const target = document.querySelector(`[data-view="${view}"]`)
  if (target) target.classList.remove('hidden')

  // Update sidebar visibility and active state
  updateSidebarVisibility(view)
  updateSidebarActive(view)

  // Call view render function
  const renders = {
    auth: window.renderAuth,
    onboarding: window.renderOnboarding,
    loading: window.renderLoading,
    overview: window.renderOverview,
    dashboard: window.renderDashboard,
    chat: window.renderChat,
    settings: window.renderSettings
  }
  if (renders[view]) renders[view]()
}
window.navigate = navigate

function updateSidebarVisibility(view) {
  const sidebar = document.getElementById('sidebar-container')
  if (!sidebar) return
  sidebar.style.display = ['auth', 'onboarding', 'loading'].includes(view) ? 'none' : 'flex'
}

document.addEventListener('DOMContentLoaded', () => {
  // Render sidebar into its container
  if (typeof window.renderSidebar === 'function') window.renderSidebar()

  // Workspaces are built in-memory during onboarding (no DB read yet)
  window._appState.workspaces = []

  // Check for an existing auth session
  const session = typeof window._authGetSession === 'function' ? window._authGetSession() : null
  const isOnboarded = window.localStorage.getItem("onboarded"); // already Onboarded:

  console.log("isOnboarded --->", isOnboarded)

  if (session && session.email && !isOnboarded) {
    navigate(window._appState.workspaces.length > 0 ? 'overview' : 'onboarding')
  } else if (isOnboarded)  {
    navigate('overview')
  }
  else {
    navigate('auth')
  }
})
