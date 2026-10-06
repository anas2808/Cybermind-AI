import type { Project } from '../../lib/api'

type DashboardHomeProps = {
  email?: string
  projects: Project[]
  apiStatus: 'loading' | 'success' | 'unauthorized' | 'error'
  onViewProjects: () => void
}

type Capability = {
  name: string
  description: string
  marker: string
  state: string
}

const capabilities: Capability[] = [
  { name: 'Code Review', description: 'AI-powered code analysis.', marker: '</>', state: 'Beta' },
  { name: 'Log Analyzer', description: 'Analyze security logs.', marker: '▤', state: 'Beta' },
  { name: 'Threat Intelligence', description: 'Threat intelligence insights.', marker: '◇', state: 'Beta' },
  { name: 'Project Reviewer', description: 'Project security review.', marker: '✥', state: 'Beta' },
  { name: 'Reports', description: 'Security report generation.', marker: '▥', state: 'Planned' },
]

export function DashboardHome({
  email,
  projects,
  apiStatus,
  onViewProjects,
}: DashboardHomeProps) {
  const accountName = email || 'your account'
  const statusLabel = {
    loading: 'Loading',
    success: 'Connected',
    unauthorized: 'Unauthorized',
    error: 'Unavailable',
  }[apiStatus]
  const operational = apiStatus === 'success'
  const latestProject = projects[0]

  return (
    <div className="dashboard-home">
      <section className="dashboard-hero">
        <div className="hero-copy">
          <p className="section-kicker">Security operations</p>
          <h2>Your security workspace</h2>
          <p className="hero-tagline">Analyze. Detect. Secure. All in one place.</p>
          <p>Your CyberMind AI environment is ready for security analysis, {accountName}.</p>
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
                <h3 id="workspace-overview-title">Active projects</h3>
              </div>
            </div>
            <span className="text-action">Manage projects</span>
          </div>
          <div className="workspace-project-summary">
            <div className="active-project-count">
              <span>Active projects</span>
              <strong>{apiStatus === 'success' ? projects.length : '—'}</strong>
              <small>Your security projects for analysis</small>
            </div>
            <div className="latest-project">
              <span className="latest-label">Latest project</span>
              {latestProject ? (
                <div className="latest-project-row">
                  <span className="project-file-icon">▤</span>
                  <span className="project-row-copy">
                    <strong>{latestProject.name}</strong>
                    <small><span className="inline-status-dot" /> Active project</small>
                  </span>
                  <span className="row-chevron">›</span>
                </div>
              ) : (
                <p className="compact-empty-state">No active projects yet.</p>
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
          <button type="button" className="view-projects-button" onClick={onViewProjects}>
            View Projects <span>→</span>
          </button>
          <p>Open the existing project workspace.</p>
        </section>
      </div>

      <section className="light-panel capabilities-panel" aria-labelledby="capabilities-title">
        <div className="panel-title-row">
          <div className="panel-title">
            <span className="panel-icon">▦</span>
            <div>
              <p className="section-kicker">Security capabilities</p>
              <h3 id="capabilities-title">Security analysis tools for your projects</h3>
            </div>
          </div>
        </div>
        <div className="capability-tiles">
          {capabilities.map((capability) => (
            <div className="capability-tile" key={capability.name}>
              <span className="capability-tile-icon">{capability.marker}</span>
              <span className="capability-tile-copy">
                <strong>{capability.name}</strong>
                <small>{capability.description}</small>
              </span>
              <span className="capability-arrow">›</span>
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
                <p className="section-kicker">Recent projects</p>
                <h3 id="recent-projects-title">Your latest security projects</h3>
              </div>
            </div>
            <span className="text-action">View all ›</span>
          </div>
          {apiStatus === 'loading' && <p className="compact-empty-state">Loading project data...</p>}
          {apiStatus !== 'loading' && latestProject && (
            <div className="recent-project-row">
              <span className="project-file-icon">▤</span>
              <span className="project-row-copy">
                <strong>{latestProject.name}</strong>
                <small><span className="inline-status-dot" /> Active project</small>
              </span>
              <small className="created-label">Created recently　›</small>
            </div>
          )}
          {apiStatus !== 'loading' && !latestProject && <p className="compact-empty-state">No active projects yet.</p>}
        </section>

        <section className="light-panel compact-panel" aria-labelledby="activity-title">
          <div className="panel-title">
            <span className="panel-icon">⌁</span>
            <div>
              <p className="section-kicker">Activity</p>
              <h3 id="activity-title">Recent activity in your workspace</h3>
            </div>
          </div>
          <div className="activity-empty">
            <span className="activity-icon">◷</span>
            <span><strong>No recent activity</strong><small>Your security analysis activity will appear here.</small></span>
          </div>
        </section>
      </div>

      <section className="system-status-strip" aria-label="System status">
        <span className="section-kicker">System status</span>
        <span className="system-status-item"><span className="inline-status-dot" /> Authentication <strong>Active</strong></span>
        <span className={`system-status-item ${operational ? '' : 'status-not-ready'}`}><span className="inline-status-dot" /> Project API <strong>{statusLabel}</strong></span>
      </section>
    </div>
  )
}
