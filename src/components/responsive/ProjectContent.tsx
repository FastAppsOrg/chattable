import { useState, useEffect, useRef, useCallback } from 'react'
import { Panel, PanelGroup, PanelResizeHandle, ImperativePanelHandle } from 'react-resizable-panels'
import { X } from 'lucide-react'
import { ChatPanel } from '../chat/ChatPanel'
import { WidgetBuilderPanel } from '../workspace/WidgetBuilderPanel'
// TorchPanel and TaskBuilderPanel removed - not needed for Freestyle
import { ProjectNavbarLeft } from '../workspace/ProjectNavbarLeft'
import { ProjectNavbarRight } from '../workspace/ProjectNavbarRight'
import { GitPanel } from '../workspace/GitPanel'
import { ErrorBoundary } from '../ErrorBoundary'
import { ResponsiveProjectContent } from '../responsive/ResponsiveProjectContent'
import { DeploymentProgress } from '../project/DeploymentProgress'
import { useNavigate } from 'react-router-dom'
import { useGitCommits } from '../../hooks/useGitCommits'
import type { Project } from '../../types/project'
// import type { InspectorSelectionData } from '../../types'
import { ProjectService } from '../../services/api/project'
// import type { EmbeddedBrowserHandle } from '../preview/EmbeddedBrowser'
import type { PreviewMode } from '../workspace/PreviewModeSelector'

interface ProjectContentProps {
  project: Project | null
  onBack?: () => void
  onProjectUpdate?: () => void
  githubUsername?: string
}

