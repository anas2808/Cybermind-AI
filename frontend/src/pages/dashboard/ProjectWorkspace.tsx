import { useEffect, useState } from 'react'
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

  useEffect(() => {
    let isCurrent = true
    setProject(null)
    setStatus('loading')

    getProject(projectId)
      .then((nextProject) => {
        if (!isCurrent) return
        setProject(nextProject)
        setStatus('success')
        onProjectLoaded(nextProject.name)
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setStatus(error instanceof ApiError && error.status === 404
          ? 'not-found'
          : error instanceof ApiError && error.status === 401
            ? 'unauthorized'
            : 'error')
        onProjectLoaded('')
      })

    return () => {
      isCurrent = false
    }
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
        <section className="project-detail-surface" aria-labelledby="project-detail-title">
          <p className="section-kicker">Project workspace</p>
          <h2 id="project-detail-title">{project.name}</h2>
          {project.description && <p className="project-detail-description">{project.description}</p>}
          <div className="project-detail-context">
            <strong>Project Workspace</strong>
            <p>This is the workspace for this project.</p>
          </div>
        </section>
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
