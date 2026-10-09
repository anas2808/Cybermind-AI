import { useEffect, useRef, useState } from 'react'
import {
  ApiError,
  analyzeFeatureSecurity,
  analyzeProjectStructure,
  getAIProviderModels,
  getAIProviders,
  getProject,
  type AIModel,
  type AIProvider,
  type Project,
  type FeatureSecurityAnalysis,
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
  const [selectedFeature, setSelectedFeature] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [featureAnalysis, setFeatureAnalysis] = useState<FeatureSecurityAnalysis | null>(null)
  const [featureStatus, setFeatureStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [featureError, setFeatureError] = useState('')
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

  function toggleFile(file: string) {
    setSelectedFiles((current) => current.includes(file) ? current.filter((item) => item !== file) : [...current, file])
  }

  async function handleFeatureAnalysis() {
    if (!project || !selectedProviderId || !selectedModelId || !selectedFeature || selectedFiles.length === 0) return
    setFeatureStatus('loading')
    setFeatureError('')
    try {
      const result = await analyzeFeatureSecurity(project.id, selectedProviderId, selectedModelId, selectedFeature, selectedFiles)
      setFeatureAnalysis(result)
      setFeatureStatus('idle')
    } catch {
      setFeatureStatus('error')
      setFeatureError('Feature security analysis failed. Check the provider connection and try again.')
    }
  }

  async function handleStructureAnalysis() {
    if (!project || !selectedProviderId || !selectedModelId) return
    setAnalysisStatus('loading')
    setAnalysisError('')
    try {
      const result = await analyzeProjectStructure(project.id, selectedProviderId, selectedModelId)
      setAnalysis(result)
      setSelectedFeature('')
      setSelectedFiles([])
      setFeatureAnalysis(null)
      setFeatureStatus('idle')
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
            <>
              <StructureResult
                analysis={analysis}
                selectedFeature={selectedFeature}
                selectedFiles={selectedFiles}
                onFeatureChange={(feature) => {
                  setSelectedFeature(feature.name)
                  setSelectedFiles([])
                  setFeatureAnalysis(null)
                  setFeatureError('')
                }}
              />
              {selectedFeature && (
                <FeatureFileSelection
                  analysis={analysis}
                  selectedFeature={selectedFeature}
                  selectedFiles={selectedFiles}
                  onToggle={toggleFile}
                  onAnalyze={() => void handleFeatureAnalysis()}
                  isLoading={featureStatus === 'loading'}
                  error={featureError}
                />
              )}
            </>
          )}
          {featureAnalysis && <FeatureSecurityResult analysis={featureAnalysis} />}
        </div>
      )}

      {status === 'not-found' && <ProjectDetailError title="Project not found" message="This project may not exist or you may not have access to it." onRetry={() => setRetryCount((count) => count + 1)} onBack={onBack} />}
      {status === 'unauthorized' && <ProjectDetailError title="Your session has expired." message="Please sign in again to access this project." onRetry={() => setRetryCount((count) => count + 1)} onBack={onBack} />}
      {status === 'error' && <ProjectDetailError title="Unable to load project." message="Please check your connection and try again." onRetry={() => setRetryCount((count) => count + 1)} onBack={onBack} />}
    </div>
  )
}

function StructureResult({ analysis, selectedFeature, selectedFiles, onFeatureChange }: {
  analysis: ProjectStructureAnalysis
  selectedFeature: string
  selectedFiles: string[]
  onFeatureChange: (feature: ProjectStructureAnalysis['features'][number]) => void
}) {
  return (
    <section className="project-analysis-result project-detail-surface">
      <div className="project-analysis-heading">
        <div>
          <p className="section-kicker">Structure map</p>
          <h3>Select a feature</h3>
          <p>{analysis.summary}</p>
        </div>
        <span className="project-analysis-step">02 / Feature</span>
      </div>
      {analysis.technologies.length > 0 && (
        <div className="project-analysis-tech">
          {analysis.technologies.map((technology) => <span key={technology}>{technology}</span>)}
        </div>
      )}
      <div className="project-feature-list">
        {analysis.features.map((feature) => (
          <button type="button" className={selectedFeature === feature.name ? 'project-feature-card project-feature-card-selected' : 'project-feature-card'} key={feature.name} onClick={() => onFeatureChange(feature)}>
            <div><h4>{feature.name}</h4><p>{feature.purpose || 'No additional purpose was provided.'}</p></div>
            <div><strong>{feature.files.length} files</strong><p>{selectedFeature === feature.name ? selectedFiles.length + ' selected' : 'Select to review files'}</p></div>
          </button>
        ))}
      </div>
    </section>
  )
}

