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
  if (forceRefresh) {
    const refreshed = await supabase.auth.refreshSession()
    if (!refreshed.error && refreshed.data.session?.access_token) return refreshed.data.session.access_token
  }
  const { data, error } = await supabase.auth.getSession()
  if (!error && data.session?.access_token) return data.session.access_token
  const refreshed = await supabase.auth.refreshSession()
  if (!refreshed.error && refreshed.data.session?.access_token) return refreshed.data.session.access_token
  throw new ApiError(401)
}

async function authenticatedFetch(path: string, init: RequestInit = {}) {
  let accessToken = await getValidAccessToken()
  const sendRequest = (token: string) => fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  })
  let response = await sendRequest(accessToken)
  if (response.status === 401) {
    accessToken = await getValidAccessToken(true)
    response = await sendRequest(accessToken)
  }
  if (!response.ok) throw new ApiError(response.status)
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
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description: description || null, repository_url: repositoryUrl || null }),
  })
  return response.json() as Promise<Project>
}

export type AIProvider = {
  id: string; name: string; provider_type: string; endpoint: string; auth_type: string
  enabled: boolean; connection_status: string; last_tested_at: string | null
  created_at: string; updated_at: string
}
export type AIModel = {
  id: string; provider_id: string; model_id: string; display_name: string
  context_window: number | null; max_output_tokens: number | null
  capabilities: Record<string, unknown> | null; limits: Record<string, unknown> | null
  availability: string; metadata_json: Record<string, unknown> | null; discovered_at: string | null
}
export type AIProviderCreate = {
  name: string; provider_type: string; endpoint: string; auth_type?: string; credentials?: Record<string, string>
}
export type AIProviderUpdate = {
  name?: string; endpoint?: string; auth_type?: string; credentials?: Record<string, string>; enabled?: boolean
}
async function parseResponse<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>
}
export async function getAIProviders(): Promise<AIProvider[]> {
  return parseResponse<AIProvider[]>(await authenticatedFetch('/api/ai/providers/'))
}
export async function createAIProvider(payload: AIProviderCreate): Promise<AIProvider> {
  return parseResponse<AIProvider>(await authenticatedFetch('/api/ai/providers/', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }))
}
export async function updateAIProvider(providerId: string, payload: AIProviderUpdate): Promise<AIProvider> {
  return parseResponse<AIProvider>(await authenticatedFetch(`/api/ai/providers/${encodeURIComponent(providerId)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }))
}
export async function testAIProvider(providerId: string): Promise<{ provider_id: string; status: string; message: string; latency_ms: number | null }> {
  return parseResponse(await authenticatedFetch(`/api/ai/providers/${encodeURIComponent(providerId)}/test`, { method: 'POST' }))
}
export async function discoverAIProviderModels(providerId: string): Promise<AIModel[]> {
  const payload = await parseResponse<{ provider_id: string; status: string; models: AIModel[] }>(
    await authenticatedFetch(`/api/ai/providers/${encodeURIComponent(providerId)}/discover-models`, { method: 'POST' }),
  )
  return payload.models
}
export async function getAIProviderModels(providerId: string): Promise<AIModel[]> {
  return parseResponse<AIModel[]>(await authenticatedFetch(`/api/ai/providers/${encodeURIComponent(providerId)}/models`))
}
export async function deleteAIProvider(providerId: string): Promise<void> {
  await authenticatedFetch(`/api/ai/providers/${encodeURIComponent(providerId)}`, { method: 'DELETE' })
}
export async function analyzeProjectStructure(projectId: string, providerId: string, modelId: string) {
  return parseResponse<ProjectStructureAnalysis>(await authenticatedFetch(`/api/projects/${encodeURIComponent(projectId)}/analysis/structure`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider_id: providerId, model_id: modelId }),
  }))
}
export type ProjectFeature = { name: string; purpose: string; files: string[]; related_features: string[] }
export type ProjectStructureAnalysis = {
  project_id: string; provider_id: string; model_id: string; summary: string; tree: string
  technologies: string[]; features: ProjectFeature[]
}
export type SecurityFinding = { title: string; severity: string; description: string; evidence: string; recommendation: string }
export type FeatureSecurityAnalysis = {
  project_id: string; provider_id: string; model_id: string; feature_name: string
  files: string[]; findings: SecurityFinding[]
}
export async function analyzeFeatureSecurity(projectId: string, providerId: string, modelId: string, featureName: string, files: string[]): Promise<FeatureSecurityAnalysis> {
  return parseResponse<FeatureSecurityAnalysis>(await authenticatedFetch(`/api/projects/${encodeURIComponent(projectId)}/analysis/feature`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider_id: providerId, model_id: modelId, feature_name: featureName, files }),
  }))
}

export type LogAnalysisFinding = {
  title: string; severity: 'critical' | 'high' | 'medium' | 'low' | 'informational'
  description: string; evidence: string; recommendation: string; why_it_matters?: string
  timestamp?: string; source?: string; related_events?: string[]; confidence?: string; follow_up?: string
}
export type LogTimelineItem = { timestamp: string; event: string; significance: string; evidence: string }
export type LogRecommendations = { immediate: string[]; short_term: string[]; preventive: string[] }
export type LogAnalysisResult = {
  provider_id: string; model_id: string; file_name: string; summary: string; findings: LogAnalysisFinding[]
  lines_analyzed: number; limitations: string[]; time_range?: string
  assessment?: 'normal' | 'suspicious' | 'possible_incident' | 'uncertain'
  timeline?: LogTimelineItem[]; recommendations?: LogRecommendations
}
export async function analyzeSecurityLogs(providerId: string, modelId: string, fileName: string, logContent: string, logType = 'auto_detect', severityLevels: string[] = ['critical', 'high', 'medium', 'low', 'info']): Promise<LogAnalysisResult> {
  return parseResponse<LogAnalysisResult>(await authenticatedFetch('/api/security/logs/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider_id: providerId, model_id: modelId, file_name: fileName, log_content: logContent, log_type: logType, severity_levels: severityLevels }),
  }))
}

export type CodeReviewFinding = {
  title: string; severity: 'critical' | 'high' | 'medium' | 'low' | 'informational'
  category: string; line: number | null; evidence: string; explanation: string; recommendation: string
}
export type CodeReviewResult = {
  provider_id: string; model_id: string; language: string; summary: string
  findings: CodeReviewFinding[]; improved_code: string | null
  improvements_summary: string[]; limitations: string[]
}
export async function reviewCode(providerId: string, modelId: string, language: string, code: string, reviewFocus: string[]): Promise<CodeReviewResult> {
  return parseResponse<CodeReviewResult>(await authenticatedFetch('/api/code-review/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider_id: providerId, model_id: modelId, language, code, review_focus: reviewFocus }),
  }))
}
