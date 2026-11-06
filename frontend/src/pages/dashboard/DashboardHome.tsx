import type { Project } from '../../lib/api'

type DashboardHomeProps = {
  email?: string
  projects: Project[]
  apiStatus: 'loading' | 'success' | 'unauthorized' | 'error'
  onViewProjects: () => void
  onNavigate: (id: string) => void
  onProjectOpen: (projectId: string) => void
}

type Capability = {
  name: string
  description: string
  marker: string
  route?: string
  state: string
}

const capabilities: Capability[] = [
  { name: 'Code Review', description: 'Review source code for security and quality issues.', marker: '</>', route: 'code-review', state: 'Available' },
  { name: 'Log Analysis', description: 'Upload or paste logs, triage events, and run AI analysis.', marker: '▤', route: 'log-analyzer', state: 'Available' },
  { name: 'Projects', description: 'Organize repositories and security analysis workspaces.', marker: '□', route: 'projects', state: 'Available' },
  { name: 'AI Providers', description: 'Configure and test the models used by analysis tools.', marker: '⚙', route: 'settings', state: 'Available' },
  { name: 'Threat Intelligence', description: 'Threat enrichment and intelligence workflows.', marker: '◇', state: 'Planned' },
  { name: 'Project Reviewer', description: 'Deeper project-wide security review workflows.', marker: '✥', state: 'Planned' },
  { name: 'Reports', description: 'Centralized report history and export management.', marker: '▥', state: 'Planned' },
]

