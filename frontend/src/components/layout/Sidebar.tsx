type NavigationItem = {
  label: string
  id: string
  available?: boolean
}

const iconPaths: Record<string, string> = {
  dashboard: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  projects: 'M4 6h6l2 2h8v10H4z',
  'code-review': 'M7 5 4 8l3 3M17 5l3 3-3 3M14 4l-4 16',
  'log-analyzer': 'M5 5h14v14H5zM8 9h8M8 13h8M8 17h5',
  'threat-intelligence': 'M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z',
  'project-reviewer': 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5',
  reports: 'M5 4h14v16H5zM8 8h8M8 12h5M8 16h8',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4 12h2m12 0h2M12 4v2m0 12v2',
}

type NavigationGroup = {
  label: string
  items: NavigationItem[]
}

type SidebarProps = {
  activeItem: string
  isOpen: boolean
  onSelect: (item: NavigationItem) => void
  onSignOut: () => void
  isSigningOut: boolean
}

const navigationGroups: NavigationGroup[] = [
  { label: 'Overview', items: [{ label: 'Dashboard', id: 'dashboard', available: true }] },
  { label: 'Workspace', items: [{ label: 'Projects', id: 'projects', available: true }] },
  {
    label: 'Security Analyst',
    items: [
      { label: 'Code Review', id: 'code-review' },
      { label: 'Log Analyzer', id: 'log-analyzer' },
      { label: 'Threat Intelligence', id: 'threat-intelligence' },
    ],
  },
  { label: 'Intelligence', items: [{ label: 'Project Reviewer', id: 'project-reviewer' }] },
  { label: 'Output', items: [{ label: 'Reports', id: 'reports' }] },
  { label: 'System', items: [{ label: 'Settings', id: 'settings', available: true }] },
]

export function Sidebar({
  activeItem,
  isOpen,
  onSelect,
  onSignOut,
  isSigningOut,
}: SidebarProps) {
  return (
    <aside className={isOpen ? 'dashboard-sidebar sidebar-open' : 'dashboard-sidebar'}>
      <div className="sidebar-brand">
        <img src="/branding/logo.svg" alt="CyberMind AI" />
        <span className="sidebar-version">SECURITY INTELLIGENCE</span>
      </div>
      <nav className="sidebar-nav" aria-label="Primary navigation">
        {navigationGroups.map((group) => (
          <div className="nav-group" key={group.label}>
            <p className="nav-group-label">{group.label}</p>
            {group.items.map((item) => (
              <button
                type="button"
                className={activeItem === item.id ? 'nav-item nav-item-active' : 'nav-item'}
                key={item.id}
                onClick={() => onSelect(item)}
              >
                <svg className="nav-item-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d={iconPaths[item.id] || iconPaths.dashboard} />
                </svg>
                {item.label}
                {!item.available && <span className="nav-item-soon">Soon</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-account">
        <p className="nav-group-label">Account</p>
        <button type="button" className="nav-item sign-out-item" onClick={onSignOut} disabled={isSigningOut}>
          <svg className="nav-item-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6H5v12h5M14 8l4 4-4 4M9 12h9" /></svg>
          {isSigningOut ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    </aside>
  )
}
