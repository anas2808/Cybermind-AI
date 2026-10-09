import { supabase } from './supabase'

export type Project = {
  id: string
  name: string
  description: string | null
  repository_url: string | null
}

export class ApiError extends Error {
  status: number

  constructor(status: number) {
    super(`API request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
  }
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')

async function getValidAccessToken(forceRefresh = false): Promise<string> {
  // Try refreshing first when recovering from an expired access token. Supabase
  // will use the stored refresh token and persist the renewed session.
  if (forceRefresh) {
    const refreshed = await supabase.auth.refreshSession()
    if (!refreshed.error && refreshed.data.session?.access_token) {
      return refreshed.data.session.access_token
    }
  }

  const { data, error } = await supabase.auth.getSession()
  if (!error && data.session?.access_token) {
    return data.session.access_token
  }

  // A session can exist but be expired/stale in storage. Give Supabase one
  // explicit refresh attempt before asking the user to sign in again.
  const refreshed = await supabase.auth.refreshSession()
  if (!refreshed.error && refreshed.data.session?.access_token) {
    return refreshed.data.session.access_token
  }

  throw new ApiError(401)
}

async function authenticatedFetch(path: string, init: RequestInit = {}) {
  let accessToken = await getValidAccessToken()

  const sendRequest = (token: string) => fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  })

  let response = await sendRequest(accessToken)

  // If the API rejects an access token that looked valid locally, refresh once
  // and retry the same request. Never loop indefinitely on authentication errors.
  if (response.status === 401) {
    accessToken = await getValidAccessToken(true)
    response = await sendRequest(accessToken)
  }

  if (!response.ok) {
    throw new ApiError(response.status)
  }

  return response
}
export async function getProjects(): Promise<Project[]> {
  const response = await authenticatedFetch('/api/projects/')
  return response.json() as Promise<Project[]>
}

export async function getProject(projectId: string): Promise<Project> {
  const response = await authenticatedFetch(`/api/projects/${encodeURIComponent(projectId)}`)
  return response.json() as Promise<Project>
}

export async function createProject(name: string, description: string, repositoryUrl = ''): Promise<Project> {
  const response = await authenticatedFetch('/api/projects/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, description: description || null, repository_url: repositoryUrl || null }),
  })

  return response.json() as Promise<Project>
}


export type AIProvider = {
  id: string
  name: string
  provider_type: string
  endpoint: string
  auth_type: string
  enabled: boolean
  connection_status: string
  last_tested_at: string | null
  created_at: string
  updated_at: string
}

export type AIModel = {
  id: string
  provider_id: string
  model_id: string
  display_name: string
  context_window: number | null
  max_output_tokens: number | null
  capabilities: Record<string, unknown> | null
  limits: Record<string, unknown> | null
  availability: string
  metadata_json: Record<string, unknown> | null
  discovered_at: string | null
}

export type AIProviderCreate = {
  name: string
  provider_type: string
  endpoint: string
  auth_type?: string
  credentials?: Record<string, string>
}

export type AIProviderUpdate = {
  name?: string
  endpoint?: string
  auth_type?: string
  credentials?: Record<string, string>
  enabled?: boolean
}

async function parseResponse<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>
}

export async function getAIProviders(): Promise<AIProvider[]> {
  const response = await authenticatedFetch('/api/ai/providers/')
  return parseResponse<AIProvider[]>(response)
}

export async function createAIProvider(payload: AIProviderCreate): Promise<AIProvider> {
  const response = await authenticatedFetch('/api/ai/providers/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseResponse<AIProvider>(response)
}

export async function updateAIProvider(providerId: string, payload: AIProviderUpdate): Promise<AIProvider> {
  const response = await authenticatedFetch(`/api/ai/providers/${encodeURIComponent(providerId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseResponse<AIProvider>(response)
}

export async function testAIProvider(providerId: string): Promise<{ provider_id: string; status: string; message: string; latency_ms: number | null }> {
  const response = await authenticatedFetch(`/api/ai/providers/${encodeURIComponent(providerId)}/test`, {
    method: 'POST',
  })
  return parseResponse(response)
}

export async function discoverAIProviderModels(providerId: string): Promise<AIModel[]> {
  const response = await authenticatedFetch(`/api/ai/providers/${encodeURIComponent(providerId)}/discover-models`, {
    method: 'POST',
  })
  const payload = await parseResponse<{ provider_id: string; status: string; models: AIModel[] }>(response)
  return payload.models
}

export async function getAIProviderModels(providerId: string): Promise<AIModel[]> {
  const response = await authenticatedFetch(`/api/ai/providers/${encodeURIComponent(providerId)}/models`)
  return parseResponse<AIModel[]>(response)
}

export async function deleteAIProvider(providerId: string): Promise<void> {
  await authenticatedFetch(`/api/ai/providers/${encodeURIComponent(providerId)}`, {
    method: 'DELETE',
  })
}

export async function analyzeProjectStructure(projectId: string, providerId: string, modelId: string) {
  const response = await authenticatedFetch(`/api/projects/${encodeURIComponent(projectId)}/analysis/structure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider_id: providerId, model_id: modelId }),
  })
  return parseResponse<ProjectStructureAnalysis>(response)
}

export type ProjectFeature = {
  name: string
  purpose: string
  files: string[]
  related_features: string[]
}

export type ProjectStructureAnalysis = {
  project_id: string
  provider_id: string
  model_id: string
  summary: string
  tree: string
  technologies: string[]
  features: ProjectFeature[]
}

export type SecurityFinding = {
  title: string
  severity: string
  description: string
  evidence: string
  recommendation: string
}

export type FeatureSecurityAnalysis = {
  project_id: string
  provider_id: string
  model_id: string
  feature_name: string
  files: string[]
  findings: SecurityFinding[]
}

export async function analyzeFeatureSecurity(
  projectId: string,
  providerId: string,
  modelId: string,
  featureName: string,
  files: string[],
): Promise<FeatureSecurityAnalysis> {
  const response = await authenticatedFetch(`/api/projects/${encodeURIComponent(projectId)}/analysis/feature`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider_id: providerId,
      model_id: modelId,
      feature_name: featureName,
      files,
    }),
  })
  return parseResponse<FeatureSecurityAnalysis>(response)
}


export type LogAnalysisFinding = {
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational'
  description: string
  evidence: string
  recommendation: string
  why_it_matters?: string
  timestamp?: string
  source?: string
  related_events?: string[]
  confidence?: string
  follow_up?: string
}
export type LogTimelineItem = {
  timestamp: string
  event: string
  significance: string
  evidence: string
}
export type LogRecommendations = {
  immediate: string[]
  short_term: string[]
  preventive: string[]
}
export type LogAnalysisResult = {
  provider_id: string
  model_id: string
  file_name: string
  summary: string
  findings: LogAnalysisFinding[]
  lines_analyzed: number
  limitations: string[]
  time_range?: string
  assessment?: 'normal' | 'suspicious' | 'possible_incident' | 'uncertain'
  timeline?: LogTimelineItem[]
  recommendations?: LogRecommendations
}
export async function analyzeSecurityLogs(providerId: string, modelId: string, fileName: string, logContent: string): Promise<LogAnalysisResult> {
  const response = await authenticatedFetch('/api/security/logs/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider_id: providerId, model_id: modelId, file_name: fileName, log_content: logContent }),
  })
  return parseResponse<LogAnalysisResult>(response)
}
