import { useEffect, useMemo, useState } from 'react'
import {
  ApiError,
  getAIProviderModels,
  getAIProviders,
  reviewCode,
  type AIModel,
  type AIProvider,
  type CodeReviewResult,
} from '../../lib/api'
import './CodeReviewPage.css'

const focusOptions = [
  { value: 'security', label: 'Security' },
  { value: 'bugs', label: 'Bugs & correctness' },
  { value: 'quality', label: 'Code quality' },
  { value: 'performance', label: 'Performance' },
] as const

export function CodeReviewPage() {
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [models, setModels] = useState<Record<string, AIModel[]>>({})
  const [providerId, setProviderId] = useState('')
  const [modelId, setModelId] = useState('')
  const [language, setLanguage] = useState('auto-detect')
  const [code, setCode] = useState('')
  const [focus, setFocus] = useState<string[]>(['security', 'bugs', 'quality'])
  const [result, setResult] = useState<CodeReviewResult | null>(null)
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [reviewing, setReviewing] = useState(false)
  const [error, setError] = useState('')
  const [copyMessage, setCopyMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const nextProviders = await getAIProviders()
        const entries = await Promise.all(nextProviders.map(async (provider) => {
          try {
            return [provider.id, await getAIProviderModels(provider.id)] as const
          } catch {
            return [provider.id, [] as AIModel[]] as const
          }
        }))
        if (cancelled) return
        setProviders(nextProviders.filter((provider) => provider.enabled))
        setModels(Object.fromEntries(entries))
        const first = nextProviders.find((provider) => provider.enabled && (entries.find(([id]) => id === provider.id)?.[1].length ?? 0) > 0)
        if (first) {
          setProviderId(first.id)
          setModelId(entries.find(([id]) => id === first.id)?.[1][0]?.id ?? '')
        }
      } catch {
        if (!cancelled) setError('Could not load AI providers. Check your connection and provider settings.')
      } finally {
        if (!cancelled) setLoadingProviders(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const availableModels = useMemo(() => models[providerId] ?? [], [models, providerId])

  function changeProvider(nextId: string) {
    setProviderId(nextId)
    setModelId((models[nextId] ?? [])[0]?.id ?? '')
    setResult(null)
  }

  function toggleFocus(value: string) {
    setFocus((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value])
  }

  async function handleReview() {
    if (!providerId || !modelId || !code.trim() || focus.length === 0) return
    setReviewing(true)
    setError('')
    setCopyMessage('')
    setResult(null)
    try {
      setResult(await reviewCode(providerId, modelId, language, code, focus))
    } catch (err) {
      setError(err instanceof ApiError && err.status === 413
        ? 'The source is too large. Review a smaller section.'
        : err instanceof ApiError && err.status === 400
          ? 'The review request was invalid. Check your input and try again.'
          : 'Code review failed. Check the selected provider/model and try again.')
    } finally {
      setReviewing(false)
    }
  }

  function exportReport() {
    if (!result) return
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'cybermind-code-review.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function copyImprovedCode() {
    if (!result?.improved_code) return
    try {
      await navigator.clipboard.writeText(result.improved_code)
      setCopyMessage('Improved code copied to clipboard.')
    } catch {
      setCopyMessage('Clipboard access failed. Select and copy the code manually.')
    }
  }

  return (
    <div className="code-review-page">
      <header className="code-review-header">
        <div>
          <p className="section-kicker">Security analyst / source inspection</p>
          <h2>Code Reviewer</h2>
          <p>Find evidence-backed issues and receive an improved version of your code with concise explanations.</p>
        </div>
        <span className="code-review-privacy">Manual review · No code is sent until you click Review code</span>
      </header>

      <section className="project-detail-surface code-review-input-panel">
        <div className="project-analysis-heading">
          <div><p className="section-kicker">Review setup</p><h3>Choose model and source</h3></div>
          <span className="project-analysis-step">01 / Input</span>
        </div>
        <div className="project-analysis-controls">
          <label>AI provider
            <select value={providerId} onChange={(event) => changeProvider(event.target.value)} disabled={loadingProviders}>
              <option value="">Select provider</option>
              {providers.map((provider) => <option value={provider.id} key={provider.id}>{provider.name}</option>)}
            </select>
          </label>
          <label>AI model
            <select value={modelId} onChange={(event) => { setModelId(event.target.value); setResult(null) }} disabled={!providerId}>
              <option value="">Select model</option>
              {availableModels.map((model) => <option value={model.id} key={model.id}>{model.display_name}</option>)}
            </select>
          </label>
          <label>Language
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              {['auto-detect', 'Python', 'TypeScript', 'JavaScript', 'Java', 'C#', 'C/C++', 'Go', 'Rust', 'SQL', 'HTML/CSS', 'Other'].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>

        <fieldset className="code-review-focus">
          <legend>Review focus</legend>
          {focusOptions.map((option) => (
            <label key={option.value}>
              <input type="checkbox" checked={focus.includes(option.value)} onChange={() => toggleFocus(option.value)} />
              {option.label}
            </label>
          ))}
        </fieldset>

        <label className="code-review-source-label" htmlFor="code-review-source">Source code</label>
        <textarea
          id="code-review-source"
          className="code-review-source"
          value={code}
          onChange={(event) => { setCode(event.target.value); setResult(null) }}
          placeholder="Paste a function, file, or focused code snippet here…"
          maxLength={60000}
          spellCheck={false}
          rows={16}
        />
        <div className="code-review-input-footer">
          <span>{code.length.toLocaleString()} / 60,000 characters · Paste only code you are permitted to share with the selected AI provider.</span>
          <button type="button" className="dialog-submit-button" disabled={reviewing || !providerId || !modelId || !code.trim() || focus.length === 0} onClick={() => void handleReview()}>
            {reviewing ? 'Reviewing and improving…' : 'Review & improve code'}
          </button>
        </div>
        {loadingProviders && <p className="project-analysis-hint">Loading configured AI providers…</p>}
        {!loadingProviders && providers.length === 0 && <p className="project-analysis-hint">No enabled AI provider found. Configure one in Settings → AI Providers first.</p>}
        {error && <p className="project-form-error" role="alert">{error}</p>}
      </section>

      {result && (
        <section className="project-analysis-result project-detail-surface code-review-results" aria-live="polite">
          <div className="project-analysis-heading">
            <div><p className="section-kicker">Review results</p><h3>Findings and recommendations</h3><p>{result.summary}</p></div>
            <button type="button" className="dialog-submit-button code-review-export" onClick={exportReport}>Export JSON</button>
          </div>
          <div className="code-review-stats">
            <div><strong>{result.findings.length}</strong><span>Total findings</span></div>
            <div><strong>{result.findings.filter((item) => item.severity === 'critical' || item.severity === 'high').length}</strong><span>High priority</span></div>
            <div><strong>{result.language}</strong><span>Language</span></div>
          </div>

          {result.improved_code && (
            <section className="code-review-improved">
              <div className="project-analysis-heading">
                <div><p className="section-kicker">AI-generated revision</p><h3>Improved code</h3></div>
                <button type="button" className="dialog-submit-button" onClick={() => void copyImprovedCode()}>Copy improved code</button>
              </div>
              <p className="code-review-improved-note">Review this revision before using it. The model has not executed or tested the code.</p>
              {result.improvements_summary.length > 0 && (
                <ul className="code-review-improvement-list">
                  {result.improvements_summary.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
              )}
              <pre className="code-review-improved-source"><code>{result.improved_code}</code></pre>
              {copyMessage && <p className="project-analysis-hint" role="status">{copyMessage}</p>}
            </section>
          )}
          {!result.improved_code && <p className="project-analysis-hint">The model did not return a safe complete replacement for this input. Review the findings below and try a smaller, self-contained snippet if appropriate.</p>}

          {result.findings.length === 0 ? <p className="project-analysis-hint">No actionable findings were returned. This does not guarantee the code is secure or bug-free.</p> : (
            <div className="project-security-findings">
              {result.findings.map((finding, index) => (
                <article className="project-security-finding" key={finding.title + index}>
                  <div className="project-security-finding-top">
                    <strong>{finding.title}</strong>
                    <span className={`code-review-severity severity-${finding.severity}`}>{finding.severity}</span>
                  </div>
                  <p>{finding.category}{finding.line ? ` · Line ${finding.line}` : ''}</p>
                  {finding.evidence && <div><strong>Evidence</strong><pre className="code-review-evidence">{finding.evidence}</pre></div>}
                  {finding.explanation && <div><strong>Why it matters</strong><p>{finding.explanation}</p></div>}
                  {finding.recommendation && <div><strong>Recommendation</strong><p>{finding.recommendation}</p></div>}
                </article>
              ))}
            </div>
          )}
          {result.limitations.length > 0 && <div className="code-review-limitations"><strong>Limitations</strong><ul>{result.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
        </section>
      )}
    </div>
  )
}