export function DashboardHome({
  email,
  projects,
  apiStatus,
  onViewProjects,
  onNavigate,
  onProjectOpen,
}: DashboardHomeProps) {
  const accountName = email || 'your account'
  const statusLabel = {
    loading: 'Loading',
    success: 'Connected',
    unauthorized: 'Unauthorized',
    error: 'Unavailable',
  }[apiStatus]
  const latestProjects = projects.slice(0, 5)
  const availableCapabilities = capabilities.filter((capability) => capability.route)
  const plannedCapabilities = capabilities.filter((capability) => !capability.route)

  return (
    <div className="dashboard-home">
      <section className="dashboard-hero">
        <div className="hero-copy">
          <p className="section-kicker">Security operations</p>
          <h2>Your security workspace</h2>
          <p className="hero-tagline">Analyze. Detect. Secure. All in one place.</p>
          <p>Welcome back, {accountName}. Your workspace data is shown below.</p>
        </div>
        <div className="hero-graphic" aria-hidden="true">
          <span className="hero-ring hero-ring-one" />
          <span className="hero-ring hero-ring-two" />
          <span className="hero-shield">◇</span>
          <span className="hero-node hero-node-one" />
          <span className="hero-node hero-node-two" />
          <span className="hero-node hero-node-three" />
        </div>
      </section>

      <div className="dashboard-primary-row">
        <section className="light-panel workspace-panel" aria-labelledby="workspace-overview-title">
          <div className="panel-title-row">
            <div className="panel-title">
              <span className="panel-icon panel-icon-folder">□</span>
              <div>
                <p className="section-kicker">Workspace overview</p>
                <h3 id="workspace-overview-title">Your projects</h3>
              </div>
            </div>
            <button type="button" className="text-action dashboard-text-button" onClick={onViewProjects}>Manage projects →</button>
          </div>
          <div className="workspace-project-summary">
            <div className="active-project-count">
              <span>Projects</span>
              <strong>{apiStatus === 'success' ? projects.length : '—'}</strong>
              <small>{apiStatus === 'loading' ? 'Loading live workspace data' : apiStatus === 'success' ? 'Projects in your workspace' : 'Project data is unavailable'}</small>
            </div>
            <div className="latest-project">
              <span className="latest-label">Latest project</span>
              {projects[0] ? (
                <button type="button" className="latest-project-row dashboard-project-link" onClick={() => onProjectOpen(projects[0].id)}>
                  <span className="project-file-icon">▤</span>
                  <span className="project-row-copy">
                    <strong>{projects[0].name}</strong>
                    <small>{projects[0].description || 'Open project workspace'}</small>
                  </span>
                  <span className="row-chevron">›</span>
                </button>
              ) : (
                <p className="compact-empty-state">{apiStatus === 'loading' ? 'Loading projects...' : 'No projects yet. Create one to get started.'}</p>
              )}
            </div>
          </div>
        </section>

        <section className="light-panel quick-actions-panel" aria-labelledby="quick-actions-title">
          <div className="panel-title">
            <span className="panel-icon">ϟ</span>
            <div>
              <p className="section-kicker">Quick actions</p>
              <h3 id="quick-actions-title">Start a workflow</h3>
            </div>
          </div>
          <div className="dashboard-quick-actions">
            <button type="button" className="view-projects-button" onClick={() => onNavigate('log-analyzer')}>Analyze security logs <span>→</span></button>
            <button type="button" className="view-projects-button" onClick={() => onNavigate('code-review')}>Review code <span>→</span></button>
            <button type="button" className="view-projects-button" onClick={onViewProjects}>View projects <span>→</span></button>
          </div>
          <p>Each action opens its connected workspace module.</p>
        </section>
      </div>

      <section className="light-panel capabilities-panel" aria-labelledby="capabilities-title">
        <div className="panel-title-row">
          <div className="panel-title">
            <span className="panel-icon">▦</span>
            <div>
              <p className="section-kicker">Security capabilities</p>
              <h3 id="capabilities-title">Available tools and roadmap</h3>
            </div>
          </div>
          <span className="section-meta">{availableCapabilities.length} available · {plannedCapabilities.length} planned</span>
        </div>
        <div className="capability-tiles">
          {capabilities.map((capability) => capability.route ? (
            <button type="button" className="capability-tile capability-tile-action" key={capability.name} onClick={() => onNavigate(capability.route!)}>
              <span className="capability-tile-icon">{capability.marker}</span>
              <span className="capability-tile-copy">
                <strong>{capability.name}</strong>
                <small>{capability.description}</small>
              </span>
              <span className="capability-arrow">›</span>
              <span className="capability-badge">{capability.state}</span>
            </button>
          ) : (
            <div className="capability-tile capability-tile-planned" key={capability.name} aria-disabled="true">
              <span className="capability-tile-icon">{capability.marker}</span>
              <span className="capability-tile-copy">
                <strong>{capability.name}</strong>
                <small>{capability.description}</small>
              </span>
              <span className="capability-badge">{capability.state}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="dashboard-secondary-row">
        <section className="light-panel compact-panel" aria-labelledby="recent-projects-title">
          <div className="panel-title-row">
            <div className="panel-title">
              <span className="panel-icon">◷</span>
              <div>
                <p className="section-kicker">Workspace data</p>
                <h3 id="recent-projects-title">Recent projects</h3>
              </div>
            </div>
            <button type="button" className="text-action dashboard-text-button" onClick={onViewProjects}>View all →</button>
          </div>
          {apiStatus === 'loading' && <p className="compact-empty-state">Loading project data...</p>}
          {apiStatus === 'unauthorized' && <p className="compact-empty-state">Your session needs to be refreshed before projects can load.</p>}
          {apiStatus === 'error' && <p className="compact-empty-state">Project data could not be loaded. Open Projects to retry.</p>}
          {apiStatus === 'success' && latestProjects.length === 0 && <p className="compact-empty-state">No projects found. Create your first project from the Projects page.</p>}
          {apiStatus === 'success' && latestProjects.length > 0 && (
            <div className="dashboard-recent-projects">
              {latestProjects.map((project) => (
                <button type="button" className="recent-project-row dashboard-project-link" key={project.id} onClick={() => onProjectOpen(project.id)}>
                  <span className="project-file-icon">▤</span>
                  <span className="project-row-copy">
                    <strong>{project.name}</strong>
                    <small>{project.description || 'Security analysis project'}</small>
                  </span>
                  <span className="row-chevron">›</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="light-panel compact-panel" aria-labelledby="activity-title">
          <div className="panel-title">
            <span className="panel-icon">⌁</span>
            <div>
              <p className="section-kicker">System connection</p>
              <h3 id="activity-title">Workspace availability</h3>
            </div>
          </div>
          <div className="activity-empty dashboard-connection-state">
            <span className="activity-icon">◉</span>
            <span>
              <strong>{apiStatus === 'success' ? 'Project API connected' : apiStatus === 'loading' ? 'Checking project API' : apiStatus === 'unauthorized' ? 'Authentication required' : 'Project API unavailable'}</strong>
              <small>{apiStatus === 'success' ? 'Live project data is being used throughout this dashboard.' : 'Dashboard values will update when the API connection is restored.'}</small>
            </span>
          </div>
          <div className="dashboard-status-actions">
            <button type="button" className="view-projects-button" onClick={() => onNavigate('settings')}>Manage AI providers <span>→</span></button>
          </div>
        </section>
      </div>

      <section className="system-status-strip" aria-label="System status">
        <span className="section-kicker">System status</span>
        <span className="system-status-item"><span className="inline-status-dot" /> Authentication <strong>Active</strong></span>
        <span className={`system-status-item ${apiStatus === 'success' ? '' : 'status-not-ready'}`}><span className="inline-status-dot" /> Project API <strong>{statusLabel}</strong></span>
      </section>
    </div>
  )
}
