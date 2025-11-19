import { useState, useEffect } from 'react'
import {
  MoreHorizontal,
  Folder,
  LogOut,
  Sun,
  Moon,
  RefreshCw,
  Play,
  Edit2,
  Trash2,
  Check,
  X,
  ArrowLeft,
  CheckSquare,
  Trash,
  AlertCircle,
  User,
  LogIn,
} from 'lucide-react'
import { useProjectContext } from '../../hooks/useProjectContext'
import { useProjectStatusWebSocket } from '../../hooks/useProjectStatusWebSocket'
import styles from './ProjectSidePanel.module.css'
import { useAuth } from '@/hooks/useAuth'
import { useLocation, useNavigate } from 'react-router-dom'
import { useToast } from '../../hooks/useToast'
import faviconLogo from '@/assets/favicon.svg'
import type { Project } from '../../types/project'

interface ProjectSidePanelProps {
  currentProject?: Project | null
  loading?: boolean
  error?: string | null
  theme?: string
  onProjectSelect?: (project: Project) => void
  onProjectCreate?: () => void | Promise<void>
  onNavigateToProjects?: () => void
  onToggleTheme?: () => void
  onLogout?: () => void
  onOpenSettings?: () => void
}

export function ProjectSidePanel({
  currentProject,
  loading = false,
  error = null,
  theme = 'dark',
  onProjectSelect,
  onProjectCreate,
  onNavigateToProjects,
  onToggleTheme,
  onLogout,
  onOpenSettings,
}: ProjectSidePanelProps) {
  const { user, getAccessToken, signInWithGitHub } = useAuth()
  const {
    projects,
    loading: projectsLoading,
    error: projectsError,
    fetchProjects,
    updateProject,
    deleteProject,
    syncProject,
  } = useProjectContext()
  const navigate = useNavigate()
  const location = useLocation()
  const { showError } = useToast()
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [editingProject, setEditingProject] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [showProjectMenu, setShowProjectMenu] = useState<string | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set())
  const [showUserTooltip, setShowUserTooltip] = useState(false)

  // Extract username from user metadata
  const username = user?.user_metadata?.preferred_username || user?.email?.split('@')[0] || 'User'

  // Get access token for WebSocket
  const [accessToken, setAccessToken] = useState<string | null>(null)

  useEffect(() => {
    const loadToken = async () => {
      if (user) {
        const token = await getAccessToken()
        setAccessToken(token)
      }
    }
    loadToken()
  }, [user, getAccessToken])

  // WebSocket for current project status updates
  useProjectStatusWebSocket({
    projectId: currentProject?.project_id || null,
    accessToken,
    enabled: !!currentProject && !!user && !!accessToken,
    onStatusUpdate: (status) => {
      // Update current project status if it changed
      if (status.container_status !== currentProject?.status) {
        fetchProjects() // Refresh project list when status changes
      }
    },
    onError: (error) => {
      console.error('Project status WebSocket error:', error)
    },
  })

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showProjectMenu && !(e.target as HTMLElement).closest(`.${styles.dropdown}`)) {
        setShowProjectMenu(null)
      }
    }

    if (showProjectMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showProjectMenu])

  // Projects are now managed by ProjectContext
  const isLoading = loading || projectsLoading
  const loadError = error || projectsError

  const handleProjectClick = (project: any) => {
    // Don't navigate if editing or menu is open
    if (editingProject === project.project_id || showProjectMenu === project.project_id) return

    // In selection mode, toggle selection
    if (selectionMode) {
      handleToggleSelection(project.project_id)
      return
    }

    // Always navigate to project view
    onProjectSelect?.(project)
  }

  const handleEditProject = (project: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingProject(project.project_id)
    setEditName(project.name)
    setShowProjectMenu(null)
  }

  const handleSaveEdit = async (projectId: string) => {
    if (!editName.trim()) {
      setEditName('Untitled Project')
    }

    try {
      await updateProject(projectId, { name: editName.trim() || 'Untitled Project' })
      setEditingProject(null)
    } catch (err) {
      console.error('Failed to update project:', err)
    }
  }

  const handleCancelEdit = () => {
    setEditingProject(null)
    setEditName('')
  }

  const handleDeleteProject = async (project: any, e: React.MouseEvent) => {
    e.stopPropagation()

    if (
      !confirm(
        `Delete project "${project.name}"? This will delete all associated projects and containers.`,
      )
    ) {
      return
    }

    try {
      await deleteProject(project.project_id)
      setShowProjectMenu(null)
    } catch (err) {
      console.error('Failed to delete project:', err)
    }
  }


  const handleSyncProject = async (projectId: string) => {
    try {
      await syncProject(projectId)
    } catch (err) {
      console.error('Failed to sync project:', err)
    }
  }

  const handleToggleSelection = (projectId: string) => {
    const newSelected = new Set(selectedProjects)
    if (newSelected.has(projectId)) {
      newSelected.delete(projectId)
    } else {
      newSelected.add(projectId)
    }
    setSelectedProjects(newSelected)
  }

  const handleBulkDelete = async () => {
    if (selectedProjects.size === 0) return

    if (!confirm(`Delete ${selectedProjects.size} selected project(s)? This will delete all associated workspaces and containers.`)) {
      return
    }

    try {
      await Promise.all(
        Array.from(selectedProjects).map(projectId => deleteProject(projectId))
      )
      setSelectedProjects(new Set())
      setSelectionMode(false)
    } catch (err) {
      console.error('Failed to delete projects:', err)
      showError('Some projects could not be deleted. Check console for details.')
    }
  }

  // Check if on project detail page
  const isProjectDetailPage = location.pathname.includes('/projects/')

  return (
    <div
      className={styles.container}
      style={{
        borderTopRightRadius: isProjectDetailPage ? '16px' : '0',
        borderBottomRightRadius: isProjectDetailPage ? '16px' : '0',
      }}
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <div
            className={styles.title}
            onClick={onNavigateToProjects}
            style={{ cursor: onNavigateToProjects ? 'pointer' : 'default', display: 'flex', alignItems: 'center' }}
          >
            {user && <img src={faviconLogo} alt="WidgetUI" style={{ height: '24px', width: 'auto' }} />}
          </div>
          {user && (
            <div style={{ display: 'flex', gap: '4px' }}>
              {selectionMode ? (
                <>
                  <button
                    className={styles.headerAction}
                    onClick={handleBulkDelete}
                    title={`Delete ${selectedProjects.size} selected`}
                    disabled={selectedProjects.size === 0}
                    style={{
                      opacity: selectedProjects.size === 0 ? 0.5 : 1,
                      cursor: selectedProjects.size === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    className={styles.headerAction}
                    onClick={() => {
                      setSelectionMode(false)
                      setSelectedProjects(new Set())
                    }}
                    title="Cancel selection"
                  >
                    <X size={16} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    className={styles.headerAction}
                    onClick={fetchProjects}
                    title="Refresh projects"
                  >
                    <RefreshCw size={16} />
                  </button>
                  <button
                    className={styles.headerAction}
                    onClick={() => setSelectionMode(true)}
                    title="Select multiple projects"
                  >
                    <Trash size={16} />
                  </button>
                  {location.pathname.includes('/projects/') && (
                    <button
                      onClick={() => navigate('/projects')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-text-secondary)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        transition: 'background-color 0.2s',
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)')
                      }
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <ArrowLeft size={20} />
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {!user ? (
          // Not logged in - show lock icon
          <div className={styles.projectsContainer}>
            <div className={styles.lockContainer}>
              <img src={faviconLogo} alt="WidgetUI" className={styles.lockIcon} style={{ height: '24px', width: 'auto' }} />
            </div>
          </div>
        ) : (
          // Logged in - show projects
          <>
            <div className={styles.projectsContainer}>
              {isLoading ? (
                // Loading skeleton
                <>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className={styles.skeletonProject}>
                      <div className={`${styles.skeleton} ${styles.skeletonIcon}`} />
                      <div className={`${styles.skeleton} ${styles.skeletonText}`} />
                    </div>
                  ))}
                </>
              ) : loadError ? (
                // Error state
                <div style={{
                  padding: '16px',
                  textAlign: 'center',
                  color: 'var(--color-text-tertiary)',
                  fontSize: '13px',
                }}>
                  <AlertCircle size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
                  <div>Failed to load projects</div>
                  <button
                    onClick={fetchProjects}
                    style={{
                      marginTop: '12px',
                      padding: '6px 12px',
                      background: 'var(--color-bg-tertiary)',
                      border: '1px solid var(--color-border-subtle)',
                      borderRadius: '4px',
                      color: 'var(--color-text-primary)',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : (
                projects.map((project) => {
                const isCurrentProject = currentProject?.project_id === project.project_id
                const isRunning = project.default_workspace?.status === 'running'
                const isEditing = editingProject === project.project_id
                const showMenu = showProjectMenu === project.project_id

                // Format git URL for display
                const formatGitUrl = (url: string) => {
                  if (!url) return 'No repository'
                  // Extract repo name from git URL
                  const match = url.match(/\/([^/]+?)(\.git)?$/)
                  if (match) return match[1]
                  return url.length > 30 ? url.substring(0, 30) + '...' : url
                }

                const isInitializing = project.default_workspace?.status === 'initializing'

                return (
                  <div
                    key={project.project_id}
                    className={`${styles.project} ${isCurrentProject ? styles.active : ''} ${selectionMode && selectedProjects.has(project.project_id) ? styles.selected : ''}`}
                    onClick={() => handleProjectClick(project)}
                    onMouseEnter={() => setHoveredItem(project.project_id)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <div className={styles.projectHeader}>
                      <div className={styles.projectTitle}>
                        {selectionMode && (
                          <input
                            type="checkbox"
                            checked={selectedProjects.has(project.project_id)}
                            onChange={() => handleToggleSelection(project.project_id)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ marginRight: '8px', cursor: 'pointer' }}
                          />
                        )}
                        <span className={styles.projectIcon}>
                          <Folder size={16} />
                        </span>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(project.project_id)
                              if (e.key === 'Escape') handleCancelEdit()
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className={styles.projectNameEdit}
                            autoFocus
                          />
                        ) : (
                          <div className={styles.projectInfo}>
                            <span className={styles.projectName}>{project.name || 'Untitled'}</span>
                            <div className={styles.projectMeta}>
                              <span className={styles.projectUrl}>
                                {formatGitUrl(project.git_url)}
                              </span>
                            </div>
                          </div>
                        )}
                        {isRunning && !isEditing && (
                          <span className={styles.statusIndicator} title="Running">
                            <div className={styles.runningDot} />
                          </span>
                        )}
                        {isInitializing && !isEditing && (
                          <span className={styles.statusIndicator} title="Initializing sandbox...">
                            <div className={styles.initializingSpinner} />
                          </span>
                        )}
                      </div>
                      <div className={styles.projectActions} style={{ position: 'relative' }}>
                        {isEditing ? (
                          <>
                            <button
                              className={styles.iconButton}
                              onClick={() => {
                                handleSaveEdit(project.project_id)
                              }}
                              title="Save"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              className={styles.iconButton}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCancelEdit()
                              }}
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className={styles.projectMenu}
                              onClick={(e) => {
                                e.stopPropagation()
                                setShowProjectMenu(showMenu ? null : project.project_id)
                              }}
                            >
                              <MoreHorizontal size={16} />
                            </button>

                            {showMenu && (
                              <div className={styles.dropdown}>
                                <button
                                  className={styles.dropdownItem}
                                  onClick={(e) => handleEditProject(project, e)}
                                >
                                  <Edit2 size={14} />
                                  <span>Rename</span>
                                </button>
                                <button
                                  className={styles.dropdownItem}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleSyncProject(project.project_id)
                                    setShowProjectMenu(null)
                                  }}
                                >
                                  <RefreshCw size={14} />
                                  <span>Sync</span>
                                </button>
                                <button
                                  className={`${styles.dropdownItem} ${styles.danger}`}
                                  onClick={(e) => handleDeleteProject(project, e)}
                                >
                                  <Trash2 size={14} />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
              )}

              {projects.length === 0 && !isLoading && !loadError && (
                <div className={styles.empty}>
                </div>
              )}
            </div>
          </>
        )}

        <div className={styles.footer}>
          {!user ? (
            <>
              <button
                className={styles.footerButton}
                onClick={onToggleTheme}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
                style={{ flex: 1 }}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button
                className={styles.footerButton}
                onClick={signInWithGitHub}
                aria-label="Sign in with GitHub"
                title="Sign in with GitHub"
                style={{ flex: 1 }}
              >
                <LogIn size={18} />
              </button>
            </>
          ) : (
            <>
              <div className="user-info" style={{ position: 'relative', flex: 1 }}>
                <button
                  className={styles.footerButton}
                  onMouseEnter={() => setShowUserTooltip(true)}
                  onMouseLeave={() => setShowUserTooltip(false)}
                  aria-label={`Logged in as ${username}`}
                  style={{ cursor: 'default', width: '100%' }}
                >
                  {user?.user_metadata?.preferred_username ? (
                    <img
                      src={`https://github.com/${user.user_metadata.preferred_username}.png`}
                      alt={username}
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '1px solid var(--color-border-default)'
                      }}
                    />
                  ) : (
                    <User size={18} />
                  )}
                </button>
                {showUserTooltip && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      marginBottom: '8px',
                      padding: '6px 12px',
                      background: 'var(--color-bg-elevated)',
                      color: 'var(--color-text-primary)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                      zIndex: 1000,
                      boxShadow: 'var(--shadow-md)',
                      border: '1px solid var(--color-border-default)',
                    }}
                  >
                    {username}
                  </div>
                )}
              </div>
              <button
                className={styles.footerButton}
                onClick={onToggleTheme}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
                style={{ flex: 1 }}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button
                className={styles.footerButton}
                onClick={onLogout}
                aria-label="Sign Out"
                title="Sign Out"
                style={{ flex: 1 }}
              >
                <LogOut size={18} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
