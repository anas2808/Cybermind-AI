import { useEffect, useRef, useState } from 'react'
import { ApiError, getProjects, type Project } from '../../lib/api'
import { DashboardHome } from '../../pages/dashboard/DashboardHome'
import { AIProvidersPage } from '../../pages/dashboard/AIProvidersPage'
import { ProjectWorkspace } from '../../pages/dashboard/ProjectWorkspace'
import { ProjectsPage } from '../../pages/dashboard/ProjectsPage'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

type DashboardShellProps = {
  email?: string
  error: string
  isSigningOut: boolean
  onSignOut: () => void
}

type NavigationItem = {
  label: string
  id: string
  available?: boolean
}

const workspaceRoutes = new Set([
  'dashboard',
  'projects',
  'code-review',
  'log-analyzer',
  'threat-intelligence',
  'project-reviewer',
  'reports',
  'settings',
])

type WorkspaceRoute = {
  workspace: string
  projectId?: string
}

function routeFromHash(): WorkspaceRoute {
  const route = window.location.hash.replace(/^#\//, '')
  const projectMatch = route.match(/^projects\/([^/]+)$/)
  if (projectMatch) {
    try {
      return { workspace: 'projects', projectId: decodeURIComponent(projectMatch[1]) }
    } catch {
      return { workspace: 'dashboard' }
    }
  }
  return { workspace: workspaceRoutes.has(route) ? route : 'dashboard' }
}

function updateWorkspaceUrl(id: string, projectId?: string) {
  const nextHash = projectId ? `#/projects/${encodeURIComponent(projectId)}` : `#/${id}`
  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash
  }
}

export function DashboardShell({
  email,
  error,
  isSigningOut,
  onSignOut,
}: DashboardShellProps) {
  const [route, setRoute] = useState<WorkspaceRoute>(() => routeFromHash())
  const [projectTitle, setProjectTitle] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [apiStatus, setApiStatus] = useState<'loading' | 'success' | 'unauthorized' | 'error'>('loading')
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!route.projectId) {
      loadProjects()
    }
  }, [route.projectId])

  useEffect(() => {
    function handleHashChange() {
      setRoute(routeFromHash())
      setProjectTitle('')
    }

    const currentRoute = routeFromHash()
    if (currentRoute.workspace !== route.workspace || currentRoute.projectId !== route.projectId) {
      window.history.replaceState({}, '', route.projectId ? `#/projects/${encodeURIComponent(route.projectId)}` : `#/${route.workspace}`)
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [route])

  function loadProjects() {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setApiStatus('loading')
    getProjects()
      .then((nextProjects) => {
        if (requestId !== requestIdRef.current) return
        setProjects(nextProjects)
        setApiStatus('success')
      })
      .catch((requestError: unknown) => {
        if (requestId !== requestIdRef.current) return
        setApiStatus(requestError instanceof ApiError && requestError.status === 401 ? 'unauthorized' : 'error')
      })
  }

  function handleNavigation(item: NavigationItem) {
    updateWorkspaceUrl(item.id)
    setRoute({ workspace: item.id })
    setIsSidebarOpen(false)
  }

  const activeItem = route.workspace
  const activeLabel = route.projectId
    ? projectTitle || 'Project Workspace'
    : activeItem === 'dashboard'
    ? 'Dashboard'
    : activeItem === 'projects'
      ? 'Projects'
      : navigationLabel(activeItem)

  return (
    <main className="dashboard-app">
      <Sidebar
        activeItem={activeItem}
        isOpen={isSidebarOpen}
        onSelect={handleNavigation}
        onSignOut={onSignOut}
        isSigningOut={isSigningOut}
      />
      {isSidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <section className="dashboard-main">
        <TopBar title={activeLabel} email={email} apiStatus={apiStatus} onMenuToggle={() => setIsSidebarOpen((open) => !open)} />
        <div className="dashboard-content">
          {error && <p className="dashboard-alert" role="alert">{error}</p>}
          {activeItem === 'dashboard' ? (
            <DashboardHome
              email={email}
              projects={projects}
              apiStatus={apiStatus}
              onViewProjects={() => handleNavigation({ id: 'projects', label: 'Projects', available: true })}
            />
          ) : activeItem === 'projects' && route.projectId ? (
            <ProjectWorkspace
              projectId={route.projectId}
              onBack={() => handleNavigation({ id: 'projects', label: 'Projects', available: true })}
              onProjectLoaded={(projectName) => {
                setProjectTitle(projectName)
                setApiStatus(projectName ? 'success' : 'error')
              }}
            />
          ) : activeItem === 'projects' ? (
            <ProjectsPage
              projects={projects}
              apiStatus={apiStatus}
              onRetry={loadProjects}
              onProjectCreated={loadProjects}
              onProjectOpen={(projectId) => {
                updateWorkspaceUrl('projects', projectId)
                setRoute({ workspace: 'projects', projectId })
              }}
            />
          ) : activeItem === 'settings' ? (
            <AIProvidersPage />
          ) : (
            <section className="module-empty-state">
              <span className="empty-state-kicker">Module queued</span>
              <h2>{activeLabel}</h2>
              <p>This workspace module is ready for navigation and will be connected in a later phase.</p>
            </section>
          )}
        </div>
      </section>
    </main>
  )
}

function navigationLabel(id: string) {
  return id.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}
