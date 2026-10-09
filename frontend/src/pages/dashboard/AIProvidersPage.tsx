import { useEffect, useState } from 'react'
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  ApiError,
  createAIProvider,
  deleteAIProvider,
  discoverAIProviderModels,
  getAIProviderModels,
  getAIProviders,
  testAIProvider,
  updateAIProvider,
  type AIModel,
  type AIProvider,
} from '../../lib/api'

type AIProvidersPageProps = { onProvidersChanged?: () => void }
type IconName = 'gear' | 'plus' | 'edit' | 'play' | 'llama' | 'openai' | 'cube' | 'link' | 'clock' | 'endpoint' | 'models'

const iconPaths: Record<IconName, string> = {
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20l1-4L16 5l3 3L8 19zM14 7l3 3',
  play: 'M7 4l13 8-13 8z',
  llama: 'M8 3v5M16 3v5M6 8h12a2 2 0 0 1 2 2v5a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6v-5a2 2 0 0 1 2-2zM10.5 16c.9.6 2.1.6 3 0M9.5 12h.01M14.5 12h.01',
  openai: 'M12 3.2a4 4 0 0 1 3.8 2.7 4 4 0 0 1 3.5 5.9 4 4 0 0 1-2.3 5.6 4 4 0 0 1-5 3.4 4 4 0 0 1-5.8-3A4 4 0 0 1 4 10.2 4 4 0 0 1 6 5.6a4 4 0 0 1 6-2.4zM12 8.2l3.2 1.9v3.8L12 15.8l-3.2-1.9v-3.8z',
  cube: 'M12 2.5l8.5 4.9v9.2L12 21.5l-8.5-4.9V7.4zM3.5 7.4L12 12.3l8.5-4.9M12 12.3v9.2',
  link: 'M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0-9-9zM12 7v5l3 2',
  endpoint: 'M5 12h14M12 5l7 7-7 7',
  models: 'M4 4h16v16H4zM8 8h8M8 12h8M8 16h5',
}

function Icon({ name, size = 18, fill = false }: { name: IconName; size?: number; fill?: boolean }) {
  return <svg className="ai-reference-icon" width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} aria-hidden="true"><path d={iconPaths[name]} /></svg>
}

function providerMeta(provider: AIProvider) {
  if (provider.provider_type === 'ollama') return { label: 'Local', tone: 'blue', icon: 'llama' as IconName, description: 'Local Ollama runtime.' }
  if (provider.provider_type === 'openai_compatible') return { label: 'OpenAI Compatible', tone: 'blue', icon: 'openai' as IconName, description: 'OpenAI-compatible API endpoint.' }
  return { label: provider.provider_type, tone: 'neutral', icon: 'cube' as IconName, description: 'Configured AI endpoint.' }
}

type ProviderBrand = { label: string; slug: string }

const PROVIDER_BRANDS: Array<{ label: string; slug: string; matches: RegExp }> = [
  { label: 'Ollama', slug: 'ollama', matches: /\bollama\b/ },
  { label: 'OpenAI', slug: 'openai', matches: /\b(openai|gpt-4|gpt-3|chatgpt)\b/ },
  { label: 'Anthropic', slug: 'anthropic', matches: /\b(anthropic|claude)\b/ },
  { label: 'Google Gemini', slug: 'googlegemini', matches: /\b(gemini|google ai|google generative)\b/ },
  { label: 'Meta', slug: 'meta', matches: /\b(meta|llama)\b/ },
  { label: 'Mistral AI', slug: 'mistralai', matches: /\b(mistral|mixtral|codestral)\b/ },
  { label: 'DeepSeek', slug: 'deepseek', matches: /\bdeepseek\b/ },
  { label: 'Cohere', slug: 'cohere', matches: /\bcohere\b/ },
  { label: 'Hugging Face', slug: 'huggingface', matches: /\b(hugging ?face|hf inference)\b/ },
  { label: 'Groq', slug: 'groq', matches: /\bgroq\b/ },
  { label: 'Perplexity', slug: 'perplexity', matches: /\bperplexity\b/ },
  { label: 'xAI', slug: 'x', matches: /\b(xai|grok)\b/ },
  { label: 'Qwen', slug: 'qwen', matches: /\b(qwen|alibaba cloud)\b/ },
  { label: 'Microsoft Azure', slug: 'microsoftazure', matches: /\b(azure openai|microsoft azure)\b/ },
  { label: 'Amazon Bedrock', slug: 'amazonaws', matches: /\b(amazon bedrock|aws bedrock)\b/ },
]

