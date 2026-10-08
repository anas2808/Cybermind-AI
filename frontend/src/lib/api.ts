import { supabase } from './supabase'

export type Project = {
  id: string
  name: string
  description: string | null
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

export async function createProject(name: string, description: string): Promise<Project> {
  const response = await authenticatedFetch('/api/projects/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, description: description || null }),
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
