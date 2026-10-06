type TopBarProps = {
  title: string
  email?: string
  apiStatus: 'loading' | 'success' | 'unauthorized' | 'error'
  onMenuToggle: () => void
}

export function TopBar({ title, email, apiStatus, onMenuToggle }: TopBarProps) {
  const initial = email?.charAt(0).toUpperCase() || 'C'

  return (
    <header className="dashboard-topbar">
      <div className="topbar-heading">
        <button type="button" className="menu-toggle" onClick={onMenuToggle} aria-label="Toggle navigation">
          <span />
          <span />
          <span />
        </button>
        <div>
          <p className="topbar-context">CyberMind workspace</p>
          <h1>{title}</h1>
        </div>
      </div>
      <div className="topbar-account" aria-label="Account">
        <span className={`topbar-status topbar-status-${apiStatus}`}><span /> API {apiStatus === 'success' ? 'Connected' : apiStatus === 'loading' ? 'Loading' : 'Unavailable'}</span>
        <span className="topbar-avatar" aria-hidden="true">{initial}</span>
        <span className="topbar-email">{email || 'Authenticated user'}</span>
      </div>
    </header>
  )
}