function getProviderBrand(provider: AIProvider): ProviderBrand | null {
  // Prefer the user-entered provider name first. Generic compatibility paths
  // such as "/openai/v1" do not mean the service is actually OpenAI.
  const name = provider.name.toLowerCase()
  const nameMatch = PROVIDER_BRANDS.find((brand) => brand.matches.test(name))
  if (nameMatch) return nameMatch

  // Inspect the hostname separately before the full URL. For example,
  // api.groq.com/openai/v1 is Groq even though its path contains "openai".
  try {
    const hostname = new URL(provider.endpoint).hostname.toLowerCase()
    const hostMatch = PROVIDER_BRANDS.find((brand) => brand.matches.test(hostname))
    if (hostMatch) return hostMatch
  } catch {
    // A malformed or relative endpoint can still be matched below.
  }

  const endpoint = provider.endpoint.toLowerCase()
  return PROVIDER_BRANDS.find((brand) => brand.matches.test(endpoint)) || null
}

function ProviderBrandIcon({ provider, fallback, size = 27 }: { provider: AIProvider; fallback: IconName; size?: number }) {
  const brand = getProviderBrand(provider)
  const [sourceIndex, setSourceIndex] = useState(0)

  if (!brand || sourceIndex > 2) return <Icon name={fallback} size={size} />

  // Try independent hosts and an explicit icon color. Some browser/network
  // configurations block one CDN; provider identity remains dynamically mapped.
  const sources = [
    `https://cdn.simpleicons.org/${brand.slug}/111820`,
    `https://cdn.jsdelivr.net/npm/simple-icons@v14/icons/${brand.slug}.svg`,
    `https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/${brand.slug}.svg`,
  ]

  return <img
    className="ai-reference-brand-image"
    src={sources[sourceIndex]}
    alt=""
    aria-label={`${brand.label} logo`}
    title={`${brand.label} logo`}
    width={size}
    height={size}
    loading="eager"
    referrerPolicy="no-referrer"
    onError={() => setSourceIndex((current) => current + 1)}
  />
}

function formatLastTested(value: string | null) {
  if (!value) return 'Not tested'
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000))
  if (Number.isNaN(minutes)) return 'Not tested'
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  return `${hours} hour${hours === 1 ? '' : 's'} ago`
}

