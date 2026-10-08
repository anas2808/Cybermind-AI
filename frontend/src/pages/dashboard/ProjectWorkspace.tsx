import { useEffect, useRef, useState } from 'react'
import {
  ApiError,
  analyzeProjectStructure,
  getAIProviderModels,
  getAIProviders,
  getProject,
  type AIModel,
  type AIProvider,
  type Project,
  type ProjectStructureAnalysis,
} from '../../lib/api'

type ProjectWorkspaceProps = {
  projectId: string
  onBack: () => void
  onProjectLoaded: (projectName: string) => void
}

export function ProjectWorkspace({ projectId, onBack, onProjectLoaded }: ProjectWorkspaceProps) {
  const [project, setProject] = useState<Project | null>(null)
  const [status, setStatus] = useState<'loading' | 'success' | 'not-found' | 'unauthorized' | 'error'>('loading')
  const [retryCount, setRetryCount] = useState(0)
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [models, setModels] = useState<Record<string, AIModel[]>>({})
  const [selectedProviderId, setSelectedProviderId] = useState('')
  const [selectedModelId, setSelectedModelId] = useState('')
  const [analysis, setAnalysis] = useState<ProjectStructureAnalysis | null>(null)
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [analysisError, setAnalysisError] = useState('')
  const requestedKeyRef = useRef('')

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
        setStatus(error instanceof ApiError && error.status === 404 ? 'not-found' : error instanceof ApiError && error.status === 401 ? 'unauthorized' : 'error')
        onProjectLoaded('')
      })
  }, [projectId, retryCount, onProjectLoaded])

  useEffect(() => {
    let cancelled = false
    getAIProviders()
      .then(async (nextProviders) => {
        if (cancelled) return
        setProviders(nextProviders)
        const entries = await Promise.all(nextProviders.map(async (provider) => [provider.id, await getAIProviderModels(provider.id)] as const))
        if (cancelled) return
        setModels(Object.fromEntries(entries))
        const firstProvider = nextProviders.find((provider) => (entries.find(([id]) => id === provider.id)?.[1].length || 0) > 0)
        if (firstProvider) {
          setSelectedProviderId(firstProvider.id)
          const firstModel = entries.find(([id]) => id === firstProvider.id)?.[1][0]
          setSelectedModelId(firstModel?.id || '')
        }
      })
      .catch(() => {
        if (!cancelled) setProviders([])
      })
    return () => { cancelled = true }
  }, [])

  const availableModels = selectedProviderId ? models[selectedProviderId] || [] : []

  function handleProviderChange(providerId: string) {
    setSelectedProviderId(providerId)
    setSelectedModelId((models[providerId] || [])[0]?.id || '')
  }

  async function handleStructureAnalysis() {
    if (!project || !selectedProviderId || !selectedModelId) return
    setAnalysisStatus('loading')
    setAnalysisError('')
    try {
      const result = await analyzeProjectStructure(project.id, selectedProviderId, selectedModelId)
      setAnalysis(result)
      setAnalysisStatus('idle')
    } catch (error: unknown) {
      setAnalysisStatus('error')
      setAnalysisError(error instanceof ApiError && error.status === 400
        ? 'Add a repository URL to this project before running structure analysis.'
        : 'Structure analysis failed. Check the provider connection and try again.')
    }
  }

  return (
    <div className="project-detail-page">
      <button type="button" className="project-back-button" onClick={onBack}>← Back to Projects</button>

      {status === 'loading' && (
        <section className="project-detail-surface project-detail-loading" role="status" aria-live="polite">
          <span className="loading-bar" /><span className="loading-bar loading-bar-short" /><span>Loading project...</span>
        </section>
      )}

      {status === 'success' && project && (
        <div className="project-workspace-shell">
          <header className="project-workspace-header">
            <div>
              <p className="section-kicker">Project workspace</p>
              <h2>{project.name}</h2>
              {project.description && <p className="project-detail-description">{project.description}</p>}
              <p className="project-repository-source">
                Repository: {project.repository_url || 'Not configured'}
              </p>
            </div>
            <span className="project-workspace-status">Workspace ready</span>
          </header>

          <nav className="project-workspace-nav" aria-label="Project workspace sections">
            {['Overview', 'Project Analysis', 'Code Review', 'Log Analysis', 'Threat Intelligence', 'Reports'].map((label) => (
              <button
                type="button"
                key={label}
                className={label === 'Project Analysis' ? 'project-workspace-nav-item project-workspace-nav-item-active' : 'project-workspace-nav-item'}
                disabled={label !== 'Project Analysis'}
                aria-current={label === 'Project Analysis' ? 'page' : undefined}
              >
                {label}
              </button>
            ))}
          </nav>

          <section className="project-analysis-control project-detail-surface" aria-labelledby="project-analysis-title">
            <div className="project-analysis-heading">
              <div>
                <p className="section-kicker">Simple analysis flow</p>
                <h3 id="project-analysis-title">Analyze project structure</h3>
                <p>Select the AI model for this analysis. The saved provider configuration is not changed.</p>
              </div>
              <span className="project-analysis-step">01 / Structure</span>
            </div>

            <div className="project-analysis-controls">
              <label>
                AI provider
                <select value={selectedProviderId} onChange={(event) => handleProviderChange(event.target.value)}>
                  <option value="">Select provider</option>
                  {providers.map((provider) => <option value={provider.id} key={provider.id}>{provider.name}</option>)}
                </select>
              </label>
              <label>
                AI model
                <select value={selectedModelId} onChange={(event) => setSelectedModelId(event.target.value)} disabled={!selectedProviderId}>
                  <option value="">Select model</option>
                  {availableModels.map((model) => <option value={model.id} key={model.id}>{model.display_name}</option>)}
                </select>
              </label>
              <button
                type="button"
                className="dialog-submit-button project-analysis-run"
                disabled={!project.repository_url || !selectedModelId || analysisStatus === 'loading'}
                onClick={() => void handleStructureAnalysis()}
              >
                {analysisStatus === 'loading' ? 'Analyzing...' : 'Analyze structure'}
              </button>
            </div>

            {!project.repository_url && <p className="project-analysis-hint">This project has no repository URL. Create a project with a public Git repository to start analysis.</p>}
            {providers.length === 0 && <p className="project-analysis-hint">No configured AI model is available. Add a provider in Settings → AI Providers first.</p>}
            {analysisError && <p className="project-form-error" role="alert">{analysisError}</p>}
          </section>

          {analysis && (
            <StructureResult analysis={analysis} />
          )}
        </div>
      )}

      {status === 'not-found' && <ProjectDetailError title="Project not found" message="This project may not exist or you may not have access to it." onRetry={() => setRetryCount((count) => count + 1)} onBack={onBack} />}
      {status === 'unauthorized' && <ProjectDetailError title="Your session has expired." message="Please sign in again to access this project." onRetry={() => setRetryCount((count) => count + 1)} onBack={onBack} />}
      {status === 'error' && <ProjectDetailError title="Unable to load project." message="Please check your connection and try again." onRetry={() => setRetryCount((count) => count + 1)} onBack={onBack} />}
    </div>
  )
}

function StructureResult({ analysis }: { analysis: ProjectStructureAnalysis }) {
  return (
    <section className="project-analysis-result project-detail-surface">
      <div className="project-analysis-heading">
        <div>
          <p className="section-kicker">Structure map</p>
          <h3>Project features</h3>
          <p>{analysis.summary}</p>
        </div>
        <span className="project-analysis-step">{analysis.features.length} features</span>
      </div>
      {analysis.technologies.length > 0 && (
        <div className="project-analysis-tech">
          {analysis.technologies.map((technology) => <span key={technology}>{technology}</span>)}
        </div>
      )}
      <div className="project-feature-list">
        {analysis.features.map((feature) => (
          <article className="project-feature-card" key={feature.name}>
            <div>
              <h4>{feature.name}</h4>
              <p>{feature.purpose || 'No additional purpose was provided.'}</p>
            </div>
            <div>
              <strong>Files</strong>
              <ul>{feature.files.map((file) => <li key={file}>{file}</li>)}</ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function ProjectDetailError({ title, message, onRetry, onBack }: { title: string; message: string; onRetry: () => void; onBack: () => void }) {
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
