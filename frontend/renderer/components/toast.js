window.showToast = function(message, type = 'info') {
  const colors = {
    success: { bg: 'var(--success-muted)', border: 'var(--success)', text: 'var(--success)' },
    error: { bg: 'var(--danger-muted)', border: 'var(--danger)', text: 'var(--danger)' },
    info: { bg: 'var(--accent-muted)', border: 'var(--accent)', text: 'var(--accent)' }
  }
  const c = colors[type] || colors.info

  const toast = document.createElement('div')
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: ${c.bg};
    border: 1px solid ${c.border};
    color: ${c.text};
    border-radius: var(--radius);
    padding: 10px 16px;
    font-size: 13px;
    font-family: 'IBM Plex Sans', sans-serif;
    z-index: 9999;
    max-width: 320px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    transition: opacity 0.3s ease;
    opacity: 1;
  `
  toast.textContent = message
  document.body.appendChild(toast)

  setTimeout(() => {
    toast.style.opacity = '0'
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}
