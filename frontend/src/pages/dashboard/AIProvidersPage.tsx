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

export function AIProvidersPage({ onProvidersChanged }: AIProvidersPageProps) {
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [models, setModels] = useState<Record<string, AIModel[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [testingId, setTestingId] = useState('')
  const [discoveringId, setDiscoveringId] = useState('')
  const [deletingId, setDeletingId] = useState('')

  async function loadProviders() {
    setIsLoading(true)
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
      setIsLoading(false)
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
      await loadProviders()
      onProvidersChanged?.()
    } catch {
      setError('Connection test failed. Check the endpoint and credentials.')
      await loadProviders()
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
            <p>Add an Ollama, cloud, LAN, phone, or custom AI endpoint to make a model available for project analysis.</p>
          </div>
        </div>
      ) : (
        <div className="ai-provider-list">
          {providers.map((provider) => (
            <article className="ai-provider-card" key={provider.id}>
              <div className="ai-provider-card-head">
                <div>
                  <p className="ai-provider-type">{provider.provider_type}</p>
                  <h3>{provider.name}</h3>
                  <p className="ai-provider-endpoint">{provider.endpoint}</p>
                </div>
                <span className={provider.connection_status === 'connected' ? 'ai-provider-status ai-provider-status-ok' : 'ai-provider-status'}>
                  <i aria-hidden="true" />
                  {provider.connection_status}
                </span>
              </div>

              <div className="ai-provider-actions">
                <button type="button" onClick={() => void handleTest(provider.id)} disabled={testingId === provider.id}>
                  {testingId === provider.id ? 'Testing...' : 'Test connection'}
                </button>
                <button type="button" onClick={() => void handleDiscover(provider.id)} disabled={discoveringId === provider.id}>
                  {discoveringId === provider.id ? 'Discovering...' : 'Discover models'}
                </button>
                <button type="button" className="ai-provider-remove" onClick={() => void handleDelete(provider.id)} disabled={deletingId === provider.id}>
                  {deletingId === provider.id ? 'Removing...' : 'Remove'}
                </button>
              </div>

              <div className="ai-provider-models">
                <div className="ai-provider-models-head">
                  <strong>Available models</strong>
                  <span>{(models[provider.id] || []).length}</span>
                </div>
                {(models[provider.id] || []).length > 0 ? (
                  <ul>
                    {(models[provider.id] || []).map((model) => (
                      <li key={model.id}>
                        <span>
                          <strong>{model.display_name}</strong>
                          <small>{model.model_id}</small>
                        </span>
                        <em>{model.availability}</em>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No models discovered yet. Use “Discover models” to query this provider.</p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {showAdd && (
        <AddProviderDialog
          onClose={() => setShowAdd(false)}
          onCreated={async () => {
            setShowAdd(false)
            await loadProviders()
            onProvidersChanged?.()
          }}
        />
      )}
    </section>
  )
}

function AddProviderDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [providerType, setProviderType] = useState('ollama')
  const [endpoint, setEndpoint] = useState('http://localhost:11434')
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
            <p className="section-kicker">Provider setup</p>
            <h3 id="add-ai-provider-title">Add AI Provider</h3>
          </div>
          <button type="button" className="dialog-close-button" aria-label="Close dialog" onClick={onClose} disabled={isSaving}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <label htmlFor="ai-provider-name">Name</label>
          <input id="ai-provider-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="My Ollama" autoFocus />
          <label htmlFor="ai-provider-type">Provider type</label>
          <input id="ai-provider-type" value={providerType} onChange={(event) => setProviderType(event.target.value)} placeholder="ollama" />
          <p className="field-message">Use a provider adapter type supported by the backend. Ollama is available in this first implementation.</p>
          <label htmlFor="ai-provider-endpoint">Endpoint</label>
          <input id="ai-provider-endpoint" type="url" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="http://localhost:11434" />
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
