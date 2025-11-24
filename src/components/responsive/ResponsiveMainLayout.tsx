import { ReactNode, memo } from 'react'
import { useResponsive } from '../../hooks/useResponsive'
import { useMobileNavigation } from '../../hooks/useMobileNavigation'
import { MobileNavbar } from './MobileNavbar'
import { ProjectDrawer } from './ProjectDrawer'
import { ProjectSidePanel } from '../layout/ProjectSidePanel'

interface ResponsiveMainLayoutProps {
  children: ReactNode
  currentProject?: any
  projects?: any[]
  theme?: string
  user?: any
  onProjectSelect?: (project: any) => void
  onProjectCreate?: () => void
  onNavigateToProjects?: () => void
  onToggleTheme?: () => void
  onLogout?: () => void
  onOpenSettings?: () => void
  desktopLayout: ReactNode // Original desktop layout from MainLayout
}

export const ResponsiveMainLayout = memo(function ResponsiveMainLayout({
  children,
  currentProject,
  projects = [],
  theme = 'dark',
  user,
  onProjectSelect,
  onProjectCreate,
  onNavigateToProjects,
  onToggleTheme,
  onLogout,
  onOpenSettings,
  desktopLayout,
}: ResponsiveMainLayoutProps) {
  const { isMobile } = useResponsive()
  const { drawerOpen, toggleDrawer, closeDrawer } = useMobileNavigation()

  // Desktop view - use original layout
  if (!isMobile) {
    return <>{desktopLayout}</>
  }

  // Mobile view - simplified layout with drawer
  return (
    <div className="mobile-container">
      {/* Mobile Navbar */}
      <MobileNavbar
        project={currentProject}
        theme={theme}
        user={user}
        onDrawerToggle={toggleDrawer}
        onToggleTheme={onToggleTheme}
        onLogout={onLogout}
        onOpenSettings={onOpenSettings}
      />

      {/* Project Drawer */}
      <ProjectDrawer isOpen={drawerOpen} onClose={closeDrawer} title="Projects">
        <ProjectSidePanel
          currentProject={currentProject}
          theme={theme}
          // collapsed={false}
          onProjectSelect={(project) => {
            closeDrawer()
            onProjectSelect?.(project)
          }}
          onProjectCreate={() => {
            closeDrawer()
            onProjectCreate?.()
          }}
          onNavigateToProjects={onNavigateToProjects}
          onToggleTheme={onToggleTheme}
          onLogout={onLogout}
          onOpenSettings={onOpenSettings}
        />
      </ProjectDrawer>

      {/* Main Content */}
      <div className="mobile-main-content">{children}</div>
    </div>
  )
})
