import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ApiError,
  createAIProvider,
  deleteAIProvider,
  discoverAIProviderModels,
  getAIProviderModels,
  getAIProviders,
  testAIProvider,
  type AIModel,
  type AIProvider,
} from '../../lib/api'

type AIProvidersPageProps = {
  onProvidersChanged?: () => void
}

function providerMeta(provider: AIProvider) {
  const name = provider.name.toLowerCase()
  if (provider.provider_type === 'ollama' || name.includes('ollama')) {
    return { label: 'LOCAL', icon: 'llama', category: 'Local models', description: 'Run open-source models locally on your machine or server.' }
  }
  if (name.includes('phone') || name.includes('mobile')) {
    return { label: 'LOCAL NETWORK', icon: 'phone', category: 'Local network', description: 'AI service available on your local network.' }
  }
  if (name.includes('openai') && !name.includes('compatible')) {
    return { label: 'CLOUD', icon: 'openai', category: 'Cloud API', description: 'Connect to an OpenAI API endpoint.' }
  }
  if (name.includes('anthropic') || name.includes('claude')) {
    return { label: 'CLOUD', icon: 'anthropic', category: 'Cloud API', description: 'Connect to an Anthropic-compatible endpoint.' }
  }
  if (provider.provider_type === 'openai_compatible') {
    return { label: 'API', icon: 'compatible', category: 'OpenAI-compatible endpoint', description: 'Connect to a cloud, LAN, or self-hosted compatible API.' }
  }
  return { label: 'CUSTOM', icon: 'custom', category: 'Custom endpoint', description: 'Connect to a custom AI service endpoint.' }
}

function ProviderLogo({ kind }: { kind: string }) {
  if (kind === 'anthropic') {
    return <span className="ai-provider-logo ai-provider-logo-anthropic" aria-hidden="true">A</span>
  }
  return (
    <span className={`ai-provider-logo ai-provider-logo-${kind}`} aria-hidden="true">
      {kind === 'phone' ? '▯' : kind === 'openai' ? '◎' : kind === 'llama' ? '◉' : kind === 'compatible' ? '⬡' : kind === 'custom' ? '↗' : 'AI'}
    </span>
  )
}