function FeatureFileSelection({ analysis, selectedFeature, selectedFiles, onToggle, onAnalyze, isLoading, error }: {
  analysis: ProjectStructureAnalysis
  selectedFeature: string
  selectedFiles: string[]
  onToggle: (file: string) => void
  onAnalyze: () => void
  isLoading: boolean
  error: string
}) {
  const feature = analysis.features.find((item) => item.name === selectedFeature)
  if (!feature) return null
  return (
    <section className="project-feature-selection project-detail-surface">
      <div className="project-analysis-heading">
        <div><p className="section-kicker">Selected feature</p><h3>{feature.name}</h3><p>Choose the exact files to send through GitIngest for security analysis.</p></div>
        <span className="project-analysis-step">03 / Files</span>
      </div>
      <div className="project-file-selection-list">
        {feature.files.map((file) => (
          <label key={file} className="project-file-selection-item">
            <input type="checkbox" checked={selectedFiles.includes(file)} onChange={() => onToggle(file)} />
            <span>{file}</span>
          </label>
        ))}
      </div>
      {error && <p className="project-form-error" role="alert">{error}</p>}
      <div className="project-feature-selection-actions">
        <span>{selectedFiles.length} selected</span>
        <button type="button" className="dialog-submit-button" disabled={selectedFiles.length === 0 || isLoading} onClick={onAnalyze}>
          {isLoading ? 'Analyzing feature...' : 'Analyze feature security'}
        </button>
      </div>
    </section>
  )
}

function downloadSecurityReport(analysis: FeatureSecurityAnalysis) {
  const generatedAt = new Date().toLocaleString()
  const lines = [
    `# CyberMind AI — Feature Security Report`,
    '',
    `- **Feature:** ${analysis.feature_name}`,
    `- **Generated:** ${generatedAt}`,
    `- **Files reviewed:** ${analysis.files.length}`,
    `- **Findings:** ${analysis.findings.length}`,
    '',
    '## Reviewed files',
    ...analysis.files.map((file) => `- ${file}`),
    '',
    '## Findings',
  ]

  if (analysis.findings.length === 0) {
    lines.push('', 'No security findings were returned for the selected files.')
  } else {
    analysis.findings.forEach((finding, index) => {
      lines.push(
        '',
        `### ${index + 1}. ${finding.title}`,
        '',
        `- **Severity:** ${finding.severity.toUpperCase()}`,
        '',
        finding.description || 'No description provided.',
        '',
        '**Evidence**',
        '',
        finding.evidence || 'No evidence provided.',
        '',
        '**Recommendation**',
        '',
        finding.recommendation || 'No recommendation provided.',
      )
    })
  }

  lines.push('', '---', 'Generated by CyberMind AI. Findings are AI-assisted and should be validated before remediation.')
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `cybermind-${analysis.feature_name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-security-report.md`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function FeatureSecurityResult({ analysis }: { analysis: FeatureSecurityAnalysis }) {
  const severityOrder = ['critical', 'high', 'medium', 'low', 'informational']
  const severityCounts = analysis.findings.reduce<Record<string, number>>((counts, finding) => {
    const severity = finding.severity.toLowerCase()
    counts[severity] = (counts[severity] || 0) + 1
    return counts
  }, {})
  const severitySummary = severityOrder.filter((severity) => severityCounts[severity])

  return (
    <section className="project-analysis-result project-detail-surface">
      <div className="project-analysis-heading">
        <div><p className="section-kicker">Security analysis</p><h3>{analysis.feature_name}</h3><p>Evidence is limited to the selected files. Validate AI-assisted findings before making changes.</p></div>
        <span className="project-analysis-step">{analysis.findings.length} findings</span>
      </div>
      <div className="project-feature-selection-actions">
        <span>{analysis.files.length} files reviewed</span>
        <button type="button" className="dialog-submit-button" onClick={() => downloadSecurityReport(analysis)}>Download Markdown report</button>
      </div>
      {severitySummary.length > 0 && (
        <div className="project-analysis-tech" aria-label="Finding counts by severity">
          {severitySummary.map((severity) => (
            <span key={severity}>{severity.toUpperCase()}: {severityCounts[severity]}</span>
          ))}
        </div>
      )}
      <div className="project-security-findings">
        {analysis.findings.length === 0 ? <p className="project-analysis-hint">No security findings were returned for the selected files.</p> : analysis.findings.map((finding, index) => (
          <article className="project-security-finding" key={finding.title + index}>
            <div className="project-security-finding-top"><strong>{finding.title}</strong><span>{finding.severity}</span></div>
            <p>{finding.description}</p>
            <div><strong>Evidence</strong><p>{finding.evidence}</p></div>
            <div><strong>Recommendation</strong><p>{finding.recommendation}</p></div>
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
