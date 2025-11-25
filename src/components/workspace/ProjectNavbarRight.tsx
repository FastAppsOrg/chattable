import { useState, useCallback } from 'react'
import { Monitor, ExternalLink, RotateCw, PanelLeftClose, PanelLeft, Smartphone, Tablet, GithubIcon, ChevronUp, Code2Icon, Cloud, CloudCog, Server, KanbanIcon, KanbanSquare, KanbanSquareIcon } from 'lucide-react'
import { SandboxConnectionStatus } from './SandboxConnectionStatus'
// import { SandboxTimer } from './SandboxTimer'
import { GracefulRestartDropdown } from './GracefulRestartDropdown'
import { PreviewModeSelector, type PreviewMode } from './PreviewModeSelector'
import type { Project } from '../../types/project'
import './ProjectNavbar.css'

interface ProjectNavbarRightProps {
  project: Project | null
  previewUrl?: string | null
  onRefresh?: () => void
  onOpenExternal?: () => void
  onViewportChange?: (width: number, height: number) => void
  onToggleChatFloating?: () => void
  isChatFloating?: boolean
  onToggleGitPanel?: () => void
  isGitPanelExpanded?: boolean
  previewMode?: PreviewMode
  onPreviewModeChange?: (mode: PreviewMode) => void
  githubUsername?: string
  onProjectUpdate?: () => void
}

export function ProjectNavbarRight({
  project,
  previewUrl,
  onRefresh,
  onOpenExternal,
  onViewportChange,
  onToggleChatFloating,
  isChatFloating,
  onToggleGitPanel,
  isGitPanelExpanded,
  previewMode = 'gallery',
  onPreviewModeChange,
  onProjectUpdate,
}: ProjectNavbarRightProps) {
  const [isRestartDropdownOpen, setIsRestartDropdownOpen] = useState(false)
  const [sandboxConnectionStatus, setSandboxConnectionStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('connecting')

  const getPathFromUrl = (url: string | null | undefined): string => {
    if (!url) return ''
    try {
      const urlObj = new URL(url)
      return urlObj.pathname + urlObj.search + urlObj.hash
    } catch {
      return url
    }
  }

  return (
    <>
      <div className="project-navbar-right-container">
        {/* Left Section - Dock Toggle */}
        <div className="navbar-left-section">
          {isChatFloating && (
            <button
              className="dock-toggle-btn"
              onClick={onToggleChatFloating}
              title={isChatFloating ? 'Dock Chat Panel' : 'Float Chat Panel'}
            >
              {isChatFloating ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
            </button>
          )}
          {/* Preview Mode Selector */}
          {onPreviewModeChange && (
            <PreviewModeSelector
              currentMode={previewMode}
              onModeChange={onPreviewModeChange}
            />
          )}
          {/* TODO : implement later. */}
          {/* <button
              className={`code-view-toggle-btn ${previewMode === 'code' ? 'active' : ''}`}
              onClick={onCodeViewToggle}
              title={previewMode === 'code' ? 'Exit Code View' : 'Code View'}
            >
            <Server size={16} />
          </button>
          <button
              className={`code-view-toggle-btn ${previewMode === 'code' ? 'active' : ''}`}
              onClick={onCodeViewToggle}
              title={previewMode === 'code' ? 'Exit Code View' : 'Code View'}
            >
            <KanbanSquareIcon size={16} />
          </button> */}
        </div>

        {/* Center Section - Browser Controls */}
        <div className="navbar-center-section">
          <div className="lovable-browser-bar">
            <div className="lovable-url-display">
              <span className="lovable-url-text">
                {getPathFromUrl(previewUrl) || '/'}
              </span>
            </div>
            <button
              className="lovable-browser-icon"
              onClick={onOpenExternal}
              disabled={!previewUrl}
              title="Open in New Tab"
            >
              <ExternalLink size={14} />
            </button>
            <button
              className="lovable-browser-icon"
              onClick={onRefresh}
              disabled={!previewUrl}
              title="Refresh"
            >
              <RotateCw size={14} />
            </button>
          </div>
        </div>

        {/* Right Section - Timer, Status */}
        <div className="navbar-right-section">
          {/* Git Panel Toggle Button */}
          {onToggleGitPanel && (
            <button
              className="git-panel-toggle-btn"
              onClick={onToggleGitPanel}
              title={isGitPanelExpanded ? 'Hide Git History' : 'Show Git History'}
            >
              {isGitPanelExpanded ? <ChevronUp size={16} /> : <GithubIcon size={16} />}
            </button>
          )}
          {/* Sandbox Timer - only show when connected */}
          {project?.project_id && sandboxConnectionStatus === 'connected' && (
            <div style={{ position: 'relative' }}>
              {/* TODO - Auto Restart that works 100% Super Robust */}
              {/* <SandboxTimer
                projectId={project.project_id}
                onRestartClick={() => setIsRestartDropdownOpen(prev => !prev)}
              /> */}
              {isRestartDropdownOpen && (
                <GracefulRestartDropdown
                  isOpen={isRestartDropdownOpen}
                  onClose={() => setIsRestartDropdownOpen(false)}
                  projectId={project.project_id}
                  onSuccess={onProjectUpdate}
                />
              )}
            </div>
          )}

          {/* Sandbox Connection Status */}
          {project?.project_id && (
            <SandboxConnectionStatus
              projectId={project.project_id}
              onStatusChange={setSandboxConnectionStatus}
            />
          )}
        </div>
      </div>
    </>
  )
}
