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
