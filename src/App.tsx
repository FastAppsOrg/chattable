import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import './styles/App.css'
import './styles/error-boundary.css'
import { AuthCallback } from './auth/AuthCallback'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ThemeInitializer } from './components/ThemeInitializer'
import ToastContainer from './components/Toast/ToastContainer'
import { MainLayout } from './components/layout/MainLayout'
import { ProjectContent } from './components/responsive/ProjectContent'
import { HomePanel } from './components/home/HomePanel'
import { ToastProvider } from './contexts/ToastContext'
import { ProjectProvider } from './contexts/ProjectContext'
import { useProjectContext } from './hooks/useProjectContext'
import { useAuth } from './hooks/useAuth'
import { useToast } from './hooks/useToast'
import { useProject } from './hooks/useProject'
import { SettingsModal } from './components/settings/SettingsModal'
import { generateProjectName } from './utils/nameGenerator'

function AppContent() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { showError } = useToast()
  const [view, setView] = useState<'list' | 'terminal' | 'secrets'>('list')
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'claude' | 'secrets' | 'agents' | 'mcp' | 'commands'>('claude')
  const [providerRefreshCallback, setProviderRefreshCallback] = useState<(() => void) | null>(null)

  // Project hook
  const {
    projects: localProjects,
    selectedProject,
    loading: projectLoading,
    fetchProject,
    updateProject,
    selectProject,
    clearSelection: clearProjectSelection,
  } = useProject()

  const { createProject, projects: contextProjects, loading: contextLoading, fetchProjects: fetchContextProjects } = useProjectContext()

  // Use context projects if available, otherwise use local projects
  const projects = contextProjects.length > 0 ? contextProjects : localProjects

  // Combine both loading states: projectLoading (for fetch) and contextLoading (for create)
  const loading = projectLoading || contextLoading

  const connectToProject = (project: any) => {
    selectProject(project)
    setView('terminal')
    navigate(`/projects/${project.project_id}`)
  }

  const handleBack = async () => {
    await new Promise((resolve) => setTimeout(resolve, 100))
    setView('list')
    clearProjectSelection()
    navigate('/projects')
  }

  const handleQuickCreateProject = async (prompt?: string) => {
    // Check for pending prompt from popover
    const pendingPrompt = sessionStorage.getItem('pending_initial_prompt')
    if (pendingPrompt) {
      sessionStorage.removeItem('pending_initial_prompt')
      prompt = pendingPrompt
    }

    // Create a quick start project with random name
    const form = {
      name: generateProjectName(),
      git_url: '',
      git_branch: 'main',
    }
    await handleCreateProject(form, prompt)
  }

  const handleCreateProject = async (form: any, initialPrompt?: string) => {
    try {
      // Create project and wait for initial response (not sandbox readiness)
      const project = await createProject(form)

      // Navigate immediately to show loading state
      // Background polling will happen in ProjectContent
      if (project.project_id) {
        // Store initial prompt in sessionStorage for ProjectContent to pick up
        if (initialPrompt) {
          sessionStorage.setItem(`initial_prompt_${project.project_id}`, initialPrompt)
        }
        setView('terminal')
        navigate(`/projects/${project.project_id}`)
      } else {
        // Stay on projects list if no project_id
        setView('list')
        navigate('/projects')
      }
    } catch (error) {
      if (error instanceof Error) {
        // Check for duplicate project error
        const match = error.message.match(/DUPLICATE_PROJECT:([^:]+):/)
        if (match) {
          const [, existingProjectId] = match
          // Silently navigate to existing project
          setView('terminal')
          navigate(`/projects/${existingProjectId}`)
          return
        }

        // Display user-friendly error messages
        let errorMessage = error.message

        // Clean up error message for display
        if (errorMessage.includes('UNIQUE constraint failed')) {
          errorMessage = 'A project with this name already exists. Please try again with a different name.'
        } else if (errorMessage.includes('EADDRINUSE')) {
          errorMessage = 'The project port is already in use. The server will retry automatically.'
        } else if (errorMessage.includes('Network error')) {
          errorMessage = 'Unable to connect to server. Please check your connection.'
        }

        showError(errorMessage)
      }
      // Stay on projects list on error
      setView('list')
      navigate('/projects')
    }
  }

  const handleRenameProject = async (projectId: string, newName: string) => {
    try {
      const updatedProject = await updateProject(projectId, { name: newName })
      return updatedProject
    } catch (error) {
      if (error instanceof Error) {
        showError(`Failed to rename project: ${error.message}`)
      }
      throw error // Re-throw to let the component handle the error
    }
  }

  // Auto-sync selectedProject when contextProjects updates
  useEffect(() => {
    if (selectedProject && contextProjects.length > 0) {
      const updatedProject = contextProjects.find(p => p.project_id === selectedProject.project_id)
      if (updatedProject && JSON.stringify(updatedProject) !== JSON.stringify(selectedProject)) {
        selectProject(updatedProject as any)
      }
    }
  }, [contextProjects, selectedProject, selectProject])

  useEffect(() => {
    const path = location.pathname

    // Don't process routes if not logged in
    if (!user) {
      if (path !== '/' && path !== '/auth/callback') {
        navigate('/')
      }
      return
    }

    if (path === '/settings') {
      setShowSettings(true)
      return
    }

    // Handle project routes
    const projectMatch = path.match(/^\/projects\/([a-zA-Z0-9_-]+)/)
    if (projectMatch) {
      const id = projectMatch[1]
      if (!selectedProject || selectedProject.project_id !== id) {
        const found = projects.find((p) => p.project_id === id)
        if (found) {
          selectProject(found as any)
          setView('terminal')
        } else {
          fetchProject(id)
            .then((project) => {
              selectProject(project)
              setView('terminal')
            })
            .catch(() => {
              navigate('/projects')
            })
        }
      } else if (view !== 'terminal') {
        setView('terminal')
      }
      return
    }

    if (path === '/projects') {
      if (view !== 'list') {
        setView('list')
        clearProjectSelection()
      }
    } else if (path === '/' && user) {
      // Redirect to projects if logged in and on root
      navigate('/projects')
    }
  }, [
    location.pathname,
    projects,
    selectedProject,
    view,
    fetchProject,
    selectProject,
    clearProjectSelection,
    navigate,
    user,
  ])

  const handleCloseSettings = () => {
    setShowSettings(false)
    // Refresh all status cards when settings modal closes
    providerRefreshCallback?.()
    // Only navigate back if we're still on the settings route
    if (location.pathname === '/settings') {
      navigate('/projects')
    }
  }

  // Extract username helper
  const extractUsername = (user: any | null) => {
    if (user?.user_metadata?.preferred_username) {
      return user?.user_metadata?.preferred_username
    }
    return user?.email?.split('@')[0] || 'there'
  }

  return (
    <>
      <ErrorBoundary>
        <MainLayout
          onOpenSettings={() => {
            setSettingsTab('claude')
            setShowSettings(true)
          }}
          onProjectCreate={handleQuickCreateProject}
        >
          {view === 'list' ? (
            <HomePanel
              onCreate={handleCreateProject}
              loading={loading}
              githubUsername={extractUsername(user)}
              onOpenSettings={(tab) => {
                setSettingsTab(tab || 'claude')
                setShowSettings(true)
              }}
              onRefreshProvider={(callback) => setProviderRefreshCallback(() => callback)}
            />
          ) : (
            <ProjectContent
              key={selectedProject?.project_id}
              project={selectedProject}
              onBack={handleBack}
              onProjectUpdate={() => {
                console.log('[App] onProjectUpdate triggered, refreshing context projects')
                // Refresh context projects to prevent stale state from reverting selectedProject
                fetchContextProjects()
              }}
              githubUsername={extractUsername(user)}
            />
          )}
        </MainLayout>
      </ErrorBoundary>
      <SettingsModal
        isOpen={showSettings}
        onClose={handleCloseSettings}
        userId={user?.id}
        initialTab={settingsTab}
        onProviderChange={() => {
          providerRefreshCallback?.()
        }}
      />
    </>
  )
}

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="app">
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            color: '#999',
          }}
        ></div>
      </div>
    )
  }

  return (
    <ThemeInitializer>
      <ToastProvider>
        <ProjectProvider>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<AppContent />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/projects" element={<AppContent />} />
              <Route path="/projects/:id" element={<AppContent />} />
              <Route path="/secrets" element={<AppContent />} />
              <Route path="/settings" element={<AppContent />} />
            </Routes>
            <ToastContainer />
          </ErrorBoundary>
        </ProjectProvider>
      </ToastProvider>
    </ThemeInitializer>
  )
}

export default App
