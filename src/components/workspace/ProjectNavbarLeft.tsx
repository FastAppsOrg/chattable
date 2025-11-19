import { useState, useRef, useEffect } from 'react'
import { Pencil, PanelLeft, PanelLeftClose } from 'lucide-react'
import { useProjectContext } from '../../hooks/useProjectContext'
import type { Project } from '../../types/project'
import './ProjectNavbar.css'

interface ProjectNavbarLeftProps {
  project: Project | null
  onProjectUpdate?: () => void
  onToggleChatFloating?: () => void
  isChatFloating?: boolean
}

export function ProjectNavbarLeft({
  project,
  onProjectUpdate,
  onToggleChatFloating,
  isChatFloating,
}: ProjectNavbarLeftProps) {
  const { updateProject } = useProjectContext()
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditingName])

  const formatBranch = (branch?: string) => {
    if (!branch) return 'main'
    return branch.length > 20 ? branch.substring(0, 20) + '...' : branch
  }

  const handleNameClick = () => {
    if (!project) return
    setEditedName(project.name || '')
    setIsEditingName(true)
  }

  const handleNameSave = async () => {
    if (!project?.project_id || !editedName.trim()) {
      setIsEditingName(false)
      return
    }

    try {
      await updateProject(project.project_id, { name: editedName.trim() })
      setIsEditingName(false)
      onProjectUpdate?.()
    } catch (error) {
      console.error('Failed to update project name:', error)
      setIsEditingName(false)
    }
  }

  const handleNameCancel = () => {
    setIsEditingName(false)
    setEditedName('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleNameSave()
    } else if (e.key === 'Escape') {
      handleNameCancel()
    }
  }

  return (
    <div className="project-navbar-left">
      <div className="project-info">
        {isEditingName ? (
          <input
            ref={inputRef}
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={handleKeyDown}
            className="project-name-input"
          />
        ) : (
          <div className="project-name-wrapper" onClick={handleNameClick}>
            <span className="project-name">
              {project?.name || 'Untitled Project'}
            </span>
            <Pencil size={14} className="project-name-edit-icon" />
          </div>
        )}
        <span className="project-separator">•</span>
        <span className="project-branch">{formatBranch(project?.default_branch)}</span>
      </div>

      {onToggleChatFloating && (
          <button
            className="dock-toggle-btn"
            onClick={onToggleChatFloating}
            title={isChatFloating ? 'Dock Chat Panel' : 'Float Chat Panel'}
          >
            {isChatFloating ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          </button>
        )}
    </div>
  )
}
