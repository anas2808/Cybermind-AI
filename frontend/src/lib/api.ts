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

async function authenticatedFetch(path: string, init: RequestInit = {}) {
  const { data, error } = await supabase.auth.getSession()

  if (error || !data.session?.access_token) {
    throw new ApiError(401)
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${data.session.access_token}`,
    },
  })

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
