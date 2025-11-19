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
import { useNavigate } from 'react-router-dom'
import { useGitCommits } from '../../hooks/useGitCommits'
import type { Project } from '../../types/project'
import type { InspectorSelectionData } from '../../types'
import { ProjectService } from '../../services/api/project'
import type { EmbeddedBrowserHandle } from '../preview/EmbeddedBrowser'
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
  const browserRef = useRef<EmbeddedBrowserHandle>(null)
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

  // Poll for project readiness if status is initializing
  useEffect(() => {
    if (!project || project.status !== 'initializing') {
      setIsInitializing(false)
      return
    }

    setIsInitializing(true)
    console.log('Project is initializing, polling for readiness...')

    let cancelled = false

    // Start polling in background
    ProjectService.waitForProjectReady(project.project_id, {
      maxAttempts: 30,
      pollInterval: 10000, // 10 seconds - reduced polling frequency
      onProgress: (status, attempt) => {
        if (cancelled) return
        console.log(`Sandbox status: ${status} (attempt ${attempt}/30)`)
      },
    })
      .then((readyProject) => {
        if (cancelled) return
        console.log('Sandbox ready!')
        setIsInitializing(false)
        // Trigger project update to refresh with ephemeral_url
        if (onProjectUpdate) {
          onProjectUpdate()
        }
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Failed to wait for project readiness:', error)
        setIsInitializing(false)
        // Trigger project update even on error to refresh status
        if (onProjectUpdate) {
          onProjectUpdate()
        }
      })

    // Cleanup: mark as cancelled when component unmounts or project changes
    return () => {
      cancelled = true
      setIsInitializing(false)
    }
  }, [project?.project_id, project?.status])

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
    browserRef.current?.refresh()
  }, [])

  const handleOpenExternal = useCallback(() => {
    browserRef.current?.openExternal()
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
      onElementSelected={() => {}}
      onExternalInputConsumed={() => setSelectedElementInput('')}
      onRemoveElement={(index) => {
        setSelectedElements((prev) => prev.filter((_, i) => i !== index))
      }}
      onClearElements={() => setSelectedElements([])}
      desktopContent={desktopContent}
    />
  )
}