export function ProjectContent({ project, onBack, onProjectUpdate, githubUsername }: ProjectContentProps) {
  const [selectedElementInput, setSelectedElementInput] = useState<string>('')
  const [selectedElements, setSelectedElements] = useState<any[]>([]) // Track all selected elements
  const [isInitializing, setIsInitializing] = useState(false)
  const [isChatFloating, setIsChatFloating] = useState(false)
  const [floatingPosition, setFloatingPosition] = useState({ left: 24, bottom: 24 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isGitPanelExpanded, setIsGitPanelExpanded] = useState(false)
  const [previewMode, setPreviewMode] = useState<PreviewMode>('gallery')

  const previewPanelRef = useRef<ImperativePanelHandle>(null)
  // const browserRef = useRef<EmbeddedBrowserHandle>(null)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const [leftPanelSize, setLeftPanelSize] = useState(30) // Track left panel size for navbar alignment

  const navigate = useNavigate()

  // Check if project has any commits
  const { hasCommits } = useGitCommits(project?.project_id, !!project)

  // Preview starts collapsed and only shows when there are commits
  const [previewCollapsed, setPreviewCollapsed] = useState(true)

  // Auto-expand preview when first commit is detected
  useEffect(() => {
    if (hasCommits && previewCollapsed) {
      console.log('First commit detected, expanding preview panel')
      setPreviewCollapsed(false)
    }
  }, [hasCommits, previewCollapsed])

  // Extract primitive values to avoid re-running effect when project object reference changes
  const projectId = project?.project_id
  const projectStatus = project?.status

  // Track if we've already started polling for this project
  const pollingRef = useRef<string | null>(null)

  // Store onProjectUpdate in a ref to avoid effect re-runs when it changes
  const onProjectUpdateRef = useRef(onProjectUpdate)

  useEffect(() => {
    onProjectUpdateRef.current = onProjectUpdate
  }, [onProjectUpdate])

  // Poll for project readiness if status is initializing
  useEffect(() => {
    // Early exit if no project or not initializing
    if (!projectId || projectStatus !== 'initializing') {
      setIsInitializing(false)
      return
    }

    // Create a unique key for this polling session
    const pollingKey = `${projectId}-initializing`

    // If we're already polling this exact project, don't start again
    if (pollingRef.current === pollingKey) {
      console.log('[DEBUG_BOMB] [ProjectContent] Already polling, skipping duplicate', pollingKey)
      return
    }

    pollingRef.current = pollingKey
    setIsInitializing(true)
    console.log('[DEBUG_BOMB] [ProjectContent] Starting polling for:', projectId)

    let cancelled = false
    const startedPolling = Date.now()

    // Start polling in background
    ProjectService.waitForProjectReady(projectId, {
      maxAttempts: 30,
      pollInterval: 10000, // 10 seconds
      onProgress: (status, attempt) => {
        if (cancelled) return
        console.log(`[ProjectContent] Polling status: ${status} (${attempt}/30)`)
      },
    })
      .then((readyProject) => {
        if (cancelled) return
        const elapsed = ((Date.now() - startedPolling) / 1000).toFixed(1)
        console.log(`[ProjectContent] Project ready after ${elapsed}s!`)
        setIsInitializing(false)
        pollingRef.current = null
        // Trigger ONE project update to refresh with ephemeral_url
        if (onProjectUpdateRef.current) {
          onProjectUpdateRef.current()
        }
      })
      .catch((error) => {
        if (cancelled) return
        console.error('[ProjectContent] Polling failed:', error)
        setIsInitializing(false)
        pollingRef.current = null
        // Still update to refresh status
        if (onProjectUpdateRef.current) {
          onProjectUpdateRef.current()
        }
      })

    // Cleanup: mark as cancelled when component unmounts or dependencies change
    return () => {
      if (!cancelled) {
        cancelled = true
        console.log('[ProjectContent] Polling cleanup for:', projectId)
        pollingRef.current = null
      }
    }
  }, [projectId, projectStatus]) // Removed onProjectUpdate from dependencies

  const handlePreviewConnect = () => {
    setPreviewCollapsed(false)
  }

  const handlePanelLayout = (sizes: number[]) => {
    setPreviewCollapsed(sizes[0] <= 15)
  }

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      navigate('/projects')
    }
  }

  // Elements are now only shown in carousel, not in input

  const handleViewportChange = useCallback((width: number, height: number) => {
    // Only update viewport dimensions - don't resize panels
    // This allows viewport selector to resize browser content only
    setViewportWidth(width)
    setViewportHeight(height)
  }, [])

  // Browser control handlers
  const handleRefresh = useCallback(() => {
    // browserRef.current?.refresh()
  }, [])

  const handleOpenExternal = useCallback(() => {
    // browserRef.current?.openExternal()
  }, [])

  const handleToggleChatFloating = useCallback(() => {
    setIsChatFloating(prev => !prev)
  }, [])

  const handleToggleGitPanel = useCallback(() => {
    setIsGitPanelExpanded(prev => !prev)
  }, [])


  // Track horizontal panel layout for navbar alignment
  const handleHorizontalPanelLayout = useCallback((sizes: number[]) => {
    if (sizes.length >= 2 && !isChatFloating) {
      setLeftPanelSize(sizes[0]) // First panel is the chat/left panel
    }
  }, [isChatFloating])

  // Dragging handlers for floating chat panel
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
    e.preventDefault()
  }, [])

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return

    const deltaX = e.clientX - dragStart.x
    const deltaY = e.clientY - dragStart.y

    setFloatingPosition(prev => ({
      left: Math.max(0, Math.min(window.innerWidth - 400, prev.left + deltaX)),
      bottom: Math.max(0, Math.min(window.innerHeight - 600, prev.bottom - deltaY))
    }))

    setDragStart({ x: e.clientX, y: e.clientY })
  }, [isDragging, dragStart])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Add/remove global mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove)
      window.addEventListener('mouseup', handleDragEnd)
      return () => {
        window.removeEventListener('mousemove', handleDragMove)
        window.removeEventListener('mouseup', handleDragEnd)
      }
    }
  }, [isDragging, handleDragMove, handleDragEnd])

  // Desktop layout
  const desktopContent = project ? (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Main Content Panels */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {isChatFloating ? (
          // Floating mode: Full-width preview/terminal + floating chat
          <>
            {/* Unified Navbar Row */}
            <ProjectNavbarRight
              project={project}
              previewUrl={project?.ephemeral_url || null}
              onRefresh={handleRefresh}
              onOpenExternal={handleOpenExternal}
              onViewportChange={handleViewportChange}
              githubUsername={githubUsername}
              onProjectUpdate={onProjectUpdate}
              onToggleChatFloating={handleToggleChatFloating}
              isChatFloating={isChatFloating}
              onToggleGitPanel={handleToggleGitPanel}
              isGitPanelExpanded={isGitPanelExpanded}
              previewMode={previewMode}
              onPreviewModeChange={setPreviewMode}
            />

            <PanelGroup direction="vertical" className="right-panel-group" onLayout={handlePanelLayout} style={{ flex: 1, minHeight: 0 }}>
              <Panel
                ref={previewPanelRef}
                defaultSize={50}
                minSize={3}
                className={`preview-panel ${previewCollapsed ? 'collapsed' : ''}`}
              >
                <div style={{ position: 'relative', height: '100%' }}>
                  {/* Progress overlay - shows during initialization */}
                  {isInitializing && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(26, 26, 26, 0.95)',
                      backdropFilter: 'blur(8px)',
                      zIndex: 1001,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      animation: 'fadeIn 0.3s ease-in',
                    }}>
                      <DeploymentProgress
                        projectId={project.project_id}
                        onComplete={() => {
                          console.log('Deployment complete!')
                          setIsInitializing(false)
                          if (onProjectUpdate) {
                            onProjectUpdate()
                          }
                        }}
                        onError={(error) => {
                          console.error('Deployment error:', error)
                          setIsInitializing(false)
                        }}
                      />
                    </div>
                  )}

                  {/* Git Panel Overlay */}
                  <GitPanel
                    project={project}
                    isExpanded={isGitPanelExpanded}
                    githubUsername={githubUsername}
                    onProjectUpdate={onProjectUpdate}
                  />

                  {/* Panel Content - Widget Builder */}
                  <ErrorBoundary>
                    <WidgetBuilderPanel
                      project={project}
                      isActive={true}
                      mode={previewMode}
                    />
                  </ErrorBoundary>
                </div>
              </Panel>
            </PanelGroup>

            {/* Floating Chat Panel */}
            <div
              className="floating-chat-panel"
              style={{
                position: 'fixed',
                bottom: `${floatingPosition.bottom}px`,
                left: `${floatingPosition.left}px`,
                width: '400px',
                height: '600px',
                maxHeight: 'calc(100vh - 100px)',
                backgroundColor: '#1a1a1a',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                userSelect: isDragging ? 'none' : 'auto',
              }}
            >
              {/* Floating Panel Header */}
              <div
                onMouseDown={handleDragStart}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom: '1px solid #333',
                  backgroundColor: '#1a1a1a',
                  cursor: isDragging ? 'grabbing' : 'grab',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#f0f0f0', pointerEvents: 'none' }}>
                  Chat
                </span>
                <button
                  onClick={handleToggleChatFloating}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#888',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#f0f0f0'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#888'
                  }}
                  title="Dock Chat Panel"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Chat Panel Content */}
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <ErrorBoundary>
                  <ChatPanel
                    key={`chat-${project?.project_id}-floating`}
                    projectId={project?.project_id}
                    projectName={project.name}
                    onBack={handleBack}
                    externalInput={selectedElementInput}
                    onExternalInputConsumed={() => setSelectedElementInput('')}
                    selectedElements={selectedElements}
                    onRemoveElement={(index) => {
                      setSelectedElements((prev) => prev.filter((_, i) => i !== index))
                    }}
                    sandboxReady={project?.status === 'active' && !!project?.ephemeral_url}
                    onClearElements={() => setSelectedElements([])}
                  />
                </ErrorBoundary>
              </div>
            </div>
          </>
        ) : (
          // Docked mode: Traditional panel layout with unified navbar
          <>
            {/* Unified Navbar Row with Grid */}
            <div
              className="unified-navbar"
              style={{
                display: 'grid',
                gridTemplateColumns: `${leftPanelSize}% 4px ${100 - leftPanelSize}%`,
              }}
            >
              <ProjectNavbarLeft
                project={project}
                onProjectUpdate={onProjectUpdate}
                onToggleChatFloating={handleToggleChatFloating}
                isChatFloating={isChatFloating}
              />
              <div className="navbar-separator" />
              <ProjectNavbarRight
                project={project}
                previewUrl={project?.ephemeral_url || null}
                onRefresh={handleRefresh}
                onOpenExternal={handleOpenExternal}
                onViewportChange={handleViewportChange}
                githubUsername={githubUsername}
                onProjectUpdate={onProjectUpdate}
                onToggleChatFloating={handleToggleChatFloating}
                isChatFloating={isChatFloating}
                onToggleGitPanel={handleToggleGitPanel}
                isGitPanelExpanded={isGitPanelExpanded}
                previewMode={previewMode}
                onPreviewModeChange={setPreviewMode}
              />
            </div>

            {/* Panels */}
            <PanelGroup
              key="docked-panels"
              direction="horizontal"
              className="project-content-panels"
              autoSaveId="project-content-docked"
              onLayout={handleHorizontalPanelLayout}
              style={{ flex: 1, minHeight: 0 }}
            >
              <Panel defaultSize={40} minSize={30}>
                <div className="chat-section" style={{ height: '100%' }}>
                  <ErrorBoundary>
                    <ChatPanel
                      key={`chat-${project?.project_id}-docked`}
                      projectId={project?.project_id}
                      projectName={project.name}
                      onBack={handleBack}
                      externalInput={selectedElementInput}
                      onExternalInputConsumed={() => setSelectedElementInput('')}
                      selectedElements={selectedElements}
                      onRemoveElement={(index) => {
                        setSelectedElements((prev) => prev.filter((_, i) => i !== index))
                      }}
                      sandboxReady={project?.status === 'active' && !!project?.ephemeral_url}
                      onClearElements={() => setSelectedElements([])}
                    />
                  </ErrorBoundary>
                </div>
              </Panel>

              <PanelResizeHandle className="resize-handle-vertical" />

              <Panel defaultSize={60} minSize={40}>
                <PanelGroup direction="vertical" className="right-panel-group" onLayout={handlePanelLayout}>
                  <Panel
                    ref={previewPanelRef}
                    defaultSize={97}
                    minSize={3}
                    className={`preview-panel ${previewCollapsed ? 'collapsed' : ''}`}
                  >
                    <div style={{ position: 'relative', height: '100%' }}>
                      {/* Progress overlay - shows during initialization */}
                      {isInitializing && (
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: 'rgba(26, 26, 26, 0.95)',
                          backdropFilter: 'blur(8px)',
                          zIndex: 1001,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          animation: 'fadeIn 0.3s ease-in',
                        }}>
                          <DeploymentProgress
                            projectId={project.project_id}
                            onComplete={() => {
                              console.log('Deployment complete!')
                              setIsInitializing(false)
                              if (onProjectUpdate) {
                                onProjectUpdate()
                              }
                            }}
                            onError={(error) => {
                              console.error('Deployment error:', error)
                              setIsInitializing(false)
                            }}
                          />
                        </div>
                      )}

                      {/* Git Panel Overlay */}
                      <GitPanel
                        project={project}
                        isExpanded={isGitPanelExpanded}
                        githubUsername={githubUsername}
                        onProjectUpdate={onProjectUpdate}
                      />

                      {/* Panel Content - Widget Builder */}
                      <ErrorBoundary>
                        <WidgetBuilderPanel
                          project={project}
                          isActive={true}
                          mode={previewMode}
                        />
                      </ErrorBoundary>
                    </div>
                  </Panel>
                </PanelGroup>
              </Panel>
            </PanelGroup>
          </>
        )}
      </div>
    </div>
  ) : (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#666',
      }}
    >
      <div>No project selected</div>
    </div>
  )

  return (
    <ResponsiveProjectContent
      project={project}
      selectedElementInput={selectedElementInput}
      selectedElements={selectedElements}
      onBack={handleBack}
      onElementSelected={() => { }}
      onExternalInputConsumed={() => setSelectedElementInput('')}
      onRemoveElement={(index) => {
        setSelectedElements((prev) => prev.filter((_, i) => i !== index))
      }}
      onClearElements={() => setSelectedElements([])}
      desktopContent={desktopContent}
    />
  )
}
