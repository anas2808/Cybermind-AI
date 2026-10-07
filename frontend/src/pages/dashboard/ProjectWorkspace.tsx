import { useEffect, useRef, useState } from 'react'
import { ApiError, getProject, type Project } from '../../lib/api'

type ProjectWorkspaceProps = {
  projectId: string
  onBack: () => void
  onProjectLoaded: (projectName: string) => void
}

export function ProjectWorkspace({ projectId, onBack, onProjectLoaded }: ProjectWorkspaceProps) {
  const [project, setProject] = useState<Project | null>(null)
  const [status, setStatus] = useState<'loading' | 'success' | 'not-found' | 'unauthorized' | 'error'>('loading')
  const [retryCount, setRetryCount] = useState(0)
  const requestedKeyRef = useRef('')
  const workspaceSections = [
    { label: 'Overview', active: true },
    { label: 'Code Review', active: false },
    { label: 'Log Analysis', active: false },
    { label: 'Threat Intelligence', active: false },
    { label: 'Security Analysis', active: false },
    { label: 'Reports', active: false },
  ]

  useEffect(() => {
    const requestKey = `${projectId}:${retryCount}`
    if (requestedKeyRef.current === requestKey) return
    requestedKeyRef.current = requestKey

    setProject(null)
    setStatus('loading')

    getProject(projectId)
      .then((nextProject) => {
        if (requestedKeyRef.current !== requestKey) return
        setProject(nextProject)
        setStatus('success')
        onProjectLoaded(nextProject.name)
      })
      .catch((error: unknown) => {
        if (requestedKeyRef.current !== requestKey) return
        setStatus(error instanceof ApiError && error.status === 404
          ? 'not-found'
          : error instanceof ApiError && error.status === 401
            ? 'unauthorized'
            : 'error')
        onProjectLoaded('')
      })
  }, [projectId, retryCount, onProjectLoaded])

  return (
    <div className="project-detail-page">
      <button type="button" className="project-back-button" onClick={onBack}>
        ← Back to Projects
      </button>

      {status === 'loading' && (
        <section className="project-detail-surface project-detail-loading" role="status" aria-live="polite">
          <span className="loading-bar" />
          <span className="loading-bar loading-bar-short" />
          <span>Loading project...</span>
        </section>
      )}

      {status === 'success' && project && (
        <div className="project-workspace-shell">
          <header className="project-workspace-header">
            <div>
              <p className="section-kicker">Project workspace</p>
              <h2 id="project-detail-title">{project.name}</h2>
              {project.description && <p className="project-detail-description">{project.description}</p>}
            </div>
            <span className="project-workspace-status">Workspace ready</span>
          </header>

          <nav className="project-workspace-nav" aria-label="Project workspace sections">
            {workspaceSections.map((section) => (
              <button
                type="button"
                className={section.active ? 'project-workspace-nav-item project-workspace-nav-item-active' : 'project-workspace-nav-item'}
                key={section.label}
                disabled={!section.active}
                aria-current={section.active ? 'page' : undefined}
              >
                {section.label}
              </button>
            ))}
          </nav>

          <section className="project-detail-surface project-overview-surface" aria-labelledby="project-overview-title">
            <p className="section-kicker">Overview</p>
            <h3 id="project-overview-title">Ready for security analysis</h3>
            <p className="project-overview-copy">
              This workspace is ready to organize future security analysis for {project.name}.
            </p>
            <div className="project-capability-note">
              <strong>Analysis workspace</strong>
              <p>Code review, log analysis, threat intelligence, and reporting will be connected in future phases.</p>
            </div>
          </section>
        </div>
      )}

      {status === 'not-found' && (
        <ProjectDetailError
          title="Project not found"
          message="This project may not exist or you may not have access to it."
          onRetry={() => setRetryCount((count) => count + 1)}
          onBack={onBack}
        />
      )}

      {status === 'unauthorized' && (
        <ProjectDetailError
          title="Your session has expired."
          message="Please sign in again to access this project."
          onRetry={() => setRetryCount((count) => count + 1)}
          onBack={onBack}
        />
      )}

      {status === 'error' && (
        <ProjectDetailError
          title="Unable to load project."
          message="Please check your connection and try again."
          onRetry={() => setRetryCount((count) => count + 1)}
          onBack={onBack}
        />
      )}
    </div>
  )
}

function ProjectDetailError({
  title,
  message,
  onRetry,
  onBack,
}: {
  title: string
  message: string
  onRetry: () => void
  onBack: () => void
}) {
  return (
    <section className="project-detail-surface project-detail-error" role="alert">
      <p className="section-kicker">Project workspace</p>
      <h2>{title}</h2>
      <p>{message}</p>
      <div className="project-detail-actions">
        <button type="button" onClick={onRetry}>Retry</button>
        <button type="button" onClick={onBack}>Back to Projects</button>
      </div>
    </section>
  )
}
