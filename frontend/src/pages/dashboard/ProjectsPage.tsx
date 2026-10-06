import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, createProject, type Project } from '../../lib/api'

type ProjectsPageProps = {
  projects: Project[]
  apiStatus: 'loading' | 'success' | 'unauthorized' | 'error'
  onRetry: () => void
  onProjectCreated: () => void
}

export function ProjectsPage({ projects, apiStatus, onRetry, onProjectCreated }: ProjectsPageProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    if (!isCreateOpen) return
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isCreating) setIsCreateOpen(false)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isCreateOpen, isCreating])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setFormError('Project name is required.')
      return
    }

    setFormError('')
    setIsCreating(true)
    try {
      await createProject(trimmedName, description.trim())
      onProjectCreated()
      setName('')
      setDescription('')
      setIsCreateOpen(false)
      setSuccessMessage('Project created. Your project has been added to the workspace.')
    } catch (error: unknown) {
      setFormError(error instanceof ApiError && error.status === 401
        ? 'Your session has expired. Please sign in again.'
        : 'We could not create the project. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="projects-page">
      <section className="projects-page-intro">
        <div>
          <p className="section-kicker">Project workspace</p>
          <h2>Projects</h2>
          <p>Manage and organize your security analysis projects.</p>
        </div>
        <button type="button" className="projects-create-button" onClick={() => { setSuccessMessage(''); setFormError(''); setIsCreateOpen(true) }}>
          Create Project
        </button>
      </section>
      {successMessage && <p className="project-success-message" role="status">{successMessage}</p>}

      <section className="projects-list-panel" aria-labelledby="projects-list-title">
        <div className="projects-list-heading">
          <div>
            <p className="section-kicker">Workspace projects</p>
            <h3 id="projects-list-title">Your security projects</h3>
          </div>
          {apiStatus === 'success' && <span className="project-list-count">{projects.length}</span>}
        </div>

        {apiStatus === 'loading' && (
          <div className="projects-loading" role="status" aria-live="polite">
            <span className="loading-bar" />
            <span className="loading-bar loading-bar-short" />
            <span>Loading projects...</span>
          </div>
        )}

        {apiStatus === 'unauthorized' && (
          <ProjectErrorState message="Your session was not accepted by the API." onRetry={onRetry} />
        )}

        {apiStatus === 'error' && (
          <ProjectErrorState message="Unable to load projects. Please check your connection and try again." onRetry={onRetry} />
        )}

        {apiStatus === 'success' && projects.length === 0 && (
          <div className="projects-empty-state">
            <span className="projects-empty-icon">□</span>
            <div>
              <strong>NO PROJECTS YET</strong>
              <p>Your security workspace is ready. Create your first project to begin organizing security analysis.</p>
            </div>
          </div>
        )}

        {apiStatus === 'success' && projects.length > 0 && (
          <div className="projects-list">
            {projects.map((project) => (
              <article className="project-workspace-row" key={project.id}>
                <span className="project-file-icon">▤</span>
                <div className="project-workspace-copy">
                  <h4>{project.name}</h4>
                  <p>{project.description || 'Security analysis project.'}</p>
                  <span><i /> Active project</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {apiStatus === 'success' && projects.length === 0 && (
        <button type="button" className="empty-create-button" onClick={() => { setFormError(''); setIsCreateOpen(true) }}>
          Create Project
        </button>
      )}
      {isCreateOpen && (
        <div className="project-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isCreating) setIsCreateOpen(false) }}>
          <section className="project-dialog" role="dialog" aria-modal="true" aria-labelledby="create-project-title">
            <div className="project-dialog-heading">
              <div>
                <p className="section-kicker">New workspace project</p>
                <h3 id="create-project-title">Create Project</h3>
              </div>
              <button type="button" className="dialog-close-button" onClick={() => setIsCreateOpen(false)} disabled={isCreating} aria-label="Close dialog">×</button>
            </div>
            <form onSubmit={handleCreate}>
              <label htmlFor="project-name">Project name *</label>
              <input id="project-name" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
              <label htmlFor="project-description">Description</label>
              <textarea id="project-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} />
              {formError && <p className="project-form-error" role="alert">{formError}</p>}
              <div className="project-dialog-actions">
                <button type="button" className="dialog-cancel-button" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>Cancel</button>
                <button type="submit" className="dialog-submit-button" disabled={isCreating}>{isCreating ? 'Creating project...' : 'Create Project'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

function ProjectErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="projects-error-state" role="alert">
      <strong>Projects unavailable</strong>
      <p>{message}</p>
      <button type="button" onClick={onRetry}>Retry</button>
    </div>
  )
}