export function AIProvidersPage({ onProvidersChanged }: AIProvidersPageProps) {
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [models, setModels] = useState<Record<string, AIModel[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialogProvider, setDialogProvider] = useState<AIProvider | null | undefined>(undefined)
  const [testingId, setTestingId] = useState('')
  const [discoveringId, setDiscoveringId] = useState('')
  const [deletingId, setDeletingId] = useState('')

  async function loadProviders(showLoading = true) {
    if (showLoading) setIsLoading(true)
    setError('')
    try {
      const nextProviders = await getAIProviders()
      setProviders(nextProviders)
      const entries = await Promise.all(nextProviders.map(async (provider) => [provider.id, await getAIProviderModels(provider.id)] as const))
      setModels(Object.fromEntries(entries))
    } catch (requestError) {
      setError(requestError instanceof ApiError && requestError.status === 401 ? 'Your session has expired. Please sign in again.' : 'We could not load your AI providers. Try again.')
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }

  useEffect(() => { void loadProviders() }, [])

  async function handleTest(providerId: string) {
    setTestingId(providerId); setError('')
    try {
      await testAIProvider(providerId)
      await loadProviders(false)
      onProvidersChanged?.()
    } catch {
      setError('Connection test failed. Check the endpoint and credentials.')
      await loadProviders(false)
    } finally { setTestingId('') }
  }

  async function handleDiscover(providerId: string) {
    setDiscoveringId(providerId); setError('')
    try {
      const discovered = await discoverAIProviderModels(providerId)
      setModels((current) => ({ ...current, [providerId]: discovered }))
    } catch { setError('Model discovery failed. Test the provider connection and try again.') }
    finally { setDiscoveringId('') }
  }

  async function handleDelete(providerId: string) {
    if (!window.confirm('Remove this AI provider and its discovered models?')) return
    setDeletingId(providerId); setError('')
    try {
      await deleteAIProvider(providerId)
      setProviders((current) => current.filter((provider) => provider.id !== providerId))
      setModels((current) => { const next = { ...current }; delete next[providerId]; return next })
      onProvidersChanged?.()
    } catch { setError('We could not remove this provider. Try again.') }
    finally { setDeletingId('') }
  }

  return (
    <section className="ai-providers-reference">
      <header className="ai-reference-head">
        <div>
          <h2><span className="ai-reference-heading-icon"><Icon name="gear" size={30} /></span>Settings <span className="ai-reference-chevron">›</span> AI Providers</h2>
          <p>Manage your AI providers. Add, configure, and test connections to use in project analysis.</p>
        </div>
        <button className="ai-reference-primary" type="button" onClick={() => setDialogProvider(null)}><Icon name="plus" size={19} /> Add AI Provider</button>
      </header>

      {error && <p className="dashboard-alert" role="alert">{error}</p>}
      <div className="ai-reference-banner"><strong>Provider management</strong><span>Connection status and discovered models are live. No provider is selected or changed by this page.</span></div>

      {isLoading ? <div className="projects-loading" aria-live="polite">Loading AI providers...</div> : providers.length === 0 ? (
        <div className="ai-reference-empty"><strong>No AI providers configured</strong><span>Add a supported Ollama or OpenAI-compatible endpoint to make a model available for project analysis.</span></div>
      ) : (
        <div className="ai-reference-grid">
          {providers.map((provider) => {
            const meta = providerMeta(provider)
            const providerModels = models[provider.id] || []
            const connected = provider.connection_status === 'connected'
            return (
              <article className="ai-reference-card" key={provider.id}>
                <div className="ai-reference-card-top">
                  <div className="ai-reference-identity">
                    <span className={`ai-reference-logo ${meta.tone}`}><ProviderBrandIcon provider={provider} fallback={meta.icon} size={meta.icon === 'openai' ? 31 : 27} /></span>
                    <div><div className="ai-reference-name">{provider.name}<span className={`ai-reference-tag ${meta.tone}`}>{meta.label}</span></div><div className={connected ? 'ai-reference-status' : 'ai-reference-status off'}>{connected ? 'Connected' : provider.connection_status}</div></div>
                  </div>
                </div>
                <p className="ai-reference-description">{meta.description}</p>
                <div className="ai-reference-rows">
                  <div><Icon name="endpoint" size={15} />Endpoint<strong title={provider.endpoint}>{provider.endpoint}</strong></div>
                  <div><Icon name="models" size={15} />Models<strong>{providerModels.length} models</strong></div>
                  <div><Icon name="clock" size={15} />Last tested<strong>{formatLastTested(provider.last_tested_at)}</strong></div>
                </div>
                <div className="ai-reference-actions">
                  <button type="button" onClick={() => setDialogProvider(provider)}><Icon name="edit" size={15} /> Edit</button>
                  <button type="button" onClick={() => void handleTest(provider.id)} disabled={testingId === provider.id}><Icon name="play" size={13} fill /> {testingId === provider.id ? 'Testing...' : 'Test'}</button>
                  <button type="button" aria-label={`More actions for ${provider.name}`} className="ai-reference-more">•••</button>
                </div>
                <div className="ai-reference-discovery"><strong>Available models</strong><button type="button" onClick={() => void handleDiscover(provider.id)} disabled={discoveringId === provider.id}>{discoveringId === provider.id ? 'Discovering...' : `${providerModels.length} models`}</button></div>
                <button type="button" className="ai-reference-remove" onClick={() => void handleDelete(provider.id)} disabled={deletingId === provider.id}>{deletingId === provider.id ? 'Removing...' : 'Remove provider'}</button>
              </article>
            )
          })}
        </div>
      )}

      {!isLoading && <section className="ai-reference-add">
        <div className="ai-reference-add-copy"><span className="ai-reference-heading-icon"><Icon name="gear" size={34} /></span><div><h3>Add New AI Provider</h3><p>Connect to any AI provider - local, cloud, or custom endpoint.</p></div></div>
        <div className="ai-reference-quick-add">
          <button type="button" onClick={() => setDialogProvider(null)}><Icon name="llama" size={25} /><span>Ollama<small>Local models</small></span></button>
          <button type="button" onClick={() => setDialogProvider(null)}><Icon name="cube" size={25} /><span>OpenAI Compatible<small>Any API endpoint</small></span></button>
          <button type="button" disabled title="Official OpenAI protocol is not supported by the current backend"><Icon name="openai" size={25} /><span>OpenAI<small>Unsupported</small></span></button>
          <button type="button" disabled title="Anthropic protocol is not supported by the current backend"><span className="ai-reference-anthropic">A\</span><span>Anthropic<small>Unsupported</small></span></button>
          <button type="button" disabled title="Custom provider protocol is not supported by the current backend"><Icon name="link" size={25} /><span>Custom Endpoint<small>Unsupported</small></span></button>
        </div>
      </section>}

      {dialogProvider !== undefined && <ProviderDialog provider={dialogProvider} onClose={() => setDialogProvider(undefined)} onSaved={async () => { setDialogProvider(undefined); await loadProviders(false); onProvidersChanged?.() }} />}
    </section>
  )
}

function ProviderDialog({ provider, onClose, onSaved }: { provider: AIProvider | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(provider?.name || '')
  const [providerType, setProviderType] = useState(provider?.provider_type || 'openai_compatible')
  const [endpoint, setEndpoint] = useState(provider?.endpoint || 'https://api.example.com/v1')
  const [apiKey, setApiKey] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) { if (event.key === 'Escape' && !isSaving) onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isSaving, onClose])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || !endpoint.trim()) { setError('Provider name and endpoint are required.'); return }
    setIsSaving(true); setError('')
    try {
      const credentials = apiKey.trim() ? { api_key: apiKey.trim() } : undefined
      if (provider) await updateAIProvider(provider.id, { name: name.trim(), endpoint: endpoint.trim(), auth_type: credentials ? 'api_key' : 'none', credentials })
      else await createAIProvider({ name: name.trim(), provider_type: providerType, endpoint: endpoint.trim(), auth_type: credentials ? 'api_key' : 'none', credentials })
      await onSaved()
    } catch { setError('We could not save this provider. Check the values and try again.') }
    finally { setIsSaving(false) }
  }

  function handleTypeKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    setProviderType(providerType === 'ollama' ? 'openai_compatible' : 'ollama')
  }

  return <div className="project-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) onClose() }}>
    <section className="project-dialog ai-provider-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-provider-dialog-title">
      <div className="project-dialog-heading"><div><h3 id="ai-provider-dialog-title">{provider ? 'Edit AI provider' : 'Connect an AI provider'}</h3><p className="ai-provider-dialog-subtitle">Add a local, cloud, LAN, or compatible AI endpoint to CyberMind.</p></div><button type="button" className="dialog-close-button" aria-label="Close dialog" onClick={onClose} disabled={isSaving}>×</button></div>
      <form onSubmit={handleSubmit}>
        <label htmlFor="ai-provider-name">Provider name</label><input id="ai-provider-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="My Provider" autoFocus />
        {!provider && <><div className="ai-provider-dialog-label">Connection type</div><div className="ai-provider-type-options" role="radiogroup" aria-label="AI provider connection type">
          <button type="button" role="radio" aria-checked={providerType === 'ollama'} className={providerType === 'ollama' ? 'ai-provider-type-option ai-provider-type-option-active' : 'ai-provider-type-option'} onClick={() => setProviderType('ollama')} onKeyDown={handleTypeKeyDown}><span className="ai-provider-option-icon">O</span><span><strong>Ollama</strong><small>Local runtime</small></span></button>
          <button type="button" role="radio" aria-checked={providerType === 'openai_compatible'} className={providerType === 'openai_compatible' ? 'ai-provider-type-option ai-provider-type-option-active' : 'ai-provider-type-option'} onClick={() => setProviderType('openai_compatible')} onKeyDown={handleTypeKeyDown}><span className="ai-provider-option-icon">AI</span><span><strong>OpenAI-compatible</strong><small>Cloud or LAN API</small></span></button>
        </div></>}
        <label htmlFor="ai-provider-endpoint">Endpoint</label><input id="ai-provider-endpoint" type="url" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="https://api.example.com/v1" />
        <label htmlFor="ai-provider-key">API key <span className="ai-provider-optional">(optional)</span></label><input id="ai-provider-key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Stored encrypted by the backend" autoComplete="new-password" />
        <p className="field-message">Credentials are stored encrypted by the backend.</p>
        {error && <p className="project-form-error" role="alert">{error}</p>}
        <div className="project-dialog-actions"><button type="button" className="dialog-cancel-button" onClick={onClose} disabled={isSaving}>Cancel</button><button type="submit" className="dialog-submit-button" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save provider'}</button></div>
      </form>
    </section>
  </div>
}
