import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { ProjectSidePanel } from './ProjectSidePanel'
import { ResponsiveMainLayout } from '../responsive/ResponsiveMainLayout'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { useNavigate, useLocation } from 'react-router-dom'
import { useProjectContext } from '../../hooks/useProjectContext'

interface MainLayoutProps {
  children: React.ReactNode
  onOpenSettings?: () => void
  onProjectCreate?: () => void | Promise<void>
}

export function MainLayout({ children, onOpenSettings, onProjectCreate }: MainLayoutProps) {
  const location = useLocation()
  const { user } = useAuth()

  const navigate = useNavigate()
  const { projects, checkGitHubToken } = useProjectContext()
  const { signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()

  // Determine current project from URL
  const currentProject = (() => {
    const projectMatch = location.pathname.match(/^\/projects\/([a-zA-Z0-9-]+)/)
    if (projectMatch) {
      const id = projectMatch[1]
      return projects.find((p) => p.project_id === id)
    }
    return null
  })()

  const handleLogout = async () => {
    await signOut()
    navigate('/')
  }

  const handleOpenSettings = () => {
    if (onOpenSettings) {
      onOpenSettings()
    } else {
      navigate('/settings')
    }
  }

  const handleProjectSelect = async (project: any) => {
    // Check GitHub token before connecting to project
    const hasToken = await checkGitHubToken()
    if (!hasToken) {
      // Auto re-auth will be triggered by checkGitHubToken
      return
    }

    // Navigate to project route
    if (project.project_id) {
      navigate(`/projects/${project.project_id}`)
    } else {
      console.error('Project missing project_id:', project)
      navigate('/projects')
    }
  }

  // Desktop layout
  const desktopLayout = (
    <div className="app project-scaled">
      <div className="project-main-content" style={{ paddingTop: 0 }}>
        <PanelGroup direction="horizontal" className="project-content">
          <Panel
            defaultSize={15}
            minSize={15}
            maxSize={15}
          >
            <ProjectSidePanel
              currentProject={currentProject}
              loading={false}
              theme={theme}
              onProjectSelect={handleProjectSelect}
              onProjectCreate={onProjectCreate}
              onNavigateToProjects={() => navigate('/projects')}
              onToggleTheme={toggleTheme}
              onLogout={handleLogout}
              onOpenSettings={handleOpenSettings}
            />
          </Panel>

          <PanelResizeHandle className="resize-handle-vertical" />

          <Panel defaultSize={85}>{children}</Panel>
        </PanelGroup>
      </div>
    </div>
  )

  return (
    <ResponsiveMainLayout
      currentProject={currentProject}
      projects={projects}
      theme={theme}
      user={user}
      onProjectSelect={handleProjectSelect}
      onProjectCreate={onProjectCreate}
      onNavigateToProjects={() => navigate('/projects')}
      onToggleTheme={toggleTheme}
      onLogout={handleLogout}
      onOpenSettings={handleOpenSettings}
      desktopLayout={desktopLayout}
    >
      {children}
    </ResponsiveMainLayout>
  )
}