function timeSince(value: string | null) {
  if (!value) return '—'
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return '—'
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export function AIProvidersPage({ onProvidersChanged }: AIProvidersPageProps) {
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [models, setModels] = useState<Record<string, AIModel[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [testingId, setTestingId] = useState('')
  const [discoveringId, setDiscoveringId] = useState('')
  const [deletingId, setDeletingId] = useState('')

  async function loadProviders(showInitialLoading = true) {
    if (showInitialLoading) setIsLoading(true)
    setError('')
    try {
      const nextProviders = await getAIProviders()
      setProviders(nextProviders)
      const modelEntries = await Promise.all(
        nextProviders.map(async (provider) => [provider.id, await getAIProviderModels(provider.id)] as const),
      )
      setModels(Object.fromEntries(modelEntries))
    } catch (requestError) {
      setError(requestError instanceof ApiError && requestError.status === 401
        ? 'Your session has expired. Please sign in again.'
        : 'We could not load your AI providers. Try again.')
    } finally {
      if (showInitialLoading) setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadProviders()
  }, [])

  async function handleTest(providerId: string) {
    setTestingId(providerId)
    setError('')
    try {
      await testAIProvider(providerId)
      await loadProviders(false)
      onProvidersChanged?.()
    } catch {
      setError('Connection test failed. Check the endpoint and credentials.')
      await loadProviders(false)
    } finally {
      setTestingId('')
    }
  }

  async function handleDiscover(providerId: string) {
    setDiscoveringId(providerId)
    setError('')
    try {
      const discovered = await discoverAIProviderModels(providerId)
      setModels((current) => ({ ...current, [providerId]: discovered }))
    } catch {
      setError('Model discovery failed. Test the provider connection and try again.')
    } finally {
      setDiscoveringId('')
    }
  }

  async function handleDelete(providerId: string) {
    if (!window.confirm('Remove this AI provider and its discovered models?')) return
    setDeletingId(providerId)
    setError('')
    try {
      await deleteAIProvider(providerId)
      setProviders((current) => current.filter((provider) => provider.id !== providerId))
      setModels((current) => {
        const next = { ...current }
        delete next[providerId]
        return next
      })
      onProvidersChanged?.()
    } catch {
      setError('We could not remove this provider. Try again.')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <section className="ai-providers-page">
      <header className="ai-providers-intro">
        <div>
          <p className="section-kicker">AI configuration</p>
          <h2>AI Providers</h2>
          <p>Connect the AI services you want available to CyberMind analysis. Saved providers stay separate from the model selected for an individual analysis.</p>
        </div>
        <button type="button" className="projects-create-button" onClick={() => setShowAdd(true)}>
          Add AI Provider
        </button>
      </header>

      {error && <p className="dashboard-alert" role="alert">{error}</p>}

      <div className="ai-provider-note">
        <strong>Provider management</strong>
        <span>Connection status and discovered models are live. No provider is selected or changed by this page.</span>
      </div>

      {isLoading ? (
        <div className="projects-loading" aria-live="polite">
          <span className="loading-bar" />
          <span className="loading-bar loading-bar-short" />
          Loading AI providers...
        </div>
      ) : providers.length === 0 ? (
        <div className="ai-provider-empty">
          <div className="projects-empty-icon" aria-hidden="true">+</div>
          <div>
            <strong>No AI providers configured</strong>
            <p>Add an Ollama, cloud, LAN, or custom AI endpoint to make a model available for project analysis.</p>
          </div>
        </div>
      ) : (
        <div className="ai-provider-list">
          {providers.map((provider) => {
            const meta = providerMeta(provider)
            const providerModels = models[provider.id] || []
            return (
              <article className="ai-provider-card" key={provider.id}>
                <div className="ai-provider-card-head">
                  <div className="ai-provider-identity">
                    <ProviderLogo kind={meta.icon} />
                    <div className="ai-provider-heading">
                      <div className="ai-provider-title-row">
                        <h3>{provider.name}</h3>
                        <span className={`ai-provider-kind ${meta.icon === 'phone' ? 'kind-green' : meta.icon === 'anthropic' ? 'kind-orange' : 'kind-blue'}`}>
                          {meta.category}
                        </span>
                      </div>
                      <span className={provider.connection_status === 'connected' ? 'ai-provider-status ai-provider-status-ok' : 'ai-provider-status'}>
                        <i aria-hidden="true" />
                        {provider.connection_status === 'connected' ? 'Connected' : provider.connection_status || 'Not tested'}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="ai-provider-description">{meta.description}</p>
                <div className="ai-provider-details">
                  <div className="ai-provider-detail-row">
                    <span className="detail-icon" aria-hidden="true">⚙</span><span>Endpoint</span><strong title={provider.endpoint}>{provider.endpoint}</strong>
                  </div>
                  <div className="ai-provider-detail-row">
                    <span className="detail-icon" aria-hidden="true">⬡</span><span>Models</span><strong>{providerModels.length} {providerModels.length === 1 ? 'model' : 'models'}</strong>
                  </div>
                  <div className="ai-provider-detail-row">
                    <span className="detail-icon" aria-hidden="true">◷</span><span>Last tested</span><strong>{timeSince(provider.last_tested_at)}</strong>
                  </div>
                </div>
                <div className="ai-provider-actions">
                  <button type="button" onClick={() => void handleTest(provider.id)} disabled={testingId === provider.id}>
                    {testingId === provider.id ? 'Testing...' : 'Test'}
                  </button>
                  <button type="button" onClick={() => void handleDiscover(provider.id)} disabled={discoveringId === provider.id}>
                    {discoveringId === provider.id ? 'Discovering...' : 'Discover models'}
                  </button>
                  <button type="button" className="ai-provider-remove" onClick={() => void handleDelete(provider.id)} disabled={deletingId === provider.id}>
                    {deletingId === provider.id ? 'Removing...' : 'Remove'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {!isLoading && (
        <section className="ai-provider-add-panel" aria-labelledby="ai-provider-add-heading">
          <div className="ai-provider-add-copy">
            <div className="ai-provider-add-icon" aria-hidden="true">⚙</div>
            <div>
              <h3 id="ai-provider-add-heading">Add New AI Provider</h3>
              <p>Connect to any AI provider - local, cloud, or custom endpoint.</p>
            </div>
          </div>
          <div className="ai-provider-add-options">
            <button type="button" className="tile-blue" onClick={() => setShowAdd(true)}>
              <span className="ai-provider-option-icon">◉</span><span><strong>Ollama</strong><small>Local models</small></span>
            </button>
            <button type="button" className="tile-green" onClick={() => setShowAdd(true)}>
              <span className="ai-provider-option-icon">⬡</span><span><strong>OpenAI Compatible</strong><small>(Any API endpoint)</small></span>
            </button>
            <button type="button" className="tile-blue" onClick={() => setShowAdd(true)}>
              <span className="ai-provider-option-icon">◎</span><span><strong>OpenAI</strong><small>(Official API)</small></span>
            </button>
            <button type="button" className="tile-orange" onClick={() => setShowAdd(true)}>
              <span className="ai-provider-option-icon">A</span><span><strong>Anthropic</strong><small>Claude models</small></span>
            </button>
            <button type="button" className="tile-neutral" onClick={() => setShowAdd(true)}>
              <span className="ai-provider-option-icon">↗</span><span><strong>Custom Endpoint</strong><small>HTTP endpoint</small></span>
            </button>
          </div>
        </section>
      )}

      {showAdd && (
        <AddProviderDialog
          onClose={() => setShowAdd(false)}
          onCreated={async () => {
            setShowAdd(false)
            await loadProviders(false)
            onProvidersChanged?.()
          }}
        />
      )}
    </section>
  )
}

function AddProviderDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [providerType, setProviderType] = useState('openai_compatible')
  const [endpoint, setEndpoint] = useState('https://api.example.com/v1')
  const [apiKey, setApiKey] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSaving) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSaving, onClose])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanName = name.trim()
    const cleanEndpoint = endpoint.trim()
    if (!cleanName || !cleanEndpoint) {
      setError('Provider name and endpoint are required.')
      return
    }

    setIsSaving(true)
    setError('')
    try {
      await createAIProvider({
        name: cleanName,
        provider_type: providerType.trim(),
        endpoint: cleanEndpoint,
        auth_type: apiKey.trim() ? 'api_key' : 'none',
        credentials: apiKey.trim() ? { api_key: apiKey.trim() } : undefined,
      })
      await onCreated()
    } catch {
      setError('We could not save this provider. Check the values and try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="project-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) onClose() }}>
      <section className="project-dialog ai-provider-dialog" role="dialog" aria-modal="true" aria-labelledby="add-ai-provider-title">
        <div className="project-dialog-heading">
          <div>
            <p className="section-kicker">AI configuration</p>
            <h3 id="add-ai-provider-title">Connect an AI provider</h3>
            <p className="ai-provider-dialog-subtitle">Add a local, cloud, LAN, or compatible AI endpoint to CyberMind.</p>
          </div>
          <button type="button" className="dialog-close-button" aria-label="Close dialog" onClick={onClose} disabled={isSaving}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <label htmlFor="ai-provider-name">Name</label>
          <input id="ai-provider-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="My Ollama" autoFocus />
          <div className="ai-provider-dialog-label">Connection type</div>
          <div className="ai-provider-type-options" role="radiogroup" aria-label="AI provider connection type">
            <button type="button" className={providerType === 'ollama' ? 'ai-provider-type-option ai-provider-type-option-active' : 'ai-provider-type-option'} onClick={() => setProviderType('ollama')}>
              <span className="ai-provider-option-icon">O</span><span><strong>Ollama</strong><small>Local runtime</small></span>
            </button>
            <button type="button" className={providerType === 'openai_compatible' ? 'ai-provider-type-option ai-provider-type-option-active' : 'ai-provider-type-option'} onClick={() => setProviderType('openai_compatible')}>
              <span className="ai-provider-option-icon">A</span><span><strong>OpenAI-compatible</strong><small>Cloud or LAN API</small></span>
            </button>
          </div>
          <p className="field-message">Select the API protocol exposed by your service. The provider name is only a label; CyberMind stays vendor-neutral.</p>
          <label htmlFor="ai-provider-endpoint">Endpoint</label>
          <input id="ai-provider-endpoint" type="url" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder={providerType === 'ollama' ? 'http://localhost:11434' : 'https://api.example.com/v1'} />
          <label htmlFor="ai-provider-key">API key <span className="ai-provider-optional">(optional)</span></label>
          <input id="ai-provider-key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Stored encrypted by the backend" autoComplete="new-password" />
          {error && <p className="project-form-error" role="alert">{error}</p>}
          <div className="project-dialog-actions">
            <button type="button" className="dialog-cancel-button" onClick={onClose} disabled={isSaving}>Cancel</button>
            <button type="submit" className="dialog-submit-button" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save provider'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}
